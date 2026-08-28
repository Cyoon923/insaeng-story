/**
 * Structural Final element (R1–R5) from primaryRoles + role element candidates.
 * Does not compare R6/climate, assign certainty, or build FinalResolution.
 */

import { stemElement } from "@/lib/saju/constants/elements";
import { analyzeR5Corridors } from "@/lib/saju/final/analyzeR5Corridors";
import type { RoleElementCandidateMap } from "@/lib/saju/final/deriveRoleElementCandidates";
import type {
  BottleneckLevel,
  FinalRole,
  RoleActivityMap,
} from "@/lib/saju/final/types";
import type { StrengthObservations } from "@/lib/saju/observation/types";
import type {
  Element,
  PillarSlot,
  StrengthEvidence,
  StrengthSummary,
} from "@/lib/saju/types";

const STRUCTURAL_ROLES: FinalRole[] = ["R1", "R2", "R3", "R4", "R5"];

const WEALTH_OF: Record<Element, Element> = {
  木: "土",
  火: "金",
  土: "水",
  金: "木",
  水: "火",
};
const OFFICIAL_OF: Record<Element, Element> = {
  木: "金",
  火: "水",
  土: "木",
  金: "火",
  水: "土",
};

export type ResolveStructuralElementInput = {
  primaryRoles: FinalRole[];
  roleElementCandidates: RoleElementCandidateMap;
  roleActivities: RoleActivityMap;
  r2Bottleneck: BottleneckLevel;
  r5Bottleneck: BottleneckLevel;
  summary: StrengthSummary;
  evidence: StrengthEvidence;
  observations: StrengthObservations;
};

export type StructuralElementStatus = "resolved" | "unresolved";

export type StructuralElementResult = {
  role: FinalRole | null;
  element: Element | null;
  status: StructuralElementStatus;
  reasons: string[];
};

function isEligibleSlot(slot: PillarSlot, hourUnknown: boolean): boolean {
  if (hourUnknown && slot === "hour") return false;
  return true;
}

function isWealthShiShen(shiShen: string): boolean {
  return shiShen === "정재" || shiShen === "편재";
}

function isOfficerShiShen(shiShen: string): boolean {
  return shiShen === "정관" || shiShen === "편관";
}

function isVisiblePresence(presence: string | undefined): boolean {
  return presence === "rooted-visible" || presence === "unrooted-visible";
}

function unresolved(reasons: string[]): StructuralElementResult {
  return { role: null, element: null, status: "unresolved", reasons };
}

function resolved(
  role: FinalRole,
  element: Element,
  reasons: string[],
): StructuralElementResult {
  return { role, element, status: "resolved", reasons };
}

function isResourceShiShen(shiShen: string): boolean {
  return shiShen === "정인" || shiShen === "편인";
}

function isPeerShiShen(shiShen: string): boolean {
  return shiShen === "비견" || shiShen === "겁재";
}

/** Day master is never peer evidence; hour omitted when unknown. */
function isEligiblePeerSlot(slot: PillarSlot, hourUnknown: boolean): boolean {
  if (slot === "day") return false;
  if (hourUnknown && slot === "hour") return false;
  return true;
}

function hasRootedVisibleResource(evidence: StrengthEvidence): boolean {
  return evidence.supportEvidence.items.some(
    (item) => isResourceShiShen(item.shiShen) && item.presence === "rooted-visible",
  );
}

function hasRootedVisiblePeer(evidence: StrengthEvidence): boolean {
  return evidence.supportEvidence.items.some(
    (item) =>
      isPeerShiShen(item.shiShen) &&
      isEligiblePeerSlot(item.slot, evidence.hourUnknown) &&
      item.presence === "rooted-visible",
  );
}

/**
 * foundation-established → Core candidate = dayElement.
 * Does not alter R2 bottleneck / peerGap / Strength direction.
 * Applies only when no higher structural primary already resolved.
 */
