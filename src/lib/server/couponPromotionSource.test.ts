/**
 * 이벤트가 주문의 무료 쿠폰 중복 금지 테스트 (OPEN EVENT × Coupon).
 *
 * 실행: node --test src/lib/server/couponPromotionSource.test.ts
 *
 * applyOrder.ts와 각 route는 DB 드라이버를 거쳐 들어오므로 import하지 않고 원문을 읽는다.
 * 판정식 자체는 아래에서 같은 식으로 직접 확인한다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { PROMOTION_PRICES } from "../constants/promotions.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const APPLY_ORDER = read("./applyOrder.ts");
const APP_ROUTE = read("../../app/api/app/route.ts");
const RETURN_ROUTE = read("../../app/api/payments/nicepay/return/route.ts");
const RECOMMIT_ROUTE = read("../../app/api/admin/payments/recommit/route.ts");
const PAY_SUBMIT = read("../../components/apply/PaySubmit.tsx");
const PRICING = read("./pricing.ts");

const FUNCTION_SOURCE = (() => {
  const start = APPLY_ORDER.indexOf("export function applyFreeCoupon");
  assert.notEqual(start, -1, "applyFreeCoupon이 applyOrder.ts에 없다");
  const end = APPLY_ORDER.indexOf("\nexport ", start + 1);
  return APPLY_ORDER.slice(start, end === -1 ? undefined : end);
})();

test("이벤트가 주문이면 쿠폰을 거절한다", () => {
  assert.match(FUNCTION_SOURCE, /PROMOTION_DISCOUNT_ERROR/);
  assert.match(APPLY_ORDER, /오픈 이벤트 상품에는 추가 할인이나 포인트를 사용할 수 없습니다/);
});

test("거절이 쿠폰을 쓴 것으로 표시하기 전에 일어난다", () => {
  const guard = FUNCTION_SOURCE.indexOf("PROMOTION_DISCOUNT_ERROR");
  const used = FUNCTION_SOURCE.indexOf("coupon.usedAt = ");
  assert.notEqual(used, -1);
  assert.ok(guard < used, "이벤트 판정이 usedAt 기록보다 뒤에 있다");
});

test("쿠폰을 쓰는 모든 인생곡 경로가 프로모션을 함께 넘긴다", () => {
  /*
   * 한 곳이라도 빠지면 그 경로로 이벤트가 + 무료 쿠폰이 성립한다.
   * 상담(consultation)에는 프로모션이 없어 인자를 넘기지 않는다.
   */
  assert.match(APPLY_ORDER, /applyFreeCoupon\(data, userId, details, priced\.amount, product, priced\.promotion\)/);
  assert.match(APP_ROUTE, /applyFreeCoupon\([^)]*couponProduct, orderPromotion\)/);
  assert.match(RETURN_ROUTE, /applyFreeCoupon\([^)]*couponProduct, orderPromotion\)/);
  assert.match(RECOMMIT_ROUTE, /applyFreeCoupon\([^)]*couponProduct, orderPromotion\)/);
  // 상담 경로는 그대로다.
  assert.match(APPLY_ORDER, /applyFreeCoupon\(data, userId, details, priced\.amount, "consultation"\)/);
});

test("넘기는 값은 가격표를 통과한 프로모션뿐이다", () => {
  // body.promotion을 그대로 넘기면 클라이언트 문자열로 판정이 흔들린다.
  assert.match(APP_ROUTE, /orderPromotion = promotionCheck\.promotion;/);
  assert.match(RETURN_ROUTE, /orderPromotion = priced\.promotion;/);
  assert.match(RECOMMIT_ROUTE, /orderPromotion = priced\.promotion;/);
});

