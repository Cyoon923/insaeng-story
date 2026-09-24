/**
 * 결제 취소 실행 흐름 테스트 (Refund-Payment-Cancel-Orchestration-1).
 *
 * 실행: node --test src/lib/server/refundPaymentCancellation.test.ts
 *
 * 실제 NICEPAY도 DB도 부르지 않는다. 바깥 기능을 가짜로 끼워 호출 횟수와 순서를 본다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  executeRefundPaymentCancellation,
  REFUND_CANCEL_REASON,
} from "./refundPaymentCancellation.ts";
import type { RefundPaymentCancellationDeps } from "./refundPaymentCancellation.ts";
import type { NicepayCancelOutcome } from "./nicepayCancel.ts";
import type { OrderPaymentLookup } from "./paymentLookup.ts";
import type { Payment } from "@/lib/types/app";

const ORDER_ID = "o-is-abc";

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "pay-1",
    orderId: ORDER_ID,
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
    raw: { resultCode: "0000", status: "paid" },
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

const SUCCESS: NicepayCancelOutcome = {
  kind: "succeeded",
  result: { resultCode: "2001", resultMsg: "취소성공", status: "cancelled", tid: "tid-1" },
  raw: { resultCode: "2001", status: "cancelled" },
  httpStatus: 200,
};

/** 호출 순서와 인자를 기록하는 가짜 구현 묶음. */
function harness(options: {
  lookup?: OrderPaymentLookup;
  claimOk?: boolean;
  outcome?: NicepayCancelOutcome | (() => never);
  record?: Payment | null | (() => never);
} = {}) {
  const calls: string[] = [];
  const cancelArgs: { tid: string; orderId: string; reason: string }[] = [];
  const recordArgs: Parameters<RefundPaymentCancellationDeps["recordPaymentCancelAttempt"]>[0][] =
    [];
  const claimed: string[] = [];

  const deps: RefundPaymentCancellationDeps = {
    findPaidPaymentForOrder: async () => {
      calls.push("lookup");
      return options.lookup ?? { kind: "single-paid-payment", payment: payment() };
    },
    claimPaymentCancellation: async (paymentId) => {
      calls.push("claim");
      claimed.push(paymentId);
      return options.claimOk === false
        ? { ok: false, reason: "not-claimable" }
        : { ok: true, payment: payment({ cancelExecutionStatus: "processing" }) };
    },
    cancelNicepayPayment: async (input) => {
      calls.push("cancel");
      cancelArgs.push(input);
      if (typeof options.outcome === "function") options.outcome();
      return typeof options.outcome === "function" ? SUCCESS : (options.outcome ?? SUCCESS);
    },
    recordPaymentCancelAttempt: async (input) => {
      calls.push("record");
      recordArgs.push(input);
      if (typeof options.record === "function") options.record();
      return options.record === undefined || typeof options.record === "function"
        ? payment({ cancelResultKind: input.kind, cancelExecutionStatus: input.kind })
        : options.record;
    },
  };
  return { deps, calls, cancelArgs, recordArgs, claimed };
}

test("결제 기록이 없으면 PG를 부르지 않는다", async () => {
  const h = harness({ lookup: { kind: "no-payment" } });
  const result = await executeRefundPaymentCancellation(ORDER_ID, h.deps);
  assert.deepEqual(result, { kind: "no-payment" });
  assert.deepEqual(h.calls, ["lookup"]);
});

test("승인 결제가 둘 이상이면 PG를 부르지 않는다", async () => {
  const h = harness({ lookup: { kind: "ambiguous", payments: [payment(), payment({ id: "pay-2" })] } });
  const result = await executeRefundPaymentCancellation(ORDER_ID, h.deps);
  assert.deepEqual(result, { kind: "ambiguous-payment" });
  assert.deepEqual(h.calls, ["lookup"]);
});

