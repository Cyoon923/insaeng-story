/**
 * /api/app GET의 draft 주인 표식 복구 (P1-07 후속, 363da8a).
 *
 * 실행: npx tsx --experimental-test-module-mocks --test src/lib/server/appGetDraftOwner.test.ts
 *
 * 실제 route의 GET과 실제 session(getUserId·ensureDraftOwnerCookie)을 쓴다.
 * 대역은 쿠키(next/headers)·저장소(store)·환불 문의(refundRequests)·활성 회원 판정뿐이다. DB에 닿지 않는다.
 * 표식이 없는 기존 로그인 세션은 GET에서 표식을 다시 받고, 탈퇴·비로그인은 받지 않는지 본다.
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

process.env.SESSION_SECRET = "app-get-draft-owner-test";
const KEY = "user:app-get-draft-owner-test";

type CookieOptions = Record<string, unknown>;
const jar = new Map<string, string>();
const sets: { name: string; value: string; options: CookieOptions }[] = [];

mock.module("next/headers", {
  namedExports: {
    cookies: async () => ({
      get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
      set: (name: string, value: string, options: CookieOptions) => {
        sets.push({ name, value, options });
        jar.set(name, value);
      },
      delete: (name: string) => {
        jar.delete(name);
      },
    }),
  },
});

const USER_ID = "u-1700000000-abc";
let withdrawn = false;

function appData() {
  return {
    users: [
      {
        id: USER_ID,
        name: "테스트",
        phone: "010-1234-5678",
        points: 0,
        ...(withdrawn ? { withdrawnAt: "2026-01-01T00:00:00.000Z" } : {}),
      },
    ],
    orders: [],
    consultations: [],
    inquiries: [],
    reviews: [],
    wishlists: {},
    coupons: {},
    couponCodes: {},
    notifications: {},
    notificationSettings: {},
    codes: {},
    blockedSlots: [],
    adminPromo: null,
  };
}

mock.module("@/lib/server/store", {
  namedExports: {
    readData: async () => appData(),
    listOrdersByUser: async () => [],
  },
});

mock.module("@/lib/server/refundRequests", {
  namedExports: {
    listActiveRefundRequestsByUser: async () => [],
    listLatestRefundRequestsByUser: async () => [],
  },
});

// 실제 판정과 같은 규칙. 실제 모듈은 store의 다른 함수까지 끌어와 대역 범위가 넓어진다.
mock.module("@/lib/server/withdrawAccount", {
  namedExports: {
    isActiveUser: (user: { withdrawnAt?: string } | null | undefined) => !!user && !user.withdrawnAt,
  },
});

async function setup(cookies: { session: boolean; owner: boolean }) {
  const { __sessionInternals } = await import("./session.ts");
  jar.clear();
  sets.length = 0;
  if (cookies.session) jar.set("insaeng_uid", __sessionInternals.createToken(USER_ID, KEY));
  const owner = __sessionInternals.draftOwnerValue(USER_ID, KEY);
  if (cookies.owner) jar.set(__sessionInternals.DRAFT_OWNER_COOKIE, owner);
  return { owner, ownerCookie: __sessionInternals.DRAFT_OWNER_COOKIE };
}

async function GET(): Promise<{ user: { id: string } | null; authMethods?: unknown }> {
  const route = await import("../../app/api/app/route.ts");
  return (await route.GET()).json();
}

test("유효한 세션 + 표식 없음 + 활성 회원: 정상 응답과 함께 표식을 새로 심는다", async () => {
  withdrawn = false;
  const { owner, ownerCookie } = await setup({ session: true, owner: false });
  const body = await GET();
  assert.equal(body.user?.id, USER_ID);
  assert.ok(body.authMethods);
  const ownerSets = sets.filter((item) => item.name === ownerCookie);
  assert.equal(ownerSets.length, 1);
  assert.equal(ownerSets[0].value, owner);
  assert.equal(ownerSets[0].options.httpOnly, false);
  assert.equal(ownerSets[0].options.path, "/");
  assert.equal(ownerSets[0].options.sameSite, "lax");
  assert.equal(ownerSets[0].options.maxAge, 30 * 24 * 60 * 60);
  // 세션 쿠키는 다시 발급하지 않는다.
  assert.equal(sets.some((item) => item.name === "insaeng_uid"), false);
});

test("유효한 세션 + 올바른 표식 있음 + 활성 회원: 표식을 다시 심지 않는다", async () => {
  withdrawn = false;
  await setup({ session: true, owner: true });
  const body = await GET();
  assert.equal(body.user?.id, USER_ID);
  assert.equal(sets.length, 0);
});

test("유효한 세션 + 탈퇴 회원: user null, 표식을 심지 않는다", async () => {
  withdrawn = true;
  await setup({ session: true, owner: false });
  const body = await GET();
  assert.equal(body.user, null);
  assert.equal(sets.length, 0);
});

test("세션 없음 + 표식만 있음: 표식은 인증 수단이 아니므로 user null, 표식도 심지 않는다", async () => {
  withdrawn = false;
  await setup({ session: false, owner: true });
  const body = await GET();
  assert.equal(body.user, null);
  assert.equal(sets.length, 0);
});
