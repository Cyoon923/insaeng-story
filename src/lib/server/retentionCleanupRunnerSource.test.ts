/**
 * 정리 실행의 연결 방식 테스트 (Privacy-Retention-Runner-1).
 *
 * 실행: node --test src/lib/server/retentionCleanupRunnerSource.test.ts
 *
 * store.ts의 runRetentionCleanupOnce가 **무엇을 이어 붙였고 무엇을 하지 않는지**만 본다.
 * 진행 규칙 자체는 retentionCleanupRunner.test.ts가 본다.
 *
 * 여기서 store.ts를 import하지 않는다. 그쪽은 DB 드라이버를 불러오기 때문이다.
 * 대신 원문을 글자로 읽는다. 연결이 어긋나면 이 테스트가 먼저 깨진다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const STORE = readFileSync(new URL("./retentionStore.ts", import.meta.url), "utf8");
const RUNNER = readFileSync(new URL("./retentionCleanupRunner.ts", import.meta.url), "utf8");

const ENTRY = (() => {
  const start = STORE.indexOf("export async function runRetentionCleanupOnce");
  assert.notEqual(start, -1, "runRetentionCleanupOnce가 retentionStore.ts에 없다");
  const bounds = ["\nexport ", "\n/* ---"]
    .map((mark) => STORE.indexOf(mark, start + 1))
    .filter((at) => at !== -1);
  return STORE.slice(start, bounds.length ? Math.min(...bounds) : STORE.length);
})();

/** 주석을 걷어낸 실행 코드. 설명에 적힌 낱말이 검사에 걸리지 않게 한다. */
const stripComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const ENTRY_CODE = stripComments(ENTRY);
const RUNNER_CODE = stripComments(RUNNER);

/* ── 기존 경로를 그대로 이어 붙인다 ────────────────── */

test("후보 찾기와 두 실행 경로를 그대로 넘긴다", () => {
  assert.match(ENTRY_CODE, /findCandidates: findRetentionScrubCandidates,/);
  assert.match(ENTRY_CODE, /scrubOrder: scrubOrderForRetentionWithRetry,/);
  assert.match(
    ENTRY_CODE,
    /scrubOrphanConsultation: scrubOrphanConsultationForRetentionWithRetry,/,
  );
});

test("재시도 wrapper를 건너뛰고 단건 primitive를 부르지 않는다", () => {
  // Once를 직접 부르면 최신 자료로 다시 판정하는 경계가 사라진다.
  assert.equal(/scrubOrderForRetentionOnce/.test(ENTRY_CODE), false);
  assert.equal(/scrubOrphanConsultationForRetentionOnce/.test(ENTRY_CODE), false);
  assert.equal(/Once\b/.test(RUNNER_CODE), false);
});

test("진입점이 판정이나 SQL을 새로 만들지 않는다", () => {
  for (const forbidden of [
    "decideRetentionEligibility",
    "findRetentionCandidates",
    "RETENTION_KEPT_DETAIL_KEYS",
    "sql.query",
    "writeData",
    "readData",
  ]) {
    assert.equal(ENTRY_CODE.includes(forbidden), false, forbidden);
  }
});

/* ── runner가 규칙을 다시 만들지 않는다 ───────────── */

test("runner는 저장소도 정리 규칙도 알지 못한다", () => {
  for (const forbidden of [
    "decideRetentionEligibility",
    "scrubConsultationForRetention",
    "pickRetentionDetails",
    "RETENTION_KEPT_DETAIL_KEYS",
    "readData",
    "writeData",
    "sql",
    "payments",
    "UPDATE ",
    "SELECT ",
  ]) {
    assert.equal(RUNNER_CODE.includes(forbidden), false, forbidden);
  }
});

