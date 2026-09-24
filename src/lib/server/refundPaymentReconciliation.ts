/**
 * 내부 결제 기록과 NICEPAY 거래조회 결과 대조 (Refund-Payment-Reconciliation-1).
 *
 * 하는 일은 하나다. "전액취소가 끝났다는 사실을 안전하게 확정할 수 있는가"를 판정한다.
 *
 * 하지 않는 일
 * - 아무것도 저장하지 않는다. 순수 함수이며 DB도 네트워크도 건드리지 않는다.
 * - "완료로 바꿔라" 같은 지시를 내리지 않는다. 확정할 수 있는지와 그 근거만 돌려준다.
 *   실제로 무엇을 바꿀지는 나중에 만들 최종화 단계가 정한다.
 *
 * 판정은 한쪽으로 치우쳐 있다. 확정은 모든 조건이 맞을 때만 하고, 조금이라도 어긋나면
 * 확정하지 않는다. 확정하지 못해 사람이 한 번 더 보는 것은 되돌릴 수 있지만,
 * 잘못 확정해 환불을 끝난 일로 처리하는 것은 되돌릴 수 없다.
 */
import type { NicepayPaymentInquiryOutcome } from "@/lib/server/nicepayPaymentInquiry";
import type { Payment } from "@/lib/types/app";

/**
 * 확정에 이르지 못한 이유 중 "지금은 아니다"에 해당하는 것들.
 * 사실관계가 어긋난 것이 아니라 아직 취소가 확인되지 않았거나 확인할 수 없는 경우다.
 */
export type ReconciliationNotVerifiedReason =
  /** 거래조회 자체를 하지 못했다. 취소되지 않았다는 뜻이 아니다. */
  | "inquiry-unknown"
  /** PG는 이 거래가 아직 취소되지 않았다고 말한다. */
  | "pg-not-cancelled"
  /** PG가 부분취소 상태라고 말한다. 전액취소로 올리지 않는다. */
  | "pg-partial-cancelled"
  /** 전액취소를 확인할 금액 근거가 응답에 없다. */
  | "missing-amount-evidence";

/**
 * 사람이 봐야 하는 이유들. 내부 기록과 PG 사실이 어긋나거나, 있어야 할 값이 없는 경우다.
 * 조용히 정상 처리하지 않는다.
 */
export type ReconciliationManualReviewReason =
  /** 승인 상태가 아닌 결제다. */
  | "internal-not-paid"
  /** 내부 기록에 이미 취소 금액이 있다. 전액취소로 다룰 수 없다. */
  | "internal-already-cancelled"
  /** 내부 승인 금액이 없거나 정상적인 원 단위 금액이 아니다. */
  | "internal-amount-invalid"
  /** PG가 그런 거래가 없다고 답했다. 승인된 결제인데 조회되지 않는 것은 그 자체로 문제다. */
  | "inquiry-not-found"
  /** 내부에 거래 번호가 없다. */
  | "missing-internal-tid"
  /** 조회 응답에 거래 번호가 없다. */
  | "missing-inquiry-tid"
  /** 거래 번호가 서로 다르다. */
  | "tid-mismatch"
  /** 내부에 주문 id(결제창 주문번호 또는 내부 주문 id)가 없다. */
  | "missing-internal-order-id"
  /** 조회 응답에 주문 id가 없다. */
  | "missing-inquiry-order-id"
  /** 주문 id가 서로 다르다. */
  | "order-id-mismatch"
  /** PG 응답의 금액을 숫자로 읽을 수 없다. */
  | "pg-amount-invalid"
  /** PG가 말하는 승인 금액이 내부 승인 금액과 다르다. */
  | "approved-amount-mismatch"
  /** 취소된 금액이 승인 금액과 다르다. */
  | "cancelled-amount-mismatch"
  /** 아직 남은 금액이 있다. */
  | "balance-remaining"
  /** 취소를 시도한 기록이 없다. 기록 없이 확정하지 않는다. */
  | "no-cancel-attempt"
  /** 내부에는 거절로 남아 있는데 PG는 취소되었다고 말한다. */
  | "declined-but-pg-cancelled";

