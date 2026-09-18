/**
 * PG 응답 원문 보유 현황 규칙 테스트 (Privacy-Payment-Raw-Presence-1).
 *
 * 실행: node --test src/lib/server/paymentRawPresence.test.ts
 *
 * DB 없이 규칙 전부를 본다. 저장소를 아는 수단이 이 모듈에 없으므로
 * 가짜 질의 함수만 넘기면 모든 갈래를 확인할 수 있다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  PAYMENT_RAW_COLUMN_SQL,
  PAYMENT_RAW_PRESENCE_SQL,
  readCount,
  readIso,
  runPaymentRawPresence,
  type PaymentRawPresenceBody,
} from "./paymentRawPresence.ts";

const NOW = "2026-09-19T00:00:00.000Z";

/** 모든 칸이 채워진 한 행. 실제 질의가 돌려주는 모양과 같다. */
function fullRow(): Record<string, unknown> {
  return {
    total_payments: 120,
    raw_present: 30,
    raw_emptyish: 4,
    raw_oldest: "2025-01-01T00:00:00.000Z",
    raw_newest: "2025-06-01T00:00:00.000Z",
    cancel_raw_present: 2,
    cancel_raw_emptyish: 0,
    cancel_raw_oldest: "2025-03-01T00:00:00.000Z",
    cancel_raw_newest: "2025-04-01T00:00:00.000Z",
  };
}

interface Calls {
  column: number;
  presence: number;
}

function deps(options: {
  databaseMode?: boolean;
  column?: readonly Record<string, unknown>[] | (() => never);
  presence?: readonly Record<string, unknown>[] | (() => never);
  calls?: Calls;
}) {
  const calls = options.calls ?? { column: 0, presence: 0 };
  const run = (value: readonly Record<string, unknown>[] | (() => never) | undefined) => {
    if (typeof value === "function") value();
    return (value ?? []) as readonly Record<string, unknown>[];
  };
  return {
    databaseMode: () => options.databaseMode ?? true,
    queryColumn: async () => {
      calls.column += 1;
      return run(options.column ?? [{ found: 1 }]);
    },
    queryPresence: async () => {
      calls.presence += 1;
      return run(options.presence ?? [fullRow()]);
    },
  };
}

/* ── 정상 ───────────────────────────────────────────── */

test("두 열의 현황을 건수와 시각으로만 돌려준다", async () => {
  const response = await runPaymentRawPresence(deps({}), NOW);
  assert.equal(response.status, 200);
  const body = response.body as PaymentRawPresenceBody;
  assert.equal(body.action, "payment-raw-presence");
  assert.equal(body.checkedAt, NOW);
  assert.equal(body.totalPayments, 120);
  assert.deepEqual(body.raw, {
    present: 30,
    emptyish: 4,
    oldestCreatedAt: "2025-01-01T00:00:00.000Z",
    newestCreatedAt: "2025-06-01T00:00:00.000Z",
  });
  assert.deepEqual(body.cancelResponseRaw, {
    present: 2,
    emptyish: 0,
    oldestCreatedAt: "2025-03-01T00:00:00.000Z",
    newestCreatedAt: "2025-04-01T00:00:00.000Z",
  });
});

test("응답에 정해 둔 키 말고 다른 것이 없다", async () => {
  const response = await runPaymentRawPresence(deps({}), NOW);
  const body = response.body as PaymentRawPresenceBody;
  assert.deepEqual(Object.keys(body).sort(), [
    "action",
    "cancelResponseRaw",
    "checkedAt",
    "raw",
    "totalPayments",
  ]);
  for (const group of [body.raw, body.cancelResponseRaw]) {
    assert.deepEqual(Object.keys(group).sort(), [
      "emptyish",
      "newestCreatedAt",
      "oldestCreatedAt",
      "present",
    ]);
  }
});

test("스키마 상태를 성공 응답에 담지 않는다", async () => {
  const response = await runPaymentRawPresence(deps({}), NOW);
  const serialized = JSON.stringify(response.body);
  for (const leaked of ["schema", "found", "cancelResponseRawColumn", "column"]) {
    assert.equal(serialized.includes(leaked), false, `${leaked}가 응답에 있다`);
  }
});

test("행에 섞여 온 값은 응답에 담기지 않는다", async () => {
  const row = {
    ...fullRow(),
    raw: { buyerName: "홍길동", card: "1234" },
    cancel_response_raw: { msg: "취소" },
    id: "pay-1",
    pg_tid: "tid-secret",
    merchant_order_id: "is-secret",
    order_id: "o-1",
    order_snapshot: { details: { phone: "01000000000" } },
    user_id: "u-1",
  };
  const response = await runPaymentRawPresence(deps({ presence: [row] }), NOW);
  const serialized = JSON.stringify(response.body);
  for (const leaked of [
    "홍길동",
    "1234",
    "취소",
    "pay-1",
    "tid-secret",
    "is-secret",
    "o-1",
    "01000000000",
    "u-1",
  ]) {
    assert.equal(serialized.includes(leaked), false, `${leaked}가 응답에 있다`);
  }
});

