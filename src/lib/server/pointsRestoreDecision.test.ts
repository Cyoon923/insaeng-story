/**
 * 환불 적립금 복원 금액 판정 테스트 (Refund-Points-Ledger-Foundation-1).
 *
 * 실행: node --test src/lib/server/pointsRestoreDecision.test.ts
 * 순수 함수라 DB도 네트워크도 필요 없다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { decidePointsRestore, readPointAmount } from "./pointsRestoreDecision.ts";
import type { Order, Payment } from "@/lib/types/app";

function order(pointsUsed?: string): Order {
  return {
    id: "o-1",
    userId: "u-1",
    product: "story",
    title: "이야기로 만드는 인생곡",
    status: "제작중",
    amount: 140000,
    baseAmount: 150000,
    payment: "신용/체크카드",
    details: pointsUsed === undefined ? {} : { usePoints: "1", pointsUsed },
    createdAt: "2026-09-10T00:00:00.000Z",
  };
}

/** 승인된 결제 1건. discount.usePoints는 결제 준비 때 서버가 계산해 넣은 값이다. */
function payment(usePoints?: unknown): Payment {
  return {
    id: "pay-1",
    orderId: "o-1",
    provider: "nicepay",
    merchantOrderId: "is-1",
    pgTid: "tid-1",
    requestedAmount: 140000,
    approvedAmount: 140000,
    cancelledAmount: 0,
    status: "paid",
    method: "card",
    approvedAt: "2026-09-10T00:00:00.000Z",
    cancelledAt: null,
    orderSnapshot:
      usePoints === undefined
        ? { version: 1, discount: { couponId: "", referralCode: "" } }
        : { version: 1, discount: { couponId: "", referralCode: "", usePoints } },
    raw: null,
    createdAt: "2026-09-10T00:00:00.000Z",
    updatedAt: "2026-09-10T00:00:00.000Z",
  };
}

/* ── 정상 ───────────────────────────────────────────── */

test("두 근거가 같으면 그 금액을 복원 대상으로 본다", () => {
  assert.deepEqual(decidePointsRestore(order("10000"), payment(10000)), {
    kind: "restore",
    amount: 10000,
  });
});

test("큰 정수도 그대로 다룬다", () => {
  assert.deepEqual(decidePointsRestore(order("1234567"), payment(1234567)), {
    kind: "restore",
    amount: 1234567,
  });
});

test("결제 근거가 문자열로 저장돼 있어도 같은 값이면 통과한다", () => {
  // 저장 경로에 따라 숫자·문자열이 섞일 수 있다. 값이 같으면 같은 뜻으로 본다.
  assert.deepEqual(decidePointsRestore(order("10000"), payment("10000")), {
    kind: "restore",
    amount: 10000,
  });
});

/* ── 근거 없음 ──────────────────────────────────────── */

test("결제에 서버 계산 근거가 없으면 자동 복원하지 않는다", () => {
  assert.deepEqual(decidePointsRestore(order("10000"), payment()), {
    kind: "blocked",
    reason: "missing-payment-evidence",
  });
  // 스냅샷 자체가 없는 옛 결제도 같다.
  const bare = { ...payment(10000), orderSnapshot: null };
  assert.deepEqual(decidePointsRestore(order("10000"), bare), {
    kind: "blocked",
    reason: "missing-payment-evidence",
  });
});

test("주문에 사용 적립금 표시가 없으면 자동 복원하지 않는다", () => {
  assert.deepEqual(decidePointsRestore(order(), payment(10000)), {
    kind: "blocked",
    reason: "missing-order-evidence",
  });
  assert.deepEqual(decidePointsRestore(order("   "), payment(10000)), {
    kind: "blocked",
    reason: "missing-order-evidence",
  });
});

/* ── 어긋남·잘못된 값 ───────────────────────────────── */

test("두 근거가 다르면 어느 쪽도 고르지 않는다", () => {
  assert.deepEqual(decidePointsRestore(order("9000"), payment(10000)), {
    kind: "blocked",
    reason: "evidence-mismatch",
  });
});

test("0이면 돌려줄 것이 없다", () => {
  assert.deepEqual(decidePointsRestore(order("0"), payment(0)), {
    kind: "blocked",
    reason: "no-points-used",
  });
});

test("음수는 복원하지 않는다", () => {
  assert.deepEqual(decidePointsRestore(order("-100"), payment(-100)), {
    kind: "blocked",
    reason: "invalid-amount",
  });
});

test("소수는 복원하지 않는다", () => {
  assert.deepEqual(decidePointsRestore(order("100.5"), payment(100.5)), {
    kind: "blocked",
    reason: "invalid-amount",
  });
  // 한쪽만 소수여도 마찬가지다.
  assert.deepEqual(decidePointsRestore(order("100"), payment(100.5)), {
    kind: "blocked",
    reason: "invalid-amount",
  });
});

test("숫자로 읽을 수 없는 값은 복원하지 않는다", () => {
  assert.deepEqual(decidePointsRestore(order("만원"), payment(10000)), {
    kind: "blocked",
    reason: "invalid-amount",
  });
  assert.deepEqual(decidePointsRestore(order("10000"), payment({ amount: 10000 })), {
    kind: "blocked",
    reason: "invalid-amount",
  });
});

/* ── 금액 읽기 규칙 ─────────────────────────────────── */

test("원 단위 적립금 읽기 규칙", () => {
  assert.equal(readPointAmount(10000), 10000);
  assert.equal(readPointAmount("10000"), 10000);
  assert.equal(readPointAmount(" 10000 "), 10000);
  assert.equal(readPointAmount(0), 0);
  assert.equal(readPointAmount(-100), -100);
  assert.equal(readPointAmount(100.5), null);
  assert.equal(readPointAmount("100.5"), null);
  assert.equal(readPointAmount("1e4"), null);
  assert.equal(readPointAmount(""), null);
  assert.equal(readPointAmount(null), null);
  assert.equal(readPointAmount(undefined), null);
  assert.equal(readPointAmount({}), null);
  assert.equal(readPointAmount(Number.MAX_SAFE_INTEGER + 2), null);
});

/* ── 입력을 바꾸지 않는다 ───────────────────────────── */

test("판정이 주문·결제를 바꾸지 않는다", () => {
  const o = order("10000");
  const p = payment(10000);
  const beforeOrder = JSON.stringify(o);
  const beforePayment = JSON.stringify(p);
  decidePointsRestore(o, p);
  assert.equal(JSON.stringify(o), beforeOrder);
  assert.equal(JSON.stringify(p), beforePayment);
});
