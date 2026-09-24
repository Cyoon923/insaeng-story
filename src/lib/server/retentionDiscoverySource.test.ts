/**
 * 후보 찾기가 읽기만 하는지 보는 테스트 (Privacy-Retention-Discovery-1).
 *
 * 실행: node --test src/lib/server/retentionDiscoverySource.test.ts
 *
 * store.ts의 findRetentionScrubCandidates가 **무엇을 하지 않는지**를 본다.
 * 후보를 고르는 규칙 자체는 retentionDiscovery.test.ts가 본다.
 *
 * 여기서 store.ts를 import하지 않는다. 그쪽은 DB 드라이버를 불러오기 때문이다.
 * 대신 원문을 글자로 읽는다. 금지한 동작이 생기면 이 테스트가 먼저 깨진다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const SOURCE = readFileSync(new URL("./retentionStore.ts", import.meta.url), "utf8");

const FUNCTION_SOURCE = (() => {
  const start = SOURCE.indexOf("export async function findRetentionScrubCandidates");
  assert.notEqual(start, -1, "findRetentionScrubCandidates가 retentionStore.ts에 없다");
  const bounds = ["\nexport ", "\n/* ---"]
    .map((mark) => SOURCE.indexOf(mark, start + 1))
    .filter((at) => at !== -1);
  return SOURCE.slice(start, bounds.length ? Math.min(...bounds) : SOURCE.length);
})();

/** 주석을 걷어낸 실행 코드. 설명에 적힌 낱말이 검사에 걸리지 않게 한다. */
const CODE = FUNCTION_SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/* ── 읽기만 한다 ───────────────────────────────────── */

test("저장하는 문장이 없다", () => {
  assert.equal(/UPDATE |INSERT |DELETE |DROP |ALTER TABLE/i.test(CODE), false);
  assert.equal(/writeData/.test(CODE), false);
  assert.equal(/commitVersion|casHead|advanceVersion/.test(CODE), false);
});

test("scrub이나 재시도를 부르지 않는다", () => {
  // 후보를 찾는 자리에서 지우기 시작하면 "후보"라는 경계가 사라진다.
  assert.equal(/scrubOrderForRetentionOnce/.test(CODE), false);
  assert.equal(/scrubOrphanConsultationForRetentionOnce/.test(CODE), false);
  assert.equal(/WithRetry/.test(CODE), false);
  assert.equal(/runRetentionScrubWithRetry/.test(CODE), false);
});

test("결제를 조회하지도 수정하지도 않는다", () => {
  // 후보를 고르는 데 결제 기록이 필요 없다. 필요 없으면 읽지 않는다.
  assert.equal(/payments/i.test(CODE), false);
  assert.equal(/order_snapshot|merchantOrderId|merchant_order_id/.test(CODE), false);
});

