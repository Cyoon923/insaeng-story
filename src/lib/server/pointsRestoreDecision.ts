/**
 * 환불 적립금 복원 금액 판정 (Refund-Points-Ledger-Foundation-1).
 *
 * 하는 일은 하나다. "이 주문에서 실제로 쓰인 적립금이 얼마인지, 자동으로 복원해도
 * 되는지"를 근거 두 개로 맞춰 본다. 저장도, 복원도, 시각 생성도 하지 않는다.
 *
 * 근거가 둘인 이유
 * - Payment.orderSnapshot.discount.usePoints : 결제 준비 때 **서버가 계산한 차액**이다.
 *   승인 재검증이 쓰는 값이라 클라이언트가 위조할 수 없다. 그래서 이쪽을 기준으로 삼는다.
 * - Order.details.pointsUsed : 주문에 남은 표시용 값이다. details는 문자열 맵이고
 *   클라이언트가 임의 키를 섞을 수 있는 자리라, 단독으로는 복원 근거가 되지 못한다.
 * 둘이 정확히 같을 때만 복원 대상으로 본다. 한쪽만 있거나 값이 다르면 사람이 본다.
 *
 * 판정은 한쪽으로 치우쳐 있다(fail-closed). 복원하지 못해 사람이 한 번 더 보는 것은
 * 되돌릴 수 있지만, 잘못된 금액을 적립금으로 돌려주는 것은 되돌리기 어렵다.
 *
 * 승인 결제가 둘 이상인 경우(ambiguous)는 여기서 다루지 않는다. 그 판정은 이미
 * paymentLookup이 하고, 환불 실행 경로가 그 앞에서 막는다. 같은 규칙을 두 곳에 두지 않는다.
 *
 * import 경로가 상대경로인 이유는 다른 순수 모듈들과 같다(Node 내장 테스트 러너로 직접 실행).
 */
import type { Order, Payment } from "@/lib/types/app";

/**
 * 자동 복원을 하지 않는 이유. 실제 구조에서 생길 수 있는 것만 둔다.
 *
 * 어느 것도 오류가 아니다. "지금 자동으로는 하지 않는다"는 뜻이며,
 * 무엇을 사람이 확인해야 하는지 가리킨다.
 */
export type PointsRestoreBlockedReason =
  /** 결제 기록에 서버 계산 근거가 없다. 이 구조가 생기기 전의 결제 등. */
  | "missing-payment-evidence"
  /** 주문에 사용 적립금 표시가 없다. 옛 주문에서 생길 수 있다. */
  | "missing-order-evidence"
  /** 두 근거의 금액이 다르다. 어느 쪽이 맞는지 코드가 고르지 않는다. */
  | "evidence-mismatch"
  /** 근거는 있으나 원 단위 양의 정수가 아니다(0·음수·소수·읽을 수 없는 값). */
  | "invalid-amount"
  /** 실제로 쓴 적립금이 0이다. 돌려줄 것이 없다. */
  | "no-points-used";

export type PointsRestoreDecision =
  | { kind: "restore"; amount: number }
  | { kind: "blocked"; reason: PointsRestoreBlockedReason };

/**
 * 원 단위 적립금으로 읽는다. 읽을 수 없으면 null이다.
 *
 * 숫자로도 문자열로도 저장되어 있어 둘 다 받는다. 적립금은 정수라서 소수점이 있으면
 * 잘못된 값으로 본다. 반올림하거나 잘라내지 않는다.
 * 음수는 여기서 걸러내지 않고 그대로 돌려준다(위에서 사유를 나눠 판단한다).
 */
export function readPointAmount(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^-?\d+$/.test(trimmed)) return null;
    const parsed = Number(trimmed);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

/** 결제 기록에서 서버가 계산해 둔 사용 적립금을 꺼낸다. 없으면 undefined다. */
function paymentEvidence(payment: Payment): unknown {
  const snapshot = payment.orderSnapshot;
  if (!snapshot || typeof snapshot !== "object") return undefined;
  const discount = (snapshot as Record<string, unknown>).discount;
  if (!discount || typeof discount !== "object") return undefined;
  return (discount as Record<string, unknown>).usePoints;
}

/**
 * 이 주문의 적립금을 자동으로 복원해도 되는지 판정한다.
 *
 * 순서대로 본다. 결제 근거 → 주문 근거 → 값의 모양 → 두 값의 일치 → 0 여부.
 * 앞에서 걸리면 뒤는 보지 않는다.
 *
 * 여기서 "복원했는지"는 보지 않는다. 그것은 이 함수가 알 수 있는 사실이 아니며,
 * 적립금 원장(point_transactions)의 UNIQUE 제약이 최종적으로 막는다.
 */
export function decidePointsRestore(order: Order, payment: Payment): PointsRestoreDecision {
  const rawPayment = paymentEvidence(payment);
  if (rawPayment === undefined || rawPayment === null || rawPayment === "") {
    return { kind: "blocked", reason: "missing-payment-evidence" };
  }

  const rawOrder = order.details?.pointsUsed;
  if (rawOrder === undefined || rawOrder === null || String(rawOrder).trim() === "") {
    return { kind: "blocked", reason: "missing-order-evidence" };
  }

  const fromPayment = readPointAmount(rawPayment);
  const fromOrder = readPointAmount(rawOrder);
  // 한쪽이라도 원 단위 정수로 읽히지 않으면 두 값을 비교할 수 없다.
  if (fromPayment === null || fromOrder === null) {
    return { kind: "blocked", reason: "invalid-amount" };
  }
  if (fromPayment !== fromOrder) {
    return { kind: "blocked", reason: "evidence-mismatch" };
  }
  if (fromPayment < 0) {
    return { kind: "blocked", reason: "invalid-amount" };
  }
  if (fromPayment === 0) {
    return { kind: "blocked", reason: "no-points-used" };
  }

  return { kind: "restore", amount: fromPayment };
}
