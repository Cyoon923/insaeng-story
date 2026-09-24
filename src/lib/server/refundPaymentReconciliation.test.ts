/**
 * 결제 취소 대조 테스트 (Refund-Payment-Reconciliation-1).
 *
 * 실행: node --test src/lib/server/refundPaymentReconciliation.test.ts
 *
 * 순수 함수라 DB도 네트워크도 필요 없다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  readWonAmount,
  reconcileRefundPaymentCancel,
} from "./refundPaymentReconciliation.ts";
import type { NicepayPaymentInquiryOutcome } from "./nicepayPaymentInquiry.ts";
import type { Payment } from "@/lib/types/app";

const MERCHANT_ORDER_ID = "is-abc";
/** 내부 주문 id. NICEPAY는 이 값을 모른다(applyOrder.ts의 `o-` 접두사). */
const ORDER_ID = `o-${MERCHANT_ORDER_ID}`;
const TID = "tid-1";

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "pay-1",
    orderId: ORDER_ID,
    provider: "nicepay",
    merchantOrderId: MERCHANT_ORDER_ID,
    pgTid: TID,
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
    cancelAttemptedAt: "2026-09-17T00:00:00.000Z",
    cancelResultKind: "succeeded",
    cancelResultCode: "2001",
    cancelResultMessage: "취소되었습니다.",
    cancelResponseRaw: { resultCode: "2001" },
    cancelExecutionStatus: "succeeded",
    cancelClaimedAt: "2026-09-17T00:00:00.000Z",
    ...overrides,
  };
}

function found(
  overrides: Partial<NonNullable<Extract<NicepayPaymentInquiryOutcome, { kind: "found" }>>["result"]> = {},
): NicepayPaymentInquiryOutcome {
  return {
    kind: "found",
    result: {
      resultCode: "0000",
      tid: TID,
      // 결제창에 넘긴 값이 그대로 돌아온다(client/nicepay.ts). 내부 주문 id가 아니다.
      orderId: MERCHANT_ORDER_ID,
      status: "cancelled",
      amount: 100000,
      cancelledAmt: 100000,
      balanceAmt: 0,
      cancelledAt: "2026-09-17T09:00:00+09:00",
      ...overrides,
    },
    raw: { resultCode: "0000" },
    httpStatus: 200,
  };
}

/* ── 정상 확정 ───────────────────────────────────────── */

test("성공 기록 + 완전 일치 조회 → 전액취소 확정", () => {
  const result = reconcileRefundPaymentCancel(payment(), found());
  assert.deepEqual(result, {
    kind: "verified-full-cancel",
    source: "normal",
    paymentId: "pay-1",
    orderId: ORDER_ID,
    tid: TID,
    approvedAmount: 100000,
    verifiedCancelledAmount: 100000,
    pgCancelledAt: "2026-09-17T09:00:00+09:00",
  });
  // 응답 원문을 통째로 복제하지 않는다.
  assert.equal("raw" in result, false);
});

test("PG 취소 시각이 없으면 지어내지 않는다", () => {
  const result = reconcileRefundPaymentCancel(payment(), found({ cancelledAt: undefined }));
  assert.equal(result.kind, "verified-full-cancel");
  if (result.kind !== "verified-full-cancel") return;
  assert.equal(result.pgCancelledAt, null);
});

/* ── 복구 경로 ───────────────────────────────────────── */

test("결과 불명이던 건은 복구로 구분해 확정한다", () => {
  const result = reconcileRefundPaymentCancel(
    payment({ cancelExecutionStatus: "unknown", cancelResultKind: "unknown" }),
    found(),
  );
  assert.equal(result.kind, "verified-full-cancel");
  if (result.kind !== "verified-full-cancel") return;
  assert.equal(result.source, "recovered-unknown");
});

test("선점만 남은 건은 별도 복구로 구분해 확정한다", () => {
  const result = reconcileRefundPaymentCancel(
    payment({
      cancelExecutionStatus: "processing",
      cancelResultKind: null,
      cancelAttemptedAt: null,
    }),
    found(),
  );
  assert.equal(result.kind, "verified-full-cancel");
  if (result.kind !== "verified-full-cancel") return;
  assert.equal(result.source, "recovered-stale-claim");
});

/* ── 내부/PG 사실 충돌 ───────────────────────────────── */

