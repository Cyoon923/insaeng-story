/**
 * 필수 동의 증빙과 행위 기록 테스트 (Privacy-ConsentEvidence-History-1).
 *
 * 실행: node --test src/lib/server/consents.test.ts
 *
 * 보는 것은 넷이다.
 * 1) 가입 시 현재 상태 2종과 행위 기록 2건이 같은 순간·같은 버전으로 나온다.
 * 2) 기록에 개인정보가 없다.
 * 3) 뒤에만 붙는다. 같은 답을 다시 적지 않는다.
 * 4) 기록이 없는 기존 회원을 정상으로 다룬다.
 *
 * 응답 노출(toPublicUser)은 DB·세션을 지나는 route 파일이라 원문을 글자로 읽어
 * 경계를 본다(다른 route source 테스트들과 같은 방식).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  appendConsentEvent,
  buildOrderConsent,
  buildRequiredConsents,
  checkOrderConsent,
  checkRequiredConsents,
  lastEventOfType,
  readConsent,
} from "./consents.ts";
import {
  ORDER_CONSENT_VERSION,
  SIGNUP_PRIVACY_VERSION,
  TERMS_VERSION,
} from "../constants/legal.ts";
import type { ConsentEvent, UserConsents } from "@/lib/types/app";

const NOW = "2026-09-22T00:00:00.000Z";

/* ── 가입 시 생성 ───────────────────────────────────── */

test("현재 상태 2종과 행위 기록 2건이 함께 만들어진다", () => {
  const consents = buildRequiredConsents(NOW);

  assert.deepEqual(consents.terms, { agreed: true, agreedAt: NOW, version: TERMS_VERSION });
  assert.deepEqual(consents.privacy, {
    agreed: true,
    agreedAt: NOW,
    version: SIGNUP_PRIVACY_VERSION,
  });

  assert.equal(consents.history?.length, 2);
  assert.deepEqual(consents.history, [
    { type: "terms", agreed: true, occurredAt: NOW, version: TERMS_VERSION },
    { type: "privacy", agreed: true, occurredAt: NOW, version: SIGNUP_PRIVACY_VERSION },
  ]);
});

test("현재 상태와 기록이 같은 시각·같은 버전을 가리킨다", () => {
  const consents = buildRequiredConsents(NOW);
  for (const type of ["terms", "privacy"] as const) {
    const record = consents[type];
    const event = lastEventOfType(consents.history, type);
    assert.notEqual(record, undefined, type);
    assert.notEqual(event, null, type);
    assert.equal(event?.occurredAt, record?.agreedAt, `${type}: 시각이 갈라졌다`);
    assert.equal(event?.version, record?.version, `${type}: 버전이 갈라졌다`);
    assert.equal(event?.agreed, record?.agreed, `${type}: 동의 여부가 갈라졌다`);
  }
});

test("시각을 함수 안에서 만들지 않는다", () => {
  // 인자를 주면 그 값이 그대로 쓰인다. 두 번 불러도 서로 다른 시각이 섞이지 않는다.
  const a = buildRequiredConsents(NOW);
  const b = buildRequiredConsents(NOW);
  assert.deepEqual(a.history, b.history);
});

test("선택(마케팅) 항목은 만들지 않는다", () => {
  const consents = buildRequiredConsents(NOW);
  for (const key of ["marketingSms", "marketingEmail", "marketingKakao"] as const) {
    assert.equal(key in consents, false, key);
  }
});

/* ── 기록에 담기는 값 ───────────────────────────────── */

test("행위 기록에 개인정보가 담기지 않는다", () => {
  const consents = buildRequiredConsents(NOW);
  for (const event of consents.history ?? []) {
    assert.deepEqual(Object.keys(event).sort(), ["agreed", "occurredAt", "type", "version"]);
  }
  // 이름·연락처·회원 식별자·IP·User-Agent가 들어갈 자리가 없다.
  const serialized = JSON.stringify(consents.history);
  for (const banned of ["userId", "name", "phone", "email", "ip", "userAgent"]) {
    assert.equal(serialized.includes(banned), false, banned);
  }
});

/* ── append-only ────────────────────────────────────── */

function event(overrides: Partial<ConsentEvent> = {}): ConsentEvent {
  return { type: "terms", agreed: true, occurredAt: NOW, version: "v1", ...overrides };
}

test("같은 type·같은 version·같은 agreed는 다시 붙이지 않는다", () => {
  const history = [event()];
  const next = appendConsentEvent(history, event({ occurredAt: "2026-10-01T00:00:00.000Z" }));
  assert.equal(next.length, 1);
  assert.deepEqual(next, history);
});

test("version이 바뀌면 붙인다", () => {
  const history = [event()];
  const next = appendConsentEvent(history, event({ version: "v2" }));
  assert.equal(next.length, 2);
  assert.equal(next[1].version, "v2");
});

test("agreed가 바뀌면 붙인다", () => {
  const history = [event()];
  const next = appendConsentEvent(history, event({ agreed: false }));
  assert.equal(next.length, 2);
  assert.equal(next[1].agreed, false);
});