test("전액취소가 안전하지 않으면 선점도 PG 호출도 하지 않는다", async () => {
  const cases: [Partial<Payment>, string][] = [
    [{ pgTid: null }, "missing-tid"],
    [{ pgTid: "   " }, "missing-tid"],
    [{ approvedAmount: null }, "no-approved-amount"],
    [{ approvedAmount: 0 }, "no-approved-amount"],
    [{ cancelledAmount: 1000 }, "already-cancelled"],
  ];
  for (const [overrides, reason] of cases) {
    const h = harness({
      lookup: { kind: "single-paid-payment", payment: payment(overrides) },
    });
    const result = await executeRefundPaymentCancellation(ORDER_ID, h.deps);
    assert.deepEqual(result, { kind: "invalid-payment", reason }, reason);
    assert.deepEqual(h.calls, ["lookup"], reason);
  }
});

test("선점하지 못하면 PG를 부르지 않는다", async () => {
  const h = harness({ claimOk: false });
  const result = await executeRefundPaymentCancellation(ORDER_ID, h.deps);
  assert.deepEqual(result, { kind: "not-claimable" });
  // 선점까지만 하고 멈춘다. 되돌리거나 다시 시도하지 않는다.
  assert.deepEqual(h.calls, ["lookup", "claim"]);
});

test("정해진 순서로 한 번씩만 부른다", async () => {
  const h = harness();
  const result = await executeRefundPaymentCancellation(ORDER_ID, h.deps);
  assert.equal(result.kind, "succeeded");
  assert.deepEqual(h.calls, ["lookup", "claim", "cancel", "record"]);
  assert.equal(h.cancelArgs.length, 1, "PG는 한 번만 부른다");
  assert.deepEqual(h.claimed, ["pay-1"]);
});

test("PG에 보내는 사유는 서버 고정 문구다", async () => {
  const h = harness();
  await executeRefundPaymentCancellation(ORDER_ID, h.deps);
  assert.deepEqual(h.cancelArgs[0], {
    tid: "tid-1",
    orderId: ORDER_ID,
    reason: "사주로그 관리자 승인 환불",
  });
  assert.equal(REFUND_CANCEL_REASON, "사주로그 관리자 승인 환불");
  // 고객이 적은 글이나 주문 제목이 들어갈 자리가 아예 없다(인자가 orderId 하나뿐이다).
  assert.equal(executeRefundPaymentCancellation.length, 2);
});

test("성공 응답을 그대로 기록한다", async () => {
  const h = harness();
  const result = await executeRefundPaymentCancellation(ORDER_ID, h.deps);
  assert.equal(result.kind, "succeeded");
  assert.deepEqual(h.recordArgs[0], {
    paymentId: "pay-1",
    kind: "succeeded",
    resultCode: "2001",
    resultMessage: "취소성공",
    // PG 응답 전문은 넘기지 않는다. 키 자체가 없어야 한다.
  });
});

test("거절 응답도 한 번 기록한다", async () => {
  const declined: NicepayCancelOutcome = {
    kind: "declined",
    result: { resultCode: "2003", resultMsg: "취소 불가 거래", status: "paid" },
    message: "결제 취소가 완료되지 않았습니다.",
    raw: { resultCode: "2003" },
    httpStatus: 400,
  };
  const h = harness({ outcome: declined });
  const result = await executeRefundPaymentCancellation(ORDER_ID, h.deps);
  assert.equal(result.kind, "declined");
  assert.equal(h.recordArgs.length, 1);
  assert.equal(h.recordArgs[0].kind, "declined");
  assert.equal(h.recordArgs[0].resultCode, "2003");
});

