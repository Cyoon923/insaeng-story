/**
 * NICEPAY return route의 신청(checkout) 중복 선점 분기 (P1-03 2단계).
 *
 * 실행: npx tsx --experimental-test-module-mocks --test src/lib/server/nicepayReturnCheckoutConflict.test.ts
 *
 * 실제 route의 POST를 부른다. DB·NICEPAY에 닿는 모듈(store, nicepayApprove, withdrawAccount)과
 * 확정 함수(applyOrder)만 대역으로 바꾸고, 가격 계산·동의·슬롯 모듈은 실제 코드를 쓴다.
 * 호출 순서를 한 배열(calls)에 남겨 "선점 성공 뒤에만 승인"을 확인한다.
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

const calls: string[] = [];
let claimBehavior: () => Promise<unknown> = async () => null;
let currentPayment: Record<string, unknown> | null = null;

class CheckoutPaymentActiveError extends Error {}

const MOID = "is-checkout-1";
const AMOUNT = 99000; // 사주 인생곡 정가, 할인 없음

function readyPayment(status = "ready"): Record<string, unknown> {
  return {
    id: "p-1",
    provider: "nicepay",
    merchantOrderId: MOID,
    requestedAmount: AMOUNT,
    status,
    orderId: null,
    orderSnapshot: {
      kind: "order",
      userId: "u-1",
      amount: AMOUNT,
      request: { product: "saju-song", title: "사주 인생곡", options: [], payment: "신용/체크카드" },
      discount: { couponId: null, referralCode: null, usePoints: 0 },
      details: {},
    },
  };
}

mock.module("@/lib/server/store", {
  namedExports: {
    CheckoutPaymentActiveError,
    claimPaymentProcessing: async () => {
      calls.push("claimProcessing");
      return claimBehavior();
    },
    claimPaymentApproved: async () => {
      calls.push("claimApproved");
      return { status: "paid" };
    },
    getPaymentByMerchantOrderId: async () => {
      calls.push("getPayment");
      return currentPayment;
    },
    markPaymentFailed: async () => {
      calls.push("markFailed");
      return null;
    },
    readData: async () => ({ users: [{ id: "u-1" }], consultations: [], blockedSlots: [] }),
    writeDataWithOrderForPayment: async () => {
      calls.push("write");
    },
  },
});

mock.module("@/lib/server/nicepayApprove", {
  namedExports: {
    nicepayConfigured: () => true,
    nicepayClientKey: () => "client-1",
    verifyReturnSignature: () => true,
    approveNicepayPayment: async () => {
      calls.push("approve");
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

/** 대역을 건 뒤에 route를 불러온다. 이 파일은 CJS로 변환되어 top-level await를 쓰지 않는다. */
async function POST(request: Request): Promise<Response> {
  const route = await import("../../app/api/payments/nicepay/return/route.ts");
  return route.POST(request);
}

function returnRequest(): Request {
  const form = new FormData();
  form.set("authResultCode", "0000");
  form.set("tid", "tid-1");
  form.set("clientId", "client-1");
  form.set("orderId", MOID);
  form.set("amount", String(AMOUNT));
  form.set("authToken", "token-1");
  form.set("signature", "sig-1");
  return new Request("https://example.test/api/payments/nicepay/return", {
    method: "POST",
    body: form,
  });
}

function reset(claim: () => Promise<unknown>, payment = readyPayment()) {
  calls.length = 0;
  claimBehavior = claim;
  currentPayment = payment;
}

test("같은 신청의 결제가 이미 진행/완료면 승인·실패 기록·확정 없이 안내로 끝난다", async () => {
  reset(async () => {
    throw new CheckoutPaymentActiveError("active");
  });
  const response = await POST(returnRequest());
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /결제 확인 중입니다/);
  assert.match(
    html,
    /이미 같은 신청의 결제가 진행 중이거나 완료되었습니다\. MY에서 결제 상태를 확인해 주세요\./,
  );
  assert.doesNotMatch(html, /결제를 완료하지 못했습니다/);
  // 선점 시도까지만 있고 그 뒤는 하나도 없다.
  assert.deepEqual(calls, ["getPayment", "claimProcessing"]);
});

test("그 밖의 DB 오류는 삼키지 않고 그대로 던진다(승인에 도달하지 않음)", async () => {
  const dbError = Object.assign(new Error("connection reset"), { code: "08006" });
  reset(async () => {
    throw dbError;
  });
  await assert.rejects(POST(returnRequest()), (error) => error === dbError);
  assert.deepEqual(calls, ["getPayment", "claimProcessing"]);
});

test("선점 null 경로는 기존대로 현재 상태만 안내한다(승인 없음)", async () => {
  reset(async () => null);
  const response = await POST(returnRequest());
  const html = await response.text();
  // getPayment는 ready로 돌려주므로 기존 마지막 분기(확인 중)로 간다.
  assert.match(html, /결제 결과를 확인하고 있습니다\. 잠시 후 MY에서 확인해 주세요\./);
  assert.doesNotMatch(html, /이미 같은 신청의 결제/);
  assert.deepEqual(calls, ["getPayment", "claimProcessing", "getPayment"]);
});

test("선점 성공이면 그 다음에만 승인하고 기존 확정 흐름을 따른다", async () => {
  reset(async () => readyPayment("processing"));
  const response = await POST(returnRequest());
  assert.equal(response.status, 303);
  assert.match(String(response.headers.get("Location")), /\/apply\/complete\?type=order&id=o-is-checkout-1/);
  assert.deepEqual(calls, ["getPayment", "claimProcessing", "approve", "claimApproved", "commitOrder"]);
});
