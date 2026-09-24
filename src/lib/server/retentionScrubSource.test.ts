/**
 * 보관 만료 정리 문장 조건 테스트 (Privacy-Retention-Execution-1).
 *
 * 실행: node --test src/lib/server/retentionScrubSource.test.ts
 *
 * retentionStore.ts의 scrubOrderForRetentionOnce가 보내는 SQL이 **어떤 조건을 달고 있는지**만 본다.
 * 원자성·CAS·동시성 같은 실제 DB 동작은 retentionScrub.test.sql에서 본다.
 *
 * 여기서 retentionStore.ts를 import하지 않는다. 그쪽은 DB 드라이버를 불러오기 때문이다.
 * 대신 원문을 글자로 읽는다. 조건이 사라지면 이 테스트가 먼저 깨진다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { RETENTION_KEPT_DETAIL_KEYS } from "./retentionScrub.ts";

const SOURCE = readFileSync(new URL("./retentionStore.ts", import.meta.url), "utf8");

/** 이 기능이 보내는 문장만 잘라 본다. 다른 store 함수의 조건과 섞이지 않게 한다. */
const FUNCTION_SOURCE = (() => {
  const start = SOURCE.indexOf("export async function scrubOrderForRetentionOnce");
  assert.notEqual(start, -1, "scrubOrderForRetentionOnce가 retentionStore.ts에 없다");
  const end = SOURCE.indexOf("\nexport ", start + 1);
  return SOURCE.slice(start, end === -1 ? undefined : end);
})();

test("결제는 이 주문에 연결된 행만 고른다", () => {
  /*
   * order_id가 NULL인 결제는 recommit이 주문을 되살리는 유일한 입력이다.
   * SQL에서 NULL = '<id>'는 참이 될 수 없으므로 이 조건 하나로 제외된다.
   * 조건이 사라지면 그 복구 입력이 지워진다.
   */
  const paymentUpdate = FUNCTION_SOURCE.slice(FUNCTION_SOURCE.indexOf("scrubbed_payment"));
  assert.match(paymentUpdate, /WHERE order_id = \$\$\{n \+ 1\}/);
});

test("결제 문장에 order_id를 넓히는 조건이 없다", () => {
  const paymentUpdate = FUNCTION_SOURCE.slice(FUNCTION_SOURCE.indexOf("scrubbed_payment"));
  // 이 중 하나라도 있으면 연결되지 않은 결제까지 걸린다.
  assert.equal(/order_id IS NULL/.test(paymentUpdate), false);
  assert.equal(/OR order_id/.test(paymentUpdate), false);
  assert.equal(/order_snapshot->>'userId'/.test(paymentUpdate), false);
});

test("결제에서 지우는 것은 details와 request.purpose 둘뿐이다", () => {
  const paymentUpdate = FUNCTION_SOURCE.slice(FUNCTION_SOURCE.indexOf("scrubbed_payment"));
  // 신청 내용 사본은 예전과 같이 통째로 빠진다(두 갈래 모두에서).
  assert.equal(
    [...paymentUpdate.matchAll(/order_snapshot - 'details'/g)].length,
    2,
    "details 제거가 CASE의 두 갈래에 모두 있어야 한다",
  );
  // 상담 목적 사본은 request 안에서 키 하나만 빠진다.
  assert.match(paymentUpdate, /\(order_snapshot -> 'request'\) - 'purpose'/);
  assert.match(paymentUpdate, /jsonb_set\(/);

  // request는 통째로 지우지 않는다. 승인 재검증 근거와 귀속 정보도 그대로 둔다.
  for (const key of ["'request'", "'discount'", "'userId'", "'amount'"]) {
    assert.equal(paymentUpdate.includes(`order_snapshot - ${key}`), false, key);
  }
  // request 안에서도 purpose 말고 다른 키를 빼지 않는다.
  const innerRemovals = [...paymentUpdate.matchAll(/'request'\) - ('\w+')/g)].map((m) => m[1]);
  assert.deepEqual(innerRemovals, ["'purpose'"]);
  // 이번 단계에서 손대지 않기로 한 값들이 문장에 등장하지 않는다.
  for (const key of ["'version'", "'preparedAt'", "'goodsName'", "'kind'", "'usePoints'"]) {
    assert.equal(paymentUpdate.includes(key), false, key);
  }
  // PG 응답 원문은 다른 칸이라 이 문장이 손대지 않는다.
  assert.equal(/\braw\b\s*=/.test(paymentUpdate), false);
  assert.equal(/cancel_response_raw/.test(paymentUpdate), false);
});

test("SQL 테스트가 베끼는 결제 문장이 실제 문장과 같다", () => {
  /*
   * retentionScrub.test.sql은 같은 문장을 손으로 베껴 실제 PostgreSQL에 돌린다.
   * 둘이 갈라지면 원자성 테스트가 이제는 쓰이지 않는 문장을 검사하게 된다.
   * DB 없이도 그 어긋남을 잡기 위해 여기서 글자로 맞춰 본다.
   */
  const sqlTest = readFileSync(new URL("./retentionScrub.test.sql", import.meta.url), "utf8");

  /** 주석·공백·매개변수 표기 차이를 걷어낸 결제 CTE. */
  const paymentCte = (text: string) =>
    text
      .slice(text.indexOf("scrubbed_payment"), text.indexOf("SELECT version FROM cas"))
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/--.*$/gm, "")
      .replace(/\$\$\{n \+ 1\}/g, "$PARAM")
      .replace(/\$3\b/g, "$PARAM")
      .replace(/\s+/g, " ")
      .trim();

  assert.equal(paymentCte(sqlTest), paymentCte(FUNCTION_SOURCE));
});

