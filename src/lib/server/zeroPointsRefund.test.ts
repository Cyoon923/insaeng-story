/**
 * 적립금 전액 사용 0원 주문·상담 판정 테스트 (P1-09 1단계).
 *
 * 실행: node --test src/lib/server/zeroPointsRefund.test.ts
 *
 * 순수 판정만 본다. DB·가격표·PG를 부르지 않는다(재계산 금액은 facts로 넘긴다).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { decideZeroPointsRefund } from "./zeroPointsRefund.ts";
import type { ZeroPointsRefundFacts, ZeroPointsRefundOrder } from "./zeroPointsRefund.ts";

/** story 정가 149,000원, 옵션 없음. 적립금 149,000원으로 0원이 된 주문. */
function storyFacts(
  details: Record<string, string> = {},
  overrides: Partial<ZeroPointsRefundOrder> = {},
  rest: Partial<ZeroPointsRefundFacts> = {},
): ZeroPointsRefundFacts {
  return {
    order: {
      id: "mabc123-x1y2z3",
      product: "story",
      amount: 0,
      baseAmount: 149000,
      payment: "적립금",
      details: { optionIds: "", usePoints: "1", pointsUsed: "149000", ...details },
      ...overrides,
    },
    linkedPaymentCount: 0,
    recalculatedBaseAmount: 149000,
    ...rest,
  };
}

const reason = (facts: ZeroPointsRefundFacts) => {
  const decision = decideZeroPointsRefund(facts);
  return decision.kind === "eligible" ? "eligible" : decision.reason;
};

/* ── 대상 ─────────────────────────────────────────── */

test("적립금 전액 0원 Order -> eligible, 돌려줄 금액은 pointsUsed", () => {
  assert.deepEqual(decideZeroPointsRefund(storyFacts()), {
    kind: "eligible",
    orderId: "mabc123-x1y2z3",
    pointsUsed: 149000,
    baseAmount: 149000,
    referralDiscount: 0,
  });
});

test("적립금 전액 0원 Consultation(c- id, 옵션 포함) -> eligible", () => {
  const facts: ZeroPointsRefundFacts = {
    order: {
      id: "c-mabc123-x1y2z3",
      product: "consultation",
      amount: 0,
      baseAmount: 120000,
      payment: "적립금",
      details: { optionIds: "report", usePoints: "1", pointsUsed: "120000", teacher: "유비 선생" },
    },
    linkedPaymentCount: 0,
    recalculatedBaseAmount: 120000,
  };
  assert.equal(reason(facts), "eligible");
});

test("추천인 10,000원 + 적립금 나머지 -> eligible (pointsUsed = 재계산 - 할인)", () => {
  const decision = decideZeroPointsRefund(
    storyFacts({ referralCode: "R1", referralDiscount: "10000", referrerId: "u-r", pointsUsed: "139000" }),
  );
  assert.equal(decision.kind, "eligible");
  assert.equal(decision.kind === "eligible" && decision.pointsUsed, 139000);
  assert.equal(decision.kind === "eligible" && decision.referralDiscount, 10000);
});

test("관리자 코드 30% + 적립금 나머지 -> eligible", () => {
  // round(149000 * 0.3) = 44700, 남은 104300원을 적립금으로
  const facts = storyFacts({
    referralCode: "AD1234",
    referralDiscount: "44700",
    referralType: "admin",
    referralPercent: "30",
    pointsUsed: "104300",
  });
  assert.equal(reason(facts), "eligible");
});

/* ── 위조 방어 ─────────────────────────────────────── */

test("위조: 100% 관리자 코드로 이미 0원 + 클라이언트 pointsUsed -> 제외", () => {
  // applyPoints가 돌지 않아 클라이언트 값이 남은 주문. 결제수단 표시도 "적립금"이 된다.
  const facts = storyFacts({
    referralCode: "AD9999",
    referralDiscount: "149000",
    referralType: "admin",
    referralPercent: "100",
    pointsUsed: "149000",
  });
  assert.equal(reason(facts), "points-amount-mismatch");
});

test("위조: 100% 할인 + 작은 pointsUsed도 제외(재계산 - 할인 = 0)", () => {
  const facts = storyFacts({ referralCode: "AD9999", referralDiscount: "149000", pointsUsed: "1" });
  assert.equal(reason(facts), "points-amount-mismatch");
});

test("위조: pointsUsed를 실제보다 크게 -> 제외", () => {
  assert.equal(reason(storyFacts({ pointsUsed: "500000" })), "points-amount-mismatch");
});

test("위조: 저장된 baseAmount를 pointsUsed에 맞춰 올림 -> 재계산 불일치로 제외", () => {
  const facts = storyFacts({ pointsUsed: "500000" }, { baseAmount: 500000 });
  assert.equal(reason(facts), "base-amount-mismatch");
});

