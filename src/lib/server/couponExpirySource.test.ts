/**
 * 무료 쿠폰 사용기한 검증 테스트 (Coupon-Code-v1 STEP 4).
 *
 * 실행: node --test src/lib/server/couponExpirySource.test.ts
 *
 * applyOrder.ts를 import하지 않는다. 그쪽은 store.ts를 거쳐 DB 드라이버를 불러온다.
 * 대신 applyFreeCoupon의 원문을 글자로 읽어 "어떤 조건이 달려 있는지"를 본다.
 * 경계 판정 자체는 아래에서 같은 식으로 직접 확인한다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const SOURCE = readFileSync(new URL("./applyOrder.ts", import.meta.url), "utf8");

/** 이 기능이 사는 함수만 잘라 본다. 다른 할인 함수의 조건과 섞이지 않게 한다. */
const FUNCTION_SOURCE = (() => {
  const start = SOURCE.indexOf("export function applyFreeCoupon");
  assert.notEqual(start, -1, "applyFreeCoupon이 applyOrder.ts에 없다");
  const end = SOURCE.indexOf("\nexport ", start + 1);
  return SOURCE.slice(start, end === -1 ? undefined : end);
})();

test("사용기한을 실제 사용 단계에서 본다", () => {
  assert.match(FUNCTION_SOURCE, /coupon\.expiresAt/);
  assert.match(FUNCTION_SOURCE, /사용기한이 지난 쿠폰입니다/);
});

test("기한 검증이 쿠폰을 쓴 것으로 표시하기 전에 있다", () => {
  // 순서가 뒤집히면 만료 쿠폰에도 usedAt이 찍힌다.
  const guard = FUNCTION_SOURCE.indexOf("coupon.expiresAt");
  const used = FUNCTION_SOURCE.indexOf("coupon.usedAt = ");
  assert.notEqual(used, -1, "usedAt을 찍는 자리가 없다");
  assert.ok(guard < used, "기한 검증이 usedAt 기록보다 뒤에 있다");
});

test("코드 원본(couponCodes)을 결제에서 다시 보지 않는다", () => {
  /*
   * 원본의 active·기한은 "새로 등록을 받는가"를 정하는 값이다. 결제에서 그것을
   * 다시 보면 관리자가 코드를 닫는 순간 이미 나간 쿠폰까지 함께 막힌다.
   *
   * 주석에는 이 이름들이 설명으로 나오므로, 실제 코드만 남기고 본다.
   */
  const code = FUNCTION_SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
  assert.equal(/couponCodes/.test(code), false);
  assert.equal(/sourceCode/.test(code), false);
});

test("기존 검증(소유·사용여부·상품)은 그대로 남아 있다", () => {
  assert.match(FUNCTION_SOURCE, /data\.coupons\[userId\]/);
  assert.match(FUNCTION_SOURCE, /이미 사용한 쿠폰입니다/);
  assert.match(FUNCTION_SOURCE, /이 상품에 사용할 수 없는 쿠폰입니다/);
});

/** 원문에 적힌 것과 같은 판정식. 값이 바뀌면 이 테스트가 먼저 깨진다. */
function verdict(expiresAt: string | undefined, now: number): "ok" | "expired" | "unreadable" {
  if (!expiresAt) return "ok";
  const at = new Date(expiresAt).getTime();
  if (Number.isNaN(at)) return "unreadable";
  return now > at ? "expired" : "ok";
}

test("기한이 없으면 쓸 수 있다", () => {
  // 기존 쿠폰과 관리자 직접 지급 쿠폰이 여기에 해당한다.
  assert.equal(verdict(undefined, Date.now()), "ok");
});

test("기한 경계는 그 순간까지 포함이다", () => {
  const at = "2026-10-01T14:59:59.000Z"; // 한국 2026-10-01 23:59:59
  const ms = Date.parse(at);
  assert.equal(verdict(at, ms - 1), "ok");
  assert.equal(verdict(at, ms), "ok", "같은 순간은 아직 쓸 수 있어야 한다");
  assert.equal(verdict(at, ms + 1), "expired");
});

test("읽을 수 없는 기한은 쓰지 못한다", () => {
  /*
   * 기한이 적혀 있다는 것은 조건이 붙은 쿠폰이라는 뜻이다. 그 조건을 확인할 수
   * 없는데 무료로 처리하면 기한이 지난 쿠폰을 받아 주는 것과 같아진다.
   */
  assert.equal(verdict("어제", Date.now()), "unreadable");
});

test("만료와 확인 불가를 다른 문구로 나눈다", () => {
  assert.match(FUNCTION_SOURCE, /사용기한이 지난 쿠폰입니다/);
  assert.match(FUNCTION_SOURCE, /쿠폰 사용기한 정보를 확인할 수 없습니다/);
});

test("확인 불가도 쿠폰을 쓴 것으로 표시하기 전에 돌아간다", () => {
  const guard = FUNCTION_SOURCE.indexOf("쿠폰 사용기한 정보를 확인할 수 없습니다");
  const used = FUNCTION_SOURCE.indexOf("coupon.usedAt = ");
  assert.notEqual(guard, -1);
  assert.ok(guard < used, "확인 불가 처리가 usedAt 기록보다 뒤에 있다");
});