test("불명 응답도 한 번 기록하고 다시 부르지 않는다", async () => {
  const unknown: NicepayCancelOutcome = {
    kind: "unknown",
    message: "취소 결과를 확인하는 중입니다.",
    raw: null,
    httpStatus: null,
  };
  const h = harness({ outcome: unknown });
  const result = await executeRefundPaymentCancellation(ORDER_ID, h.deps);
  assert.equal(result.kind, "unknown");
  assert.equal(h.cancelArgs.length, 1, "자동 재호출이 없어야 한다");
  assert.deepEqual(h.recordArgs[0], {
    paymentId: "pay-1",
    kind: "unknown",
    resultCode: null,
    resultMessage: "취소 결과를 확인하는 중입니다.",
    // 불명 응답에서도 전문을 넘기지 않는다.
  });
});

/**
 * 어떤 취소 결과에서도 PG 응답 전문을 저장 함수로 넘기지 않는다.
 * 넘기면 저장 함수가 그 값을 cancel_response_raw 열에 그대로 담는다.
 */
test("취소 결과와 무관하게 응답 전문을 기록 함수에 넘기지 않는다", async () => {
  const outcomes: NicepayCancelOutcome[] = [
    SUCCESS,
    {
      kind: "declined",
      result: { resultCode: "2003", resultMsg: "취소실패" },
      message: "취소실패",
      raw: { resultCode: "2003" },
      httpStatus: 200,
    },
    { kind: "unknown", message: "취소 결과를 확인하는 중입니다.", raw: { any: "value" }, httpStatus: 500 },
  ];
  for (const outcome of outcomes) {
    const h = harness({ outcome });
    await executeRefundPaymentCancellation(ORDER_ID, h.deps);
    assert.equal(h.recordArgs.length, 1);
    assert.equal("raw" in h.recordArgs[0], false, `${outcome.kind}에서 raw를 넘겼다`);
  }
});

test("기록이 적용되지 않으면 recording-failed이고 재호출하지 않는다", async () => {
  const h = harness({ record: null });
  const result = await executeRefundPaymentCancellation(ORDER_ID, h.deps);
  assert.deepEqual(result, { kind: "recording-failed" });
  assert.equal(h.cancelArgs.length, 1);
  assert.deepEqual(h.calls, ["lookup", "claim", "cancel", "record"]);
});

test("기록 중 오류가 나도 재호출하지 않는다", async () => {
  const h = harness({
    record: () => {
      throw new Error("db down");
    },
  });
  const result = await executeRefundPaymentCancellation(ORDER_ID, h.deps);
  assert.deepEqual(result, { kind: "recording-failed" });
  assert.equal(h.cancelArgs.length, 1);
});

test("PG 호출 중 오류가 나도 선점을 되돌리지 않는다", async () => {
  const h = harness({
    outcome: () => {
      throw new Error("network down");
    },
  });
  const result = await executeRefundPaymentCancellation(ORDER_ID, h.deps);
  assert.deepEqual(result, { kind: "recording-failed" });
  // 선점을 NULL로 되돌리는 호출이 없다(그런 기능 자체를 쓰지 않는다).
  assert.deepEqual(h.calls, ["lookup", "claim", "cancel"]);
  assert.equal(h.cancelArgs.length, 1);
});

test("결제 사실과 환불 문의 상태를 건드리지 않는다", async () => {
  const h = harness();
  const result = await executeRefundPaymentCancellation(ORDER_ID, h.deps);
  assert.equal(result.kind, "succeeded");
  if (result.kind !== "succeeded") return;
  // 승인 응답이 그대로 남아 있고 결제는 여전히 paid다.
  assert.deepEqual(result.payment.raw, { resultCode: "0000", status: "paid" });
  assert.equal(result.payment.status, "paid");
  assert.equal(result.payment.cancelledAmount, 0);
  assert.equal(result.payment.cancelledAt, null);
  // 이 흐름은 환불 문의를 바꾸는 기능을 아예 갖고 있지 않다.
  assert.equal("transitionRefundRequestByAdmin" in h.deps, false);
  assert.deepEqual(Object.keys(h.deps).sort(), [
    "cancelNicepayPayment",
    "claimPaymentCancellation",
    "findPaidPaymentForOrder",
    "recordPaymentCancelAttempt",
  ]);
});