/**
 * 확정된 취소가 어느 경로에서 나왔는지.
 *
 * - normal                : 취소 요청이 성공으로 기록된 뒤 확인했다.
 * - recovered-unknown     : 결과를 확정하지 못했던 건을 조회로 확인했다.
 * - recovered-stale-claim : 실행권만 선점된 채 남아 있던 건을 조회로 확인했다.
 *
 * 셋 다 PG 사실은 같지만, 어떻게 여기까지 왔는지는 다르다. 뒤 두 가지는 우리 기록이
 * 한 번 끊겼던 건이라 최종화 단계에서 다르게 다룰 수 있도록 구분해 둔다.
 */
export type ReconciliationSource = "normal" | "recovered-unknown" | "recovered-stale-claim";

export type RefundPaymentReconciliation =
  | {
      kind: "verified-full-cancel";
      source: ReconciliationSource;
      /** ── 최종화에 필요한 최소 사실만 담는다. 응답 원문은 복제하지 않는다. ── */
      paymentId: string;
      orderId: string;
      tid: string;
      approvedAmount: number;
      /** 확인된 취소 금액. 승인 금액과 같다. */
      verifiedCancelledAmount: number;
      /** PG가 알려 준 취소 시각. 값이 없으면 null이며 지어내지 않는다. */
      pgCancelledAt: string | null;
    }
  | { kind: "not-verified"; reason: ReconciliationNotVerifiedReason }
  | { kind: "manual-review"; reason: ReconciliationManualReviewReason };

/**
 * 원 단위 금액으로 읽는다. 읽을 수 없으면 null이다.
 *
 * 숫자로 올 수도 문자열로 올 수도 있어 둘 다 받는다. 원화는 정수라서 소수점이 있으면
 * 잘못된 값으로 본다. 허용 오차를 두지 않고 정확히 비교한다.
 */
