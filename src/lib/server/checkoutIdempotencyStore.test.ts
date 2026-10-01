/**
 * 신청(checkout) 단위 중복 결제 방지 — 저장 계층 1단계 (P1-03).
 *
 * 실행: npx tsx --test src/lib/server/checkoutIdempotencyStore.test.ts
 *   (store.ts가 "@/..." 별칭을 쓰므로 node --test로는 불러올 수 없다.)
 *
 * DB에 접속하지 않는다. 오류 판별은 함수로 직접 부르고, SQL·흐름은 원문으로 고정한다
 * (store.ts는 SQL client를 주입받지 않아 함수 단위로 DB 없이 실행할 수 없다).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  CHECKOUT_ACTIVE_INDEX,
  CheckoutPaymentActiveError,
  claimProcessingError,
  isCheckoutActiveConflict,
} from "./store.ts";

const STORE = readFileSync(new URL("./store.ts", import.meta.url), "utf8");

function bodyOf(signature: string): string {
  const start = STORE.indexOf(signature);
  assert.ok(start >= 0, signature);
  const end = STORE.indexOf("\n}\n", start);
  return STORE.slice(start, end);
}

function squash(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/* ── migration ─────────────────────────────────────── */

const MIGRATION = bodyOf("async function runPaymentsMigration(");

test("migration: checkout_id 열과 정확한 부분 UNIQUE 술어", () => {
  assert.equal(CHECKOUT_ACTIVE_INDEX, "payments_checkout_active_key");
  assert.match(MIGRATION, /ALTER TABLE payments ADD COLUMN IF NOT EXISTS checkout_id TEXT`/);
  assert.ok(
    squash(MIGRATION).includes(
      squash(`
        CREATE UNIQUE INDEX IF NOT EXISTS \${CHECKOUT_ACTIVE_INDEX}
          ON payments (checkout_id)
          WHERE provider = 'nicepay'
            AND status IN ('processing', 'paid')
            AND checkout_id IS NOT NULL
      `),
    ),
  );
});

test("migration: 같은 트랜잭션 안에 있고 backfill하지 않는다", () => {
  assert.match(MIGRATION, /await sql\.transaction\(\(txn\) => \[/);
  const checkoutPart = MIGRATION.slice(MIGRATION.indexOf("checkout_id"));
  assert.ok(checkoutPart.indexOf("]);") > 0, "인덱스가 트랜잭션 배열 안에 있어야 한다");
  // 기존 행을 채우는 문장이 없다.
  assert.doesNotMatch(MIGRATION, /UPDATE payments/);
  assert.doesNotMatch(MIGRATION, /SET checkout_id/);
});

/* ── createPayment ─────────────────────────────────── */

test("createPayment: checkoutId는 optional이고 없으면 NULL로 INSERT", () => {
  const body = bodyOf("export async function createPayment(");
  assert.match(body, /checkoutId\?: string \| null;/);
  assert.match(squash(body), /order_snapshot, checkout_id \) VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, \$7::jsonb, \$8\)/);
  assert.match(body, /input\.checkoutId \?\? null,/);
  // 중복 merchant_order_id 처리 방식은 그대로다.
  assert.match(body, /ON CONFLICT \(merchant_order_id\) DO NOTHING/);
});

/* ── hasActiveCheckoutPayment ──────────────────────── */

test("hasActiveCheckoutPayment: nicepay · processing/paid · checkout_id 일치만 본다", () => {
  const body = squash(bodyOf("export async function hasActiveCheckoutPayment("));
  assert.match(body, /Promise<boolean>/);
  assert.match(
    body,
    /WHERE checkout_id = \$1 AND provider = 'nicepay' AND status IN \('processing', 'paid'\) LIMIT 1/,
  );
  assert.match(body, /return rows\.length > 0;/);
});

/* ── isCheckoutActiveConflict ──────────────────────── */

test("isCheckoutActiveConflict: 23505 + 정확한 제약 이름만 참", () => {
  assert.equal(isCheckoutActiveConflict({ code: "23505", constraint: CHECKOUT_ACTIVE_INDEX }), true);
  const neonLike = Object.assign(new Error("duplicate key value"), {
    code: "23505",
    constraint: "payments_checkout_active_key",
  });
  assert.equal(isCheckoutActiveConflict(neonLike), true);
});

test("isCheckoutActiveConflict: 다른 제약·다른 코드·일반 오류는 거짓", () => {
  for (const value of [
    { code: "23505", constraint: "payments_merchant_order_id_key" },
    { code: "23505" },
    { code: "23503", constraint: CHECKOUT_ACTIVE_INDEX },
    { code: 23505, constraint: CHECKOUT_ACTIVE_INDEX },
    new Error("connection reset"),
    null,
    undefined,
    "23505",
    42,
  ]) {
    assert.equal(isCheckoutActiveConflict(value), false, JSON.stringify(value));
  }
});

/* ── claimPaymentProcessing ────────────────────────── */

test("claimProcessingError: 해당 충돌만 CheckoutPaymentActiveError로 바꾼다", () => {
  const mapped = claimProcessingError({ code: "23505", constraint: CHECKOUT_ACTIVE_INDEX });
  assert.ok(mapped instanceof CheckoutPaymentActiveError);
});

test("claimProcessingError: 다른 오류는 같은 객체를 그대로 돌려준다(재throw)", () => {
  const other = Object.assign(new Error("dup"), {
    code: "23505",
    constraint: "payments_merchant_order_id_key",
  });
  const network = new Error("fetch failed");
  assert.equal(claimProcessingError(other), other);
  assert.equal(claimProcessingError(network), network);
});

test("claimPaymentProcessing: 정상/null 경로는 그대로이고 오류만 claimProcessingError를 거친다", () => {
  const body = squash(bodyOf("export async function claimPaymentProcessing("));
  assert.match(body, /Promise<Payment \| null>/);
  assert.match(
    body,
    /UPDATE payments SET status = 'processing', updated_at = now\(\) WHERE merchant_order_id = \$1 AND status = 'ready'/,
  );
  assert.match(body, /catch \(error\) \{ throw claimProcessingError\(error\); \}/);
  assert.match(body, /return rows\[0\] \? toPayment\(rows\[0\]\) : null;/);
});

test("claimPaymentApproved는 바뀌지 않았다(충돌 처리 없음)", () => {
  const body = bodyOf("export async function claimPaymentApproved(");
  assert.doesNotMatch(body, /claimProcessingError|CheckoutPaymentActiveError|checkout_id/);
});
