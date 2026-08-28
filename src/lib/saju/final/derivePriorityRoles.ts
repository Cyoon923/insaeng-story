/**
 * FER G1–G5 — returns primary role candidates only.
 * Does not select Final elements, assign certainty, or settle structure vs climate.
 */

import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import type { RoleElementCandidateMap } from "@/lib/saju/final/deriveRoleElementCandidates";
import { deriveR2ProvisionalGate } from "@/lib/saju/final/deriveR2ProvisionalGate";
import type {
  BottleneckLevel,
  FinalRole,
  HourStability,
  RoleActivityMap,
} from "@/lib/saju/final/types";
import type { StrengthObservations } from "@/lib/saju/observation/types";
import type {
  AdjustedClimateSummary,
  AdjustedMoistureAxis,
  AdjustedTemperatureAxis,
  FourPillars,
  StrengthEvidence,
  StrengthSummary,
} from "@/lib/saju/types";

export type DerivePriorityRolesInput = {
  pillars: FourPillars;
  summary: StrengthSummary;
  roleActivities: RoleActivityMap;
  roleElementCandidates: RoleElementCandidateMap;
  r2Bottleneck: BottleneckLevel;
  r5Bottleneck: BottleneckLevel;
  evidence: StrengthEvidence;
  observations: StrengthObservations;
  /** Optional; built from pillars when omitted (G4 climate gate). */
  climate?: AdjustedClimateSummary;
  /**
   * Forwarded to deriveR2ProvisionalGate for hour-unknown R2 POSSIBLE.
   * Confirmed hour may omit this.
   */
  hourStability?: HourStability | null;
};

export type PriorityRolesResult = {
  primaryRoles: FinalRole[];
  reasons: string[];
};

type ClimateAxis = AdjustedTemperatureAxis | AdjustedMoistureAxis;

function hasCandidates(
  candidates: RoleElementCandidateMap,
  role: FinalRole,
): boolean {
  return candidates[role].length > 0;
}

function isRoleOpen(activity: RoleActivityMap[FinalRole]): boolean {
  return activity !== "C";
}

/** Contested / partial / unresolved — not a clear R6 primary axis. */
function axisBlocksClearR6(axis: ClimateAxis): boolean {
  if (axis.status === "unresolved") return true;
  return (
    axis.outcome === "partially-mitigated" ||
    axis.outcome === "mitigation-reinforcement-conflict" ||
    axis.outcome === "unresolved"
  );
}

function climateAllowsClearR6(climate: AdjustedClimateSummary): boolean {
  if (climate.conflicts.length > 0) return false;
  return !axisBlocksClearR6(climate.temperature) && !axisBlocksClearR6(climate.moisture);
}

function axisPresence(
  axis: StrengthSummary["sourceBreakdown"]["output"],
): "none" | "weak" | "surface" {
  if (axis.rootedVisible) return "surface";
  if (axis.unrootedVisible) return "weak";
  return "none";
}

function hasVisibleOrBranchPressure(
  evidence: StrengthEvidence,
  observations: StrengthObservations,
): boolean {
  if (
    evidence.pressureEvidence.items.some(
      (item) =>
        item.presence === "rooted-visible" || item.presence === "unrooted-visible",
    )
  ) {
    return true;
  }
  return observations.structureObservation.pressureRelations.some(
    (relation) =>
      relation.kind === "pressure-visible-stem" ||
      relation.kind === "pressure-branch-anchor",
  );
}

function hasHiddenOnlyPressure(
  evidence: StrengthEvidence,
  observations: StrengthObservations,
): boolean {
  const hasHidden = observations.structureObservation.pressureRelations.some(
    (relation) => relation.kind === "pressure-hidden-context",
  );
  if (!hasHidden) {
    return evidence.pressureEvidence.items.some((item) => item.presence === "hidden-only");
  }
  return !hasVisibleOrBranchPressure(evidence, observations);
}

