/**
 * PG 응답 원문 보유 현황 규칙 테스트 (Privacy-Payment-Raw-Presence-1, -5).
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
  PAYMENT_RAW_PRESENCE_WITH_CANCEL_SQL,
  readCount,
  readIso,
  runPaymentRawPresence,
  type PaymentRawPresenceBody,
} from "./paymentRawPresence.ts";

const NOW = "2026-09-19T00:00:00.000Z";

/** 취소 열이 없을 때 돌아오는 행. 취소 쪽 칸이 아예 없다. */
function rawOnlyRow(): Record<string, unknown> {
  return {
    total_payments: 120,
    raw_present: 30,
    raw_emptyish: 4,
    raw_oldest: "2025-01-01T00:00:00.000Z",
    raw_newest: "2025-06-01T00:00:00.000Z",
  };
}

/** 취소 열이 있을 때 돌아오는 행. */
function fullRow(): Record<string, unknown> {
  return {
    ...rawOnlyRow(),
    cancel_raw_present: 2,
    cancel_raw_emptyish: 0,
    cancel_raw_oldest: "2025-03-01T00:00:00.000Z",
    cancel_raw_newest: "2025-04-01T00:00:00.000Z",
  };
}

interface Calls {
  column: number;
  rawOnly: number;
  withCancel: number;
}

type Rows = readonly Record<string, unknown>[] | (() => never);

function deps(options: {
  databaseMode?: boolean;
  column?: Rows;
  rawOnly?: Rows;
  withCancel?: Rows;
  calls?: Calls;
}) {
  const calls = options.calls ?? { column: 0, rawOnly: 0, withCancel: 0 };
  const run = (value: Rows | undefined, fallback: readonly Record<string, unknown>[]) => {
    if (typeof value === "function") value();
    return (value ?? fallback) as readonly Record<string, unknown>[];
  };
  return {
    databaseMode: () => options.databaseMode ?? true,
    queryColumn: async () => {
      calls.column += 1;
      return run(options.column, [{ found: 1 }]);
    },
    queryRawOnly: async () => {
      calls.rawOnly += 1;
      return run(options.rawOnly, [rawOnlyRow()]);
    },
    queryWithCancel: async () => {
      calls.withCancel += 1;
      return run(options.withCancel, [fullRow()]);
    },
  };
}

/* ── 열이 있을 때 ───────────────────────────────────── */

test("열이 있으면 양쪽을 실제로 집계한다", async () => {
  const calls: Calls = { column: 0, rawOnly: 0, withCancel: 0 };
  const response = await runPaymentRawPresence(deps({ column: [{ found: 1 }], calls }), NOW);
  assert.equal(response.status, 200);
  assert.deepEqual(calls, { column: 1, rawOnly: 0, withCancel: 1 });
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
    columnExists: true,
    present: 2,
    emptyish: 0,
    oldestCreatedAt: "2025-03-01T00:00:00.000Z",
    newestCreatedAt: "2025-04-01T00:00:00.000Z",
  });
});

/* ── 열이 없을 때 ───────────────────────────────────── */

test("열이 없어도 raw는 실제로 집계하고 취소 쪽은 전부 null이다", async () => {
  const calls: Calls = { column: 0, rawOnly: 0, withCancel: 0 };
  const response = await runPaymentRawPresence(deps({ column: [{ found: 0 }], calls }), NOW);
  assert.equal(response.status, 200, "열이 없다고 오류로 처리했다");
  const body = response.body as PaymentRawPresenceBody;
  // raw는 실제 값이다. 열 부재와 무관하게 센다.
  assert.equal(body.totalPayments, 120);
  assert.deepEqual(body.raw, {
    present: 30,
    emptyish: 4,
    oldestCreatedAt: "2025-01-01T00:00:00.000Z",
    newestCreatedAt: "2025-06-01T00:00:00.000Z",
  });
  assert.deepEqual(body.cancelResponseRaw, {
    columnExists: false,
    present: null,
    emptyish: null,
    oldestCreatedAt: null,
    newestCreatedAt: null,
  });
});

