/**
 * 일반 1:1 상담 슬롯 확보(consultationHolds) 1단계 — 데이터 구조와 슬롯 판정 (P1-04).
 *
 * 실행: npx tsx --test src/lib/server/consultationHoldSlots.test.ts
 *   (mergeData가 있는 store.ts가 "@/..." 별칭을 쓰므로 tsx로 돌린다.)
 *
 * 이 단계는 hold를 만들거나 지우지 않는다. 저장소에 hold가 이미 있다고 가정했을 때
 * 슬롯 판정이 어떻게 달라지는지만 본다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { mergeData } from "./store.ts";
import {
  CONSULT_TIMES,
  getSlotStatus,
  isSlotAvailable,
  listSlotStatuses,
} from "./consultationSlots.ts";
import type { AppData, Consultation, ConsultationHold } from "@/lib/types/app";

const TEACHER = "유비 선생";
const DATE = "10월 20일(화)";
const TIME = CONSULT_TIMES[0];
const OTHER_TIME = CONSULT_TIMES[1];

function data(overrides: Partial<AppData> = {}): AppData {
  return mergeData({ consultations: [], blockedSlots: [], ...overrides });
}

function hold(overrides: Partial<ConsultationHold> = {}): ConsultationHold {
  return {
    teacher: TEACHER,
    date: DATE,
    time: TIME,
    merchantOrderId: "is-a",
    createdAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

function consultation(overrides: Partial<Consultation> = {}): Consultation {
  return {
    id: "c-1",
    userId: "u-1",
    teacher: TEACHER,
    datetime: `${DATE} ${TIME}`,
    purpose: "",
    method: "카카오톡 상담",
    option: "없음",
    status: "상담 신청",
    amount: 100000,
    details: {},
    createdAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  } as Consultation;
}

/* ── merge / default ────────────────────────────────── */

test("기존 저장 데이터에 consultationHolds가 없으면 빈 배열로 읽는다", () => {
  const merged = mergeData({ users: [], consultations: [], blockedSlots: [] });
  assert.deepEqual(merged.consultationHolds, []);
});

test("값이 null이거나 배열이 아니어도 빈 배열로 읽는다", () => {
  assert.deepEqual(mergeData({ consultationHolds: null }).consultationHolds, []);
  assert.deepEqual(mergeData({ consultationHolds: {} }).consultationHolds, []);
  assert.deepEqual(mergeData(null).consultationHolds, []);
});

test("이미 있는 hold는 그대로 읽는다", () => {
  const saved = [hold()];
  assert.deepEqual(mergeData({ consultationHolds: saved }).consultationHolds, saved);
});

test("읽을 때마다 새 배열이라 서로 공유하지 않는다", () => {
  const first = mergeData({});
  const second = mergeData({});
  first.consultationHolds?.push(hold());
  assert.deepEqual(second.consultationHolds, []);
  assert.deepEqual(mergeData({}).consultationHolds, []);
});

