/**
 * 정상 환불 완결 흐름 테스트 (Refund-Payment-Normal-Finalize-Orchestration-1).
 *
 * 실행: node --test src/lib/server/refundPaymentNormalFinalize.test.ts
 *
 * 실제 NICEPAY도 DB도 부르지 않는다. 바깥 기능을 가짜로 끼워 호출 횟수와 순서를 본다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { runRefundPaymentNormalFinalize } from "./refundPaymentNormalFinalize.ts";
import type { RefundPaymentNormalFinalizeDeps } from "./refundPaymentNormalFinalize.ts";
import type { RefundPaymentCancellationResult } from "./refundPaymentCancellation.ts";
import type { NicepayPaymentInquiryOutcome } from "./nicepayPaymentInquiry.ts";
import type { FinalizeRefundPaymentInput, FinalizeRefundPaymentResult } from "./store.ts";
import type { RefundPointsRestoreResult } from "./refundPointsRestore.ts";
import type { Payment } from "@/lib/types/app";

const MERCHANT_ORDER_ID = "is-abc";
/** 내부 주문 id. NICEPAY는 이 값을 모른다(applyOrder.ts의 `o-` 접두사). */
const ORDER_ID = `o-${MERCHANT_ORDER_ID}`;
const TID = "tid-1";
const AMOUNT = 100000;

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "pay-1",
    orderId: ORDER_ID,
    provider: "nicepay",
    merchantOrderId: MERCHANT_ORDER_ID,
    pgTid: TID,
    requestedAmount: AMOUNT,
    approvedAmount: AMOUNT,
    cancelledAmount: 0,
    status: "paid",
    method: "card",
    approvedAt: "2026-08-12T00:00:00.000Z",
    cancelledAt: null,
    orderSnapshot: null,
    raw: { resultCode: "0000", status: "paid" },
    createdAt: "2026-08-12T00:00:00.000Z",
    updatedAt: "2026-08-12T00:00:00.000Z",
    cancelAttemptedAt: "2026-08-13T00:00:00.000Z",
    cancelResultKind: "succeeded",
    cancelResultCode: "2001",
    cancelResultMessage: "취소성공",
    cancelResponseRaw: { resultCode: "2001" },
    // 취소 성공이 기록된 상태. 이 값이 reconciliation의 source를 normal로 만든다.
    cancelExecutionStatus: "succeeded",
    cancelClaimedAt: "2026-08-13T00:00:00.000Z",
    ...overrides,
  };
}

function inquiryFound(
  result: Partial<NonNullable<Extract<NicepayPaymentInquiryOutcome, { kind: "found" }>>["result"]> = {},
): NicepayPaymentInquiryOutcome {
  return {
    kind: "found",
    result: {
      resultCode: "0000",
      tid: TID,
      // 결제창에 넘긴 값이 그대로 돌아온다. 내부 주문 id가 아니다.
      orderId: MERCHANT_ORDER_ID,
      status: "cancelled",
      amount: AMOUNT,
      cancelledAmt: AMOUNT,
      balanceAmt: 0,
      cancelledAt: "2026-08-13T00:00:10.000Z",
      ...result,
    },
    raw: { resultCode: "0000" },
    httpStatus: 200,
  };
}

/** 호출 순서와 인자를 기록하는 가짜 구현 묶음. */
function harness(options: {
  cancel?: RefundPaymentCancellationResult;
  inquiry?: NicepayPaymentInquiryOutcome | (() => never);
  finalize?: FinalizeRefundPaymentResult;
  /** 적립금 복원 결과. 함수를 주면 그 자리에서 던진다(호출 자체가 끊긴 경우). */
  restore?: RefundPointsRestoreResult | (() => never);
}) {
  const calls: string[] = [];
  const inquiryTids: string[] = [];
  const finalizeInputs: FinalizeRefundPaymentInput[] = [];
  const restoreInputs: { orderId: string; refundRequestId: string | null }[] = [];
  const deps: RefundPaymentNormalFinalizeDeps = {
    executeCancellation: async () => {
      calls.push("cancel");
      return options.cancel ?? { kind: "succeeded", payment: payment() };
    },
    inquirePayment: async (input) => {
      calls.push("inquiry");
      inquiryTids.push(input.tid);
      const next = options.inquiry ?? inquiryFound();
      return typeof next === "function" ? next() : next;
    },
    finalize: async (input) => {
      calls.push("finalize");
      finalizeInputs.push(input);
      return options.finalize ?? { ok: true, kind: "finalized" };
    },
    restorePoints: async (input) => {
      calls.push("points");
      restoreInputs.push(input);
      const next = options.restore ?? { kind: "restored", orderId: ORDER_ID, amount: 10000 };
      return typeof next === "function" ? next() : next;
    },
  };
  return { deps, calls, inquiryTids, finalizeInputs, restoreInputs };
}