test("열이 없으면 그 열을 참조하는 질의를 보내지 않는다", async () => {
  const calls: Calls = { column: 0, rawOnly: 0, withCancel: 0 };
  await runPaymentRawPresence(
    deps({
      column: [{ found: 0 }],
      calls,
      withCancel: () => {
        throw new Error("없는 열을 참조하는 질의를 보냈다");
      },
    }),
    NOW,
  );
  assert.equal(calls.withCancel, 0, "취소 열을 참조하는 질의를 보냈다");
  assert.equal(calls.rawOnly, 1);
});

test("열 없음과 실제 0건을 다른 값으로 적는다", async () => {
  const missing = (await runPaymentRawPresence(deps({ column: [{ found: 0 }] }), NOW))
    .body as PaymentRawPresenceBody;
  const zero = (
    await runPaymentRawPresence(
      deps({
        column: [{ found: 1 }],
        withCancel: [{ ...fullRow(), cancel_raw_present: 0, cancel_raw_emptyish: 0, cancel_raw_oldest: null, cancel_raw_newest: null }],
      }),
      NOW,
    )
  ).body as PaymentRawPresenceBody;

  assert.equal(missing.cancelResponseRaw.columnExists, false);
  assert.equal(missing.cancelResponseRaw.present, null);
  assert.equal(zero.cancelResponseRaw.columnExists, true);
  assert.equal(zero.cancelResponseRaw.present, 0);
  assert.notDeepEqual(missing.cancelResponseRaw, zero.cancelResponseRaw);
});

/* ── 응답 모양 ──────────────────────────────────────── */

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
  assert.deepEqual(Object.keys(body.raw).sort(), [
    "emptyish",
    "newestCreatedAt",
    "oldestCreatedAt",
    "present",
  ]);
  assert.deepEqual(Object.keys(body.cancelResponseRaw).sort(), [
    "columnExists",
    "emptyish",
    "newestCreatedAt",
    "oldestCreatedAt",
    "present",
  ]);
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
  const response = await runPaymentRawPresence(deps({ withCancel: [row] }), NOW);
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
  const response = await runPaymentRawPresence(deps({ withCancel: [empty] }), NOW);
  assert.equal(response.status, 200);
  const body = response.body as PaymentRawPresenceBody;
  assert.equal(body.totalPayments, 0);
  assert.equal(body.raw.present, 0);
  assert.equal(body.raw.oldestCreatedAt, null);
  assert.equal(body.cancelResponseRaw.present, 0);
  assert.equal(body.cancelResponseRaw.newestCreatedAt, null);
});

test("emptyish가 present와 같아도 그대로 돌려준다", async () => {
  const row = { ...fullRow(), raw_present: 7, raw_emptyish: 7 };
  const response = await runPaymentRawPresence(deps({ withCancel: [row] }), NOW);
  const body = response.body as PaymentRawPresenceBody;
  assert.equal(body.raw.present, 7);
  assert.equal(body.raw.emptyish, 7);
});

test("드라이버가 건수를 문자열로 줘도 숫자로 읽는다", async () => {
  const row = { ...fullRow(), total_payments: "120", cancel_raw_present: "0" };
  const response = await runPaymentRawPresence(deps({ withCancel: [row] }), NOW);
  const body = response.body as PaymentRawPresenceBody;
  assert.equal(body.totalPayments, 120);
  assert.equal(body.cancelResponseRaw.present, 0);
});

test("Date로 온 시각도 ISO 문자열로 담는다", async () => {
  const row = { ...fullRow(), raw_oldest: new Date("2025-01-01T00:00:00.000Z") };
  const response = await runPaymentRawPresence(deps({ withCancel: [row] }), NOW);
  const body = response.body as PaymentRawPresenceBody;
  assert.equal(body.raw.oldestCreatedAt, "2025-01-01T00:00:00.000Z");
});

/* ── fail-closed ────────────────────────────────────── */

