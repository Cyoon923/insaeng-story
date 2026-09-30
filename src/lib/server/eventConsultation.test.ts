/**
 * OPEN EVENT 상담 예약 서버 관문 테스트.
 *
 * 실행: node --test src/lib/server/eventConsultation.test.ts
 *
 * 판정은 순수 함수(prepareEventConsultation)로 본다. applyOrder.ts·route.ts는 DB 드라이버를
 * 불러오므로 import하지 않고, 저장 경로는 원문으로 확인한다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  eventConsultationBookHref,
  eventConsultationId,
  findEventConsultation,
  isEventConsultationOrder,
  prepareEventConsultation,
  readEventConsultationInput,
} from "./eventConsultation.ts";
import type { EventConsultationFacts, EventConsultationInput } from "./eventConsultation.ts";
import { upcomingConsultDateOptions } from "./consultationSlots.ts";
import type { AppData, Order, Payment, User } from "@/lib/types/app";

const ORDER_ID = "o-is-abc";
const date = upcomingConsultDateOptions()[2];

function user(id = "u-1"): User {
  return { id, name: "홍길동", phone: "01012345678" } as User;
}

function data(): AppData {
  return {
    users: [],
    orders: [],
    consultations: [],
    notifications: {},
    notificationSettings: {},
    blockedSlots: [],
    coupons: {},
  } as unknown as AppData;
}

function order(overrides: Partial<Order> = {}, details: Record<string, string> = {}): Order {
  return {
    id: ORDER_ID,
    userId: "u-1",
    product: "saju-song",
    title: "사주 인생곡",
    status: "신청접수",
    amount: 119000,
    baseAmount: 119000,
    payment: "신용/체크카드",
    details: {
      promotion: "saju-song-open-2026",
      optionIds: "saju-consultation",
      name: "홍길동",
      phone: "010-1234-5678",
      gender: "남성",
      birth: "1980-01-01",
      birthTime: "10:30",
      calendar: "양력",
      bloodType: "모름",
      ...details,
    },
    createdAt: "2026-10-04T00:00:00.000Z",
    ...overrides,
  };
}

function paid(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "pay-1",
    orderId: ORDER_ID,
    provider: "nicepay",
    merchantOrderId: "is-abc",
    pgTid: "tid-1",
    requestedAmount: 119000,
    approvedAmount: 119000,
    cancelledAmount: 0,
    status: "paid",
    method: "card",
    approvedAt: "2026-10-04T00:00:00.000Z",
    cancelledAt: null,
    orderSnapshot: null,
    raw: null,
    createdAt: "2026-10-04T00:00:00.000Z",
    updatedAt: "2026-10-04T00:00:00.000Z",
    cancelAttemptedAt: null,
    cancelResultKind: null,
    cancelResultCode: null,
    cancelResultMessage: null,
    cancelResponseRaw: null,
    cancelExecutionStatus: null,
    cancelClaimedAt: null,
    ...overrides,
  };
}

function input(overrides: Partial<EventConsultationInput> = {}): EventConsultationInput {
  return {
    orderId: ORDER_ID,
    teacher: "유비 선생",
    datetime: `${date.label} 오전 10:00`,
    scheduledDate: date.date,
    purpose: "직업 · 사업 고민",
    method: "카카오톡 상담",
    content: "궁금한 점",
    ...overrides,
  };
}

function facts(overrides: Partial<EventConsultationFacts> = {}): EventConsultationFacts {
  return { order: order(), payments: [paid()], refundStatuses: [], ...overrides };
}

function rejected(result: ReturnType<typeof prepareEventConsultation>, status: number) {
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, status);
}

test("정상 paid 이벤트 주문 + 상담 옵션 → Consultation 1건", () => {
  const d = data();
  const result = prepareEventConsultation(d, user(), input(), facts());
  assert.equal(result.ok, true);
  assert.equal(d.consultations.length, 1);
  const c = d.consultations[0];
  assert.equal(c.id, eventConsultationId(ORDER_ID));
  assert.equal(c.userId, "u-1");
  assert.equal(c.amount, 0);
  assert.equal(c.option, "없음");
  assert.equal(c.status, "상담 신청");
  assert.equal(c.details.eventOrderId, ORDER_ID);
  // 사주 기본정보는 서버 주문 details에서 복사된다.
  assert.equal(c.details.name, "홍길동");
  assert.equal(c.details.bloodType, "모름");
  assert.ok(c.scheduledAt && c.scheduledAt.startsWith(date.date.slice(0, 4)));
  // 두 번째 Order·결제는 만들지 않는다.
  assert.equal(d.orders.length, 0);
});

test("다른 회원 주문 거절", () => {
  rejected(prepareEventConsultation(data(), user("u-2"), input(), facts()), 404);
});

test("주문 없음 / id 불일치 거절", () => {
  rejected(prepareEventConsultation(data(), user(), input(), facts({ order: null })), 404);
  rejected(prepareEventConsultation(data(), user(), input({ orderId: "o-other" }), facts()), 404);
});

test("일반 saju-song(promotion 없음) 거절", () => {
  rejected(prepareEventConsultation(data(), user(), input(), facts({ order: order({}, { promotion: "" }) })), 409);
});

test("promotion 불일치 / 다른 상품 거절", () => {
  rejected(prepareEventConsultation(data(), user(), input(), facts({ order: order({}, { promotion: "other" }) })), 409);
  rejected(prepareEventConsultation(data(), user(), input(), facts({ order: order({ product: "story" }) })), 409);
});

test("상담 옵션 없음 거절", () => {
  rejected(prepareEventConsultation(data(), user(), input(), facts({ order: order({}, { optionIds: "saju-report-2026-2027" }) })), 409);
});

test("미결제 거절(결제 없음 / ready / processing / cancelled)", () => {
  rejected(prepareEventConsultation(data(), user(), input(), facts({ payments: [] })), 409);
  for (const status of ["ready", "processing", "cancelled", "failed"] as const) {
    rejected(prepareEventConsultation(data(), user(), input(), facts({ payments: [paid({ status })] })), 409);
  }
});

test("승인 금액 불일치·승인 결제 2건 거절", () => {
  rejected(prepareEventConsultation(data(), user(), input(), facts({ payments: [paid({ approvedAmount: 19000 })] })), 409);
  rejected(prepareEventConsultation(data(), user(), input(), facts({ payments: [paid(), paid({ id: "pay-2" })] })), 409);
});

test("0원 주문 거절", () => {
  rejected(prepareEventConsultation(data(), user(), input(), facts({ order: order({ amount: 0 }), payments: [] })), 409);
});

test("환불 진행 중 거절", () => {
  for (const status of ["requested", "reviewing", "approved"] as const) {
    rejected(prepareEventConsultation(data(), user(), input(), facts({ refundStatuses: [status] })), 409);
  }
});

test("환불 완료 거절", () => {
  rejected(prepareEventConsultation(data(), user(), input(), facts({ refundStatuses: ["completed"] })), 409);
});

test("같은 주문 두 번 예약 거절", () => {
  const d = data();
  assert.equal(prepareEventConsultation(d, user(), input(), facts()).ok, true);
  // 다른 시간으로 다시 시도해도 막힌다.
  rejected(prepareEventConsultation(d, user(), input({ datetime: `${date.label} 오후 2:00` }), facts()), 409);
  assert.equal(d.consultations.length, 1);
});

test("이미 예약된 slot 거절(일반 상담이 잡은 시간)", () => {
  const d = data();
  d.consultations.push({ id: "c-x", userId: "u-9", teacher: "유비 선생", datetime: `${date.label} 오전 10:00`, method: "", option: "", status: "상담 신청", amount: 100000, details: {}, createdAt: "" });
  rejected(prepareEventConsultation(d, user(), input(), facts()), 409);
  assert.equal(d.consultations.length, 1);
});

test("관리자가 막은 slot 거절", () => {
  const d = data();
  d.blockedSlots.push({ teacher: "유비 선생", date: date.label, time: "오전 10:00" });
  rejected(prepareEventConsultation(d, user(), input(), facts()), 409);
});

test("선택값 검증: 선생님·방식·일시·판매하지 않는 날짜·긴 내용", () => {
  rejected(prepareEventConsultation(data(), user(), input({ teacher: "없는 선생" }), facts()), 400);
  rejected(prepareEventConsultation(data(), user(), input({ method: "화상 상담" }), facts()), 400);
  rejected(prepareEventConsultation(data(), user(), input({ datetime: "아무 문자열" }), facts()), 400);
  rejected(prepareEventConsultation(data(), user(), input({ scheduledDate: "2020-01-01" }), facts()), 400);
  rejected(prepareEventConsultation(data(), user(), input({ content: "가".repeat(1001) }), facts()), 400);
});

test("거절된 경우 data를 바꾸지 않는다", () => {
  const d = data();
  prepareEventConsultation(d, user(), input(), facts({ refundStatuses: ["completed"] }));
  assert.equal(d.consultations.length, 0);
  assert.deepEqual(d.notifications, {});
});

test("body에서 금액·결제·사주정보·userId를 읽지 않는다", () => {
  const read = readEventConsultationInput({
    orderId: ORDER_ID, teacher: "유비 선생", datetime: "x", scheduledDate: "y", purpose: "p", method: "m", content: "c",
    amount: 1, paid: true, userId: "u-9", name: "가짜", bloodType: "A형", eventOrderId: "o-evil",
  });
  assert.deepEqual(Object.keys(read).sort(), ["content", "datetime", "method", "orderId", "purpose", "scheduledDate", "teacher"]);
  // 사주정보는 주문 details에서만 온다.
  const d = data();
  prepareEventConsultation(d, user(), input(), facts());
  assert.equal(d.consultations[0].details.name, "홍길동");
});

test("동시 요청: 같은 읽기에서 두 번 준비돼도 CAS로 한 건만 저장된다", () => {
  // app_store CAS를 흉내 낸 저장소. 읽은 version과 지금 version이 같을 때만 저장된다.
  let stored = data();
  let version = 1;
  const read = () => ({ snapshot: structuredClone(stored) as AppData, at: version });
  const write = (snap: AppData, at: number) => {
    if (at !== version) throw new Error("conflict");
    stored = snap;
    version += 1;
  };
  const a = read();
  const b = read();
  assert.equal(prepareEventConsultation(a.snapshot, user(), input(), facts()).ok, true);
  assert.equal(prepareEventConsultation(b.snapshot, user(), input(), facts()).ok, true);
  write(a.snapshot, a.at);
  assert.throws(() => write(b.snapshot, b.at), /conflict/);
  assert.equal(stored.consultations.length, 1);
  // 다시 읽어 재시도하면 중복으로 거절된다.
  const retry = read();
  rejected(prepareEventConsultation(retry.snapshot, user(), input(), facts()), 409);
});

/* ── 저장 경로 원문 확인 ─────────────────────────── */

