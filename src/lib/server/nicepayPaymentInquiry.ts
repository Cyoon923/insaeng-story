/**
 * NICEPAY REST 거래조회 (NICEPAY-Payment-Inquiry-Client-1).
 *
 * 취소 결과가 unknown이거나, 선점만 남고 끊긴 건(stale processing), 기록에 실패한 건을
 * **다시 취소하지 않고** 확인하기 위한 읽기 전용 client다.
 *
 * 이 파일은 HTTP 요청 1회와 그 결과 분류만 한다. DB도, 상태 변경도, 재시도도 없다.
 * 그리고 정책 판단을 하지 않는다. "우리 환불 문의를 완료로 바꿔라" 같은 결론은 내지
 * 않고, NICEPAY가 말한 사실만 그대로 담아 돌려준다. 내부 기록과 대조해 결론을 내는
 * 일은 나중에 만들 대조(reconciliation) 단계의 몫이다.
 *
 * 승인(nicepayApprove.ts)·취소(nicepayCancel.ts) client와 같은 env·인증·응답 처리
 * 방식을 따른다. 두 파일은 건드리지 않았고 공통화를 위해 옮긴 것도 없다.
 * NICEPAY_SECRET_KEY는 여기서만 읽고 값이나 Authorization 헤더를 로그·응답에 담지 않는다.
 *
 * 규격
 *  - 거래조회 GET https://api.nicepay.co.kr/v1/payments/{tid}
 *    Authorization: Basic base64(clientKey:secretKey)   (승인·취소와 같은 계열)
 *    본문 없음
 *  - 구형 webapi.nicepay.co.kr/webapi/inquery/trans_status.jsp는 쓰지 않는다.
 *  - 망취소(/v1/payments/netcancel)는 다른 기능이라 여기서 쓰지 않는다.
 */
import type { PaymentStatus } from "@/lib/types/app";

const PAYMENTS_ENDPOINT = "https://api.nicepay.co.kr/v1/payments";

/**
 * 조회 응답에서 우리가 실제로 읽는 필드만 선언한다(승인·취소 client와 같은 방식).
 * 취소 여부를 판단하려면 상태와 금액이 함께 필요하다.
 */
export interface NicepayPaymentInquiryResult {
  resultCode?: string;
  resultMsg?: string;
  tid?: string;
  orderId?: string;
  /** NICEPAY가 말하는 현재 거래 상태. 전액취소가 끝났으면 "cancelled"다. */
  status?: PaymentStatus | string;
  /** 승인 금액. */
  amount?: number;
  /** 취소된 금액. */
  cancelledAmt?: number;
  /** 남은 금액. 전액취소면 0이다. */
  balanceAmt?: number;
  approvedAt?: string;
  cancelledAt?: string;
}

/**
 * 조회 결과.
 *
 * found는 "거래를 찾았다"는 뜻일 뿐, "취소되었다"는 뜻이 아니다. 취소 여부는 그 안의
 * status와 금액을 보고 대조 단계가 판단한다. 두 가지를 같은 뜻으로 다루지 않는다.
 *
 * unknown은 실패가 아니다. 거래가 없다는 뜻도, 취소되지 않았다는 뜻도 아니다.
 * 단지 지금 확인하지 못했다는 뜻이며, 이 결과를 근거로 재취소하면 안 된다.
 */
export type NicepayPaymentInquiryOutcome =
  | {
      kind: "found";
      result: NicepayPaymentInquiryResult;
      /** 응답 원문. 저장은 호출부가 한다. */
      raw: Record<string, unknown>;
      httpStatus: number;
    }
  /** NICEPAY가 그런 거래가 없다고 분명히 답했다. */
  | { kind: "not-found"; raw: Record<string, unknown> | null; httpStatus: number }
  | {
      kind: "unknown";
      /** 사람에게 보여도 되는 짧은 사유. PG 원문이나 secret은 담지 않는다. */
      message: string;
      raw: Record<string, unknown> | null;
      httpStatus: number | null;
    };

/** 조회 요청이 성공적으로 처리되었음을 뜻하는 결과코드. */
const INQUIRY_SUCCESS_CODE = "0000";

/** 결제창 호출에 쓰는 공개키. 승인·취소 client와 같은 env를 읽는다. */
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
export class NicepayInquiryInputError extends Error {}

/**
 * 거래 1건을 조회한다. 읽기만 한다.
 *
 * 한 번만 보낸다. 안에서 다시 시도하지 않는다. 확인하지 못했다는 사실 자체가
 * 사람이 봐야 한다는 신호이고, 반복 호출로 가릴 일이 아니다.
 *
 * fetchImpl은 테스트에서 응답을 흉내 내기 위한 자리다. 제품 코드에서는 넘기지 않는다.
 */
export async function inquireNicepayPayment(
  input: { tid: string },
  fetchImpl: typeof fetch = fetch,
): Promise<NicepayPaymentInquiryOutcome> {
  const tid = input.tid.trim();
  // 빈 값으로 부르면 무엇을 조회하는지 알 수 없다. 요청 자체를 보내지 않는다.
  if (!tid) throw new NicepayInquiryInputError("조회할 거래 번호가 없습니다.");

  const clientKey = nicepayClientKey();
  const secretKey = nicepaySecretKey();
  const authorization = Buffer.from(`${clientKey}:${secretKey}`, "utf8").toString("base64");

  let response: Response;
  try {
    response = await fetchImpl(`${PAYMENTS_ENDPOINT}/${encodeURIComponent(tid)}`, {
      method: "GET",
      cache: "no-store",
      headers: { Authorization: `Basic ${authorization}` },
    });
  } catch {
    // 네트워크 실패·중단(AbortError 포함). 거래가 없다는 뜻이 아니라 확인하지 못한 것이다.
    return {
      kind: "unknown",
      message: "거래 정보를 확인하는 중입니다.",
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

  // 그런 거래가 없다고 분명히 답한 경우. 거래의 상태가 아니라 자원의 유무를 말하는 값이다.
  if (response.status === 404) {
    return { kind: "not-found", raw, httpStatus: response.status };
  }

  // 본문을 읽을 수 없거나 서버 쪽 오류(5xx)면 아무것도 확정할 수 없다.
  if (!raw || response.status >= 500) {
    return {
      kind: "unknown",
      message: "거래 정보를 확인하는 중입니다.",
      raw,
      httpStatus: response.status,
    };
  }

  const result = raw as NicepayPaymentInquiryResult;
  /*
   * 조회가 제대로 처리되었고 어떤 거래인지 알아볼 수 있을 때만 found로 본다.
   * tid까지 확인하는 이유는, 결과코드만 보고 넘기면 빈 껍데기 응답을 "거래를 찾았다"로
   * 읽게 되기 때문이다.
   *
   * 그 밖의 결과코드는 무슨 뜻인지 확정할 수 없으므로 unknown으로 둔다. HTTP 상태만
   * 보고 거래 상태를 추측하지 않고, 코드 목록을 근거 없이 지어내지도 않는다.
   */
  if (result.resultCode === INQUIRY_SUCCESS_CODE && (result.tid ?? "").trim()) {
    return { kind: "found", result, raw, httpStatus: response.status };
  }

  return {
    kind: "unknown",
    message: "거래 정보를 확인하는 중입니다.",
    raw,
    httpStatus: response.status,
  };
}