test("DB 모드가 아니면 어떤 질의도 보내지 않고 409로 거절한다", async () => {
  const calls: Calls = { column: 0, rawOnly: 0, withCancel: 0 };
  const response = await runPaymentRawPresence(deps({ databaseMode: false, calls }), NOW);
  assert.deepEqual(calls, { column: 0, rawOnly: 0, withCancel: 0 }, "질의를 보냈다");
  assert.equal(response.status, 409);
  assert.equal((response.body as { error: string }).error, "DATABASE_MODE_REQUIRED");
  assert.equal("raw" in response.body, false, "0건으로 답했다");
});

test("열 확인이 실패하면 집계를 보내지 않고 500으로 답한다", async () => {
  const calls: Calls = { column: 0, rawOnly: 0, withCancel: 0 };
  const response = await runPaymentRawPresence(
    deps({
      calls,
      column: () => {
        throw new Error("relation payments does not exist at postgres://u:pw@host/db");
      },
    }),
    NOW,
  );
  assert.equal(calls.rawOnly, 0, "확인에 실패했는데 집계를 보냈다");
  assert.equal(calls.withCancel, 0, "확인에 실패했는데 집계를 보냈다");
  assert.equal(response.status, 500);
  const serialized = JSON.stringify(response.body);
  assert.equal(serialized.includes("postgres://"), false);
  assert.equal(serialized.includes("does not exist"), false);
  assert.equal((response.body as { error: string }).error, "SCHEMA_CHECK_FAILED");
});

test("열 확인 결과를 읽지 못하면 열 없음으로 단정하지 않는다", async () => {
  for (const column of [[], [{}], [{ found: "알 수 없음" }], [{ found: -1 }]]) {
    const response = await runPaymentRawPresence(deps({ column }), NOW);
    assert.equal(response.status, 500, JSON.stringify(column));
    assert.equal((response.body as { error: string }).error, "SCHEMA_CHECK_FAILED");
    assert.equal("cancelResponseRaw" in response.body, false);
  }
});

