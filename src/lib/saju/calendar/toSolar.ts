import { validateBirthInput } from "@/lib/saju/calendar/validate";
import {
  LUNAR_EPOCH_SOLAR,
  lunarMonthDays,
  lunarYearDays,
  leapMonthDays,
  leapMonthOf,
} from "@/lib/saju/data/lunarSolar";
import type { BirthInput, SolarInstant } from "@/lib/saju/types";

function addDays(year: number, month: number, day: number, offset: number): { year: number; month: number; day: number } {
  const utc = Date.UTC(year, month - 1, day + offset);
  const date = new Date(utc);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function lunarToSolarDate(input: BirthInput): { year: number; month: number; day: number } {
  let offset = 0;
  for (let year = LUNAR_EPOCH_SOLAR.year; year < input.year; year++) {
    offset += lunarYearDays(year);
  }

  const leap = leapMonthOf(input.year);
  for (let month = 1; month < input.month; month++) {
    offset += lunarMonthDays(input.year, month);
    if (leap === month) offset += leapMonthDays(input.year);
  }

  if (input.isLeapMonth) {
    offset += lunarMonthDays(input.year, input.month);
  }

  offset += input.day - 1;
  return addDays(LUNAR_EPOCH_SOLAR.year, LUNAR_EPOCH_SOLAR.month, LUNAR_EPOCH_SOLAR.day, offset);
}

export function toSolarInstant(input: BirthInput): SolarInstant {
  validateBirthInput(input);

  const date =
    input.calendar === "lunar"
      ? lunarToSolarDate(input)
      : { year: input.year, month: input.month, day: input.day };

  if (input.time === "unknown") {
    return { ...date, hour: 0, minute: 0 };
  }

  return { ...date, hour: input.time.hour, minute: input.time.minute };
}
