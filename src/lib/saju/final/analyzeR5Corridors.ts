/**
 * Shared R5 P→M→Q corridor analysis for bottleneck grade and element candidates.
 * Does not select Final or compare other roles.
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
import type { Element, PillarSlot, StrengthEvidence } from "@/lib/saju/types";
import { ELEMENTS } from "@/lib/saju/types";

export type R5SegmentActivity =
  | "absent"
  | "present-only"
  | "structurally-active"
  | "relation-active";

export type AnalyzedR5Corridor = {
  parent: Element;
  mid: Element;
  child: Element;
  parentActivity: R5SegmentActivity;
  childActivity: R5SegmentActivity;
  midActivity: R5SegmentActivity;
  midRole: RoleActivity;
  /** P→M relation evidence exists (any strength). */
  hasPmLeg: boolean;
  /** M→Q relation evidence exists (any strength). */
  hasMqLeg: boolean;
  /** Both legs present → already linked (weak or strong), not an R5 gap. */
  bothLegsLinked: boolean;
  /** At least one connecting leg is missing. */
  hasConnectionGap: boolean;
  isDayResourceAlias: boolean;
  isPressureOnlyParent: boolean;
  hasAlternatePath: boolean;
  duplicatesDayMasterFeeding: boolean;
  hourBlocked: boolean;
  /** Eligible 1-step P/Q contract (structural+ and ≥1 relation; mid ≠ C). */
  isOneStepCandidate: boolean;
  grade: BottleneckLevel;
};

export type AnalyzeR5CorridorsInput = {
  evidence: StrengthEvidence;
  observations: StrengthObservations;
  roleActivities: RoleActivityMap;
};

export type AnalyzeR5CorridorsResult = {
  corridors: AnalyzedR5Corridor[];
  /** Aggregate bottleneck: max(CLEAR > POSSIBLE > NOT). R5 Activity C → NOT. */
  bottleneck: BottleneckLevel;
  /** Mids from corridors graded POSSIBLE or CLEAR (same set bottleneck used). */
  candidateMids: Element[];
};

function isEligibleSlot(slot: PillarSlot, hourUnknown: boolean): boolean {
  if (hourUnknown && slot === "hour") return false;
  return true;
}

function parentElement(child: Element): Element {
  const parent = ELEMENTS.find((element) => generatedElement(element) === child);
  if (!parent) throw new Error(`No parent element for ${child}`);
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
  if (anchors.length === 0) return element === dayElement;
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
): R5SegmentActivity {
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
    if (chain.relation === "resource-to-day-master") return child === dayElement;
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

function hasPmLeg(
  observations: StrengthObservations,
  parent: Element,
  mid: Element,
  hourUnknown: boolean,
): boolean {
  if (collectPmLinks(observations, parent, mid, hourUnknown).length > 0) return true;
  return hasGenerationSupportPair(observations, parent, mid, hourUnknown);
}

function hasMqLeg(
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
    if (chain.relation === "resource-to-day-master") return child === dayElement;
    if (chain.relation !== "element-generates") return false;
    return chainTargetElement(chain) === child;
  });
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
  return parentSlots.length === 0 || childSlots.length === 0 || onlyHour(parentSlots) || onlyHour(childSlots);
}

function midIsClearGapSurface(midActivity: R5SegmentActivity): boolean {
  return midActivity === "absent";
}

/**
 * CLEAR: true mid gap + both P/Q RELATION + exactly one corridor leg
 * (proves P–Q path without claiming the link is already complete).
 */
function isClearGrade(corridor: {
  parentActivity: R5SegmentActivity;
  childActivity: R5SegmentActivity;
  midActivity: R5SegmentActivity;
  hasPmLeg: boolean;
  hasMqLeg: boolean;
  bothLegsLinked: boolean;
  hourBlocked: boolean;
  isPressureOnlyParent: boolean;
}): boolean {
  if (corridor.bothLegsLinked) return false;
  if (corridor.isPressureOnlyParent) return false;
  if (corridor.parentActivity !== "relation-active") return false;
  if (corridor.childActivity !== "relation-active") return false;
  if (!midIsClearGapSurface(corridor.midActivity)) return false;
  if (corridor.hourBlocked) return false;
  // Corridor-specific: one leg present, the other missing (actual gap).
  const oneLegOnly =
    (corridor.hasPmLeg && !corridor.hasMqLeg) || (!corridor.hasPmLeg && corridor.hasMqLeg);
  return oneLegOnly;
}

