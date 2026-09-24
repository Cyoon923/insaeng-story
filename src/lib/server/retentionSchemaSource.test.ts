/**
 * 스키마 준비가 무엇만 하는지 보는 테스트 (Privacy-Cleanup-Execution-Core-1).
 *
 * 실행: node --test src/lib/server/retentionSchemaSource.test.ts
 *
 * store.ts의 ensureRetentionSchema가 **무엇을 부르고 무엇을 하지 않는지**만 본다.
 * 무엇을 만들지는 기존 준비 함수들이 정하고, 그쪽 경계는 각자의 테스트가 본다.
 *
 * 여기서 store.ts를 import하지 않는다. 그쪽은 DB 드라이버를 불러오기 때문이다.
 * 대신 원문을 글자로 읽는다. 경계가 무너지면 이 테스트가 먼저 깨진다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const SOURCE = readFileSync(new URL("./retentionStore.ts", import.meta.url), "utf8");

const FUNCTION_SOURCE = (() => {
  const start = SOURCE.indexOf("export async function ensureRetentionSchema");
  assert.notEqual(start, -1, "ensureRetentionSchema가 retentionStore.ts에 없다");
  const bounds = ["\nexport ", "\n/* ---"]
    .map((mark) => SOURCE.indexOf(mark, start + 1))
    .filter((at) => at !== -1);
  return SOURCE.slice(start, bounds.length ? Math.min(...bounds) : SOURCE.length);
})();

/** 주석을 걷어낸 실행 코드. 설명에 적힌 낱말이 검사에 걸리지 않게 한다. */
const CODE = FUNCTION_SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/* ── 부르는 것이 정해진 셋뿐이다 ───────────────────── */

test("허용된 준비 셋만 순서대로 부른다", () => {
  const calls = CODE.match(/await (ensure|appStoreCas\.ensure)\w+\(sql\);/g) ?? [];
  assert.deepEqual(calls, [
    "await ensureTable(sql);",
    "await appStoreCas.ensureVersionColumn(sql);",
    "await ensureRetentionOrdersColumn(sql);",
  ]);
});

test("더하는 열이 retention_scrubbed_at 하나뿐이다", () => {
  const alters = SOURCE.match(/ADD COLUMN IF NOT EXISTS [\w ]+/g) ?? [];
  assert.deepEqual(alters, ["ADD COLUMN IF NOT EXISTS retention_scrubbed_at TIMESTAMPTZ"]);
  for (const column of [
    "delivered_at",
    "production_started_at",
    "refund_consent",
    "copyright_consent",
  ]) {
    assert.equal(SOURCE.includes(`ADD COLUMN IF NOT EXISTS ${column}`), false, column);
  }
});

test("결제 스키마는 건드리지 않는다", () => {
  // 결제 열은 정리가 시작되는 조건이 아니다. 필요한 경로가 스스로 부른다.
  assert.equal(/ensurePaymentsMigration/.test(CODE), false);
});

test("다른 준비 함수를 더 부르지 않는다", () => {
  // 부르는 자리를 전부 센다(자기 이름은 빼고 실제 호출만 본다).
  const ensures = CODE.match(/ensure\w+\(sql\)/g) ?? [];
  assert.equal(ensures.length, 3);
});

test("보관 만료 ALTER를 보내는 함수가 이 하나뿐이다", () => {
  const callers = SOURCE.match(/ensureRetentionOrdersColumn\(sql\)/g) ?? [];
  assert.equal(callers.length, 1, "ensureRetentionSchema 밖에서도 열을 만들고 있다");
  assert.match(CODE, /await ensureRetentionOrdersColumn\(sql\);/);
});

/* ── 자료를 읽지도 쓰지도 않는다 ───────────────────── */

test("저장소를 읽지 않는다", () => {
  assert.equal(/readData|sql\.query|sql\.transaction/.test(CODE), false);
});

test("저장하는 문장이 없다", () => {
  assert.equal(/writeData|commitVersion|casHead|advanceVersion/.test(CODE), false);
  assert.equal(/UPDATE |INSERT |DELETE |DROP /i.test(CODE), false);
});

test("이 함수 본문에 SQL 원문을 두지 않는다", () => {
  // 무엇을 만들지는 준비 함수들이 정한다. 본문에 SQL이 있으면 규칙이 두 벌이 된다.
  assert.equal(/CREATE TABLE|CREATE INDEX|ALTER TABLE|ADD COLUMN/i.test(CODE), false);
  assert.equal(CODE.includes("`"), false, "SQL 원문을 담고 있다");
});

/* ── 정리를 실행하지 않는다 ────────────────────────── */

test("정리를 실행하지 않는다", () => {
  for (const forbidden of [
    "runRetentionCleanup",
    "findRetentionScrubCandidates",
    "scrubOrderForRetention",
    "scrubOrphanConsultation",
    "cleanupLegacyVerificationCodes",
    "deleteExpiredVerifications",
  ]) {
    assert.equal(CODE.includes(forbidden), false, forbidden);
  }
});

/* ── DB가 없으면 아무것도 하지 않는다 ──────────────── */

test("파일 모드에서는 문장을 하나도 보내지 않는다", () => {
  assert.match(CODE, /const sql = sqlClient\(\);/);
  assert.match(CODE, /if \(!sql\) return \{ supported: false \};/);
  // 모드 판단은 sqlClient() 하나로 한다. 접속 문자열을 직접 보지 않는다.
  assert.equal(/DATABASE_URL|process\.env/.test(CODE), false);
});

test("확인이 준비보다 먼저다", () => {
  const guard = CODE.indexOf("if (!sql)");
  const first = CODE.indexOf("await ensureTable(sql)");
  assert.notEqual(guard, -1);
  assert.notEqual(first, -1);
  assert.ok(guard < first, "DB 모드를 확인하기 전에 준비를 시작한다");
});

/* ── 돌려주는 값 ───────────────────────────────────── */

test("돌려주는 것이 지원 여부뿐이다", () => {
  assert.match(FUNCTION_SOURCE, /Promise<RetentionSchemaResult>/);
  assert.match(
    SOURCE,
    /export type RetentionSchemaResult = \{ supported: true \} \| \{ supported: false \};/,
  );
  // 건수도 후보도 담지 않는다. 준비했는지 여부뿐이다.
  assert.equal(/discovered|deleted|count|candidate/i.test(CODE), false);
});

test("기록을 남기지 않는다", () => {
  // 남길 사실이 없다. 준비 함수들이 실패하면 그 오류가 그대로 올라간다.
  assert.equal(/console\.(warn|error|log)/.test(CODE), false);
});
