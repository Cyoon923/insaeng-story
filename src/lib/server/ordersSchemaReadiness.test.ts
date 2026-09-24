/**
 * orders INSERT 경로가 스스로 스키마를 보장한다 (Orders-Schema-Readiness-1).
 *
 * 실행: node --test src/lib/server/ordersSchemaReadiness.test.ts
 *
 * ── 무엇을 고쳤나 ──
 *
 * orders INSERT는 refund_consent·copyright_consent 열에 값을 넣는다. 두 열은
 * CREATE TABLE(ensureTable)이 만드는 열이 아니라 ensureOrdersMigration이 ALTER로
 * 더하는 열이다. 그런데 두 저장 경로(writeDataWithOrder /
 * writeDataWithOrderForPayment)는 그 마이그레이션을 직접 부르지 않고, 다른 조회
 * 경로가 먼저 실행되어 이미 열이 생겨 있기를 기대하고 있었다.
 *
 * 열이 아직 없는 DB에서 결제 승인 콜백이 먼저 도달하면 INSERT가 깨지고,
 * 승인은 끝났으니 "돈은 빠져나갔는데 주문이 없는" 상태가 된다.
 *
 * 그래서 두 저장 경로가 INSERT 전에 직접 보장하게 했고, 승인 전에 드러나도록
 * createPayment(preparePayment가 부르는 자리)에도 같은 호출을 두었다.
 *
 * ── 왜 소스 스캔인가 ──
 *
 * store.ts는 "@/..." 별칭과 @neondatabase/serverless를 부른다. Node 내장 러너는
 * 그 별칭을 풀지 못해 함수 단위로 부를 수 없다. 그래서 기존
 * orderCopyrightConsentColumn.test.ts / retentionSchemaSource.test.ts와 같은 방식으로
 * "어느 호출이 어느 문장보다 앞에 있는지"를 소스로 고정한다.
 * 실제 PostgreSQL 왕복이 필요한 범위는 파일 끝 주석에 적어 둔다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

function read(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

const STORE = read("./store.ts");

/** 이름으로 함수 본문을 떼어 온다. 다음 열 0의 닫는 중괄호까지다. */
function body(signature: string): string {
  const at = STORE.indexOf(signature);
  assert.notEqual(at, -1, `${signature} 를 찾지 못했다`);
  const end = STORE.indexOf("\n}\n", at);
  assert.notEqual(end, -1, `${signature} 의 끝을 찾지 못했다`);
  return STORE.slice(at, end);
}