const APPLY = readFileSync(new URL("./applyOrder.ts", import.meta.url), "utf8");
const FN = APPLY.slice(APPLY.indexOf("export async function commitEventConsultation"));

test("commitEventConsultation은 CAS writeData 한 번만 쓰고 Order·결제를 만들지 않는다", () => {
  assert.ok(FN.startsWith("export async function commitEventConsultation"));
  assert.match(FN, /\(options\.write \?\? writeData\)\(data\)/);
  for (const name of ["writeDataWithOrder", "createPayment", "calcConsultationAmount", "applyFreeCoupon", "applyReferral", "applyPoints", "data.orders", "commitConsultation("]) {
    assert.equal(FN.includes(name), false, name);
  }
});

test("route는 서버가 읽은 주문·결제·환불만 넘긴다", () => {
  const route = readFileSync(new URL("../../app/api/app/route.ts", import.meta.url), "utf8");
  const start = route.indexOf('if (action === "bookEventConsultation")');
  const block = route.slice(start, route.indexOf("\n  if (action ===", start + 10));
  assert.match(block, /verifiedPhoneGate\(user\)/);
  assert.match(block, /readEventConsultationInput\(body\)/);
  assert.match(block, /getOrderById\(input\.orderId\)/);
  assert.match(block, /listPaymentsByOrderId\(order\.id\)/);
  assert.match(block, /listRefundRequestsByOrderId\(order\.id\)/);
  assert.equal(/body\.(amount|paid|payments|refund|name|bloodType)/.test(block), false);
});

