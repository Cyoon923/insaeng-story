/**
 * R5 (생조 연결) bottleneck grade only.
 * Distinct from R5 Role Activity A/B/C. Does not select Final or compare R3/R4/R6.
 */

import { branchElement, stemElement } from "@/lib/saju/constants/elements";
import type { BottleneckLevel, RoleActivity, RoleActivityMap } from "@/lib/saju/final/types";
import { generatedElement } from "@/lib/saju/observation/elementGenerates";
import type {
  ElementClusterAnchor,
  GenerationChain,
  StrengthObservations,
  SupportStructureRelation,
} from "@/lib/saju/observation/types";
import type { Element, FourPillars, PillarSlot, StrengthEvidence } from "@/lib/saju/types";
import { ELEMENTS } from "@/lib/saju/types";

export type DeriveR5BottleneckInput = {
  pillars: FourPillars;
  evidence: StrengthEvidence;
  observations: StrengthObservations;
  roleActivities: RoleActivityMap;
};

type SegmentActivity = "absent" | "present-only" | "structurally-active" | "relation-active";

type CorridorCandidate = {
  parent: Element;
  mid: Element;
  child: Element;
  parentActivity: SegmentActivity;
  childActivity: SegmentActivity;
  midRole: RoleActivity;
};

function isEligibleSlot(slot: PillarSlot, hourUnknown: boolean): boolean {
  if (hourUnknown && slot === "hour") return false;
  return true;
}

function parentElement(child: Element): Element {
  const parent = ELEMENTS.find((element) => generatedElement(element) === child);
  if (!parent) {
    throw new Error(`No parent element for ${child}`);
  }
  return parent;
}

function chainTargetElement(chain: GenerationChain): Element | null {
  if ("target" in chain.to) return null;
  return chain.to.element;
}

function eligibleChain(chain: GenerationChain, hourUnknown: boolean): boolean {
  if (!isEligibleSlot(chain.from.slot, hourUnknown)) return false;
  if ("target" in chain.to) return true;
  return isEligibleSlot(chain.to.slot, hourUnknown);
}

function eligibleAnchors(
  observations: StrengthObservations,
  element: Element,
  hourUnknown: boolean,
): ElementClusterAnchor[] {
  const cluster = observations.elementClusters.find((item) => item.element === element);
  if (!cluster) return [];
  return cluster.anchors.filter((anchor) => isEligibleSlot(anchor.slot, hourUnknown));
}

function isVisiblePresence(presence: string | undefined): boolean {
  return presence === "rooted-visible" || presence === "unrooted-visible";
}

function isStructurallyActive(
  evidence: StrengthEvidence,
  observations: StrengthObservations,
  element: Element,
  dayElement: Element,
  hourUnknown: boolean,
): boolean {
  const anchors = eligibleAnchors(observations, element, hourUnknown);
  if (anchors.length === 0) {
    // Day stem itself is always a structural Q/P surface when it is the day element.
    return element === dayElement;
  }

  if (anchors.some((anchor) => isVisiblePresence(anchor.presence))) return true;
  if (anchors.some((anchor) => anchor.layer === "stem")) return true;
  if (
    anchors.some(
      (anchor) =>
        anchor.layer === "branch" &&
        anchor.branch !== undefined &&
        branchElement(anchor.branch) === element,
    )
  ) {
    return true;
  }

  if (element === dayElement && evidence.rootEvidence.hasRoot) return true;

  return false;
}

function elementInGenerationChains(
  observations: StrengthObservations,
  element: Element,
  hourUnknown: boolean,
): boolean {
  return observations.generationChains.some((chain) => {
    if (!eligibleChain(chain, hourUnknown)) return false;
    if (chain.from.element === element) return true;
    if ("target" in chain.to) return element === stemElement(observations.dayStem);
    return chain.to.element === element;
  });
}

function elementInGenerationOrResourceSupport(
  observations: StrengthObservations,
  element: Element,
  hourUnknown: boolean,
): boolean {
  return observations.structureObservation.supportRelations.some((relation) => {
    if (relation.kind !== "generation-support" && relation.kind !== "resource-support") {
      return false;
    }
    if (!relation.elements.includes(element)) return false;
    return relation.slots.some((slot) => isEligibleSlot(slot, hourUnknown));
  });
}