test("정상: 취소 성공 → 조회 1회 → 대조 normal → 최종화 1회 → completed", async () => {
  const h = harness({});
  const result = await runRefundPaymentNormalFinalize(ORDER_ID, h.deps);

  assert.equal(result.kind, "completed");
  if (result.kind !== "completed") return;
  assert.equal(result.alreadyFinalized, false);
  assert.equal(result.paymentId, "pay-1");
  assert.equal(result.orderId, ORDER_ID);
  // 순서: 취소 → 조회 → 최종화 → 적립금 복원. 각각 정확히 1회.
  // 복원은 반드시 최종화 뒤다. completed가 확정되기 전에는 부르지 않는다.
  assert.deepEqual(h.calls, ["cancel", "inquiry", "finalize", "points"]);
  assert.deepEqual(h.inquiryTids, [TID]);
  assert.deepEqual(h.finalizeInputs, [
    {
      paymentId: "pay-1",
      orderId: ORDER_ID,
      tid: TID,
      approvedAmount: AMOUNT,
      verifiedCancelledAmount: AMOUNT,
      pgCancelledAt: "2026-08-13T00:00:10.000Z",
      source: "normal",
    },
  ]);
});

/** 취소가 성공이 아니면 조회도 최종화도 하지 않는다. */
const BLOCKED_CANCELS: RefundPaymentCancellationResult[] = [
  { kind: "declined", payment: payment({ cancelExecutionStatus: "declined" }) },
  { kind: "unknown", payment: payment({ cancelExecutionStatus: "unknown" }) },
  { kind: "recording-failed" },
  { kind: "not-claimable" },
  { kind: "no-payment" },
  { kind: "ambiguous-payment" },
  { kind: "invalid-payment", reason: "missing-tid" },
];

for (const cancel of BLOCKED_CANCELS) {
  test(`차단: 취소 ${cancel.kind} → 조회 0 / 최종화 0`, async () => {
    const h = harness({ cancel });
    const result = await runRefundPaymentNormalFinalize(ORDER_ID, h.deps);
    assert.equal(result.kind, "cancel-not-completed");
    assert.deepEqual(h.calls, ["cancel"]);
    assert.equal(h.finalizeInputs.length, 0);
  });
}

/** 조회가 전액취소를 확인해 주지 못하면 최종화하지 않는다. */
const BLOCKED_INQUIRIES: { name: string; inquiry: NicepayPaymentInquiryOutcome }[] = [
  {
    name: "unknown",
    inquiry: { kind: "unknown", message: "거래 정보를 확인하는 중입니다.", raw: null, httpStatus: null },
  },
  { name: "not-found", inquiry: { kind: "not-found", raw: null, httpStatus: 404 } },
  { name: "found이지만 취소 아님", inquiry: inquiryFound({ status: "paid", cancelledAmt: 0, balanceAmt: AMOUNT }) },
  { name: "tid 불일치", inquiry: inquiryFound({ tid: "tid-other" }) },
  { name: "orderId 불일치", inquiry: inquiryFound({ orderId: "is-other" }) },
  { name: "금액 불일치", inquiry: inquiryFound({ cancelledAmt: 50000, balanceAmt: 50000 }) },
];

for (const { name, inquiry } of BLOCKED_INQUIRIES) {
  test(`조회 ${name} → 최종화 0`, async () => {
    const h = harness({ inquiry });
    const result = await runRefundPaymentNormalFinalize(ORDER_ID, h.deps);
    assert.equal(result.kind, "verification-pending");
    // 취소도 조회도 다시 부르지 않는다.
    assert.deepEqual(h.calls, ["cancel", "inquiry"]);
  });
}

test("조회 호출이 예외로 끊겨도 재시도·재취소 없이 verification-pending", async () => {
  const h = harness({
    inquiry: () => {
      throw new Error("network down");
    },
  });
  const result = await runRefundPaymentNormalFinalize(ORDER_ID, h.deps);
  assert.equal(result.kind, "verification-pending");
  if (result.kind !== "verification-pending") return;
  assert.deepEqual(result.reconciliation, { kind: "not-verified", reason: "inquiry-unknown" });
  assert.deepEqual(h.calls, ["cancel", "inquiry"]);
});

