/**
 * orders.copyright_consent 배선 (Order-Consent-Copyright-Column-1).
 *
 * 실행: node --test src/lib/server/orderCopyrightConsentColumn.test.ts
 *
 * 저장 위치에 따라 Order의 뜻이 달라지면 안 된다. app_store JSONB로 읽든
 * orders 테이블로 읽든 copyrightConsent는 같은 값이거나 같은 "기록 없음"이어야 한다.
 *
 * 이 파일은 SQL 문장과 배선을 소스로 고정한다. 실제 PostgreSQL 왕복은
 * fixture가 필요해 여기서 하지 않는다(파일 끝의 주석 참고).
 * scrubOrderForRetention은 순수 함수라 직접 부른다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { scrubOrderForRetention } from "./retentionScrub.ts";
import type { ConsentRecord, Order } from "@/lib/types/app";

function read(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

const STORE = read("./store.ts");
const RETENTION_STORE = read("./retentionStore.ts");

/** refund_consent가 쓰이는 지점 수. copyright_consent도 같은 수만큼 있어야 한다. */
function countOf(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

/* ── DDL 정의 ──────────────────────────────────────── */

test("copyright_consent 컬럼을 기존 동의 컬럼과 같은 자리에서 더한다", () => {
  const at = STORE.indexOf("async function runOrdersMigration");
  assert.notEqual(at, -1);
  const body = STORE.slice(at, STORE.indexOf("\n}", at));
  assert.match(body, /ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_consent JSONB/);
  assert.match(body, /ALTER TABLE orders ADD COLUMN IF NOT EXISTS copyright_consent JSONB/);
});

test("NULL을 허용하고 기본값을 두지 않는다", () => {
  // 기본값을 두면 과거 행이 "동의 기록 있음"으로 바뀐다.
  assert.equal(
    /copyright_consent JSONB (NOT NULL|DEFAULT)/.test(STORE),
    false,
    "NOT NULL이나 DEFAULT가 붙어 있다",
  );
});

test("backfill 문장이 없다", () => {
  for (const pattern of [
    /UPDATE orders[\s\S]{0,400}?SET[\s\S]{0,200}?copyright_consent\s*=/,
    /copyright_consent\s*=\s*COALESCE/,
    /SET copyright_consent/,
  ]) {
    assert.equal(pattern.test(STORE), false, String(pattern));
  }
});

test("스키마는 ensureOrdersMigration 한 곳에서만 준비된다", () => {
  // 읽기 경로가 컬럼이 없는 테이블을 SELECT하면 그 자리에서 실패한다.
  // refund_consent와 같은 관문을 지나므로 따로 보장할 것이 없다.
  const alters = STORE.match(/ADD COLUMN IF NOT EXISTS copyright_consent[\w ]*/g) ?? [];
  assert.deepEqual(alters, ["ADD COLUMN IF NOT EXISTS copyright_consent JSONB"]);
});

/* ── 쓰기 경로 ─────────────────────────────────────── */

test("두 INSERT 경로 모두 copyright_consent를 담는다", () => {
  // writeDataWithOrder(0원 신청) / writeDataWithOrderForPayment(카드 승인)
  // INSERT 컬럼 목록 2곳. (같은 문자열이 SELECT 목록에도 있어 그쪽은 세지 않는다)
  assert.equal(countOf(STORE, "refund_consent, copyright_consent\n        )"), 2);
  assert.equal(
    countOf(STORE, "order.copyrightConsent ? JSON.stringify(order.copyrightConsent) : null"),
    2,
  );
  // refundConsent와 같은 방식이다. 값이 없으면 NULL이 들어간다.
  assert.equal(
    countOf(STORE, "order.refundConsent ? JSON.stringify(order.refundConsent) : null"),
    2,
  );
});

test("INSERT 컬럼 수와 값 수가 맞는다", () => {
  const inserts = STORE.match(/INSERT INTO orders \(([\s\S]*?)\)\n\s*SELECT ([\s\S]*?)\n\s*WHERE/g);
  assert.equal(inserts?.length, 2, "orders INSERT는 두 곳이다");
  for (const statement of inserts ?? []) {
    const columns = statement
      .slice(statement.indexOf("(") + 1, statement.indexOf(")"))
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const values = statement
      .slice(statement.indexOf("SELECT ") + 7)
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    assert.equal(columns.length, values.length, statement);
    assert.ok(columns.includes("copyright_consent"), statement);
  }
});

/* ── 읽기 경로 ─────────────────────────────────────── */

test("SELECT 목록과 행 타입에 컬럼이 있다", () => {
  assert.match(STORE, /delivered_at, refund_consent, copyright_consent`;/);
  const at = STORE.indexOf("interface OrderRow {");
  const row = STORE.slice(at, STORE.indexOf("}", at));
  assert.match(row, /refund_consent: unknown;/);
  assert.match(row, /copyright_consent: unknown;/);
});

test("NULL이면 키를 만들지 않는다", () => {
  const at = STORE.indexOf("function toOrder(row: OrderRow): Order");
  assert.notEqual(at, -1);
  const body = STORE.slice(at, STORE.indexOf("\n}", at));
  // refundConsent와 완전히 같은 형태다. 빈 객체나 agreed:false를 만들지 않는다.
  assert.match(body, /\.\.\.\(row\.refund_consent \? \{ refundConsent:/);
  assert.match(body, /\.\.\.\(row\.copyright_consent/);
  assert.equal(/copyrightConsent: \{ agreed/.test(body), false);
});

test("ORDER_COLUMNS를 쓰는 읽기 경로가 모두 마이그레이션을 먼저 보장한다", () => {
  // 컬럼이 없는 테이블에 SELECT가 먼저 가면 그 경로만 깨진다.
  const reads = STORE.match(/await ensureOrdersMigration\(sql\);/g) ?? [];
  assert.ok(reads.length >= 3, "listOrdersByUser·listOrders·getOrderById 세 곳 이상");
  for (const query of STORE.match(/SELECT \$\{ORDER_COLUMNS\} FROM orders[^`]*/g) ?? []) {
    const at = STORE.indexOf(query);
    // 같은 함수 안에서 SELECT보다 앞서 준비가 끝난다.
    const before = STORE.slice(Math.max(0, at - 700), at);
    assert.match(before, /await ensureOrdersMigration\(sql\);/, query);
  }
});

