/**
 * 관리자 목록 결제 실행 요약 테스트 (Refund-Payment-Admin-Execution-Projection-1).
 *
 * 실행: node --test src/lib/server/refundExecutionProjection.test.ts
 *
 * 순수 함수라 DB도 PG도 필요 없다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  projectRefundExecution,
  projectRefundExecutionFromLookup,
} from "./refundExecutionProjection.ts";
import { classifyPaidPayments } from "./paymentLookup.ts";
import type { Payment, PaymentCancelExecutionStatus, PaymentStatus } from "@/lib/types/app";

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "pay-1",
    orderId: "o-1",
    provider: "nicepay",
    merchantOrderId: "is-abc",
    pgTid: "tid-1",
    requestedAmount: 100000,
    approvedAmount: 100000,
    cancelledAmount: 0,
    status: "paid" as PaymentStatus,
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
    ...overrides,
  };
}

test("승인 결제 1건 + 취소 실행 기록 없음 → executable", () => {
  assert.equal(projectRefundExecution([payment({ cancelExecutionStatus: null })]), "executable");
});

for (const execution of ["processing", "unknown", "succeeded"] as const) {
  test(`승인 결제 1건 + ${execution} → recoverable`, () => {
    assert.equal(
      projectRefundExecution([payment({ cancelExecutionStatus: execution })]),
      "recoverable",
    );
  });
}

test("승인 결제 1건 + declined → manual-review", () => {
  assert.equal(
    projectRefundExecution([payment({ cancelExecutionStatus: "declined" })]),
    "manual-review",
  );
});

test("승인 결제가 둘 이상이면 → manual-review", () => {
  assert.equal(
    projectRefundExecution([payment(), payment({ id: "pay-2" })]),
    "manual-review",
  );
});

test("승인 결제가 없으면 → unknown", () => {
  assert.equal(projectRefundExecution([]), "unknown");
});

/*
 * 취소된 결제만 있는 경우도 unknown이다.
 * classifyPaidPayments가 paid만 세기 때문이며, 환불이 끝났다고 단정하지 않는다.
 * 완료 표시는 환불 문의 상태(completed)로 한다.
 */
test("취소된 결제만 있으면 → unknown (완료로 추론하지 않는다)", () => {
  const cancelled = payment({
    status: "cancelled" as PaymentStatus,
    cancelledAmount: 100000,
    cancelExecutionStatus: "succeeded",
  });
  assert.equal(projectRefundExecution([cancelled]), "unknown");
});

/** 몇 건인지 세는 규칙은 기존 helper와 같은 결과를 봐야 한다. */
test("classifyPaidPayments 결과를 그대로 받은 경우와 같다", () => {
  const cases: Payment[][] = [
    [],
    [payment()],
    [payment({ cancelExecutionStatus: "unknown" })],
    [payment({ cancelExecutionStatus: "declined" })],
    [payment(), payment({ id: "pay-2" })],
    // 승인되지 않은 결제가 섞여 있어도 기존 helper가 걸러 준다.
    [payment(), payment({ id: "pay-3", status: "cancelled" as PaymentStatus })],
  ];
  for (const payments of cases) {
    assert.equal(
      projectRefundExecution(payments),
      projectRefundExecutionFromLookup(classifyPaidPayments(payments)),
    );
  }
});

/** 실행 단계 값이 늘어나면 여기서 먼저 걸리도록 모든 값을 훑는다. */
test("실행 단계 네 값과 없음이 모두 한 갈래로 매핑된다", () => {
  const expected: Record<PaymentCancelExecutionStatus | "none", string> = {
    none: "executable",
    processing: "recoverable",
    unknown: "recoverable",
    succeeded: "recoverable",
    declined: "manual-review",
  };
  for (const [key, value] of Object.entries(expected)) {
    const execution = key === "none" ? null : (key as PaymentCancelExecutionStatus);
    assert.equal(projectRefundExecution([payment({ cancelExecutionStatus: execution })]), value);
  }
});