function elementHasVisibleSupportStem(
  evidence: StrengthEvidence,
  element: Element,
  hourUnknown: boolean,
): boolean {
  return evidence.supportEvidence.items.some(
    (item) =>
      stemElement(item.stem) === element &&
      isEligibleSlot(item.slot, hourUnknown) &&
      isVisiblePresence(item.presence),
  );
}

function elementHasPeerSupportAsDay(
  observations: StrengthObservations,
  element: Element,
  dayElement: Element,
  hourUnknown: boolean,
): boolean {
  if (element !== dayElement) return false;
  return observations.structureObservation.supportRelations.some((relation) => {
    if (relation.kind !== "peer-support") return false;
    if (!relation.elements.includes(element)) return false;
    return relation.slots.some((slot) => isEligibleSlot(slot, hourUnknown));
  });
}

function isRelationActive(
  evidence: StrengthEvidence,
  observations: StrengthObservations,
  element: Element,
  dayElement: Element,
  hourUnknown: boolean,
): boolean {
  if (!isStructurallyActive(evidence, observations, element, dayElement, hourUnknown)) {
    return false;
  }

  return (
    elementInGenerationChains(observations, element, hourUnknown) ||
    elementInGenerationOrResourceSupport(observations, element, hourUnknown) ||
    elementHasVisibleSupportStem(evidence, element, hourUnknown) ||
    elementHasPeerSupportAsDay(observations, element, dayElement, hourUnknown)
  );
}

function segmentActivity(
  evidence: StrengthEvidence,
  observations: StrengthObservations,
  element: Element,
  dayElement: Element,
  hourUnknown: boolean,
): SegmentActivity {
  const anchors = eligibleAnchors(observations, element, hourUnknown);
  const present = anchors.length > 0 || element === dayElement;
  if (!present) return "absent";

  if (isRelationActive(evidence, observations, element, dayElement, hourUnknown)) {
    return "relation-active";
  }
  if (isStructurallyActive(evidence, observations, element, dayElement, hourUnknown)) {
    return "structurally-active";
  }
  return "present-only";
}

function collectPmLinks(
  observations: StrengthObservations,
  parent: Element,
  mid: Element,
  hourUnknown: boolean,
): GenerationChain[] {
  return observations.generationChains.filter((chain) => {
    if (!eligibleChain(chain, hourUnknown)) return false;
    if (chain.relation !== "element-generates") return false;
    if (chain.from.element !== parent) return false;
    return chainTargetElement(chain) === mid;
  });
}

function collectMqLinks(
  observations: StrengthObservations,
  mid: Element,
  child: Element,
  dayElement: Element,
  hourUnknown: boolean,
): GenerationChain[] {
  return observations.generationChains.filter((chain) => {
    if (!eligibleChain(chain, hourUnknown)) return false;
    if (chain.from.element !== mid) return false;

    if (chain.relation === "resource-to-day-master") {
      return child === dayElement;
    }

    if (chain.relation !== "element-generates") return false;
    return chainTargetElement(chain) === child;
  });
}

function isMidDayGenerationSupport(
  relation: SupportStructureRelation,
  mid: Element,
  dayElement: Element,
  hourUnknown: boolean,
): boolean {
  if (relation.kind !== "generation-support") return false;
  if (!relation.elements.includes(mid) || !relation.elements.includes(dayElement)) return false;
  return relation.slots.some((slot) => isEligibleSlot(slot, hourUnknown));
}

function generationSupportConfirmsMq(
  observations: StrengthObservations,
  mid: Element,
  child: Element,
  dayElement: Element,
  hourUnknown: boolean,
): boolean {
  if (child !== dayElement) return false;
  return observations.structureObservation.supportRelations.some((relation) =>
    isMidDayGenerationSupport(relation, mid, dayElement, hourUnknown),
  );
}

function hasRootedVisible(chains: GenerationChain[]): boolean {
  return chains.some((chain) => chain.from.presence === "rooted-visible");
}

