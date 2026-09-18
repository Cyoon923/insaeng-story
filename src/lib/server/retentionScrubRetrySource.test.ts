/**
 * 재시도 wrapper의 연결 방식 테스트 (Privacy-Retention-Retry-1).
 *
 * 실행: node --test src/lib/server/retentionScrubRetrySource.test.ts
 *
 * retentionStore.ts가 재시도를 **어떻게 이어 붙였는지**만 본다. 재시도 규칙 자체는
 * retentionScrubRetry.test.ts가 본다.
 *
 * 여기서 retentionStore.ts를 import하지 않는다. 그쪽은 DB 드라이버를 불러오기 때문이다.
 * 대신 원문을 글자로 읽는다. 연결이 어긋나면 이 테스트가 먼저 깨진다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const SOURCE = readFileSync(new URL("./retentionStore.ts", import.meta.url), "utf8");

/** 이름이 주어진 함수 본문만 잘라 온다. 다른 함수의 문장과 섞이지 않게 한다. */
function bodyOf(name: string): string {
  const start = SOURCE.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `${name}이 retentionStore.ts에 없다`);
  const bounds = ["\nexport ", "\n/* ---"]
    .map((mark) => SOURCE.indexOf(mark, start + 1))
    .filter((at) => at !== -1);
  const end = bounds.length ? Math.min(...bounds) : SOURCE.length;
  return SOURCE.slice(start, end);
}

/** 주석을 걷어낸 실행 코드. 설명에 적힌 낱말이 검사에 걸리지 않게 한다. */
function codeOf(name: string): string {
  return bodyOf(name)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

const ORDER_RETRY = codeOf("scrubOrderForRetentionWithRetry");
const ORPHAN_RETRY = codeOf("scrubOrphanConsultationForRetentionWithRetry");

/* ── 바깥 입력 ──────────────────────────────────────── */

test("주문 wrapper가 받는 것은 id와 현재 시각뿐이다", () => {
  // 자료나 계획을 호출부가 넘기면 판정을 건너뛸 수 있다.
  assert.match(ORDER_RETRY, /\(\s*orderId: string,\s*now: string,\s*\)/);
  assert.equal(/data: AppData/.test(ORDER_RETRY), false);
});

test("상담 wrapper가 받는 것은 id와 현재 시각뿐이다", () => {
  assert.match(ORPHAN_RETRY, /\(\s*consultationId: string,\s*now: string,\s*\)/);
  assert.equal(/data: AppData/.test(ORPHAN_RETRY), false);
});

/* ── 회차마다 새로 읽는다 ──────────────────────────── */

test("두 wrapper 모두 readData를 재시도 엔진에 넘긴다", () => {
  /*
   * 값을 미리 읽어 넘기면(readData()) 회차마다 새로 읽히지 않는다.
   * 함수 자체를 넘겨야 엔진이 회차마다 부른다.
   */
  for (const [name, code] of [
    ["주문", ORDER_RETRY],
    ["상담", ORPHAN_RETRY],
  ] as const) {
    assert.match(code, /readData,/, name);
    assert.equal(/await readData\(\)/.test(code), false, `${name}: 미리 읽어 넘기고 있다`);
  }
});

test("attempt는 엔진이 준 자료만 본다", () => {
  assert.match(ORDER_RETRY, /attempt: \(data\) => scrubOrderForRetentionOnce\(data, orderId, now\)/);
  assert.match(
    ORPHAN_RETRY,
    /attempt: \(data\) => scrubOrphanConsultationForRetentionOnce\(data, consultationId, now\)/,
  );
});

test("회차 사이에 값을 들고 있지 않다", () => {
  // 지난 회차의 자료·계획·결과를 담아 두는 변수가 있으면 다시 쓰이게 된다.
  for (const [name, code] of [
    ["주문", ORDER_RETRY],
    ["상담", ORPHAN_RETRY],
  ] as const) {
    assert.equal(/\blet\b/.test(code), false, `${name}: 회차를 넘나드는 변수가 있다`);
    assert.equal(/planRetentionScrub|planOrphanConsultationScrub/.test(code), false, name);
  }
});

/* ── 겹침만 다시 한다 ──────────────────────────────── */

test("겹침 판정은 기존 isAppStoreConflict를 쓴다", () => {
  for (const [name, code] of [
    ["주문", ORDER_RETRY],
    ["상담", ORPHAN_RETRY],
  ] as const) {
    assert.match(code, /isConflict: isAppStoreConflict,/, name);
  }
});

test("wrapper가 직접 오류를 삼키지 않는다", () => {
  // 재시도 여부는 엔진 한 곳이 정한다. 여기서 try/catch로 따로 다루지 않는다.
  for (const [name, code] of [
    ["주문", ORDER_RETRY],
    ["상담", ORPHAN_RETRY],
  ] as const) {
    assert.equal(/catch/.test(code), false, name);
    assert.equal(/for \(|while \(/.test(code), false, `${name}: 재시도 루프가 두 벌이다`);
  }
});

test("횟수를 wrapper가 따로 정하지 않는다", () => {
  // 최대 횟수는 RETENTION_SCRUB_MAX_ATTEMPTS 한 곳에서만 온다.
  for (const code of [ORDER_RETRY, ORPHAN_RETRY]) {
    assert.match(code, /runRetentionScrubWithRetry</);
    assert.equal(/runRetentionScrubWithRetry\([\s\S]*\},\s*\d+\s*\)/.test(code), false);
  }
});

/* ── 기존 primitive를 그대로 쓴다 ──────────────────── */

test("판정과 저장은 기존 primitive가 그대로 한다", () => {
  // wrapper는 언제 다시 부를지만 정한다. 정리 규칙을 새로 만들지 않는다.
  for (const [name, code] of [
    ["주문", ORDER_RETRY],
    ["상담", ORPHAN_RETRY],
  ] as const) {
    assert.equal(/RETENTION_KEPT_DETAIL_KEYS/.test(code), false, name);
    assert.equal(/sql\.query|writeData\(/.test(code), false, name);
    assert.equal(/decideRetentionEligibility/.test(code), false, name);
  }
});

test("기존 단건 primitive는 재시도를 알지 못한다", () => {
  /*
   * primitive가 스스로 다시 시도하면 재시도가 두 겹이 된다.
   * 기존 동작이 바뀌지 않았는지 본다.
   */
  for (const name of [
    "scrubOrderForRetentionOnce",
    "scrubOrphanConsultationForRetentionOnce",
  ]) {
    const code = codeOf(name);
    assert.equal(/runRetentionScrubWithRetry/.test(code), false, name);
    assert.equal(/RETENTION_SCRUB_MAX_ATTEMPTS/.test(code), false, name);
    // 여전히 자료를 인자로 받는다(스스로 읽지 않는다).
    assert.match(code, /data: AppData,/, name);
    assert.equal(/await readData\(\)/.test(code), false, name);
  }
});

test("재시도가 결제나 주문 테이블을 새로 건드리지 않는다", () => {
  for (const [name, code] of [
    ["주문", ORDER_RETRY],
    ["상담", ORPHAN_RETRY],
  ] as const) {
    assert.equal(/payments|order_snapshot/.test(code), false, name);
    assert.equal(/UPDATE|INSERT|DELETE/.test(code), false, name);
  }
});
