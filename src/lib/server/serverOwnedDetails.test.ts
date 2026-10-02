/**
 * details 서버 소유 키 위조 차단 (P1-10 F1).
 *
 * 실행: npx tsx --test src/lib/server/serverOwnedDetails.test.ts
 *   (applyOrder.ts가 "@/..." 별칭을 쓰므로 별칭을 해석하는 tsx로 돌린다.)
 *
 * 클라이언트가 details에 서버만 만들 수 있는 값을 실어 보내도 최종 저장 details에는
 * 이번 요청에서 서버가 다시 계산한 값만 남는지 본다. 저장은 writer spy가 받는다.
 * DB·PG·네트워크는 쓰지 않는다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  SERVER_OWNED_DETAIL_KEYS,
  commitConsultation,
  commitOrder,
  stripServerOwnedDetails,
} from "./applyOrder.ts";
import { CONSULT_TIMES } from "./consultationSlots.ts";
import { evaluateZeroPointsRefund } from "./zeroPointsRefund.ts";
import type { AppData, Coupon, Order, User } from "@/lib/types/app";

const USER = "u-f1";

/** 클라이언트가 위조해 넣을 수 있는 서버 소유 값 전부. */
const FORGED = {
  eventOrderId: "o-victim-event",
  couponFree: "1",
  couponTitle: "가짜 쿠폰",
  pointsUsed: "1",
  referralDiscount: "50000",
  referralType: "admin",
  referralPercent: "50",
  referrerId: "u-fake-referrer",
  promotion: "open-event",
};

function makeData(points: number, extra: Partial<AppData> = {}): AppData {
  return {
    users: [{ id: USER, name: "테스트", points } as unknown as User],
    orders: [], consultations: [], inquiries: [], reviews: [], wishlists: {},
    coupons: {}, couponCodes: {}, notifications: {}, notificationSettings: {},
    codes: {}, blockedSlots: [], adminPromo: null,
    ...extra,
  } as AppData;
}

/** 저장소 대역. 불린 시점의 사본을 저장된 상태로 둔다. */
function spy() {
  const state = { calls: 0, order: null as Order | null, data: null as AppData | null };
  const write = async (data: AppData, order: Order) => {
    state.calls += 1;
    state.order = structuredClone(order);
    state.data = structuredClone(data);
  };
  return { state, write };
}

/** 0원 인생곡 주문(free-only). 사주 인생곡 기본가 99,000원. */
async function order(data: AppData, details: Record<string, string>) {
  const { state, write } = spy();
  const result = await commitOrder(
    data,
    data.users[0],
    { product: "saju-song", title: "사주 인생곡", options: [], payment: "card", details },
    { requireConsent: false, write },
  );
  return { result, state };
}

/** 0원 1:1 상담(free-only). 기본가 100,000원. */
async function consultation(data: AppData, details: Record<string, string>) {
  const { state, write } = spy();
  const result = await commitConsultation(
    data,
    data.users[0],
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
      details,
    },
    { requireConsent: false, requireSchedule: false, verifyOfferedDate: false, write },
  );
  return { result, state };
}

function assertNoForged(details: Record<string, string> | undefined, keep: string[] = []) {
  assert.ok(details);
  for (const [key, value] of Object.entries(FORGED)) {
    if (keep.includes(key)) {
      assert.notEqual(details[key], value, `${key}는 위조값이 아니라 서버 값이어야 한다`);
    } else {
      assert.equal(key in details, false, `${key}가 남으면 안 된다 (값: ${details[key]})`);
    }
  }
}

/* ── helper ───────────────────────────────────────── */