/* ── 화면 표시용 판정 ─────────────────────────────── */

test("isEventConsultationOrder: 이벤트 + 상담 옵션 주문만 참", () => {
  assert.equal(isEventConsultationOrder(order()), true);
  assert.equal(isEventConsultationOrder(order({}, { optionIds: "saju-report-2026-2027,saju-consultation" })), true);
  assert.equal(isEventConsultationOrder(order({}, { promotion: "" })), false);
  assert.equal(isEventConsultationOrder(order({}, { optionIds: "saju-report-2026-2027" })), false);
  assert.equal(isEventConsultationOrder(order({ product: "consultation" })), false);
});

test("findEventConsultation: 본인 상담만, id 또는 eventOrderId로 찾는다", () => {
  const d = data();
  prepareEventConsultation(d, user(), input(), facts());
  assert.equal(findEventConsultation(d.consultations, ORDER_ID, "u-1")?.id, eventConsultationId(ORDER_ID));
  assert.equal(findEventConsultation(d.consultations, ORDER_ID, "u-2"), undefined);
  assert.equal(findEventConsultation(d.consultations, "o-is-other", "u-1"), undefined);
});

test("예약 화면 주소는 일반 상담 1단계 이벤트 모드", () => {
  assert.equal(eventConsultationBookHref("o-is-a b"), "/apply/consultation/1?eventOrder=o-is-a%20b");
});
