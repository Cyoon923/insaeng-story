/**
 * 환불 실행 권한 확인 테스트 (Refund-Payment-Execution-Gate-1).
 *
 * 실행: node --test src/lib/server/refundExecutionGate.test.ts
 *
 * 실제 DB도 NICEPAY도 부르지 않는다. 한 번에 읽은 사실(snapshot)을 흉내 내어
 * 판정만 확인한다. DB가 있는 환경에서는 loadRefundExecutionSnapshot이 같은 모양의
 * 사실을 한 문장으로 읽어 온다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  authorizeRefundExecution,
  decideRefundExecution,
} from "./refundExecutionGate.ts";
import type { RefundExecutionSnapshot } from "./refundExecutionGate.ts";

const REQUEST_ID = "rr-1";
const ORDER_ID = "o-is-abc";
const USER_ID = "u-1";

function snapshot(overrides: Partial<RefundExecutionSnapshot> = {}): RefundExecutionSnapshot {
  return {
    refundRequestId: REQUEST_ID,
    status: "approved",
    orderId: ORDER_ID,
    requestUserId: USER_ID,
    orderUserId: USER_ID,
    activeCount: 1,
    ...overrides,
  };
}

test("approved + 주문 존재 + 소유자 일치 + 활성 1건 → allowed", () => {
  const result = decideRefundExecution(snapshot());
  assert.deepEqual(result, {
    kind: "allowed",
    refundRequestId: REQUEST_ID,
    orderId: ORDER_ID,
    userId: USER_ID,
  });
});

test("환불 문의 없음 → not-found", () => {
  assert.deepEqual(decideRefundExecution(null), { kind: "not-found" });
});

for (const status of ["requested", "reviewing", "rejected", "completed"]) {
  test(`${status} → not-approved`, () => {
    assert.deepEqual(decideRefundExecution(snapshot({ status })), { kind: "not-approved" });
  });
}

test("연결된 주문 없음 → order-not-found", () => {
  assert.deepEqual(decideRefundExecution(snapshot({ orderUserId: null })), {
    kind: "order-not-found",
  });
});

test("order_id가 비어 있으면 → order-not-found", () => {
  assert.deepEqual(decideRefundExecution(snapshot({ orderId: "  ", orderUserId: null })), {
    kind: "order-not-found",
  });
});

test("문의 회원과 주문 회원이 다르면 → ownership-mismatch", () => {
  assert.deepEqual(decideRefundExecution(snapshot({ orderUserId: "u-other" })), {
    kind: "ownership-mismatch",
  });
});

test("같은 주문에 활성 문의가 2건이면 → ambiguous-active-request", () => {
  assert.deepEqual(decideRefundExecution(snapshot({ activeCount: 2 })), {
    kind: "ambiguous-active-request",
  });
});

/*
 * 활성 건수는 같은 order_id로만 센다(질의의 a.order_id = r.order_id).
 * 다른 주문에 활성 문의가 아무리 많아도 이 판정에는 들어오지 않으므로,
 * 여기 오는 activeCount는 1 그대로다.
 */
test("다른 주문의 활성 문의는 판정에 영향이 없다", () => {
  const result = decideRefundExecution(snapshot({ activeCount: 1 }));
  assert.equal(result.kind, "allowed");
});

test("approved라도 활성 건수가 0이면 허가하지 않는다", () => {
  assert.deepEqual(decideRefundExecution(snapshot({ activeCount: 0 })), {
    kind: "ambiguous-active-request",
  });
});

/** 입력은 refundRequestId 하나뿐이고, orderId는 DB 사실에서만 나온다. */
test("allowed의 orderId는 호출자 입력이 아니라 DB의 refund_requests.order_id에서 온다", async () => {
  const seen: string[] = [];
  const result = await authorizeRefundExecution(REQUEST_ID, async (id) => {
    seen.push(id);
    // 호출자는 이 값을 정할 방법이 없다. 조회로 읽힌 주문이 그대로 실행 대상이 된다.
    return snapshot({ orderId: "o-from-db", orderUserId: "u-from-db", requestUserId: "u-from-db" });
  });
  assert.deepEqual(seen, [REQUEST_ID]);
  assert.deepEqual(result, {
    kind: "allowed",
    refundRequestId: REQUEST_ID,
    orderId: "o-from-db",
    userId: "u-from-db",
  });
});

test("빈 refundRequestId는 조회 없이 not-found", async () => {
  let called = 0;
  const result = await authorizeRefundExecution("   ", async () => {
    called += 1;
    return snapshot();
  });
  assert.deepEqual(result, { kind: "not-found" });
  assert.equal(called, 0);
});

/**
 * 실행·PG·쓰기가 섞여 들어오지 않았는지 소스로 확인한다.
 * 이 gate는 판정만 하고, 어떤 상태도 바꾸지 않는다.
 */
test("gate 모듈은 실행·PG·쓰기 기능을 참조하지 않는다", () => {
  const source = readFileSync(new URL("./refundExecutionGate.ts", import.meta.url), "utf8");
  // 주석 설명에는 함수 이름이 나오므로 실제 호출 형태와 import만 본다.
  for (const forbidden of [
    "runRefundPaymentNormalFinalize(",
    "runRefundPaymentRecovery(",
    "executeRefundPaymentCancellation(",
    "cancelNicepayPayment(",
    "inquireNicepayPayment(",
    "finalizeRefundPaymentCancel(",
    "claimPaymentCancellation(",
  ]) {
    assert.equal(source.includes(forbidden), false, `${forbidden} 호출이 있으면 안 된다`);
  }
  assert.equal(/import[^\n]*nicepay/i.test(source), false, "PG 모듈을 불러오면 안 된다");
  // 질의는 읽기 전용이다. 쓰기 문장이 SQL에 없다.
  for (const write of ["UPDATE refund_requests", "UPDATE payments", "UPDATE orders", "INSERT INTO", "DELETE FROM"]) {
    assert.equal(source.includes(write), false, `${write} 문이 있으면 안 된다`);
  }
});