test("helper: 서버 소유 키 9개만 지우고 입력 키(couponId·usePoints·referralCode)와 나머지는 남긴다", () => {
  const details: Record<string, string> = {
    ...FORGED,
    couponId: "cp-1",
    usePoints: "1",
    referralCode: "AD1234",
    story: "사연",
    scheduledDate: "2026-10-20",
  };
  stripServerOwnedDetails(details);
  assert.deepEqual(details, {
    couponId: "cp-1",
    usePoints: "1",
    referralCode: "AD1234",
    story: "사연",
    scheduledDate: "2026-10-20",
  });
  assert.deepEqual([...SERVER_OWNED_DETAIL_KEYS].sort(), Object.keys(FORGED).sort());
});

/* ── 1. 일반 상담의 eventOrderId ─────────────────────── */

test("일반 상담: 위조 eventOrderId 등 서버 소유 값이 상담·결제 귀속 주문 어디에도 남지 않는다", async () => {
  const data = makeData(100000);
  const { result, state } = await consultation(data, { ...FORGED, usePoints: "1" });
  assert.equal(result.ok, true);
  assert.equal(state.calls, 1);
  const consult = state.data!.consultations[0];
  assertNoForged(consult.details, ["pointsUsed"]);
  assertNoForged(state.order!.details, ["pointsUsed"]);
  // 적립금은 서버가 잔액 기준으로 다시 계산한 값이다.
  assert.equal(consult.details.pointsUsed, "100000");
  assert.equal(state.order!.details.pointsUsed, "100000");
  assert.equal(state.order!.payment, "적립금");
});

/* ── 2~4. 주문의 추천인·쿠폰·적립금 위조 ──────────────────── */

test("주문: 위조 referral*/couponFree/couponTitle/pointsUsed/promotion/eventOrderId가 제거되고 결제수단도 서버 기준", async () => {
  const data = makeData(99000);
  const { result, state } = await order(data, { ...FORGED, usePoints: "1" });
  assert.equal(result.ok, true);
  const details = state.order!.details;
  assertNoForged(details, ["pointsUsed"]);
  assert.equal(details.pointsUsed, "99000");
  // couponFree 위조가 남았다면 "무료 쿠폰"으로 표시됐을 자리다.
  assert.equal(state.order!.payment, "적립금");
  assert.equal(state.order!.amount, 0);
});

test("상담: 위조 referral*/couponFree/couponTitle가 제거된다", async () => {
  const data = makeData(100000);
  const { state } = await consultation(data, {
    referralType: "admin",
    referralDiscount: "1",
    referralPercent: "99",
    referrerId: "u-x",
    couponFree: "1",
    couponTitle: "가짜",
    usePoints: "1",
  });
  const details = state.order!.details;
  for (const key of ["referralType", "referralDiscount", "referralPercent", "referrerId", "couponFree", "couponTitle"]) {
    assert.equal(key in details, false, key);
  }
});

/* ── 5~6. 정상 입력은 서버 값으로 다시 만들어진다 ─────────────── */

test("정상 무료 쿠폰: couponId는 남고 couponTitle·couponFree는 서버가 쿠폰에서 다시 만든다", async () => {
  const coupon: Coupon = { id: "cp-1", title: "사주 인생곡 무료 쿠폰", desc: "", createdAt: "2026-01-01", product: "saju-song" };
  const data = makeData(0, { coupons: { [USER]: [coupon] } });
  const { result, state } = await order(data, { couponId: "cp-1", couponTitle: "가짜 쿠폰", couponFree: "0" });
  assert.equal(result.ok, true);
  const details = state.order!.details;
  assert.equal(details.couponId, "cp-1");
  assert.equal(details.couponTitle, "사주 인생곡 무료 쿠폰");
  assert.equal(details.couponFree, "1");
  assert.equal(state.order!.payment, "무료 쿠폰");
  // 쿠폰은 기존대로 사용 처리된다.
  assert.ok(state.data!.coupons[USER][0].usedAt);
});