test("SELECT 한 문장만 보낸다", () => {
  const queries = CODE.match(/sql\.query\(/g) ?? [];
  assert.equal(queries.length, 1, "짝 확인 한 문장뿐이어야 한다");
  assert.match(CODE, /SELECT id FROM orders/);
});

/* ── SQL은 넓게 추리기만 한다 ──────────────────────── */

test("기산점과 정리 여부를 app_store에서 읽는다", () => {
  // orders 테이블의 같은 이름 열을 보지 않는다. 그 열을 쓰면 일반 조회 경로가
  // 먼저 스키마를 바꿔야 하고, 관리자가 정리를 부르기도 전에 ALTER가 나간다.
  assert.match(CODE, /deliveredAt: item\.deliveredAt \?\? null,/);
  assert.match(CODE, /retentionScrubbedAt: item\.retentionScrubbedAt \?\? null,/);
});

test("SQL의 delivered_at·retention_scrubbed_at에 의존하지 않는다", () => {
  assert.equal(/delivered_at|retention_scrubbed_at/.test(CODE), false);
});

test("후보 찾기가 스키마를 바꾸지 않는다", () => {
  assert.equal(/ALTER|ADD COLUMN|ensureRetentionOrdersColumn/i.test(CODE), false);
});

test("SQL이 만료 여부를 판정하지 않는다", () => {
  /*
   * 날짜 계산이 SQL에 생기면 규칙이 두 벌이 된다.
   * 뜻은 언제나 decideRetentionEligibility 한 곳에서 정해진다.
   */
  assert.equal(/interval|now\(\)\s*-|age\(|date_trunc/i.test(CODE), false);
  assert.equal(/delivered_at\s*[<>]/.test(CODE), false);
});

test("다른 뜻의 시각이나 상태로 추정하지 않는다", () => {
  for (const column of [
    "created_at",
    "updated_at",
    "production_started_at",
    "refund_consent",
    "copyright_consent",
    "status",
  ]) {
    assert.equal(CODE.includes(column), false, column);
  }
});

/* ── 판정은 기존 함수 한 곳이 한다 ─────────────────── */

test("판정은 findRetentionCandidates에 맡긴다", () => {
  assert.match(CODE, /findRetentionCandidates\(/);
  // 여기서 직접 판정하거나 새 규칙을 만들지 않는다.
  assert.equal(/decideRetentionEligibility/.test(CODE), false);
  assert.equal(/RETENTION_YEARS|setUTCFullYear/.test(CODE), false);
});

test("DB가 없는 환경도 같은 판정 함수를 쓴다", () => {
  // 두 경로가 갈라지면 파일 모드와 운영의 뜻이 달라진다.
  const calls = CODE.match(/findRetentionCandidates\(/g) ?? [];
  assert.equal(calls.length, 2, "SQL 경로와 파일 경로 모두에서 같은 함수를 불러야 한다");
});

/* ── 읽지 못하면 실패로 올린다 (Privacy-Retention-Discovery-Failure-1) ── */

test("주문 테이블을 읽지 못하면 던진다", () => {
  // 삼키면 부른 쪽이 "살펴볼 건이 없었다"로 읽는다. 읽지 못한 것은 실패다.
  assert.match(CODE, /throw new RetentionCandidateLookupError\(\);/);
});

test("읽지 못한 것을 후보 0건으로 바꾸지 않는다", () => {
  // 예전에는 빈 목록으로 이어 갔다. 그 자리가 되살아나면 구분이 다시 사라진다.
  assert.equal(/orders = \[\];/.test(CODE), false);
  assert.equal(/sqlOrderIds = null;/.test(CODE), false);
  assert.equal(/return \[\];/.test(CODE), false);
});

test("실패를 만드는 자리가 하나뿐이다", () => {
  const thrown = CODE.match(/throw [^;]+;/g) ?? [];
  assert.deepEqual(thrown, ["throw new RetentionCandidateLookupError();"]);
});

test("받은 오류를 그대로 올리지도 담지도 않는다", () => {
  // 문장·인자·접속 정보가 섞여 나올 수 있다. 받은 값은 잡기만 하고 버린다.
  assert.match(CODE, /\} catch \{/);
  assert.equal(/catch \(/.test(CODE), false);
  assert.equal(/cause|error\.message|String\(error\)|\$\{error\}/.test(CODE), false);
});

test("읽기 실패 기록에 개인정보를 남기지 않는다", () => {
  const warnings = CODE.match(/console\.(warn|error|log)\([^)]*\)/g) ?? [];
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /^console\.warn\("\[retention\] candidate lookup failed"\)$/);
});

/* ── 실패 신호에 담기는 것 ─────────────────────────── */

/** 실패를 알리는 오류 클래스의 원문. 함수 밖에 있어 따로 잘라 본다. */
const ERROR_SOURCE = (() => {
  const start = SOURCE.indexOf("export class RetentionCandidateLookupError");
  assert.notEqual(start, -1, "RetentionCandidateLookupError가 retentionStore.ts에 없다");
  const end = SOURCE.indexOf("\n}", start);
  assert.notEqual(end, -1);
  return SOURCE.slice(start, end + 2);
})();

test("실패 신호는 정해 둔 문자열만 담는다", () => {
  assert.match(ERROR_SOURCE, /super\("RETENTION_CANDIDATE_LOOKUP_FAILED"\)/);
  // 받은 오류를 들고 다니지 않는다(인자를 받지 않는다).
  assert.equal(/constructor\([^)]+\)/.test(ERROR_SOURCE), false);
  assert.equal(/cause/.test(ERROR_SOURCE), false);
  assert.equal(/\$\{/.test(ERROR_SOURCE), false);
});

test("기존 저장 충돌 오류와 섞지 않는다", () => {
  // 뜻이 다르다. 저장이 밀린 것과 읽지 못한 것을 같은 값으로 다루지 않는다.
  assert.equal(/AppStoreConflictError/.test(ERROR_SOURCE), false);
});

/* ── 결과에 담기는 것 ──────────────────────────────── */

test("돌려주는 타입이 후보 목록뿐이다", () => {
  assert.match(FUNCTION_SOURCE, /Promise<RetentionCandidate\[\]>/);
});

test("주문 행에서 details를 읽지 않는다", () => {
  // 후보를 고르는 데 필요 없다. 읽으면 개인정보가 이 계층까지 올라온다.
  assert.equal(/details/.test(CODE), false);
  assert.equal(/user_id/.test(CODE), false);
});
