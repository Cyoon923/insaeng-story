/**
 * 일반 1:1 상담 슬롯 확보의 결합 흐름 (P1-04 Stage 3).
 *
 * 실행: npx tsx --experimental-test-module-mocks --test src/lib/server/consultationHoldFlow.test.ts
 *
 * 실제 NICEPAY return POST, 실제 관리자 recommit POST, 실제 commitConsultation·확보/해제 helper·
 * 슬롯 판정을 쓴다. 대역은 DB·PG·세션 경계뿐이다.
 * - store: 메모리 app_store(version CAS 흉내)와 payments 상태 전이
 * - nicepayApprove: 승인 결과(approved / declined / unknown)를 정해 둔다
 * - withdrawAccount: 활성 회원
 * - chatInquiryApi: 관리자 인증 통과
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

const TEACHER = "유비 선생";
const DATE = "10월 20일(화)";
const TIME = "오전 10:00";
const DATETIME = `${DATE} ${TIME}`;
const AMOUNT = 100000;

class AppStoreConflictError extends Error {}
class CheckoutPaymentActiveError extends Error {}

type Row = Record<string, unknown>;

/* ── 메모리 저장소 ─────────────────────────────────── */

let db: Row;
let version = 0;
const readVersions = new WeakMap<object, number>();
let payments: Record<string, Row>;
let orderRows: Row[];
let failNextOrderWrite = false;
/** 참이면 승인 API가 불린 뒤의 모든 app_store 쓰기를 CAS 충돌로 밀어낸다. */
let conflictAfterApprove = false;
let approveOutcome: "approved" | "declined" | "unknown" = "approved";
let approveCalls: string[] = [];
let onClaim: ((merchantOrderId: string) => Promise<void>) | null = null;

function baseDb(): Row {
  return {
    users: [{ id: "u-1", name: "고객", phone: "010-1234-5678", points: 0 }, { id: "u-2", name: "고객2", phone: "010-2222-3333", points: 0 }],
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
    consultationHolds: [],
    adminPromo: null,
  };
}

function readData(): Row {
  const copy = structuredClone(db);
  readVersions.set(copy, version);
  return copy;
}

function commitCas(data: Row): void {
  if (conflictAfterApprove && approveCalls.length > 0) throw new AppStoreConflictError();
  if (readVersions.get(data) !== version) throw new AppStoreConflictError();
  version += 1;
  db = structuredClone(data);
  readVersions.set(data, version);
}

function payment(merchantOrderId: string, userId = "u-1"): Row {
  return {
    provider: "nicepay",
    merchantOrderId,
    requestedAmount: AMOUNT,
    approvedAmount: null,
    status: "ready",
    orderId: null,
    pgTid: null,
    orderSnapshot: {
      kind: "consultation",
      userId,
      amount: AMOUNT,
      request: {
        title: "1:1 사주상담",
        report: "",
        extraPerson: "",
        payment: "신용/체크카드",
        teacher: TEACHER,
        datetime: DATETIME,
        purpose: "",
        method: "카카오톡 상담",
        option: "없음",
      },
      discount: { couponId: null, referralCode: null, usePoints: 0 },
      details: { applyConsent: "1" },
    },
  };
}

mock.module("@/lib/server/store", {
  namedExports: {
    CheckoutPaymentActiveError,
    isAppStoreConflict: (error: unknown) => error instanceof AppStoreConflictError,
    nowId: () => `n-${Math.random().toString(36).slice(2, 8)}`,
    readData: async () => readData(),
    writeData: async (data: Row) => commitCas(data),
    writeDataWithOrder: async () => {
      throw new Error("not used");
    },
    writeDataWithOrderForPayment: async (data: Row, order: Row, merchantOrderId: string) => {
      // 확정 저장 1회를 CAS 충돌로 밀어낸다(그사이 다른 요청이 app_store를 쓴 상황).
      if (failNextOrderWrite) {
        failNextOrderWrite = false;
        throw new AppStoreConflictError();
      }
      commitCas(data); // app_store CAS가 실패하면 아래 주문·결제 연결도 일어나지 않는다(한 문장)
      orderRows.push(order);
      payments[merchantOrderId].orderId = order.id;
    },
    getPaymentByMerchantOrderId: async (merchantOrderId: string) =>
      payments[merchantOrderId] ? structuredClone(payments[merchantOrderId]) : null,
    claimPaymentProcessing: async (merchantOrderId: string, attemptTid: string) => {
      const row = payments[merchantOrderId];
      if (!row || row.status !== "ready") return null;
      // 실제 SQL처럼 선점과 시도 tid 기록을 한 번에 한다.
      Object.assign(row, { status: "processing", approveAttemptTid: attemptTid });
      if (onClaim) await onClaim(merchantOrderId);
      return structuredClone(row);
    },
    claimPaymentApproved: async (input: { merchantOrderId: string; approvedAmount: number; pgTid: string }) => {
      const row = payments[input.merchantOrderId];
      if (!row || row.status !== "processing") return null;
      Object.assign(row, { status: "paid", approvedAmount: input.approvedAmount, pgTid: input.pgTid });
      return structuredClone(row);
    },
    markPaymentFailed: async ({ merchantOrderId }: { merchantOrderId: string }) => {
      const row = payments[merchantOrderId];
      if (!row || row.status !== "processing") return null;
      row.status = "failed";
      return structuredClone(row);
    },
    linkPaymentToOrder: async ({ merchantOrderId, orderId }: { merchantOrderId: string; orderId: string }) => {
      const row = payments[merchantOrderId];
      if (!row || row.orderId || row.status !== "paid") return false;
      row.orderId = orderId;
      return true;
    },
  },
});

