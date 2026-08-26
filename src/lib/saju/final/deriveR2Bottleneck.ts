/**
 * R2 (peer / 비겁) bottleneck grade only.
 * Does not select Final, compare R3–R6, or apply POSSIBLE-DOMINANT gates.
 */

import type { StrengthObservations } from "@/lib/saju/observation/types";
import type { BottleneckLevel, RoleActivityMap } from "@/lib/saju/final/types";
import type {
  FourPillars,
  PillarSlot,
  StrengthEvidence,
  StrengthSummary,
} from "@/lib/saju/types";

export type DeriveR2BottleneckInput = {
  pillars: FourPillars;
  summary: StrengthSummary;
  evidence: StrengthEvidence;
  observations: StrengthObservations;
  roleActivities: RoleActivityMap;
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

/** Day master is never peer evidence; hour omitted when unknown. */
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

function isRootBandForClear(rootQuality: StrengthSummary["rootQuality"]): boolean {
  return rootQuality === "shallow" || rootQuality === "present" || rootQuality === "clear";
}

/**
 * Grades whether day-외 peer absence is an R2 structural bottleneck.
 * Peer absence alone never yields CLEAR; day master is not peer evidence.
 */
export function deriveR2Bottleneck(input: DeriveR2BottleneckInput): BottleneckLevel {
  const { summary, evidence, observations, roleActivities } = input;
  const { R1, R2 } = roleActivities;

  if (R2 === "C") return "NOT";
  if (R1 !== "C") return "NOT";

  const peer = summary.sourceBreakdown.peer;
  const resource = summary.sourceBreakdown.resource;
  const peerGap = !peer.rootedVisible && !peer.unrootedVisible;
  const resourceRootedVisible = resource.rootedVisible;

  const visibleResource = hasVisibleResourceSupport(summary, evidence, observations);
  const visiblePeer = hasVisiblePeerSupport(summary, evidence, observations);

  // Visible peer support means the peer axis is not an empty bottleneck.
  if (!peerGap || visiblePeer) return "NOT";

  const direction = summary.directionCandidate;
  if (direction === "leaning-strong") return "NOT";

  const hourConfirmed = isHourConfirmed(summary, evidence);
  const rootOk = isRootBandForClear(summary.rootQuality);
  const r2Open = R2 === "A" || R2 === "B";

  if (
    direction === "leaning-weak" &&
    r2Open &&
    resourceRootedVisible &&
    peerGap &&
    rootOk &&
    hourConfirmed &&
    visibleResource &&
    !visiblePeer
  ) {
    return "CLEAR";
  }

  // Positive bottleneck evidence beyond mere peer absence.
  const positive =
    r2Open && resourceRootedVisible && peerGap && visibleResource && !visiblePeer;

  if (!positive) return "NOT";

  if (direction === "leaning-weak" || direction === "mixed" || direction === null) {
    return "POSSIBLE";
  }

  return "NOT";
}
