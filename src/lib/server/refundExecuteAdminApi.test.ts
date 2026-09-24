/**
 * 관리자 환불 실행 API 규칙 테스트 (Refund-Payment-Admin-Execute-API-1).
 *
 * 실행: node --test src/lib/server/refundExecuteAdminApi.test.ts
 *
 * 실제 NICEPAY도 DB도 부르지 않는다. gate와 실행 흐름을 가짜로 끼워
 * 호출 횟수·전달된 주문 id·응답 매핑을 본다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  executeApprovedRefund,
  readExecuteApprovedRefundBody,
  toExecuteApprovedRefundResponse,
} from "./refundExecuteAdminApi.ts";
import type { ExecuteApprovedRefundDeps } from "./refundExecuteAdminApi.ts";
import type { RefundExecutionGateResult } from "./refundExecutionGate.ts";
import type { RefundPaymentNormalFinalizeResult } from "./refundPaymentNormalFinalize.ts";
import type { Payment } from "@/lib/types/app";

const REQUEST_ID = "rr-1";
const DB_ORDER_ID = "o-from-db";

const ALLOWED: RefundExecutionGateResult = {
  kind: "allowed",
  refundRequestId: REQUEST_ID,
  orderId: DB_ORDER_ID,
  userId: "u-1",
};

function payment(): Payment {
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
    cancelExecutionStatus: null,
    cancelClaimedAt: null,
  };
}

const COMPLETED: RefundPaymentNormalFinalizeResult = {
  kind: "completed",
  paymentId: "pay-1",
  orderId: DB_ORDER_ID,
  alreadyFinalized: false,
};

function harness(options: {
  gate?: RefundExecutionGateResult | (() => never);
  result?: RefundPaymentNormalFinalizeResult | (() => never);
}) {
  const calls: string[] = [];
  const executedOrderIds: string[] = [];
  const deps: ExecuteApprovedRefundDeps = {
    authorize: async () => {
      calls.push("authorize");
      const next = options.gate ?? ALLOWED;
      return typeof next === "function" ? next() : next;
    },
    execute: async (orderId) => {
      calls.push("execute");
      executedOrderIds.push(orderId);
      const next = options.result ?? COMPLETED;
      return typeof next === "function" ? next() : next;
    },
  };
  return { deps, calls, executedOrderIds };
}

/* ── 입력 경계 ─────────────────────────────────────────── */

test("refundRequestId가 없거나 공백이면 400", () => {
  for (const body of [{}, { refundRequestId: "   " }, { refundRequestId: 12 }]) {
    const parsed = readExecuteApprovedRefundBody(body as Record<string, unknown>);
    assert.equal(parsed.ok, false);
    if (parsed.ok) return;
    assert.equal(parsed.status, 400);
  }
});

test("body의 다른 값은 읽지 않는다", () => {
  const parsed = readExecuteApprovedRefundBody({
    refundRequestId: " rr-1 ",
    orderId: "o-client",
    paymentId: "pay-client",
    tid: "tid-client",
    amount: 1,
    userId: "u-client",
    status: "approved",
  });
  assert.deepEqual(parsed, { ok: true, refundRequestId: REQUEST_ID });
});

/* ── gate → 실행 순서 ──────────────────────────────────── */

test("gate allowed면 gate의 orderId로 실행한다", async () => {
  const h = harness({});
  const response = await executeApprovedRefund(REQUEST_ID, h.deps);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ok: true, status: "completed" });
  assert.deepEqual(h.calls, ["authorize", "execute"]);
  // 실행은 한 번뿐이고, 주문 id는 gate가 준 값이다.
  assert.deepEqual(h.executedOrderIds, [DB_ORDER_ID]);
});

test("클라이언트가 orderId를 같이 보내도 실행에 쓰이지 않는다", async () => {
  const parsed = readExecuteApprovedRefundBody({
    refundRequestId: REQUEST_ID,
    orderId: "o-client-injected",
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const h = harness({});
  await executeApprovedRefund(parsed.refundRequestId, h.deps);
  assert.deepEqual(h.executedOrderIds, [DB_ORDER_ID]);
  assert.equal(h.executedOrderIds.includes("o-client-injected"), false);
});

/* ── gate 실패 매핑 ────────────────────────────────────── */

const GATE_FAILURES: { gate: RefundExecutionGateResult; status: number }[] = [
  { gate: { kind: "not-found" }, status: 404 },
  { gate: { kind: "not-approved" }, status: 409 },
  { gate: { kind: "order-not-found" }, status: 409 },
  { gate: { kind: "ownership-mismatch" }, status: 409 },
  { gate: { kind: "ambiguous-active-request" }, status: 409 },
];

for (const { gate, status } of GATE_FAILURES) {
  test(`gate ${gate.kind} → ${status}, 실행 0회`, async () => {
    const h = harness({ gate });
    const response = await executeApprovedRefund(REQUEST_ID, h.deps);
    assert.equal(response.status, status);
    assert.deepEqual(h.calls, ["authorize"]);
    assert.equal(h.executedOrderIds.length, 0);
    // 회원·주문 식별자를 응답에 담지 않는다.
    const json = JSON.stringify(response.body);
    assert.equal(json.includes(DB_ORDER_ID), false);
    assert.equal(json.includes("u-1"), false);
  });
}

/* ── 실행 결과 매핑 ────────────────────────────────────── */

test("이미 반영된 완료(alreadyFinalized)도 200", () => {
  const response = toExecuteApprovedRefundResponse({ ...COMPLETED, alreadyFinalized: true });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ok: true, status: "completed" });
});

