/**
 * 주문 동의 증빙의 "서버 최초 검증 시각" (Order-Consent-Timestamp-1).
 *
 * 실행: node --test src/lib/server/orderConsentTimestamp.test.ts
 *
 * 확정 설계는 셋이다.
 *   1) agreedAt은 서버가 그 동의를 **최초로 검증한** 시각이다.
 *   2) 카드결제는 preparePayment가 검증 직후 만든 시각을 결제 스냅샷
 *      top-level에 담아 승인·복구 경로까지 운반한다(details 안에는 넣지 않는다).
 *   3) 시각을 모르면 만들지 않는다. 추정해 채우지 않는다.
 *
 * 순수 함수는 직접 부른다. 나머지는 route·commit이 Next 요청과 저장소에 얽혀
 * 함수 단위로 부를 수 없으므로 소스로 고정한다
 * (기존 orderConsentVersionGate.test.ts / paymentRawMinimization.test.ts와 같은 방식).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { ORDER_CONSENT_VERSION } from "../constants/legal.ts";
import {
  buildCopyrightConsent,
  buildOrderConsent,
  checkCopyrightConsent,
  checkOrderConsent,
  readServerConsentedAt,
} from "./consents.ts";

const NOW = "2026-09-24T01:02:03.000Z";

function read(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

const APPLY_ORDER = read("./applyOrder.ts");
const ROUTE = read("../../app/api/app/route.ts");
const RETURN_ROUTE = read("../../app/api/payments/nicepay/return/route.ts");
const RECOMMIT_ROUTE = read("../../app/api/admin/payments/recommit/route.ts");

/* ── 증빙 생성 ─────────────────────────────────────── */

test("시각을 받으면 그 시각을 agreedAt으로 쓴다", () => {
  assert.deepEqual(buildOrderConsent(NOW), {
    agreed: true,
    agreedAt: NOW,
    version: ORDER_CONSENT_VERSION,
  });
  assert.deepEqual(buildCopyrightConsent(NOW), {
    agreed: true,
    agreedAt: NOW,
    version: ORDER_CONSENT_VERSION,
  });
});

test("시각을 모르면 agreedAt을 만들지 않는다", () => {
  // 지금 시각이나 createdAt으로 추정해 채우면 모르는 값을 아는 것처럼 기록하게 된다.
  for (const record of [buildOrderConsent(undefined), buildCopyrightConsent(undefined)]) {
    assert.equal(record.agreed, true);
    assert.equal("agreedAt" in record, false);
    assert.equal(record.version, ORDER_CONSENT_VERSION);
  }
});

test("두 증빙은 같은 시각을 나눠 쓰고 같은 버전을 쓴다", () => {
  const refund = buildOrderConsent(NOW);
  const copyright = buildCopyrightConsent(NOW);
  assert.equal(refund.agreedAt, copyright.agreedAt);
  assert.equal(refund.version, copyright.version);
});

test("동의 여부는 두 축이 독립이다", () => {
  // 한쪽 동의가 다른 쪽을 대신 통과시키지 않는다.
  assert.equal(checkOrderConsent(true).ok, true);
  assert.equal(checkCopyrightConsent(true).ok, true);
  for (const value of [false, "1", "true", 1, null, undefined, {}]) {
    assert.equal(checkCopyrightConsent(value).ok, false, JSON.stringify(value) ?? "undefined");
  }
  // 문구가 서로 다르다. 화면에서 어느 체크박스가 비었는지 알 수 있어야 한다.
  const refundError = checkOrderConsent(false);
  const copyrightError = checkCopyrightConsent(false);
  assert.equal(refundError.ok, false);
  assert.equal(copyrightError.ok, false);
  assert.notEqual(
    refundError.ok === false && refundError.error,
    copyrightError.ok === false && copyrightError.error,
  );
});

/* ── 스냅샷 시각 읽기 ──────────────────────────────── */

test("스냅샷 시각은 UTC ISO 왕복이 맞을 때만 받는다", () => {
  assert.equal(readServerConsentedAt(NOW), NOW);
});

test("형식이 어긋난 스냅샷 시각은 받지 않는다", () => {
  for (const value of [
    undefined,
    null,
    "",
    "2026-09-24",
    "2026-09-24T01:02:03+09:00", // 오프셋 표기는 우리가 넣는 형식이 아니다.
    "2026-09-24T01:02:03Z", // 밀리초가 없는 형태도 toISOString() 출력이 아니다.
    "어제",
    1758675723000,
    { agreedAt: NOW },
  ]) {
    assert.equal(readServerConsentedAt(value), undefined, JSON.stringify(value) ?? "undefined");
  }
});

/* ── 0원 신청: 검증과 확정이 같은 요청 ──────────────── */