test("runner가 시각을 스스로 만들지 않는다", () => {
  // 도중에 시각이 흐르면 건마다 판정 경계가 달라진다.
  assert.equal(/new Date\(|Date\.now\(\)/.test(RUNNER_CODE), false);
});

test("runner가 완료 증빙을 읽거나 쓰지 않는다", () => {
  assert.equal(/retentionScrubbedAt|retention_scrubbed_at/.test(RUNNER_CODE), false);
  assert.equal(/completedAt|deliveredAt/.test(RUNNER_CODE), false);
});

/* ── 순차 실행 ─────────────────────────────────────── */

test("동시에 보내지 않는다", () => {
  // 같은 app_store 행을 두고 서로 밀어내면 충돌만 늘어난다.
  assert.equal(/Promise\.all|Promise\.allSettled|Promise\.race/.test(RUNNER_CODE), false);
  // for ... of 안에서 하나씩 기다린다(한도를 적용한 뒤의 목록을 돈다).
  assert.match(RUNNER_CODE, /for \(const candidate of selected\)/);
  assert.match(RUNNER_CODE, /await run\(id, now\)/);
});

test("되풀이해 도는 구조가 아니다", () => {
  // 일정에 따라 스스로 도는 코드(cron·worker)가 아니다.
  assert.equal(/setInterval|setTimeout|while \(true\)|cron/i.test(RUNNER_CODE), false);
});

/* ── 한 건의 실패가 전체를 멈추지 않는다 ───────────── */

test("실행 실패를 건마다 잡는다", () => {
  assert.match(RUNNER_CODE, /try \{\s*outcome = await run\(id, now\);\s*\} catch \{/);
  assert.match(RUNNER_CODE, /continue;/);
});

test("후보를 읽지 못하면 그 자리에서 끝낸다", () => {
  assert.match(RUNNER_CODE, /catch \{[\s\S]*?discoveryFailed: true/);
});

/* ── 한도 (Privacy-Cleanup-Execution-Core-1) ────────── */

test("한도에 기본값을 두지 않는다", () => {
  // 기본값이 있으면 한도를 정하지 않은 호출이 후보 전체를 지운다.
  assert.match(RUNNER_CODE, /limit: number,/);
  assert.equal(/limit: number =/.test(RUNNER_CODE), false);
  assert.equal(/limit \?\?/.test(RUNNER_CODE), false);
});

test("한도는 정수 1 이상만 받는다", () => {
  assert.match(
    RUNNER_CODE,
    /if \(!Number\.isInteger\(limit\) \|\| limit < 1\) throw new RangeError\(/,
  );
});

test("한도를 후보 찾기보다 먼저 본다", () => {
  // 읽고 나서 멈추면 "아무것도 하지 않았다"가 아니게 된다.
  const guard = RUNNER_CODE.indexOf("Number.isInteger(limit)");
  const lookup = RUNNER_CODE.indexOf("deps.findCandidates(");
  assert.notEqual(guard, -1);
  assert.notEqual(lookup, -1);
  assert.ok(guard < lookup, "후보를 읽은 뒤에 한도를 본다");
});

test("한도 오류에 값을 담지 않는다", () => {
  assert.match(RUNNER_CODE, /const LIMIT_ERROR = "RETENTION_CLEANUP_LIMIT_INVALID";/);
  assert.equal(/RangeError\(`/.test(RUNNER_CODE), false);
});

test("한도는 후보를 찾은 뒤에 적용한다", () => {
  const lookup = RUNNER_CODE.indexOf("deps.findCandidates(");
  const slice = RUNNER_CODE.indexOf("candidates.slice(0, limit)");
  assert.notEqual(slice, -1);
  assert.ok(lookup < slice, "찾기 단계에 한도를 밀어 넣으면 전체 수를 영영 잃는다");
  // 후보 찾기 쪽에 한도를 넘기지 않는다.
  assert.equal(/findCandidates\(now, limit|findCandidates\(limit/.test(RUNNER_CODE), false);
});

test("전체 수와 시도한 수를 갈라 담는다", () => {
  assert.match(RUNNER_CODE, /discovered: candidates\.length,/);
  assert.match(RUNNER_CODE, /processed: selected\.length,/);
  assert.match(RUNNER_CODE, /remaining: candidates\.length - selected\.length,/);
});

test("한도를 상한으로 못 박지 않는다", () => {
  // 얼마까지 허용할지는 입력을 받는 쪽이 정한다. 여기서 숫자를 정하지 않는다.
  assert.equal(/MAX_LIMIT|limit > \d|Math\.min\(limit/.test(RUNNER_CODE), false);
});

test("진입점이 한도를 그대로 넘긴다", () => {
  assert.match(ENTRY_CODE, /limit: number,/);
  assert.match(ENTRY_CODE, /\n {4}now,\n {4}limit,\n {2}\);/);
  // 진입점이 기본값을 몰래 채우지 않는다.
  assert.equal(/limit: number =|limit \?\?/.test(ENTRY_CODE), false);
});

/* ── 담기는 값 ─────────────────────────────────────── */

test("오류 내용을 결과에 담지 않는다", () => {
  // Error.message에는 값이 섞여 나올 수 있다.
  assert.equal(/error\.message|String\(error\)|\$\{error\}/.test(RUNNER_CODE), false);
  assert.match(RUNNER_CODE, /reason: RETENTION_CLEANUP_ERROR_REASON/);
});

test("기록에 id나 오류 내용을 남기지 않는다", () => {
  const warnings = RUNNER_CODE.match(/console\.(warn|error|log)\([^)]*\)/g) ?? [];
  assert.equal(warnings.length, 2);
  for (const line of warnings) {
    assert.equal(/\$\{id\}|\$\{error\}|error\.message/.test(line), false, line);
  }
});

test("결과에 담는 필드가 정해진 것뿐이다", () => {
  const pushes = RUNNER_CODE.match(/summary\.results\.push\(\{[\s\S]*?\}\)/g) ?? [];
  assert.equal(pushes.length, 4, "네 갈래 각각 한 번씩 담아야 한다");
  const allowed = /^(kind|id|outcome|reason|attempts)$/;
  for (const push of pushes) {
    for (const key of push.match(/^\s*([a-zA-Z]+)[,:]/gm) ?? []) {
      const name = key.trim().replace(/[,:]$/, "");
      assert.match(name, allowed, `${name}는 결과에 담기면 안 된다`);
    }
  }
});