test("취소 성공인데 tid가 비어 있으면 조회하지 않는다", async () => {
  const h = harness({ cancel: { kind: "succeeded", payment: payment({ pgTid: "" }) } });
  const result = await runRefundPaymentNormalFinalize(ORDER_ID, h.deps);
  assert.equal(result.kind, "verification-pending");
  assert.deepEqual(h.calls, ["cancel"]);
});

/** source가 normal이 아니면 정상 흐름에서 자동 최종화하지 않는다. */
test("대조 recovered-unknown → 최종화 0", async () => {
  const h = harness({
    cancel: { kind: "succeeded", payment: payment({ cancelExecutionStatus: "unknown" }) },
  });
  const result = await runRefundPaymentNormalFinalize(ORDER_ID, h.deps);
  assert.equal(result.kind, "verification-pending");
  if (result.kind !== "verification-pending") return;
  assert.equal(result.reconciliation.kind, "verified-full-cancel");
  if (result.reconciliation.kind !== "verified-full-cancel") return;
  assert.equal(result.reconciliation.source, "recovered-unknown");
  assert.deepEqual(h.calls, ["cancel", "inquiry"]);
});

test("대조 recovered-stale-claim → 최종화 0", async () => {
  const h = harness({
    cancel: { kind: "succeeded", payment: payment({ cancelExecutionStatus: "processing" }) },
  });
  const result = await runRefundPaymentNormalFinalize(ORDER_ID, h.deps);
  assert.equal(result.kind, "verification-pending");
  if (result.kind !== "verification-pending") return;
  assert.equal(result.reconciliation.kind, "verified-full-cancel");
  if (result.reconciliation.kind !== "verified-full-cancel") return;
  assert.equal(result.reconciliation.source, "recovered-stale-claim");
  assert.deepEqual(h.calls, ["cancel", "inquiry"]);
});

/** 최종화 실패는 재취소로 이어지지 않는다. */
const FAILED_FINALIZES: FinalizeRefundPaymentResult[] = [
  { ok: false, kind: "payment-mismatch" },
  { ok: false, kind: "refund-request-mismatch" },
  { ok: false, kind: "ambiguous-refund-request" },
  { ok: false, kind: "invalid-amount" },
];

for (const finalize of FAILED_FINALIZES) {
  test(`최종화 ${finalize.kind} → finalization-failed, 재취소 없음`, async () => {
    const h = harness({ finalize });
    const result = await runRefundPaymentNormalFinalize(ORDER_ID, h.deps);
    assert.equal(result.kind, "finalization-failed");
    if (result.kind !== "finalization-failed") return;
    assert.deepEqual(result.finalize, finalize);
    // completed가 아니므로 적립금 복원은 부르지 않는다.
    assert.deepEqual(h.calls, ["cancel", "inquiry", "finalize"]);
    assert.equal(h.restoreInputs.length, 0);
  });
}

/*
 * already-finalized는 최종화 함수 계약상 "결제가 cancelled이고 취소 금액이 확인 금액과
 * 같으며 완료된 환불 문의가 있다"를 확인한 뒤에만 나온다. 이번 호출이 아무것도 바꾸지
 * 않았을 뿐 DB는 이미 완료 상태이므로 completed로 읽되 그 사실을 표시한다.
 */
test("최종화 already-finalized → completed(alreadyFinalized)", async () => {
  const h = harness({ finalize: { ok: false, kind: "already-finalized" } });
  const result = await runRefundPaymentNormalFinalize(ORDER_ID, h.deps);
  assert.equal(result.kind, "completed");
  if (result.kind !== "completed") return;
  assert.equal(result.alreadyFinalized, true);
  /*
   * 이 경로에서도 복원을 시도한다. 앞선 시도가 끊겼을 수 있기 때문이다.
   * 이미 돌려준 주문이면 원장의 UNIQUE가 already-restored로 돌려보낸다.
   */
  assert.deepEqual(h.calls, ["cancel", "inquiry", "finalize", "points"]);
});

/*
 * 두 번째 실행. 첫 실행으로 결제가 cancelled가 되면 취소 실행 단계가 먼저 막는다
 * (이미 취소 금액이 있는 결제는 invalid-payment). PG를 다시 부르지 않는다.
 */
test("두 번째 실행: 취소 단계에서 막히고 조회·최종화 0", async () => {
  const h = harness({ cancel: { kind: "invalid-payment", reason: "already-cancelled" } });
  const result = await runRefundPaymentNormalFinalize(ORDER_ID, h.deps);
  assert.equal(result.kind, "cancel-not-completed");
  assert.deepEqual(h.calls, ["cancel"]);
});

