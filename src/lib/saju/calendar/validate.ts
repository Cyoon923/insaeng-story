import { leapMonthDays, leapMonthOf, lunarMonthDays } from "@/lib/saju/data/lunarSolar";
import { SAJU_YEAR_MAX, SAJU_YEAR_MIN, type BirthInput, type ClockTime } from "@/lib/saju/types";

function isClockTime(time: BirthInput["time"]): time is ClockTime {
  return time !== "unknown";
}

function solarMonthDays(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function validateBirthInput(input: BirthInput): void {
  if (input.year < SAJU_YEAR_MIN || input.year > SAJU_YEAR_MAX) {
    throw new Error(`계산 범위는 ${SAJU_YEAR_MIN}–${SAJU_YEAR_MAX}년입니다.`);
  }
  if (input.month < 1 || input.month > 12) {
    throw new Error("월은 1–12여야 합니다.");
  }
  if (input.day < 1 || !Number.isInteger(input.day)) {
    throw new Error("일이 올바르지 않습니다.");
  }

  if (input.calendar === "solar") {
    if (input.isLeapMonth) {
      throw new Error("양력에는 윤달을 쓸 수 없습니다.");
    }
    const maxDay = solarMonthDays(input.year, input.month);
    if (input.day > maxDay) {
      throw new Error("없는 양력 날짜입니다.");
    }
  } else {
    const leap = leapMonthOf(input.year);
    if (input.isLeapMonth) {
      if (leap !== input.month) {
        throw new Error("해당 해에 그 윤달이 없습니다.");
      }
      if (input.day > leapMonthDays(input.year)) {
        throw new Error("없는 음력 윤달 날짜입니다.");
      }
    } else if (input.day > lunarMonthDays(input.year, input.month)) {
      throw new Error("없는 음력 날짜입니다.");
    }
  }

  if (isClockTime(input.time)) {
    if (input.time.hour < 0 || input.time.hour > 23) {
      throw new Error("시는 0–23여야 합니다.");
    }
    if (input.time.minute < 0 || input.time.minute > 59) {
      throw new Error("분은 0–59여야 합니다.");
    }
  }

  if (input.birthPlace?.longitudeEast !== undefined) {
    const lon = input.birthPlace.longitudeEast;
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      throw new Error("출생지 경도가 올바르지 않습니다.");
    }
  }
}