test("집계가 실패하면 받은 오류를 담지 않고 500으로 답한다", async () => {
  const response = await runPaymentRawPresence(
    deps({
      withCancel: () => {
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

test("열이 없을 때의 집계가 실패해도 같은 규칙이다", async () => {
  const response = await runPaymentRawPresence(
    deps({
      column: [{ found: 0 }],
      rawOnly: () => {
        throw new Error("boom");
      },
    }),
    NOW,
  );
  assert.equal(response.status, 500);
  assert.equal((response.body as { error: string }).error, "PRESENCE_FAILED");
});

test("집계 행이 없으면 현황으로 보지 않는다", async () => {
  const response = await runPaymentRawPresence(deps({ withCancel: [] }), NOW);
  assert.equal(response.status, 500);
  assert.equal((response.body as { error: string }).error, "PRESENCE_FAILED");
});

test("있는 열의 건수를 읽지 못하면 일부만 담아 내보내지 않는다", async () => {
  for (const key of ["total_payments", "raw_present", "raw_emptyish"]) {
    const row = { ...fullRow(), [key]: "알 수 없음" };
    const response = await runPaymentRawPresence(deps({ withCancel: [row] }), NOW);
    assert.equal(response.status, 500, `${key}를 읽지 못했는데 200이다`);
  }
});

test("열이 있다고 했는데 취소 건수를 읽지 못하면 null로 눕히지 않는다", async () => {
  for (const key of ["cancel_raw_present", "cancel_raw_emptyish"]) {
    const row = { ...fullRow(), [key]: undefined };
    const response = await runPaymentRawPresence(deps({ withCancel: [row] }), NOW);
    assert.equal(response.status, 500, `${key}가 없는데 200이다`);
    assert.equal((response.body as { error: string }).error, "PRESENCE_FAILED");
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
  assert.equal(readIso(new Date("2025-01-01T00:00:00.000Z")), "2025-01-01T00:00:00.000Z");
  assert.equal(readIso("2025-01-01T00:00:00Z"), "2025-01-01T00:00:00.000Z");
});

/* ── 질의문 ─────────────────────────────────────────── */

test("세 질의 모두 SELECT 하나이며 바꾸는 문장이 없다", () => {
  for (const [name, sql] of [
    ["column", PAYMENT_RAW_COLUMN_SQL],
    ["rawOnly", PAYMENT_RAW_PRESENCE_SQL],
    ["withCancel", PAYMENT_RAW_PRESENCE_WITH_CANCEL_SQL],
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

test("열 없는 질의에는 cancel_response_raw라는 이름이 아예 없다", () => {
  assert.equal(PAYMENT_RAW_PRESENCE_SQL.includes("cancel_response_raw"), false);
  assert.equal(PAYMENT_RAW_PRESENCE_SQL.includes("cancel_raw"), false);
  // 반대로 있는 쪽 질의에는 있어야 한다.
  assert.ok(PAYMENT_RAW_PRESENCE_WITH_CANCEL_SQL.includes("cancel_response_raw"));
});

test("두 집계 질의는 raw 부분이 완전히 같다", () => {
  const rawPart = (sql: string) =>
    sql.slice(sql.indexOf("SELECT"), sql.indexOf("AS raw_newest") + "AS raw_newest".length);
  assert.equal(
    rawPart(PAYMENT_RAW_PRESENCE_SQL),
    rawPart(PAYMENT_RAW_PRESENCE_WITH_CANCEL_SQL),
  );
});

test("열 확인은 information_schema만 읽는다", () => {
  assert.match(PAYMENT_RAW_COLUMN_SQL, /FROM\s+information_schema\.columns/);
  assert.match(PAYMENT_RAW_COLUMN_SQL, /column_name = 'cancel_response_raw'/);
  assert.equal([...PAYMENT_RAW_COLUMN_SQL.matchAll(/\bFROM\b/g)].length, 1);
});

test("두 집계 모두 payments 전체를 한 행으로 센다", () => {
  for (const sql of [PAYMENT_RAW_PRESENCE_SQL, PAYMENT_RAW_PRESENCE_WITH_CANCEL_SQL]) {
    assert.match(sql, /FROM\s+payments/);
    assert.equal([...sql.matchAll(/\bFROM\b/g)].length, 1);
    assert.equal(/\bstatus\b/.test(sql), false, "상태로 가르고 있다");
    assert.equal(/\border_id\b/.test(sql), false, "연결 여부로 가르고 있다");
  }
  assert.equal([...PAYMENT_RAW_PRESENCE_SQL.matchAll(/\b(count|min|max)\(/g)].length, 5);
  assert.equal(
    [...PAYMENT_RAW_PRESENCE_WITH_CANCEL_SQL.matchAll(/\b(count|min|max)\(/g)].length,
    9,
  );
});

test("집계가 값이나 식별자를 고르지 않는다", () => {
  for (const sql of [PAYMENT_RAW_PRESENCE_SQL, PAYMENT_RAW_PRESENCE_WITH_CANCEL_SQL]) {
    const selectList = sql.slice(sql.indexOf("SELECT"), sql.indexOf("FROM payments"));
    for (const column of ["pg_tid", "merchant_order_id", "order_snapshot", "user_id", "order_id"]) {
      assert.equal(selectList.includes(column), false, `${column}을 고르고 있다`);
    }
    assert.equal(/SELECT\s+\*/.test(sql), false);
    assert.equal(/AS raw\b/.test(selectList), false);
    assert.equal(/AS cancel_response_raw\b/.test(selectList), false);
  }
});

test("emptyish 판정은 DB 안에서만 한다", () => {
  assert.match(PAYMENT_RAW_PRESENCE_SQL, /jsonb_typeof\(raw\) <> 'object' OR raw = '\{\}'::jsonb/);
  assert.match(
    PAYMENT_RAW_PRESENCE_WITH_CANCEL_SQL,
    /jsonb_typeof\(cancel_response_raw\) <> 'object'\s*\n?\s*OR cancel_response_raw = '\{\}'::jsonb/,
  );
});
