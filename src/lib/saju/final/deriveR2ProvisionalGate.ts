/**
 * R2 POSSIBLE-DOMINANT provisional gate only.
 * Does not select Final, assign certainty, or modify G1–G5 / derivePriorityRoles.
 */

import type {
  BottleneckLevel,
  HourStability,
  RoleActivityMap,
} from "@/lib/saju/final/types";
import type { StrengthObservations } from "@/lib/saju/observation/types";
import type {
  FourPillars,
  PillarSlot,
  StrengthEvidence,
  StrengthSummary,
} from "@/lib/saju/types";

export type DeriveR2ProvisionalGateInput = {
  pillars: FourPillars;
  summary: StrengthSummary;
  evidence: StrengthEvidence;
  observations: StrengthObservations;
  roleActivities: RoleActivityMap;
  r2Bottleneck: BottleneckLevel;
  r5Bottleneck: BottleneckLevel;
  /**
   * When hour is unknown: A/B allow, C or missing (null/undefined) deny.
   * Confirmed hour ignores this field. No new hour-stability logic here.
   */
  hourStability?: HourStability | null;
};

export type R2ProvisionalGateResult = {
  allowed: boolean;
  reasons: string[];
};

function isResourceShiShen(shiShen: string): boolean {
  return shiShen === "정인" || shiShen === "편인";
}

function isPeerShiShen(shiShen: string): boolean {
  return shiShen === "비견" || shiShen === "겁재";
}

function isVisiblePresence(presence: string): boolean {
  return presence === "rooted-visible" || presence === "unrooted-visible";
}

function isEligiblePeerSlot(slot: PillarSlot, hourUnknown: boolean): boolean {
  if (slot === "day") return false;
  if (hourUnknown && slot === "hour") return false;
  return true;
}

function hasVisibleResourceSupport(
  summary: StrengthSummary,
  evidence: StrengthEvidence,
  observations: StrengthObservations,
): boolean {
  if (
    evidence.supportEvidence.items.some(
      (item) => isResourceShiShen(item.shiShen) && isVisiblePresence(item.presence),
    )
  ) {
    return true;
  }

  if (
    summary.strongSideEvidence.some(
      (item) =>
        item.kind === "visible-support" &&
        item.shiShen !== undefined &&
        isResourceShiShen(item.shiShen) &&
        (item.presence === undefined || isVisiblePresence(item.presence)),
    )
  ) {
    return true;
  }

  if (
    observations.structureObservation.supportRelations.some(
      (relation) => relation.kind === "resource-support",
    )
  ) {
    return true;
  }

  return observations.generationChains.some(
    (chain) =>
      chain.relation === "resource-to-day-master" && chain.from.presence !== "hidden-only",
  );
}

function hasVisiblePeerSupport(
  summary: StrengthSummary,
  evidence: StrengthEvidence,
  observations: StrengthObservations,
): boolean {
  const hourUnknown = evidence.hourUnknown;

  if (
    evidence.supportEvidence.items.some(
      (item) =>
        isPeerShiShen(item.shiShen) &&
        isEligiblePeerSlot(item.slot, hourUnknown) &&
        isVisiblePresence(item.presence),
    )
  ) {
    return true;
  }

  if (
    summary.strongSideEvidence.some(
      (item) =>
        item.kind === "visible-support" &&
        item.shiShen !== undefined &&
        isPeerShiShen(item.shiShen) &&
        (item.presence === undefined || isVisiblePresence(item.presence)),
    )
  ) {
    return true;
  }

  return observations.structureObservation.supportRelations.some((relation) => {
    if (relation.kind !== "peer-support") return false;
    return relation.slots.some((slot) => isEligiblePeerSlot(slot, hourUnknown));
  });
}

function isHourConfirmed(summary: StrengthSummary, evidence: StrengthEvidence): boolean {
  if (evidence.hourUnknown) return false;
  if (summary.omittedSlots.includes("hour")) return false;
  return true;
}