function hasRootedVisibleGenerationSupportMq(
  evidence: StrengthEvidence,
  observations: StrengthObservations,
  mid: Element,
  child: Element,
  dayElement: Element,
  hourUnknown: boolean,
): boolean {
  if (child !== dayElement) return false;

  for (const relation of observations.structureObservation.supportRelations) {
    if (!isMidDayGenerationSupport(relation, mid, dayElement, hourUnknown)) continue;

    for (const ref of relation.evidenceRefs) {
      if (!ref.stem || stemElement(ref.stem) !== mid) continue;
      if (ref.slot !== undefined && !isEligibleSlot(ref.slot, hourUnknown)) continue;

      const backingChain = observations.generationChains.find(
        (chain) =>
          chain.relation === "resource-to-day-master" &&
          chain.from.element === mid &&
          chain.from.stem === ref.stem &&
          (ref.slot === undefined || chain.from.slot === ref.slot) &&
          eligibleChain(chain, hourUnknown),
      );
      if (backingChain?.from.presence === "rooted-visible") return true;

      const supportItem = evidence.supportEvidence.items.find(
        (item) =>
          item.stem === ref.stem &&
          (item.shiShen === "정인" || item.shiShen === "편인") &&
          isEligibleSlot(item.slot, hourUnknown) &&
          (ref.slot === undefined || item.slot === ref.slot),
      );
      if (supportItem?.presence === "rooted-visible") return true;
    }
  }

  return false;
}

function midConnectionRole(
  evidence: StrengthEvidence,
  observations: StrengthObservations,
  mid: Element,
  dayElement: Element,
  hourUnknown: boolean,
): RoleActivity {
  const parent = parentElement(mid);
  const child = generatedElement(mid);
  const pm = collectPmLinks(observations, parent, mid, hourUnknown);
  const mq = collectMqLinks(observations, mid, child, dayElement, hourUnknown);
  const supportMq = generationSupportConfirmsMq(
    observations,
    mid,
    child,
    dayElement,
    hourUnknown,
  );
  const mqRooted =
    hasRootedVisible(mq) ||
    hasRootedVisibleGenerationSupportMq(
      evidence,
      observations,
      mid,
      child,
      dayElement,
      hourUnknown,
    );

  const bothLegs = pm.length > 0 && (mq.length > 0 || supportMq);
  if (bothLegs && hasRootedVisible(pm) && mqRooted) return "C";

  const anyLeg = pm.length > 0 || mq.length > 0 || supportMq;
  const midAnchors = eligibleAnchors(observations, mid, hourUnknown);
  const midWeak = midAnchors.some(
    (anchor) =>
      anchor.presence === "hidden-only" ||
      anchor.presence === "unrooted-visible" ||
      anchor.layer === "branch",
  );
  const neighborsPresent =
    eligibleAnchors(observations, parent, hourUnknown).length > 0 ||
    eligibleAnchors(observations, child, hourUnknown).length > 0 ||
    parent === dayElement ||
    child === dayElement;

  if (anyLeg || (midWeak && neighborsPresent)) return "B";
  return "A";
}

function isDayResourceAlias(child: Element, mid: Element, dayElement: Element): boolean {
  return child === dayElement && mid === parentElement(dayElement);
}

function hasPressureOnElement(
  evidence: StrengthEvidence,
  observations: StrengthObservations,
  element: Element,
  hourUnknown: boolean,
): boolean {
  if (
    evidence.pressureEvidence.items.some(
      (item) =>
        stemElement(item.stem) === element && isEligibleSlot(item.slot, hourUnknown),
    )
  ) {
    return true;
  }

  return observations.structureObservation.pressureRelations.some((relation) => {
    if (relation.element !== element) return false;
    return relation.slots.some((slot) => isEligibleSlot(slot, hourUnknown));
  });
}

