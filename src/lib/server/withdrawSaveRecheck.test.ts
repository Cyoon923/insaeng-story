/**
 * 회원 탈퇴: 저장 직전 차단 재확인 (route.ts action "withdrawAccount" 저장 루프).
 *
 * 실행: npx tsx --experimental-test-module-mocks --test src/lib/server/withdrawSaveRecheck.test.ts
 *
 * 실제 /api/app POST를 부른다. 세션·저장소·탈퇴 판정·소셜 해제·문의방 정리만 대역이다. DB·외부 API에 닿지 않는다.
 * 첫 판정(3단계)에서는 막을 것이 없었는데 저장 직전 판정에서 결제가 보이는 경우(다른 탭의 카드 결제)를 흉내 낸다.
 * 이 재확인은 판정과 writeData 사이의 틈을 줄일 뿐 회원 단위 잠금이 아니다(완전한 동시성 보장 아님).
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

type Blocker = { kind: string; reason: string; count: number };
const PAYMENT: Blocker = { kind: "payment", reason: "진행 중인 결제가 있습니다.", count: 1 };

const calls: string[] = [];
let blockerQueue: Blocker[][] = [];
let writeFailures = 0;
let user: Record<string, unknown> = {};

class AppStoreConflictError extends Error {}

function appData() {
  return {
    users: [structuredClone(user)],
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

mock.module("@/lib/server/session", {
  namedExports: {
    getUserId: async () => "u-1",
    setUserId: async () => {},
    clearUserId: async () => {
      calls.push("clearUserId");
    },
    ensureDraftOwnerCookie: async () => {},
  },
});
mock.module("@/lib/server/store", {
  namedExports: {
    readData: async () => appData(),
    writeData: async () => {
      calls.push("writeData");
      if (writeFailures > 0) {
        writeFailures -= 1;
        throw new AppStoreConflictError("conflict");
      }
    },
    isAppStoreConflict: (error: unknown) => error instanceof AppStoreConflictError,
    verifyPassword: () => true,
    normalizePhone: (value: string) => value.replace(/\D/g, ""),
    scrubOrderDetailsByUser: async () => {
      calls.push("scrubOrderDetailsByUser");
    },
    scrubPaymentSnapshotDetailsByUser: async () => {
      calls.push("scrubPaymentSnapshotDetailsByUser");
    },
  },
});
mock.module("@/lib/server/withdrawAccount", {
  namedExports: {
    isActiveUser: (item: Record<string, unknown> | undefined) => Boolean(item) && !item?.withdrawnAt,
    getActiveUserId: async () => "u-1",
    findWithdrawBlockers: async () => {
      calls.push("findWithdrawBlockers");
      return blockerQueue.shift() ?? [];
    },
    anonymizeWithdrawnUser: () => {
      calls.push("anonymizeWithdrawnUser");
    },
    scrubUserRecords: () => {
      calls.push("scrubUserRecords");
    },
    KEPT_DETAIL_KEYS: [],
    WITHDRAWN_NAME: "탈퇴회원",
  },
});
mock.module("@/lib/server/chatInquiries", {
  namedExports: {
    scrubChatInquiriesByUser: async () => {
      calls.push("scrubChatInquiriesByUser");
    },
    listChatInquiriesByUserId: async () => [],
  },
});
mock.module("@/lib/server/withdrawVerification", {
  namedExports: {
    consumeWithdrawVerification: async () => ({
      userId: "u-1",
      provider: "kakao",
      providerUserId: "k-1",
      accessToken: "token",
    }),
  },
});
mock.module("@/lib/server/kakaoUnlink", {
  namedExports: {
    unlinkKakao: async () => {
      calls.push("unlinkKakao");
      return "unlinked";
    },
  },
});
mock.module("@/lib/server/naverUnlink", {
  namedExports: { unlinkNaver: async () => "unlinked" },
});

async function withdraw() {
  const route = await import("../../app/api/app/route.ts");
  const response = await route.POST(
    new Request("https://example.test/api/app", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "withdrawAccount", password: "pw" }),
    }),
  );
  return { status: response.status, json: await response.json() };
}

const PASSWORD_USER = { id: "u-1", name: "테스트", phone: "01012345678", passwordHash: "h", points: 0 };
const KAKAO_USER = { id: "u-1", name: "테스트", phone: "01012345678", kakaoId: "k-1", points: 0 };

function reset(queue: Blocker[][], member: Record<string, unknown> = PASSWORD_USER) {
  calls.length = 0;
  blockerQueue = queue;
  writeFailures = 0;
  user = member;
}

const SCRUBS = ["anonymizeWithdrawnUser", "scrubUserRecords", "scrubOrderDetailsByUser", "scrubPaymentSnapshotDetailsByUser", "scrubChatInquiriesByUser"];

test("첫 판정 통과 → 저장 직전 결제 발견: 409(lateBlockers), writeData·개인정보 정리·세션 정리 없음", async () => {
  reset([[], [PAYMENT]]);
  const result = await withdraw();
  assert.equal(result.status, 409);
  assert.equal(result.json.ok, false);
  assert.equal(result.json.error, "진행 중인 서비스가 있어 탈퇴할 수 없습니다.");
  assert.deepEqual(result.json.blockers, [PAYMENT]);
  assert.equal(calls.filter((c) => c === "findWithdrawBlockers").length, 2, "첫 판정 + 저장 직전 재확인");
  assert.equal(calls.includes("writeData"), false);
  for (const scrub of SCRUBS) assert.equal(calls.includes(scrub), false, scrub);
  assert.equal(calls.includes("clearUserId"), false);
});

test("첫 판정에서 막히면 기존처럼 409, 저장 루프에 들어가지 않는다", async () => {
  reset([[PAYMENT]]);
  const result = await withdraw();
  assert.equal(result.status, 409);
  assert.deepEqual(calls, ["findWithdrawBlockers"]);
});

test("두 판정 모두 통과: 기존대로 비식별화 → 저장 → 정리 → 세션 종료", async () => {
  reset([[], []]);
  const result = await withdraw();
  assert.equal(result.status, 200, JSON.stringify(result.json));
  assert.equal(result.json.withdrawn, true);
  assert.deepEqual(calls, [
    "findWithdrawBlockers",
    "findWithdrawBlockers",
    "anonymizeWithdrawnUser",
    "scrubUserRecords",
    "writeData",
    "scrubOrderDetailsByUser",
    "scrubPaymentSnapshotDetailsByUser",
    "scrubChatInquiriesByUser",
    "clearUserId",
  ]);
});

test("CAS 재시도 유지: 첫 저장이 밀리면 다음 회차에서도 다시 판정하고 저장한다", async () => {
  reset([[], [], []]);
  writeFailures = 1;
  const result = await withdraw();
  assert.equal(result.status, 200, JSON.stringify(result.json));
  assert.equal(calls.filter((c) => c === "findWithdrawBlockers").length, 3);
  assert.equal(calls.filter((c) => c === "writeData").length, 2);
});

test("CAS 재시도 중 결제가 생기면 그 회차에서 409, 추가 저장 없음", async () => {
  reset([[], [], [PAYMENT]]);
  writeFailures = 1;
  const result = await withdraw();
  assert.equal(result.status, 409);
  assert.equal(calls.filter((c) => c === "writeData").length, 1, "밀린 첫 저장 1회뿐");
  assert.equal(calls.includes("scrubPaymentSnapshotDetailsByUser"), false);
});

test("소셜 회원: 연결 해제는 기존처럼 저장 루프 전에 1회, 재확인에 막히면 저장하지 않는다", async () => {
  reset([[], [PAYMENT]], KAKAO_USER);
  const result = await withdraw();
  assert.equal(result.status, 409);
  assert.deepEqual(calls, ["findWithdrawBlockers", "unlinkKakao", "findWithdrawBlockers"]);
});
