/**
 * 결제 복구 현황 집계 규칙 테스트 (Privacy-Payment-Recovery-Aggregate-1).
 *
 * 실행: node --test src/lib/server/paymentRecoveryAggregate.test.ts
 *
 * DB 없이 규칙 전부를 본다. 저장소를 아는 수단이 이 모듈에 없으므로
 * 가짜 질의 함수만 넘기면 모든 갈래를 확인할 수 있다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  PAYMENT_RECOVERY_AGGREGATE_SQL,
  PROCESSING_STALE_INTERVAL,
  readCount,
  readIso,
  runPaymentRecoveryAggregate,
  type PaymentRecoveryAggregateBody,
} from "./paymentRecoveryAggregate.ts";

/** 모든 칸이 채워진 한 행. 실제 질의가 돌려주는 모양과 같다. */
function fullRow(): Record<string, unknown> {
  return {
    ready_count: 3,
    ready_oldest: "2026-01-01T00:00:00.000Z",
    ready_newest: "2026-02-01T00:00:00.000Z",
    processing_count: 2,
    processing_oldest: "2026-01-05T00:00:00.000Z",
    processing_newest: "2026-01-06T00:00:00.000Z",
    processing_stale_count: 1,
    processing_oldest_touched: "2026-01-05T00:10:00.000Z",
    paid_count: 4,
    paid_oldest: "2026-01-02T00:00:00.000Z",
    paid_newest: "2026-03-01T00:00:00.000Z",
    failed_count: 5,
    failed_oldest: "2026-01-03T00:00:00.000Z",
    failed_newest: "2026-01-04T00:00:00.000Z",
  };
}

function deps(
  rows: readonly Record<string, unknown>[] | (() => never),
  databaseMode = true,
  onQuery?: () => void,
) {
  return {
    databaseMode: () => databaseMode,
    query: async () => {
      onQuery?.();
      if (typeof rows === "function") rows();
      return rows as readonly Record<string, unknown>[];
    },
  };
}

const NOW = "2026-09-19T00:00:00.000Z";

/* ── 정상 ───────────────────────────────────────────── */

test("네 그룹을 건수와 시각으로만 돌려준다", async () => {
  const response = await runPaymentRecoveryAggregate(deps([fullRow()]), NOW);
  assert.equal(response.status, 200);
  const body = response.body as PaymentRecoveryAggregateBody;
  assert.equal(body.action, "payment-recovery-aggregate");
  assert.equal(body.checkedAt, NOW);
  assert.equal(body.staleInterval, PROCESSING_STALE_INTERVAL);
  assert.deepEqual(body.groups.readyUnlinked, {
    count: 3,
    oldestCreatedAt: "2026-01-01T00:00:00.000Z",
    newestCreatedAt: "2026-02-01T00:00:00.000Z",
  });
  assert.deepEqual(body.groups.processingUnlinked, {
    count: 2,
    oldestCreatedAt: "2026-01-05T00:00:00.000Z",
    newestCreatedAt: "2026-01-06T00:00:00.000Z",
    staleCount: 1,
    oldestUpdatedAt: "2026-01-05T00:10:00.000Z",
  });
  assert.deepEqual(body.groups.paidUnlinked, {
    count: 4,
    oldestCreatedAt: "2026-01-02T00:00:00.000Z",
    newestCreatedAt: "2026-03-01T00:00:00.000Z",
  });
  assert.deepEqual(body.groups.failedUnlinked, {
    count: 5,
    oldestCreatedAt: "2026-01-03T00:00:00.000Z",
    newestCreatedAt: "2026-01-04T00:00:00.000Z",
  });
});

test("응답에 그룹 네 개 말고 다른 키가 없다", async () => {
  const response = await runPaymentRecoveryAggregate(deps([fullRow()]), NOW);
  const body = response.body as PaymentRecoveryAggregateBody;
  assert.deepEqual(Object.keys(body).sort(), ["action", "checkedAt", "groups", "staleInterval"]);
  assert.deepEqual(Object.keys(body.groups).sort(), [
    "failedUnlinked",
    "paidUnlinked",
    "processingUnlinked",
    "readyUnlinked",
  ]);
});

