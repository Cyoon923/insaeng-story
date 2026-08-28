import { buildFourPillars } from "@/lib/saju/pillars/build";
import type { BirthInput, CalendarKind, FourPillars } from "@/lib/saju/types";

/**
 * Free-analysis form fields → engine BirthInput → FourPillars.
 * Does not reimplement pillar math; delegates to buildFourPillars.
 */
export type FreeSajuBirthFormInput = {
  calendar: CalendarKind;
  year: number;
  month: number;
  day: number;
  /** Lunar leap month only. Ignored for solar (forced false). */
  isLeapMonth?: boolean;
  /** When true, BirthInput.time is "unknown". */
  timeUnknown?: boolean;
  /** Required when timeUnknown is not true. 0–23 */
  hour?: number;
  /** Required when timeUnknown is not true. 0–59 */
  minute?: number;
  /**
   * Optional birth region label (e.g. "서울").
   * Kept for query/UI display only — Unyul v1 hour uses nationwide −30 (반시),
   * not region → birthPlace → LMT.
   */
  region?: string;
};

export function toBirthInput(input: FreeSajuBirthFormInput): BirthInput {
  const timeUnknown = Boolean(input.timeUnknown);

  if (!timeUnknown) {
    if (input.hour === undefined || input.minute === undefined) {
      throw new Error("출생시간을 입력하거나 '태어난 시간을 몰라요'를 선택해 주세요.");
    }
  }

  return {
    calendar: input.calendar,
    year: input.year,
    month: input.month,
    day: input.day,
    isLeapMonth: input.calendar === "lunar" ? Boolean(input.isLeapMonth) : false,
    time: timeUnknown ? "unknown" : { hour: input.hour!, minute: input.minute! },
    timezone: "Asia/Seoul",
  };
}

/** Maps free-saju form input to FourPillars via existing BirthInput / buildFourPillars. */
export function buildFreeSajuPillars(input: FreeSajuBirthFormInput): FourPillars {
  return buildFourPillars(toBirthInput(input));
}