/** Day-side foundation is not empty — R3 gate. */
function hasDayFoundation(
  summary: StrengthSummary,
  roleActivities: RoleActivityMap,
): boolean {
  if (summary.rootQuality !== "absent") return true;
  const peer = summary.sourceBreakdown.peer;
  const resource = summary.sourceBreakdown.resource;
  if (peer.rootedVisible || peer.unrootedVisible) return true;
  if (resource.rootedVisible || resource.unrootedVisible) return true;
  return roleActivities.R1 === "C" || roleActivities.R2 === "C";
}

/**
 * R1/R2 foundation still the core open problem — do not elevate R3/R4 first.
 * R2 POSSIBLE counts only when POSSIBLE-DOMINANT (provisionalGate.allowed).
 * POSSIBLE-WEAK is not foundation-in-play.
 */
function foundationCoreOpen(
  roleActivities: RoleActivityMap,
  candidates: RoleElementCandidateMap,
  r2Bottleneck: BottleneckLevel,
  r2ProvisionalAllowed: boolean,
): boolean {
  if (isRoleOpen(roleActivities.R1) && hasCandidates(candidates, "R1")) return true;
  if (!isRoleOpen(roleActivities.R2)) return false;
  if (r2Bottleneck === "CLEAR") return true;
  if (r2Bottleneck === "POSSIBLE" && r2ProvisionalAllowed) return true;
  return false;
}

/**
 * Frozen R3 min: foundation + congestion/drain gap + output connectable + drain-first.
 * Uses presence flags / activity — never counts.
 */
function r3MeetsMin(
  summary: StrengthSummary,
  roleActivities: RoleActivityMap,
  candidates: RoleElementCandidateMap,
): boolean {
  if (!isRoleOpen(roleActivities.R3) || !hasCandidates(candidates, "R3")) return false;
  if (!hasDayFoundation(summary, roleActivities)) return false;

  const output = axisPresence(summary.sourceBreakdown.output);
  const control = axisPresence(summary.sourceBreakdown.wealth);
  const officer = axisPresence(summary.sourceBreakdown.officer);
  const controlCombined =
    control === "surface" || officer === "surface"
      ? "surface"
      : control === "weak" || officer === "weak"
        ? "weak"
        : "none";

  // Pattern A: support present + output weak/none → R3
  // Pattern D: control surface + output none/weak → R3
  if (output === "surface") return false;
  if (controlCombined === "none" || controlCombined === "weak") {
    // A or E(울체) leaning when output not surface
    return true;
  }
  // control already surface + output weak → D
  // output === "surface"는 위에서 이미 return false 되었다.
  return true;
}

/**
 * Frozen R4 min: overacting surface + control connectable + not output-as-control misread.
 * hidden-only pressure alone does not open R4.
 */
function r4MeetsMin(
  summary: StrengthSummary,
  roleActivities: RoleActivityMap,
  candidates: RoleElementCandidateMap,
  evidence: StrengthEvidence,
  observations: StrengthObservations,
): boolean {
  if (!isRoleOpen(roleActivities.R4) || !hasCandidates(candidates, "R4")) return false;
  if (!hasDayFoundation(summary, roleActivities)) return false;
  if (hasHiddenOnlyPressure(evidence, observations)) return false;
  if (!hasVisibleOrBranchPressure(evidence, observations)) return false;

  const output = axisPresence(summary.sourceBreakdown.output);
  const wealth = axisPresence(summary.sourceBreakdown.wealth);
  const officer = axisPresence(summary.sourceBreakdown.officer);
  const controlSurface = wealth === "surface" || officer === "surface";
  const controlWeak =
    !controlSurface && (wealth === "weak" || officer === "weak" || wealth === "none");

  // Pattern B: support foundation + control gap → R4
  // Pattern C: output surface + control gap → R4
  if (controlSurface) return false;
  if (output === "surface" && controlWeak) return true;
  return controlWeak;
}

