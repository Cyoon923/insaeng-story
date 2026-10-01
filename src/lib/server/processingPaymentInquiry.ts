/**
 * 승인 processing으로 남은 결제의 관리자 수동 확인 (P1-02).
 *
 * 승인 API 응답을 받지 못했거나(timeout 등) 승인 응답 검증에 실패한 결제는 processing으로
 * 남는다. 관리자가 "결제 조회"를 누르면 NICEPAY 주문번호 조회로 실제 상태를 확인하고,
 * **검증이 모두 끝난 paid만** 기존 claimPaymentApproved로 processing → paid 전환한다.
 *
 *   1) 대상 확인          — nicepay · processing · order_id 없음 · 10분 경과 · 금액 일치
 *   2) 조회 방식
 *      - approveAttemptTid 있음 — 그 tid로 거래 1건 직접 조회. 주문번호 조회로 넘어가지 않는다
 *      - 없음(레거시)          — 주문일자 후보(createdAt·updatedAt의 KST 날짜)로 주문번호 조회.
 *                                첫 후보가 not-found일 때만 다음 후보. unknown이면 멈춘다
 *   3) 조회 결과 검증      — tid(시도 tid가 있으면 정확히 같아야 함) · orderId · amount · status · balanceAmt
 *   4) paid 전환           — claimPaymentApproved(WHERE status='processing') 1회
 *   4') 실패 확정          — 시도 tid로 조회한 같은 거래가 failed / expired면
 *                            markPaymentFailed(WHERE status='processing') 1회
 *                            (P1-04 Stage 5. 상담 시간 확보는 풀지 않는다. 관리자가 따로 해제한다)
 *      레거시 경로에서는 failed / expired여도 확정하지 않는다. 주문번호 조회가 돌려준 거래가
 *      우리가 승인 요청한 거래인지 대조할 값이 없어서다. processing으로 두고 수동 확인을 안내한다.
 *
 * 하지 않는 일(deps에 없어 부를 방법이 없다)
 * - 주문·상담 생성, recommit, 적립금·쿠폰·추천인 변경
 * - failed / expired가 아닌 상태를 바꾸기(ready·cancelled·partialCancelled는 표시만)
 * - 상담 시간 확보(hold) 해제
 * - 재승인, 망취소, 자동 재시도
 * - PG 응답 원문 저장
 * paid 전환 뒤 주문 접수는 기존 "재접수"(admin/payments/recommit)가 맡는다.
 */
import { readWonAmount } from "./refundPaymentReconciliation.ts";
import type {
  NicepayPaymentInquiryOutcome,
  NicepayPaymentInquiryResult,
} from "./nicepayPaymentInquiry.ts";
import type { Payment } from "@/lib/types/app";

/** 승인 중일 수 있는 건을 건드리지 않기 위한 기준. listPaymentsNeedingReview와 같은 10분이다. */
const STALE_MS = 10 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export interface ProcessingInquiryDeps {
  getPayment: (merchantOrderId: string) => Promise<Payment | null>;
  inquireByOrderId: (input: { orderId: string; orderDate: string }) => Promise<NicepayPaymentInquiryOutcome>;
  /** 기존 nicepayPaymentInquiry.inquireNicepayPayment. approveAttemptTid가 있는 결제에만 쓴다. */
  inquireByTid: (input: { tid: string }) => Promise<NicepayPaymentInquiryOutcome>;
  /**
   * 기존 store.markPaymentFailed. WHERE status='processing'이라 그사이 다른 상태가 됐으면 null이다.
   * 검증된 같은 거래가 NICEPAY에서 failed / expired일 때만 부른다.
   */
  markFailed: (input: { merchantOrderId: string }) => Promise<Payment | null>;
  /** 기존 store.claimPaymentApproved. WHERE status='processing'이라 동시 변경이면 null이다. */
  claimApproved: (input: {
    merchantOrderId: string;
    pgTid: string;
    approvedAmount: number;
    method: string | null;
    approvedAt: string | null;
  }) => Promise<Payment | null>;
  now: () => Date;
}

