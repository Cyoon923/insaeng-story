/**
 * 적립금 전액 사용 0원 환불 완료 저장 테스트 (P1-09 2단계).
 *
 * 실행: node --test src/lib/server/zeroPointsRefundStore.test.ts
 *
 * DB에 접속하지 않는다. DB 드라이버(@neondatabase/serverless)를 가짜로 바꿔
 * store.ts의 completeZeroPointsRefundOnce가 보내는 문장과 인자, 결과 해석,
 * 메모리 잔액 되돌림을 본다. 가짜 DB는 정해 둔 결과 행을 돌려줄 뿐이다.
 *
 * ★ 한계: 한 문장 안의 원자성(guard의 전체 되돌림)·잠금·UNIQUE·동시 2요청의 실제 동작은
 * PostgreSQL에서만 확인된다. 여기서는 그 보장을 만드는 조건이 문장에 빠짐없이 있는지를
 * 원문으로 고정한다. 실제 동작은 후속 테스트 DB 통합 검증에서 본다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { AppData, User } from "@/lib/types/app";

const SRC_ROOT = new URL("../../", import.meta.url);
const NEON_STUB = "stub:neon";
const NEXT_HEADERS_STUB = "stub:next-headers";

/* ── 가짜 DB ───────────────────────────────────────── */

type Call = { text: string; params: unknown[] };
type MainResult = Record<string, unknown> | Error;

const fake = {
  calls: [] as Call[],
  /** 다음 본 문장(completeZeroPointsRefundOnce)이 돌려줄 결과. 차례대로 꺼낸다. */
  main: [] as MainResult[],
  store: { data: {} as unknown, version: 5 },
};
(globalThis as Record<string, unknown>).__p109FakeSql = {
  query: async (text: string, params: unknown[] = []) => {
    fake.calls.push({ text, params });
    if (text.includes("WITH target_order AS")) {
      const next = fake.main.shift();
      assert.ok(next, "본 문장 결과를 준비하지 않았다");
      if (next instanceof Error) throw next;
      return [next];
    }
    if (text.includes("SELECT data, version FROM app_store")) {
      return [{ data: fake.store.data, version: fake.store.version }];
    }
    return []; // 테이블 준비 등
  },
  transaction: async () => [],
};

type Resolved = { url: string; format?: string; shortCircuit?: boolean };
type Loaded = { format: string; source: string; shortCircuit?: boolean };
type Hooks = {
  resolve(specifier: string, context: unknown, next: (s: string, c: unknown) => Resolved): Resolved;
  load(url: string, context: unknown, next: (u: string, c: unknown) => Loaded): Loaded;
};
const { registerHooks } = (await import("node:module")) as unknown as {
  registerHooks: (hooks: Hooks) => void;
};
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "@neondatabase/serverless") return { url: NEON_STUB, shortCircuit: true };
    if (specifier === "next/headers") return { url: NEXT_HEADERS_STUB, shortCircuit: true };
    if (specifier.startsWith("@/")) {
      return next(new URL(`${specifier.slice(2)}.ts`, SRC_ROOT).href, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === NEON_STUB) {
      return {
        format: "module",
        source: "export const neon = () => globalThis.__p109FakeSql;",
        shortCircuit: true,
      };
    }
    if (url === NEXT_HEADERS_STUB) {
      return {
        format: "module",
        source: "export const cookies = async () => ({ get: () => undefined });",
        shortCircuit: true,
      };
    }
    return next(url, context);
  },
});

process.env.DATABASE_URL = "postgres://stub/never-connected";
const store = await import("./store.ts");

/* ── 준비 ─────────────────────────────────────────── */

const INPUT = {
  refundRequestId: "rr-1",
  orderId: "o-1",
  userId: "u-1",
  pointsUsed: 149000,
  baseAmount: 149000,
};

function user(extra: Partial<User> = {}): User {
  return {
    id: "u-1",
    phone: "01000000000",
    email: "",
    name: "회원",
    gender: "",
    birth: "",
    birthTime: "",
    unknownTime: false,
    calendar: "solar",
    bloodType: "",
    points: 1000,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...extra,
  };
}

