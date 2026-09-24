/**
 * 주문에 귀속된 결제 판정 테스트 (Refund-Payment-Cancel-Foundation-1).
 *
 * 실행: node --test src/lib/server/paymentLookup.test.ts
 *
 * 실제 질의와 취소 감사 열 저장은 paymentCancelFoundation.test.sql에서 본다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { classifyPaidPayments } from "./paymentLookup.ts";
import type { Payment, PaymentStatus } from "@/lib/types/app";

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "pay-1",
    orderId: "o-1",
    provider: "nicepay",
    merchantOrderId: "is-1",
    pgTid: "tid-1",
    requestedAmount: 100000,
    approvedAmount: 100000,
    cancelledAmount: 0,
    status: "paid",
    method: "card",
    approvedAt: "2026-08-12T00:00:00.000Z",
    cancelledAt: null,
    orderSnapshot: null,
    raw: { resultCode: "0000" },
    createdAt: "2026-08-12T00:00:00.000Z",
    updatedAt: "2026-08-12T00:00:00.000Z",
    ...overrides,
  };
}

test("승인 결제가 정확히 하나면 single-paid-payment", () => {
  const only = payment();
  assert.deepEqual(classifyPaidPayments([only]), {
    kind: "single-paid-payment",
    payment: only,
  });
});

test("결제 기록이 없으면 no-payment", () => {
  // 쿠폰·적립금으로 0원이 된 주문은 결제 행 자체가 만들어지지 않는다.
  assert.deepEqual(classifyPaidPayments([]), { kind: "no-payment" });
});

test("승인 결제가 둘 이상이면 하나를 고르지 않고 ambiguous", () => {
  const first = payment({ id: "pay-1", createdAt: "2026-08-12T00:00:00.000Z" });
  const second = payment({ id: "pay-2", createdAt: "2026-08-13T00:00:00.000Z" });
  const result = classifyPaidPayments([second, first]);
  assert.equal(result.kind, "ambiguous");
  if (result.kind !== "ambiguous") return;
  // 최신 1건으로 좁히지 않고 둘 다 넘긴다.
  assert.deepEqual(result.payments.map((item) => item.id), ["pay-2", "pay-1"]);
});

test("승인되지 않은 상태가 섞여 있어도 승인 건만 본다", () => {
  const paid = payment({ id: "pay-paid" });
  const others: PaymentStatus[] = ["ready", "processing", "failed", "cancelled", "partialCancelled"];
  const mixed = [paid, ...others.map((status, index) => payment({ id: `pay-${index}`, status }))];
  assert.deepEqual(classifyPaidPayments(mixed), { kind: "single-paid-payment", payment: paid });

  // 승인 건이 하나도 없으면 다른 상태가 아무리 많아도 no-payment다.
  assert.deepEqual(
    classifyPaidPayments(others.map((status, index) => payment({ id: `x-${index}`, status }))),
    { kind: "no-payment" },
  );
});

test("거래 식별자가 없는 승인 건도 숨기지 않고 돌려준다", () => {
  // pgTid가 없으면 취소할 수 없지만, 그 사실은 호출부가 보고 막아야 한다.
  const noTid = payment({ pgTid: null });
  const result = classifyPaidPayments([noTid]);
  assert.equal(result.kind, "single-paid-payment");
  if (result.kind !== "single-paid-payment") return;
  assert.equal(result.payment.pgTid, null);
});

test("금액 정보를 그대로 전달한다", () => {
  const result = classifyPaidPayments([payment({ approvedAmount: 150000, cancelledAmount: 0 })]);
  assert.equal(result.kind, "single-paid-payment");
  if (result.kind !== "single-paid-payment") return;
  assert.equal(result.payment.approvedAmount, 150000);
  assert.equal(result.payment.cancelledAmount, 0);
});

test("판정만 하고 원본을 바꾸지 않는다", () => {
  const original = payment();
  const snapshot = { ...original };
  classifyPaidPayments([original]);
  assert.deepEqual(original, snapshot);
});