const CANCEL_CASES: { name: string; result: RefundPaymentNormalFinalizeResult; status: number; safe: string }[] = [
  {
    name: "not-claimable",
    result: { kind: "cancel-not-completed", cancel: { kind: "not-claimable" } },
    status: 409,
    safe: "already-executing",
  },
  {
    name: "declined",
    result: { kind: "cancel-not-completed", cancel: { kind: "declined", payment: payment() } },
    status: 409,
    safe: "cancel-declined",
  },
  {
    name: "unknown",
    result: { kind: "cancel-not-completed", cancel: { kind: "unknown", payment: payment() } },
    status: 202,
    safe: "verification-pending",
  },
  {
    name: "recording-failed",
    result: { kind: "cancel-not-completed", cancel: { kind: "recording-failed" } },
    status: 202,
    safe: "verification-pending",
  },
  {
    name: "no-payment",
    result: { kind: "cancel-not-completed", cancel: { kind: "no-payment" } },
    status: 409,
    safe: "manual-review-required",
  },
  {
    name: "ambiguous-payment",
    result: { kind: "cancel-not-completed", cancel: { kind: "ambiguous-payment" } },
    status: 409,
    safe: "manual-review-required",
  },
  {
    name: "invalid-payment",
    result: {
      kind: "cancel-not-completed",
      cancel: { kind: "invalid-payment", reason: "missing-tid" },
    },
    status: 409,
    safe: "manual-review-required",
  },
  {
    name: "verification-pending",
    result: {
      kind: "verification-pending",
      paymentId: "pay-1",
      orderId: DB_ORDER_ID,
      reconciliation: { kind: "not-verified", reason: "inquiry-unknown" },
    },
    status: 202,
    safe: "verification-pending",
  },
  {
    name: "finalization-failed",
    result: {
      kind: "finalization-failed",
      paymentId: "pay-1",
      orderId: DB_ORDER_ID,
      finalize: { ok: false, kind: "payment-mismatch" },
    },
    status: 409,
    safe: "manual-review-required",
  },
];

for (const { name, result, status, safe } of CANCEL_CASES) {
  test(`실행 결과 ${name} → ${status} / ${safe}, 재실행 없음`, async () => {
    const h = harness({ result });
    const response = await executeApprovedRefund(REQUEST_ID, h.deps);
    assert.equal(response.status, status);
    assert.deepEqual(response.body, {
      ok: false,
      status: safe,
      message: (response.body as { message: string }).message,
    });
    // 실행은 한 번뿐이다. 어떤 결과에서도 자동으로 다시 부르지 않는다.
    assert.deepEqual(h.calls, ["authorize", "execute"]);
    // 응답 문구가 재시도를 유도하지 않는다.
    const message = (response.body as { message: string }).message;
    assert.equal(message.includes("다시 시도"), false);
    // 내부 식별자·PG 정보가 새지 않는다.
    const json = JSON.stringify(response.body);
    for (const leak of ["pay-1", "tid-1", DB_ORDER_ID, "100000", "payment-mismatch", "inquiry-unknown"]) {
      assert.equal(json.includes(leak), false, `${leak}이 응답에 있으면 안 된다`);
    }
  });
}

/* ── 예외 ─────────────────────────────────────────────── */

test("gate 예외 → 500, 실행 0회", async () => {
  const h = harness({
    gate: () => {
      throw new Error("db down");
    },
  });
  const response = await executeApprovedRefund(REQUEST_ID, h.deps);
  assert.equal(response.status, 500);
  assert.deepEqual(h.calls, ["authorize"]);
  assert.equal(h.executedOrderIds.length, 0);
});

test("실행 예외 → 500, 추가 실행 없음", async () => {
  const h = harness({
    result: () => {
      throw new Error("boom");
    },
  });
  const response = await executeApprovedRefund(REQUEST_ID, h.deps);
  assert.equal(response.status, 500);
  assert.deepEqual(h.calls, ["authorize", "execute"]);
  const json = JSON.stringify(response.body);
  assert.equal(json.includes("boom"), false);
});

/* ── 구조 ─────────────────────────────────────────────── */

test("이 모듈은 취소·선점·복구 기능을 직접 부르지 않는다", () => {
  const source = readFileSync(new URL("./refundExecuteAdminApi.ts", import.meta.url), "utf8");
  for (const forbidden of [
    "cancelNicepayPayment(",
    "claimPaymentCancellation(",
    "executeRefundPaymentCancellation(",
    "runRefundPaymentRecovery(",
    "finalizeRefundPaymentCancel(",
  ]) {
    assert.equal(source.includes(forbidden), false, `${forbidden} 호출이 있으면 안 된다`);
  }
  assert.equal(source.includes("refundPaymentRecovery"), false);
});

test("route는 관리자 인증 뒤에서 이 action을 처리하고 body의 orderId를 쓰지 않는다", () => {
  const route = readFileSync(
    new URL("../../app/api/admin/route.ts", import.meta.url),
    "utf8",
  );
  const authIndex = route.indexOf("if (!(await isAdminAuthenticated()))", route.indexOf("handlePost"));
  const actionIndex = route.indexOf('action === "executeApprovedRefund"');
  assert.ok(authIndex > 0 && actionIndex > authIndex, "관리자 인증 뒤에 있어야 한다");
  // 실행에 넘기는 주문 id는 helper 안에서 gate가 정한다. route는 body에서 읽지 않는다.
  const block = route.slice(actionIndex, route.indexOf('action === "toggleBlockSlot"'));
  assert.equal(block.includes("body.orderId"), false);
  assert.equal(block.includes("runRefundPaymentRecovery"), false);
});