test("지울 것이 없는 결제 행은 고르지 않는다", () => {
  const paymentUpdate = FUNCTION_SOURCE.slice(FUNCTION_SOURCE.indexOf("scrubbed_payment"));
  // details가 있거나, request가 객체이고 그 안에 purpose가 있을 때만 쓴다.
  assert.match(paymentUpdate, /order_snapshot \? 'details'/);
  assert.match(paymentUpdate, /\(order_snapshot -> 'request'\) \? 'purpose'/);
  // request가 객체가 아닌 경우를 먼저 확인한다(조건과 CASE 양쪽 모두).
  assert.equal(
    [...paymentUpdate.matchAll(/jsonb_typeof\(order_snapshot -> 'request'\) = 'object'/g)].length,
    2,
  );
});

test("세 갱신이 모두 CAS 성공에 걸려 있다", () => {
  /*
   * app_store 저장이 밀리면 orders도 payments도 바뀌면 안 된다.
   * 각 CTE의 EXISTS (SELECT 1 FROM cas)가 그 보장이다.
   */
  const guards = FUNCTION_SOURCE.match(/EXISTS \(SELECT 1 FROM cas\)/g) ?? [];
  assert.equal(guards.length, 2, "orders와 payments 두 갱신 모두에 걸려 있어야 한다");
});

test("orders는 대상 id 한 행만 바꾼다", () => {
  const orderUpdate = FUNCTION_SOURCE.slice(
    FUNCTION_SOURCE.indexOf("scrubbed_order"),
    FUNCTION_SOURCE.indexOf("scrubbed_payment"),
  );
  assert.match(orderUpdate, /WHERE id = \$\$\{n \+ 1\}/);
  // 회원 단위로 넓히지 않는다(탈퇴 경로와 다른 점이다).
  assert.equal(/user_id/.test(orderUpdate), false);
});

test("orders details는 denylist가 아니라 allowlist로 정리한다", () => {
  const orderUpdate = FUNCTION_SOURCE.slice(
    FUNCTION_SOURCE.indexOf("scrubbed_order"),
    FUNCTION_SOURCE.indexOf("scrubbed_payment"),
  );
  // 남길 키만 모아 새 객체를 만든다. 지울 키를 나열하지 않는다.
  assert.match(orderUpdate, /jsonb_object_agg\(kept\.key, kept\.value\)/);
  assert.match(orderUpdate, /WHERE kept\.key = ANY\(\$\$\{n \+ 2\}::text\[\]\)/);
  // details에서 키를 빼는 방식(-)이 섞여 있으면 새 입력칸이 늘 때 샌다.
  assert.equal(/details - '/.test(orderUpdate), false);
});

test("남길 키 목록은 TS와 같은 출처에서 온다", () => {
  // 목록을 SQL에 글자로 적어 두면 TS와 갈라진다. 배열을 인자로 넘기는지 본다.
  assert.match(FUNCTION_SOURCE, /RETENTION_KEPT_DETAIL_KEYS/);
  for (const key of RETENTION_KEPT_DETAIL_KEYS) {
    assert.equal(
      FUNCTION_SOURCE.includes(`'${key}'`),
      false,
      `${key}를 SQL에 직접 적으면 목록이 두 벌이 된다`,
    );
  }
});

test("완료 증빙은 최초값을 덮어쓰지 않는다", () => {
  assert.match(
    FUNCTION_SOURCE,
    /retention_scrubbed_at = COALESCE\(retention_scrubbed_at, \$\$\{n \+ 3\}::timestamptz\)/,
  );
});

test("완료 증빙과 실제 정리가 같은 문장 안에 있다", () => {
  // 따로 쓰면 "지우지 않았는데 끝났다고 기록된" 상태가 생길 수 있다.
  const orderUpdate = FUNCTION_SOURCE.slice(
    FUNCTION_SOURCE.indexOf("scrubbed_order"),
    FUNCTION_SOURCE.indexOf("scrubbed_payment"),
  );
  assert.match(orderUpdate, /jsonb_object_agg/);
  assert.match(orderUpdate, /retention_scrubbed_at = COALESCE/);
});

test("완료 증빙·기산점 열을 지우지 않는다", () => {
  for (const column of [
    "delivered_at =",
    "production_started_at =",
    "refund_consent =",
    "copyright_consent =",
  ]) {
    assert.equal(FUNCTION_SOURCE.includes(column), false, column);
  }
});

test("행을 지우는 문장이 없다", () => {
  // 이 기능은 개인정보만 비운다. 거래 기록 자체는 남긴다.
  assert.equal(/DELETE FROM/.test(FUNCTION_SOURCE), false);
  assert.equal(/DROP /.test(FUNCTION_SOURCE), false);
});

test("판정을 거치지 않고 SQL로 갈 수 없다", () => {
  // 계획이 서지 않으면 그 자리에서 끝난다. 그 아래로 문장이 내려가지 않는다.
  const planAt = FUNCTION_SOURCE.indexOf("planRetentionScrub(data, orderId, now)");
  const guardAt = FUNCTION_SOURCE.indexOf("if (!planned.ok) return");
  const queryAt = FUNCTION_SOURCE.indexOf("sql.query");
  assert.notEqual(planAt, -1);
  assert.equal(planAt < guardAt && guardAt < queryAt, true);
});
