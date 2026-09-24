/**
 * 관리자 적립금 복원 재시도 API 테스트 (Refund-Points-Restore-Recovery-Entrypoint-1).
 *
 * 실행: node --test src/lib/server/pointsRestoreRecoveryAdminApi.test.ts
 *
 * DB도 PG도 부르지 않는다. 바깥 기능을 가짜로 끼워 무엇을 부르고 무엇을 돌려주는지 본다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  readRestoreOrderPointsBody,
  restoreOrderPointsByAdmin,
  toRestoreOrderPointsResponse,
} from "./pointsRestoreRecoveryAdminApi.ts";
import type { RestoreOrderPointsDeps } from "./pointsRestoreRecoveryAdminApi.ts";
import type { PointsRestoreRecoveryGateResult } from "./pointsRestoreRecoveryGate.ts";
import type { RefundPointsRestoreResult } from "./refundPointsRestore.ts";

const REFUND_REQUEST_ID = "rr-1";
/** gate가 DB에서 읽어 주는 주문. 요청 body의 값과 일부러 다르게 둔다. */
const SERVER_ORDER_ID = "o-서버가읽은주문";

function harness(options: {
  gate?: PointsRestoreRecoveryGateResult | (() => never);
  restore?: RefundPointsRestoreResult | (() => never);
} = {}) {
  const calls: string[] = [];
  const authorizeIds: string[] = [];
  const restoreInputs: { orderId: string; refundRequestId: string | null }[] = [];
  const deps: RestoreOrderPointsDeps = {
    authorize: async (refundRequestId) => {
      calls.push("authorize");
      authorizeIds.push(refundRequestId);
      const next =
        options.gate ??
        ({
          kind: "authorized",
          refundRequestId: REFUND_REQUEST_ID,
          orderId: SERVER_ORDER_ID,
        } as PointsRestoreRecoveryGateResult);
      return typeof next === "function" ? next() : next;
    },
    restorePoints: async (input) => {
      calls.push("restore");
      restoreInputs.push(input);
      const next =
        options.restore ??
        ({ kind: "restored", orderId: SERVER_ORDER_ID, amount: 10000 } as RefundPointsRestoreResult);
      return typeof next === "function" ? next() : next;
    },
  };
  return { deps, calls, authorizeIds, restoreInputs };
}

/* ── body 읽기 ──────────────────────────────────────── */

test("body에서 refundRequestId만 읽는다", () => {
  assert.deepEqual(readRestoreOrderPointsBody({ refundRequestId: "  rr-9  " }), {
    ok: true,
    refundRequestId: "rr-9",
  });
});

test("refundRequestId가 없으면 400", () => {
  for (const body of [{}, { refundRequestId: "" }, { refundRequestId: "   " }, { refundRequestId: 1 }]) {
    const parsed = readRestoreOrderPointsBody(body as Record<string, unknown>);
    assert.equal(parsed.ok, false, JSON.stringify(body));
    if (parsed.ok) continue;
    assert.equal(parsed.status, 400);
  }
});

test("다른 이름을 함께 보내도 읽지 않는다", () => {
  const parsed = readRestoreOrderPointsBody({
    refundRequestId: "rr-9",
    orderId: "o-공격자",
    userId: "u-공격자",
    paymentId: "pay-공격자",
    amount: 999999,
    pointsUsed: 999999,
  });
  assert.deepEqual(parsed, { ok: true, refundRequestId: "rr-9" });
});

/* ── 정상 흐름 ──────────────────────────────────────── */

test("권한 확인 뒤 복원을 정확히 1회 부른다", async () => {
  const h = harness();
  const response = await restoreOrderPointsByAdmin(REFUND_REQUEST_ID, h.deps);
  assert.equal(response.status, 200);
  assert.deepEqual(h.calls, ["authorize", "restore"]);
  assert.deepEqual(h.authorizeIds, [REFUND_REQUEST_ID]);
});

test("복원 입력은 서버가 얻은 orderId와 검증된 refundRequestId뿐이다", async () => {
  const h = harness();
  await restoreOrderPointsByAdmin(REFUND_REQUEST_ID, h.deps);
  /*
   * orderId는 gate가 DB에서 읽어 준 값이다. 금액도 회원도 넘기지 않는다.
   * refundRequestId는 completed 검증을 통과한 실제 id라 원장 추적 컬럼에 남는다.
   */
  assert.deepEqual(h.restoreInputs, [
    { orderId: SERVER_ORDER_ID, refundRequestId: REFUND_REQUEST_ID },
  ]);
});

test("gate가 돌려준 refundRequestId를 쓴다. 요청값을 그대로 쓰지 않는다", async () => {
  const h = harness({
    gate: { kind: "authorized", refundRequestId: "rr-정규화된값", orderId: SERVER_ORDER_ID },
  });
  await restoreOrderPointsByAdmin("  rr-1  ", h.deps);
  assert.deepEqual(h.restoreInputs, [
    { orderId: SERVER_ORDER_ID, refundRequestId: "rr-정규화된값" },
  ]);
});

/* ── 결과 변환 ──────────────────────────────────────── */

test("restored → 200", async () => {
  const h = harness({ restore: { kind: "restored", orderId: SERVER_ORDER_ID, amount: 10000 } });
  const response = await restoreOrderPointsByAdmin(REFUND_REQUEST_ID, h.deps);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    ok: true,
    status: "restored",
    message: "적립금을 복원했습니다.",
  });
});

test("already-restored → 200, 오류가 아니다", async () => {
  const h = harness({ restore: { kind: "already-restored", orderId: SERVER_ORDER_ID } });
  const response = await restoreOrderPointsByAdmin(REFUND_REQUEST_ID, h.deps);
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
});