test("행에 섞여 온 값은 응답에 담기지 않는다", async () => {
  const row = {
    ...fullRow(),
    merchant_order_id: "is-secret",
    pg_tid: "tid-secret",
    order_snapshot: { details: { phone: "01000000000" } },
    raw: { buyerName: "홍길동" },
    id: "pay-1",
  };
  const response = await runPaymentRecoveryAggregate(deps([row]), NOW);
  const serialized = JSON.stringify(response.body);
  for (const leaked of ["is-secret", "tid-secret", "01000000000", "홍길동", "pay-1"]) {
    assert.equal(serialized.includes(leaked), false, `${leaked}가 응답에 있다`);
  }
});

test("0건이면 건수는 0이고 시각은 null이다", async () => {
  const empty: Record<string, unknown> = {
    ready_count: 0,
    ready_oldest: null,
    ready_newest: null,
    processing_count: 0,
    processing_oldest: null,
    processing_newest: null,
    processing_stale_count: 0,
    processing_oldest_touched: null,
    paid_count: 0,
    paid_oldest: null,
    paid_newest: null,
    failed_count: 0,
    failed_oldest: null,
    failed_newest: null,
  };
  const response = await runPaymentRecoveryAggregate(deps([empty]), NOW);
  assert.equal(response.status, 200);
  const body = response.body as PaymentRecoveryAggregateBody;
  assert.equal(body.groups.readyUnlinked.count, 0);
  assert.equal(body.groups.readyUnlinked.oldestCreatedAt, null);
  assert.equal(body.groups.processingUnlinked.oldestUpdatedAt, null);
});

test("드라이버가 건수를 문자열로 줘도 숫자로 읽는다", async () => {
  const row = { ...fullRow(), ready_count: "7", processing_stale_count: "0" };
  const response = await runPaymentRecoveryAggregate(deps([row]), NOW);
  const body = response.body as PaymentRecoveryAggregateBody;
  assert.equal(body.groups.readyUnlinked.count, 7);
  assert.equal(body.groups.processingUnlinked.staleCount, 0);
});

test("Date로 온 시각도 ISO 문자열로 담는다", async () => {
  const row = { ...fullRow(), ready_oldest: new Date("2026-01-01T00:00:00.000Z") };
  const response = await runPaymentRecoveryAggregate(deps([row]), NOW);
  const body = response.body as PaymentRecoveryAggregateBody;
  assert.equal(body.groups.readyUnlinked.oldestCreatedAt, "2026-01-01T00:00:00.000Z");
});

/* ── fail-closed ────────────────────────────────────── */

test("DB 모드가 아니면 세지 않고 409로 거절한다", async () => {
  let called = false;
  const response = await runPaymentRecoveryAggregate(
    deps([fullRow()], false, () => {
      called = true;
    }),
    NOW,
  );
  assert.equal(called, false, "질의를 보냈다");
  assert.equal(response.status, 409);
  assert.deepEqual(Object.keys(response.body).sort(), ["error", "message"]);
  assert.equal(
    (response.body as { error: string }).error,
    "DATABASE_MODE_REQUIRED",
  );
});

test("DB 모드가 아닐 때 0건으로 답하지 않는다", async () => {
  const response = await runPaymentRecoveryAggregate(deps([fullRow()], false), NOW);
  assert.equal("groups" in response.body, false);
});

test("질의가 실패하면 받은 오류를 담지 않고 500으로 답한다", async () => {
  const response = await runPaymentRecoveryAggregate(
    deps(() => {
      throw new Error("connect ECONNREFUSED postgres://user:pw@host/db");
    }),
    NOW,
  );
  assert.equal(response.status, 500);
  const serialized = JSON.stringify(response.body);
  assert.equal(serialized.includes("ECONNREFUSED"), false);
  assert.equal(serialized.includes("postgres://"), false);
  assert.equal((response.body as { error: string }).error, "AGGREGATE_FAILED");
});

test("행이 없으면 현황으로 보지 않는다", async () => {
  const response = await runPaymentRecoveryAggregate(deps([]), NOW);
  assert.equal(response.status, 500);
  assert.equal((response.body as { error: string }).error, "AGGREGATE_FAILED");
});

