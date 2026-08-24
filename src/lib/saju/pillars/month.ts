import { jieTermAt } from "@/lib/saju/calendar/solarTerms";
import {
  MONTH_BRANCHES_FROM_YIN,
  YIN_MONTH_STEM_BY_YEAR_STEM,
  stemByIndex,
  stemIndex,
} from "@/lib/saju/constants/ganzhi";
import { yearPillar } from "@/lib/saju/pillars/year";
import type { Pillar, SolarInstant } from "@/lib/saju/types";

export function monthPillar(instant: SolarInstant): Pillar {
  const { monthBranch } = jieTermAt(instant);
  const yearStem = yearPillar(instant).stem;
  const yinStem = YIN_MONTH_STEM_BY_YEAR_STEM[yearStem];
  const monthIndex = MONTH_BRANCHES_FROM_YIN.indexOf(monthBranch);
  return {
    stem: stemByIndex(stemIndex(yinStem) + monthIndex),
    branch: monthBranch,
  };
}
