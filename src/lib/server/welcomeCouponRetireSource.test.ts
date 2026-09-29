/**
 * 가입 안내 쿠폰 정리 테스트 (Coupon-Code-v1 legacy welcome).
 *
 * 실행: node --test src/lib/server/welcomeCouponRetireSource.test.ts
 *
 * store.ts와 route.ts는 DB 드라이버를 거쳐 들어오므로 import하지 않고 원문을 글자로 읽는다.
 * 감추는 규칙 자체는 아래에서 같은 식으로 직접 확인한다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const STORE = read("./store.ts");
const APP_ROUTE = read("../../app/api/app/route.ts");
const MY_COUPONS = read("../../app/my/coupons/page.tsx");

test("신규 회원의 쿠폰함은 비어 있다", () => {
  const start = STORE.indexOf("export function registerUser");
  assert.notEqual(start, -1, "registerUser가 store.ts에 없다");
  const block = STORE.slice(start, STORE.indexOf("\n}", start));
  assert.match(block, /data\.coupons\[user\.id\] = \[\];/);
});

test("registerUser와 호출 구조는 그대로다", () => {
  // 동의·약관 관문이 회원 생성보다 앞이라는 기존 테스트가 이 이름을 기준으로 삼는다.
  assert.match(STORE, /export function registerUser/);
  assert.equal((APP_ROUTE.match(/registerUser\(/g) ?? []).length, 2);
});

test("일반 가입 경로도 빈 쿠폰함으로 시작한다", () => {
  assert.match(APP_ROUTE, /data\.coupons\[user\.id\] = \[\];/);
});

test("안내 쿠폰을 만드는 코드가 남아 있지 않다", () => {
  assert.equal(/welcomeCoupon/.test(STORE), false);
  assert.equal(/welcomeCoupon/.test(APP_ROUTE), false);
});

/** my/coupons/page.tsx에 적힌 것과 같은 판정식. 기준이 바뀌면 이 테스트가 먼저 깨진다. */
function isLegacyWelcome(coupon: { product?: string; title: string; desc: string }): boolean {
  return (
    !coupon.product &&
    coupon.title === "첫 방문 안내" &&
    coupon.desc === "신청과 상담 진행을 우선 안내해 드립니다."
  );
}

const LEGACY = { title: "첫 방문 안내", desc: "신청과 상담 진행을 우선 안내해 드립니다." };

test("세 조건이 모두 맞을 때만 감춘다", () => {
  assert.equal(isLegacyWelcome(LEGACY), true);
  // 같은 제목이라도 상품이 붙은 진짜 쿠폰은 감추지 않는다.
  assert.equal(isLegacyWelcome({ ...LEGACY, product: "story" }), false);
  // 상품이 없어도 문구가 다르면 감추지 않는다.
  assert.equal(isLegacyWelcome({ title: "첫 방문 안내", desc: "다른 안내" }), false);
  assert.equal(isLegacyWelcome({ title: "다른 안내", desc: LEGACY.desc }), false);
});

test("화면이 거른 목록으로 카드와 빈 상태를 함께 정한다", () => {
  assert.match(MY_COUPONS, /const visibleCoupons = coupons\.filter/);
  assert.match(MY_COUPONS, /visibleCoupons\.length === 0/);
  assert.match(MY_COUPONS, /\{visibleCoupons\.map\(/);
  // 원본 목록으로 다시 그리면 감춘 항목이 되살아난다.
  assert.equal(/\{coupons\.map\(/.test(MY_COUPONS), false);
});