function tryFoundationEstablished(
  input: ResolveStructuralElementInput,
  reasons: string[],
): StructuralElementResult | null {
  if (input.r5Bottleneck === "CLEAR") {
    reasons.push("foundation-established:blocked-by-r5-clear");
    return null;
  }
  if (input.summary.rootQuality === "absent") {
    reasons.push("foundation-established:blocked-by-root-absent");
    return null;
  }
  if (!hasRootedVisibleResource(input.evidence)) {
    reasons.push("foundation-established:blocked-by-no-rooted-resource");
    return null;
  }
  if (!hasRootedVisiblePeer(input.evidence)) {
    reasons.push("foundation-established:blocked-by-no-rooted-peer");
    return null;
  }

  const dayElement = stemElement(input.evidence.dayStem);
  reasons.push("foundation-established:day-element");
  // Role label R2 = day-master axis element mapping; bottleneck/peerGap unchanged.
  return resolved("R2", dayElement, reasons);
}

/** Direct wealth-axis evidence (not officer, not counts). */
function hasWealthDirectEvidence(
  evidence: StrengthEvidence,
  observations: StrengthObservations,
  wealthElement: Element,
): boolean {
  const hourUnknown = evidence.hourUnknown;
  if (
    evidence.pressureEvidence.items.some(
      (item) =>
        isWealthShiShen(item.shiShen) &&
        isEligibleSlot(item.slot, hourUnknown) &&
        isVisiblePresence(item.presence),
    )
  ) {
    return true;
  }
  if (
    evidence.branchRelationEvidence.items.some(
      (item) =>
        item.relationSide === "pressure" &&
        isWealthShiShen(item.shiShen) &&
        isEligibleSlot(item.slot, hourUnknown) &&
        item.element === wealthElement,
    )
  ) {
    return true;
  }
  return observations.structureObservation.pressureRelations.some((relation) => {
    if (relation.element !== wealthElement) return false;
    if (
      relation.kind !== "pressure-visible-stem" &&
      relation.kind !== "pressure-branch-anchor"
    ) {
      return false;
    }
    return relation.slots.some((slot) => isEligibleSlot(slot, hourUnknown));
  });
}

/** Direct officer-axis evidence (not wealth, not counts). */
function hasOfficerDirectEvidence(
  evidence: StrengthEvidence,
  observations: StrengthObservations,
  officerElement: Element,
): boolean {
  const hourUnknown = evidence.hourUnknown;
  if (
    evidence.pressureEvidence.items.some(
      (item) =>
        isOfficerShiShen(item.shiShen) &&
        isEligibleSlot(item.slot, hourUnknown) &&
        isVisiblePresence(item.presence),
    )
  ) {
    return true;
  }
  if (
    evidence.branchRelationEvidence.items.some(
      (item) =>
        item.relationSide === "pressure" &&
        isOfficerShiShen(item.shiShen) &&
        isEligibleSlot(item.slot, hourUnknown) &&
        item.element === officerElement,
    )
  ) {
    return true;
  }
  return observations.structureObservation.pressureRelations.some((relation) => {
    if (relation.element !== officerElement) return false;
    if (
      relation.kind !== "pressure-visible-stem" &&
      relation.kind !== "pressure-branch-anchor"
    ) {
      return false;
    }
    return relation.slots.some((slot) => isEligibleSlot(slot, hourUnknown));
  });
}

/**
 * Narrow R4 wealth/officer candidates by direct axis evidence only.
 * Never picks candidates[0]; both/neither → unresolved.
 */
function resolveR4Element(
  candidates: Element[],
  evidence: StrengthEvidence,
  observations: StrengthObservations,
  reasons: string[],
): Element | null {
  if (candidates.length === 0) {
    reasons.push("r4:no-candidates");
    return null;
  }
  if (candidates.length === 1) {
    reasons.push("r4:single-candidate");
    return candidates[0] ?? null;
  }

  const dayElement = stemElement(evidence.dayStem);
  const wealthElement = WEALTH_OF[dayElement];
  const officerElement = OFFICIAL_OF[dayElement];
  const hasWealthCand = candidates.includes(wealthElement);
  const hasOfficerCand = candidates.includes(officerElement);

  if (!hasWealthCand || !hasOfficerCand || candidates.length !== 2) {
    reasons.push("r4:multi-candidate-unranked");
    return null;
  }

  const wealthDirect = hasWealthDirectEvidence(evidence, observations, wealthElement);
  const officerDirect = hasOfficerDirectEvidence(
    evidence,
    observations,
    officerElement,
  );

  if (wealthDirect && !officerDirect) {
    reasons.push("r4:wealth-axis-direct");
    return wealthElement;
  }
  if (officerDirect && !wealthDirect) {
    reasons.push("r4:officer-axis-direct");
    return officerElement;
  }
  if (wealthDirect && officerDirect) {
    reasons.push("r4:wealth-officer-tie");
    return null;
  }
  reasons.push("r4:no-direct-axis-narrowing");
  return null;
}