export function readWonAmount(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 0 ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const parsed = Number(trimmed);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * 내부 결제 기록과 조회 결과를 맞춰 본다.
 *
 * 순서대로 본다. 내부 상태 → 조회 성사 여부 → 같은 거래인지 → PG가 말하는 상태 →
 * 금액 → 우리가 어디까지 진행했는지. 앞에서 걸리면 뒤는 보지 않는다.
 */
export function reconcileRefundPaymentCancel(
  payment: Payment,
  inquiry: NicepayPaymentInquiryOutcome,
): RefundPaymentReconciliation {
  // 1) 내부 상태. 승인된 결제이고 아직 취소 금액이 없어야 전액취소를 말할 수 있다.
  if (payment.status !== "paid") {
    return { kind: "manual-review", reason: "internal-not-paid" };
  }
  if (payment.cancelledAmount !== 0) {
    return { kind: "manual-review", reason: "internal-already-cancelled" };
  }
  const approvedAmount = readWonAmount(payment.approvedAmount);
  if (approvedAmount === null || approvedAmount <= 0) {
    return { kind: "manual-review", reason: "internal-amount-invalid" };
  }

  // 2) 조회가 성사되었는지. 확인하지 못한 것과 거래가 없는 것을 구분한다.
  if (inquiry.kind === "unknown") {
    // 취소되지 않았다는 뜻이 아니다. 이 결과를 재취소 신호로 쓰지 않는다.
    return { kind: "not-verified", reason: "inquiry-unknown" };
  }
  if (inquiry.kind === "not-found") {
    // 승인된 결제인데 PG에 없다. 조용히 넘길 일이 아니고, 재취소 신호도 아니다.
    return { kind: "manual-review", reason: "inquiry-not-found" };
  }

  // 3) 같은 거래인지. 하나라도 어긋나면 확정하지 않는다.
  const internalTid = text(payment.pgTid);
  const inquiryTid = text(inquiry.result.tid);
  if (!internalTid) return { kind: "manual-review", reason: "missing-internal-tid" };
  if (!inquiryTid) return { kind: "manual-review", reason: "missing-inquiry-tid" };
  if (internalTid !== inquiryTid) return { kind: "manual-review", reason: "tid-mismatch" };

  /*
   * 주문 id는 두 가지를 구분해서 쓴다.
   *
   * - merchantOrderId : 결제창에 실제로 넘긴 값이고, PG가 orderId로 알고 있는 값이다.
   *   조회 응답의 orderId와 맞춰 볼 대상은 이쪽이다.
   * - payment.orderId : 승인 뒤에 붙인 내부 주문 id다(`o-`/`c-` 접두사가 붙는다).
   *   PG는 이 값을 모르므로 조회 응답과 비교하면 항상 어긋난다.
   *
   * 비교용과 반환용을 따로 둔다. 반환값은 최종화가 내부 주문을 찾는 데 쓰므로
   * 계속 내부 주문 id여야 한다.
   */
  const merchantOrderId = text(payment.merchantOrderId);
  const internalOrderId = text(payment.orderId);
  const inquiryOrderId = text(inquiry.result.orderId);
  // 둘 중 하나라도 없으면 확정할 수 없다. 비교할 값도, 돌려줄 값도 있어야 한다.
  if (!merchantOrderId || !internalOrderId) {
    return { kind: "manual-review", reason: "missing-internal-order-id" };
  }
  if (!inquiryOrderId) return { kind: "manual-review", reason: "missing-inquiry-order-id" };
  if (merchantOrderId !== inquiryOrderId) {
    return { kind: "manual-review", reason: "order-id-mismatch" };
  }

  // 4) PG가 말하는 상태. 전액취소가 끝난 상태만 확정 후보다.
  const pgStatus = inquiry.result.status;
  if (pgStatus === "partialCancelled") {
    // 부분취소를 전액취소로 올리지 않는다.
    return { kind: "not-verified", reason: "pg-partial-cancelled" };
  }
  if (pgStatus !== "cancelled") {
    return { kind: "not-verified", reason: "pg-not-cancelled" };
  }

  // 5) 금액. 있는 값은 전부 맞아야 하고, 맞는 값이 하나도 없으면 확정하지 않는다.
  const hasAmount = inquiry.result.amount !== undefined && inquiry.result.amount !== null;
  const hasCancelled =
    inquiry.result.cancelledAmt !== undefined && inquiry.result.cancelledAmt !== null;
  const hasBalance = inquiry.result.balanceAmt !== undefined && inquiry.result.balanceAmt !== null;

  if (hasAmount) {
    const amount = readWonAmount(inquiry.result.amount);
    if (amount === null) return { kind: "manual-review", reason: "pg-amount-invalid" };
    if (amount !== approvedAmount) {
      return { kind: "manual-review", reason: "approved-amount-mismatch" };
    }
  }
  if (hasCancelled) {
    const cancelledAmt = readWonAmount(inquiry.result.cancelledAmt);
    if (cancelledAmt === null) return { kind: "manual-review", reason: "pg-amount-invalid" };
    if (cancelledAmt !== approvedAmount) {
      return { kind: "manual-review", reason: "cancelled-amount-mismatch" };
    }
  }
  if (hasBalance) {
    const balanceAmt = readWonAmount(inquiry.result.balanceAmt);
    if (balanceAmt === null) return { kind: "manual-review", reason: "pg-amount-invalid" };
    if (balanceAmt !== 0) return { kind: "manual-review", reason: "balance-remaining" };
  }
  /*
   * 전액취소를 뒷받침하는 금액 근거가 적어도 하나는 있어야 한다.
   * 취소된 금액이 승인 금액과 같거나, 남은 금액이 0이거나.
   * 상태 문자열 하나만 보고 돈이 다 돌아갔다고 확정하지 않는다.
   */
  if (!hasCancelled && !hasBalance) {
    return { kind: "not-verified", reason: "missing-amount-evidence" };
  }

  // 6) 우리가 어디까지 진행했는지. 기록 없이 확정하지 않는다.
  const execution = payment.cancelExecutionStatus ?? null;
  if (execution === "declined") {
    // 내부에는 거절로 남아 있는데 PG는 취소되었다고 한다. 사실이 어긋난다.
    return { kind: "manual-review", reason: "declined-but-pg-cancelled" };
  }
  if (execution === null) {
    // 취소를 시도한 적이 없는데 PG에서는 취소되어 있다. 우리가 모르는 취소다.
    return { kind: "manual-review", reason: "no-cancel-attempt" };
  }

  const source: ReconciliationSource =
    execution === "succeeded"
      ? "normal"
      : execution === "unknown"
        ? "recovered-unknown"
        : "recovered-stale-claim";

  return {
    kind: "verified-full-cancel",
    source,
    paymentId: payment.id,
    orderId: internalOrderId,
    tid: internalTid,
    approvedAmount,
    verifiedCancelledAmount: approvedAmount,
    // 값이 없으면 null로 둔다. 시각을 지어내지 않는다.
    pgCancelledAt: text(inquiry.result.cancelledAt) || null,
  };
}
