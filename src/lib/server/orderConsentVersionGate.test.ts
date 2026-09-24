/**
 * 신청 단계 동의 버전 관문 (Legal-Consent-Gate-1).
 *
 * 실행: node --test src/lib/server/orderConsentVersionGate.test.ts
 *
 * 관문은 Next 요청 객체와 세션이 얽힌 route 안에 있어 함수 단위로 부르기 어렵다.
 * 그래서 두 가지로 나눠 고정한다.
 *   1) 판정 함수(isOrderConsentVersionConfirmed)의 동작 — 직접 부른다.
 *   2) 그 판정이 "어느 경로에 걸려 있고 어느 경로에는 없는지" — 소스로 고정한다.
 * 2)는 기존 paymentRawMinimization.test.ts와 같은 방식이다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  LEGAL_EFFECTIVE_DATE,
  ORDER_CONSENT_VERSION,
  UNCONFIRMED_VERSION,
  isOrderConsentVersionConfirmed,
} from "../constants/legal.ts";

function read(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

/* ── 판정 함수 ──────────────────────────────────────── */

test("확정된 버전이면 확정된 것으로 본다", () => {
  // 시행일이 확정되어 값이 자리표시자에서 벗어났다. 되돌아가면 이 테스트가 알려 준다.
  assert.notEqual(ORDER_CONSENT_VERSION, UNCONFIRMED_VERSION);
  assert.equal(ORDER_CONSENT_VERSION, LEGAL_EFFECTIVE_DATE);
  assert.equal(isOrderConsentVersionConfirmed(), true);
});

/* ── 관문이 걸린 경로 ───────────────────────────────── */

test("새 신청 세 경로에 관문이 걸려 있다", () => {
  const source = read("../../app/api/app/route.ts");

  // 관문 자체가 판정 함수를 쓴다(문구 버전을 여기서 다시 해석하지 않는다).
  assert.ok(source.includes("function orderConsentVersionGate()"));
  assert.ok(source.includes("isOrderConsentVersionConfirmed()"));

  // 세 경로 각각에서 관문을 부른다.
  for (const action of ["createOrder", "createConsultation"]) {
    const at = source.indexOf(`action === "${action}"`);
    assert.notEqual(at, -1, `${action} 분기를 찾지 못했다`);
    const block = source.slice(at, at + 600);
    assert.ok(block.includes("orderConsentVersionGate()"), `${action}에 관문이 없다`);
  }
  // 결제 준비는 분기 이름이 아니라 동의 확인 직후 위치로 본다.
  const consentAt = source.indexOf("checkOrderConsent(String(details.applyConsent");
  assert.notEqual(consentAt, -1);
  const prepareBlock = source.slice(consentAt, consentAt + 800);
  assert.ok(prepareBlock.includes("orderConsentVersionGate()"), "결제 준비에 관문이 없다");

  // 관문은 막을 때 저장하지 않고 503으로 끝낸다.
  const gateAt = source.indexOf("function orderConsentVersionGate()");
  const gateBody = source.slice(gateAt, gateAt + 400);
  assert.ok(gateBody.includes("status: 503"));
});

test("결제 준비 관문은 payments 행을 만들기 전에 있다", () => {
  const source = read("../../app/api/app/route.ts");
  const consentAt = source.indexOf("checkOrderConsent(String(details.applyConsent");
  const gateAt = source.indexOf("orderConsentVersionGate()", consentAt);
  const createAt = source.indexOf("await createPayment({", consentAt);
  assert.notEqual(createAt, -1, "createPayment 호출을 찾지 못했다");
  // 관문이 결제 기록 생성보다 앞이라야 막혀도 돈이 움직이지 않는다.
  assert.ok(gateAt < createAt, "관문이 createPayment 뒤에 있다");
});

/* ── 관문을 걸지 않는 경로 ──────────────────────────── */

/*
 * 이미 승인이 끝난 결제를 주문으로 만드는 경로다. 여기서 막으면 돈은 빠져나갔는데
 * 주문이 없는 상태가 된다. 관문이 들어가지 않았음을 고정한다.
 */
test("승인 콜백과 결제 복구에는 관문이 없다", () => {
  for (const relative of [
    "../../app/api/payments/nicepay/return/route.ts",
    "../../app/api/admin/payments/recommit/route.ts",
  ]) {
    const source = read(relative);
    assert.equal(
      source.includes("isOrderConsentVersionConfirmed"),
      false,
      `${relative}에 관문이 들어갔다`,
    );
    assert.equal(
      source.includes("orderConsentVersionGate"),
      false,
      `${relative}에 관문이 들어갔다`,
    );
  }
});
