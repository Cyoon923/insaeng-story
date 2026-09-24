/**
 * 관리자 환불 확인·복구 API 규칙 테스트 (Refund-Payment-Admin-Recovery-API-1).
 *
 * 실행: node --test src/lib/server/refundRecoveryAdminApi.test.ts
 *
 * 실제 NICEPAY도 DB도 부르지 않는다. gate·결제 조회·두 복구 흐름을 가짜로 끼워
 * 어느 경로가 몇 번 불렸는지 본다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  readRecoverApprovedRefundBody,
  recoverApprovedRefund,
  toRecoverApprovedRefundResponse,
} from "./refundRecoveryAdminApi.ts";
import type { RecoverApprovedRefundDeps } from "./refundRecoveryAdminApi.ts";
import type { RefundExecutionGateResult } from "./refundExecutionGate.ts";
import type { OrderPaymentLookup } from "./paymentLookup.ts";
import type { RefundPaymentRecoveryResult } from "./refundPaymentRecovery.ts";
import type { RefundPaymentSucceededRecoveryResult } from "./refundPaymentSucceededRecovery.ts";
import type { Payment, PaymentCancelExecutionStatus } from "@/lib/types/app";

const REQUEST_ID = "rr-1";
const DB_ORDER_ID = "o-from-db";

const ALLOWED: RefundExecutionGateResult = {
  kind: "allowed",
  refundRequestId: REQUEST_ID,
  orderId: DB_ORDER_ID,
  userId: "u-1",
};

function payment(execution: PaymentCancelExecutionStatus | null): Payment {
  return {
    id: "pay-1",
    orderId: DB_ORDER_ID,
    provider: "nicepay",
    merchantOrderId: "is-abc",
    pgTid: "tid-1",
    requestedAmount: 100000,
    approvedAmount: 100000,
    cancelledAmount: 0,
    status: "paid",
    method: "card",
    approvedAt: "2026-08-12T00:00:00.000Z",
    cancelledAt: null,
    orderSnapshot: null,
    raw: null,
    createdAt: "2026-08-12T00:00:00.000Z",
    updatedAt: "2026-08-12T00:00:00.000Z",
    cancelAttemptedAt: null,
    cancelResultKind: null,
    cancelResultCode: null,
    cancelResultMessage: null,
    cancelResponseRaw: null,
    cancelExecutionStatus: execution,
    cancelClaimedAt: null,
  };
}

const COMPLETED_PENDING: RefundPaymentRecoveryResult = {
  kind: "recovered-completed",
  paymentId: "pay-1",
  orderId: DB_ORDER_ID,
  source: "recovered-unknown",
  alreadyFinalized: false,
};

const COMPLETED_SUCCEEDED: RefundPaymentSucceededRecoveryResult = {
  kind: "recovered-completed",
  paymentId: "pay-1",
  orderId: DB_ORDER_ID,
  alreadyFinalized: false,
};

function harness(options: {
  gate?: RefundExecutionGateResult | (() => never);
  lookup?: OrderPaymentLookup | (() => never);
  pending?: RefundPaymentRecoveryResult | (() => never);
  succeeded?: RefundPaymentSucceededRecoveryResult | (() => never);
  execution?: PaymentCancelExecutionStatus | null;
}) {
  const calls: string[] = [];
  const orderIds: string[] = [];
  const deps: RecoverApprovedRefundDeps = {
    authorize: async () => {
      calls.push("authorize");
      const next = options.gate ?? ALLOWED;
      return typeof next === "function" ? next() : next;
    },
    findPaidPaymentForOrder: async (orderId) => {
      calls.push("lookup");
      orderIds.push(orderId);
      const next =
        options.lookup ??
        ({
          kind: "single-paid-payment",
          // execution을 넘기지 않은 경우에만 기본값을 쓴다(null도 그대로 쓴다).
          payment: payment("execution" in options ? (options.execution ?? null) : "unknown"),
        } as OrderPaymentLookup);
      return typeof next === "function" ? next() : next;
    },
    recoverPending: async (orderId) => {
      calls.push("recoverPending");
      orderIds.push(orderId);
      const next = options.pending ?? COMPLETED_PENDING;
      return typeof next === "function" ? next() : next;
    },
    recoverSucceeded: async (orderId) => {
      calls.push("recoverSucceeded");
      orderIds.push(orderId);
      const next = options.succeeded ?? COMPLETED_SUCCEEDED;
      return typeof next === "function" ? next() : next;
    },
  };
  return { deps, calls, orderIds };
}

/* ── 입력 경계 ─────────────────────────────────────────── */

