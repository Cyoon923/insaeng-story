import { stemElement } from "@/lib/saju/constants/elements";
import { BRANCH_SEASON, SEASON_PHASE } from "@/lib/saju/data/seasonPhases";
import type { Branch, Element, SeasonName, SeasonPhase, SeasonPhaseLabel, Stem } from "@/lib/saju/types";

export function seasonOfBranch(branch: Branch): SeasonName {
  return BRANCH_SEASON[branch];
}

export function seasonPhaseOf(element: Element, monthBranch: Branch): SeasonPhase {
  return SEASON_PHASE[BRANCH_SEASON[monthBranch]][element];
}

export function labelSeasonPhase(element: Element, monthBranch: Branch): SeasonPhaseLabel {
  return {
    monthBranch,
    season: BRANCH_SEASON[monthBranch],
    element,
    phase: seasonPhaseOf(element, monthBranch),
  };
}

export function labelStemSeasonPhase(stem: Stem, monthBranch: Branch): SeasonPhaseLabel {
  return labelSeasonPhase(stemElement(stem), monthBranch);
}