test("건수를 읽지 못하면 일부만 담아 내보내지 않는다", async () => {
  for (const key of [
    "ready_count",
    "processing_count",
    "processing_stale_count",
    "paid_count",
    "failed_count",
  ]) {
    const row = { ...fullRow(), [key]: "알 수 없음" };
    const response = await runPaymentRecoveryAggregate(deps([row]), NOW);
    assert.equal(response.status, 500, `${key}를 읽지 못했는데 200이다`);
  }
});

/* ── 값 읽기 ────────────────────────────────────────── */

test("readCount는 음수·소수·빈 값을 받지 않는다", () => {
  assert.equal(readCount(0), 0);
  assert.equal(readCount("12"), 12);
  assert.equal(readCount(-1), null);
  assert.equal(readCount(1.5), null);
  assert.equal(readCount("1.5"), null);
  assert.equal(readCount(null), null);
  assert.equal(readCount(undefined), null);
  assert.equal(readCount(true), null);
});

test("readIso는 없는 값을 지어내지 않는다", () => {
  assert.equal(readIso(null), null);
  assert.equal(readIso(undefined), null);
  assert.equal(readIso(""), null);
  assert.equal(readIso("아무 값"), null);
  assert.equal(readIso(new Date("2026-01-01T00:00:00.000Z")), "2026-01-01T00:00:00.000Z");
  assert.equal(readIso("2026-01-01T00:00:00Z"), "2026-01-01T00:00:00.000Z");
});

/* ── 질의문 ─────────────────────────────────────────── */

test("질의는 SELECT 하나이며 바꾸는 문장이 없다", () => {
  const sql = PAYMENT_RECOVERY_AGGREGATE_SQL;
  assert.equal([...sql.matchAll(/\bSELECT\b/g)].length, 1);
  for (const word of ["INSERT", "UPDATE", "DELETE", "ALTER", "CREATE", "DROP", "TRUNCATE"]) {
    assert.equal(new RegExp(`\\b${word}\\b`).test(sql), false, `${word}가 있다`);
  }
});

test("질의가 payments만 읽고 order_id는 조건으로만 쓴다", () => {
  const sql = PAYMENT_RECOVERY_AGGREGATE_SQL;
  assert.match(sql, /FROM\s+payments/);
  assert.equal([...sql.matchAll(/\bFROM\b/g)].length, 1);
  assert.match(sql, /WHERE order_id IS NULL/);
  // SELECT 목록 안에 order_id가 값으로 들어가지 않는다.
  const selectList = sql.slice(sql.indexOf("SELECT"), sql.indexOf("FROM"));
  assert.equal(selectList.includes("order_id"), false);
});

test("질의가 식별자 컬럼을 고르지 않는다", () => {
  const selectList = PAYMENT_RECOVERY_AGGREGATE_SQL.slice(
    PAYMENT_RECOVERY_AGGREGATE_SQL.indexOf("SELECT"),
    PAYMENT_RECOVERY_AGGREGATE_SQL.indexOf("FROM"),
  );
  for (const column of [
    "merchant_order_id",
    "pg_tid",
    "order_snapshot",
    "raw",
    "cancel_response_raw",
    "user_id",
    "userId",
  ]) {
    assert.equal(selectList.includes(column), false, `${column}을 고르고 있다`);
  }
  assert.equal(/SELECT\s+\*/.test(PAYMENT_RECOVERY_AGGREGATE_SQL), false);
});

test("질의가 행을 돌려주지 않는다", () => {
  const sql = PAYMENT_RECOVERY_AGGREGATE_SQL;
  assert.equal(/\bGROUP BY\b/.test(sql), false);
  assert.equal(/\bLIMIT\b/.test(sql), false);
  assert.equal(/\bORDER BY\b/.test(sql), false);
  // 고르는 것은 전부 집계 함수다.
  assert.equal([...sql.matchAll(/\b(count|min|max)\(/g)].length, 14);
});

test("질의에 바깥 값이 끼어들 자리가 없다", () => {
  assert.equal(/\$\d/.test(PAYMENT_RECOVERY_AGGREGATE_SQL), false);
  // 지연 기준만 상수에서 채운다.
  assert.ok(PAYMENT_RECOVERY_AGGREGATE_SQL.includes(`interval '${PROCESSING_STALE_INTERVAL}'`));
});