mock.module("@/lib/server/nicepayApprove", {
  namedExports: {
    nicepayConfigured: () => true,
    nicepayClientKey: () => "client-1",
    verifyReturnSignature: () => true,
    approveNicepayPayment: async (input: { merchantOrderId: string }) => {
      approveCalls.push(input.merchantOrderId);
      if (approveOutcome === "declined") {
        return { kind: "declined", ok: false, reason: "카드사 승인이 완료되지 않았습니다.", raw: {}, result: {}, httpStatus: 200 };
      }
      if (approveOutcome === "unknown") {
        return { kind: "unknown", ok: false, reason: "", raw: null, result: null, httpStatus: null };
      }
      return { kind: "approved", ok: true, reason: "", raw: {}, result: { tid: "tid-1" }, httpStatus: 200 };
    },
  },
});

mock.module("@/lib/server/withdrawAccount", {
  namedExports: { isActiveUser: () => true },
});

mock.module("@/lib/server/chatInquiryApi", {
  namedExports: {
    requireAdmin: async () => null,
    badRequest: (message: string) => Response.json({ error: message }, { status: 400 }),
    readJsonBody: async (request: Request) => request.json(),
  },
});

async function nicepayReturn(merchantOrderId: string): Promise<Response> {
  const route = await import("../../app/api/payments/nicepay/return/route.ts");
  const form = new FormData();
  form.set("authResultCode", "0000");
  form.set("tid", `tid-${merchantOrderId}`);
  form.set("clientId", "client-1");
  form.set("orderId", merchantOrderId);
  form.set("amount", String(AMOUNT));
  form.set("authToken", "token");
  form.set("signature", "sig");
  return route.POST(new Request("https://example.test/api/payments/nicepay/return", { method: "POST", body: form }));
}

async function recommit(merchantOrderId: string): Promise<Response> {
  const route = await import("../../app/api/admin/payments/recommit/route.ts");
  return route.POST(
    new Request("https://example.test/api/admin/payments/recommit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchantOrderId }),
    }),
  );
}

async function slotAvailable(): Promise<boolean> {
  const slots = await import("./consultationSlots.ts");
  return slots.isSlotAvailable(structuredClone(db) as never, TEACHER, DATE, TIME);
}

function holds(): Row[] {
  return (db.consultationHolds as Row[]) ?? [];
}
function consultations(): Row[] {
  return db.consultations as Row[];
}

function reset(...ids: string[]) {
  db = baseDb();
  version = 0;
  payments = {};
  for (const [index, id] of ids.entries()) payments[id] = payment(id, index === 0 ? "u-1" : "u-2");
  orderRows = [];
  failNextOrderWrite = false;
  conflictAfterApprove = false;
  approveOutcome = "approved";
  approveCalls = [];
  onClaim = null;
}

/* ── A. 정상 ───────────────────────────────────────── */

test("A. 정상: 확보 → 승인 → 같은 저장에서 hold 0 + 상담 1 + 주문 연결, 슬롯은 예약됨", async () => {
  reset("is-a");
  const response = await nicepayReturn("is-a");
  assert.equal(response.status, 303);
  assert.deepEqual(approveCalls, ["is-a"]);
  assert.equal(payments["is-a"].status, "paid");
  assert.equal(payments["is-a"].orderId, "c-is-a");
  assert.equal(payments["is-a"].approveAttemptTid, "tid-is-a");
  assert.equal(payments["is-a"].pgTid, "tid-is-a");
  assert.equal(holds().length, 0);
  assert.equal(consultations().length, 1);
  assert.equal(consultations()[0].id, "c-is-a");
  assert.equal(orderRows.length, 1);
  assert.equal(await slotAvailable(), false);
});

/* ── B. 두 고객 경쟁 ──────────────────────────────── */

test("B. 두 고객이 같은 슬롯: 한 명만 승인, 상담 1개, 진 쪽은 failed·청구 없음", async () => {
  reset("is-x", "is-y");
  // X가 선점한 직후(확보 전) Y의 return이 처음부터 끝까지 진행된다.
  let ranY = false;
  onClaim = async (merchantOrderId) => {
    if (merchantOrderId !== "is-x" || ranY) return;
    ranY = true;
    const y = await nicepayReturn("is-y");
    assert.equal(y.status, 303);
  };
  const x = await nicepayReturn("is-x");
  const html = await x.text();
  assert.match(html, /이미 예약되었습니다\. 결제는 진행되지 않았습니다\./);
  assert.deepEqual(approveCalls, ["is-y"]);
  assert.equal(payments["is-y"].status, "paid");
  assert.equal(payments["is-x"].status, "failed");
  assert.equal(consultations().length, 1);
  assert.equal(consultations()[0].id, "c-is-y");
  assert.equal(holds().length, 0);
});

