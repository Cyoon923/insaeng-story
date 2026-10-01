/**
 * 승인 금액 불변조건 (P0-01). paid-approved 확정은 최종금액이 PG 승인 금액과 같을 때만 저장한다.
 *
 * 실행: npx tsx --test src/lib/server/paidCommitApprovedAmount.test.ts
 *   (applyOrder.ts가 "@/..." 별칭을 쓰므로 node --test로는 불러올 수 없다. 별칭을 해석하는 tsx로 돌린다.)
 *
 * 승인 뒤 다른 요청으로 적립금 잔액이 바뀐 상황을 "확정 시점 잔액"으로 만든다.
 * 저장은 writer spy가 받는다. spy가 불리지 않았다는 것이 곧 주문·상담·적립금 차감·
 * payments.order_id 연결이 모두 저장되지 않았다는 뜻이다(writeDataWithOrderForPayment 한 문장).
 * DB·PG·네트워크는 쓰지 않는다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { commitConsultation, commitOrder } from "./applyOrder.ts";
import { CONSULT_TIMES } from "./consultationSlots.ts";
import type { AppData, Order, User } from "@/lib/types/app";

const USER = "u-approved-amount";

function makeData(points: number): AppData {
  return {
    users: [{ id: USER, name: "테스트", points } as unknown as User],
    orders: [], consultations: [], inquiries: [], reviews: [], wishlists: {},
    coupons: {}, couponCodes: {}, notifications: {}, notificationSettings: {},
    codes: {}, blockedSlots: [], adminPromo: null,
  } as AppData;
}

/** 저장소 대역. write가 불렸을 때만 그 시점의 사본을 "저장된 상태"로 바꾼다. */
function spyStore(initial: AppData) {
  const state = { calls: 0, stored: structuredClone(initial), order: null as Order | null };
  const write = async (data: AppData, order: Order) => {
    state.calls += 1;
    state.stored = structuredClone(data);
    state.order = order;
  };
  return { state, write };
}

function storedPoints(data: AppData): number | undefined {
  return data.users.find((u) => u.id === USER)?.points;
}

/** 사주 인생곡 99,000원. 결제 준비 때 적립금 10,000을 써서 89,000이 승인된 건. */
/** approvedAmount에 null을 주면 인자를 넘기지 않는다(undefined는 기본값이 채워지므로 쓰지 않는다). */
async function runOrder(balanceAtCommit: number, approvedAmount: number | null = 89000) {
  const live = makeData(balanceAtCommit);
  const { state, write } = spyStore(live);
  const result = await commitOrder(
    live,
    live.users[0],
    {
      product: "saju-song",
      title: "사주 인생곡",
      options: [],
      payment: "card",
      details: { usePoints: "1", pointsUsed: "10000" },
    },
    {
      requireConsent: false,
      orderId: "o-test",
      mode: "paid-approved",
      write,
      ...(approvedAmount === null ? {} : { approvedAmount }),
    },
  );
  return { result, state };
}

/** 1:1 사주상담 100,000원. 결제 준비 때 적립금 10,000을 써서 90,000이 승인된 건. */
async function runConsultation(balanceAtCommit: number, approvedAmount: number | null = 90000) {
  const live = makeData(balanceAtCommit);
  const { state, write } = spyStore(live);
  const result = await commitConsultation(
    live,
    live.users[0],
    {
      title: "1:1 사주상담",
      report: "",
      extraPerson: "",
      payment: "card",
      teacher: "유비 선생",
      datetime: `10월 20일(화) ${CONSULT_TIMES[0]}`,
      purpose: "",
      method: "카카오톡 상담",
      option: "없음",
      details: { usePoints: "1", pointsUsed: "10000" },
    },
    {
      requireConsent: false,
      requireSchedule: false,
      verifyOfferedDate: false,
      consultationId: "c-test",
      mode: "paid-approved",
      write,
      ...(approvedAmount === null ? {} : { approvedAmount }),
    },
  );
  return { result, state, live };
}