/** Outgoing generation/support from P (being a generation target alone does not count). */
function hasOutgoingGenerationOrSupport(
  evidence: StrengthEvidence,
  observations: StrengthObservations,
  element: Element,
  hourUnknown: boolean,
): boolean {
  if (
    observations.generationChains.some(
      (chain) => eligibleChain(chain, hourUnknown) && chain.from.element === element,
    )
  ) {
    return true;
  }

  if (elementHasVisibleSupportStem(evidence, element, hourUnknown)) return true;

  return observations.structureObservation.supportRelations.some((relation) => {
    if (relation.kind !== "generation-support" && relation.kind !== "resource-support") {
      return false;
    }
    if (!relation.elements.includes(element)) return false;
    return relation.evidenceRefs.some(
      (ref) => ref.stem !== undefined && stemElement(ref.stem) === element,
    );
  });
}

/** P is pressure-only when pressure is present and no outgoing generation/support corridor role. */
function isPressureOnlyParent(
  evidence: StrengthEvidence,
  observations: StrengthObservations,
  parent: Element,
  hourUnknown: boolean,
): boolean {
  if (!hasPressureOnElement(evidence, observations, parent, hourUnknown)) return false;
  return !hasOutgoingGenerationOrSupport(evidence, observations, parent, hourUnknown);
}

function hasAlternatePathToChild(
  observations: StrengthObservations,
  mid: Element,
  child: Element,
  dayElement: Element,
  hourUnknown: boolean,
): boolean {
  return observations.generationChains.some((chain) => {
    if (!eligibleChain(chain, hourUnknown)) return false;
    if (chain.from.element === mid) return false;

    if (chain.relation === "resource-to-day-master") {
      return child === dayElement;
    }

    if (chain.relation !== "element-generates") return false;
    return chainTargetElement(chain) === child;
  });
}

/**
 * Day-Q gap while peer/resource already feeds the day master:
 * this specific corridor is not the overall connection bottleneck.
 * Non-day Q corridors must not use this gate.
 */
function duplicatesDayMasterFeeding(
  candidate: CorridorCandidate,
  dayElement: Element,
  roleActivities: RoleActivityMap,
): boolean {
  if (candidate.child !== dayElement) return false;
  return roleActivities.R1 === "C" || roleActivities.R2 === "C";
}

function hasGenerationSupportPair(
  observations: StrengthObservations,
  left: Element,
  right: Element,
  hourUnknown: boolean,
): boolean {
  return observations.structureObservation.supportRelations.some((relation) => {
    if (relation.kind !== "generation-support") return false;
    if (!relation.elements.includes(left) || !relation.elements.includes(right)) return false;
    return relation.slots.some((slot) => isEligibleSlot(slot, hourUnknown));
  });
}

/** Front-of-corridor evidence for P→M (complete rooted chain not required). */
function hasCorridorFrontEvidence(
  observations: StrengthObservations,
  parent: Element,
  mid: Element,
  hourUnknown: boolean,
): boolean {
  if (collectPmLinks(observations, parent, mid, hourUnknown).length > 0) return true;
  return hasGenerationSupportPair(observations, parent, mid, hourUnknown);
}

/** Back-of-corridor evidence for M→Q (complete rooted chain not required). */
function hasCorridorBackEvidence(
  evidence: StrengthEvidence,
  observations: StrengthObservations,
  mid: Element,
  child: Element,
  dayElement: Element,
  hourUnknown: boolean,
): boolean {
  if (collectMqLinks(observations, mid, child, dayElement, hourUnknown).length > 0) {
    return true;
  }
  if (generationSupportConfirmsMq(observations, mid, child, dayElement, hourUnknown)) {
    return true;
  }
  return hasGenerationSupportPair(observations, mid, child, hourUnknown);
}

/**
 * CLEAR requires corridor-specific front AND back linkage on this P→M→Q path.
 * Unrelated generation/support that merely makes P and Q each "active" is not enough.
 */
function hasCorridorSpecificLinkage(
  evidence: StrengthEvidence,
  observations: StrengthObservations,
  parent: Element,
  mid: Element,
  child: Element,
  dayElement: Element,
  hourUnknown: boolean,
): boolean {
  if (isPressureOnlyParent(evidence, observations, parent, hourUnknown)) {
    return false;
  }

  return (
    hasCorridorFrontEvidence(observations, parent, mid, hourUnknown) &&
    hasCorridorBackEvidence(evidence, observations, mid, child, dayElement, hourUnknown)
  );
}

