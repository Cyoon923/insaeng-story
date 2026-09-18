/**
 * app_store.codes 정리의 연결·격리 테스트 (Privacy-Legacy-Codes-Cleanup-1).
 *
 * 실행: node --test src/lib/server/legacyCodesCleanupSource.test.ts
 *
 * retentionStore.ts가 모드를 어떻게 정하는지, 그리고 이 정리가 무엇을 건드리지 않는지를 본다.
 * 규칙과 재시도 자체는 legacyCodesCleanup.test.ts가 본다.
 *
 * 여기서 retentionStore.ts를 import하지 않는다. 그쪽은 DB 드라이버를 불러오기 때문이다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const STORE = readFileSync(new URL("./retentionStore.ts", import.meta.url), "utf8");
const ENGINE = readFileSync(new URL("./legacyCodesCleanup.ts", import.meta.url), "utf8");
const VERIFICATION = readFileSync(new URL("./verificationCodes.ts", import.meta.url), "utf8");

const stripComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

function bodyOf(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `${name}이 없다`);
  const bounds = ["\nexport ", "\n/* ---"]
    .map((mark) => source.indexOf(mark, start + 1))
    .filter((at) => at !== -1);
  return source.slice(start, bounds.length ? Math.min(...bounds) : source.length);
}

const ENTRY = bodyOf(STORE, "cleanupLegacyVerificationCodes");
const ENTRY_CODE = stripComments(ENTRY);
const ENGINE_CODE = stripComments(ENGINE);

/* ── 모드 판단 ─────────────────────────────────────── */

test("모드는 DATABASE_URL 유무로 정한다", () => {
  assert.match(ENTRY_CODE, /mode: sqlClient\(\) \? "database" : "file",/);
});

test("모드 판단을 순수 모듈이 하지 않는다", () => {
  // 저장소를 아는 곳은 store.ts 하나로 둔다.
  assert.equal(/sqlClient|DATABASE_URL|process\.env/.test(ENGINE_CODE), false);
});

test("두 규칙이 한 줄로 합쳐져 있지 않다", () => {
  // 합치면 한쪽을 고칠 때 다른 쪽이 따라 바뀐다.
  assert.match(ENGINE_CODE, /mode === "database"/);
  assert.match(ENGINE_CODE, /pruneExpiredCodes\(codes, now\)/);
});

test("DB 모드 규칙에 만료 판정이 섞이지 않는다", () => {
  const branch = ENGINE_CODE.slice(
    ENGINE_CODE.indexOf('mode === "database"'),
    ENGINE_CODE.indexOf("if (deleted === 0)"),
  );
  assert.match(branch, /\{ next: \{\} as CodeMap, deleted: Object\.keys\(codes\)\.length \}/);
  assert.equal(/expiresAt/.test(branch), false, "DB 모드가 기한을 보고 있다");
});

/* ── 기준 시각 ─────────────────────────────────────── */

test("기준 시각을 밖에서 받는다", () => {
  assert.match(ENTRY, /cleanupLegacyVerificationCodes\(\s*now: number,\s*\)/);
  assert.match(ENGINE, /now: number,/);
});

