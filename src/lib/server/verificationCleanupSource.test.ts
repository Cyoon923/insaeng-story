/**
 * 만료 인증값 정리의 조건 테스트 (Privacy-Verification-Cleanup-1).
 *
 * 실행: node --test src/lib/server/verificationCleanupSource.test.ts
 *
 * deleteExpiredVerifications가 **어떤 조건을 달고 무엇을 내보내지 않는지**만 본다.
 * 실제 DB 동작(경계·종류 무관·멱등)은 verificationCleanup.test.sql에서 본다.
 *
 * 여기서 verificationCodes.ts를 import하지 않는다. 그쪽은 store.ts를 거쳐
 * DB 드라이버를 불러오기 때문이다. 대신 원문을 글자로 읽는다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const SOURCE = readFileSync(new URL("./verificationCodes.ts", import.meta.url), "utf8");

/** 이름이 주어진 함수 본문만 잘라 온다. 다른 함수의 문장과 섞이지 않게 한다. */
function bodyOf(name: string): string {
  const start = SOURCE.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `${name}이 verificationCodes.ts에 없다`);
  const bounds = ["\nexport ", "\n/* ---"]
    .map((mark) => SOURCE.indexOf(mark, start + 1))
    .filter((at) => at !== -1);
  return SOURCE.slice(start, bounds.length ? Math.min(...bounds) : SOURCE.length);
}

/** 주석을 걷어낸 실행 코드. 설명에 적힌 낱말이 검사에 걸리지 않게 한다. */
const stripComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const CLEANUP = bodyOf("deleteExpiredVerifications");
const CODE = stripComments(CLEANUP);

/* ── 삭제 조건 ─────────────────────────────────────── */

test("조건은 expires_at 하나뿐이다", () => {
  assert.match(CODE, /WHERE expires_at < \$1::timestamptz/);
});

test("종류를 가르는 조건이 없다", () => {
  // 접두사로 가르면 새 종류가 생길 때마다 지워지지 않는 값이 조용히 늘어난다.
  for (const forbidden of [
    "storage_key",
    "code =",
    "LIKE",
    "purpose",
    "signup:",
    "reset:",
    "setid:",
    "link:",
    "sociallink:",
    "withdraw:",
  ]) {
    assert.equal(CODE.includes(forbidden), false, forbidden);
  }
});

test("created_at·sent_at·attempts를 보지 않는다", () => {
  for (const forbidden of ["created_at", "sent_at", "attempts"]) {
    assert.equal(CODE.includes(forbidden), false, forbidden);
  }
});

test("경계는 미만이다", () => {
  // 정확히 기준 시각인 행은 아직 쓸 수 있는 값으로 본다.
  assert.equal(/expires_at <=/.test(CODE), false, "<= 이면 경계의 값까지 지워진다");
  assert.equal(/expires_at >/.test(CODE), false);
});

/* ── 기준 시각 ─────────────────────────────────────── */

test("기준 시각을 밖에서 받는다", () => {
  assert.match(CLEANUP, /deleteExpiredVerifications\(\s*now: Date,\s*\)/);
});

test("함수 안에서 시각을 만들지 않는다", () => {
  // 시각을 안에서 만들면 경계를 테스트로 고정할 수 없다.
  assert.equal(/new Date\(\)|Date\.now\(\)/.test(CODE), false);
});

test("받은 시각을 SQL 인자로 그대로 넘긴다", () => {
  // 판정하는 시각이 한 곳뿐이어야 한다. SQL 안에서 now()를 쓰면 두 곳이 된다.
  assert.match(CODE, /\[now\.toISOString\(\)\]/);
  assert.equal(/now\(\)/.test(CODE), false, "SQL이 스스로 시각을 만들고 있다");
});

/* ── 내보내는 값 ───────────────────────────────────── */

test("건수 말고는 돌려주지 않는다", () => {
  assert.match(CLEANUP, /Promise<VerificationCleanupResult>/);
  assert.match(CODE, /\{ supported: true, deleted: Number\(rows\[0\]\?\.deleted \?\? 0\) \}/);
});

