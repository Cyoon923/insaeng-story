/**
 * FER certainty only (confirmed / provisional / unresolved).
 * Does not re-select role/element, recompute hour stability, or build FinalResolution.
 */

import {
  bottleneckIsClear,
  r1HasClearEvidence,
  r3HasClearEvidence,
  r4HasClearEvidence,
} from "@/lib/saju/final/deriveRoleClearGrade";
import type { StructureVsClimateSource } from "@/lib/saju/final/resolveStructureVsClimate";
import type {
  BottleneckLevel,
  Certainty,
  FinalRole,
  HourStability,
  RoleActivityMap,
} from "@/lib/saju/final/types";
import type { StrengthObservations } from "@/lib/saju/observation/types";
import type {
  AdjustedClimateSummary,
  AdjustedMoistureAxis,
  AdjustedTemperatureAxis,
  Element,
  NeedResolution,
  StrengthEvidence,
  StrengthSummary,
} from "@/lib/saju/types";

export type FinalCandidateView = {
  role: FinalRole | null;
  element: Element | null;
  status: "resolved" | "unresolved";
  source: StructureVsClimateSource;
};

export type DeriveFinalCertaintyInput = {
  candidate: FinalCandidateView;
  summary: StrengthSummary;
  roleActivities: RoleActivityMap;
  r2Bottleneck: BottleneckLevel;
  r5Bottleneck: BottleneckLevel;
  /** null when hour is confirmed (stability not run). */
  hourStability: HourStability | null;
  climate: AdjustedClimateSummary;
  needResolution?: NeedResolution;
  /** Used for R1/R3/R4 CLEAR-grade direct evidence checks. */
  evidence?: StrengthEvidence;
  observations?: StrengthObservations;
};

export type FinalCertaintyResult = {
  certainty: Certainty;
  reasons: string[];
};

type ClimateAxis = AdjustedTemperatureAxis | AdjustedMoistureAxis;

function axisIncomplete(axis: ClimateAxis): boolean {
  if (axis.status === "unresolved") return true;
  return (
    axis.outcome === "partially-mitigated" ||
    axis.outcome === "mitigation-reinforcement-conflict" ||
    axis.outcome === "unresolved"
  );
}

function climateHasPartialOrConflict(climate: AdjustedClimateSummary): boolean {
  if (climate.conflicts.length > 0) return true;
  return axisIncomplete(climate.temperature) || axisIncomplete(climate.moisture);
}

function hasContestedInherited(
  needResolution: NeedResolution | undefined,
  element: Element | null,
): boolean {
  if (!needResolution || !element) return false;
  if (needResolution.decisionBlockedBy.includes("climate-need-contested-inherited")) {
    return true;
  }
  return [...needResolution.originalClimateCandidates, ...needResolution.climateOnlyElements].some(
    (candidate) =>
      candidate.element === element && candidate.boundary === "contested-inherited",
  );
}

function hourAllowsConfirmed(hourStability: HourStability | null): boolean {
  // null = hour confirmed (stability not applicable)
  return hourStability === null || hourStability === "A";
}

function hourForcesUnresolved(hourStability: HourStability | null): boolean {
  return hourStability === "C";
}

function hourForcesProvisional(hourStability: HourStability | null): boolean {
  return hourStability === "B";
}

function roleHasClearPath(
  role: FinalRole,
  input: DeriveFinalCertaintyInput,
): boolean {
  const { r2Bottleneck, r5Bottleneck, summary, evidence, roleActivities } = input;

  switch (role) {
    case "R2":
      return bottleneckIsClear(r2Bottleneck);
    case "R5":
      return bottleneckIsClear(r5Bottleneck);
    case "R6":
      // Non-contested climate path; contested checked separately.
      return !climateHasPartialOrConflict(input.climate);
    case "R1":
      if (roleActivities.R1 === "C") return false;
      return r1HasClearEvidence(summary, evidence);
    case "R3":
      if (roleActivities.R3 === "C") return false;
      return r3HasClearEvidence(summary, evidence);
    case "R4":
      if (roleActivities.R4 === "C") return false;
      return r4HasClearEvidence(summary, evidence);
    default:
      return false;
  }
}

function isPossibleOnlyPath(role: FinalRole, r2Bottleneck: BottleneckLevel): boolean {
  return role === "R2" && r2Bottleneck === "POSSIBLE";
}

function dependsOnContestedInherited(input: DeriveFinalCertaintyInput): boolean {
  const { candidate, needResolution } = input;
  if (candidate.source === "climate" || candidate.source === "aligned") {
    return hasContestedInherited(needResolution, candidate.element);
  }
  // Structure-only Final may still have contested climate as reference — not a dependency.
  return false;
}

