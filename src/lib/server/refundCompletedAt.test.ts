/**
 * 환불 종결 시각 completed_at 테스트 (Privacy-RefundRequests-CompletedAt-1).
 *
 * 실행: node --test src/lib/server/refundCompletedAt.test.ts
 *
 * 보는 것은 하나다. "종결 시각이 서버가 만든 값이고, 실제 종결이 일어난
 * 경우에만, 한 번만 남는가."
 *
 * 저장 모듈(refundRequests.ts)과 최종화 문장(store.ts)은 DB 드라이버를 불러오므로
 * 원문을 글자로 읽어 경계를 본다(inquiryChatCleanup.test.ts와 같은 방식).
 * 실제 DB 동작(원자성·동시성)은 refundPaymentFinalization*.test.sql이 본다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

function read(name: string): string {
  return readFileSync(new URL(`./${name}`, import.meta.url), "utf8");
}

/** 주석을 걷어낸 본문. 설명에 적힌 단어를 코드로 착각하지 않기 위해서다. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const REQUESTS = read("refundRequests.ts");
const REQUESTS_CODE = code(REQUESTS);
const STORE = read("store.ts");
const STORE_CODE = code(STORE);
const TYPES = read("../types/app.ts");

/* ── DDL ────────────────────────────────────────────── */

test("completed_at 열을 ALTER로 더한다", () => {
  assert.match(
    REQUESTS_CODE,
    /ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ/,
  );
});