/** 실제 readData를 거쳐 version이 기억된 AppData를 만든다. */
async function freshData(users: User[] = [user()], version = 5): Promise<AppData> {
  fake.calls = [];
  fake.main = [];
  fake.store = { data: { users }, version };
  return store.readData();
}

function row(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: null,
    inserted: 0,
    closed: 0,
    order_ok: 1,
    refund_status: "approved",
    payment_count: 0,
    restored: 0,
    ...extra,
  };
}

const mainCalls = () => fake.calls.filter((call) => call.text.includes("WITH target_order AS"));
const pointsOf = (data: AppData) => data.users.find((item) => item.id === "u-1")?.points;

/* ── 정상 ─────────────────────────────────────────── */

test("정상: 잔액 + 원장 + completed가 한 문장에서 성립하면 applied, 잔액·version 반영", async () => {
  const data = await freshData();
  fake.main.push(row({ version: 6, inserted: 1, closed: 1 }));
  assert.deepEqual(await store.completeZeroPointsRefundOnce(data, INPUT), { applied: true, amount: 149000 });
  assert.equal(pointsOf(data), 1000 + 149000);

  const [call] = mainCalls();
  assert.equal(mainCalls().length, 1, "본 문장은 정확히 1번");
  // $1 저장할 app_store, $2 읽은 version
  assert.equal((JSON.parse(String(call.params[0])) as AppData).users[0].points, 150000);
  assert.equal(call.params[1], 5);
  assert.deepEqual(call.params.slice(2, 9), ["rr-1", "o-1", "u-1", 149000, 149000, "149000", "적립금"]);
  assert.match(String(call.params[9]), /\S/, "원장 id");
  assert.ok(!Number.isNaN(Date.parse(String(call.params[10]))), "completed_at 후보 시각");

  // 성립 뒤 기준 version이 올라가 같은 객체로 이어 저장할 수 있다.
  fake.main.push(row({ restored: 1, refund_status: "completed" }));
  await store.completeZeroPointsRefundOnce(data, INPUT);
  assert.equal(mainCalls()[1].params[1], 6);
});

/* ── 이중 복원 방지 ──────────────────────────────────── */

test("재실행: 이미 원장·completed가 있으면 already-completed, 메모리 잔액도 그대로", async () => {
  const data = await freshData();
  fake.main.push(row({ restored: 1, refund_status: "completed" }));
  assert.deepEqual(await store.completeZeroPointsRefundOnce(data, INPUT), {
    applied: false,
    reason: "already-completed",
  });
  assert.equal(pointsOf(data), 1000);
});

test("원장만 이미 있음(문의는 approved) -> already-completed, 다시 복원하지 않음", async () => {
  const data = await freshData();
  fake.main.push(row({ restored: 1 }));
  const result = await store.completeZeroPointsRefundOnce(data, INPUT);
  assert.deepEqual(result, { applied: false, reason: "already-completed" });
  assert.equal(pointsOf(data), 1000);
});

test("동시 2요청(같은 읽기 기준): 하나만 성립, 다른 하나는 cas-conflict로 잔액 원복", async () => {
  const first = await freshData();
  fake.store.data = { users: [user()] };
  const second = await store.readData();
  fake.main.push(row({ version: 6, inserted: 1, closed: 1 }), row());
  const results = await Promise.all([
    store.completeZeroPointsRefundOnce(first, INPUT),
    store.completeZeroPointsRefundOnce(second, INPUT),
  ]);
  assert.deepEqual(results, [
    { applied: true, amount: 149000 },
    { applied: false, reason: "cas-conflict" },
  ]);
  assert.deepEqual(mainCalls().map((call) => call.params[1]), [5, 5], "둘 다 같은 version으로 CAS");
  assert.equal(pointsOf(second), 1000);
});

/* ── 거절 사유 ────────────────────────────────────── */

test("approved 아닌 문의(requested/reviewing/rejected/없음) -> not-approved", async () => {
  for (const status of ["requested", "reviewing", "rejected", null]) {
    const data = await freshData();
    fake.main.push(row({ refund_status: status }));
    assert.deepEqual(await store.completeZeroPointsRefundOnce(data, INPUT), {
      applied: false,
      reason: "not-approved",
    });
    assert.equal(pointsOf(data), 1000);
  }
});

