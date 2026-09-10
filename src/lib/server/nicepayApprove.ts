/**
 * NICEPAY 서버 승인. 이 파일은 서버에서만 쓰인다.
 * NICEPAY_SECRET_KEY는 여기서만 읽고, 값이나 Authorization 헤더를 절대 로그·응답에 담지 않는다.
 *
 * 공식 규격(nicepay-manual):
 *  - 인증 결과는 returnUrl로 application/x-www-form-urlencoded POST
 *  - signature = hex(sha256(authToken + clientId + amount + SecretKey))
 *  - 승인   POST https://api.nicepay.co.kr/v1/payments/{tid}
 *           Authorization: Basic base64(clientKey:secretKey)
 *           body: amount(필수), ediDate·signData·returnCharSet(선택)
 *           signData = hex(sha256(tid + amount + ediDate + SecretKey))
 *  - 성공   resultCode === "0000" && status === "paid"
 */
import { createHash, timingSafeEqual } from "crypto";

const APPROVE_ENDPOINT = "https://api.nicepay.co.kr/v1/payments";

/** 승인 응답에서 우리가 실제로 읽는 필드만 선언한다. */
export interface NicepayApproveResult {
  resultCode?: string;
  resultMsg?: string;
  status?: string;
  tid?: string;
  orderId?: string;
  amount?: number;
  payMethod?: string;
  paidAt?: string;
}

/**
 * 승인 결과의 종류.
 *  approved  승인 성공
 *  declined  NICEPAY가 정상 응답했고 그 내용이 명확한 승인 실패
 *  unknown   통신 오류·5xx·본문 파싱 실패 등 승인 여부를 확정할 수 없음
 *
 * unknown을 실패로 취급하면 "실제로는 승인됐는데 실패로 확정"하는 사고가 난다.
 * 호출자는 unknown일 때 결제 상태를 바꾸지 말아야 한다.
 */
export type NicepayApproveKind = "approved" | "declined" | "unknown";

export interface NicepayApproveOutcome {
  kind: NicepayApproveKind;
  ok: boolean;
  /** 사용자에게 보여도 되는 짧은 사유. PG 원문이나 secret은 담지 않는다. */
  reason: string;
  /** 승인 응답 원문. payments.raw에 남기는 용도이며 화면에 내보내지 않는다. */
  raw: Record<string, unknown> | null;
  result: NicepayApproveResult | null;
  httpStatus: number | null;
}

/** 결제창 호출에 쓰는 공개키. 서버에서는 clientId 대조에만 쓴다. */
export function nicepayClientKey(): string {
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

/** 두 설정이 모두 있는지 미리 확인한다. 없으면 승인 요청 전에 실패시킨다. */
export function nicepayConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_NICEPAY_CLIENT_KEY?.trim() && process.env.NICEPAY_SECRET_KEY?.trim(),
  );
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** 길이가 달라도 예외 없이 false를 돌려주는 상수시간 비교. */
function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

/**
 * returnUrl로 돌아온 signature 검증.
 * amount는 NICEPAY가 보낸 문자열 그대로 넣어야 해시가 맞는다.
 */
export function verifyReturnSignature(input: {
  authToken: string;
  clientId: string;
  amount: string;
  signature: string;
}): boolean {
  const expected = sha256Hex(input.authToken + input.clientId + input.amount + nicepaySecretKey());
  return safeEqualHex(expected, input.signature.trim().toLowerCase());
}

/**
 * 승인 요청. 호출 전에 서버 검증을 모두 끝낸 상태여야 한다.
 * amount는 서버가 확정한 금액만 넘긴다.
 */
export async function approveNicepayPayment(input: {
  tid: string;
  amount: number;
}): Promise<NicepayApproveOutcome> {
  const clientKey = nicepayClientKey();
  const secretKey = nicepaySecretKey();
  const ediDate = new Date().toISOString();
  const signData = sha256Hex(`${input.tid}${input.amount}${ediDate}${secretKey}`);
  const authorization = Buffer.from(`${clientKey}:${secretKey}`, "utf8").toString("base64");

  let response: Response;
  try {
    response = await fetch(`${APPROVE_ENDPOINT}/${encodeURIComponent(input.tid)}`, {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Basic ${authorization}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: input.amount,
        ediDate,
        signData,
        returnCharSet: "utf-8",
      }),
    });
  } catch {
    // 네트워크 실패. 승인이 됐는지 안 됐는지 알 수 없다. 실패로 확정하지 않는다.
    return {
      kind: "unknown",
      ok: false,
      reason: "결제 결과를 확인하는 중입니다.",
      raw: null,
      result: null,
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

  // HTTP 상태와 NICEPAY 결과코드는 별개다. 둘 다 확인한다.
  // 4xx는 요청이 거절된 것이라 결과가 확정이지만, 5xx·본문 없음은 확정할 수 없다.
  if (!raw || response.status >= 500) {
    return {
      kind: "unknown",
      ok: false,
      reason: "결제 결과를 확인하는 중입니다.",
      raw,
      result: null,
      httpStatus: response.status,
    };
  }

  const result = raw as NicepayApproveResult;
  const ok = result.resultCode === "0000" && result.status === "paid";
  if (ok) {
    return { kind: "approved", ok: true, reason: "", raw, result, httpStatus: response.status };
  }
  return {
    kind: "declined",
    ok: false,
    reason: "카드사 승인이 완료되지 않았습니다.",
    raw,
    result,
    httpStatus: response.status,
  };
}