/* ── C. declined ─────────────────────────────────── */

test("C. 승인 거절: 결제 failed, 자기 hold 해제, 슬롯 다시 가능", async () => {
  reset("is-a");
  approveOutcome = "declined";
  await nicepayReturn("is-a");
  assert.deepEqual(approveCalls, ["is-a"]);
  assert.equal(payments["is-a"].status, "failed");
  assert.equal(holds().length, 0);
  assert.equal(consultations().length, 0);
  assert.equal(await slotAvailable(), true);
});

test("C'. 거절 뒤 hold 해제가 계속 밀려도 결제는 failed 그대로(hold만 남음)", async () => {
  reset("is-a");
  approveOutcome = "declined";
  conflictAfterApprove = true;
  await nicepayReturn("is-a");
  assert.equal(payments["is-a"].status, "failed");
  // 해제 쓰기가 3회 모두 밀려 hold가 남는다(고아 hold). 결제 결과는 바뀌지 않았다.
  assert.equal(holds().length, 1);
  assert.equal(await slotAvailable(), false);
});

/* ── D. unknown ─────────────────────────────────── */

test("D. 승인 결과 불명: processing 유지, hold 유지, 슬롯 막힘", async () => {
  reset("is-a");
  approveOutcome = "unknown";
  const html = await (await nicepayReturn("is-a")).text();
  assert.match(html, /결제 확인 중입니다/);
  assert.equal(payments["is-a"].status, "processing");
  assert.equal(holds().length, 1);
  assert.equal(holds()[0].merchantOrderId, "is-a");
  assert.equal(await slotAvailable(), false);
});

/* ── E. 승인 후 commit CAS 실패 → recommit ─────────── */

test("E. 승인 후 저장 CAS 실패 → paid+미연결·hold 유지 → recommit이 hold를 상담으로 전환", async () => {
  reset("is-a");
  failNextOrderWrite = true;
  const html = await (await nicepayReturn("is-a")).text();
  assert.match(html, /결제는 완료되었으나 접수 처리를 확인 중입니다/);
  assert.equal(payments["is-a"].status, "paid");
  assert.equal(payments["is-a"].orderId, null);
  assert.equal(holds().length, 1);
  assert.equal(consultations().length, 0);
  assert.equal(await slotAvailable(), false);

  const response = await recommit("is-a");
  const json = await response.json();
  assert.equal(response.status, 200, JSON.stringify(json));
  assert.equal(json.recommitted, true);
  assert.equal(payments["is-a"].orderId, "c-is-a");
  assert.equal(holds().length, 0);
  assert.equal(consultations().length, 1);
  assert.equal(await slotAvailable(), false);
});

/* ── F. hold 없는 기존 결제의 recommit ─────────────── */

test("F. hold가 없는 기존 paid+미연결 상담도 기존처럼 recommit된다", async () => {
  reset("is-old");
  Object.assign(payments["is-old"], { status: "paid", approvedAmount: AMOUNT, pgTid: "tid-old" });
  const response = await recommit("is-old");
  const json = await response.json();
  assert.equal(response.status, 200, JSON.stringify(json));
  assert.equal(payments["is-old"].orderId, "c-is-old");
  assert.equal(consultations().length, 1);
  assert.equal(holds().length, 0);
});

/* ── G. 다른 결제 hold 보호 ───────────────────────── */

test("G. 다른 결제의 hold가 있으면 recommit은 실패하고 그 hold를 지우지 않는다", async () => {
  reset("is-old");
  Object.assign(payments["is-old"], { status: "paid", approvedAmount: AMOUNT, pgTid: "tid-old" });
  db.consultationHolds = [{ teacher: TEACHER, date: DATE, time: TIME, merchantOrderId: "is-other", createdAt: "x" }];
  const response = await recommit("is-old");
  const json = await response.json();
  assert.equal(response.status, 409);
  assert.equal(json.needsManualReview, true);
  assert.equal(payments["is-old"].orderId, null);
  assert.equal(consultations().length, 0);
  assert.deepEqual(holds().map((item) => item.merchantOrderId), ["is-other"]);
});

test("G'. 정상 승인 전환도 다른 결제 hold(다른 시간)는 남긴다", async () => {
  reset("is-a");
  db.consultationHolds = [{ teacher: TEACHER, date: DATE, time: "오전 11:00", merchantOrderId: "is-other", createdAt: "x" }];
  await nicepayReturn("is-a");
  assert.equal(consultations().length, 1);
  assert.deepEqual(holds().map((item) => item.merchantOrderId), ["is-other"]);
});
