/**
 * NICEPAY REST 전액취소 호출 (NICEPAY-Cancel-Client-1).
 *
 * 이 파일은 HTTP 요청 1회와 그 결과 분류만 한다. DB도, 상태 변경도, 재시도도 없다.
 * 어떤 결제를 취소할지 고르는 일과 결과를 저장하는 일은 호출부의 몫이다.
 *
 * 승인 client(nicepayApprove.ts)와 같은 env·인증·응답 처리 방식을 따른다.
 * 승인 코드는 건드리지 않았고, 공통화를 위해 옮겨 놓은 것도 없다.
 * NICEPAY_SECRET_KEY는 여기서만 읽고 값이나 Authorization 헤더를 로그·응답에 담지 않는다.
 *
 * 규격
 *  - 전액취소 POST https://api.nicepay.co.kr/v1/payments/{tid}/cancel
 *    Authorization: Basic base64(clientKey:secretKey)   (승인과 같은 계열)
 *    body: reason(필수), orderId(필수)
 *  - 취소 성공 resultCode는 2001(취소 성공)과 2211(환불 성공)이다.
 *    승인 성공코드(0000)와 다르므로 승인 쪽 판정을 그대로 가져다 쓰지 않는다.
 *  - cancelAmt를 보내지 않으면 전액취소다. 이 프로젝트는 전액취소만 다루므로 보내지 않는다.
 *  - 구형 webapi cancel_process.jsp는 쓰지 않는다.
 *  - 망취소(/v1/payments/netcancel)는 승인 자체를 무르는 다른 기능이라 여기서 쓰지 않는다.
 */
import type { PaymentStatus } from "@/lib/types/app";

const PAYMENTS_ENDPOINT = "https://api.nicepay.co.kr/v1/payments";

/**
 * 취소가 끝났음을 뜻하는 결과코드.
 *
 * 2001 취소 성공, 2211 환불 성공. 두 값을 같은 성공으로 본다.
 *
 * 승인 성공코드 0000은 여기에 넣지 않는다. repo 안에서 0000이 나오는 곳은
 * nicepayApprove.ts의 승인 판정과 returnUrl 인증 결과(AUTH_SUCCESS)뿐이고,
 * 취소 응답에서도 0000이 성공이라는 근거는 어디에도 없다. 근거 없이 넣으면
 * 취소되지 않은 응답을 성공으로 읽게 되므로 넣지 않는다.
 */
const CANCEL_SUCCESS_CODES = new Set(["2001", "2211"]);

/** 취소 응답에서 우리가 실제로 읽는 필드만 선언한다(승인 쪽과 같은 방식). */
export interface NicepayCancelResult {
  resultCode?: string;
  resultMsg?: string;
  /** NICEPAY가 돌려주는 결제 상태. 전액취소가 끝나면 "cancelled"다. */
  status?: PaymentStatus | string;
  tid?: string;
  orderId?: string;
  /** 원 결제 금액. */
  amount?: number;
  /** 취소된 금액. */
  cancelledAmt?: number;
  /** 남은 금액. 전액취소면 0이다. */
  balanceAmt?: number;
  cancelledAt?: string;
}

/**
 * 취소 요청의 결과.
 *
 * succeeded  NICEPAY가 취소되었다고 분명히 답했다.
 * declined   NICEPAY가 정상 응답했고 그 내용이 분명한 취소 실패다.
 * unknown    실제로 취소되었는지 확정할 수 없다.
 *
 * unknown은 실패가 아니다. 통신이 끊겼어도 PG 쪽에서는 취소가 끝났을 수 있다.
 * 그래서 호출부는 unknown을 받았을 때 **자동으로 다시 취소하지 않는다**. 다시 부르면
 * 같은 거래를 두 번 취소하거나, 취소된 줄 모르고 다른 처리를 하게 된다.
 * 결론은 거래조회나 사람 확인으로 낸다.
 */
export type NicepayCancelOutcome =
  | {
      kind: "succeeded";
      result: NicepayCancelResult;
      /** 응답 원문. 저장은 호출부가 한다(승인 raw와 다른 자리에 담는다). */
      raw: Record<string, unknown>;
      httpStatus: number;
    }
  | {
      kind: "declined";
      result: NicepayCancelResult;
      /** 사람에게 보여도 되는 짧은 사유. PG 원문이나 secret은 담지 않는다. */
      message: string;
      raw: Record<string, unknown>;
      httpStatus: number;
    }
  | {
      kind: "unknown";
      message: string;
      raw: Record<string, unknown> | null;
      httpStatus: number | null;
    };

/** 결제창 호출에 쓰는 공개키. 승인 client와 같은 env를 읽는다. */
function nicepayClientKey(): string {
  const key = process.env.NEXT_PUBLIC_NICEPAY_CLIENT_KEY?.trim();
  if (!key) throw new Error("NICEPAY client key가 설정되지 않았습니다.");
  return key;
}

