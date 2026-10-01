/**
 * NICEPAY return: 일반 상담은 선점 후 슬롯 확보에 성공해야만 승인한다 (P1-04 Stage 2).
 *
 * 실행: npx tsx --experimental-test-module-mocks --test src/lib/server/nicepayReturnConsultationHold.test.ts
 *
 * 실제 route POST와 실제 확보 helper(consultationHold)·슬롯 판정을 쓴다. 대역은 DB·PG 경계
 * (store, nicepayApprove, withdrawAccount)와 확정 함수(applyOrder)뿐이다.
 * 메모리 app_store는 version CAS를 흉내 내며, 호출 순서는 calls 한 배열에 남긴다.
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

const MOID = "is-consult-1";
const CHECKOUT = "3f2b8c1e-9d4a-4e7b-8c2d-1a2b3c4d5e6f";
const TIME = "오전 10:00";
const DATETIME = `10월 20일(화) ${TIME}`;

class CheckoutPaymentActiveError extends Error {}
class AppStoreConflictError extends Error {}

const calls: string[] = [];
const claimArgs: unknown[][] = [];
const approveTids: string[] = [];
let db: Record<string, unknown> = {};
let writes: ("ok" | "conflict" | Error)[] = [];
let writeCount = 0;
let claimBehavior: () => Promise<unknown> = async () => ({ status: "processing" });
/** 선점 직후(확보 전) 경쟁 결제가 저장한 상황을 만든다. */
let afterClaim: (() => void) | null = null;
let payment: Record<string, unknown> = {};

function emptyDb(): Record<string, unknown> {
  return {
    users: [{ id: "u-1", phone: "010-1234-5678" }],
    orders: [],
    consultations: [],
    blockedSlots: [],
    consultationHolds: [],
    coupons: {},
  };
}

function consultationPayment(): Record<string, unknown> {
  return {
    provider: "nicepay",
    merchantOrderId: MOID,
    requestedAmount: 100000,
    status: "ready",
    orderId: null,
    orderSnapshot: {
      kind: "consultation",
      userId: "u-1",
      amount: 100000,
      checkoutId: CHECKOUT,
      request: {
        title: "1:1 사주상담",
        report: "",
        extraPerson: "",
        payment: "신용/체크카드",
        teacher: "유비 선생",
        datetime: DATETIME,
        purpose: "",
        method: "카카오톡 상담",
        option: "없음",
      },
      discount: { couponId: null, referralCode: null, usePoints: 0 },
      details: {},
    },
  };
}

function orderPayment(promotion?: string): Record<string, unknown> {
  const amount = promotion ? 19000 : 99000;
  return {
    provider: "nicepay",
    merchantOrderId: MOID,
    requestedAmount: amount,
    status: "ready",
    orderId: null,
    orderSnapshot: {
      kind: "order",
      userId: "u-1",
      amount,
      request: {
        product: "saju-song",
        title: "사주 인생곡",
        options: [],
        payment: "신용/체크카드",
        ...(promotion ? { promotion } : {}),
      },
      discount: { couponId: null, referralCode: null, usePoints: 0 },
      details: {},
    },
  };
}

mock.module("@/lib/server/store", {
  namedExports: {
    CheckoutPaymentActiveError,
    isAppStoreConflict: (error: unknown) => error instanceof AppStoreConflictError,
    getPaymentByMerchantOrderId: async () => payment,
    claimPaymentProcessing: async (...args: unknown[]) => {
      calls.push("claimProcessing");
      claimArgs.push(args);
      const result = await claimBehavior();
      afterClaim?.();
      return result;
    },
    readData: async () => structuredClone(db),
    writeData: async (data: Record<string, unknown>) => {
      const outcome = writes[writeCount] ?? "ok";
      writeCount += 1;
      calls.push(`holdWrite:${outcome instanceof Error ? "error" : outcome}`);
      if (outcome === "conflict") throw new AppStoreConflictError();
      if (outcome instanceof Error) throw outcome;
      db = structuredClone(data);
    },
    markPaymentFailed: async () => {
      calls.push("markFailed");
      return null;
    },
    claimPaymentApproved: async () => {
      calls.push("claimApproved");
      return { status: "paid" };
    },
    writeDataWithOrderForPayment: async () => {},
  },
});