/**
 * Gates whether R2 POSSIBLE may later become provisional Final (DOMINANT).
 * POSSIBLE alone never yields allowed=true — all frozen AND conditions required.
 * Contested R6 is intentionally ignored (no elimination-by-climate).
 */
export function deriveR2ProvisionalGate(
  input: DeriveR2ProvisionalGateInput,
): R2ProvisionalGateResult {
  void input.pillars;
  const {
    summary,
    evidence,
    observations,
    roleActivities,
    r2Bottleneck,
    r5Bottleneck,
    hourStability = null,
  } = input;
  const reasons: string[] = [];

  // Contested R6 must not auto-deny and must not be used as elimination to allow R2.
  reasons.push("r6-contested-ignored-structure-only");

  if (r2Bottleneck !== "POSSIBLE") {
    reasons.push("fail:r2-bottleneck-not-possible");
    return { allowed: false, reasons };
  }
  reasons.push("ok:r2-bottleneck-possible");

  if (roleActivities.R1 !== "C") {
    reasons.push("fail:r1-not-c");
    return { allowed: false, reasons };
  }
  reasons.push("ok:r1-c");

  if (roleActivities.R2 !== "A" && roleActivities.R2 !== "B") {
    reasons.push("fail:r2-not-open");
    return { allowed: false, reasons };
  }
  reasons.push("ok:r2-open");

  if (roleActivities.R3 === "A") {
    reasons.push("fail:r3-is-a");
    return { allowed: false, reasons };
  }
  reasons.push("ok:r3-not-a");

  if (roleActivities.R4 === "A") {
    reasons.push("fail:r4-is-a");
    return { allowed: false, reasons };
  }
  reasons.push("ok:r4-not-a");

  if (r5Bottleneck === "CLEAR") {
    reasons.push("fail:r5-clear");
    return { allowed: false, reasons };
  }
  reasons.push("ok:r5-not-clear");

  const peer = summary.sourceBreakdown.peer;
  const resource = summary.sourceBreakdown.resource;
  if (!resource.rootedVisible) {
    reasons.push("fail:resource-not-rooted-visible");
    return { allowed: false, reasons };
  }
  if (peer.rootedVisible || peer.unrootedVisible) {
    reasons.push("fail:peer-source-breakdown-present");
    return { allowed: false, reasons };
  }
  if (!hasVisibleResourceSupport(summary, evidence, observations)) {
    reasons.push("fail:no-visible-resource-support");
    return { allowed: false, reasons };
  }
  if (hasVisiblePeerSupport(summary, evidence, observations)) {
    reasons.push("fail:visible-peer-support-present");
    return { allowed: false, reasons };
  }
  reasons.push("ok:independent-positive-evidence");

  if (summary.directionCandidate === "leaning-strong") {
    reasons.push("fail:leaning-strong");
    return { allowed: false, reasons };
  }
  reasons.push("ok:direction-not-leaning-strong");

  if (summary.directionCandidate === null && summary.rootQuality === "absent") {
    reasons.push("fail:null-direction-root-absent");
    return { allowed: false, reasons };
  }
  if (summary.directionCandidate === null) {
    reasons.push("ok:null-direction-root-present");
  } else if (summary.directionCandidate === "mixed") {
    reasons.push("ok:mixed-allowed");
  } else {
    reasons.push("ok:direction-gate");
  }

  const hourConfirmed = isHourConfirmed(summary, evidence);
  if (hourConfirmed) {
    reasons.push("ok:hour-confirmed");
  } else {
    if (hourStability === "A" || hourStability === "B") {
      reasons.push(`ok:hour-unknown-stability-${hourStability}`);
    } else {
      reasons.push(
        hourStability === "C"
          ? "fail:hour-unknown-stability-c"
          : "fail:hour-unknown-stability-unresolved",
      );
      return { allowed: false, reasons };
    }
  }

  reasons.push("allowed:possible-dominant");
  return { allowed: true, reasons };
}
