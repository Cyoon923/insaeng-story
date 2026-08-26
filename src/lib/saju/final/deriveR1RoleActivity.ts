/**
 * R1 (resource / 생조) Role Activity only.
 * Does not select Final elements or evaluate R2–R6.
 */

import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import type { StrengthObservations } from "@/lib/saju/observation/types";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import type { RoleActivity } from "@/lib/saju/final/types";
import type { FourPillars, StrengthEvidence } from "@/lib/saju/types";

export type DeriveR1RoleActivityInput = {
  pillars: FourPillars;
  /** Reuse when already computed; otherwise collected once. */
  evidence?: StrengthEvidence;
  /** Reuse when already computed; otherwise built from pillars + evidence. */
  observations?: StrengthObservations;
};

function isResourceShiShen(shiShen: string): boolean {
  return shiShen === "정인" || shiShen === "편인";
}

function hasRootedVisibleResourceToDay(observations: StrengthObservations): boolean {
  return observations.generationChains.some(
    (chain) =>
      chain.relation === "resource-to-day-master" && chain.from.presence === "rooted-visible",
  );
}

function hasRootedVisibleResourceSupport(
  evidence: StrengthEvidence,
  observations: StrengthObservations,
): boolean {
  if (
    evidence.supportEvidence.items.some(
      (item) => isResourceShiShen(item.shiShen) && item.presence === "rooted-visible",
    )
  ) {
    return true;
  }

  for (const relation of observations.structureObservation.supportRelations) {
    if (relation.kind !== "resource-support" && relation.kind !== "generation-support") {
      continue;
    }
    const resourceRef = relation.evidenceRefs.find(
      (ref) => ref.shiShen && isResourceShiShen(ref.shiShen),
    );
    if (!resourceRef?.stem) continue;

    if (relation.kind === "generation-support") {
      const chain = observations.generationChains.find(
        (item) =>
          item.relation === "resource-to-day-master" && item.from.stem === resourceRef.stem,
      );
      if (chain?.from.presence === "rooted-visible") return true;
      continue;
    }

    // resource-support is built only from visible supportEvidence stems
    const supportItem = evidence.supportEvidence.items.find(
      (item) =>
        item.stem === resourceRef.stem &&
        isResourceShiShen(item.shiShen) &&
        (resourceRef.slot === undefined || item.slot === resourceRef.slot),
    );
    if (supportItem?.presence === "rooted-visible") return true;
  }

  return false;
}

function hasAnyResourceRoleTrace(
  evidence: StrengthEvidence,
  observations: StrengthObservations,
): boolean {
  if (
    observations.generationChains.some((chain) => chain.relation === "resource-to-day-master")
  ) {
    return true;
  }

  if (evidence.supportEvidence.items.some((item) => isResourceShiShen(item.shiShen))) {
    return true;
  }

  if (
    evidence.branchRelationEvidence.items.some(
      (item) => item.relationSide === "support" && isResourceShiShen(item.shiShen),
    )
  ) {
    return true;
  }

  return observations.structureObservation.supportRelations.some(
    (relation) => relation.kind === "resource-support" || relation.kind === "generation-support",
  );
}

/**
 * Derives R1 Role Activity (A/B/C) from existing strength / observation evidence.
 * Element Presence alone and unrelated `element-generates` chains do not yield C.
 */
export function deriveR1RoleActivity(input: DeriveR1RoleActivityInput): RoleActivity {
  const evidence = input.evidence ?? collectStrengthEvidence(input.pillars);
  const observations =
    input.observations ?? buildStrengthObservations(input.pillars, evidence);

  if (
    hasRootedVisibleResourceToDay(observations) ||
    hasRootedVisibleResourceSupport(evidence, observations)
  ) {
    return "C";
  }

  if (hasAnyResourceRoleTrace(evidence, observations)) {
    return "B";
  }

  return "A";
}
