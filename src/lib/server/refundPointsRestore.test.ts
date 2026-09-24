/**
 * 적립금 복원 흐름 테스트 (Refund-Points-Restore-Orchestration-1).
 *
 * 실행: node --test src/lib/server/refundPointsRestore.test.ts
 *
 * DB를 부르지 않는다. 바깥 기능을 가짜로 끼워 순서와 호출 횟수를 본다.
 * 잔액과 원장이 실제로 함께 반영되는지는 pointsRestoreAtomic.test.sql에서 본다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { runRefundPointsRestore } from "./refundPointsRestore.ts";
import type { RefundPointsRestoreDeps } from "./refundPointsRestore.ts";
import type { RestoreOrderPointsResult } from "./store.ts";
import type { AppData, Order, Payment } from "@/lib/types/app";

const ORDER_ID = "o-1";
const USER_ID = "u-1";
const REFUND_REQUEST_ID = "rr-1";

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: ORDER_ID,
    userId: USER_ID,
    product: "story",
    title: "이야기로 만드는 인생곡",
    status: "제작중",
    amount: 140000,
    baseAmount: 150000,
    payment: "신용/체크카드",
    details: { usePoints: "1", pointsUsed: "10000" },
    createdAt: "2026-09-10T00:00:00.000Z",
    ...overrides,
  };
}

/** 환불이 끝난 뒤의 결제. status는 이미 cancelled다. */
function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "pay-1",
    orderId: ORDER_ID,
    provider: "nicepay",
    merchantOrderId: "is-1",
    pgTid: "tid-1",
    requestedAmount: 140000,
    approvedAmount: 140000,
    cancelledAmount: 140000,
    status: "cancelled",
    method: "card",
    approvedAt: "2026-09-10T00:00:00.000Z",
    cancelledAt: "2026-09-17T00:00:00.000Z",
    orderSnapshot: { version: 1, discount: { couponId: "", usePoints: 10000 } },
    raw: null,
    createdAt: "2026-09-10T00:00:00.000Z",
    updatedAt: "2026-09-17T00:00:00.000Z",
    ...overrides,
  };
}

const APP_DATA = { users: [] } as unknown as AppData;

interface Harness {
  deps: RefundPointsRestoreDeps;
  restoreCalls: {
    userId: string;
    orderId: string;
    refundRequestId: string | null;
    amount: number;
  }[];
  reads: number;
}

function harness(
  overrides: {
    order?: Order | null;
    payments?: Payment[];
    restore?: RestoreOrderPointsResult;
  } = {},
): Harness {
  const restoreCalls: Harness["restoreCalls"] = [];
  const state = { reads: 0 };
  const deps: RefundPointsRestoreDeps = {
    readData: async () => {
      state.reads += 1;
      return APP_DATA;
    },
    getOrderById: async () => (overrides.order === undefined ? order() : overrides.order),
    listPaymentsForOrder: async () => overrides.payments ?? [payment()],
    restorePoints: async (data, input) => {
      assert.equal(data, APP_DATA, "저장에 넘긴 저장소가 읽은 것과 다르다");
      restoreCalls.push(input);
      return overrides.restore ?? { applied: true, amount: input.amount };
    },
  };
  return {
    deps,
    restoreCalls,
    get reads() {
      return state.reads;
    },
  };
}

function run(h: Harness) {
  return runRefundPointsRestore(
    { orderId: ORDER_ID, refundRequestId: REFUND_REQUEST_ID },
    h.deps,
  );
}

/* ── 정상 복원 ──────────────────────────────────────── */

test("근거가 맞으면 그 금액으로 한 번 복원한다", async () => {
  const h = harness();
  const result = await run(h);
  assert.deepEqual(result, { kind: "restored", orderId: ORDER_ID, amount: 10000 });
  assert.equal(h.restoreCalls.length, 1);
});

test("회원과 금액은 바깥에서 받지 않고 주문·결제에서 읽는다", async () => {
  const h = harness();
  await run(h);
  assert.deepEqual(h.restoreCalls[0], {
    // 주문 행의 주인을 쓴다.
    userId: USER_ID,
    orderId: ORDER_ID,
    refundRequestId: REFUND_REQUEST_ID,
    // 결제 기록의 서버 계산 값과 주문 표시가 일치한 금액이다.
    amount: 10000,
  });
});