test("backfill하지 않는다(읽기 기본값만 있고 쓰기 문장은 없다)", () => {
  const STORE = readFileSync(new URL("./store.ts", import.meta.url), "utf8");
  const body = STORE.slice(STORE.indexOf("export function mergeData("), STORE.indexOf("\n}\n", STORE.indexOf("export function mergeData(")));
  assert.match(
    body,
    /consultationHolds: Array\.isArray\(source\.consultationHolds\) \? source\.consultationHolds : \[\],/,
  );
  assert.doesNotMatch(STORE, /UPDATE app_store[^`]*consultationHolds/);
});

/* ── 슬롯 판정 ─────────────────────────────────────── */

test("hold가 없으면 기존 판정 그대로", () => {
  const empty = data();
  assert.equal(getSlotStatus(empty, TEACHER, DATE, TIME), "available");
  assert.equal(isSlotAvailable(empty, TEACHER, DATE, TIME), true);
  // 키 자체가 없는 객체도 같다(mergeData를 거치지 않은 사본).
  const raw = { consultations: [], blockedSlots: [] } as unknown as AppData;
  assert.equal(isSlotAvailable(raw, TEACHER, DATE, TIME), true);
});

test("다른 결제의 hold → 그 슬롯은 예약됨", () => {
  const held = data({ consultationHolds: [hold({ merchantOrderId: "is-a" })] });
  assert.equal(getSlotStatus(held, TEACHER, DATE, TIME), "booked");
  assert.equal(isSlotAvailable(held, TEACHER, DATE, TIME), false);
  assert.equal(isSlotAvailable(held, TEACHER, DATE, TIME, { ownerMerchantOrderId: "is-b" }), false);
  // 화면 목록도 같은 판정을 쓴다.
  const listed = listSlotStatuses(held, TEACHER, DATE);
  assert.equal(listed.find((slot) => slot.time === TIME)?.status, "booked");
});

test("자기 merchantOrderId를 owner로 주면 자기 hold는 빼고 본다", () => {
  const held = data({ consultationHolds: [hold({ merchantOrderId: "is-a" })] });
  assert.equal(getSlotStatus(held, TEACHER, DATE, TIME, { ownerMerchantOrderId: "is-a" }), "available");
  assert.equal(isSlotAvailable(held, TEACHER, DATE, TIME, { ownerMerchantOrderId: "is-a" }), true);
  // 빈 owner는 예외로 치지 않는다.
  assert.equal(isSlotAvailable(held, TEACHER, DATE, TIME, { ownerMerchantOrderId: "" }), false);
});

test("자기 hold가 있어도 실제 상담이 있으면 예약됨", () => {
  const both = data({
    consultations: [consultation()],
    consultationHolds: [hold({ merchantOrderId: "is-a" })],
  });
  assert.equal(getSlotStatus(both, TEACHER, DATE, TIME, { ownerMerchantOrderId: "is-a" }), "booked");
});

test("차단 슬롯은 hold보다 먼저 blocked로 보인다", () => {
  const blocked = data({
    blockedSlots: [{ teacher: TEACHER, date: DATE, time: TIME }],
    consultationHolds: [hold()],
  });
  assert.equal(getSlotStatus(blocked, TEACHER, DATE, TIME), "blocked");
  assert.equal(getSlotStatus(blocked, TEACHER, DATE, TIME, { ownerMerchantOrderId: "is-a" }), "blocked");
});

test("취소된 상담은 기존처럼 점유하지 않는다(hold가 없을 때)", () => {
  const cancelled = data({ consultations: [consultation({ cancelledAt: "2026-10-02T00:00:00.000Z" })] });
  assert.equal(getSlotStatus(cancelled, TEACHER, DATE, TIME), "available");
});

test("다른 선생님·날짜·시간의 hold는 영향 없음", () => {
  const elsewhere = data({
    consultationHolds: [
      hold({ teacher: "다른 선생" }),
      hold({ date: "10월 21일(수)" }),
      hold({ time: OTHER_TIME }),
    ],
  });
  assert.equal(getSlotStatus(elsewhere, TEACHER, DATE, TIME), "available");
  assert.equal(getSlotStatus(elsewhere, TEACHER, DATE, OTHER_TIME), "booked");
});

/* ── 범위: hold를 쓰는 곳은 정해진 두 곳뿐이다 ─────────────── */

test("hold 쓰기는 확보 helper와 commitConsultation 전환에만 있다", () => {
  // 이 파일들은 hold를 직접 쓰거나 지우지 않는다(확보·해제는 consultationHold.ts가 한다).
  const files = [
    "./store.ts",
    "./eventConsultation.ts",
    "../../app/api/payments/nicepay/return/route.ts",
    "../../app/api/admin/payments/recommit/route.ts",
    "../../app/api/app/route.ts",
    "../../app/api/admin/route.ts",
  ];
  for (const file of files) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    // app_store 데이터의 속성 쓰기만 본다(지역 변수 consultationHolds는 해당 없음).
    assert.doesNotMatch(source, /\.consultationHolds\s*(\.push\(|\.splice\(|\.pop\(|\.shift\(|=(?!=))/, file);
  }
  // applyOrder는 commitConsultation 안에서 자기 hold를 지우는 한 곳뿐이다.
  const apply = readFileSync(new URL("./applyOrder.ts", import.meta.url), "utf8");
  assert.equal(apply.split("data.consultationHolds = ").length - 1, 1);
  const commit = apply.slice(apply.indexOf("export async function commitConsultation("));
  assert.ok(commit.includes("data.consultationHolds = data.consultationHolds.filter("));
});
