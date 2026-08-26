import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { buildNeedCandidateSet } from "@/lib/saju/elements/needCandidates";
import { buildStrengthSummary } from "@/lib/saju/elements/strengthSummary";
import type {
  AdjustedClimateSummary,
  Element,
  FourPillars,
  NeedCandidate,
  NeedCandidateSet,
  NeedCompetingElementsByAxis,
  NeedCounterSignal,
  NeedDecisionBlocker,
  NeedElementState,
  NeedPolicyGap,
  NeedRelationPattern,
  NeedResolution,
  NeedResolutionStatus,
  NeedSupportedElement,
  StrengthSummary,
} from "@/lib/saju/types";

const STATUS_BY_PATTERN: Record<NeedRelationPattern, NeedResolutionStatus> = {
  "no-candidates": "indeterminate",
  "strength-only": "single-axis",
  "climate-only": "single-axis",
  "exact-overlap": "convergent",
  "partial-overlap": "convergent",
  disjoint: "competing",
};

function isActive(candidate: NeedCandidate): boolean {
  return candidate.status === "candidate";
}

function effectiveNeedSetForStrengthGate(
  needSet: NeedCandidateSet,
  strength: StrengthSummary,
): NeedCandidateSet {
  if (strength.directionSensitivity !== "hour-unknown-provisional") return needSet;
  return {
    ...needSet,
    strengthNeedCandidates: [],
    strengthNeedStatus: "unresolved",
  };
}

function uniqueElements(candidates: NeedCandidate[]): Set<Element> {
  return new Set(candidates.map((item) => item.element));
}

function ofElements(candidates: NeedCandidate[], elements: Set<Element>): NeedCandidate[] {
  return candidates.filter((item) => elements.has(item.element));
}

function setEqual(left: Set<Element>, right: Set<Element>): boolean {
  if (left.size !== right.size) return false;
  for (const item of left) {
    if (!right.has(item)) return false;
  }
  return true;
}

function relationPatternOf(strengthActive: Set<Element>, climateActive: Set<Element>): NeedRelationPattern {
  if (strengthActive.size === 0 && climateActive.size === 0) return "no-candidates";
  if (strengthActive.size > 0 && climateActive.size === 0) return "strength-only";
  if (strengthActive.size === 0 && climateActive.size > 0) return "climate-only";
  const shared = [...strengthActive].filter((element) => climateActive.has(element));
  if (shared.length === 0) return "disjoint";
  if (setEqual(strengthActive, climateActive)) return "exact-overlap";
  return "partial-overlap";
}

function policyGapsOf(): NeedPolicyGap[] {
  return [];
}

function hasThreeWayUnranked(strengthActive: NeedCandidate[]): boolean {
  const directions = new Set(strengthActive.map((item) => item.direction));
  return directions.has("output") && directions.has("wealth") && directions.has("official");
}

function decisionBlockedByOf(input: {
  relationPattern: NeedRelationPattern;
  needSet: NeedCandidateSet;
  climateActive: NeedCandidate[];
  strengthActive: NeedCandidate[];
  strengthOnly: NeedCandidate[];
}): NeedDecisionBlocker[] {
  const blocked: NeedDecisionBlocker[] = [];

  if (input.needSet.strengthNeedStatus === "unresolved") blocked.push("strength-axis-unresolved");
  if (input.needSet.climateNeedStatus === "axis-unresolved" || input.needSet.climateNeedStatus === "unresolved") {
    blocked.push("climate-axis-unresolved");
  }
  if (input.needSet.climateNeedStatus === "ready" && input.climateActive.length === 0) {
    blocked.push("no-active-climate-need");
  }
  if (input.relationPattern === "partial-overlap" && input.strengthOnly.length > 0) {
    blocked.push("deferred-strength-only-element");
  }
  if (input.relationPattern === "disjoint") blocked.push("competing-axes");
  if (input.relationPattern === "strength-only" && hasThreeWayUnranked(input.strengthActive)) {
    blocked.push("strength-three-way-unranked");
  }
  if (input.climateActive.some((item) => item.boundary === "contested-inherited")) {
    blocked.push("climate-need-contested-inherited");
  }
  return blocked;
}

function supportedElementsOf(
  shared: Element[],
  strengthActive: NeedCandidate[],
  climateActive: NeedCandidate[],
): NeedSupportedElement[] {
  return shared.map((element) => ({
    element,
    supports: [
      ...strengthActive.filter((item) => item.element === element),
      ...climateActive.filter((item) => item.element === element),
    ],
  }));
}

