/**
 * 승인 processing으로 남은 결제의 관리자 수동 확인 (P1-02).
 *
 * 승인 API 응답을 받지 못했거나(timeout 등) 승인 응답 검증에 실패한 결제는 processing으로
 * 남는다. 관리자가 "결제 조회"를 누르면 NICEPAY 주문번호 조회로 실제 상태를 확인하고,
 * **검증이 모두 끝난 paid만** 기존 claimPaymentApproved로 processing → paid 전환한다.
 *
 *   1) 대상 확인          — nicepay · processing · order_id 없음 · 10분 경과 · 금액 일치
 *   2) 주문일자 후보       — createdAt의 KST 날짜, updatedAt의 KST 날짜(다를 때만)
 *   3) 주문번호 조회       — 첫 후보가 not-found일 때만 다음 후보. unknown이면 멈춘다
 *   4) 조회 결과 검증      — tid · orderId · amount · status · balanceAmt
 *   5) paid 전환           — claimPaymentApproved(WHERE status='processing') 1회
 *
 * 하지 않는 일(deps에 없어 부를 방법이 없다)
 * - 주문·상담 생성, recommit, 적립금·쿠폰·추천인 변경
 * - paid가 아닌 상태를 failed·cancelled 등으로 바꾸기
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
  | "pg-cancelled"
  | "pg-partial-cancelled"
  | "not-found"
  | "mismatch"
  | "retry";

export interface ProcessingInquiryResult {
  status: ProcessingInquiryStatus;
  message: string;
  /** 관리자가 다음에 할 일. recommit은 기존 재접수 버튼이다. */
  nextAction: "recommit" | "manual" | "retry";
}

const RESULTS: Record<ProcessingInquiryStatus, ProcessingInquiryResult> = {
  "paid-confirmed": {
    status: "paid-confirmed",
    message: "결제가 확인되었습니다. 재접수를 눌러 주문을 접수해 주세요.",
    nextAction: "recommit",
  },
  "concurrent-change": {
    status: "concurrent-change",
    message: "그사이 결제 상태가 바뀌었습니다. 목록을 새로고침해 주세요.",
    nextAction: "manual",
  },
  "not-eligible": {
    status: "not-eligible",
    message: "결제 조회로 확인할 수 있는 건이 아닙니다. 결제 정보를 직접 확인해 주세요.",
    nextAction: "manual",
  },
  "too-recent": {
    status: "too-recent",
    message: "아직 결제가 진행 중일 수 있습니다. 10분이 지난 뒤 다시 조회해 주세요.",
    nextAction: "retry",
  },
  "pg-ready": {
    status: "pg-ready",
    message: "NICEPAY에서 아직 승인되지 않은 상태(ready)입니다.",
    nextAction: "manual",
  },
  "pg-failed": {
    status: "pg-failed",
    message: "NICEPAY에서 결제 실패(failed)로 확인됩니다.",
    nextAction: "manual",
  },
  "pg-expired": {
    status: "pg-expired",
    message: "NICEPAY에서 결제 만료(expired)로 확인됩니다.",
    nextAction: "manual",
  },
  "pg-cancelled": {
    status: "pg-cancelled",
    message: "NICEPAY에서 취소된 결제입니다. 주문을 접수하지 마세요.",
    nextAction: "manual",
  },
  "pg-partial-cancelled": {
    status: "pg-partial-cancelled",
    message: "NICEPAY에서 부분취소된 결제입니다. 주문을 접수하지 마세요.",
    nextAction: "manual",
  },
  "not-found": {
    status: "not-found",
    message: "NICEPAY에서 거래를 찾지 못했습니다. NICEPAY 관리자에서 확인해 주세요.",
    nextAction: "manual",
  },
  mismatch: {
    status: "mismatch",
    message: "NICEPAY 결제 정보가 일치하지 않습니다. NICEPAY 관리자에서 확인해 주세요.",
    nextAction: "manual",
  },
  retry: {
    status: "retry",
    message: "지금 결제 상태를 확인하지 못했습니다. 잠시 후 다시 조회해 주세요.",
    nextAction: "retry",
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
 * 조회 결과 판정. 같은 거래(tid·orderId)인지 먼저 보고, 그다음 상태를, paid면 금액까지 본다.
 * paid 외 상태는 표시만 하고 전환 근거로 쓰지 않는다.
 */
export function verifyInquiryResult(
  payment: Pick<Payment, "merchantOrderId" | "requestedAmount">,
  result: NicepayPaymentInquiryResult,
): { kind: "paid"; tid: string } | { kind: "stop"; status: ProcessingInquiryStatus } {
  const raw = result as Record<string, unknown>;
  const tid = text(raw.tid);
  if (!tid || text(raw.orderId) !== payment.merchantOrderId) {
    return { kind: "stop", status: "mismatch" };
  }
  switch (raw.status) {
    case "paid":
      break;
    case "ready":
      return { kind: "stop", status: "pg-ready" };
    case "failed":
      return { kind: "stop", status: "pg-failed" };
    case "expired":
      return { kind: "stop", status: "pg-expired" };
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

    const verdict = verifyInquiryResult(payment, outcome.result);
    if (verdict.kind === "stop") return RESULTS[verdict.status];

    const raw = outcome.result as Record<string, unknown>;
    const claimed = await deps.claimApproved({
      merchantOrderId: payment.merchantOrderId,
      pgTid: verdict.tid,
      approvedAmount: payment.requestedAmount,
      method: text(raw.payMethod) || null,
      approvedAt: text(raw.paidAt) || null,
    });
    return RESULTS[claimed ? "paid-confirmed" : "concurrent-change"];
  }
  return RESULTS["not-found"];
}