/* ── 근거가 없거나 어긋날 때 ────────────────────────── */

test("주문이 없으면 저장을 시도하지 않는다", async () => {
  const h = harness({ order: null });
  assert.deepEqual(await run(h), {
    kind: "not-applicable",
    orderId: ORDER_ID,
    reason: "order-not-found",
  });
  assert.equal(h.restoreCalls.length, 0);
  assert.equal(h.reads, 0, "저장소를 읽을 필요가 없다");
});

test("결제 기록이 없으면 복원 대상이 아니다", async () => {
  const h = harness({ payments: [] });
  assert.deepEqual(await run(h), {
    kind: "not-applicable",
    orderId: ORDER_ID,
    reason: "no-payment",
  });
  assert.equal(h.restoreCalls.length, 0);
});

test("결제가 둘 이상이면 자동으로 고르지 않는다", async () => {
  const h = harness({ payments: [payment(), payment({ id: "pay-2" })] });
  assert.deepEqual(await run(h), {
    kind: "not-applicable",
    orderId: ORDER_ID,
    reason: "ambiguous-payment",
  });
  assert.equal(h.restoreCalls.length, 0);
});

test("판정이 막으면 그 사유를 그대로 옮긴다", async () => {
  const cases: [Partial<Order>, Partial<Payment>, string][] = [
    [{ details: {} }, {}, "missing-order-evidence"],
    [{}, { orderSnapshot: null }, "missing-payment-evidence"],
    [{ details: { pointsUsed: "9000" } }, {}, "evidence-mismatch"],
    [{ details: { pointsUsed: "0" } }, { orderSnapshot: { discount: { usePoints: 0 } } }, "no-points-used"],
    [
      { details: { pointsUsed: "-1" } },
      { orderSnapshot: { discount: { usePoints: -1 } } },
      "invalid-amount",
    ],
  ];
  for (const [orderPatch, paymentPatch, reason] of cases) {
    const h = harness({ order: order(orderPatch), payments: [payment(paymentPatch)] });
    assert.deepEqual(
      await run(h),
      { kind: "not-applicable", orderId: ORDER_ID, reason },
      reason,
    );
    assert.equal(h.restoreCalls.length, 0, reason);
  }
});

/* ── 저장 결과 옮기기 ───────────────────────────────── */

test("이미 복원된 주문은 오류가 아니다", async () => {
  const h = harness({ restore: { applied: false, reason: "already-restored" } });
  assert.deepEqual(await run(h), { kind: "already-restored", orderId: ORDER_ID });
  // 미리 조회해 건너뛰지 않는다. 저장까지 가 보고 DB가 막은 결과를 읽는다.
  assert.equal(h.restoreCalls.length, 1);
});

test("저장소가 그사이 바뀌었으면 다시 하면 된다고 알린다", async () => {
  const h = harness({ restore: { applied: false, reason: "cas-conflict" } });
  assert.deepEqual(await run(h), {
    kind: "retry-later",
    orderId: ORDER_ID,
    reason: "cas-conflict",
  });
});

test("저장 단계의 나머지 사유도 그대로 옮긴다", async () => {
  for (const reason of ["user-not-found", "invalid-amount", "order-not-matched"] as const) {
    const h = harness({ restore: { applied: false, reason } });
    assert.deepEqual(
      await run(h),
      { kind: "not-applicable", orderId: ORDER_ID, reason },
      reason,
    );
  }
});

/* ── 부르는 횟수 ────────────────────────────────────── */

test("한 번 부르면 저장도 많아야 한 번이다", async () => {
  const h = harness();
  await run(h);
  assert.equal(h.restoreCalls.length, 1);
  assert.equal(h.reads, 1);
});

test("환불 문의 참조가 없어도 복원한다", async () => {
  const h = harness();
  const result = await runRefundPointsRestore(
    { orderId: ORDER_ID, refundRequestId: null },
    h.deps,
  );
  assert.equal(result.kind, "restored");
  assert.equal(h.restoreCalls[0].refundRequestId, null);
});
