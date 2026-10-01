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
const claimArgs: unknown[][] = [];
const approveTids: string[] = [];
let claimBehavior: () => Promise<unknown> = async () => null;
let currentPayment: Record<string, unknown> | null = null;

class CheckoutPaymentActiveError extends Error {}
class AppStoreConflictError extends Error {}

/** commitOrder 회차별 결과. 비어 있으면 성공이다(P1-05 재시도 확인용). */
let commitOrderOutcomes: ("conflict" | Error)[] = [];
/** readData 호출 수. 승인 전 1회 + 확정 회차마다 1회. */
let reads = 0;
/** 이 회차(1부터) 이후의 readData는 이미 확정된 주문을 돌려준다(그사이 재접수 흉내). */
let committedFromRead = Infinity;

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
    claimPaymentProcessing: async (...args: unknown[]) => {
      calls.push("claimProcessing");
      claimArgs.push(args);
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
    isAppStoreConflict: (error: unknown) => error instanceof AppStoreConflictError,
    readData: async () => {
      reads += 1;
      return {
        users: [{ id: "u-1" }],
        orders: reads >= committedFromRead ? [{ id: `o-${MOID}` }] : [],
        consultations: [],
        blockedSlots: [],
      };
    },
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
      const outcome = commitOrderOutcomes.shift();
      if (outcome === "conflict") throw new AppStoreConflictError();
      if (outcome) throw outcome;
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
  claimArgs.length = 0;
  commitOrderOutcomes = [];
  reads = 0;
  committedFromRead = Infinity;
  approveTids.length = 0;
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
  // 선점에 넘긴 시도 tid는 인증 return의 tid이고, 승인 API에 넘긴 tid와 같다.
  assert.deepEqual(claimArgs, [[MOID, "tid-1"]]);
  assert.deepEqual(approveTids, ["tid-1"]);
});

/* ── P1-05: 승인 뒤 확정 저장의 CAS 충돌 재시도 ─────────── */

const AFTER_APPROVE = ["getPayment", "claimProcessing", "approve", "claimApproved"];

test("P1-05 일반 주문: 첫 확정이 CAS 충돌 → 새로 읽고 다시 확정해 완료, 승인은 1회", async () => {
  reset(async () => readyPayment("processing"));
  commitOrderOutcomes = ["conflict"];
  const response = await POST(returnRequest());
  assert.equal(response.status, 303);
  assert.match(String(response.headers.get("Location")), /\/apply\/complete\?type=order&id=o-is-checkout-1/);
  assert.deepEqual(calls, [...AFTER_APPROVE, "commitOrder", "commitOrder"]);
  assert.deepEqual(approveTids, ["tid-1"]);
  // 승인 전 1회 + 확정 회차마다 새로 읽는다(이전 liveData를 다시 쓰지 않는다).
  assert.equal(reads, 3);
});

test("P1-05 일반 주문: CAS 충돌 3회 → 기존 pending(paid+미연결은 관리자 재접수로 복구), 승인 1회", async () => {
  reset(async () => readyPayment("processing"));
  commitOrderOutcomes = ["conflict", "conflict", "conflict", "conflict"];
  const response = await POST(returnRequest());
  const html = await response.text();
  assert.match(html, /결제는 완료되었으나 접수 처리를 확인 중입니다/);
  assert.deepEqual(calls, [...AFTER_APPROVE, "commitOrder", "commitOrder", "commitOrder"]);
  assert.deepEqual(approveTids, ["tid-1"]);
  assert.equal(reads, 4);
});

test("P1-05 일반 주문: CAS 충돌이 아닌 오류 → 재시도 없이 기존 pending", async () => {
  reset(async () => readyPayment("processing"));
  commitOrderOutcomes = [new Error("db down")];
  const html = await (await POST(returnRequest())).text();
  assert.match(html, /결제는 완료되었으나 접수 처리를 확인 중입니다/);
  assert.deepEqual(calls, [...AFTER_APPROVE, "commitOrder"]);
  assert.equal(reads, 2);
});

test("P1-05 일반 주문: 재시도 전에 같은 주문이 이미 확정됐으면 commit을 다시 부르지 않는다", async () => {
  reset(async () => readyPayment("processing"));
  commitOrderOutcomes = ["conflict"];
  committedFromRead = 3; // 두 번째 확정 회차의 readData부터 o-<MOID>가 있다
  const html = await (await POST(returnRequest())).text();
  assert.match(html, /결제는 완료되었으나 접수 처리를 확인 중입니다/);
  assert.deepEqual(calls, [...AFTER_APPROVE, "commitOrder"]);
});
