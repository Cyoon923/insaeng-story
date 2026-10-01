/**
 * 결제 준비(preparePayment)의 신청(checkout) 식별자 처리 (P1-03 3단계).
 *
 * 실행: npx tsx --experimental-test-module-mocks --test src/lib/server/preparePaymentCheckout.test.ts
 *
 * 실제 /api/app POST를 부른다. 세션·회원 상태·저장소(store)만 대역으로 바꾸고
 * 가격 계산·동의·할인·슬롯 검증은 실제 코드를 쓴다. DB·PG에 닿지 않는다.
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

const activeChecks: string[] = [];
const created: Record<string, unknown>[] = [];
let activeResult = false;

const USER = {
  id: "u-1",
  name: "테스트",
  phone: "010-1234-5678",
  points: 0,
};

function appData() {
  return {
    users: [structuredClone(USER)],
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
    clearUserId: async () => {},
  },
});

mock.module("@/lib/server/withdrawAccount", {
  namedExports: { isActiveUser: () => true },
});

mock.module("@/lib/server/store", {
  namedExports: {
    readData: async () => appData(),
    isAppStoreConflict: () => false,
    nowId: () => "n1",
    normalizePhone: (value: string) => value.replace(/\D/g, ""),
    hasActiveCheckoutPayment: async (checkoutId: string) => {
      activeChecks.push(checkoutId);
      return activeResult;
    },
    createPayment: async (input: Record<string, unknown>) => {
      created.push(input);
      return { merchantOrderId: input.merchantOrderId, requestedAmount: input.requestedAmount };
    },
  },
});

async function POST(body: Record<string, unknown>): Promise<Response> {
  const route = await import("../../app/api/app/route.ts");
  return route.POST(
    new Request("https://example.test/api/app", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const UUID = "3f2b8c1e-9d4a-4e7b-8c2d-1a2b3c4d5e6f";

function orderBody(extra: Record<string, unknown> = {}, details: Record<string, string> = {}) {
  return {
    action: "preparePayment",
    kind: "order",
    product: "saju-song",
    title: "사주 인생곡",
    options: [],
    payment: "신용/체크카드",
    details: { applyConsent: "1", copyrightConsent: "1", ...details },
    ...extra,
  };
}

function reset(active = false) {
  activeChecks.length = 0;
  created.length = 0;
  activeResult = active;
}

test("checkoutId 없음 → 조회 없이 기존처럼 결제 준비, NULL 저장, snapshot에 키 없음", async () => {
  reset();
  const response = await POST(orderBody());
  const json = await response.json();
  assert.equal(response.status, 200, JSON.stringify(json));
  assert.equal(json.requiresPayment, true);
  assert.equal(json.merchantOrderId, "is-n1");
  assert.equal(json.amount, 99000);
  assert.deepEqual(activeChecks, []);
  assert.equal(created.length, 1);
  assert.equal(created[0].checkoutId, null);
  const snapshot = created[0].orderSnapshot as Record<string, unknown>;
  assert.equal("checkoutId" in snapshot, false);
});

test("checkoutId null도 값 없음과 같다", async () => {
  reset();
  const response = await POST(orderBody({ checkoutId: null }));
  assert.equal(response.status, 200);
  assert.deepEqual(activeChecks, []);
  assert.equal(created[0].checkoutId, null);
});

test("정상 UUID + active=false → 조회 1회 후 같은 값으로 저장, snapshot 최상위에 보존", async () => {
  reset(false);
  const response = await POST(orderBody({ checkoutId: `  ${UUID.toUpperCase()}  ` }));
  const json = await response.json();
  assert.equal(response.status, 200, JSON.stringify(json));
  assert.deepEqual(activeChecks, [UUID]);
  assert.equal(created.length, 1);
  assert.equal(created[0].checkoutId, UUID);
  const snapshot = created[0].orderSnapshot as Record<string, unknown>;
  assert.equal(snapshot.checkoutId, UUID);
  // details 안에는 넣지 않는다.
  assert.equal("checkoutId" in (snapshot.details as Record<string, unknown>), false);
  // 기존 snapshot 구조는 그대로다.
  assert.equal(snapshot.amount, 99000);
  assert.equal(snapshot.kind, "order");
  assert.ok(typeof snapshot.consentedAt === "string");
  assert.ok(typeof snapshot.preparedAt === "string");
});

test("active=true → 409 안내, createPayment 0회, merchantOrderId 없음", async () => {
  reset(true);
  const response = await POST(orderBody({ checkoutId: UUID }));
  const json = await response.json();
  assert.equal(response.status, 409);
  assert.equal(
    json.error,
    "이미 같은 신청의 결제가 진행 중이거나 완료되었습니다. MY에서 결제 상태를 확인해 주세요.",
  );
  assert.equal(json.merchantOrderId, undefined);
  assert.deepEqual(activeChecks, [UUID]);
  assert.equal(created.length, 0);
});

test("details.checkoutId는 읽지 않는다(최상위 값이 없으면 조회·저장 없음)", async () => {
  reset(true);
  const response = await POST(orderBody({}, { checkoutId: UUID }));
  assert.equal(response.status, 200);
  assert.deepEqual(activeChecks, []);
  assert.equal(created[0].checkoutId, null);
  const snapshot = created[0].orderSnapshot as Record<string, unknown>;
  assert.equal("checkoutId" in snapshot, false);
});

for (const [name, value] of [
  ["숫자", 123],
  ["object", { id: UUID }],
  ["배열", [UUID]],
  ["빈 문자열", ""],
  ["공백", "   "],
  ["UUID 아님", "checkout-1"],
  ["자리수 틀림", "3f2b8c1e-9d4a-4e7b-8c2d-1a2b3c4d5e6"],
  ["16진수 아님", "zf2b8c1e-9d4a-4e7b-8c2d-1a2b3c4d5e6f"],
  ["true", true],
] as const) {
  test(`checkoutId ${name} → 400, 조회·createPayment 없음`, async () => {
    reset();
    const response = await POST(orderBody({ checkoutId: value }));
    const json = await response.json();
    assert.equal(response.status, 400);
    assert.equal(json.error, "신청 정보를 확인해 주세요.");
    assert.deepEqual(activeChecks, []);
    assert.equal(created.length, 0);
  });
}

/* ── 기존 검증이 그대로 먼저 걸리는지 ─────────────────── */

