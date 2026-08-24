import type { ExpertReview, ValidationComparison } from "@/lib/saju/validation/types";

export function emptyExpertReview(): ExpertReview {
  return {
    reviewerId: null,
    reviewDate: null,
    fourPillarsConfirmed: null,
    dayMaster: null,
    monthCommand: null,
    rootAssessment: null,
    strengthAssessment: null,
    climateAssessment: null,
    candidateElements: [],
    cannotDetermine: false,
    reasons: [],
    comments: "",
    reviewConfidence: null,
  };
}

export function emptyValidationComparison(caseId: string): ValidationComparison {
  return {
    caseId,
    engine: {
      relationPattern: null,
      strengthDirection: null,
      climateTemperature: null,
      climateMoisture: null,
      decisionBlockedBy: [],
    },
    expert: emptyExpertReview(),
    items: [],
    matches: [],
    differences: [],
    unresolved: [],
    notes: ["전문가 판정 전에는 비교하지 않음. 엔진 결과를 expertReview에 복사하지 않음."],
  };
}