/** 관리자에게 돌려줄 결과. PG 원문·tid·userId는 담지 않는다. */
export type ProcessingInquiryStatus =
  | "paid-confirmed"
  | "concurrent-change"
  | "not-eligible"
  | "too-recent"
  | "pg-ready"
  | "pg-failed"
  | "pg-expired"
  | "pg-failed-unverified"
  | "pg-cancelled"
  | "pg-partial-cancelled"
  | "not-found"
  | "mismatch"
  | "retry";

export interface ProcessingInquiryResult {
  status: ProcessingInquiryStatus;
  message: string;
  /**
   * 관리자가 다음에 할 일. recommit은 기존 재접수 버튼, release-hold는 상담 시간 확보가
   * 남아 있으면 "홀드 해제"를 누르라는 뜻이다.
   */
  nextAction: "recommit" | "release-hold" | "manual" | "retry";
  /** 이 조회로 내부 결제 상태가 바뀌었는지(paid 전환 또는 failed 확정). */
  changed: boolean;
}

const RESULTS: Record<ProcessingInquiryStatus, ProcessingInquiryResult> = {
  "paid-confirmed": {
    status: "paid-confirmed",
    message: "결제가 확인되었습니다. 재접수를 눌러 주문을 접수해 주세요.",
    nextAction: "recommit",
    changed: true,
  },
  "concurrent-change": {
    status: "concurrent-change",
    message: "그사이 결제 상태가 바뀌었습니다. 목록을 새로고침해 주세요.",
    nextAction: "manual",
    changed: false,
  },
  "not-eligible": {
    status: "not-eligible",
    message: "결제 조회로 확인할 수 있는 건이 아닙니다. 결제 정보를 직접 확인해 주세요.",
    nextAction: "manual",
    changed: false,
  },
  "too-recent": {
    status: "too-recent",
    message: "아직 결제가 진행 중일 수 있습니다. 10분이 지난 뒤 다시 조회해 주세요.",
    nextAction: "retry",
    changed: false,
  },
  "pg-ready": {
    status: "pg-ready",
    message: "NICEPAY에서 아직 승인되지 않은 상태(ready)입니다.",
    nextAction: "manual",
    changed: false,
  },
  "pg-failed": {
    status: "pg-failed",
    message:
      "NICEPAY에서 결제 실패(failed)로 확인되어 결제를 실패로 정리했습니다. 상담 시간 확보가 남아 있으면 '홀드 해제'를 눌러 주세요.",
    nextAction: "release-hold",
    changed: true,
  },
  "pg-expired": {
    status: "pg-expired",
    message:
      "NICEPAY에서 결제 만료(expired)로 확인되어 결제를 실패로 정리했습니다. 상담 시간 확보가 남아 있으면 '홀드 해제'를 눌러 주세요.",
    nextAction: "release-hold",
    changed: true,
  },
  "pg-failed-unverified": {
    status: "pg-failed-unverified",
    message:
      "NICEPAY에서 실패·만료로 조회되지만 승인 시도 거래와 대조할 수 없어 결제 상태를 바꾸지 않았습니다. NICEPAY 관리자에서 직접 확인해 주세요.",
    nextAction: "manual",
    changed: false,
  },
  "pg-cancelled": {
    status: "pg-cancelled",
    message: "NICEPAY에서 취소된 결제입니다. 주문을 접수하지 마세요.",
    nextAction: "manual",
    changed: false,
  },
  "pg-partial-cancelled": {
    status: "pg-partial-cancelled",
    message: "NICEPAY에서 부분취소된 결제입니다. 주문을 접수하지 마세요.",
    nextAction: "manual",
    changed: false,
  },
  "not-found": {
    status: "not-found",
    message: "NICEPAY에서 거래를 찾지 못했습니다. NICEPAY 관리자에서 확인해 주세요.",
    nextAction: "manual",
    changed: false,
  },
  mismatch: {
    status: "mismatch",
    message: "NICEPAY 결제 정보가 일치하지 않습니다. NICEPAY 관리자에서 확인해 주세요.",
    nextAction: "manual",
    changed: false,
  },
  retry: {
    status: "retry",
    message: "지금 결제 상태를 확인하지 못했습니다. 잠시 후 다시 조회해 주세요.",
    nextAction: "retry",
    changed: false,
  },
};