function count(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

const WRITE_ORDER = body("export async function writeDataWithOrder(");
const WRITE_FOR_PAYMENT = body("export async function writeDataWithOrderForPayment(");
const CREATE_PAYMENT = body("export async function createPayment(");
const ENSURE = body("function ensureOrdersMigration(");
const RUN = body("async function runOrdersMigration(");

const ENSURE_CALL = "await ensureOrdersMigration(sql);";
const ORDERS_INSERT = "INSERT INTO orders (";

/* ── A. writeDataWithOrder ──────────────────────────── */

test("0원 주문 저장이 INSERT 전에 orders 마이그레이션을 보장한다", () => {
  assert.ok(WRITE_ORDER.includes(ENSURE_CALL), "ensureOrdersMigration 호출이 없다");
  assert.ok(WRITE_ORDER.includes(ORDERS_INSERT), "orders INSERT를 찾지 못했다");
  assert.ok(
    WRITE_ORDER.indexOf(ENSURE_CALL) < WRITE_ORDER.indexOf(ORDERS_INSERT),
    "마이그레이션 보장이 INSERT 뒤로 밀렸다",
  );
  // 한 번만 부른다. 같은 문장 안이나 루프 안으로 들어가지 않았다.
  assert.equal(count(WRITE_ORDER, ENSURE_CALL), 1);
});

/* ── B. writeDataWithOrderForPayment ────────────────── */

test("승인 후 주문 저장이 INSERT 전에 orders 마이그레이션을 보장한다", () => {
  assert.ok(WRITE_FOR_PAYMENT.includes(ENSURE_CALL), "ensureOrdersMigration 호출이 없다");
  assert.ok(
    WRITE_FOR_PAYMENT.indexOf(ENSURE_CALL) < WRITE_FOR_PAYMENT.indexOf(ORDERS_INSERT),
    "마이그레이션 보장이 INSERT 뒤로 밀렸다",
  );
  assert.equal(count(WRITE_FOR_PAYMENT, ENSURE_CALL), 1);
  // 결제 쪽 준비도 그대로 남아 있다(한쪽을 다른 쪽으로 대체하지 않았다).
  assert.ok(WRITE_FOR_PAYMENT.includes("await ensurePaymentsMigration(sql);"));
  assert.ok(WRITE_FOR_PAYMENT.includes("await ensureAppStoreVersion(sql);"));
});

/* ── C. cold schema ────────────────────────────────── */

test("테이블 생성이 열 추가보다 먼저다", () => {
  // ALTER는 테이블이 있어야 돈다. 순서가 뒤집히면 빈 DB에서 그 자리가 깨진다.
  for (const [name, source] of [
    ["writeDataWithOrder", WRITE_ORDER],
    ["writeDataWithOrderForPayment", WRITE_FOR_PAYMENT],
    ["createPayment", CREATE_PAYMENT],
  ] as const) {
    const table = source.indexOf("await ensureTable(sql);");
    assert.notEqual(table, -1, name);
    assert.ok(table < source.indexOf(ENSURE_CALL), name);
  }
});

test("orders에 INSERT하는 경로는 이 둘뿐이고 둘 다 보장한다", () => {
  // 새 INSERT 경로가 생기면 여기서 걸린다.
  assert.equal(count(STORE, ORDERS_INSERT), 2);
  for (const source of [WRITE_ORDER, WRITE_FOR_PAYMENT]) {
    assert.ok(source.includes(ORDERS_INSERT));
    assert.ok(source.includes(ENSURE_CALL));
  }
});

test("승인 전 단계에서도 같은 준비를 거친다", () => {
  // createPayment는 preparePayment가 부르는 자리다. 열이 없다는 사실을
  // 승인 뒤가 아니라 결제창을 띄우기 전에 알 수 있어야 한다.
  assert.ok(CREATE_PAYMENT.includes(ENSURE_CALL), "createPayment가 보장하지 않는다");
  assert.ok(
    CREATE_PAYMENT.indexOf(ENSURE_CALL) < CREATE_PAYMENT.indexOf("INSERT INTO payments ("),
    "보장이 결제 INSERT 뒤로 밀렸다",
  );
});

/* ── D. migration 실패 ─────────────────────────────── */

test("마이그레이션이 실패하면 INSERT 문장을 보내지 않는다", () => {
  for (const [name, source] of [
    ["writeDataWithOrder", WRITE_ORDER],
    ["writeDataWithOrderForPayment", WRITE_FOR_PAYMENT],
    ["createPayment", CREATE_PAYMENT],
  ] as const) {
    // await 그대로 두고 삼키지 않는다. 오류는 호출부로 그대로 올라간다.
    assert.equal(source.includes("ensureOrdersMigration(sql).catch"), false, name);
    assert.equal(/ensureOrdersMigration\(sql\)\s*\)?\s*\.catch/.test(source), false, name);
    assert.equal(source.includes("try {"), false, `${name}: 준비 실패를 감싸는 try가 생겼다`);
  }
});

test("실패한 준비는 다음 요청이 다시 시도한다", () => {
  // 실패를 캐시에 남기면 그 인스턴스는 영구히 저장할 수 없게 된다.
  assert.match(ENSURE, /ordersMigration = null;/);
  assert.match(ENSURE, /throw error;/);
});

/* ── E. 이미 마이그레이션된 상태 ────────────────────── */