function activityEvidenceSlots(
  evidence: StrengthEvidence,
  observations: StrengthObservations,
  element: Element,
  dayElement: Element,
  hourUnknown: boolean,
): PillarSlot[] {
  const slots = new Set<PillarSlot>();

  for (const anchor of eligibleAnchors(observations, element, hourUnknown)) {
    if (
      isVisiblePresence(anchor.presence) ||
      anchor.layer === "stem" ||
      (anchor.layer === "branch" &&
        anchor.branch !== undefined &&
        branchElement(anchor.branch) === element)
    ) {
      slots.add(anchor.slot);
    }
  }

  if (element === dayElement) {
    slots.add("day");
    for (const hit of evidence.rootEvidence.hits) {
      if (isEligibleSlot(hit.slot, hourUnknown)) slots.add(hit.slot);
    }
  }

  for (const chain of observations.generationChains) {
    if (!eligibleChain(chain, hourUnknown)) continue;
    if (chain.from.element === element) slots.add(chain.from.slot);
    if ("target" in chain.to) {
      if (element === dayElement) slots.add("day");
    } else if (chain.to.element === element) {
      slots.add(chain.to.slot);
    }
  }

  for (const relation of observations.structureObservation.supportRelations) {
    if (
      relation.kind !== "generation-support" &&
      relation.kind !== "resource-support" &&
      !(relation.kind === "peer-support" && element === dayElement)
    ) {
      continue;
    }
    if (!relation.elements.includes(element)) continue;
    for (const slot of relation.slots) {
      if (isEligibleSlot(slot, hourUnknown)) slots.add(slot);
    }
  }

  for (const item of evidence.supportEvidence.items) {
    if (stemElement(item.stem) !== element) continue;
    if (!isEligibleSlot(item.slot, hourUnknown)) continue;
    if (!isVisiblePresence(item.presence)) continue;
    slots.add(item.slot);
  }

  return [...slots];
}

function reliesOnHourUnknownOnly(
  evidence: StrengthEvidence,
  observations: StrengthObservations,
  parent: Element,
  child: Element,
  dayElement: Element,
): boolean {
  if (!evidence.hourUnknown) return false;

  const parentSlots = activityEvidenceSlots(
    evidence,
    observations,
    parent,
    dayElement,
    evidence.hourUnknown,
  );
  const childSlots = activityEvidenceSlots(
    evidence,
    observations,
    child,
    dayElement,
    evidence.hourUnknown,
  );

  const onlyHour = (slots: PillarSlot[]) => slots.length > 0 && slots.every((slot) => slot === "hour");
  // When hour is unknown those slots are already filtered out — if nothing remains, unique hour dependence.
  return parentSlots.length === 0 || childSlots.length === 0 || onlyHour(parentSlots) || onlyHour(childSlots);
}

/**
 * CLEAR mid gap: M has no eligible cluster surface (true absence).
 * Present-only / structural mid is at most POSSIBLE even with weak corridor legs.
 */
function midIsClearGapSurface(
  evidence: StrengthEvidence,
  observations: StrengthObservations,
  mid: Element,
  dayElement: Element,
  hourUnknown: boolean,
): boolean {
  const activity = segmentActivity(evidence, observations, mid, dayElement, hourUnknown);
  return activity === "absent";
}

/**
 * CLEAR-grade mid gap: both ends relation-active, mid surface is a true gap,
 * and this P→M→Q path has corridor-specific front/back evidence (not unrelated actives).
 */
function hasClearPositiveMidGap(
  evidence: StrengthEvidence,
  observations: StrengthObservations,
  candidate: CorridorCandidate,
  dayElement: Element,
  hourUnknown: boolean,
): boolean {
  if (candidate.midRole === "C") return false;
  if (candidate.parentActivity !== "relation-active") return false;
  if (candidate.childActivity !== "relation-active") return false;
  if (
    !midIsClearGapSurface(
      evidence,
      observations,
      candidate.mid,
      dayElement,
      hourUnknown,
    )
  ) {
    return false;
  }

  return hasCorridorSpecificLinkage(
    evidence,
    observations,
    candidate.parent,
    candidate.mid,
    candidate.child,
    dayElement,
    hourUnknown,
  );
}

