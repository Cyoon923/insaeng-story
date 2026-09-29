/**
 * 무료 쿠폰 0원 주문·상담 결제 없는 취소 완료 테스트 (Refund-Free-Coupon-Zero-Complete-1).
 *
 * 실행: node --test src/lib/server/freeCouponRefund.test.ts
 *
 * DB도 PG도 부르지 않는다. 판정은 순수 함수로, 실행 분기는 가짜 deps로 본다.
 * 저장 한 문장(잠금·NOT EXISTS·COALESCE)의 실제 DB 동작은 freeCouponRefund.test.sql에서 본다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { decideFreeCouponRefund, storedOptionIds } from "./freeCouponRefund.ts";
import type {
  FreeCouponRefundFacts,
  FreeCouponRefundOrder,
  FreeCouponRefundResult,
} from "./freeCouponRefund.ts";
import { executeApprovedRefund, FREE_COUPON_COMPLETED_MESSAGE } from "./refundExecuteAdminApi.ts";
import type { ExecuteApprovedRefundDeps } from "./refundExecuteAdminApi.ts";
import type { RefundExecutionGateResult } from "./refundExecutionGate.ts";
import type { RefundPaymentNormalFinalizeResult } from "./refundPaymentNormalFinalize.ts";

/** story 정가 149,000원, 옵션 없음. 무료 쿠폰으로 0원이 된 주문. */
function storyFacts(
  overrides: Partial<FreeCouponRefundOrder> = {},
  rest: Partial<FreeCouponRefundFacts> = {},
): FreeCouponRefundFacts {
  return {
    order: {
      id: "mabc123-x1y2z3",
      product: "story",
      amount: 0,
      baseAmount: 149000,
      payment: "무료 쿠폰",
      details: { couponId: "cp-1", couponTitle: "인생곡 무료 쿠폰", couponFree: "1", optionIds: "" },
      ...overrides,
    },
    linkedPaymentCount: 0,
    recalculatedBaseAmount: 149000,
    ...rest,
  };
}

/** 상담 기본가 + 리포트 옵션. 무료 쿠폰으로 0원이 된 상담 주문. */
function consultationFacts(): FreeCouponRefundFacts {
  return {
    order: {
      id: "c-mabc123-x1y2z3",
      product: "consultation",
      amount: 0,
      baseAmount: 120000,
      payment: "무료 쿠폰",
      details: {
        couponId: "cp-2",
        couponFree: "1",
        optionIds: "report",
        teacher: "유비 선생",
        datetime: "8월 12일(화) 오전 10:00",
      },
    },
    linkedPaymentCount: 0,
    recalculatedBaseAmount: 120000,
  };
}

function withDetails(patch: Record<string, string | undefined>): FreeCouponRefundFacts {
  const base = storyFacts();
  const details = { ...base.order!.details };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete details[key];
    else details[key] = value;
  }
  return storyFacts({ details });
}

function reasonOf(facts: FreeCouponRefundFacts): string {
  const decision = decideFreeCouponRefund(facts);
  assert.equal(decision.kind, "ineligible");
  return decision.kind === "ineligible" ? decision.reason : "";
}

/* ── 판정 ─────────────────────────────────────────── */

test("A. 무료 쿠폰 0원 Order → 정상 판정", () => {
  assert.deepEqual(decideFreeCouponRefund(storyFacts()), {
    kind: "eligible",
    orderId: "mabc123-x1y2z3",
    couponId: "cp-1",
    baseAmount: 149000,
  });
});

test("B. 무료 쿠폰 0원 Consultation → 정상 판정", () => {
  const decision = decideFreeCouponRefund(consultationFacts());
  assert.equal(decision.kind, "eligible");
});

test("C. amount > 0 → 거절", () => {
  assert.equal(reasonOf(storyFacts({ amount: 1 })), "amount-not-zero");
  assert.equal(reasonOf(storyFacts({ amount: 149000 })), "amount-not-zero");
});

test("D. Payment 존재 → 거절 (상태 무관 전체 건수)", () => {
  assert.equal(reasonOf(storyFacts({}, { linkedPaymentCount: 1 })), "payment-exists");
  assert.equal(reasonOf(storyFacts({}, { linkedPaymentCount: Number.NaN })), "payment-exists");
});

test("D-2. 결제 흐름이 만든 주문 id(o-is-/c-is-) → 거절 (유실·미연결·재접수 의심)", () => {
  assert.equal(reasonOf(storyFacts({ id: "o-is-abc" })), "payment-derived-order");
  assert.equal(reasonOf(storyFacts({ id: "c-is-abc" })), "payment-derived-order");
});

test("E. couponId 없음 → 거절", () => {
  assert.equal(reasonOf(withDetails({ couponId: undefined })), "coupon-id-missing");
  assert.equal(reasonOf(withDetails({ couponId: "  " })), "coupon-id-missing");
});