test("일반 주문: 승인 89,000 / 최종 89,000 → 저장", async () => {
  const { result, state } = await runOrder(10000);
  assert.equal(result.ok, true);
  assert.equal(state.calls, 1);
  assert.equal(state.order?.amount, 89000);
  assert.equal(state.order?.details?.pointsUsed, "10000");
  assert.equal(storedPoints(state.stored), 0);
});

for (const [balance, finalAmount] of [[0, 99000], [4000, 95000], [30000, 69000]] as const) {
  test(`일반 주문: 승인 89,000 / 최종 ${finalAmount.toLocaleString()} → 저장 거부`, async () => {
    const { result, state } = await runOrder(balance);
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.status, 409);
    assert.equal(state.calls, 0);
    assert.equal(storedPoints(state.stored), balance);
    assert.equal(state.stored.orders.length, 0);
  });
}

test("일반 상담: 승인 90,000 / 최종 90,000 → 저장", async () => {
  const { result, state } = await runConsultation(10000);
  assert.equal(result.ok, true);
  assert.equal(state.calls, 1);
  assert.equal(state.order?.amount, 90000);
  assert.equal(state.stored.consultations[0]?.amount, 90000);
  assert.equal(storedPoints(state.stored), 0);
});

for (const [balance, finalAmount] of [[0, 100000], [4000, 96000], [30000, 70000]] as const) {
  test(`일반 상담: 승인 90,000 / 최종 ${finalAmount.toLocaleString()} → 저장 거부`, async () => {
    const { result, state, live } = await runConsultation(balance);
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.status, 409);
    assert.equal(state.calls, 0);
    assert.equal(storedPoints(state.stored), balance);
    assert.equal(state.stored.orders.length, 0);
    assert.equal(state.stored.consultations.length, 0);
    // 상담을 만들기 전에 끝나므로 메모리상으로도 슬롯을 점유하지 않는다.
    assert.equal(live.consultations.length, 0);
  });
}

test("paid-approved인데 승인 금액을 넘기지 않으면 저장하지 않는다", async () => {
  const order = await runOrder(10000, null);
  assert.equal(order.result.ok, false);
  assert.equal(order.state.calls, 0);
  const consult = await runConsultation(10000, null);
  assert.equal(consult.result.ok, false);
  assert.equal(consult.state.calls, 0);
});

test("free-only 0원 주문은 승인 금액 없이 그대로 저장된다", async () => {
  const live = makeData(200000);
  const { state, write } = spyStore(live);
  const result = await commitOrder(
    live,
    live.users[0],
    { product: "saju-song", title: "사주 인생곡", options: [], payment: "", details: { usePoints: "1" } },
    { requireConsent: false, write },
  );
  assert.equal(result.ok, true);
  assert.equal(state.calls, 1);
  assert.equal(state.order?.amount, 0);
  assert.equal(storedPoints(state.stored), 101000);
});

const RETURN_ROUTE = readFileSync(
  new URL("../../app/api/payments/nicepay/return/route.ts", import.meta.url),
  "utf8",
);
const RECOMMIT_ROUTE = readFileSync(
  new URL("../../app/api/admin/payments/recommit/route.ts", import.meta.url),
  "utf8",
);

test("NICEPAY return은 주문·상담 모두 PG에 보낸 금액을 승인 금액으로 넘긴다", () => {
  for (const call of ["await commitOrder(", "await commitConsultation("]) {
    const start = RETURN_ROUTE.indexOf(call);
    const block = RETURN_ROUTE.slice(start, RETURN_ROUTE.indexOf("if (!result.ok)", start));
    assert.match(block, /mode: "paid-approved"/, call);
    assert.match(block, /approvedAmount: recalculated,/, call);
  }
  assert.match(RETURN_ROUTE, /approveNicepayPayment\(\{ tid, amount: recalculated, merchantOrderId \}\)/);
});

test("관리자 recommit은 기존 금액 대조를 유지하고 승인 금액을 넘긴다", () => {
  assert.match(RECOMMIT_ROUTE, /recalculated !== snapshotAmount \|\| recalculated !== approvedAmount/);
  assert.equal(RECOMMIT_ROUTE.match(/^\s+approvedAmount,$/gm)?.length, 2);
});
