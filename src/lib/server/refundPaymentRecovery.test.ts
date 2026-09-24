/**
 * 끊긴 취소 건 복구 흐름 테스트 (Refund-Payment-Recovery-Orchestration-1).
 *
 * 실행: node --test src/lib/server/refundPaymentRecovery.test.ts
 *
 * 실제 NICEPAY도 DB도 부르지 않는다. 바깥 기능을 가짜로 끼워 호출 횟수와 순서를 본다.
 * deps에는 취소·선점 함수가 아예 없으므로, 그 둘이 불리지 않는다는 사실은
 * 호출 기록이 아니라 구조로 보장된다(아래 마지막 테스트에서 소스도 확인한다).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runRefundPaymentRecovery } from "./refundPaymentRecovery.ts";
import type { RefundPaymentRecoveryDeps } from "./refundPaymentRecovery.ts";
import type { NicepayPaymentInquiryOutcome } from "./nicepayPaymentInquiry.ts";
import type { OrderPaymentLookup } from "./paymentLookup.ts";
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
    cancelResultKind: "unknown",
    cancelResultCode: null,
    cancelResultMessage: null,
    cancelResponseRaw: null,
    cancelExecutionStatus: "unknown",
    cancelClaimedAt: "2026-08-13T00:00:00.000Z",
    ...overrides,
  };
}

function inquiryFound(
  result: Partial<Extract<NicepayPaymentInquiryOutcome, { kind: "found" }>["result"]> = {},
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
  lookup?: OrderPaymentLookup;
  inquiry?: NicepayPaymentInquiryOutcome | (() => never);
  finalize?: FinalizeRefundPaymentResult;
  /** 적립금 복원 결과. 함수를 주면 그 자리에서 던진다(호출 자체가 끊긴 경우). */
  restore?: RefundPointsRestoreResult | (() => never);
  reconcile?: RefundPaymentRecoveryDeps["reconcile"];
}) {
  const calls: string[] = [];
  const inquiryTids: string[] = [];
  const finalizeInputs: FinalizeRefundPaymentInput[] = [];
  const restoreInputs: { orderId: string; refundRequestId: string | null }[] = [];
  const deps: RefundPaymentRecoveryDeps = {
    findPaidPaymentForOrder: async () => {
      calls.push("lookup");
      return options.lookup ?? { kind: "single-paid-payment", payment: payment() };
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
    reconcile: options.reconcile,
  };
  return { deps, calls, inquiryTids, finalizeInputs, restoreInputs };
}

test("unknown 복구: 조회 1회 → recovered-unknown → 최종화 1회 → recovered-completed", async () => {
  const h = harness({});
  const result = await runRefundPaymentRecovery(ORDER_ID, h.deps);

  assert.equal(result.kind, "recovered-completed");
  if (result.kind !== "recovered-completed") return;
  assert.equal(result.source, "recovered-unknown");
  assert.equal(result.alreadyFinalized, false);
  // 순서: 조회 → 거래조회 → 최종화 → 적립금 복원. 복원은 반드시 최종화 뒤다.
  assert.deepEqual(h.calls, ["lookup", "inquiry", "finalize", "points"]);
  assert.deepEqual(h.inquiryTids, [TID]);
  assert.deepEqual(h.finalizeInputs, [
    {
      paymentId: "pay-1",
      orderId: ORDER_ID,
      tid: TID,
      approvedAmount: AMOUNT,
      verifiedCancelledAmount: AMOUNT,
      pgCancelledAt: "2026-08-13T00:00:10.000Z",
      source: "recovered-unknown",
    },
  ]);
});

test("processing 복구: recovered-stale-claim으로 최종화 1회 → recovered-completed", async () => {
  const h = harness({
    lookup: {
      kind: "single-paid-payment",
      // 선점만 남고 끊긴 건. 취소 시도 기록이 없어도 PG 요청 전이라 단정하지 않는다.
      payment: payment({
        cancelExecutionStatus: "processing",
        cancelResultKind: null,
        cancelAttemptedAt: null,
      }),
    },
  });
  const result = await runRefundPaymentRecovery(ORDER_ID, h.deps);

  assert.equal(result.kind, "recovered-completed");
  if (result.kind !== "recovered-completed") return;
  assert.equal(result.source, "recovered-stale-claim");
  assert.deepEqual(h.calls, ["lookup", "inquiry", "finalize", "points"]);
  assert.equal(h.finalizeInputs[0]?.source, "recovered-stale-claim");
});

/** 복구 대상이 아니면 조회조차 하지 않는다. */
const BLOCKED_BEFORE_INQUIRY: { name: string; lookup: OrderPaymentLookup; reason: string }[] = [
  { name: "declined", lookup: { kind: "single-paid-payment", payment: payment({ cancelExecutionStatus: "declined" }) }, reason: "cancel-declined" },
  { name: "succeeded", lookup: { kind: "single-paid-payment", payment: payment({ cancelExecutionStatus: "succeeded" }) }, reason: "cancel-succeeded" },
  { name: "실행 단계 없음", lookup: { kind: "single-paid-payment", payment: payment({ cancelExecutionStatus: null }) }, reason: "no-cancel-attempt" },
  { name: "no-payment", lookup: { kind: "no-payment" }, reason: "no-payment" },
  { name: "ambiguous payment", lookup: { kind: "ambiguous", payments: [payment(), payment({ id: "pay-2" })] }, reason: "ambiguous-payment" },
  { name: "tid 없음", lookup: { kind: "single-paid-payment", payment: payment({ pgTid: "" }) }, reason: "missing-tid" },
  { name: "승인 금액 없음", lookup: { kind: "single-paid-payment", payment: payment({ approvedAmount: 0 }) }, reason: "invalid-approved-amount" },
];

for (const { name, lookup, reason } of BLOCKED_BEFORE_INQUIRY) {
  test(`차단: ${name} → 조회 0 / 최종화 0`, async () => {
    const h = harness({ lookup });
    const result = await runRefundPaymentRecovery(ORDER_ID, h.deps);
    assert.equal(result.kind, "not-recoverable");
    if (result.kind !== "not-recoverable") return;
    assert.equal(result.reason, reason);
    assert.deepEqual(h.calls, ["lookup"]);
    assert.equal(h.finalizeInputs.length, 0);
  });
}

/** 조회가 전액취소를 확인해 주지 못하면 최종화하지 않는다. */
const BLOCKED_INQUIRIES: { name: string; inquiry: NicepayPaymentInquiryOutcome; kind: string }[] = [
  {
    name: "unknown",
    inquiry: { kind: "unknown", message: "거래 정보를 확인하는 중입니다.", raw: null, httpStatus: null },
    kind: "verification-pending",
  },
  { name: "not-found", inquiry: { kind: "not-found", raw: null, httpStatus: 404 }, kind: "not-recoverable" },
  {
    name: "found paid",
    inquiry: inquiryFound({ status: "paid", cancelledAmt: 0, balanceAmt: AMOUNT }),
    kind: "verification-pending",
  },
  {
    name: "partialCancelled",
    inquiry: inquiryFound({ status: "partialCancelled", cancelledAmt: 50000, balanceAmt: 50000 }),
    kind: "not-recoverable",
  },
  { name: "tid 불일치", inquiry: inquiryFound({ tid: "tid-other" }), kind: "not-recoverable" },
  { name: "orderId 불일치", inquiry: inquiryFound({ orderId: "is-other" }), kind: "not-recoverable" },
  { name: "금액 불일치", inquiry: inquiryFound({ cancelledAmt: 50000, balanceAmt: 50000 }), kind: "not-recoverable" },
];

for (const { name, inquiry, kind } of BLOCKED_INQUIRIES) {
  test(`조회 ${name} → 최종화 0`, async () => {
    const h = harness({ inquiry });
    const result = await runRefundPaymentRecovery(ORDER_ID, h.deps);
    assert.equal(result.kind, kind);
    // 조회는 1회, 최종화 0회. 다시 부르지 않는다.
    assert.deepEqual(h.calls, ["lookup", "inquiry"]);
  });
}

test("조회 호출이 예외로 끊겨도 재조회 없이 verification-pending", async () => {
  const h = harness({
    inquiry: () => {
      throw new Error("network down");
    },
  });
  const result = await runRefundPaymentRecovery(ORDER_ID, h.deps);
  assert.equal(result.kind, "verification-pending");
  if (result.kind !== "verification-pending") return;
  assert.deepEqual(result.reconciliation, { kind: "not-verified", reason: "inquiry-unknown" });
  assert.deepEqual(h.calls, ["lookup", "inquiry"]);
});

/** 실행 단계와 확정 경로가 어긋나면 반영하지 않는다. */
const VERIFIED = (source: "normal" | "recovered-unknown" | "recovered-stale-claim") =>
  ({
    kind: "verified-full-cancel",
    source,
    paymentId: "pay-1",
    orderId: ORDER_ID,
    tid: TID,
    approvedAmount: AMOUNT,
    verifiedCancelledAmount: AMOUNT,
    pgCancelledAt: null,
  }) as const;

test("unknown인데 확정 경로가 recovered-stale-claim이면 차단", async () => {
  const h = harness({ reconcile: () => VERIFIED("recovered-stale-claim") });
  const result = await runRefundPaymentRecovery(ORDER_ID, h.deps);
  assert.equal(result.kind, "not-recoverable");
  if (result.kind !== "not-recoverable") return;
  assert.equal(result.reason, "source-mismatch");
  assert.deepEqual(h.calls, ["lookup", "inquiry"]);
});

test("processing인데 확정 경로가 recovered-unknown이면 차단", async () => {
  const h = harness({
    lookup: {
      kind: "single-paid-payment",
      payment: payment({ cancelExecutionStatus: "processing" }),
    },
    reconcile: () => VERIFIED("recovered-unknown"),
  });
  const result = await runRefundPaymentRecovery(ORDER_ID, h.deps);
  assert.equal(result.kind, "not-recoverable");
  if (result.kind !== "not-recoverable") return;
  assert.equal(result.reason, "source-mismatch");
  assert.deepEqual(h.calls, ["lookup", "inquiry"]);
});

test("확정 경로가 normal이면 복구 흐름에서 반영하지 않는다", async () => {
  const h = harness({ reconcile: () => VERIFIED("normal") });
  const result = await runRefundPaymentRecovery(ORDER_ID, h.deps);
  assert.equal(result.kind, "not-recoverable");
  assert.deepEqual(h.calls, ["lookup", "inquiry"]);
});

/** 최종화 실패는 재취소로 이어지지 않는다. */
const FAILED_FINALIZES: FinalizeRefundPaymentResult[] = [
  { ok: false, kind: "payment-mismatch" },
  { ok: false, kind: "refund-request-mismatch" },
  { ok: false, kind: "ambiguous-refund-request" },
  { ok: false, kind: "invalid-amount" },
];

for (const finalize of FAILED_FINALIZES) {
  test(`최종화 ${finalize.kind} → recovery-failed`, async () => {
    const h = harness({ finalize });
    const result = await runRefundPaymentRecovery(ORDER_ID, h.deps);
    assert.equal(result.kind, "recovery-failed");
    if (result.kind !== "recovery-failed") return;
    assert.deepEqual(result.finalize, finalize);
    // completed가 아니므로 적립금 복원은 부르지 않는다.
    assert.deepEqual(h.calls, ["lookup", "inquiry", "finalize"]);
    assert.equal(h.restoreInputs.length, 0);
  });
}

/*
 * already-finalized는 최종화 함수 계약상 "결제가 cancelled이고 취소 금액이 확인 금액과
 * 같으며 완료된 환불 문의가 있다"를 확인한 뒤에만 나온다. DB가 이미 완료 상태라는 뜻이
 * 맞으므로 복구 완료로 읽되 이번 호출이 아무것도 바꾸지 않았음을 표시한다.
 */
test("최종화 already-finalized → recovered-completed(alreadyFinalized)", async () => {
  const h = harness({ finalize: { ok: false, kind: "already-finalized" } });
  const result = await runRefundPaymentRecovery(ORDER_ID, h.deps);
  assert.equal(result.kind, "recovered-completed");
  if (result.kind !== "recovered-completed") return;
  assert.equal(result.alreadyFinalized, true);
  /*
   * 이 경로에서도 복원을 시도한다. 앞선 시도가 끊겼을 수 있기 때문이다.
   * 이미 돌려준 주문이면 원장의 UNIQUE가 already-restored로 돌려보낸다.
   */
  assert.deepEqual(h.calls, ["lookup", "inquiry", "finalize", "points"]);
});

test("최종화 도중 예외 → recovery-failed, 상태를 되돌리지 않는다", async () => {
  const h = harness({});
  const deps: RefundPaymentRecoveryDeps = {
    ...h.deps,
    finalize: async () => {
      h.calls.push("finalize");
      throw new Error("db down");
    },
  };
  const result = await runRefundPaymentRecovery(ORDER_ID, deps);
  assert.equal(result.kind, "recovery-failed");
  assert.deepEqual(h.calls, ["lookup", "inquiry", "finalize"]);
});

/**
 * 취소·선점은 호출 기록이 아니라 구조로 막는다.
 * 이 모듈은 취소 client나 취소 실행 흐름을 아예 불러오지 않는다.
 */
test("복구 모듈은 취소·선점 기능을 참조하지 않는다", () => {
  const source = readFileSync(new URL("./refundPaymentRecovery.ts", import.meta.url), "utf8");
  // 주석 설명에도 함수 이름이 나오므로, 실제 호출 형태만 본다.
  for (const forbidden of [
    "cancelNicepayPayment(",
    "executeRefundPaymentCancellation(",
    "claimPaymentCancellation(",
  ]) {
    assert.equal(source.includes(forbidden), false, `${forbidden} 호출이 있으면 안 된다`);
  }
  assert.equal(source.includes("nicepayCancel"), false);
  assert.equal(source.includes("refundPaymentCancellation"), false);
});

/* ── 적립금 복원 연결 (Refund-Points-Restore-Wire-Recovery-1) ────────── *
 *
 * 복구로 completed가 확정된 뒤에만, 많아야 한 번 시도한다. 그 결과가 무엇이든
 * 이미 끝난 복구를 실패로 바꾸지 않는다(fail-open). 정상 완결 흐름과 같은 원칙이다.
 */

test("복원에는 주문 id만 넘긴다. 금액도 회원도 넘기지 않는다", async () => {
  const h = harness({});
  await runRefundPaymentRecovery(ORDER_ID, h.deps);
  assert.deepEqual(h.restoreInputs, [{ orderId: ORDER_ID, refundRequestId: null }]);
});

/** 복원 결과 네 가지 모두 recovered-completed를 그대로 둔다. */
const RESTORE_RESULTS: { name: string; restore: RefundPointsRestoreResult }[] = [
  { name: "restored", restore: { kind: "restored", orderId: ORDER_ID, amount: 10000 } },
  { name: "already-restored", restore: { kind: "already-restored", orderId: ORDER_ID } },
  {
    name: "not-applicable",
    restore: { kind: "not-applicable", orderId: ORDER_ID, reason: "evidence-mismatch" },
  },
  {
    name: "retry-later",
    restore: { kind: "retry-later", orderId: ORDER_ID, reason: "cas-conflict" },
  },
];

for (const { name, restore } of RESTORE_RESULTS) {
  test(`복원 ${name} → recovered-completed 그대로`, async () => {
    const h = harness({ restore });
    const result = await runRefundPaymentRecovery(ORDER_ID, h.deps);
    assert.equal(result.kind, "recovered-completed");
    if (result.kind !== "recovered-completed") return;
    assert.equal(result.alreadyFinalized, false);
    assert.equal(result.source, "recovered-unknown");
    assert.deepEqual(h.calls, ["lookup", "inquiry", "finalize", "points"]);
  });
}

test("복원 호출이 예외로 끊겨도 recovered-completed를 덮어쓰지 않는다", async () => {
  const h = harness({
    restore: () => {
      throw new Error("store down");
    },
  });
  const result = await runRefundPaymentRecovery(ORDER_ID, h.deps);
  assert.equal(result.kind, "recovered-completed");
  if (result.kind !== "recovered-completed") return;
  assert.equal(result.alreadyFinalized, false);
  // 복원을 다시 부르지 않는다. 거래조회도 다시 부르지 않는다.
  assert.deepEqual(h.calls, ["lookup", "inquiry", "finalize", "points"]);
});

test("already-finalized 경로의 복원 예외도 recovered-completed를 덮어쓰지 않는다", async () => {
  const h = harness({
    finalize: { ok: false, kind: "already-finalized" },
    restore: () => {
      throw new Error("store down");
    },
  });
  const result = await runRefundPaymentRecovery(ORDER_ID, h.deps);
  assert.equal(result.kind, "recovered-completed");
  if (result.kind !== "recovered-completed") return;
  assert.equal(result.alreadyFinalized, true);
});

test("복구 대상이 아니면 복원 0회", async () => {
  for (const lookup of [
    { kind: "no-payment" },
    { kind: "ambiguous" },
  ] as OrderPaymentLookup[]) {
    const h = harness({ lookup });
    await runRefundPaymentRecovery(ORDER_ID, h.deps);
    assert.equal(h.restoreInputs.length, 0, lookup.kind);
    assert.ok(!h.calls.includes("points"), lookup.kind);
  }
});

test("최종화 실패·예외 경로에서는 복원 0회", async () => {
  const failed = harness({ finalize: { ok: false, kind: "payment-mismatch" } });
  await runRefundPaymentRecovery(ORDER_ID, failed.deps);
  assert.equal(failed.restoreInputs.length, 0);

  const thrown = harness({});
  const deps: RefundPaymentRecoveryDeps = {
    ...thrown.deps,
    finalize: async () => {
      thrown.calls.push("finalize");
      throw new Error("db down");
    },
  };
  const result = await runRefundPaymentRecovery(ORDER_ID, deps);
  assert.equal(result.kind, "recovery-failed");
  assert.equal(thrown.restoreInputs.length, 0);
  assert.ok(!thrown.calls.includes("points"));
});