test("not-applicable → 409", async () => {
  const h = harness({
    restore: { kind: "not-applicable", orderId: SERVER_ORDER_ID, reason: "evidence-mismatch" },
  });
  const response = await restoreOrderPointsByAdmin(REFUND_REQUEST_ID, h.deps);
  assert.equal(response.status, 409);
  assert.equal(response.body.ok, false);
});

test("retry-later → 202", async () => {
  const h = harness({
    restore: { kind: "retry-later", orderId: SERVER_ORDER_ID, reason: "cas-conflict" },
  });
  const response = await restoreOrderPointsByAdmin(REFUND_REQUEST_ID, h.deps);
  assert.equal(response.status, 202);
  assert.equal(response.body.ok, false);
});

/** 내부 사유가 응답에 새어 나가면 안 된다. */
test("내부 evidence 사유를 응답에 담지 않는다", () => {
  const reasons = [
    "missing-payment-evidence",
    "missing-order-evidence",
    "evidence-mismatch",
    "invalid-amount",
    "no-points-used",
    "order-not-found",
    "no-payment",
    "ambiguous-payment",
    "user-not-found",
    "order-not-matched",
  ] as const;
  for (const reason of reasons) {
    const response = toRestoreOrderPointsResponse({
      kind: "not-applicable",
      orderId: SERVER_ORDER_ID,
      reason,
    });
    const serialized = JSON.stringify(response.body);
    assert.ok(!serialized.includes(reason), reason);
    // 주문 id와 금액도 담지 않는다.
    assert.ok(!serialized.includes(SERVER_ORDER_ID), reason);
  }
});

test("복원 금액과 주문 id를 응답에 담지 않는다", () => {
  const response = toRestoreOrderPointsResponse({
    kind: "restored",
    orderId: SERVER_ORDER_ID,
    amount: 123456,
  });
  const serialized = JSON.stringify(response.body);
  assert.ok(!serialized.includes("123456"));
  assert.ok(!serialized.includes(SERVER_ORDER_ID));
});

/* ── gate 차단 ──────────────────────────────────────── */

const BLOCKED_GATES: { gate: PointsRestoreRecoveryGateResult; status: number }[] = [
  { gate: { kind: "not-found" }, status: 404 },
  { gate: { kind: "not-completed" }, status: 409 },
  { gate: { kind: "order-not-found" }, status: 409 },
  { gate: { kind: "ownership-mismatch" }, status: 409 },
];

for (const { gate, status } of BLOCKED_GATES) {
  test(`gate ${gate.kind} → ${status}, 복원 미호출`, async () => {
    const h = harness({ gate });
    const response = await restoreOrderPointsByAdmin(REFUND_REQUEST_ID, h.deps);
    assert.equal(response.status, status);
    assert.equal(response.body.ok, false);
    // 권한이 없으면 복원 흐름에 들어가지 않는다.
    assert.deepEqual(h.calls, ["authorize"]);
    assert.equal(h.restoreInputs.length, 0);
  });
}

test("completed가 아니면 복원을 부르지 않는다", async () => {
  const h = harness({ gate: { kind: "not-completed" } });
  await restoreOrderPointsByAdmin(REFUND_REQUEST_ID, h.deps);
  assert.equal(h.restoreInputs.length, 0);
});

test("회원 불일치 응답에 회원 정보를 담지 않는다", async () => {
  const h = harness({ gate: { kind: "ownership-mismatch" } });
  const response = await restoreOrderPointsByAdmin(REFUND_REQUEST_ID, h.deps);
  const serialized = JSON.stringify(response.body);
  assert.ok(!serialized.includes("u-"));
  assert.ok(!serialized.includes(SERVER_ORDER_ID));
});

/* ── 예외 ───────────────────────────────────────────── */

test("권한 확인이 끊기면 500, 복원 미호출", async () => {
  const h = harness({
    gate: () => {
      throw new Error("db down");
    },
  });
  const response = await restoreOrderPointsByAdmin(REFUND_REQUEST_ID, h.deps);
  assert.equal(response.status, 500);
  assert.equal(response.body.ok, false);
  assert.deepEqual(h.calls, ["authorize"]);
});

/*
 * 세 실행 경로(normal·recovery·succeededRecovery)는 복원 실패를 삼킨다. 이미 끝난
 * 환불의 뒤처리이기 때문이다. 이 API는 관리자가 복원만을 목적으로 누른 요청이라
 * 실패를 성공으로 위장하지 않는다.
 */
test("복원이 예외로 끊기면 성공으로 위장하지 않고 500", async () => {
  const h = harness({
    restore: () => {
      throw new Error("store down");
    },
  });
  const response = await restoreOrderPointsByAdmin(REFUND_REQUEST_ID, h.deps);
  assert.equal(response.status, 500);
  assert.equal(response.body.ok, false);
  // 다시 부르지 않는다. 재시도는 관리자가 다시 누르는 것으로 한다.
  assert.deepEqual(h.calls, ["authorize", "restore"]);
});

test("예외 응답에 내부 오류 문구를 담지 않는다", async () => {
  const h = harness({
    restore: () => {
      throw new Error("store down: connection refused at 10.0.0.1");
    },
  });
  const response = await restoreOrderPointsByAdmin(REFUND_REQUEST_ID, h.deps);
  const serialized = JSON.stringify(response.body);
  assert.ok(!serialized.includes("10.0.0.1"));
  assert.ok(!serialized.includes("connection refused"));
});