/**
 * Confirmed requires every frozen gate. Any miss → provisional (if still resolved).
 */
function meetsConfirmed(input: DeriveFinalCertaintyInput, reasons: string[]): boolean {
  const { candidate, hourStability, climate, needResolution, summary } = input;
  const role = candidate.role;
  const element = candidate.element;

  if (!role || !element || candidate.status !== "resolved") {
    reasons.push("fail:not-resolved-singleton");
    return false;
  }

  if (!hourAllowsConfirmed(hourStability)) {
    reasons.push("fail:hour-not-confirmed-or-a");
    return false;
  }

  if (isPossibleOnlyPath(role, input.r2Bottleneck)) {
    reasons.push("fail:possible-only-path");
    return false;
  }

  if (!roleHasClearPath(role, input)) {
    reasons.push("fail:role-not-clear-grade");
    return false;
  }

  if (role === "R5" && input.r5Bottleneck !== "CLEAR") {
    reasons.push("fail:r5-not-clear");
    return false;
  }

  if (dependsOnContestedInherited(input)) {
    reasons.push("fail:depends-on-contested-inherited");
    return false;
  }

  // Climate partial/conflict must not be what is pushing this Final.
  if (
    (candidate.source === "climate" || candidate.source === "aligned") &&
    climateHasPartialOrConflict(climate)
  ) {
    reasons.push("fail:climate-partial-or-conflict-pushes-final");
    return false;
  }

  // Contested climate as sole Final — blocked.
  if (candidate.source === "climate" && hasContestedInherited(needResolution, element)) {
    reasons.push("fail:contested-r6-as-final");
    return false;
  }

  // Activity C repeat for structure roles (R6 exception already handled upstream).
  if (role !== "R6" && input.roleActivities[role] === "C") {
    reasons.push("fail:role-activity-c-repeat");
    return false;
  }

  // Direction labels alone do not block confirmed — but mixed/null keep provisional
  // unless all other gates already failed; confirmed still allowed for clear paths.
  // Remaining equal-priority conflicts are assumed resolved upstream (single candidate).
  reasons.push("ok:confirmed-gates");
  void summary;
  return true;
}

/**
 * Grades certainty for an already-narrowed Final candidate.
 */
export function deriveFinalCertainty(input: DeriveFinalCertaintyInput): FinalCertaintyResult {
  const { candidate, hourStability, needResolution } = input;
  const reasons: string[] = [];

  // ——— UNRESOLVED hard gates ———
  if (candidate.status === "unresolved") {
    reasons.push("unresolved:candidate-status");
    return { certainty: "unresolved", reasons };
  }
  if (candidate.role === null || candidate.element === null) {
    reasons.push("unresolved:null-role-or-element");
    return { certainty: "unresolved", reasons };
  }
  if (hourForcesUnresolved(hourStability)) {
    reasons.push("unresolved:hour-stability-c");
    return { certainty: "unresolved", reasons };
  }

  // Contested R6 alone (no structure) — climate source + contested
  if (
    candidate.source === "climate" &&
    hasContestedInherited(needResolution, candidate.element)
  ) {
    reasons.push("unresolved:contested-r6-only");
    return { certainty: "unresolved", reasons };
  }

  // ——— CONFIRMED ———
  if (meetsConfirmed(input, reasons)) {
    reasons.push("certainty:confirmed");
    return { certainty: "confirmed", reasons };
  }

  // ——— PROVISIONAL (resolved but not confirmed) ———
  if (hourForcesProvisional(hourStability)) {
    reasons.push("provisional:hour-stability-b");
  }
  if (isPossibleOnlyPath(candidate.role, input.r2Bottleneck)) {
    reasons.push("provisional:r2-possible-dominant");
  }
  if (
    input.summary.directionCandidate === "mixed" ||
    input.summary.directionCandidate === null
  ) {
    reasons.push("provisional:mixed-or-null-direction");
  }
  if (
    candidate.source === "structure" &&
    needResolution?.decisionBlockedBy.includes("climate-need-contested-inherited")
  ) {
    reasons.push("provisional:contested-climate-reference");
  }
  if (candidate.source === "aligned") {
    reasons.push("provisional:aligned-without-full-confirmed");
  }
  if (
    candidate.role !== "R6" &&
    (input.roleActivities[candidate.role] === "A" ||
      input.roleActivities[candidate.role] === "B") &&
    !roleHasClearPath(candidate.role, input)
  ) {
    reasons.push("provisional:activity-ab-without-clear-evidence");
  }

  reasons.push("certainty:provisional");
  return { certainty: "provisional", reasons };
}