test("refundRequestId가 없거나 공백이면 400", () => {
  for (const body of [{}, { refundRequestId: " " }, { refundRequestId: 3 }]) {
    const parsed = readRecoverApprovedRefundBody(body as Record<string, unknown>);
    assert.equal(parsed.ok, false);
    if (parsed.ok) return;
    assert.equal(parsed.status, 400);
  }
});

test("body의 orderId·실행 단계·복구 경로는 읽지 않는다", () => {
  const parsed = readRecoverApprovedRefundBody({
    refundRequestId: " rr-1 ",
    orderId: "o-client",
    paymentId: "pay-client",
    tid: "tid-client",
    amount: 1,
    cancelExecutionStatus: "succeeded",
    source: "recovered-unknown",
  });
  assert.deepEqual(parsed, { ok: true, refundRequestId: REQUEST_ID });
});

test("복구에 쓰는 주문 id는 gate가 준 값이다", async () => {
  const h = harness({ execution: "unknown" });
  await recoverApprovedRefund(REQUEST_ID, h.deps);
  assert.deepEqual(h.orderIds, [DB_ORDER_ID, DB_ORDER_ID]);
});

/* ── gate ─────────────────────────────────────────────── */

const GATE_FAILURES: { gate: RefundExecutionGateResult; status: number }[] = [
  { gate: { kind: "not-found" }, status: 404 },
  { gate: { kind: "not-approved" }, status: 409 },
  { gate: { kind: "order-not-found" }, status: 409 },
  { gate: { kind: "ownership-mismatch" }, status: 409 },
  { gate: { kind: "ambiguous-active-request" }, status: 409 },
];

for (const { gate, status } of GATE_FAILURES) {
  test(`gate ${gate.kind} → ${status}, 복구 0회`, async () => {
    const h = harness({ gate });
    const response = await recoverApprovedRefund(REQUEST_ID, h.deps);
    assert.equal(response.status, status);
    assert.deepEqual(h.calls, ["authorize"]);
    const json = JSON.stringify(response.body);
    assert.equal(json.includes(DB_ORDER_ID), false);
    assert.equal(json.includes("u-1"), false);
  });
}

/* ── dispatcher ───────────────────────────────────────── */

for (const execution of ["unknown", "processing"] as const) {
  test(`${execution} → 기존 recovery 1회, succeeded recovery 0회`, async () => {
    const h = harness({ execution });
    const response = await recoverApprovedRefund(REQUEST_ID, h.deps);
    assert.equal(response.status, 200);
    assert.deepEqual(h.calls, ["authorize", "lookup", "recoverPending"]);
  });
}

test("succeeded → succeeded recovery 1회, 기존 recovery 0회", async () => {
  const h = harness({ execution: "succeeded" });
  const response = await recoverApprovedRefund(REQUEST_ID, h.deps);
  assert.equal(response.status, 200);
  assert.deepEqual(h.calls, ["authorize", "lookup", "recoverSucceeded"]);
});

const NO_RECOVERY: { name: string; options: Parameters<typeof harness>[0] }[] = [
  { name: "declined", options: { execution: "declined" } },
  { name: "실행 단계 없음", options: { execution: null } },
  { name: "no-payment", options: { lookup: { kind: "no-payment" } } },
  {
    name: "ambiguous payment",
    options: { lookup: { kind: "ambiguous", payments: [payment("unknown"), payment("unknown")] } },
  },
];

for (const { name, options } of NO_RECOVERY) {
  test(`${name} → 복구 0회, 409 manual-review-required`, async () => {
    const h = harness(options);
    const response = await recoverApprovedRefund(REQUEST_ID, h.deps);
    assert.equal(response.status, 409);
    assert.equal((response.body as { status: string }).status, "manual-review-required");
    assert.deepEqual(h.calls, ["authorize", "lookup"]);
  });
}

/* ── 결과 매핑 ────────────────────────────────────────── */

test("recovered-completed → 200 completed (alreadyFinalized 포함)", () => {
  for (const alreadyFinalized of [false, true]) {
    const response = toRecoverApprovedRefundResponse({ ...COMPLETED_SUCCEEDED, alreadyFinalized });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { ok: true, status: "completed" });
  }
});

