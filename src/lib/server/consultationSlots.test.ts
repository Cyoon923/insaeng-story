/**
 * 관리자 일정(시간 차단·하루 휴무) 테스트. 실행: node --test src/lib/server/consultationSlots.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  CONSULT_TIMES,
  getSlotStatus,
  isSlotAvailable,
  setDayBlocked,
  setSlotBlocked,
  toggleBlockedSlot,
} from "./consultationSlots.ts";
import type { AppData, Consultation } from "@/lib/types/app";

const T = "유비 선생";
const OTHER_T = "헬렌 선생";
const D = "10월 12일(월)";
const OTHER_D = "10월 13일(화)";

function booking(time: string, overrides: Partial<Consultation> = {}): Consultation {
  return { id: `c-${time}`, userId: "u-1", teacher: T, datetime: `${D} ${time}`, status: "상담 신청", ...overrides } as Consultation;
}

function data(consultations: Consultation[] = [], blockedSlots: AppData["blockedSlots"] = []): AppData {
  return { consultations, blockedSlots } as unknown as AppData;
}

test("특정 시간 차단 → 관리자 차단, isSlotAvailable false", () => {
  const d = data();
  d.blockedSlots = setSlotBlocked(d, T, D, CONSULT_TIMES[0], true);
  assert.equal(getSlotStatus(d, T, D, CONSULT_TIMES[0]), "blocked");
  assert.equal(isSlotAvailable(d, T, D, CONSULT_TIMES[0]), false);
});

test("특정 시간 해제 → 예약 가능. 같은 요청을 반복해도 반전되지 않는다", () => {
  const d = data([], [{ teacher: T, date: D, time: CONSULT_TIMES[0] }]);
  d.blockedSlots = setSlotBlocked(d, T, D, CONSULT_TIMES[0], false);
  assert.equal(getSlotStatus(d, T, D, CONSULT_TIMES[0]), "available");
  d.blockedSlots = setSlotBlocked(d, T, D, CONSULT_TIMES[0], false);
  assert.equal(getSlotStatus(d, T, D, CONSULT_TIMES[0]), "available");
  // 차단 요청 두 번 → 여전히 차단, 기록은 한 건
  d.blockedSlots = setSlotBlocked(d, T, D, CONSULT_TIMES[1], true);
  d.blockedSlots = setSlotBlocked(d, T, D, CONSULT_TIMES[1], true);
  assert.equal(getSlotStatus(d, T, D, CONSULT_TIMES[1]), "blocked");
  assert.equal(d.blockedSlots.length, 1);
});

test("고객 예약 시간은 차단 불가(지정·반전 모두 불변)", () => {
  const d = data([booking(CONSULT_TIMES[2])]);
  assert.deepEqual(setSlotBlocked(d, T, D, CONSULT_TIMES[2], true), []);
  assert.deepEqual(toggleBlockedSlot(d, T, D, CONSULT_TIMES[2]), []);
  assert.equal(getSlotStatus(d, T, D, CONSULT_TIMES[2]), "booked");
});

test("하루 전체 휴무: 빈 시간만 차단, 기존 예약 유지, 예약 수 반환", () => {
  const d = data([booking(CONSULT_TIMES[0]), booking(CONSULT_TIMES[3])]);
  const result = setDayBlocked(d, T, D, true);
  d.blockedSlots = result.blockedSlots;
  assert.equal(result.bookedCount, 2);
  assert.equal(d.blockedSlots.length, CONSULT_TIMES.length - 2);
  for (const time of CONSULT_TIMES) {
    const expected = time === CONSULT_TIMES[0] || time === CONSULT_TIMES[3] ? "booked" : "blocked";
    assert.equal(getSlotStatus(d, T, D, time), expected, time);
  }
  // 예약 행은 그대로
  assert.equal(d.consultations.length, 2);
  // 두 번 해도 중복 기록이 생기지 않는다.
  d.blockedSlots = setDayBlocked(d, T, D, true).blockedSlots;
  assert.equal(d.blockedSlots.length, CONSULT_TIMES.length - 2);
});

test("하루 휴무 해제: 그 선생님·그 날짜 차단만 지운다", () => {
  const d = data(
    [booking(CONSULT_TIMES[0])],
    [
      { teacher: T, date: D, time: CONSULT_TIMES[1] },
      { teacher: T, date: D, time: CONSULT_TIMES[2] },
      { teacher: T, date: OTHER_D, time: CONSULT_TIMES[1] },
      { teacher: OTHER_T, date: D, time: CONSULT_TIMES[1] },
    ],
  );
  const result = setDayBlocked(d, T, D, false);
  d.blockedSlots = result.blockedSlots;
  assert.equal(result.bookedCount, 1);
  assert.deepEqual(d.blockedSlots, [
    { teacher: T, date: OTHER_D, time: CONSULT_TIMES[1] },
    { teacher: OTHER_T, date: D, time: CONSULT_TIMES[1] },
  ]);
  assert.equal(getSlotStatus(d, T, D, CONSULT_TIMES[0]), "booked");
  assert.equal(getSlotStatus(d, T, D, CONSULT_TIMES[1]), "available");
});

test("하루 휴무는 다른 선생님·다른 날짜에 영향 없음", () => {
  const d = data();
  d.blockedSlots = setDayBlocked(d, T, D, true).blockedSlots;
  for (const time of CONSULT_TIMES) {
    assert.equal(isSlotAvailable(d, OTHER_T, D, time), true);
    assert.equal(isSlotAvailable(d, T, OTHER_D, time), true);
  }
});

test("환불로 취소된(cancelledAt) 상담 시간은 다시 차단할 수 있다", () => {
  const d = data([booking(CONSULT_TIMES[4], { cancelledAt: "2026-10-01T00:00:00.000Z" })]);
  assert.equal(getSlotStatus(d, T, D, CONSULT_TIMES[4]), "available");
  d.blockedSlots = setSlotBlocked(d, T, D, CONSULT_TIMES[4], true);
  assert.equal(getSlotStatus(d, T, D, CONSULT_TIMES[4]), "blocked");
  const day = setDayBlocked(d, T, D, true);
  assert.equal(day.bookedCount, 0);
  assert.equal(day.blockedSlots.length, CONSULT_TIMES.length);
});

test("관리자 API: blocked 명시 지정 + 없으면 기존 반전, setDayBlocked 검증·결과", () => {
  const route = readFileSync(new URL("../../app/api/admin/route.ts", import.meta.url), "utf8");
  const toggle = route.slice(route.indexOf('if (action === "toggleBlockSlot")'), route.indexOf('if (action === "setDayBlocked")'));
  assert.match(toggle, /typeof body\.blocked === "boolean"\s*\?\s*setSlotBlocked\(data, teacher, date, time, body\.blocked\)\s*:\s*toggleBlockedSlot\(data, teacher, date, time\)/);
  const day = route.slice(route.indexOf('if (action === "setDayBlocked")'), route.indexOf("\n  if (action ===", route.indexOf('if (action === "setDayBlocked")') + 10));
  assert.match(day, /CONSULT_TEACHERS\.some\(\(item\) => item\.name === teacher\)/);
  assert.match(day, /typeof body\.blocked !== "boolean"/);
  assert.match(day, /await writeData\(data\)/);
  assert.match(day, /bookedCount: result\.bookedCount/);
});