test("인스턴스당 한 번만 실행하는 캐시 의미를 유지한다", () => {
  // 같은 Promise를 돌려준다. 요청마다 ALTER를 다시 보내지 않는다.
  assert.match(ENSURE, /if \(!ordersMigration\) \{/);
  assert.match(ENSURE, /ordersMigration = runOrdersMigration\(sql\)/);
  assert.match(ENSURE, /return ordersMigration;/);
  // 기존 결제 마이그레이션과 같은 형태다(한쪽만 다른 방식이 되지 않는다).
  assert.match(STORE, /if \(!paymentsMigration\) \{/);
});

test("ALTER는 runOrdersMigration 한 곳에만 있다", () => {
  const alters = STORE.match(/ALTER TABLE orders ADD COLUMN IF NOT EXISTS [a-z_]+/g) ?? [];
  // retention 전용 열은 별도 파일(retentionStore.ts)이 맡는다.
  assert.deepEqual(alters.sort(), [
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS copyright_consent",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS production_started_at",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_consent",
  ]);
  // 저장 문장 안에서 DDL을 보내지 않는다.
  for (const source of [WRITE_ORDER, WRITE_FOR_PAYMENT]) {
    assert.equal(source.includes("ALTER TABLE"), false);
  }
});

/* ── F. 기존 저장 의미 ─────────────────────────────── */

test("DDL 의미를 바꾸지 않았다", () => {
  // 네 열 그대로, IF NOT EXISTS, NULL 허용, DEFAULT 없음.
  assert.equal(count(RUN, "ADD COLUMN IF NOT EXISTS"), 4);
  assert.equal(/ADD COLUMN IF NOT EXISTS \w+ \w+ (NOT NULL|DEFAULT)/.test(RUN), false);
  assert.equal(RUN.includes("UPDATE orders"), false, "backfill 문장이 생겼다");
  assert.equal(RUN.includes("SET refund_consent"), false);
  assert.equal(RUN.includes("SET copyright_consent"), false);
});

test("두 동의 증빙은 값이 없으면 NULL로 들어간다", () => {
  for (const source of [WRITE_ORDER, WRITE_FOR_PAYMENT]) {
    assert.ok(
      source.includes("order.refundConsent ? JSON.stringify(order.refundConsent) : null"),
    );
    assert.ok(
      source.includes("order.copyrightConsent ? JSON.stringify(order.copyrightConsent) : null"),
    );
  }
});

test("CAS와 결제 연결 의미가 그대로다", () => {
  for (const source of [WRITE_ORDER, WRITE_FOR_PAYMENT]) {
    // 주문은 CAS가 성공했을 때만 들어간다. 한 문장이라 중간 상태가 없다.
    assert.ok(source.includes("${casHead(expected)},"));
    assert.ok(source.includes("WHERE EXISTS (SELECT 1 FROM cas)"));
    assert.ok(source.includes("ON CONFLICT (id) DO NOTHING"));
    assert.ok(source.includes("SELECT version FROM cas"));
    assert.ok(source.includes("commitVersion(data, rows);"));
  }
  // 결제 연결도 같은 문장 안에 그대로 있다.
  assert.ok(WRITE_FOR_PAYMENT.includes("UPDATE payments"));
  assert.ok(WRITE_FOR_PAYMENT.includes("SET order_id = $${n + 1}, updated_at = now()"));
  // 파일 모드(DB 없음)는 예전처럼 JSONB만 저장한다.
  assert.ok(WRITE_ORDER.includes("if (!sql) return writeData(data);"));
});

/*
 * 실제 PostgreSQL이 필요한 범위(이 파일에서 다루지 않음)
 * - 열이 없는 빈 orders 테이블에 두 저장 경로가 처음 닿았을 때 INSERT가 성공하는지
 * - ALTER를 다시 실행해도 안전한지(IF NOT EXISTS 재실행)
 * - ALTER가 실패하는 상황(권한 부족 등)에서 INSERT가 한 행도 남기지 않는지
 * 기존 pointTransactions.test.sql / refundRequests.test.sql과 같은 fixture 자리다.
 */