test("RETURNING에 개인정보가 없다", () => {
  /*
   * storage_key에는 휴대폰 번호가, code에는 인증번호·토큰·소셜 정보·접근 토큰이
   * 들어 있다. 하나도 돌려받지 않는다.
   */
  const returning = CODE.match(/RETURNING[^\n]*/g) ?? [];
  assert.deepEqual(returning, ["RETURNING 1"]);
});

test("세는 일을 DB 안에서 끝낸다", () => {
  // 지운 행이 이 과정까지 올라오지 않는다.
  assert.match(CODE, /WITH removed AS \(/);
  assert.match(CODE, /SELECT count\(\*\)::int AS deleted FROM removed/);
});

test("기록을 남기지 않는다", () => {
  // 남길 수 있는 것이 건수뿐인데, 그마저 호출부가 정할 일이다.
  assert.equal(/console\./.test(CODE), false);
});

/* ── 실패를 감추지 않는다 ──────────────────────────── */

test("DB 오류를 잡아 성공으로 바꾸지 않는다", () => {
  assert.equal(/catch/.test(CODE), false);
  // 오류가 그대로 올라가도록 감싸지 않는다.
  assert.equal(/deleted: 0/.test(CODE), false);
});

/* ── 파일 모드 ─────────────────────────────────────── */

test("파일 모드는 성공처럼 보이지 않는다", () => {
  // deleted: 0을 돌려주면 "지울 것이 없었다"와 구분되지 않는다.
  assert.match(CODE, /if \(!sql\) return \{ supported: false \};/);
});

test("파일 모드에서 app_store.codes를 건드리지 않는다", () => {
  for (const forbidden of ["readData", "writeData", "data.codes", "AppData"]) {
    assert.equal(CODE.includes(forbidden), false, forbidden);
  }
});

test("결과 타입이 두 갈래로 나뉜다", () => {
  const type = SOURCE.slice(SOURCE.indexOf("export type VerificationCleanupResult"));
  assert.match(type, /\| \{ supported: true; deleted: number \}/);
  assert.match(type, /\| \{ supported: false \}/);
});

/* ── 기존 auth 동작을 바꾸지 않았다 ────────────────── */

test("기존 인증 함수들이 그대로다", () => {
  /*
   * 정리를 넣으면서 발급·읽기·소비 규칙이 흔들리면 안 된다.
   * 각 함수가 여전히 자기 조건만 쓰는지 본다.
   */
  const issue = stripComments(bodyOf("issueCode"));
  assert.match(issue, /ON CONFLICT \(storage_key\) DO UPDATE/);
  assert.match(issue, /WHERE verification_codes\.sent_at IS NULL/);
  assert.match(issue, /OR verification_codes\.sent_at <= to_timestamp\(\$5\)/);

  const put = stripComments(bodyOf("putToken"));
  assert.match(put, /ON CONFLICT \(storage_key\) DO UPDATE/);
  assert.match(put, /sent_at = NULL/);

  const read = stripComments(bodyOf("readVerification"));
  assert.match(read, /if \(record\.expiresAt < now\)/);
  assert.match(read, /await deleteVerification\(storageKey\)/);

  const consume = stripComments(bodyOf("consumeVerification"));
  assert.match(consume, /AND expires_at > now\(\)/);

  const failed = stripComments(bodyOf("registerFailedAttempt"));
  assert.match(failed, /SET attempts = attempts \+ 1/);
  assert.match(failed, />= input\.maxAttempts/);
});

test("정리 함수가 기존 인증 함수를 부르지 않는다", () => {
  for (const forbidden of [
    "issueCode",
    "putToken",
    "readVerification",
    "consumeVerification",
    "registerFailedAttempt",
    "deleteVerification",
    "deleteIssuedCode",
  ]) {
    assert.equal(CODE.includes(forbidden), false, forbidden);
  }
});

test("TTL·쿨다운·시도 횟수 값을 이 파일이 만들지 않는다", () => {
  // 정책 값은 호출부(route.ts)가 가진다. 정리를 넣으며 옮겨 오지 않았다.
  assert.equal(/CODE_TTL_MS|RESEND_COOLDOWN_MS|MAX_VERIFY_ATTEMPTS/.test(SOURCE), false);
});