test("주문 근거 불일치(order/user/amount/baseAmount/details) -> order-not-matched", async () => {
  const data = await freshData();
  fake.main.push(row({ order_ok: 0 }));
  assert.deepEqual(await store.completeZeroPointsRefundOnce(data, INPUT), {
    applied: false,
    reason: "order-not-matched",
  });
  assert.equal(pointsOf(data), 1000);
});

test("결제 행 존재 -> payment-exists", async () => {
  const data = await freshData();
  fake.main.push(row({ order_ok: 0, payment_count: 1 }));
  assert.deepEqual(await store.completeZeroPointsRefundOnce(data, INPUT), {
    applied: false,
    reason: "payment-exists",
  });
});

test("CAS 불일치(근거는 모두 맞음) -> cas-conflict, 잔액 원복", async () => {
  const data = await freshData();
  fake.main.push(row());
  assert.deepEqual(await store.completeZeroPointsRefundOnce(data, INPUT), {
    applied: false,
    reason: "cas-conflict",
  });
  assert.equal(pointsOf(data), 1000);
});

test("readData를 거치지 않은 객체 -> 저장하지 않고 충돌(AppStoreConflictError)", async () => {
  await freshData();
  const orphan = { users: [user()] } as unknown as AppData;
  await assert.rejects(store.completeZeroPointsRefundOnce(orphan, INPUT), (error: unknown) =>
    store.isAppStoreConflict(error),
  );
  assert.equal(mainCalls().length, 0);
});

/* ── 부분 성공 불가 ─────────────────────────────────── */

test("guard(1/0) 오류 = 문장 전체 되돌림 -> cas-conflict, 메모리 잔액 원복", async () => {
  const data = await freshData();
  fake.main.push(new Error("division by zero"));
  assert.deepEqual(await store.completeZeroPointsRefundOnce(data, INPUT), {
    applied: false,
    reason: "cas-conflict",
  });
  assert.equal(pointsOf(data), 1000);
});

test("그 밖의 DB 오류는 그대로 던지고 메모리 잔액은 원복", async () => {
  const data = await freshData();
  fake.main.push(new Error("connection reset"));
  await assert.rejects(store.completeZeroPointsRefundOnce(data, INPUT), /connection reset/);
  assert.equal(pointsOf(data), 1000);
});

test("version은 있는데 원장 또는 completed가 0행이면 성공으로 보지 않는다", async () => {
  for (const partial of [{ inserted: 1, closed: 0 }, { inserted: 0, closed: 1 }]) {
    const data = await freshData();
    fake.main.push(row({ version: 6, ...partial }));
    const result = await store.completeZeroPointsRefundOnce(data, INPUT);
    assert.equal(result.applied, false, JSON.stringify(partial));
    assert.equal(pointsOf(data), 1000);
  }
});

/* ── 회원·금액 ────────────────────────────────────── */

test("탈퇴 회원 -> user-withdrawn, 없는 회원 -> user-not-found (DB 문장 없음)", async () => {
  let data = await freshData([user({ withdrawnAt: "2026-09-01T00:00:00.000Z" })]);
  assert.deepEqual(await store.completeZeroPointsRefundOnce(data, INPUT), {
    applied: false,
    reason: "user-withdrawn",
  });
  data = await freshData([user({ id: "u-other" })]);
  assert.deepEqual(await store.completeZeroPointsRefundOnce(data, INPUT), {
    applied: false,
    reason: "user-not-found",
  });
  assert.equal(mainCalls().length, 0);
});

test("복원 금액·기준 금액이 양의 정수가 아니면 invalid-amount (DB 문장 없음)", async () => {
  const data = await freshData();
  for (const bad of [{ pointsUsed: 0 }, { pointsUsed: -1 }, { pointsUsed: 1.5 }, { baseAmount: 0 }, { baseAmount: Number.NaN }]) {
    assert.deepEqual(await store.completeZeroPointsRefundOnce(data, { ...INPUT, ...bad }), {
      applied: false,
      reason: "invalid-amount",
    });
  }
  assert.equal(mainCalls().length, 0);
  assert.equal(pointsOf(data), 1000);
});