mock.module("@/lib/server/nicepayApprove", {
  namedExports: {
    nicepayConfigured: () => true,
    nicepayClientKey: () => "client-1",
    verifyReturnSignature: () => true,
    approveNicepayPayment: async (input: { tid: string }) => {
      calls.push("approve");
      approveTids.push(input.tid);
      return { kind: "approved", ok: true, reason: "", raw: {}, result: {}, httpStatus: 200 };
    },
  },
});

mock.module("@/lib/server/withdrawAccount", {
  namedExports: { isActiveUser: () => true },
});

mock.module("@/lib/server/applyOrder", {
  namedExports: {
    promotionDiscountConflict: () => undefined,
    applyFreeCoupon: (_d: unknown, _u: unknown, details: unknown, amount: number) => ({ amount, details }),
    applyReferral: (_d: unknown, _u: unknown, details: unknown, amount: number) => ({ amount, details }),
    applyPoints: (_u: unknown, details: unknown, amount: number) => ({ amount, details }),
    orderIdForPayment: (id: string) => `o-${id}`,
    consultationIdForPayment: (id: string) => `c-${id}`,
    commitOrder: async () => {
      calls.push("commitOrder");
      return { ok: true, order: { id: `o-${MOID}` } };
    },
    commitConsultation: async () => {
      calls.push("commitConsultation");
      return { ok: true, consultation: { id: `c-${MOID}` } };
    },
  },
});

async function POST(): Promise<Response> {
  const route = await import("../../app/api/payments/nicepay/return/route.ts");
  const form = new FormData();
  form.set("authResultCode", "0000");
  form.set("tid", "tid-1");
  form.set("clientId", "client-1");
  form.set("orderId", MOID);
  form.set("amount", String((payment.orderSnapshot as { amount: number }).amount));
  form.set("authToken", "token-1");
  form.set("signature", "sig-1");
  return route.POST(new Request("https://example.test/api/payments/nicepay/return", { method: "POST", body: form }));
}

function reset(next: Record<string, unknown> = consultationPayment()) {
  calls.length = 0;
  db = emptyDb();
  writes = [];
  writeCount = 0;
  claimBehavior = async () => ({ status: "processing" });
  afterClaim = null;
  payment = next;
}

function holds(): Record<string, unknown>[] {
  return (db.consultationHolds as Record<string, unknown>[]) ?? [];
}

function order(name: string): number {
  return calls.findIndex((item) => item.startsWith(name));
}

test("일반 상담: 선점 → 확보 → 승인 순서이고 hold가 저장된다", async () => {
  reset();
  const response = await POST();
  assert.equal(response.status, 303);
  assert.ok(order("claimProcessing") < order("holdWrite"));
  assert.ok(order("holdWrite") < order("approve"));
  assert.deepEqual(calls, ["claimProcessing", "holdWrite:ok", "approve", "claimApproved", "commitConsultation"]);
  // 선점 때 남긴 시도 tid와 승인 API에 넘긴 tid가 같다(순서: 선점 → 확보 → 승인 그대로).
  assert.deepEqual(claimArgs.at(-1), [MOID, "tid-1"]);
  assert.deepEqual(approveTids.at(-1), "tid-1");
  assert.equal(holds().length, 1);
  assert.equal(holds()[0].merchantOrderId, MOID);
  assert.equal(holds()[0].checkoutId, CHECKOUT);
  assert.equal(holds()[0].time, TIME);
});

