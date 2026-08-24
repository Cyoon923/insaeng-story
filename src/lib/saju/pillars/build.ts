import { jieTermAt, lichunInstant } from "@/lib/saju/calendar/solarTerms";
import { toSolarInstant } from "@/lib/saju/calendar/toSolar";
import { dayPillar } from "@/lib/saju/pillars/day";
import { hourPillar } from "@/lib/saju/pillars/hour";
import { monthPillar } from "@/lib/saju/pillars/month";
import { yearPillar } from "@/lib/saju/pillars/year";
import type { BirthInput, FourPillars } from "@/lib/saju/types";

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

  return {
    year,
    month,
    day,
    hour: hourPillar(day.stem, instant.hour),
    hourCertainty: "confirmed",
    warnings,
  };
}