test("위조: referralCode 없이 referralDiscount/referrerId만 -> 제외", () => {
  assert.equal(reason(storyFacts({ referralDiscount: "0" })), "referral-inconsistent");
  assert.equal(reason(storyFacts({ referrerId: "u-x" })), "referral-inconsistent");
});

test("위조: referralCode는 있는데 referralDiscount 모양이 이상함 -> 제외", () => {
  for (const value of ["", "-1", "1e4", "10000.0", " 10000", "010000"]) {
    assert.equal(reason(storyFacts({ referralCode: "R1", referralDiscount: value })), "referral-inconsistent", value);
  }
});

test("pointsUsed 모양: 0·음수·소수·앞자리 0·공백·빈 값 -> 제외", () => {
  for (const value of ["0", "-149000", "149000.0", "0149000", " 149000", "", "1e5"]) {
    assert.equal(reason(storyFacts({ pointsUsed: value })), "points-used-invalid", value);
  }
  const missing = storyFacts();
  delete missing.order!.details.pointsUsed;
  assert.equal(reason(missing), "points-used-invalid");
});

test("usePoints !== '1' -> 제외", () => {
  assert.equal(reason(storyFacts({ usePoints: "" })), "use-points-missing");
  assert.equal(reason(storyFacts({ usePoints: "true" })), "use-points-missing");
});

/* ── 다른 흐름 대상 제외 ─────────────────────────────── */

test("무료 쿠폰 0원 -> 제외", () => {
  const facts = storyFacts({ couponId: "cp-1", couponFree: "1" }, { payment: "무료 쿠폰" });
  assert.equal(reason(facts), "payment-label-mismatch");
  // 표시가 "적립금"이어도 쿠폰 흔적이 있으면 제외
  assert.equal(reason(storyFacts({ couponId: "cp-1" })), "coupon-present");
  assert.equal(reason(storyFacts({ couponFree: "1" })), "coupon-present");
});

test("일부 적립금 + PG 결제 -> 제외 (amount > 0 / 결제 행 있음)", () => {
  assert.equal(reason(storyFacts({ pointsUsed: "49000" }, { amount: 100000, payment: "card" })), "amount-not-zero");
  assert.equal(reason(storyFacts({}, {}, { linkedPaymentCount: 1 })), "payment-exists");
});

test("결제 흐름이 만든 id(o-is- / c-is-) -> 제외", () => {
  assert.equal(reason(storyFacts({}, { id: "o-is-abc" })), "payment-derived-order");
  assert.equal(reason(storyFacts({}, { id: "c-is-abc" })), "payment-derived-order");
});

test("promotion 주문 -> 제외", () => {
  assert.equal(reason(storyFacts({ promotion: "open-event" })), "promotion-order");
});

test("결제수단 표시가 '적립금'이 아님 -> 제외", () => {
  assert.equal(reason(storyFacts({}, { payment: "" })), "payment-label-mismatch");
});

/* ── 근거 부족 fail-closed ───────────────────────────── */

test("주문 없음 / id 없음 -> 제외", () => {
  assert.equal(reason({ order: null, linkedPaymentCount: 0, recalculatedBaseAmount: null }), "order-not-found");
  assert.equal(reason(storyFacts({}, { id: "" })), "payment-derived-order");
});

test("결제 행 수가 정수가 아님 -> 제외", () => {
  assert.equal(reason(storyFacts({}, {}, { linkedPaymentCount: Number.NaN })), "payment-exists");
});

test("baseAmount 없음·0·소수 -> 제외", () => {
  assert.equal(reason(storyFacts({}, { baseAmount: undefined })), "base-amount-missing");
  assert.equal(reason(storyFacts({}, { baseAmount: 0 })), "base-amount-missing");
  assert.equal(reason(storyFacts({}, { baseAmount: 149000.5 })), "base-amount-missing");
});

test("재계산 불가(null) / 불일치 -> 제외", () => {
  assert.equal(reason(storyFacts({}, {}, { recalculatedBaseAmount: null })), "base-amount-unverifiable");
  assert.equal(reason(storyFacts({}, {}, { recalculatedBaseAmount: 159000 })), "base-amount-mismatch");
});

/* ── 구조 ─────────────────────────────────────────── */

test("순수 판정: 저장·PG·적립금 복원 모듈을 import하지 않는다", () => {
  const SOURCE = readFileSync(new URL("./zeroPointsRefund.ts", import.meta.url), "utf8");
  const imports = SOURCE.split("\n").filter((line) => /^import|import\(/.test(line.trim()));
  assert.deepEqual(
    imports.map((line) => line.trim()),
    [
      'import { recalculateBaseAmount } from "./freeCouponRefund.ts";',
      'import type { Order } from "@/lib/types/app";',
    ],
  );
});