function gradeCorridor(input: {
  isOneStepCandidate: boolean;
  bothLegsLinked: boolean;
  hasConnectionGap: boolean;
  isDayResourceAlias: boolean;
  isPressureOnlyParent: boolean;
  hasAlternatePath: boolean;
  duplicatesDayMasterFeeding: boolean;
  hourBlocked: boolean;
  parentActivity: R5SegmentActivity;
  childActivity: R5SegmentActivity;
  midActivity: R5SegmentActivity;
  hasPmLeg: boolean;
  hasMqLeg: boolean;
}): BottleneckLevel {
  if (!input.isOneStepCandidate) return "NOT";
  // Already linked on both ends — weak or strong — is not an R5 gap.
  if (input.bothLegsLinked) return "NOT";
  if (input.isDayResourceAlias) return "NOT";
  if (input.isPressureOnlyParent) return "NOT";
  if (input.hasAlternatePath) return "NOT";
  if (input.duplicatesDayMasterFeeding) return "NOT";
  if (!input.hasConnectionGap) return "NOT";

  if (
    isClearGrade({
      parentActivity: input.parentActivity,
      childActivity: input.childActivity,
      midActivity: input.midActivity,
      hasPmLeg: input.hasPmLeg,
      hasMqLeg: input.hasMqLeg,
      bothLegsLinked: input.bothLegsLinked,
      hourBlocked: input.hourBlocked,
      isPressureOnlyParent: input.isPressureOnlyParent,
    })
  ) {
    return "CLEAR";
  }

  // One-sided connection gap confirmed, CLEAR unmet → POSSIBLE.
  return "POSSIBLE";
}

function betterLevel(a: BottleneckLevel, b: BottleneckLevel): BottleneckLevel {
  const rank = { CLEAR: 2, POSSIBLE: 1, NOT: 0 } as const;
  return rank[a] >= rank[b] ? a : b;
}

/**
 * Analyzes every elemental P→M→Q corridor once for bottleneck + candidate reuse.
 */
export function analyzeR5Corridors(
  input: AnalyzeR5CorridorsInput,
): AnalyzeR5CorridorsResult {
  const { evidence, observations, roleActivities } = input;
  const dayElement = stemElement(evidence.dayStem);
  const hourUnknown = evidence.hourUnknown;
  const corridors: AnalyzedR5Corridor[] = [];

  if (roleActivities.R5 === "C") {
    return { corridors: [], bottleneck: "NOT", candidateMids: [] };
  }

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
    const midActivity = segmentActivity(evidence, observations, mid, dayElement, hourUnknown);
    const midRole = midConnectionRole(evidence, observations, mid, dayElement, hourUnknown);

    const pmLeg = hasPmLeg(observations, parent, mid, hourUnknown);
    const mqLeg = hasMqLeg(evidence, observations, mid, child, dayElement, hourUnknown);
    const bothLegsLinked = pmLeg && mqLeg;
    const hasConnectionGap = !pmLeg || !mqLeg;

    const parentOk =
      parentActivity === "structurally-active" || parentActivity === "relation-active";
    const childOk =
      childActivity === "structurally-active" || childActivity === "relation-active";
    const anyRelation =
      parentActivity === "relation-active" || childActivity === "relation-active";
    const isOneStepCandidate =
      parentOk && childOk && anyRelation && midRole !== "C";

    const alias = isDayResourceAlias(child, mid, dayElement);
    const pressureOnly = isPressureOnlyParent(evidence, observations, parent, hourUnknown);
    const alternate = hasAlternatePathToChild(
      observations,
      mid,
      child,
      dayElement,
      hourUnknown,
    );
    const dayFeed =
      child === dayElement && (roleActivities.R1 === "C" || roleActivities.R2 === "C");
    const hourBlocked = reliesOnHourUnknownOnly(
      evidence,
      observations,
      parent,
      child,
      dayElement,
    );

    const grade = gradeCorridor({
      isOneStepCandidate,
      bothLegsLinked,
      hasConnectionGap,
      isDayResourceAlias: alias,
      isPressureOnlyParent: pressureOnly,
      hasAlternatePath: alternate,
      duplicatesDayMasterFeeding: dayFeed,
      hourBlocked,
      parentActivity,
      childActivity,
      midActivity,
      hasPmLeg: pmLeg,
      hasMqLeg: mqLeg,
    });

    corridors.push({
      parent,
      mid,
      child,
      parentActivity,
      childActivity,
      midActivity,
      midRole,
      hasPmLeg: pmLeg,
      hasMqLeg: mqLeg,
      bothLegsLinked,
      hasConnectionGap,
      isDayResourceAlias: alias,
      isPressureOnlyParent: pressureOnly,
      hasAlternatePath: alternate,
      duplicatesDayMasterFeeding: dayFeed,
      hourBlocked,
      isOneStepCandidate,
      grade,
    });
  }

  let bottleneck: BottleneckLevel = "NOT";
  for (const corridor of corridors) {
    bottleneck = betterLevel(bottleneck, corridor.grade);
  }

  const candidateMids = corridors
    .filter((corridor) => corridor.grade === "POSSIBLE" || corridor.grade === "CLEAR")
    .map((corridor) => corridor.mid);

  return { corridors, bottleneck, candidateMids };
}