test("completed_at은 NOT NULL도 DEFAULT도 걸지 않는다", () => {
  const ddl = REQUESTS_CODE.match(/completed_at TIMESTAMPTZ[^`]*/)?.[0] ?? "";
  assert.equal(ddl.includes("NOT NULL"), false, "종결 전 문의가 정상적으로 존재한다");
  assert.equal(ddl.includes("DEFAULT"), false, "기본값이 있으면 접수 순간에 값이 생긴다");
});

test("과거 행을 소급해 채우지 않는다", () => {
  // UPDATE ... SET completed_at = ... 은 최종화 문장 하나뿐이고, 그 문장은 store.ts에 있다.
  assert.equal(/completed_at\s*=/.test(REQUESTS_CODE), false, "저장 모듈은 이 열을 쓰지 않는다");
  assert.equal(
    /INSERT[\s\S]{0,400}completed_at/.test(REQUESTS_CODE),
    false,
    "backfill INSERT가 없다",
  );
});

/* ── 접수 ───────────────────────────────────────────── */

test("접수 INSERT는 completed_at을 담지 않는다", () => {
  const insert = REQUESTS_CODE.match(/INSERT INTO refund_requests \([\s\S]*?\)/)?.[0] ?? "";
  assert.notEqual(insert, "", "접수 INSERT를 찾지 못했다");
  assert.equal(insert.includes("completed_at"), false);
  // 접수 시점에 이 열이 없으므로 새 문의의 completedAt은 언제나 null이다.
});

test("관리자 전이 UPDATE는 세 열만 바꾼다", () => {
  const update = REQUESTS_CODE.match(/UPDATE refund_requests\s+SET[\s\S]*?WHERE id = \$1/)?.[0] ?? "";
  assert.notEqual(update, "", "전이 UPDATE를 찾지 못했다");
  assert.equal(update.includes("completed_at"), false, "사람이 누르는 전이는 종결 시각을 만들지 않는다");
  for (const column of ["status", "decided_at", "handled_by"]) {
    assert.equal(update.includes(column), true, `${column}는 그대로 있어야 한다`);
  }
});

/* ── 기록 시점 ──────────────────────────────────────── */

/** 최종화 한 문장 안의 completed CTE만 떼어낸다. */
const COMPLETED_CTE =
  STORE_CODE.match(/completed AS \(\s*UPDATE refund_requests[\s\S]*?RETURNING id\s*\)/)?.[0] ?? "";

test("종결 CTE가 status와 completed_at을 함께 바꾼다", () => {
  assert.notEqual(COMPLETED_CTE, "", "종결 CTE를 찾지 못했다");
  assert.match(COMPLETED_CTE, /SET status = 'completed'/);
  assert.match(COMPLETED_CTE, /completed_at = COALESCE\(completed_at, \$8::timestamptz\)/);
});

test("종결은 approved에서만, 결제가 실제로 바뀐 경우에만 일어난다", () => {
  assert.match(COMPLETED_CTE, /AND status = 'approved'/);
  assert.match(COMPLETED_CTE, /EXISTS \(SELECT 1 FROM paid\)/);
});

test("이미 있는 종결 시각을 덮어쓰지 않는다", () => {
  assert.match(COMPLETED_CTE, /COALESCE\(completed_at,/);
  // 덮어쓰는 별도 경로를 만들지 않았다. completed_at을 쓰는 문장은 이 CTE 하나뿐이다.
  const writes = STORE_CODE.match(/completed_at\s*=/g) ?? [];
  assert.equal(writes.length, 1, "종결 시각을 쓰는 자리는 한 곳뿐이어야 한다");
});

/* ── 서버 now 전달 ──────────────────────────────────── */

test("종결 시각은 서버가 만들고 인자로 받지 않는다", () => {
  assert.match(STORE_CODE, /const completedAt = new Date\(\)\.toISOString\(\);/);
  // 입력 타입에 자리를 두지 않는다. 호출부·관리자·PG가 정할 수 없다.
  const input = STORE_CODE.match(/interface FinalizeRefundPaymentInput \{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.notEqual(input, "", "최종화 입력 타입을 찾지 못했다");
  assert.equal(/completedAt/.test(input), false);
});

test("만든 값을 그 한 문장의 마지막 파라미터로 넘긴다", () => {
  const params = STORE_CODE.match(/input\.verifiedCancelledAmount,\s*cancelledAt,\s*completedAt,/);
  assert.notEqual(params, null, "$8 자리에 completedAt이 넘어가야 한다");
});

/* ── PG 취소 시각과의 분리 ──────────────────────────── */

test("PG 취소 시각과 종결 시각은 서로 다른 값으로 남는다", () => {
  // cancelled_at에는 PG가 준 값만, completed_at에는 서버 값만 들어간다.
  assert.match(STORE_CODE, /cancelled_at = \$7::timestamptz/);
  assert.match(STORE_CODE, /const cancelledAt = usablePgTime\(input\.pgCancelledAt\);/);
  assert.equal(
    /cancelled_at = COALESCE\(cancelled_at, \$8/.test(STORE_CODE),
    false,
    "서버 시각을 PG 시각 칸에 넣지 않는다",
  );
});

test("PG 시각이 없어도 종결 시각은 만들어진다", () => {
  // usablePgTime은 NULL을 돌려줄 수 있지만 completedAt 생성은 그와 무관하다.
  assert.match(STORE_CODE, /function usablePgTime[\s\S]*?return null;/);
  const order = STORE_CODE.indexOf("const completedAt = new Date()");
  const guard = STORE_CODE.indexOf("const cancelledAt = usablePgTime");
  assert.equal(order > guard, true);
  // 두 값 사이에 "PG 시각이 없으면 종결하지 않는다" 같은 분기가 없다.
  const between = STORE_CODE.slice(guard, order);
  assert.equal(/if\s*\(/.test(between), false, "PG 시각 유무로 갈라지는 분기가 없어야 한다");
});

test("PG 시각이 없을 때 종결을 막는 조건이 없다", () => {
  const paidCte = STORE_CODE.match(/paid AS \(\s*UPDATE payments[\s\S]*?RETURNING id\s*\)/)?.[0] ?? "";
  assert.notEqual(paidCte, "", "결제 CTE를 찾지 못했다");
  assert.equal(
    /cancelled_at IS NOT NULL/.test(paidCte + COMPLETED_CTE),
    false,
    "PG 시각 유무를 최종화 조건으로 쓰지 않는다",
  );
});

/* ── 원자 경계 ──────────────────────────────────────── */

test("결제 변경과 종결이 같은 한 문장 안에 있다", () => {
  const statement = STORE_CODE.match(/WITH target_refund AS \([\s\S]*?completed_rows\s*\n\s*`/)?.[0] ?? "";
  assert.notEqual(statement, "", "최종화 문장을 찾지 못했다");
  assert.equal(statement.includes("UPDATE payments"), true);
  assert.equal(statement.includes("UPDATE refund_requests"), true);
  assert.equal(statement.includes("completed_at"), true);
  // 문장이 하나이므로 결제·종결·종결시각이 함께 반영되거나 함께 반영되지 않는다.
  assert.equal(STORE_CODE.match(/WITH target_refund AS \(/g)?.length, 1);
});

/* ── 복구 경로 ──────────────────────────────────────── */

test("정상·복구 세 경로가 같은 최종화 함수를 쓴다", () => {
  const callers = [
    "refundPaymentNormalFinalize.ts",
    "refundPaymentRecovery.ts",
    "refundPaymentSucceededRecovery.ts",
  ];
  for (const name of callers) {
    const source = code(read(name));
    assert.match(source, /store\.finalizeRefundPaymentCancel\(input\)/, name);
    // 스스로 종결 시각을 만들어 넘기지 않는다.
    assert.equal(/completedAt/.test(source), false, `${name}: 종결 시각을 만들면 안 된다`);
  }
});

/* ── 타입과 노출 ────────────────────────────────────── */

test("저장 모델과 관리자 목록에만 completedAt이 있다", () => {
  assert.match(TYPES, /completedAt\?: string \| null;/, "RefundRequest에 있어야 한다");
  assert.match(TYPES, /completedAt: string \| null;/, "AdminRefundRequestItem에 있어야 한다");

  // 고객용 요약 타입에는 자리를 만들지 않는다.
  for (const name of ["ActiveRefundRequestSummary", "LatestRefundRequestSummary"]) {
    const shape = TYPES.match(new RegExp(`interface ${name} \\{[\\s\\S]*?\\n\\}`))?.[0] ?? "";
    assert.notEqual(shape, "", `${name}을 찾지 못했다`);
    assert.equal(/completedAt/.test(shape), false, `${name}에 종결 시각이 새면 안 된다`);
  }
});

test("고객 조회 질의가 completed_at을 읽지 않는다", () => {
  for (const fn of ["listActiveRefundRequestsByUser", "listLatestRefundRequestsByUser"]) {
    const body =
      REQUESTS_CODE.match(new RegExp(`export async function ${fn}[\\s\\S]*?\\n\\}`))?.[0] ?? "";
    assert.notEqual(body, "", `${fn}을 찾지 못했다`);
    assert.equal(body.includes("completed_at"), false, `${fn}: 종결 시각을 SELECT하면 안 된다`);
  }
});

test("행을 모양으로 바꿀 때 종결 시각을 지어내지 않는다", () => {
  assert.match(REQUESTS_CODE, /completedAt: toIsoOrNull\(row\.completed_at\)/);
  // decided_at으로 대신 채우는 경로가 없다.
  assert.equal(
    /completedAt:[^,\n]*decided/.test(REQUESTS_CODE),
    false,
    "승인 시각을 종결 시각으로 쓰지 않는다",
  );
});

/* ── 기존 의미 보존 ─────────────────────────────────── */

test("decided_at의 기존 동작을 바꾸지 않았다", () => {
  assert.match(
    REQUESTS_CODE,
    /decided_at = CASE WHEN \$4::timestamptz IS NULL THEN decided_at ELSE \$4::timestamptz END/,
  );
  // 최종화 문장은 decided_at을 건드리지 않는다.
  assert.equal(COMPLETED_CTE.includes("decided_at"), false);
});

test("payments.cancelled_at의 NULL 정책을 바꾸지 않았다", () => {
  assert.match(
    STORE_CODE,
    /function usablePgTime\(value: string \| null\): string \| null \{\s*if \(!value\) return null;/,
  );
});
