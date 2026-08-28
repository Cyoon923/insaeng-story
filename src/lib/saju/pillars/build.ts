import { jieTermAt, lichunInstant } from "@/lib/saju/calendar/solarTerms";
import {
  applyMinuteOffsetToClock,
  wallClockFromInstant,
} from "@/lib/saju/calendar/localMeanTime";
import { toSolarInstant } from "@/lib/saju/calendar/toSolar";
import { dayPillar } from "@/lib/saju/pillars/day";
import { hourPillar } from "@/lib/saju/pillars/hour";
import { monthPillar } from "@/lib/saju/pillars/month";
import { yearPillar } from "@/lib/saju/pillars/year";
import type { BirthInput, FourPillars } from "@/lib/saju/types";

/** Unyul v1 — Korea-wide half-hour (반시) offset for hour pillar only. */
const KOREA_BAN_SI_OFFSET_MINUTES = -30;

const DST_YEARS = new Set([
  1948, 1949, 1950, 1951, 1955, 1956, 1957, 1958, 1959, 1960, 1987, 1988,
]);

function sameKstDate(a: { year: number; month: number; day: number }, b: { year: number; month: number; day: number }) {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

export function buildFourPillars(input: BirthInput): FourPillars {
  const dayBoundary = input.dayBoundary ?? "night_ja";
  const timeUnknown = input.time === "unknown";
  const instant = toSolarInstant(input);
  const warnings: string[] = [];

  if (DST_YEARS.has(instant.year)) {
    warnings.push("이 해는 한국 서머타임이 있어, 벽시계와 표준시가 다를 수 있습니다.");
  }

  if (timeUnknown) {
    const lichun = lichunInstant(instant.year);
    const jie = jieTermAt({ ...instant, hour: 12, minute: 0 });
    if (sameKstDate(instant, lichun) || sameKstDate(instant, jie.startedAt)) {
      warnings.push("절입 당일이라 태어난 시간을 모르면 년주·월주가 달라질 수 있습니다.");
    }
  }

  // Year / month / day: always wall-clock civil instant (no hour offset).
  const year = yearPillar(instant);
  const month = monthPillar(instant);
  const day = dayPillar(instant, dayBoundary, timeUnknown);

  if (timeUnknown) {
    return {
      year,
      month,
      day,
      hour: "unknown",
      hourCertainty: "unknown",
      dayBoundaryNote: "23시 이후 출생이면 일주가 달라질 수 있습니다.",
      warnings,
    };
  }

  // Hour pillar only: Korea v1 uses nationwide −30 min (반시).
  // BirthInput.birthPlace / resolveHourCalcClock (LMT) are not consulted here.
  // hourBranchIndex 2-hour blocks are unchanged; only the hour input may shift.
  const wallClock = wallClockFromInstant(instant);
  const hourCalcClock = applyMinuteOffsetToClock(wallClock, KOREA_BAN_SI_OFFSET_MINUTES);
  warnings.push(
    `시주: 대한민국 공통 −30분 보정 적용 (반시). ` +
      `wall=${String(wallClock.hour).padStart(2, "0")}:${String(wallClock.minute).padStart(2, "0")} ` +
      `→ calc=${String(hourCalcClock.hour).padStart(2, "0")}:${String(hourCalcClock.minute).padStart(2, "0")}`,
  );

  return {
    year,
    month,
    day,
    hour: hourPillar(day.stem, hourCalcClock.hour),
    hourCertainty: "confirmed",
    warnings,
  };
}