/** ISO 시각의 한국 날짜(YYYYMMDD). 읽을 수 없으면 null이다. */
function kstDate(iso: string): string | null {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return null;
  return new Date(time + KST_OFFSET_MS).toISOString().slice(0, 10).replaceAll("-", "");
}

/**
 * 조회할 주문일자 후보. 결제 준비(createdAt)가 1순위이고, 승인 시도(updatedAt) 날짜가
 * 다르면 2순위로 붙는다. 준비와 승인 사이에 자정을 넘긴 경우를 위한 것이다.
 */
export function orderDateCandidates(createdAt: string, updatedAt: string): string[] {
  const dates: string[] = [];
  for (const date of [kstDate(createdAt), kstDate(updatedAt)]) {
    if (date && !dates.includes(date)) dates.push(date);
  }
  return dates;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * 조회 결과 판정. 같은 거래(tid·orderId)인지 먼저 보고, 그다음 상태를 본다.
 * paid와 failed / expired는 금액까지 맞아야 전환 근거가 된다(다른 거래의 응답을 막는다).
 * ready·cancelled·partialCancelled는 표시만 하고 전환 근거로 쓰지 않는다.
 * expectedTid가 있으면 응답 tid가 그 값과 정확히 같아야 한다(승인 시도 거래인지).
 */
export function verifyInquiryResult(
  payment: Pick<Payment, "merchantOrderId" | "requestedAmount">,
  result: NicepayPaymentInquiryResult,
  expectedTid?: string,
):
  | { kind: "paid"; tid: string }
  | { kind: "failed"; status: "pg-failed" | "pg-expired" }
  | { kind: "stop"; status: ProcessingInquiryStatus } {
  const raw = result as Record<string, unknown>;
  const tid = text(raw.tid);
  if (!tid || text(raw.orderId) !== payment.merchantOrderId || (expectedTid !== undefined && tid !== expectedTid)) {
    return { kind: "stop", status: "mismatch" };
  }
  let terminal: "pg-failed" | "pg-expired" | null = null;
  switch (raw.status) {
    case "paid":
      break;
    case "ready":
      return { kind: "stop", status: "pg-ready" };
    case "failed":
      terminal = "pg-failed";
      break;
    case "expired":
      terminal = "pg-expired";
      break;
    case "cancelled":
      return { kind: "stop", status: "pg-cancelled" };
    case "partialCancelled":
      return { kind: "stop", status: "pg-partial-cancelled" };
    default:
      return { kind: "stop", status: "mismatch" };
  }
  const amount = readWonAmount(raw.amount);
  if (amount === null || amount !== payment.requestedAmount) {
    return { kind: "stop", status: "mismatch" };
  }
  // 같은 거래(tid·orderId·금액)가 승인되지 않은 채 끝났다.
  if (terminal) return { kind: "failed", status: terminal };
  // paid인데 이미 일부가 빠져 나간 흔적. 값이 있을 때만 보고, 있으면 정확히 같아야 한다.
  if (raw.balanceAmt !== undefined && readWonAmount(raw.balanceAmt) !== amount) {
    return { kind: "stop", status: "mismatch" };
  }
  return { kind: "paid", tid };
}

/** 조회 전 대상 확인. 통과하지 못하면 NICEPAY를 부르지 않는다. */
function eligibility(payment: Payment | null, now: Date): ProcessingInquiryStatus | null {
  if (!payment || payment.provider !== "nicepay") return "not-eligible";
  if (payment.status !== "processing" || payment.orderId) return "not-eligible";
  const amount = payment.requestedAmount;
  if (!Number.isSafeInteger(amount) || amount <= 0) return "not-eligible";
  if (readWonAmount(payment.orderSnapshot?.amount) !== amount) return "not-eligible";
  const updated = new Date(payment.updatedAt).getTime();
  if (Number.isNaN(updated)) return "not-eligible";
  if (now.getTime() - updated < STALE_MS) return "too-recent";
  return null;
}

export async function runProcessingPaymentInquiry(
  merchantOrderId: string,
  deps: ProcessingInquiryDeps,
): Promise<ProcessingInquiryResult> {
  const payment = await deps.getPayment(merchantOrderId);
  const blocked = eligibility(payment, deps.now());
  if (blocked || !payment) return RESULTS[blocked ?? "not-eligible"];

  const attemptTid = text(payment.approveAttemptTid);
  if (attemptTid) {
    // 승인 요청한 바로 그 거래를 조회한다. 결과가 무엇이든 주문번호 조회로 넘어가지 않는다.
    let outcome: NicepayPaymentInquiryOutcome;
    try {
      outcome = await deps.inquireByTid({ tid: attemptTid });
    } catch {
      return RESULTS.retry;
    }
    if (outcome.kind === "unknown") return RESULTS.retry;
    if (outcome.kind === "not-found") return RESULTS["not-found"];
    return settle(payment, outcome.result, deps, attemptTid);
  }

  // 레거시: 시도 tid가 남아 있지 않은 결제. 주문번호 조회로 paid만 확정한다.
  const dates = orderDateCandidates(payment.createdAt, payment.updatedAt);
  if (dates.length === 0) return RESULTS["not-eligible"];

  for (const orderDate of dates) {
    let outcome: NicepayPaymentInquiryOutcome;
    try {
      outcome = await deps.inquireByOrderId({ orderId: payment.merchantOrderId, orderDate });
    } catch {
      return RESULTS.retry;
    }
    // 확인하지 못한 것은 거래가 없다는 뜻이 아니다. 다른 날짜로 추측 조회하지 않는다.
    if (outcome.kind === "unknown") return RESULTS.retry;
    if (outcome.kind === "not-found") continue;
    return settle(payment, outcome.result, deps);
  }
  return RESULTS["not-found"];
}

/**
 * 검증 결과에 따라 한 번만 전환한다.
 * attemptTid가 없으면(레거시) failed / expired를 확정하지 않고 수동 확인으로 돌린다.
 */
async function settle(
  payment: Payment,
  result: NicepayPaymentInquiryResult,
  deps: ProcessingInquiryDeps,
  attemptTid?: string,
): Promise<ProcessingInquiryResult> {
  const verdict = verifyInquiryResult(payment, result, attemptTid);
  if (verdict.kind === "stop") return RESULTS[verdict.status];
  if (verdict.kind === "failed") {
    if (!attemptTid) return RESULTS["pg-failed-unverified"];
    // processing일 때만 바뀐다. 그사이 paid 등으로 바뀌었으면 null이고 최신 상태를 따른다.
    const failed = await deps.markFailed({ merchantOrderId: payment.merchantOrderId });
    return RESULTS[failed ? verdict.status : "concurrent-change"];
  }

  const raw = result as Record<string, unknown>;
  const claimed = await deps.claimApproved({
    merchantOrderId: payment.merchantOrderId,
    pgTid: verdict.tid,
    approvedAmount: payment.requestedAmount,
    method: text(raw.payMethod) || null,
    approvedAt: text(raw.paidAt) || null,
  });
  return RESULTS[claimed ? "paid-confirmed" : "concurrent-change"];
}
