/**
 * R5 (생조 연결) Role Activity only.
 * Judges whether a mid-link in a general P→M→Q generation corridor is operating.
 * Does not hardcode day-resource, detect bottlenecks, select P/Q gaps, or pick Final.
 */

import { stemElement } from "@/lib/saju/constants/elements";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import type { RoleActivity } from "@/lib/saju/final/types";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import { generatedElement } from "@/lib/saju/observation/elementGenerates";
import type {
  GenerationChain,
  StrengthObservations,
  SupportStructureRelation,
} from "@/lib/saju/observation/types";
import type { Element, FourPillars, PillarSlot, StrengthEvidence } from "@/lib/saju/types";
import { ELEMENTS } from "@/lib/saju/types";

export type DeriveR5RoleActivityInput = {
  pillars: FourPillars;
  /** Reuse when already computed; otherwise collected once. */
  evidence?: StrengthEvidence;
  /** Reuse when already computed; otherwise built from pillars + evidence. */
  observations?: StrengthObservations;
};

/** Hour is omitted when unknown. */
function isEligibleSlot(slot: PillarSlot, hourUnknown: boolean): boolean {
  if (hourUnknown && slot === "hour") return false;
  return true;
}

function isResourceShiShen(shiShen: string): boolean {
  return shiShen === "정인" || shiShen === "편인";
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

/** P→M element-generates links. */
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

/**
 * M→Q links: element-generates M→Q, or resource-to-day-master when Q is the day element.
 * (Q may or may not be day-master; day is only a special case of Q.)
 */
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

function hasRootedVisible(chains: GenerationChain[]): boolean {
  return chains.some((chain) => chain.from.presence === "rooted-visible");
}

function elementPresentInClusters(
  observations: StrengthObservations,
  element: Element,
  hourUnknown: boolean,
): boolean {
  const cluster = observations.elementClusters.find((item) => item.element === element);
  return (
    cluster?.anchors.some((anchor) => isEligibleSlot(anchor.slot, hourUnknown)) ?? false
  );
}

function hasWeakMidPresence(
  observations: StrengthObservations,
  mid: Element,
  hourUnknown: boolean,
): boolean {
  const cluster = observations.elementClusters.find((item) => item.element === mid);
  if (!cluster) return false;
  return cluster.anchors.some((anchor) => {
    if (!isEligibleSlot(anchor.slot, hourUnknown)) return false;
    return (
      anchor.presence === "hidden-only" ||
      anchor.presence === "unrooted-visible" ||
      anchor.layer === "branch"
    );
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

/** Kind-level M→day generation-support presence (any backing strength). */
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

/**
 * M→Q via generation-support counts as rooted surface only when evidenceRefs
 * resolve to rooted-visible backing (matching resource-to-day chain and/or
 * visible resource supportEvidence). Kind existence alone is not enough.
 */
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
          isResourceShiShen(item.shiShen) &&
          isEligibleSlot(item.slot, hourUnknown) &&
          (ref.slot === undefined || item.slot === ref.slot),
      );
      if (supportItem?.presence === "rooted-visible") return true;
    }
  }

  return false;
}

type CorridorTrace = {
  mid: Element;
  bothLegs: boolean;
  rootedSurface: boolean;
  anyLeg: boolean;
  midWeakPresence: boolean;
  neighborsPresent: boolean;
};

function collectCorridorTraces(
  evidence: StrengthEvidence,
  observations: StrengthObservations,
): CorridorTrace[] {
  const dayElement = stemElement(evidence.dayStem);
  const hourUnknown = evidence.hourUnknown;
  const traces: CorridorTrace[] = [];

  for (const mid of ELEMENTS) {
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
    // Both legs required; M→Q rooted via mq chain OR rooted-visible generation-support evidence.
    const rootedSurface = bothLegs && hasRootedVisible(pm) && mqRooted;
    const anyLeg = pm.length > 0 || mq.length > 0 || supportMq;
    const midWeakPresence = hasWeakMidPresence(observations, mid, hourUnknown);
    const neighborsPresent =
      elementPresentInClusters(observations, parent, hourUnknown) ||
      elementPresentInClusters(observations, child, hourUnknown);

    if (bothLegs || anyLeg || midWeakPresence) {
      traces.push({
        mid,
        bothLegs,
        rootedSurface,
        anyLeg,
        midWeakPresence,
        neighborsPresent,
      });
    }
  }

  return traces;
}

function hasWorkingConnectionC(traces: CorridorTrace[]): boolean {
  return traces.some((trace) => trace.rootedSurface);
}

function hasConnectionRoleTrace(traces: CorridorTrace[]): boolean {
  return traces.some((trace) => {
    if (trace.anyLeg) return true;
    // structural/hidden mid only when a corridor neighbor is also present
    return trace.midWeakPresence && trace.neighborsPresent;
  });
}

/**
 * Derives R5 Role Activity (A/B/C) from general P→M→Q generation corridors.
 * Unrelated single-leg element-generates and bare presence alone do not yield C.
 */
export function deriveR5RoleActivity(input: DeriveR5RoleActivityInput): RoleActivity {
  const evidence = input.evidence ?? collectStrengthEvidence(input.pillars);
  const observations =
    input.observations ?? buildStrengthObservations(input.pillars, evidence);

  const traces = collectCorridorTraces(evidence, observations);

  if (hasWorkingConnectionC(traces)) {
    return "C";
  }

  if (hasConnectionRoleTrace(traces)) {
    return "B";
  }

  return "A";
}