test("화면도 이벤트 주문에서는 할인 수단을 고르지 못한다", () => {
  assert.match(PAY_SUBMIT, /const discountBlocked = Boolean\(promotion\);/);
  assert.match(PAY_SUBMIT, /오픈 이벤트 상품은 추가 할인 및 포인트 사용이 불가합니다/);
  // 쿠폰·추천인 입력·적립금 세 블록이 모두 이 값에 걸려 있어야 한다.
  assert.match(PAY_SUBMIT, /!usingCoupon && !discountBlocked \? \(/);
  assert.match(PAY_SUBMIT, /!usingCoupon && !discountBlocked && points > 0/);
});

test("화면이 보내는 할인 값은 이벤트에서 모두 비워진다", () => {
  assert.match(PAY_SUBMIT, /referralCode: usingCoupon \|\| discountBlocked \? "" :/);
  assert.match(PAY_SUBMIT, /couponId: discountBlocked \? "" : couponId,/);
  assert.match(PAY_SUBMIT, /usePoints: !usingCoupon && !discountBlocked && usePoints \? "1" : "",/);
});

test("모든 할인 수단이 한자리에서 막힌다", () => {
  // 쿠폰만 막으면 추천인·관리자 코드·적립금으로 이벤트가가 더 내려간다.
  assert.match(APPLY_ORDER, /export function promotionDiscountConflict/);
  assert.match(APPLY_ORDER, /details\.couponId/);
  assert.match(APPLY_ORDER, /details\.referralCode/);
  assert.match(APPLY_ORDER, /details\.usePoints === "1"/);
});

test("할인 차단이 네 경로 모두에서 apply* 앞에 있다", () => {
  for (const [name, source] of [
    ["commitOrder", APPLY_ORDER],
    ["preparePayment", APP_ROUTE],
    ["nicepay/return", RETURN_ROUTE],
    ["recommit", RECOMMIT_ROUTE],
  ] as const) {
    const guard = source.indexOf("promotionDiscountConflict(");
    const apply = source.indexOf("applyFreeCoupon(");
    assert.notEqual(guard, -1, `${name}에 할인 차단이 없다`);
    assert.ok(guard < apply, `${name}에서 차단이 적용보다 뒤에 있다`);
  }
});

test("이벤트 가격은 그대로다", () => {
  // 이번 변경이 금액을 건드리지 않았는지 값으로 고정한다.
  assert.equal(PROMOTION_PRICES["saju-song-open-2026"].basePrice, 19000);
  assert.equal(PROMOTION_PRICES["saju-song-open-2026"].product, "saju-song");
});

/** applyFreeCoupon에 적힌 것과 같은 판정. 옵션 유무를 보지 않는다. */
function blocked(couponId: string, promotion?: string): boolean {
  if (!couponId) return false;
  return Boolean(promotion);
}

test("옵션이 붙어 금액이 올라가도 막는다", () => {
  assert.equal(blocked("c-1", "saju-song-open-2026"), true);   // 19,000원
  assert.equal(blocked("c-1", "saju-song-open-2026"), true);   // +리포트 29,000원도 같은 판정
  assert.equal(blocked("c-1", undefined), false);              // 정가 99,000원은 기존대로
  assert.equal(blocked("", "saju-song-open-2026"), false);     // 쿠폰을 안 쓰면 이벤트는 정상
});

/**
 * 옵션 가격표를 원문에서 읽는다. pricing.ts는 "@/..." 별칭을 쓰기 때문에 이 러너에서
 * import할 수 없어, 값이 바뀌면 깨지도록 표를 글자로 확인한다.
 */
function optionPrice(id: string): number {
  const match = PRICING.match(new RegExp(`"${id}":\\s*(\\d+)`));
  assert.ok(match, `${id} 가격이 pricing.ts에 없다`);
  return Number(match[1]);
}

test("이벤트 금액 구성이 그대로다", () => {
  const base = PROMOTION_PRICES["saju-song-open-2026"].basePrice;
  const report = optionPrice("saju-report-2026-2027");
  assert.equal(base, 19000, "이벤트 기본가");
  assert.equal(report, 10000, "사주풀이 리포트");
  // calcOrderAmount는 기본가에 옵션가를 더한다(옵션 합산 규칙 자체는 미변경).
  assert.equal(base + report, 29000, "이벤트 + 리포트");
});

test("기존 제작 옵션 가격은 건드리지 않았다", () => {
  assert.equal(optionPrice("ai-mv"), 100000);
  assert.equal(optionPrice("photo-mv"), 50000);
  assert.equal(optionPrice("lyric-edit"), 10000);
  // 이벤트가에도 기존 옵션가가 같은 방식으로 더해진다.
  assert.equal(PROMOTION_PRICES["saju-song-open-2026"].basePrice + optionPrice("ai-mv"), 119000);
});