/** 서버 전용 키. 이 함수의 반환값을 로그로 남기지 않는다. */
function nicepaySecretKey(): string {
  const key = process.env.NICEPAY_SECRET_KEY?.trim();
  if (!key) throw new Error("NICEPAY secret key가 설정되지 않았습니다.");
  return key;
}

/** 요청을 만들기 전에 값이 갖춰졌는지 본다. */
export class NicepayCancelInputError extends Error {}

/**
 * 전액취소 요청 1회.
 *
 * tid·orderId·reason은 모두 서버가 이미 정해 둔 값이다. 특히 reason은 고객이 적은
 * 글을 그대로 넘기는 자리가 아니다. 이 함수는 받은 문자열을 그대로 보내는 저수준
 * client이고, 무엇을 사유로 보낼지는 호출부가 정한다.
 *
 * 한 번만 보낸다. 안에서 다시 시도하지 않는다.
 *
 * fetchImpl은 테스트에서 응답을 흉내 내기 위한 자리다. 제품 코드에서는 넘기지 않는다.
 */
export async function cancelNicepayPayment(
  input: { tid: string; orderId: string; reason: string },
  fetchImpl: typeof fetch = fetch,
): Promise<NicepayCancelOutcome> {
  const tid = input.tid.trim();
  const orderId = input.orderId.trim();
  const reason = input.reason.trim();
  // 값이 비어 있으면 요청 자체를 보내지 않는다. 빈 값으로 PG를 부르면 무엇이 취소될지
  // 알 수 없고, 실패 응답만 늘어난다.
  if (!tid) throw new NicepayCancelInputError("취소할 거래 번호가 없습니다.");
  if (!orderId) throw new NicepayCancelInputError("취소할 주문번호가 없습니다.");
  if (!reason) throw new NicepayCancelInputError("취소 사유가 없습니다.");

  const clientKey = nicepayClientKey();
  const secretKey = nicepaySecretKey();
  const authorization = Buffer.from(`${clientKey}:${secretKey}`, "utf8").toString("base64");

  let response: Response;
  try {
    response = await fetchImpl(
      `${PAYMENTS_ENDPOINT}/${encodeURIComponent(tid)}/cancel`,
      {
        method: "POST",
        cache: "no-store",
        headers: {
          Authorization: `Basic ${authorization}`,
          "Content-Type": "application/json",
        },
        // cancelAmt를 넣지 않는다. 넣지 않는 것이 전액취소다.
        body: JSON.stringify({ reason, orderId }),
      },
    );
  } catch {
    // 네트워크 실패·중단(AbortError 포함). 취소가 됐는지 안 됐는지 알 수 없다.
    // 실패로 확정하지 않고, 여기서 다시 부르지도 않는다.
    return {
      kind: "unknown",
      message: "취소 결과를 확인하는 중입니다.",
      raw: null,
      httpStatus: null,
    };
  }

  let raw: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = await response.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      raw = parsed as Record<string, unknown>;
    }
  } catch {
    raw = null;
  }

  // HTTP 상태와 NICEPAY 결과코드는 별개다. 본문을 읽을 수 없거나 서버 쪽 오류(5xx)면
  // 취소 여부를 확정할 수 없다. HTTP 상태만 보고 "취소되지 않았다"고 단정하지 않는다.
  if (!raw || response.status >= 500) {
    return {
      kind: "unknown",
      message: "취소 결과를 확인하는 중입니다.",
      raw,
      httpStatus: response.status,
    };
  }

  const result = raw as NicepayCancelResult;
  const successCode = CANCEL_SUCCESS_CODES.has(String(result.resultCode ?? ""));
  const cancelledStatus = result.status === "cancelled";

  // 결과코드와 상태가 둘 다 취소를 가리킬 때만 성공으로 확정한다.
  if (successCode && cancelledStatus) {
    return { kind: "succeeded", result, raw, httpStatus: response.status };
  }

  /*
   * 둘 중 하나만 취소를 가리키면 무슨 일이 일어났는지 확정할 수 없다.
   * 승인 client는 이런 어긋남을 declined로 보지만, 취소에서는 그렇게 하지 않는다.
   * 돈이 이미 움직였을 수 있는데 실패로 확정하면 되돌릴 수 없는 오해가 된다.
   *
   * - 성공코드인데 상태가 cancelled가 아님: 취소가 진행 중이거나 다른 일이 생긴 경우
   * - 상태는 cancelled인데 성공코드가 아님: 이미 취소된 거래일 수도 있다
   */
  if (successCode || cancelledStatus) {
    return {
      kind: "unknown",
      message: "취소 결과를 확인하는 중입니다.",
      raw,
      httpStatus: response.status,
    };
  }

  // 결과코드도 상태도 취소를 가리키지 않는다. PG가 분명히 거절한 경우다.
  return {
    kind: "declined",
    result,
    message: "결제 취소가 완료되지 않았습니다.",
    raw,
    httpStatus: response.status,
  };
}
