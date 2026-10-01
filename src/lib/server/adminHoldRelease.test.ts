/**
 * 관리자 상담 시간 확보(hold) 수동 해제 API (P1-04 Stage 4).
 *
 * 실행: npx tsx --experimental-test-module-mocks --test src/lib/server/adminHoldRelease.test.ts
 *
 * 실제 /api/admin/payments/hold-release POST와 실제 판정·해제 helper를 쓴다.
 * 대역은 관리자 인증(chatInquiryApi)과 저장소(store)뿐이다.
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { readFileSync } from "node:fs";

class AppStoreConflictError extends Error {}

let admin = true;
let paymentStatus: string | null = "failed";
let db: Record<string, unknown> = {};
let writes = 0;

const HOLD = (merchantOrderId: string, time = "오전 10:00") => ({
  teacher: "유비 선생",
  date: "10월 20일(화)",
  time,
  merchantOrderId,
  createdAt: "2026-10-01T00:00:00.000Z",
});

mock.module("@/lib/server/chatInquiryApi", {
  namedExports: {
    requireAdmin: async () =>
      admin ? null : Response.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 }),
    badRequest: (message: string) => Response.json({ error: message }, { status: 400 }),
    readJsonBody: async (request: Request) => request.json(),
  },
});

mock.module("@/lib/server/store", {
  namedExports: {
    isAppStoreConflict: (error: unknown) => error instanceof AppStoreConflictError,
    getPaymentByMerchantOrderId: async (merchantOrderId: string) =>
      paymentStatus ? { merchantOrderId, status: paymentStatus } : null,
    readData: async () => structuredClone(db),
    writeData: async (data: Record<string, unknown>) => {
      writes += 1;
      db = structuredClone(data);
    },
  },
});

async function release(merchantOrderId: string): Promise<Response> {
  const route = await import("../../app/api/admin/payments/hold-release/route.ts");
  return route.POST(
    new Request("https://example.test/api/admin/payments/hold-release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchantOrderId }),
    }),
  );
}

function reset(status: string | null, holds: Record<string, unknown>[]) {
  admin = true;
  paymentStatus = status;
  db = { consultations: [], blockedSlots: [], consultationHolds: holds };
  writes = 0;
}

function holdIds(): string[] {
  return ((db.consultationHolds as { merchantOrderId: string }[]) ?? []).map((item) => item.merchantOrderId);
}

test("비관리자는 거부되고 아무것도 바뀌지 않는다", async () => {
  reset("failed", [HOLD("is-a")]);
  admin = false;
  const response = await release("is-a");
  assert.equal(response.status, 401);
  assert.equal(writes, 0);
  assert.deepEqual(holdIds(), ["is-a"]);
});

test("failed 결제의 hold → 200 해제, 다른 결제 hold 보존", async () => {
  reset("failed", [HOLD("is-a"), HOLD("is-other", "오전 11:00")]);
  const response = await release("is-a");
  const json = await response.json();
  assert.equal(response.status, 200);
  assert.equal(json.ok, true);
  assert.equal(json.status, "released");
  assert.deepEqual(holdIds(), ["is-other"]);
});

for (const [status, reason] of [
  ["processing", "processing"],
  ["paid", "paid"],
  [null, "payment-missing"],
] as const) {
  test(`${status ?? "결제 없음"} → 409 거부, hold 유지`, async () => {
    reset(status, [HOLD("is-a")]);
    const response = await release("is-a");
    const json = await response.json();
    assert.equal(response.status, 409);
    assert.equal(json.ok, false);
    assert.equal(json.status, reason);
    assert.equal(writes, 0);
    assert.deepEqual(holdIds(), ["is-a"]);
  });
}

test("hold가 이미 없으면 다시 불러도 안전(200, 쓰기 없음)", async () => {
  reset("failed", []);
  const first = await release("is-a");
  const second = await release("is-a");
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(writes, 0);
});

test("주문번호가 없으면 400", async () => {
  reset("failed", [HOLD("is-a")]);
  const response = await release("");
  assert.equal(response.status, 400);
  assert.deepEqual(holdIds(), ["is-a"]);
});

test("관리자 GET은 서버가 판정한 hold 목록을 내려준다", () => {
  const route = readFileSync(new URL("../../app/api/admin/route.ts", import.meta.url), "utf8");
  assert.match(route, /const consultationHolds = await listHoldsForAdmin\(data, getPaymentByMerchantOrderId\);/);
  assert.match(route, /    consultationHolds,\n/);
  const page = readFileSync(new URL("../../app/admin/page.tsx", import.meta.url), "utf8");
  // 버튼은 서버의 releasable일 때만 보인다.
  assert.match(page, /\{hold\.releasable \? \(/);
  assert.match(page, /fetch\("\/api\/admin\/payments\/hold-release"/);
});