test("거절로 기록됐는데 PG는 취소되었다면 사람이 본다", () => {
  const result = reconcileRefundPaymentCancel(
    payment({ cancelExecutionStatus: "declined", cancelResultKind: "declined" }),
    found(),
  );
  assert.deepEqual(result, { kind: "manual-review", reason: "declined-but-pg-cancelled" });
});

test("시도한 적 없는데 PG는 취소되었다면 사람이 본다", () => {
  const result = reconcileRefundPaymentCancel(
    payment({ cancelExecutionStatus: null, cancelResultKind: null, cancelAttemptedAt: null }),
    found(),
  );
  assert.deepEqual(result, { kind: "manual-review", reason: "no-cancel-attempt" });
});

test("내부 상태가 전액취소를 말할 수 없는 상태면 확정하지 않는다", () => {
  assert.deepEqual(reconcileRefundPaymentCancel(payment({ status: "cancelled" }), found()), {
    kind: "manual-review",
    reason: "internal-not-paid",
  });
  assert.deepEqual(reconcileRefundPaymentCancel(payment({ cancelledAmount: 1000 }), found()), {
    kind: "manual-review",
    reason: "internal-already-cancelled",
  });
  for (const bad of [null, 0, -100, 1000.5]) {
    assert.deepEqual(
      reconcileRefundPaymentCancel(payment({ approvedAmount: bad as number | null }), found()),
      { kind: "manual-review", reason: "internal-amount-invalid" },
      String(bad),
    );
  }
});

/* ── 같은 거래인지 ───────────────────────────────────── */

test("거래 번호·주문 id가 어긋나면 확정하지 않는다", () => {
  const cases: [Payment, NicepayPaymentInquiryOutcome, string][] = [
    [payment({ pgTid: null }), found(), "missing-internal-tid"],
    [payment({ pgTid: "   " }), found(), "missing-internal-tid"],
    [payment(), found({ tid: undefined }), "missing-inquiry-tid"],
    [payment(), found({ tid: "tid-다름" }), "tid-mismatch"],
    [payment({ orderId: null }), found(), "missing-internal-order-id"],
    [payment(), found({ orderId: undefined }), "missing-inquiry-order-id"],
    [payment(), found({ orderId: "is-다름" }), "order-id-mismatch"],
  ];
  for (const [item, inquiry, reason] of cases) {
    assert.deepEqual(
      reconcileRefundPaymentCancel(item, inquiry),
      { kind: "manual-review", reason },
      reason,
    );
  }
});

test("상담 결제(c- 내부 주문 id)도 결제창 주문번호로 대조하고 내부 id를 돌려준다", () => {
  const result = reconcileRefundPaymentCancel(
    payment({ orderId: `c-${MERCHANT_ORDER_ID}` }),
    found(),
  );
  assert.equal(result.kind, "verified-full-cancel");
  // 비교는 merchantOrderId로 하고, 반환은 최종화가 쓰는 내부 주문 id 그대로다.
  assert.equal(
    result.kind === "verified-full-cancel" ? result.orderId : null,
    `c-${MERCHANT_ORDER_ID}`,
  );
});

/* ── PG 상태 ─────────────────────────────────────────── */

test("PG가 취소 상태가 아니면 확정하지 않는다", () => {
  for (const status of ["paid", "ready", "failed", "무엇인가", undefined]) {
    assert.deepEqual(
      reconcileRefundPaymentCancel(payment(), found({ status })),
      { kind: "not-verified", reason: "pg-not-cancelled" },
      String(status),
    );
  }
});

test("부분취소를 전액취소로 올리지 않는다", () => {
  assert.deepEqual(
    reconcileRefundPaymentCancel(payment(), found({ status: "partialCancelled" })),
    { kind: "not-verified", reason: "pg-partial-cancelled" },
  );
});

/* ── 금액 ────────────────────────────────────────────── */

test("금액이 어긋나면 확정하지 않는다", () => {
  const cases: [Parameters<typeof found>[0], string][] = [
    [{ cancelledAmt: 90000 }, "cancelled-amount-mismatch"],
    [{ balanceAmt: 10000 }, "balance-remaining"],
    [{ amount: 120000 }, "approved-amount-mismatch"],
  ];
  for (const [overrides, reason] of cases) {
    assert.deepEqual(
      reconcileRefundPaymentCancel(payment(), found(overrides)),
      { kind: "manual-review", reason },
      reason,
    );
  }
});

