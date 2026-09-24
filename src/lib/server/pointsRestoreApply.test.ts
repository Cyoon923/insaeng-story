/**
 * 적립금 복원 잔액 계산 테스트 (Refund-Points-Restore-Atomic-1).
 *
 * 실행: node --test src/lib/server/pointsRestoreApply.test.ts
 *
 * 실제 저장(원장 기록 + app_store 갱신)이 한 문장으로 함께 성립하는지는
 * pointsRestoreAtomic.test.sql에서 본다. 여기서는 계산만 본다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { prepareRestoredPoints } from "./pointsRestoreApply.ts";
import type { AppData, User } from "@/lib/types/app";

function user(overrides: Partial<User> = {}): User {
  return {
    id: "u-1",
    name: "테스트고객",
    phone: "01099998888",
    email: "",
    points: 500,
    createdAt: "2026-09-10T00:00:00.000Z",
    ...overrides,
  } as User;
}

function appData(users: User[] = [user()]): AppData {
  return {
    users,
    orders: [],
    consultations: [],
    inquiries: [],
    reviews: [],
    wishlists: {},
    coupons: {},
    notifications: {},
    notificationSettings: {},
    codes: {},
    blockedSlots: [],
    adminPromo: null,
  } as unknown as AppData;
}

/* ── 정상 계산 ──────────────────────────────────────── */

test("복원 뒤 잔액을 더해 돌려준다", () => {
  const data = appData();
  const plan = prepareRestoredPoints(data, "u-1", 10000);
  assert.equal(plan.ok, true);
  if (!plan.ok) return;
  assert.equal(plan.previousPoints, 500);
  assert.equal(plan.nextPoints, 10500);
  assert.equal(plan.user.id, "u-1");
});

test("잔액이 비어 있으면 0에서 시작한다", () => {
  for (const points of [undefined, null, 0, -5, 1.5] as unknown[]) {
    const data = appData([user({ points: points as number })]);
    const plan = prepareRestoredPoints(data, "u-1", 1000);
    assert.equal(plan.ok, true, String(points));
    if (!plan.ok) continue;
    // 음수·소수 잔액도 기존 applyPoints와 같은 규칙(floor, 0 하한)으로 읽는다.
    assert.equal(plan.nextPoints, plan.previousPoints + 1000, String(points));
    assert.ok(plan.previousPoints >= 0, String(points));
  }
});

/* ── 회원 없음 ──────────────────────────────────────── */

test("대상 회원이 없으면 계산하지 않는다", () => {
  assert.deepEqual(prepareRestoredPoints(appData(), "u-없음", 10000), {
    ok: false,
    reason: "user-not-found",
  });
  assert.deepEqual(prepareRestoredPoints(appData([]), "u-1", 10000), {
    ok: false,
    reason: "user-not-found",
  });
  assert.deepEqual(prepareRestoredPoints(appData(), "   ", 10000), {
    ok: false,
    reason: "user-not-found",
  });
});

/* ── 금액 ───────────────────────────────────────────── */

test("양의 정수가 아니면 계산하지 않는다", () => {
  for (const amount of [0, -100, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 2]) {
    assert.deepEqual(
      prepareRestoredPoints(appData(), "u-1", amount),
      { ok: false, reason: "invalid-amount" },
      String(amount),
    );
  }
});

/* ── 입력을 바꾸지 않는다 ───────────────────────────── */

test("계산만 하고 저장소를 바꾸지 않는다", () => {
  const data = appData();
  const before = JSON.stringify(data);
  prepareRestoredPoints(data, "u-1", 10000);
  assert.equal(JSON.stringify(data), before);
  // 잔액도 그대로다. 반영은 저장 함수가 한다.
  assert.equal(data.users[0].points, 500);
});

test("실패한 계산도 저장소를 바꾸지 않는다", () => {
  const data = appData();
  const before = JSON.stringify(data);
  prepareRestoredPoints(data, "u-1", -1);
  prepareRestoredPoints(data, "u-없음", 100);
  assert.equal(JSON.stringify(data), before);
});
