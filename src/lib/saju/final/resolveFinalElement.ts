/**
 * FER resolver body — assembles existing helpers into FinalResolution.
 * Does not re-select roles/elements, re-grade bottlenecks, or re-judge certainty.
 */

import { deriveFinalCertainty } from "@/lib/saju/final/deriveFinalCertainty";
import { deriveHourStability } from "@/lib/saju/final/deriveHourStability";
import { derivePriorityRoles } from "@/lib/saju/final/derivePriorityRoles";
import { deriveR2Bottleneck } from "@/lib/saju/final/deriveR2Bottleneck";
import { deriveR5Bottleneck } from "@/lib/saju/final/deriveR5Bottleneck";
import { deriveRoleActivities } from "@/lib/saju/final/deriveRoleActivities";
import { deriveRoleElementCandidates } from "@/lib/saju/final/deriveRoleElementCandidates";
import { resolveStructuralElement } from "@/lib/saju/final/resolveStructuralElement";
import { resolveStructureVsClimate } from "@/lib/saju/final/resolveStructureVsClimate";
import type { FinalResolution, HourStability } from "@/lib/saju/final/types";
import type { StrengthObservations } from "@/lib/saju/observation/types";
import type {
  AdjustedClimateSummary,
  FourPillars,
  NeedResolution,
  StrengthEvidence,
  StrengthSummary,
} from "@/lib/saju/types";

export type ResolveFinalElementInput = {
  pillars: FourPillars;
  summary: StrengthSummary;
  evidence: StrengthEvidence;
  observations: StrengthObservations;
  climate: AdjustedClimateSummary;
  needResolution?: NeedResolution;
};

function prefixTrace(step: string, reasons: string[]): string[] {
  return reasons.map((reason) => `${step}:${reason}`);
}

/**
 * Runs FER helpers in frozen order and assembles FinalResolution.
 */
export function resolveFinalElement(input: ResolveFinalElementInput): FinalResolution {
  const { pillars, summary, evidence, observations, climate, needResolution } = input;
  const decisionTrace: string[] = [];

  // 1. Role activities
  const roleActivities = deriveRoleActivities({
    pillars,
    evidence,
    observations,
    climate,
  });
  decisionTrace.push(
    `deriveRoleActivities:R1=${roleActivities.R1},R2=${roleActivities.R2},R3=${roleActivities.R3},R4=${roleActivities.R4},R5=${roleActivities.R5},R6=${roleActivities.R6}`,
  );

  // 2. R2 bottleneck
  const r2Bottleneck = deriveR2Bottleneck({
    pillars,
    summary,
    evidence,
    observations,
    roleActivities,
  });
  decisionTrace.push(`deriveR2Bottleneck:${r2Bottleneck}`);

  // 3. R5 bottleneck
  const r5Bottleneck = deriveR5Bottleneck({
    evidence,
    observations,
    roleActivities,
  });
  decisionTrace.push(`deriveR5Bottleneck:${r5Bottleneck}`);

  // 4. Role element candidates
  const roleElementCandidates = deriveRoleElementCandidates({
    pillars,
    roleActivities,
    r2Bottleneck,
    r5Bottleneck,
    evidence,
    observations,
    climate,
    needResolution,
  });
  decisionTrace.push(
    `deriveRoleElementCandidates:R1=[${roleElementCandidates.R1.join(",")}],R2=[${roleElementCandidates.R2.join(",")}],R3=[${roleElementCandidates.R3.join(",")}],R4=[${roleElementCandidates.R4.join(",")}],R5=[${roleElementCandidates.R5.join(",")}],R6=[${roleElementCandidates.R6.join(",")}]`,
  );

  // 5. Hour stability — unknown only; confirmed → null
  const hourStability: HourStability | null =
    pillars.hour === "unknown" ? deriveHourStability({ pillars }) : null;
  decisionTrace.push(
    hourStability === null
      ? "deriveHourStability:null-hour-confirmed"
      : `deriveHourStability:${hourStability}`,
  );

  // 6. Priority roles
  const priority = derivePriorityRoles({
    pillars,
    summary,
    roleActivities,
    roleElementCandidates,
    r2Bottleneck,
    r5Bottleneck,
    evidence,
    observations,
    climate,
    hourStability,
  });
  decisionTrace.push(...prefixTrace("derivePriorityRoles", priority.reasons));

  // 7. Structural element
  const structural = resolveStructuralElement({
    primaryRoles: priority.primaryRoles,
    roleElementCandidates,
    roleActivities,
    r2Bottleneck,
    r5Bottleneck,
    summary,
    evidence,
    observations,
  });
  decisionTrace.push(...prefixTrace("resolveStructuralElement", structural.reasons));

  // 8. Structure vs climate
  const candidate = resolveStructureVsClimate({
    structuralResolution: structural,
    roleElementCandidates,
    roleActivities,
    climate,
    needResolution,
  });
  decisionTrace.push(...prefixTrace("resolveStructureVsClimate", candidate.reasons));

  // 9. Certainty
  const certaintyResult = deriveFinalCertainty({
    candidate,
    summary,
    roleActivities,
    r2Bottleneck,
    r5Bottleneck,
    hourStability,
    climate,
    needResolution,
    evidence,
    observations,
  });
  decisionTrace.push(...prefixTrace("deriveFinalCertainty", certaintyResult.reasons));

  // 10. Assemble — unresolved forces null element/role
  const certainty = certaintyResult.certainty;
  const resolvedForOutput =
    certainty === "confirmed" || certainty === "provisional";

  return {
    finalElement: resolvedForOutput ? candidate.element : null,
    finalRole: resolvedForOutput ? candidate.role : null,
    certainty,
    roleActivities,
    r2Bottleneck,
    r5Bottleneck,
    hourStability,
    reasons: certaintyResult.reasons,
    decisionTrace,
  };
}