/**
 * R5: only CLEAR corridor mid(s) from shared analyzeR5Corridors.
 * One CLEAR mid → that element; multiple → unresolved. POSSIBLE not salvaged.
 */
function resolveR5Element(
  candidates: Element[],
  evidence: StrengthEvidence,
  observations: StrengthObservations,
  roleActivities: RoleActivityMap,
  r5Bottleneck: BottleneckLevel,
  reasons: string[],
): Element | null {
  if (r5Bottleneck !== "CLEAR") {
    reasons.push("r5:not-clear-bottleneck");
    return null;
  }
  if (candidates.length === 0) {
    reasons.push("r5:no-candidates");
    return null;
  }

  const analysis = analyzeR5Corridors({
    evidence,
    observations,
    roleActivities,
  });
  const clearMids = [
    ...new Set(
      analysis.corridors
        .filter((corridor) => corridor.grade === "CLEAR")
        .map((corridor) => corridor.mid)
        .filter((mid) => candidates.includes(mid)),
    ),
  ];

  if (clearMids.length === 1) {
    reasons.push("r5:single-clear-corridor-mid");
    return clearMids[0] ?? null;
  }
  if (clearMids.length > 1) {
    reasons.push("r5:multiple-clear-corridor-mids");
    return null;
  }
  reasons.push("r5:no-clear-corridor-mid");
  return null;
}

function resolveSingleRoleElement(
  role: FinalRole,
  candidates: Element[],
  input: ResolveStructuralElementInput,
  reasons: string[],
): Element | null {
  void input.r2Bottleneck;
  void input.summary;

  if (role === "R1" || role === "R2" || role === "R3") {
    if (candidates.length === 1) {
      reasons.push(`${role.toLowerCase()}:single-candidate`);
      return candidates[0] ?? null;
    }
    if (candidates.length === 0) {
      reasons.push(`${role.toLowerCase()}:no-candidates`);
      return null;
    }
    reasons.push(`${role.toLowerCase()}:multiple-candidates-unranked`);
    return null;
  }

  if (role === "R4") {
    return resolveR4Element(candidates, input.evidence, input.observations, reasons);
  }

  if (role === "R5") {
    return resolveR5Element(
      candidates,
      input.evidence,
      input.observations,
      input.roleActivities,
      input.r5Bottleneck,
      reasons,
    );
  }

  reasons.push("role:non-structural");
  return null;
}

/**
 * Derives one structural (R1–R5) Final element candidate or unresolved.
 * R6 and certainty are out of scope.
 * Fallback: foundation-established → dayElement when root + rooted resource + rooted peer.
 */
export function resolveStructuralElement(
  input: ResolveStructuralElementInput,
): StructuralElementResult {
  const reasons: string[] = [];
  const structuralPrimaries = input.primaryRoles.filter((role) =>
    STRUCTURAL_ROLES.includes(role),
  );

  if (structuralPrimaries.length === 0) {
    reasons.push("no-structural-primary");
    const foundation = tryFoundationEstablished(input, reasons);
    if (foundation) return foundation;
    return unresolved(reasons);
  }

  if (structuralPrimaries.length > 1) {
    reasons.push("multiple-structural-primaries");
    return unresolved(reasons);
  }

  const role = structuralPrimaries[0];
  if (!role) {
    reasons.push("no-structural-primary");
    const foundation = tryFoundationEstablished(input, reasons);
    if (foundation) return foundation;
    return unresolved(reasons);
  }

  const candidates = input.roleElementCandidates[role];
  const element = resolveSingleRoleElement(role, candidates, input, reasons);
  if (element) {
    reasons.push("structural-resolved");
    return resolved(role, element, reasons);
  }

  // No resolved structural primary from existing roles — foundation may apply
  // unless R5 CLEAR already owns the structural lane.
  const foundation = tryFoundationEstablished(input, reasons);
  if (foundation) return foundation;
  return unresolved(reasons);
}