test("철회 뒤 같은 version에 다시 동의하면 붙인다", () => {
  // 배열 전체가 아니라 마지막 것만 보기 때문에 이 사실이 기록된다.
  const history = [event(), event({ agreed: false })];
  const next = appendConsentEvent(history, event({ agreed: true }));
  assert.equal(next.length, 3);
  assert.deepEqual(
    next.map((item) => item.agreed),
    [true, false, true],
  );
});

test("다른 type이 사이에 끼어도 판정이 흔들리지 않는다", () => {
  const history = [event(), event({ type: "privacy", version: "p1" })];
  // terms의 마지막은 여전히 v1/true라 붙지 않는다.
  assert.equal(appendConsentEvent(history, event()).length, 2);
  // privacy의 마지막은 p1이라 p2는 붙는다.
  assert.equal(
    appendConsentEvent(history, event({ type: "privacy", version: "p2" })).length,
    3,
  );
});

test("인자로 받은 배열을 바꾸지 않는다", () => {
  const history = [event()];
  const next = appendConsentEvent(history, event({ version: "v2" }));
  assert.equal(history.length, 1, "원본이 늘어났다");
  assert.notEqual(next, history, "같은 배열을 돌려주면 안 된다");
});

test("기존 원소를 고치거나 지우지 않는다", () => {
  const first = event();
  const history = [first];
  const next = appendConsentEvent(history, event({ version: "v2" }));
  assert.deepEqual(next[0], first);
});

/* ── 기록이 없는 기존 회원 ──────────────────────────── */

test("history가 없어도 그대로 쓸 수 있다", () => {
  assert.deepEqual(appendConsentEvent(undefined, event()), [event()]);
  assert.equal(lastEventOfType(undefined, "terms"), null);
});

test("기존 ConsentRecord를 기록으로 옮겨 만들지 않는다", () => {
  // 이 구조가 생기기 전 회원. terms 레코드는 있고 history는 없다.
  const legacy: UserConsents = { terms: { agreed: true, agreedAt: NOW, version: "v0" } };
  assert.equal(legacy.history, undefined);
  // 읽기 헬퍼는 기존 레코드를 그대로 돌려준다(소급 생성 없음).
  assert.deepEqual(readConsent(legacy, "terms"), { agreed: true, agreedAt: NOW, version: "v0" });
  assert.equal(readConsent(legacy, "privacy"), null);
});

/* ── 기존 동작 보존 ─────────────────────────────────── */

test("필수 동의 검증이 그대로다", () => {
  assert.deepEqual(checkRequiredConsents({ termsAgreed: true, privacyAgreed: true }), { ok: true });
  for (const body of [
    { termsAgreed: true, privacyAgreed: false },
    { termsAgreed: "true", privacyAgreed: true },
    { termsAgreed: 1, privacyAgreed: 1 },
    {},
  ]) {
    assert.equal(checkRequiredConsents(body).ok, false, JSON.stringify(body));
  }
});

test("신청 단계 동의는 이번에 바뀌지 않았다", () => {
  assert.equal(checkOrderConsent(true).ok, true);
  assert.equal(checkOrderConsent("1").ok, false);
  assert.deepEqual(buildOrderConsent(NOW), {
    agreed: true,
    agreedAt: NOW,
    version: ORDER_CONSENT_VERSION,
  });
  // 주문 동의에는 history를 붙이지 않는다(주문마다 1건씩 쌓이므로 이미 시계열이다).
  assert.equal("history" in buildOrderConsent(NOW), false);
});

/* ── 응답 노출 ──────────────────────────────────────── */

const ROUTE = readFileSync(new URL("../../app/api/app/route.ts", import.meta.url), "utf8");
const ROUTE_CODE = ROUTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("공개 사본에서 행위 기록을 지운다", () => {
  const fn = ROUTE_CODE.match(/function toPublicUser\(user: User\): User \{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.notEqual(fn, "", "toPublicUser를 찾지 못했다");
  assert.match(fn, /delete consents\.history;/);
  // 저장소의 객체를 건드리지 않도록 consents도 사본으로 만든다.
  assert.match(fn, /const consents = \{ \.\.\.result\.consents \};/);
  // 현재 상태(terms·privacy)의 공개 여부는 이번에 바꾸지 않았다.
  for (const key of ["terms", "privacy"]) {
    assert.equal(fn.includes(`delete consents.${key}`), false, key);
  }
});

test("가입 두 경로가 같은 생성 함수를 쓴다", () => {
  const calls = ROUTE_CODE.match(/consents: buildRequiredConsents\(\),/g) ?? [];
  assert.equal(calls.length, 2, "일반 가입과 소셜 신규가입 두 곳이어야 한다");
  // 시각·버전을 route에서 따로 만들어 넘기지 않는다.
  assert.equal(/buildRequiredConsents\([^)]+\)/.test(ROUTE_CODE), false);
});