test("시각을 받지 못했고 이 요청이 검증했다면 지금 시각을 쓴다", () => {
  // 0원 주문·상담은 checkOrderConsent와 buildOrderConsent가 같은 함수 안에 있다.
  const decision =
    "options.consentedAt ?? (requireConsent ? new Date().toISOString() : undefined)";
  assert.equal(
    APPLY_ORDER.split(decision).length - 1,
    2,
    "commitOrder와 commitConsultation 두 곳이어야 한다",
  );
});

test("두 증빙이 한 요청에서 같은 consentedAt을 쓴다", () => {
  const at = APPLY_ORDER.indexOf("const consentedAt =");
  assert.notEqual(at, -1);
  const block = APPLY_ORDER.slice(at, at + 600);
  assert.match(block, /buildOrderConsent\(consentedAt\)/);
  assert.match(block, /buildCopyrightConsent\(consentedAt\)/);
  // 시각을 두 번 만들지 않는다. 만들면 두 증빙의 시각이 갈라질 수 있다.
  assert.equal(block.includes("buildCopyrightConsent(new Date()"), false);
});

test("동의 플래그가 각각 그 증빙만 만든다", () => {
  assert.match(APPLY_ORDER, /const refundConsent = consentAgreed \? buildOrderConsent\(/);
  assert.match(
    APPLY_ORDER,
    /const copyrightConsent = copyrightAgreed \? buildCopyrightConsent\(/,
  );
});

/* ── 저작권 동의: 인생곡만, 서버에서 독립 검증 ──────── */

test("인생곡 확정은 저작권 동의를 독립으로 검증한다", () => {
  const at = APPLY_ORDER.indexOf("export async function commitOrder");
  const end = APPLY_ORDER.indexOf("export async function commitConsultation");
  assert.ok(at !== -1 && end > at);
  const body = APPLY_ORDER.slice(at, end);
  assert.match(body, /String\(details\.copyrightConsent \?\? ""\) === "1"/);
  assert.match(body, /checkCopyrightConsent\(copyrightAgreed\)/);
  // 취소·환불과 같은 방식으로 막는다. 복구 경로에서만 넘어간다.
  assert.match(body, /if \(!copyrightCheck\.ok && requireConsent\) \{/);
  assert.match(body, /status: 400/);
});

test("결제 준비도 인생곡에만 저작권 동의를 요구한다", () => {
  const at = ROUTE.indexOf('if (action === "preparePayment")');
  assert.notEqual(at, -1);
  const block = ROUTE.slice(at, ROUTE.indexOf("await createPayment({", at));
  assert.match(block, /if \(kind === "order"\) \{[\s\S]*?checkCopyrightConsent\(/);
  // 카드 승인이 끝난 뒤에 막히면 "결제만 되고 주문은 없는" 상태가 된다.
  const copyrightAt = block.indexOf("checkCopyrightConsent(");
  assert.notEqual(copyrightAt, -1);
});

test("상담은 저작권 동의를 요구하거나 만들지 않는다", () => {
  const at = APPLY_ORDER.indexOf("export async function commitConsultation");
  assert.notEqual(at, -1);
  const body = APPLY_ORDER.slice(at);
  assert.equal(body.includes("checkCopyrightConsent"), false);
  assert.equal(body.includes("buildCopyrightConsent"), false);
  // 상담 주문에 키가 붙지 않는다.
  assert.equal(body.includes("{ copyrightConsent }"), false);
});

/* ── 카드결제: prepare → snapshot → 승인/복구 ───────── */

test("결제 준비가 검증 직후 서버 시각을 한 번만 만든다", () => {
  const consentAt = ROUTE.indexOf("checkOrderConsent(String(details.applyConsent");
  assert.notEqual(consentAt, -1);
  const createAt = ROUTE.indexOf("await createPayment({", consentAt);
  const madeAt = ROUTE.indexOf("const consentedAt = new Date().toISOString();", consentAt);
  assert.notEqual(madeAt, -1, "결제 준비에서 서버 시각을 만들지 않는다");
  // 동의 검증 뒤, 결제 기록 생성 앞. 이 순서라야 막힌 요청에 시각이 남지 않는다.
  assert.ok(consentAt < madeAt && madeAt < createAt);
  assert.equal(
    ROUTE.split("const consentedAt = new Date().toISOString();").length - 1,
    1,
    "시각은 한 번만 만든다",
  );
});

test("시각은 스냅샷 top-level에 담고 details에는 넣지 않는다", () => {
  const at = ROUTE.indexOf("orderSnapshot: {");
  assert.notEqual(at, -1);
  const snapshot = ROUTE.slice(at, ROUTE.indexOf("});", at));
  // details와 같은 층(top-level)에 있어야 한다.
  assert.match(snapshot, /^\s{8}consentedAt,$/m);
  // details는 탈퇴·보관만료 정리가 키째 지운다. 그 안에 두면 값이 사라진다.
  assert.match(snapshot, /^\s{8}details: pointed\.details,$/m);
  assert.equal(/details: \{[\s\S]*consentedAt/.test(snapshot), false);
});

test("승인·복구 경로가 스냅샷 시각을 검증해 읽고 확정에 넘긴다", () => {
  for (const [name, source] of [
    ["return", RETURN_ROUTE],
    ["recommit", RECOMMIT_ROUTE],
  ] as const) {
    assert.match(source, /readServerConsentedAt\(snapshot\?\.consentedAt\)/, name);
    // 값이 있을 때만 넘긴다. 없으면 commit이 시각을 만들지 않는다.
    assert.equal(
      source.split("...(consentedAt ? { consentedAt } : {}),").length - 1,
      2,
      `${name}: 주문과 상담 두 곳이어야 한다`,
    );
  }
});

test("스냅샷 시각이 없어도 승인·복구를 막지 않는다", () => {
  for (const [name, source] of [
    ["return", RETURN_ROUTE],
    ["recommit", RECOMMIT_ROUTE],
  ] as const) {
    // 시각이 없다는 이유로 끝내는 문장이 없다.
    assert.equal(/if \(!consentedAt\)/.test(source), false, name);
    // 기존 복구 의미(requireConsent:false)는 그대로다.
    assert.equal(
      source.split("requireConsent: false,").length - 1,
      2,
      `${name}: requireConsent:false가 두 곳 그대로여야 한다`,
    );
    // 승인이 끝난 뒤에 새 관문을 두지 않는다.
    assert.equal(source.includes("orderConsentVersionGate"), false, name);
    assert.equal(source.includes("checkCopyrightConsent"), false, name);
  }
});

/* ── 과거 주문 호환 ────────────────────────────────── */

test("두 증빙 모두 값이 있을 때만 키를 만든다", () => {
  // 없으면 "기록 없음"이다. 빈 객체를 만들어 두지 않는다.
  assert.match(APPLY_ORDER, /\.\.\.\(refundConsent \? \{ refundConsent \} : \{\}\),/);
  assert.match(APPLY_ORDER, /\.\.\.\(copyrightConsent \? \{ copyrightConsent \} : \{\}\),/);
});

test("과거 주문에 소급 생성하지 않는다", () => {
  const store = read("./store.ts");
  // NULL 컬럼은 키를 만들지 않는 기존 규칙이 그대로다.
  assert.match(
    store,
    /\.\.\.\(row\.refund_consent \? \{ refundConsent: row\.refund_consent as ConsentRecord \} : \{\}\)/,
  );
  assert.match(store, /row\.copyright_consent\s*\?\s*\{ copyrightConsent: row\.copyright_consent as ConsentRecord \}/);
});

/* ── 클라이언트가 보내는 것 ────────────────────────── */

test("인생곡 화면은 동의 여부만 보낸다", () => {
  for (const relative of [
    "../../app/apply/story-song/6/page.tsx",
    "../../app/apply/premium/6/page.tsx",
    "../../app/apply/saju-song/4/page.tsx",
  ]) {
    const source = read(relative);
    assert.match(source, /applyConsent: refundAgreed \? "1" : "",/, relative);
    assert.match(source, /copyrightConsent: agreed \? "1" : "",/, relative);
    // 시각과 버전은 서버가 채운다. 화면이 보내면 그 값을 믿게 되는 자리가 생긴다.
    assert.equal(/agreedAt/.test(source), false, relative);
    assert.equal(/CONSENT_VERSION/.test(source), false, relative);
  }
});

test("상담 화면은 저작권 동의를 보내지 않는다", () => {
  const source = read("../../app/apply/consultation/4/page.tsx");
  assert.match(source, /applyConsent: agreed \? "1" : "",/);
  assert.equal(source.includes("copyrightConsent"), false);
});

/* ── 버전·관문 회귀 ────────────────────────────────── */

test("버전 상수와 관문 구조를 바꾸지 않았다", () => {
  const legal = read("../constants/legal.ts");
  // 새 버전 상수를 만들지 않았다. 저작권 증빙도 ORDER_CONSENT_VERSION을 쓴다.
  assert.equal(legal.includes("COPYRIGHT_CONSENT_VERSION"), false);
  assert.match(legal, /export const ORDER_CONSENT_VERSION = LEGAL_EFFECTIVE_DATE;/);
  // 신규 신청 관문은 그대로 세 곳이다.
  assert.equal(ROUTE.split("orderConsentVersionGate()").length - 1, 4); // 정의 1 + 호출 3
});