test("0건이면 건수는 0이고 시각은 null이다", async () => {
  const empty: Record<string, unknown> = {
    total_payments: 0,
    raw_present: 0,
    raw_emptyish: 0,
    raw_oldest: null,
    raw_newest: null,
    cancel_raw_present: 0,
    cancel_raw_emptyish: 0,
    cancel_raw_oldest: null,
    cancel_raw_newest: null,
  };
  const response = await runPaymentRawPresence(deps({ presence: [empty] }), NOW);
  assert.equal(response.status, 200);
  const body = response.body as PaymentRawPresenceBody;
  assert.equal(body.totalPayments, 0);
  assert.equal(body.raw.present, 0);
  assert.equal(body.raw.oldestCreatedAt, null);
  assert.equal(body.cancelResponseRaw.newestCreatedAt, null);
});

test("emptyish가 present와 같아도 그대로 돌려준다", async () => {
  // 열은 차 있지만 내용이 없는 경우. 두 값을 합치거나 감추지 않는다.
  const row = { ...fullRow(), raw_present: 7, raw_emptyish: 7 };
  const response = await runPaymentRawPresence(deps({ presence: [row] }), NOW);
  const body = response.body as PaymentRawPresenceBody;
  assert.equal(body.raw.present, 7);
  assert.equal(body.raw.emptyish, 7);
});

test("드라이버가 건수를 문자열로 줘도 숫자로 읽는다", async () => {
  const row = { ...fullRow(), total_payments: "120", cancel_raw_present: "0" };
  const response = await runPaymentRawPresence(deps({ presence: [row] }), NOW);
  const body = response.body as PaymentRawPresenceBody;
  assert.equal(body.totalPayments, 120);
  assert.equal(body.cancelResponseRaw.present, 0);
});

test("Date로 온 시각도 ISO 문자열로 담는다", async () => {
  const row = { ...fullRow(), raw_oldest: new Date("2025-01-01T00:00:00.000Z") };
  const response = await runPaymentRawPresence(deps({ presence: [row] }), NOW);
  const body = response.body as PaymentRawPresenceBody;
  assert.equal(body.raw.oldestCreatedAt, "2025-01-01T00:00:00.000Z");
});

/* ── fail-closed ────────────────────────────────────── */

test("DB 모드가 아니면 어떤 질의도 보내지 않고 409로 거절한다", async () => {
  const calls: Calls = { column: 0, presence: 0 };
  const response = await runPaymentRawPresence(deps({ databaseMode: false, calls }), NOW);
  assert.deepEqual(calls, { column: 0, presence: 0 }, "질의를 보냈다");
  assert.equal(response.status, 409);
  assert.equal((response.body as { error: string }).error, "DATABASE_MODE_REQUIRED");
  assert.equal("raw" in response.body, false, "0건으로 답했다");
});

test("열이 없으면 0으로 답하지 않고 집계 질의도 보내지 않는다", async () => {
  const calls: Calls = { column: 0, presence: 0 };
  const response = await runPaymentRawPresence(deps({ column: [{ found: 0 }], calls }), NOW);
  assert.equal(calls.column, 1);
  assert.equal(calls.presence, 0, "열이 없는데 집계를 보냈다");
  assert.equal(response.status, 409);
  assert.equal((response.body as { error: string }).error, "SCHEMA_NOT_READY");
  assert.equal("totalPayments" in response.body, false);
});

test("열 확인 결과를 읽지 못해도 fail-closed다", async () => {
  for (const column of [[], [{}], [{ found: "알 수 없음" }], [{ found: -1 }]]) {
    const response = await runPaymentRawPresence(deps({ column }), NOW);
    assert.equal(response.status, 409, JSON.stringify(column));
    assert.equal((response.body as { error: string }).error, "SCHEMA_NOT_READY");
  }
});

test("열 확인이 실패하면 받은 오류를 담지 않는다", async () => {
  const response = await runPaymentRawPresence(
    deps({
      column: () => {
        throw new Error("relation payments does not exist at postgres://u:pw@host/db");
      },
    }),
    NOW,
  );
  assert.equal(response.status, 409);
  const serialized = JSON.stringify(response.body);
  assert.equal(serialized.includes("postgres://"), false);
  assert.equal(serialized.includes("does not exist"), false);
  assert.equal((response.body as { error: string }).error, "SCHEMA_NOT_READY");
});

test("집계가 실패하면 받은 오류를 담지 않고 500으로 답한다", async () => {
  const response = await runPaymentRawPresence(
    deps({
      presence: () => {
        throw new Error("connect ECONNREFUSED postgres://user:pw@host/db");
      },
    }),
    NOW,
  );
  assert.equal(response.status, 500);
  const serialized = JSON.stringify(response.body);
  assert.equal(serialized.includes("ECONNREFUSED"), false);
  assert.equal(serialized.includes("postgres://"), false);
  assert.equal((response.body as { error: string }).error, "PRESENCE_FAILED");
});