test("금액을 숫자로 읽을 수 없으면 확정하지 않는다", () => {
  for (const bad of [Number.NaN, -1, 100.5, "10만원", "", {}]) {
    assert.deepEqual(
      reconcileRefundPaymentCancel(
        payment(),
        found({ cancelledAmt: bad as unknown as number }),
      ),
      { kind: "manual-review", reason: "pg-amount-invalid" },
      String(bad),
    );
  }
});

test("전액취소를 뒷받침할 금액 근거가 없으면 확정하지 않는다", () => {
  assert.deepEqual(
    reconcileRefundPaymentCancel(
      payment(),
      found({ cancelledAmt: undefined, balanceAmt: undefined }),
    ),
    { kind: "not-verified", reason: "missing-amount-evidence" },
  );
  // 승인 금액만 맞는 것으로는 부족하다.
  assert.deepEqual(
    reconcileRefundPaymentCancel(
      payment(),
      found({ amount: 100000, cancelledAmt: undefined, balanceAmt: undefined }),
    ),
    { kind: "not-verified", reason: "missing-amount-evidence" },
  );
});

test("근거가 하나만 있어도 그 값이 맞으면 확정한다", () => {
  assert.equal(
    reconcileRefundPaymentCancel(payment(), found({ balanceAmt: undefined })).kind,
    "verified-full-cancel",
  );
  assert.equal(
    reconcileRefundPaymentCancel(payment(), found({ cancelledAmt: undefined })).kind,
    "verified-full-cancel",
  );
});

test("문자열로 온 금액도 정확히 비교한다", () => {
  const result = reconcileRefundPaymentCancel(
    payment(),
    found({
      amount: "100000" as unknown as number,
      cancelledAmt: "100000" as unknown as number,
      balanceAmt: "0" as unknown as number,
    }),
  );
  assert.equal(result.kind, "verified-full-cancel");

  // 값이 다르면 문자열이어도 걸러진다.
  assert.deepEqual(
    reconcileRefundPaymentCancel(
      payment(),
      found({ cancelledAmt: "99999" as unknown as number }),
    ),
    { kind: "manual-review", reason: "cancelled-amount-mismatch" },
  );
});

test("원 단위 금액 읽기 규칙", () => {
  assert.equal(readWonAmount(100000), 100000);
  assert.equal(readWonAmount(0), 0);
  assert.equal(readWonAmount("100000"), 100000);
  assert.equal(readWonAmount(" 100000 "), 100000);
  // 소수점·음수·비숫자는 허용 오차 없이 거절한다.
  assert.equal(readWonAmount(100000.4), null);
  assert.equal(readWonAmount(-1), null);
  assert.equal(readWonAmount("100,000"), null);
  assert.equal(readWonAmount("1e5"), null);
  assert.equal(readWonAmount(Number.NaN), null);
  assert.equal(readWonAmount(undefined), null);
  assert.equal(readWonAmount(null), null);
});

/* ── 조회 실패 ───────────────────────────────────────── */

test("조회하지 못했으면 확정하지 않는다", () => {
  const unknown: NicepayPaymentInquiryOutcome = {
    kind: "unknown",
    message: "거래 정보를 확인하는 중입니다.",
    raw: null,
    httpStatus: null,
  };
  const result = reconcileRefundPaymentCancel(payment(), unknown);
  assert.deepEqual(result, { kind: "not-verified", reason: "inquiry-unknown" });
  // PG 원문 메시지를 결과에 담지 않는다.
  assert.equal(JSON.stringify(result).includes("거래 정보를"), false);
});

test("거래를 찾지 못했으면 사람이 본다(재취소 신호가 아니다)", () => {
  const notFound: NicepayPaymentInquiryOutcome = {
    kind: "not-found",
    raw: null,
    httpStatus: 404,
  };
  const result = reconcileRefundPaymentCancel(payment(), notFound);
  assert.deepEqual(result, { kind: "manual-review", reason: "inquiry-not-found" });
  // 다시 취소하라는 신호를 담지 않는다.
  assert.equal(JSON.stringify(result).includes("retry"), false);
});

test("어떤 경우에도 입력을 바꾸지 않는다", () => {
  const item = payment();
  const snapshot = JSON.stringify(item);
  reconcileRefundPaymentCancel(item, found());
  reconcileRefundPaymentCancel(item, found({ status: "paid" }));
  assert.equal(JSON.stringify(item), snapshot);
});