test("정책 시각을 안에서 만들지 않는다", () => {
  assert.equal(/new Date\(|Date\.now\(\)/.test(ENGINE_CODE), false);
  assert.equal(/new Date\(|Date\.now\(\)/.test(ENTRY_CODE), false);
});

/* ── 저장 범위 ─────────────────────────────────────── */

test("verification_codes를 건드리지 않는다", () => {
  for (const code of [ENGINE_CODE, ENTRY_CODE]) {
    assert.equal(/verification_codes/.test(code), false);
    assert.equal(/sql\.query|DELETE |INSERT |UPDATE /.test(code), false);
  }
});

test("인증 함수를 부르지 않는다", () => {
  for (const name of [
    "issueCode",
    "putToken",
    "readVerification",
    "consumeVerification",
    "checkCode",
    "registerFailedAttempt",
    "deleteVerification",
    "deleteIssuedCode",
    "deleteExpiredVerifications",
  ]) {
    assert.equal(ENGINE_CODE.includes(name), false, `engine: ${name}`);
    assert.equal(ENTRY_CODE.includes(name), false, `entry: ${name}`);
  }
});

test("codes 말고 다른 자료를 바꾸지 않는다", () => {
  const assigns = ENGINE_CODE.match(/data\.[a-zA-Z]+ =/g) ?? [];
  assert.deepEqual([...new Set(assigns)], ["data.codes ="]);
});

test("저장은 넘겨받은 writeData 하나뿐이다", () => {
  const writes = ENGINE_CODE.match(/deps\.writeData\(/g) ?? [];
  assert.equal(writes.length, 1);
  assert.equal(/writeDataWith/.test(ENGINE_CODE), false);
});

/* ── 바꿀 것이 없으면 저장하지 않는다 ─────────────── */

test("지울 것이 없으면 저장 없이 끝낸다", () => {
  const guard = ENGINE_CODE.indexOf("if (deleted === 0) return");
  const write = ENGINE_CODE.indexOf("deps.writeData(data)");
  assert.notEqual(guard, -1);
  assert.equal(guard < write, true, "저장이 먼저 일어난다");
});

/* ── 재시도 ────────────────────────────────────────── */

test("회차마다 새로 읽는다", () => {
  const loop = ENGINE_CODE.slice(ENGINE_CODE.indexOf("for (let attempt"));
  assert.match(loop, /const data = await deps\.readData\(\);/);
  // 루프 밖에서 미리 읽어 두면 회차마다 새로 읽히지 않는다.
  const before = ENGINE_CODE.slice(0, ENGINE_CODE.indexOf("for (let attempt"));
  assert.equal(/readData\(\)/.test(before), false);
});

test("겹침만 다시 한다", () => {
  assert.match(ENGINE_CODE, /if \(!deps\.isConflict\(error\)\) throw error;/);
  assert.match(ENTRY_CODE, /isConflict: isAppStoreConflict,/);
});

test("저장에 실패하면 자료를 되돌린다", () => {
  assert.match(ENGINE_CODE, /data\.codes = previous;/);
});

test("횟수를 진입점이 따로 정하지 않는다", () => {
  assert.equal(/LEGACY_CODES_CLEANUP_MAX_ATTEMPTS|maxAttempts/.test(ENTRY_CODE), false);
});

/* ── 기록 ──────────────────────────────────────────── */

test("기록에 모드와 회차만 남긴다", () => {
  const warnings = ENGINE_CODE.match(/console\.[a-z]+\(`[^`]*`\)/g) ?? [];
  assert.equal(warnings.length, 2);
  for (const line of warnings) {
    assert.equal(/\$\{key\}|\$\{error\}|error\.message|\$\{data/.test(line), false, line);
    assert.match(line, /\$\{(attempt|mode)\}/);
  }
  assert.equal(/console\./.test(ENTRY_CODE), false);
});

/* ── 기존 auth 동작이 그대로다 ────────────────────── */

test("DB 모드 legacy fallback이 되살아나지 않았다", () => {
  /*
   * readVerification의 DB 경로는 테이블에 없으면 그 자리에서 null을 확정해야 한다.
   * codes로 내려가면 지운 값이 다시 인증에 쓰이게 된다.
   */
  const read = stripComments(bodyOf(VERIFICATION, "readVerification"));
  const sqlBranch = read.slice(read.indexOf("if (sql) {"), read.indexOf("const saved ="));
  assert.match(sqlBranch, /return null;/);
  assert.equal(/data\?\.codes/.test(sqlBranch), false, "DB 경로가 codes를 보고 있다");
});

test("소비 경로의 DB 분기도 그대로다", () => {
  const consume = stripComments(bodyOf(VERIFICATION, "consumeVerification"));
  const sqlBranch = consume.slice(consume.indexOf("if (sql) {"), consume.indexOf("const data ="));
  assert.match(sqlBranch, /AND expires_at > now\(\)/);
  assert.match(sqlBranch, /return null;/);
});

test("발급·소비 규칙이 그대로다", () => {
  const issue = stripComments(bodyOf(VERIFICATION, "issueCode"));
  assert.match(issue, /ON CONFLICT \(storage_key\) DO UPDATE/);
  assert.match(issue, /WHERE verification_codes\.sent_at IS NULL/);

  const put = stripComments(bodyOf(VERIFICATION, "putToken"));
  assert.match(put, /sent_at = NULL/);

  const expired = stripComments(bodyOf(VERIFICATION, "deleteExpiredVerifications"));
  assert.match(expired, /WHERE expires_at < \$1::timestamptz/);
});