function selectR3R4(
  summary: StrengthSummary,
  roleActivities: RoleActivityMap,
  candidates: RoleElementCandidateMap,
  evidence: StrengthEvidence,
  observations: StrengthObservations,
  reasons: string[],
): FinalRole[] {
  const foundation = hasDayFoundation(summary, roleActivities);
  const considerR3 =
    foundation &&
    isRoleOpen(roleActivities.R3) &&
    hasCandidates(candidates, "R3");
  const considerR4 =
    foundation &&
    isRoleOpen(roleActivities.R4) &&
    hasCandidates(candidates, "R4") &&
    !hasHiddenOnlyPressure(evidence, observations);

  // Both open for review → retain both; Final element choice is deferred.
  if (considerR3 && considerR4) {
    const r3Min = r3MeetsMin(summary, roleActivities, candidates);
    const r4Min = r4MeetsMin(summary, roleActivities, candidates, evidence, observations);
    if (r3Min && r4Min) {
      reasons.push("g3:r3-r4-tie-both-retained");
    } else if (r3Min && !r4Min) {
      reasons.push("g3:r3-r4-both-open-r3-min-preferred-but-both-retained");
    } else if (!r3Min && r4Min) {
      reasons.push("g3:r3-r4-both-open-r4-min-preferred-but-both-retained");
    } else {
      reasons.push("g3:r3-r4-open-unranked-both-retained");
    }
    return ["R3", "R4"];
  }

  if (considerR3) {
    reasons.push(
      r3MeetsMin(summary, roleActivities, candidates)
        ? "g3:r3-primary"
        : "g3:r3-open-fallback",
    );
    return ["R3"];
  }

  if (considerR4) {
    reasons.push(
      r4MeetsMin(summary, roleActivities, candidates, evidence, observations)
        ? "g3:r4-primary"
        : "g3:r4-open-fallback",
    );
    return ["R4"];
  }

  return [];
}

/** G5 directness among structure roles — fixed order, not scores/counts. */
const G5_DIRECTNESS: FinalRole[] = ["R1", "R2", "R3", "R4", "R5"];

/**
 * R2 enters G5 only when CLEAR or POSSIBLE-DOMINANT (provisionalGate.allowed).
 * POSSIBLE-WEAK must not be salvaged by directness fallback.
 */
function r2EligibleForG5(
  r2Bottleneck: BottleneckLevel,
  r2ProvisionalAllowed: boolean,
): boolean {
  if (r2Bottleneck === "CLEAR") return true;
  if (r2Bottleneck === "POSSIBLE" && r2ProvisionalAllowed) return true;
  return false;
}

function selectG5(
  roleActivities: RoleActivityMap,
  candidates: RoleElementCandidateMap,
  r2Bottleneck: BottleneckLevel,
  r2ProvisionalAllowed: boolean,
  reasons: string[],
): FinalRole[] {
  const open = G5_DIRECTNESS.filter((role) => {
    if (!isRoleOpen(roleActivities[role]) || !hasCandidates(candidates, role)) {
      return false;
    }
    if (role === "R2" && !r2EligibleForG5(r2Bottleneck, r2ProvisionalAllowed)) {
      return false;
    }
    return true;
  });
  if (open.length === 0) {
    reasons.push("g5:no-structure-role-open");
    return [];
  }

  // Same directness band: R3/R4 may both stay; otherwise first in order.
  if (open.includes("R1")) {
    reasons.push("g5:directness-r1");
    return ["R1"];
  }
  if (open.includes("R2")) {
    reasons.push("g5:directness-r2");
    return ["R2"];
  }
  const r3r4 = open.filter((role) => role === "R3" || role === "R4");
  if (r3r4.length > 0) {
    reasons.push(
      r3r4.length === 2 ? "g5:directness-r3-r4" : `g5:directness-${r3r4[0].toLowerCase()}`,
    );
    return r3r4;
  }
  reasons.push("g5:directness-r5");
  return ["R5"];
}

/**
 * Applies frozen G1–G5 gates and returns primary role candidates (roles only).
 */