function elementStatesOf(candidates: NeedCandidate[], reasons: string[]): NeedElementState[] {
  const byElement = new Map<Element, NeedElementState>();
  for (const candidate of candidates) {
    const current = byElement.get(candidate.element);
    if (!current) {
      byElement.set(candidate.element, {
        element: candidate.element,
        existingPresence: candidate.existingPresence,
        alreadyPresent: candidate.alreadyPresent,
      });
      continue;
    }
    if (current.existingPresence !== candidate.existingPresence || current.alreadyPresent !== candidate.alreadyPresent) {
      reasons.push(`existing-presence-mismatch:${candidate.element}`);
    }
  }
  return [...byElement.values()];
}

function counterSignalsOf(suppressedShared: NeedCandidate[]): NeedCounterSignal[] {
  return suppressedShared.map((candidate) => ({
    element: candidate.element,
    source: candidate.source,
    reason: candidate.reasons.includes("already-established-relation")
      ? "already-established-relation"
      : (candidate.reasons[0] ?? "suppressed"),
  }));
}

export function resolveNeedCandidates(
  needSet: NeedCandidateSet,
  strength: StrengthSummary,
  climate: AdjustedClimateSummary,
): NeedResolution {
  const gatedNeedSet = effectiveNeedSetForStrengthGate(needSet, strength);
  const originalStrengthCandidates = [...gatedNeedSet.strengthNeedCandidates];
  const originalClimateCandidates = [...gatedNeedSet.climateNeedCandidates];

  const strengthActive = originalStrengthCandidates.filter(isActive);
  const strengthSuppressed = originalStrengthCandidates.filter((item) => item.status === "suppressed");
  const climateActive = originalClimateCandidates.filter(isActive);

  const strengthActiveElements = uniqueElements(strengthActive);
  const climateActiveElements = uniqueElements(climateActive);
  const strengthSuppressedElements = uniqueElements(strengthSuppressed);

  const relationPattern = relationPatternOf(strengthActiveElements, climateActiveElements);
  const status = STATUS_BY_PATTERN[relationPattern];

  const sharedElements = [...strengthActiveElements].filter((element) => climateActiveElements.has(element));
  const strengthOnlyElements = strengthActive.filter((item) => !climateActiveElements.has(item.element));
  const climateOnlyElements = climateActive.filter(
    (item) => !strengthActiveElements.has(item.element) && !strengthSuppressedElements.has(item.element),
  );
  const suppressedSharedCandidates = strengthSuppressed.filter((item) => climateActiveElements.has(item.element));
  const suppressedSharedElements = [...uniqueElements(suppressedSharedCandidates)];

  const supportedElements =
    status === "convergent" ? supportedElementsOf(sharedElements, strengthActive, climateActive) : [];

  const singleAxisElements =
    relationPattern === "strength-only"
      ? [...strengthActive]
      : relationPattern === "climate-only"
        ? [...climateActive]
        : [];

  const competingElementsByAxis: NeedCompetingElementsByAxis =
    status === "competing"
      ? { strength: [...strengthActive], climate: [...climateActive] }
      : { strength: [], climate: [] };

  const deferredElements =
    relationPattern === "partial-overlap" ? [...strengthOnlyElements, ...climateOnlyElements] : [];

  const policyGaps = policyGapsOf();
  const decisionBlockedBy = decisionBlockedByOf({
    relationPattern,
    needSet: gatedNeedSet,
    climateActive,
    strengthActive,
    strengthOnly: strengthOnlyElements,
  });

  const reasons: string[] = [
    `relation-pattern=${relationPattern}`,
    `status=${status}`,
    ...policyGaps.map((gap) => `policy-gap=${gap}`),
    ...decisionBlockedBy.map((item) => `blocked-by=${item}`),
  ];

  const elementStates = elementStatesOf(
    [...originalStrengthCandidates, ...originalClimateCandidates],
    reasons,
  );

  return {
    status,
    relationPattern,
    supportedElements,
    singleAxisElements,
    strengthOnlyElements,
    climateOnlyElements,
    competingElementsByAxis,
    deferredElements,
    suppressedSharedElements,
    counterSignals: [
      ...counterSignalsOf(suppressedSharedCandidates),
      ...gatedNeedSet.climateCounterSignals.map((signal) => ({
        element: signal.element,
        source: "climate" as const,
        reason: signal.reason,
      })),
    ],
    elementStates,
    strengthAxisStatus: gatedNeedSet.strengthNeedStatus,
    climateAxisStatus: gatedNeedSet.climateNeedStatus,
    certainty: {
      strength: strength.certainty,
      climate: climate.certainty,
    },
    policyGaps,
    decisionBlockedBy,
    reasons,
    originalStrengthCandidates,
    originalClimateCandidates,
  };
}

export function buildNeedResolution(pillars: FourPillars): NeedResolution {
  return resolveNeedCandidates(
    buildNeedCandidateSet(pillars),
    buildStrengthSummary(pillars),
    buildAdjustedClimateSummary(pillars),
  );
}