for (const [name, inject] of [
  ["다른 결제의 hold", () => {
    db.consultationHolds = [{ teacher: "유비 선생", date: "10월 20일(화)", time: TIME, merchantOrderId: "is-other", createdAt: "x" }];
  }],
  ["실제 상담", () => {
    db.consultations = [{ id: "c-x", teacher: "유비 선생", datetime: DATETIME, status: "상담 신청" }];
  }],
  ["차단 슬롯", () => {
    db.blockedSlots = [{ teacher: "유비 선생", date: "10월 20일(화)", time: TIME }];
  }],
] as const) {
  test(`선점 직후 ${name}이 생기면 확보 실패 → 승인 0회, failed 기록, 청구 없음 안내`, async () => {
    reset();
    afterClaim = inject;
    const response = await POST();
    const html = await response.text();
    assert.match(html, /이미 예약되었습니다\. 결제는 진행되지 않았습니다\./);
    assert.deepEqual(calls, ["claimProcessing", "markFailed"]);
  });
}

test("처음부터 다른 결제 hold가 있으면 기존 사전 확인에서 끝난다(선점·확보·승인 0회)", async () => {
  reset();
  db.consultationHolds = [{ teacher: "유비 선생", date: "10월 20일(화)", time: TIME, merchantOrderId: "is-other", createdAt: "x" }];
  const html = await (await POST()).text();
  assert.match(html, /이미 예약되었습니다/);
  assert.deepEqual(calls, []);
});

test("확보 CAS 충돌 1회 후 성공 → 승인 1회", async () => {
  reset();
  writes = ["conflict", "ok"];
  const response = await POST();
  assert.equal(response.status, 303);
  assert.deepEqual(calls, [
    "claimProcessing",
    "holdWrite:conflict",
    "holdWrite:ok",
    "approve",
    "claimApproved",
    "commitConsultation",
  ]);
  assert.equal(holds().length, 1);
});

test("확보 CAS 충돌 소진 → 승인 0회, failed 기록, hold 없음", async () => {
  reset();
  writes = ["conflict", "conflict", "conflict"];
  const html = await (await POST()).text();
  assert.match(html, /상담 시간을 확정하지 못했습니다\. 결제는 진행되지 않았습니다\./);
  assert.deepEqual(calls, [
    "claimProcessing",
    "holdWrite:conflict",
    "holdWrite:conflict",
    "holdWrite:conflict",
    "markFailed",
  ]);
  assert.equal(holds().length, 0);
});

test("일반 저장 오류 → 그대로 던지고 승인 0회, failed로 바꾸지 않음", async () => {
  reset();
  const boom = new Error("connection reset");
  writes = [boom];
  await assert.rejects(POST(), (error) => error === boom);
  assert.deepEqual(calls, ["claimProcessing", "holdWrite:error"]);
});

test("같은 신청 결제가 이미 진행/완료(CheckoutPaymentActiveError) → 확보 0회, 승인 0회", async () => {
  reset();
  claimBehavior = async () => {
    throw new CheckoutPaymentActiveError("active");
  };
  await POST();
  assert.deepEqual(calls, ["claimProcessing"]);
  assert.equal(holds().length, 0);
});

test("선점 null → 확보 0회, 승인 0회", async () => {
  reset();
  claimBehavior = async () => null;
  await POST();
  assert.deepEqual(calls, ["claimProcessing"]);
  assert.equal(holds().length, 0);
});

test("일반 주문 결제는 확보 단계를 타지 않는다", async () => {
  reset(orderPayment());
  const response = await POST();
  assert.equal(response.status, 303);
  assert.deepEqual(calls, ["claimProcessing", "approve", "claimApproved", "commitOrder"]);
  assert.equal(writeCount, 0);
});

test("OPEN EVENT 주문도 확보 단계를 타지 않는다", async () => {
  reset(orderPayment("saju-song-open-2026"));
  const response = await POST();
  assert.equal(response.status, 303);
  assert.deepEqual(calls, ["claimProcessing", "approve", "claimApproved", "commitOrder"]);
  assert.equal(writeCount, 0);
});