export function derivePriorityRoles(input: DerivePriorityRolesInput): PriorityRolesResult {
  const {
    pillars,
    summary,
    roleActivities,
    roleElementCandidates: candidates,
    r2Bottleneck,
    r5Bottleneck,
    evidence,
    observations,
  } = input;
  const climate = input.climate ?? buildAdjustedClimateSummary(pillars);
  const hourStability = input.hourStability ?? null;
  const reasons: string[] = [];

  const r2Provisional =
    r2Bottleneck === "POSSIBLE"
      ? deriveR2ProvisionalGate({
          pillars,
          summary,
          evidence,
          observations,
          roleActivities,
          r2Bottleneck,
          r5Bottleneck,
          hourStability,
        })
      : null;
  const r2ProvisionalAllowed = r2Provisional?.allowed === true;

  // ——— G1: R5 CLEAR only ———
  if (r5Bottleneck === "CLEAR" && hasCandidates(candidates, "R5")) {
    reasons.push("g1:r5-clear");
    return { primaryRoles: ["R5"], reasons };
  }
  if (r5Bottleneck === "POSSIBLE") {
    reasons.push("g1:r5-possible-not-g1");
  } else if (r5Bottleneck === "NOT") {
    reasons.push("g1:r5-not");
  } else if (r5Bottleneck === "CLEAR" && !hasCandidates(candidates, "R5")) {
    reasons.push("g1:r5-clear-empty-candidates-blocked");
  }

  // ——— G2: R1 then R2 ———
  if (isRoleOpen(roleActivities.R1) && hasCandidates(candidates, "R1")) {
    reasons.push("g2:r1-open-priority");
    return { primaryRoles: ["R1"], reasons };
  }
  if (roleActivities.R1 === "C") {
    reasons.push("g2:r1-activity-c-no-repeat");
  }

  if (isRoleOpen(roleActivities.R2)) {
    if (r2Bottleneck === "CLEAR" && hasCandidates(candidates, "R2")) {
      // Peer absence alone never yields CLEAR in deriveR2Bottleneck — CLEAR is eligible.
      reasons.push("g2:r2-clear");
      return { primaryRoles: ["R2"], reasons };
    }
    if (r2Bottleneck === "POSSIBLE") {
      if (r2ProvisionalAllowed && hasCandidates(candidates, "R2")) {
        reasons.push("g2:r2-possible-dominant");
        return { primaryRoles: ["R2"], reasons };
      }
      reasons.push("g2:r2-possible-not-dominant");
    } else if (r2Bottleneck === "NOT") {
      reasons.push("g2:r2-not-peer-absence-alone-blocked");
    }
  }

  // ——— G3: R3/R4 (not before foundation) ———
  if (foundationCoreOpen(roleActivities, candidates, r2Bottleneck, r2ProvisionalAllowed)) {
    reasons.push("g3:foundation-core-blocks-r3-r4");
  } else {
    const g3 = selectR3R4(
      summary,
      roleActivities,
      candidates,
      evidence,
      observations,
      reasons,
    );
    if (g3.length > 0) {
      return { primaryRoles: g3, reasons };
    }
  }

  // ——— G4: R6 clear-primary eligibility only ———
  if (hasCandidates(candidates, "R6") && isRoleOpen(roleActivities.R6)) {
    if (!climateAllowsClearR6(climate)) {
      reasons.push("g4:r6-contested-or-partial-blocked");
    } else if (
      foundationCoreOpen(roleActivities, candidates, r2Bottleneck, r2ProvisionalAllowed)
    ) {
      // Structure foundation still in play — do not let climate cover it.
      reasons.push("g4:r6-deferred-structure-foundation-open");
    } else {
      reasons.push("g4:r6-resolved-primary");
      return { primaryRoles: ["R6"], reasons };
    }
  } else if (!hasCandidates(candidates, "R6")) {
    reasons.push("g4:r6-no-candidates");
  }

  // ——— G5: leftover structure directness ———
  const g5 = selectG5(
    roleActivities,
    candidates,
    r2Bottleneck,
    r2ProvisionalAllowed,
    reasons,
  );
  return { primaryRoles: g5, reasons };
}