test("F. couponFree !== '1' → 거절", () => {
  assert.equal(reasonOf(withDetails({ couponFree: undefined })), "coupon-free-missing");
  assert.equal(reasonOf(withDetails({ couponFree: "true" })), "coupon-free-missing");
});

test("G. order.payment !== '무료 쿠폰' → 거절", () => {
  assert.equal(reasonOf(storyFacts({ payment: "적립금" })), "payment-label-mismatch");
  assert.equal(reasonOf(storyFacts({ payment: "신용/체크카드" })), "payment-label-mismatch");
});

test("H. baseAmount 없음(옛 주문) → 거절", () => {
  assert.equal(reasonOf(storyFacts({ baseAmount: undefined })), "base-amount-missing");
  assert.equal(reasonOf(storyFacts({ baseAmount: 0 })), "base-amount-missing");
  assert.equal(reasonOf(storyFacts({ baseAmount: 1.5 })), "base-amount-missing");
});

test("I. baseAmount 재계산 불일치·재계산 불가 → 거절", () => {
  assert.equal(reasonOf(storyFacts({}, { recalculatedBaseAmount: 159000 })), "base-amount-mismatch");
  assert.equal(reasonOf(storyFacts({}, { recalculatedBaseAmount: null })), "base-amount-unverifiable");
});

test("J. pointsUsed 존재 → 거절 (적립금 0원은 이번 대상 아님)", () => {
  assert.equal(reasonOf(withDetails({ pointsUsed: "5000" })), "points-used");
  // 결제 수단이 적립금으로 찍힌 0원 주문도 들어오지 않는다.
  const pointsOnly = storyFacts({
    payment: "적립금",
    details: { usePoints: "1", pointsUsed: "149000", optionIds: "" },
  });
  assert.equal(decideFreeCouponRefund(pointsOnly).kind, "ineligible");
});

test("K. OPEN EVENT(promotion) → 거절", () => {
  assert.equal(reasonOf(withDetails({ promotion: "saju-song-open-2026" })), "promotion-order");
});

test("추천인·관리자 코드 흔적 → 거절", () => {
  assert.equal(reasonOf(withDetails({ referralCode: "IS000001" })), "referral-present");
  assert.equal(reasonOf(withDetails({ referralDiscount: "10000" })), "referral-present");
});

test("주문 없음 → 거절", () => {
  assert.equal(reasonOf({ order: null, linkedPaymentCount: 0, recalculatedBaseAmount: null }), "order-not-found");
});

test("저장된 옵션 id 읽기: 키 없음은 null, 빈 값은 옵션 없음", () => {
  assert.equal(storedOptionIds({ details: {} }), null);
  assert.deepEqual(storedOptionIds({ details: { optionIds: "" } }), []);
  assert.deepEqual(storedOptionIds({ details: { optionIds: "ai-mv,photo-mv" } }), ["ai-mv", "photo-mv"]);
});

/* ── 실행 분기 ───────────────────────────────────── */

const ALLOWED: RefundExecutionGateResult = {
  kind: "allowed",
  refundRequestId: "rr-1",
  orderId: "mabc123-x1y2z3",
  userId: "u-1",
};

const PAID_COMPLETED: RefundPaymentNormalFinalizeResult = {
  kind: "completed",
  paymentId: "pay-1",
  orderId: "o-is-abc",
  alreadyFinalized: false,
};

function harness(options: {
  gate?: RefundExecutionGateResult;
  free?: FreeCouponRefundResult;
}) {
  const calls: string[] = [];
  const deps: ExecuteApprovedRefundDeps = {
    authorize: async () => {
      calls.push("authorize");
      return options.gate ?? ALLOWED;
    },
    execute: async () => {
      calls.push("execute");
      return PAID_COMPLETED;
    },
    completeFreeCoupon: async (orderId) => {
      calls.push(`free:${orderId}`);
      return options.free ?? { kind: "not-applicable", reason: "amount-not-zero" };
    },
  };
  return { calls, deps };
}

test("정상 무료 쿠폰 건: 완료 응답, 유료 실행(NICEPAY·적립금 복원 포함) 0회", async () => {
  const { calls, deps } = harness({ free: { kind: "completed", alreadyCompleted: false } });
  const response = await executeApprovedRefund("rr-1", deps);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    ok: true,
    status: "completed",
    message: FREE_COUPON_COMPLETED_MESSAGE,
  });
  assert.match(FREE_COUPON_COMPLETED_MESSAGE, /PG 취소 없이/);
  assert.match(FREE_COUPON_COMPLETED_MESSAGE, /0원 주문 취소 완료/);
  // R: 적립금 복원은 execute(정상 완결 흐름) 안에만 있다. 그 흐름을 부르지 않는다.
  assert.deepEqual(calls, ["authorize", "free:mabc123-x1y2z3"]);
});