/* ── 문장 원문: 원자성·동시성 조건 ──────────────────────── */

const squash = (text: string) => text.replace(/\s+/g, " ").trim();

async function statement(): Promise<string> {
  const data = await freshData();
  fake.main.push(row());
  await store.completeZeroPointsRefundOnce(data, INPUT);
  return squash(mainCalls()[0].text);
}

test("주문 근거: id·회원·0원·base_amount·적립금·usePoints·pointsUsed·쿠폰/프로모션 없음·결제 0건", async () => {
  const sql = await statement();
  for (const part of [
    "WHERE o.id = $4 AND o.user_id = $5",
    "AND o.amount = 0",
    "AND o.base_amount = $7",
    "AND o.payment = $9",
    "AND o.details->>'usePoints' = '1'",
    "AND o.details->>'pointsUsed' = $8",
    "AND COALESCE(o.details->>'couponId', '') = ''",
    "AND COALESCE(o.details->>'couponFree', '') = ''",
    "AND COALESCE(o.details->>'promotion', '') = ''",
    "AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id)",
  ]) {
    assert.ok(sql.includes(part), part);
  }
});

test("문의: 이 id·주문·회원의 approved만, FOR UPDATE로 잠금", async () => {
  const sql = await statement();
  assert.ok(
    sql.includes(
      "SELECT r.id FROM refund_requests r WHERE r.id = $3 AND r.order_id = $4 AND r.user_id = $5 AND r.status = 'approved' FOR UPDATE",
    ),
  );
});

test("cas: version CAS + 주문·문의 근거 + 복원 원장 없음일 때만 app_store 갱신", async () => {
  const sql = await statement();
  assert.ok(
    sql.includes(
      squash(`
        UPDATE app_store SET data = $1::jsonb, version = version + 1
        WHERE id = 1 AND version = $2
          AND EXISTS (SELECT 1 FROM target_order)
          AND EXISTS (SELECT 1 FROM target_refund)
          AND NOT EXISTS (
            SELECT 1 FROM point_transactions
            WHERE order_id = $4 AND type = 'refund-restore'
          )
        RETURNING version
      `),
    ),
  );
});

test("원장: cas가 성립했을 때만, UNIQUE (order_id, type) 충돌은 DO NOTHING(→ guard)", async () => {
  const sql = await statement();
  assert.ok(
    sql.includes(
      "SELECT $10, $4, 'refund-restore', $6, $3 WHERE EXISTS (SELECT 1 FROM cas) ON CONFLICT (order_id, type) DO NOTHING",
    ),
  );
});

test("완료: approved인 그 문의만, cas가 성립했을 때만, completed_at은 최초값 유지", async () => {
  const sql = await statement();
  assert.ok(
    sql.includes(
      squash(`
        UPDATE refund_requests
        SET status = 'completed',
            completed_at = COALESCE(completed_at, $11::timestamptz)
        WHERE id = (SELECT id FROM target_refund)
          AND status = 'approved'
          AND EXISTS (SELECT 1 FROM cas)
      `),
    ),
  );
});

test("guard: cas 성립 + 원장/완료 중 하나라도 0행이면 1/0으로 문장 전체 실패", async () => {
  const sql = await statement();
  assert.ok(
    sql.includes(
      squash(`
        WHEN (SELECT count(*) FROM cas) = 1
         AND ((SELECT count(*) FROM inserted) = 0 OR (SELECT count(*) FROM closed_refund) = 0)
        THEN 1 / LEAST((SELECT count(*) FROM inserted), (SELECT count(*) FROM closed_refund))::int
      `),
    ),
  );
});

test("한 문장: 본 문장은 sql.query 1회이고 쓰기 3종이 모두 그 안에 있다", async () => {
  const sql = await statement();
  assert.equal(mainCalls().length, 1);
  assert.equal(sql.match(/UPDATE app_store/g)?.length, 1);
  assert.equal(sql.match(/INSERT INTO point_transactions/g)?.length, 1);
  assert.equal(sql.match(/UPDATE refund_requests/g)?.length, 1);
  // 결제·주문 행은 읽기만 한다.
  assert.doesNotMatch(sql, /UPDATE (payments|orders)|INSERT INTO (payments|orders)|DELETE/);
});
