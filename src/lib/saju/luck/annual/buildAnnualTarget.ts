/**
 * Build AnnualTarget for a labeled calendar year (세운 window = 입춘~입춘).
 * Does not touch FourPillars / natal pipelines.
 */

import { lichunInstant } from "@/lib/saju/calendar/solarTerms";
import { branchElement, stemElement } from "@/lib/saju/constants/elements";
import { ganzhiByIndex } from "@/lib/saju/constants/ganzhi";
import type { AnnualTarget } from "@/lib/saju/luck/annual/types";
import type { SolarInstant } from "@/lib/saju/types";

/** Convert KST SolarInstant to UTC Date (same convention as julianFromKst). */
export function solarInstantToUtcDate(instant: SolarInstant): Date {
  return new Date(
    Date.UTC(
      instant.year,
      instant.month - 1,
      instant.day,
      instant.hour - 9,
      instant.minute,
      0,
    ),
  );
}

/**
 * 세운 간지 for labeled year Y: ganzhiByIndex(Y - 4), matching natal year-pillar index.
 * Window: lichun(Y) .. lichun(Y+1). No Gregorian Jan 1. No hidden stems.
 */
export function buildAnnualTarget(year: number): AnnualTarget {
  if (!Number.isInteger(year)) {
    throw new Error(`buildAnnualTarget: year must be an integer (got ${year})`);
  }

  const { stem, branch } = ganzhiByIndex(year - 4);
  const windowStart = solarInstantToUtcDate(lichunInstant(year));
  const windowEnd = solarInstantToUtcDate(lichunInstant(year + 1));

  return {
    luckKind: "annual-year",
    year,
    stem,
    branch,
    stemElement: stemElement(stem),
    branchMainElement: branchElement(branch),
    boundaryBasis: "lichun-kst",
    windowStart,
    windowEnd,
  };
}