test("동의가 없으면 기존 400, 조회·저장 없음", async () => {
  reset();
  const response = await POST(
    orderBody({ checkoutId: UUID }, { applyConsent: "" }),
  );
  assert.equal(response.status, 400);
  assert.deepEqual(activeChecks, []);
  assert.equal(created.length, 0);
});

test("OPEN EVENT에 적립금 사용이면 기존 할인 충돌 400, 조회·저장 없음", async () => {
  reset();
  const response = await POST(
    orderBody({ checkoutId: UUID, promotion: "saju-song-open-2026" }, { usePoints: "1" }),
  );
  const json = await response.json();
  assert.equal(response.status, 400);
  // 기간 전이면 기간 오류, 기간 중이면 할인 충돌 오류. 어느 쪽이든 조회·저장 전에 끝난다.
  assert.ok(
    json.error === "오픈 이벤트 상품에는 추가 할인이나 포인트를 사용할 수 없습니다." ||
      json.error === "이벤트 신청 기간이 아닙니다.",
    json.error,
  );
  assert.deepEqual(activeChecks, []);
  assert.equal(created.length, 0);
});

test("상담 시간이 잘못되면 기존 400, 조회·저장 없음", async () => {
  reset();
  const response = await POST({
    action: "preparePayment",
    kind: "consultation",
    checkoutId: UUID,
    title: "1:1 사주상담",
    datetime: "잘못된 시간",
    payment: "신용/체크카드",
    details: { applyConsent: "1" },
  });
  assert.equal(response.status, 400);
  assert.deepEqual(activeChecks, []);
  assert.equal(created.length, 0);
});

test("상품 금액은 기존 서버 가격표 그대로 결제 준비된다", async () => {
  reset();
  await POST(orderBody({ checkoutId: UUID, options: ["lyric-edit"] }));
  assert.equal(created[0].requestedAmount, 109000);
});
