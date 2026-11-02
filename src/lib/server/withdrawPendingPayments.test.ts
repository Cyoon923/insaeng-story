/**
 * 탈퇴 차단: 카드 paid·주문 미연결 (countPendingPaymentsByUser).
 *
 * 실행: npx tsx --test src/lib/server/withdrawPendingPayments.test.ts
 *
 * countPendingPaymentsByUser는 sqlClient를 직접 써서 대역 주입이 없다. 그래서 SQL 원문을 고정하고,
 * 그 결과가 탈퇴 판정에 쓰이는 연결(기본 deps → "payment" blocker)을 함께 확인한다. DB에 닿지 않는다.
 * 판정 규칙(pending 수 → blocker)은 withdrawBlockers.test.ts가 대역으로 고정한다.
 * 원문 검사라 SQL이 실제 DB에서 어떤 행을 세는지는 검증하지 않는다(DB 실행 검증 아님).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { findWithdrawBlockers } from "./withdrawAccount.ts";
import type { AppData } from "../types/app.ts";

const STORE = readFileSync(new URL("./store.ts", import.meta.url), "utf8");
const WITHDRAW = readFileSync(new URL("./withdrawAccount.ts", import.meta.url), "utf8");
const squash = (t: string) => t.replace(/--[^\n]*/g, "").replace(/\s+/g, " ").trim();

function body() {
  const start = STORE.indexOf("export async function countPendingPaymentsByUser(");
  assert.ok(start >= 0);
  return squash(STORE.slice(start, STORE.indexOf("\n}\n", start)));
}

test("SQL 원문: processing·ready(10분)·카드 paid 미연결이 한 괄호 안 OR, 회원은 snapshot.userId", () => {
  assert.ok(
    body().includes(
      "WHERE ( status = 'processing' " +
        "OR ( status = 'ready' AND created_at > now() - interval '10 minutes' ) " +
        "OR ( provider = 'nicepay' AND status = 'paid' AND order_id IS NULL ) " +
        ") AND order_snapshot->>'userId' = $1",
    ),
  );
  assert.ok(body().includes("[userId]"));
});

test("SQL 원문: cancelled는 들어오지 않고, paid는 카드 미연결 묶음에만 있다, 조회만 한다", () => {
  const where = body().slice(body().indexOf("WHERE"));
  // 상태 값은 세 가지뿐이다(cancelled·partialCancelled·failed 없음).
  assert.deepEqual(
    [...where.matchAll(/status = '(\w+)'/g)].map((m) => m[1]),
    ["processing", "ready", "paid"],
  );
  // 판정 중 정리(쓰기)를 하지 않는다.
  assert.equal(/UPDATE|DELETE|INSERT/.test(body()), false);
  assert.match(body(), /SELECT count\(\*\)::int AS count FROM payments/);
});

test("탈퇴 판정 연결: 기본 deps가 countPendingPaymentsByUser를 쓰고, 0보다 크면 기존 'payment' blocker", async () => {
  assert.match(WITHDRAW, /countPendingPayments: countPendingPaymentsByUser,/);
  const data = { consultations: [] } as unknown as AppData;
  const deps = (pending: number) => ({
    listOrders: async () => [],
    countPendingPayments: async () => pending,
    listRefundStatuses: async () => [],
  });
  // 카드 미연결 결제가 집계에 잡힌 경우와 복구되어 잡히지 않는 경우.
  assert.deepEqual(await findWithdrawBlockers(data, "u-1", deps(1)), [
    { kind: "payment", count: 1, reason: "진행 중인 결제가 있습니다." },
  ]);
  assert.deepEqual(await findWithdrawBlockers(data, "u-1", deps(0)), []);
});

test("SQL 원문: 카드 paid 미연결 묶음은 provider·status·order_id 세 조건이 한 괄호이고 무통장 paid는 없다", () => {
  const where = body().slice(body().indexOf("WHERE"));
  // paid는 nicepay·order_id IS NULL과 같은 괄호 안에만 나온다.
  assert.equal((where.match(/status = 'paid'/g) ?? []).length, 1);
  assert.ok(where.includes("( provider = 'nicepay' AND status = 'paid' AND order_id IS NULL )"));
  assert.equal((where.match(/provider = '(\w+)'/g) ?? []).join(","), "provider = 'nicepay'");
  // 회원 범위는 괄호 밖 AND 하나로 모든 분기에 걸린다. 바인딩 값은 userId 하나다.
  assert.ok(where.endsWith(") AND order_snapshot->>'userId' = $1 `, [userId], )) as { count: number }[]; return Number(rows[0]?.count ?? 0);"));
});