test("verification-pending → 202", async () => {
  const h = harness({
    execution: "unknown",
    pending: {
      kind: "verification-pending",
      paymentId: "pay-1",
      orderId: DB_ORDER_ID,
      reconciliation: { kind: "not-verified", reason: "inquiry-unknown" },
    },
  });
  const response = await recoverApprovedRefund(REQUEST_ID, h.deps);
  assert.equal(response.status, 202);
  assert.equal((response.body as { status: string }).status, "verification-pending");
  // 내부 상세가 새지 않는다.
  const json = JSON.stringify(response.body);
  for (const leak of ["inquiry-unknown", "pay-1", DB_ORDER_ID, "tid-1"]) {
    assert.equal(json.includes(leak), false, `${leak}이 응답에 있으면 안 된다`);
  }
});

test("not-recoverable → 409 manual-review-required", async () => {
  const h = harness({
    execution: "succeeded",
    succeeded: {
      kind: "not-recoverable",
      reason: "reconciliation-manual-review",
      manualReview: true,
      paymentId: "pay-1",
      orderId: DB_ORDER_ID,
    },
  });
  const response = await recoverApprovedRefund(REQUEST_ID, h.deps);
  assert.equal(response.status, 409);
  assert.equal((response.body as { status: string }).status, "manual-review-required");
  assert.equal(JSON.stringify(response.body).includes("reconciliation-manual-review"), false);
});

test("recovery-failed → 409 manual-review-required", async () => {
  const h = harness({
    execution: "succeeded",
    succeeded: {
      kind: "recovery-failed",
      paymentId: "pay-1",
      orderId: DB_ORDER_ID,
      finalize: { ok: false, kind: "payment-mismatch" },
    },
  });
  const response = await recoverApprovedRefund(REQUEST_ID, h.deps);
  assert.equal(response.status, 409);
  assert.equal((response.body as { status: string }).status, "manual-review-required");
  assert.equal(JSON.stringify(response.body).includes("payment-mismatch"), false);
});

/* ── 예외 ─────────────────────────────────────────────── */

test("gate 예외 → 500, 조회·복구 0회", async () => {
  const h = harness({
    gate: () => {
      throw new Error("db down");
    },
  });
  const response = await recoverApprovedRefund(REQUEST_ID, h.deps);
  assert.equal(response.status, 500);
  assert.deepEqual(h.calls, ["authorize"]);
});

test("결제 조회 예외 → 500, 복구 0회", async () => {
  const h = harness({
    lookup: () => {
      throw new Error("db down");
    },
  });
  const response = await recoverApprovedRefund(REQUEST_ID, h.deps);
  assert.equal(response.status, 500);
  assert.deepEqual(h.calls, ["authorize", "lookup"]);
});

test("복구 예외 → 다른 복구를 대신 부르지 않고 manual-review-required", async () => {
  const h = harness({
    execution: "unknown",
    pending: () => {
      throw new Error("boom");
    },
  });
  const response = await recoverApprovedRefund(REQUEST_ID, h.deps);
  assert.equal(response.status, 409);
  assert.equal((response.body as { status: string }).status, "manual-review-required");
  assert.deepEqual(h.calls, ["authorize", "lookup", "recoverPending"]);
  assert.equal(JSON.stringify(response.body).includes("boom"), false);
});

/* ── 구조 ─────────────────────────────────────────────── */

test("이 모듈은 취소·선점·정상 완결 흐름을 참조하지 않는다", () => {
  const source = readFileSync(new URL("./refundRecoveryAdminApi.ts", import.meta.url), "utf8");
  for (const forbidden of [
    "cancelNicepayPayment(",
    "executeRefundPaymentCancellation(",
    "claimPaymentCancellation(",
    "runRefundPaymentNormalFinalize(",
  ]) {
    assert.equal(source.includes(forbidden), false, `${forbidden} 호출이 있으면 안 된다`);
  }
  assert.equal(source.includes("refundPaymentNormalFinalize\""), false);
  assert.equal(/import[^\n]*nicepayCancel/.test(source), false);
});

test("route는 관리자 인증 뒤에서 이 action을 처리하고 body의 주문 정보를 쓰지 않는다", () => {
  const route = readFileSync(new URL("../../app/api/admin/route.ts", import.meta.url), "utf8");
  const authIndex = route.indexOf("if (!(await isAdminAuthenticated()))", route.indexOf("handlePost"));
  const actionIndex = route.indexOf('action === "recoverApprovedRefund"');
  assert.ok(authIndex > 0 && actionIndex > authIndex, "관리자 인증 뒤에 있어야 한다");
  const block = route.slice(actionIndex, route.indexOf('action === "toggleBlockSlot"'));
  assert.equal(block.includes("body.orderId"), false);
  assert.equal(block.includes("cancelNicepayPayment"), false);
});
