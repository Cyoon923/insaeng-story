import { emptyExpertReview, emptyValidationComparison } from "@/lib/saju/validation/blind";
import type { PilotExpertMapping, PilotExpertRaw, ValidationComparison } from "@/lib/saju/validation/types";

/** 전문가 원문 칸. 엔진 결과를 넣지 않는다. */
export function emptyPilotExpertRaw(): PilotExpertRaw {
  return {
    q1_fourPillars: null,
    q2_dayMaster: null,
    q3_monthCommand: null,
    q4_root: null,
    q5_strength: null,
    q6_strengthReasons: null,
    q7_climate: null,
    q8_climateNeed: null,
    q9_strengthNeedElements: null,
    q10_finalElement: null,
    expertStrengthRaw: null,
    expertClimateRaw: null,
    expertNeedRaw: null,
  };
}

/** 사람 mapping 칸. 엔진이 자동으로 채우지 않는다. */
export function emptyPilotExpertMapping(): PilotExpertMapping {
  return {
    mappedBy: null,
    mappingNotes: null,
    strength: null,
    climateTemperature: null,
    climateMoisture: null,
    needCandidates: [],
    cannotDetermine: null,
  };
}

export function emptyPilotComparison(caseId: string): ValidationComparison {
  return emptyValidationComparison(caseId);
}

export { emptyExpertReview };