test("집계 행이 없으면 현황으로 보지 않는다", async () => {
  const response = await runPaymentRawPresence(deps({ presence: [] }), NOW);
  assert.equal(response.status, 500);
  assert.equal((response.body as { error: string }).error, "PRESENCE_FAILED");
});

test("건수를 읽지 못하면 일부만 담아 내보내지 않는다", async () => {
  for (const key of [
    "total_payments",
    "raw_present",
    "raw_emptyish",
    "cancel_raw_present",
    "cancel_raw_emptyish",
  ]) {
    const row = { ...fullRow(), [key]: "알 수 없음" };
    const response = await runPaymentRawPresence(deps({ presence: [row] }), NOW);
    assert.equal(response.status, 500, `${key}를 읽지 못했는데 200이다`);
  }
});

test("질의 차례는 열 확인이 먼저다", async () => {
  const calls: Calls = { column: 0, presence: 0 };
  await runPaymentRawPresence(deps({ calls }), NOW);
  assert.deepEqual(calls, { column: 1, presence: 1 }, "각 질의는 한 번씩만 보낸다");
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
  assert.equal(readIso(new Date("2025-01-01T00:00:00.000Z")), "2025-01-01T00:00:00.000Z");
  assert.equal(readIso("2025-01-01T00:00:00Z"), "2025-01-01T00:00:00.000Z");
});

/* ── 질의문 ─────────────────────────────────────────── */

test("두 질의 모두 SELECT 하나이며 바꾸는 문장이 없다", () => {
  for (const [name, sql] of [
    ["column", PAYMENT_RAW_COLUMN_SQL],
    ["presence", PAYMENT_RAW_PRESENCE_SQL],
  ] as const) {
    assert.equal([...sql.matchAll(/\bSELECT\b/g)].length, 1, name);
    for (const word of ["INSERT", "UPDATE", "DELETE", "ALTER", "CREATE", "DROP", "TRUNCATE"]) {
      assert.equal(new RegExp(`\\b${word}\\b`).test(sql), false, `${name}에 ${word}가 있다`);
    }
    assert.equal(/\bGROUP BY\b/.test(sql), false, name);
    assert.equal(/\bORDER BY\b/.test(sql), false, name);
    assert.equal(/\bLIMIT\b/.test(sql), false, name);
    assert.equal(/\$\d/.test(sql), false, `${name}에 바깥 값이 끼어들 자리가 있다`);
  }
});

test("열 확인은 information_schema만 읽는다", () => {
  assert.match(PAYMENT_RAW_COLUMN_SQL, /FROM\s+information_schema\.columns/);
  assert.match(PAYMENT_RAW_COLUMN_SQL, /column_name = 'cancel_response_raw'/);
  assert.equal([...PAYMENT_RAW_COLUMN_SQL.matchAll(/\bFROM\b/g)].length, 1);
});

test("집계는 payments 전체를 한 행으로 센다", () => {
  const sql = PAYMENT_RAW_PRESENCE_SQL;
  assert.match(sql, /FROM\s+payments/);
  assert.equal([...sql.matchAll(/\bFROM\b/g)].length, 1);
  // 상태나 연결 여부로 가르지 않는다. WHERE 자체가 없다.
  assert.equal(/\bWHERE\b(?![^)]*\))/.test(sql.replace(/FILTER \([^)]*\)/g, "")), false);
  assert.equal(/\bstatus\b/.test(sql), false, "상태로 가르고 있다");
  assert.equal(/\border_id\b/.test(sql), false, "연결 여부로 가르고 있다");
  // 고르는 것은 전부 집계 함수다.
  assert.equal([...sql.matchAll(/\b(count|min|max)\(/g)].length, 9);
});

test("집계가 값이나 식별자를 고르지 않는다", () => {
  const selectList = PAYMENT_RAW_PRESENCE_SQL.slice(
    PAYMENT_RAW_PRESENCE_SQL.indexOf("SELECT"),
    PAYMENT_RAW_PRESENCE_SQL.indexOf("FROM payments"),
  );
  for (const column of ["pg_tid", "merchant_order_id", "order_snapshot", "user_id", "order_id"]) {
    assert.equal(selectList.includes(column), false, `${column}을 고르고 있다`);
  }
  assert.equal(/SELECT\s+\*/.test(PAYMENT_RAW_PRESENCE_SQL), false);
  // raw와 cancel_response_raw는 조건 안에서만 쓰이고 값으로 나오지 않는다.
  assert.equal(/AS raw\b/.test(selectList), false);
  assert.equal(/AS cancel_response_raw\b/.test(selectList), false);
  assert.equal(/,\s*raw\s*[,\n]/.test(selectList), false, "raw를 값으로 고르고 있다");
});

test("emptyish 판정은 DB 안에서만 한다", () => {
  const sql = PAYMENT_RAW_PRESENCE_SQL;
  assert.match(sql, /jsonb_typeof\(raw\) <> 'object' OR raw = '\{\}'::jsonb/);
  assert.match(
    sql,
    /jsonb_typeof\(cancel_response_raw\) <> 'object'\s*\n?\s*OR cancel_response_raw = '\{\}'::jsonb/,
  );
});
