import { ganzhiByIndex } from "@/lib/saju/constants/ganzhi";
import type { DayBoundary, Pillar, SolarInstant } from "@/lib/saju/types";

const EPOCH = { year: 2000, month: 1, day: 1, ganzhiIndex: 54 };

function civilOffset(year: number, month: number, day: number): number {
  const utc = Date.UTC(year, month - 1, day);
  const epoch = Date.UTC(EPOCH.year, EPOCH.month - 1, EPOCH.day);
  return Math.round((utc - epoch) / 86400000);
}

export function dayDateForPillar(
  instant: SolarInstant,
  dayBoundary: DayBoundary,
  timeUnknown: boolean,
): { year: number; month: number; day: number } {
  if (timeUnknown || dayBoundary === "early_ja" || instant.hour < 23) {
    return { year: instant.year, month: instant.month, day: instant.day };
  }

  const next = new Date(Date.UTC(instant.year, instant.month - 1, instant.day + 1));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

export function dayPillar(
  instant: SolarInstant,
  dayBoundary: DayBoundary = "night_ja",
  timeUnknown = false,
): Pillar {
  const date = dayDateForPillar(instant, dayBoundary, timeUnknown);
  return ganzhiByIndex(EPOCH.ganzhiIndex + civilOffset(date.year, date.month, date.day));
}