test("정상 관리자 코드 + 적립금: referral*은 서버 값, 위조값은 남지 않음", async () => {
  const data = makeData(100000, { adminPromo: { code: "AD1234", percent: 30, createdAt: "2026-01-01" } });
  const { result, state } = await order(data, {
    referralCode: "AD1234",
    referralType: "user",
    referralDiscount: "1",
    referralPercent: "1",
    usePoints: "1",
  });
  assert.equal(result.ok, true);
  const details = state.order!.details;
  // 99,000 × 30% = 29,700 할인, 나머지 69,300을 적립금으로.
  assert.equal(details.referralCode, "AD1234");
  assert.equal(details.referralType, "admin");
  assert.equal(details.referralDiscount, "29700");
  assert.equal(details.referralPercent, "30");
  assert.equal(details.pointsUsed, "69300");
  assert.equal(state.data!.users[0].points, 100000 - 69300);
});

test("정상 적립금 사용: usePoints는 남고 pointsUsed는 잔액 기준 서버 값", async () => {
  const data = makeData(150000);
  const { state } = await order(data, { usePoints: "1", pointsUsed: "5" });
  assert.equal(state.order!.details.usePoints, "1");
  assert.equal(state.order!.details.pointsUsed, "99000");
  assert.equal(state.data!.users[0].points, 150000 - 99000);
});

test("결제 승인 경로(paid-approved): 스냅샷에 담겨 온 서버 값도 다시 계산되어 같은 값으로 남는다", async () => {
  const data = makeData(10000);
  const { state, write } = spy();
  const result = await commitOrder(
    data,
    data.users[0],
    { product: "saju-song", title: "사주 인생곡", options: [], payment: "card", details: { usePoints: "1", pointsUsed: "10000" } },
    { requireConsent: false, orderId: "o-paid", mode: "paid-approved", approvedAmount: 89000, write },
  );
  assert.equal(result.ok, true);
  assert.equal(state.order!.amount, 89000);
  assert.equal(state.order!.details.pointsUsed, "10000");
});

/* ── 7. P1-09 적립금 전액 0원 판정 ────────────────────────── */

test("P1-09: 서버가 만든 pointsUsed가 남아 적립금 0원 판정이 eligible", async () => {
  const data = makeData(99000);
  const { state } = await order(data, { ...FORGED, usePoints: "1" });
  const saved = state.order!;
  const decision = await evaluateZeroPointsRefund(saved, 0);
  assert.equal(decision.kind, "eligible");
  assert.equal(decision.kind === "eligible" && decision.pointsUsed, 99000);
});

/* ── 8. OPEN EVENT 경로는 그대로 ─────────────────────────── */

test("OPEN EVENT: eventOrderId를 만드는 경로(prepareEventConsultation)는 helper를 거치지 않는다", () => {
  const event = readFileSync(new URL("./eventConsultation.ts", import.meta.url), "utf8");
  assert.equal(event.includes("stripServerOwnedDetails"), false);
  assert.match(event, /eventOrderId: order\.id|eventOrderId = order\.id|eventOrderId: facts\.order\.id/);

  const apply = readFileSync(new URL("./applyOrder.ts", import.meta.url), "utf8");
  const eventCommit = apply.slice(apply.indexOf("export async function commitEventConsultation("));
  assert.equal(eventCommit.includes("stripServerOwnedDetails"), false);
});

test("호출 위치: commitOrder·commitConsultation 모두 동의·가격·apply* 전에 지운다", () => {
  const apply = readFileSync(new URL("./applyOrder.ts", import.meta.url), "utf8");
  for (const [start, end] of [
    ["export async function commitOrder(", "export async function commitConsultation("],
    ["export async function commitConsultation(", "export async function commitEventConsultation("],
  ]) {
    const body = apply.slice(apply.indexOf(start), apply.indexOf(end));
    const strip = body.indexOf("stripServerOwnedDetails(details);");
    assert.ok(strip > 0, `${start} 안에서 호출해야 한다`);
    for (const later of ["applyConsent", "applyFreeCoupon(", "applyReferral(", "applyPoints("]) {
      assert.ok(body.indexOf(later) > strip, `${later}보다 먼저 지워야 한다`);
    }
  }
});