/* ── 적립금 복원 연결 (Refund-Points-Restore-Wire-Normal-1) ──────────── *
 *
 * 복원은 completed가 확정된 뒤에만, 많아야 한 번 시도한다. 그리고 그 결과가
 * 무엇이든 이미 끝난 환불을 실패로 바꾸지 않는다(fail-open).
 */

test("복원에는 주문 id만 넘긴다. 금액도 회원도 넘기지 않는다", async () => {
  const h = harness({});
  await runRefundPaymentNormalFinalize(ORDER_ID, h.deps);
  assert.deepEqual(h.restoreInputs, [{ orderId: ORDER_ID, refundRequestId: null }]);
});

/** 복원 결과 네 가지 모두 completed를 그대로 둔다. */
const RESTORE_RESULTS: { name: string; restore: RefundPointsRestoreResult }[] = [
  { name: "restored", restore: { kind: "restored", orderId: ORDER_ID, amount: 10000 } },
  { name: "already-restored", restore: { kind: "already-restored", orderId: ORDER_ID } },
  {
    name: "not-applicable",
    restore: { kind: "not-applicable", orderId: ORDER_ID, reason: "missing-payment-evidence" },
  },
  {
    name: "retry-later",
    restore: { kind: "retry-later", orderId: ORDER_ID, reason: "cas-conflict" },
  },
];

for (const { name, restore } of RESTORE_RESULTS) {
  test(`복원 ${name} → completed 그대로`, async () => {
    const h = harness({ restore });
    const result = await runRefundPaymentNormalFinalize(ORDER_ID, h.deps);
    assert.equal(result.kind, "completed");
    if (result.kind !== "completed") return;
    assert.equal(result.alreadyFinalized, false);
    assert.equal(result.paymentId, "pay-1");
    assert.deepEqual(h.calls, ["cancel", "inquiry", "finalize", "points"]);
  });
}

test("복원 호출이 예외로 끊겨도 completed를 덮어쓰지 않는다", async () => {
  const h = harness({
    restore: () => {
      throw new Error("store down");
    },
  });
  const result = await runRefundPaymentNormalFinalize(ORDER_ID, h.deps);
  assert.equal(result.kind, "completed");
  if (result.kind !== "completed") return;
  assert.equal(result.alreadyFinalized, false);
  // 복원을 다시 부르지 않는다. 취소·조회도 다시 부르지 않는다.
  assert.deepEqual(h.calls, ["cancel", "inquiry", "finalize", "points"]);
});

test("already-finalized 경로의 복원 예외도 completed를 덮어쓰지 않는다", async () => {
  const h = harness({
    finalize: { ok: false, kind: "already-finalized" },
    restore: () => {
      throw new Error("store down");
    },
  });
  const result = await runRefundPaymentNormalFinalize(ORDER_ID, h.deps);
  assert.equal(result.kind, "completed");
  if (result.kind !== "completed") return;
  assert.equal(result.alreadyFinalized, true);
});

/** completed가 아닌 모든 경로에서는 복원을 부르지 않는다. */
test("취소가 성공이 아니면 복원 0회", async () => {
  for (const cancel of BLOCKED_CANCELS) {
    const h = harness({ cancel });
    await runRefundPaymentNormalFinalize(ORDER_ID, h.deps);
    assert.equal(h.restoreInputs.length, 0, cancel.kind);
    assert.ok(!h.calls.includes("points"), cancel.kind);
  }
});

test("조회가 전액취소를 확인해 주지 못하면 복원 0회", async () => {
  for (const { name, inquiry } of BLOCKED_INQUIRIES) {
    const h = harness({ inquiry });
    await runRefundPaymentNormalFinalize(ORDER_ID, h.deps);
    assert.equal(h.restoreInputs.length, 0, name);
    assert.ok(!h.calls.includes("points"), name);
  }
});

test("조회 예외 경로에서도 복원 0회", async () => {
  const h = harness({
    inquiry: () => {
      throw new Error("network down");
    },
  });
  await runRefundPaymentNormalFinalize(ORDER_ID, h.deps);
  assert.equal(h.restoreInputs.length, 0);
});

test("source가 normal이 아니면 복원 0회", async () => {
  for (const status of ["unknown", "processing"] as const) {
    const h = harness({
      cancel: { kind: "succeeded", payment: payment({ cancelExecutionStatus: status }) },
    });
    await runRefundPaymentNormalFinalize(ORDER_ID, h.deps);
    assert.equal(h.restoreInputs.length, 0, status);
  }
});