function collectOneStepCandidates(
  evidence: StrengthEvidence,
  observations: StrengthObservations,
  dayElement: Element,
  hourUnknown: boolean,
): CorridorCandidate[] {
  const candidates: CorridorCandidate[] = [];

  for (const mid of ELEMENTS) {
    const parent = parentElement(mid);
    const child = generatedElement(mid);
    const parentActivity = segmentActivity(
      evidence,
      observations,
      parent,
      dayElement,
      hourUnknown,
    );
    const childActivity = segmentActivity(
      evidence,
      observations,
      child,
      dayElement,
      hourUnknown,
    );

    const parentOk =
      parentActivity === "structurally-active" || parentActivity === "relation-active";
    const childOk =
      childActivity === "structurally-active" || childActivity === "relation-active";
    if (!parentOk || !childOk) continue;

    const anyRelation =
      parentActivity === "relation-active" || childActivity === "relation-active";
    if (!anyRelation) continue;

    const midRole = midConnectionRole(evidence, observations, mid, dayElement, hourUnknown);
    if (midRole === "C") continue;

    candidates.push({
      parent,
      mid,
      child,
      parentActivity,
      childActivity,
      midRole,
    });
  }

  return candidates;
}

function gradeCandidate(
  evidence: StrengthEvidence,
  observations: StrengthObservations,
  roleActivities: RoleActivityMap,
  candidate: CorridorCandidate,
  dayElement: Element,
): BottleneckLevel {
  const hourUnknown = evidence.hourUnknown;

  if (isDayResourceAlias(candidate.child, candidate.mid, dayElement)) return "NOT";
  if (isPressureOnlyParent(evidence, observations, candidate.parent, hourUnknown)) {
    return "NOT";
  }
  if (
    hasAlternatePathToChild(
      observations,
      candidate.mid,
      candidate.child,
      dayElement,
      hourUnknown,
    )
  ) {
    return "NOT";
  }
  if (duplicatesDayMasterFeeding(candidate, dayElement, roleActivities)) return "NOT";

  const hourBlocked = reliesOnHourUnknownOnly(
    evidence,
    observations,
    candidate.parent,
    candidate.child,
    dayElement,
  );

  if (
    hasClearPositiveMidGap(evidence, observations, candidate, dayElement, hourUnknown) &&
    !hourBlocked
  ) {
    return "CLEAR";
  }

  // 1-step candidate stands, NOT filters passed, CLEAR unmet → POSSIBLE
  return "POSSIBLE";
}

function betterLevel(a: BottleneckLevel, b: BottleneckLevel): BottleneckLevel {
  const rank = { CLEAR: 2, POSSIBLE: 1, NOT: 0 } as const;
  return rank[a] >= rank[b] ? a : b;
}

/**
 * Grades whether a P→M→Q generation-corridor gap is an R5 structural bottleneck.
 * Role Activity C for the same connection is never treated as a bottleneck.
 */
export function deriveR5Bottleneck(input: DeriveR5BottleneckInput): BottleneckLevel {
  const { evidence, observations, roleActivities } = input;
  const dayElement = stemElement(evidence.dayStem);
  const hourUnknown = evidence.hourUnknown;

  // Same working connection must not be reopened as a bottleneck.
  if (roleActivities.R5 === "C") return "NOT";

  const candidates = collectOneStepCandidates(evidence, observations, dayElement, hourUnknown);

  if (candidates.length === 0) {
    // No 1-step candidate (including pure 2-step discontinuities) → NOT; CLEAR impossible.
    return "NOT";
  }

  let best: BottleneckLevel = "NOT";
  for (const candidate of candidates) {
    best = betterLevel(
      best,
      gradeCandidate(evidence, observations, roleActivities, candidate, dayElement),
    );
  }

  return best;
}
