/**
 * R2 (peer / 비겁) Role Activity only.
 * Does not select Final elements or evaluate R2 bottleneck / other roles.
 */

import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import type { StrengthObservations } from "@/lib/saju/observation/types";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import type { RoleActivity } from "@/lib/saju/final/types";
import type { FourPillars, PillarSlot, StrengthEvidence } from "@/lib/saju/types";

export type DeriveR2RoleActivityInput = {
  pillars: FourPillars;
  /** Reuse when already computed; otherwise collected once. */
  evidence?: StrengthEvidence;
  /** Reuse when already computed; otherwise built from pillars + evidence. */
  observations?: StrengthObservations;
};

function isPeerShiShen(shiShen: string): boolean {
  return shiShen === "비견" || shiShen === "겁재";
}

/** Day master is never R2 evidence; hour is omitted when unknown. */
function isEligiblePeerSlot(slot: PillarSlot, hourUnknown: boolean): boolean {
  if (slot === "day") return false;
  if (hourUnknown && slot === "hour") return false;
  return true;
}

function hasRootedVisiblePeerSupport(
  evidence: StrengthEvidence,
  observations: StrengthObservations,
): boolean {
  if (
    evidence.supportEvidence.items.some(
      (item) =>
        isPeerShiShen(item.shiShen) &&
        isEligiblePeerSlot(item.slot, evidence.hourUnknown) &&
        item.presence === "rooted-visible",
    )
  ) {
    return true;
  }

  for (const relation of observations.structureObservation.supportRelations) {
    if (relation.kind !== "peer-support") continue;

    const peerRef = relation.evidenceRefs.find(
      (ref) => ref.shiShen && isPeerShiShen(ref.shiShen),
    );
    if (!peerRef?.stem) continue;
    if (peerRef.slot !== undefined && !isEligiblePeerSlot(peerRef.slot, evidence.hourUnknown)) {
      continue;
    }

    // peer-support is built only from visible supportEvidence stems
    const supportItem = evidence.supportEvidence.items.find(
      (item) =>
        item.stem === peerRef.stem &&
        isPeerShiShen(item.shiShen) &&
        isEligiblePeerSlot(item.slot, evidence.hourUnknown) &&
        (peerRef.slot === undefined || item.slot === peerRef.slot),
    );
    if (supportItem?.presence === "rooted-visible") return true;
  }

  return false;
}

function hasAnyPeerRoleTrace(
  evidence: StrengthEvidence,
  observations: StrengthObservations,
): boolean {
  if (
    evidence.supportEvidence.items.some(
      (item) =>
        isPeerShiShen(item.shiShen) && isEligiblePeerSlot(item.slot, evidence.hourUnknown),
    )
  ) {
    return true;
  }

  if (
    evidence.branchRelationEvidence.items.some(
      (item) =>
        item.relationSide === "support" &&
        isPeerShiShen(item.shiShen) &&
        isEligiblePeerSlot(item.slot, evidence.hourUnknown),
    )
  ) {
    return true;
  }

  return observations.structureObservation.supportRelations.some((relation) => {
    if (relation.kind !== "peer-support") return false;
    return relation.slots.some((slot) => isEligiblePeerSlot(slot, evidence.hourUnknown));
  });
}

/**
 * Derives R2 Role Activity (A/B/C) from existing strength / observation evidence.
 * Day master itself and day-slot peer marks are never counted.
 * Element Presence of the day element alone does not yield B/C.
 */
export function deriveR2RoleActivity(input: DeriveR2RoleActivityInput): RoleActivity {
  const evidence = input.evidence ?? collectStrengthEvidence(input.pillars);
  const observations =
    input.observations ?? buildStrengthObservations(input.pillars, evidence);

  if (hasRootedVisiblePeerSupport(evidence, observations)) {
    return "C";
  }

  if (hasAnyPeerRoleTrace(evidence, observations)) {
    return "B";
  }

  return "A";
}