/* ── retention / scrub 보존 ────────────────────────── */

const CONSENT: ConsentRecord = {
  agreed: true,
  agreedAt: "2026-09-24T01:02:03.000Z",
  version: "unconfirmed-draft",
};

function orderFixture(): Order {
  return {
    id: "o-1",
    userId: "u-1",
    product: "story",
    title: "이야기로 만드는 인생곡",
    status: "완료",
    amount: 300000,
    payment: "신용/체크카드",
    details: { 주인공: "부모님", optionIds: "video", 이름: "홍길동" },
    createdAt: "2026-01-01T00:00:00.000Z",
    refundConsent: CONSENT,
    copyrightConsent: CONSENT,
  };
}

test("보관 만료가 두 동의 증빙을 그대로 남긴다", () => {
  const scrubbed = scrubOrderForRetention(orderFixture());
  assert.deepEqual(scrubbed.refundConsent, CONSENT);
  assert.deepEqual(scrubbed.copyrightConsent, CONSENT);
  // 지우는 것은 details뿐이다.
  assert.equal(scrubbed.details.이름, undefined);
  assert.equal(scrubbed.details.optionIds, "video");
});

test("증빙이 없는 주문을 지나가도 키가 생기지 않는다", () => {
  const legacy = orderFixture();
  delete legacy.refundConsent;
  delete legacy.copyrightConsent;
  const scrubbed = scrubOrderForRetention(legacy);
  assert.equal("refundConsent" in scrubbed, false);
  assert.equal("copyrightConsent" in scrubbed, false);
});

test("보관 만료 SQL이 동의 컬럼을 비우지 않는다", () => {
  for (const column of ["refund_consent", "copyright_consent"]) {
    assert.equal(RETENTION_STORE.includes(`${column} =`), false, column);
  }
});

/* ── refundConsent 회귀 ────────────────────────────── */

test("refundConsent 배선은 그대로다", () => {
  assert.equal(countOf(STORE, "refund_consent"), countOf(STORE, "copyright_consent"));
  assert.match(STORE, /ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_consent JSONB/);
});

/*
 * 실제 PostgreSQL이 필요한 범위(이 파일에서 다루지 않음)
 * - ALTER가 이미 컬럼이 있는 테이블에서도 안전한지(IF NOT EXISTS 재실행)
 * - INSERT → SELECT 왕복에서 JSONB가 ConsentRecord로 그대로 돌아오는지
 * - 컬럼이 없는 과거 스냅샷 테이블에서 ensureOrdersMigration이 먼저 도는지
 * 기존 refund_requests 계열과 같은 .test.sql fixture 자리다.
 */