test("L. approved가 아닌 문의 → 무료 쿠폰 완료도 유료 실행도 없음", async () => {
  const { calls, deps } = harness({
    gate: { kind: "not-approved" },
    free: { kind: "completed", alreadyCompleted: false },
  });
  const response = await executeApprovedRefund("rr-1", deps);
  assert.equal(response.status, 409);
  assert.deepEqual(calls, ["authorize"]);
});

test("M. 반복 실행: 이미 completed면 gate에서 막혀 두 번째 완료가 없다", async () => {
  // 첫 실행 뒤 문의는 completed다. gate는 approved만 통과시킨다.
  const second = harness({ gate: { kind: "not-approved" } });
  const response = await executeApprovedRefund("rr-1", second.deps);
  assert.equal(response.status, 409);
  assert.deepEqual(second.calls, ["authorize"]);
});

test("M-2. 동시 실행으로 이미 끝나 있던 건 → 같은 완료 응답, 유료 실행 없음", async () => {
  const { calls, deps } = harness({ free: { kind: "completed", alreadyCompleted: true } });
  const response = await executeApprovedRefund("rr-1", deps);
  assert.equal(response.status, 200);
  assert.equal(calls.includes("execute"), false);
});

test("O. 저장 시점 조건 불일치(결제 행 생김 등) → 담당자 확인, 유료 실행 없음", async () => {
  const { calls, deps } = harness({ free: { kind: "not-completed" } });
  const response = await executeApprovedRefund("rr-1", deps);
  assert.equal(response.status, 409);
  assert.equal((response.body as { status?: string }).status, "manual-review-required");
  assert.equal(calls.includes("execute"), false);
});

test("판정·저장 예외 → 500, 유료 실행으로 넘기지 않음", async () => {
  const { calls, deps } = harness({});
  deps.completeFreeCoupon = async () => {
    calls.push("free");
    throw new Error("boom");
  };
  const response = await executeApprovedRefund("rr-1", deps);
  assert.equal(response.status, 500);
  assert.equal(calls.includes("execute"), false);
});

test("T. 무료 쿠폰 건이 아니면 기존 유료 흐름을 그대로 1회 탄다", async () => {
  const { calls, deps } = harness({ free: { kind: "not-applicable", reason: "amount-not-zero" } });
  const response = await executeApprovedRefund("rr-1", deps);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ok: true, status: "completed" });
  assert.deepEqual(calls, ["authorize", "free:mabc123-x1y2z3", "execute"]);
});

/* ── 원문 확인: 하지 않는 일 ─────────────────────── */

const SOURCE = readFileSync(new URL("./freeCouponRefund.ts", import.meta.url), "utf8");
/** 주석을 뺀 코드만. 주석에 적힌 "하지 않는 일" 문구에 걸리지 않게 한다. */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("NICEPAY·취소·복구 모듈을 부르지 않는다", () => {
  for (const name of ["nicepay", "cancelNicepayPayment", "claimPaymentCancellation", "runRefundPaymentNormalFinalize", "finalizeRefundPaymentCancel"]) {
    assert.equal(CODE.includes(name), false, name);
  }
});

test("P·Q. 쿠폰 usedAt·기한을 건드리지 않고 새 쿠폰을 만들지 않는다", () => {
  for (const name of ["usedAt", "expiresAt", "coupons", "giveCoupon", "writeData", "readData"]) {
    assert.equal(CODE.includes(name), false, name);
  }
});

test("R·U. 적립금 복원을 부르지 않는다", () => {
  for (const name of ["runRefundPointsRestore", "restoreOrderPointsOnce", "refundPointsRestore", "point_transactions"]) {
    assert.equal(CODE.includes(name), false, name);
  }
});

test("저장 한 문장: approved 잠금·활성 1건·NOT EXISTS 결제·COALESCE completed_at", () => {
  assert.match(CODE, /WHERE order_id = \$1 AND status = 'approved'\s+FOR UPDATE/);
  assert.match(CODE, /\(SELECT total FROM active_refunds\) = 1/);
  assert.match(CODE, /NOT EXISTS \(SELECT 1 FROM payments WHERE order_id = \$1\)/);
  assert.match(CODE, /completed_at = COALESCE\(completed_at, \$5::timestamptz\)/);
  // 바뀌는 테이블은 refund_requests 하나뿐이다.
  const updates = CODE.match(/UPDATE\s+(\w+)/g) ?? [];
  assert.deepEqual(updates.map((item) => item.split(/\s+/)[1]), ["refund_requests"]);
  // 주문·상담 진행 상태를 바꾸지 않는다.
  assert.equal(/UPDATE\s+orders/.test(CODE), false);
});

test("S. 상담 취소창·승인 구조를 바꾸지 않는다", () => {
  const transitions = readFileSync(new URL("./refundRequestTransitions.ts", import.meta.url), "utf8");
  // 사람이 approved → completed로 옮기는 길은 여전히 없다.
  assert.match(transitions, /approved: \[\],/);
  assert.equal(CODE.includes("cancel_window"), false);
  assert.equal(CODE.includes("scheduled_at_snapshot"), false);
});
