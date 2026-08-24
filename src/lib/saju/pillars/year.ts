import { lichunInstant, compareKst } from "@/lib/saju/calendar/solarTerms";
import { ganzhiByIndex } from "@/lib/saju/constants/ganzhi";
import type { Pillar, SolarInstant } from "@/lib/saju/types";

export function yearGanzhiYear(instant: SolarInstant): number {
  const lichun = lichunInstant(instant.year);
  return compareKst(instant, lichun) < 0 ? instant.year - 1 : instant.year;
}

export function yearPillar(instant: SolarInstant): Pillar {
  return ganzhiByIndex(yearGanzhiYear(instant) - 4);
}
