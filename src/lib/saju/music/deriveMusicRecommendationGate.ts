import type { FreeInterpretation } from "@/lib/saju/interpretation/types";
import type {
  MusicRecommendationElementMode,
  MusicRecommendationGate,
  MusicRecommendationState,
} from "@/lib/saju/music/types";
import type { SpeakableOutput } from "@/lib/saju/speakable/types";
import type { Element, NeedCandidate, NeedResolution } from "@/lib/saju/types";

export type DeriveMusicRecommendationGateInput = {
  needResolution: NeedResolution;
  /** Preferred for open-candidate / tentative / context-only checks. */
  freeInterpretation?: FreeInterpretation;
  /** Optional; used for hour flags and as climate bag fallback. */
  speakable?: SpeakableOutput;
  /** Explicit hour flags when Speakable is omitted. */
  hourUnknown?: boolean;
  hourUnknownProvisional?: boolean;
};

function uniqueElements(elements: Element[]): Element[] {
  const seen = new Set<Element>();
  const out: Element[] = [];
  for (const element of elements) {
    if (seen.has(element)) continue;
    seen.add(element);
    out.push(element);
  }
  return out;
}

function supportedElementList(need: NeedResolution): Element[] {
  return uniqueElements(need.supportedElements.map((item) => item.element));
}

function candidateHasContested(candidate: NeedCandidate): boolean {
  return candidate.boundary === "contested-inherited";
}

function needHasContested(need: NeedResolution): boolean {
  if (need.decisionBlockedBy.includes("climate-need-contested-inherited")) return true;
  const pools: NeedCandidate[][] = [
    need.climateOnlyElements,
    need.singleAxisElements,
    need.strengthOnlyElements,
    need.deferredElements,
    need.competingElementsByAxis.strength,
    need.competingElementsByAxis.climate,
    ...need.supportedElements.map((item) => item.supports),
  ];
  return pools.some((pool) => pool.some(candidateHasContested));
}

function hasCompetingOrIndeterminate(need: NeedResolution): boolean {
  return (
    need.status === "competing" ||
    need.status === "indeterminate" ||
    need.decisionBlockedBy.includes("competing-axes") ||
    need.decisionBlockedBy.includes("strength-three-way-unranked")
  );
}

function hasHardBlockers(need: NeedResolution): boolean {
  if (need.decisionBlockedBy.length === 0) return false;
  // strength-axis-unresolved alone is common with climate-only CONTEXTUAL; not a hard HOLD.
  const softAlone = new Set<string>(["strength-axis-unresolved", "no-active-climate-need"]);
  return need.decisionBlockedBy.some((blocker) => !softAlone.has(blocker));
}

function resolveHourFlags(input: DeriveMusicRecommendationGateInput): {
  hourUnknown: boolean;
  hourUnknownProvisional: boolean;
} {
  return {
    hourUnknown: input.hourUnknown ?? input.speakable?.hourUnknown ?? false,
    hourUnknownProvisional:
      input.hourUnknownProvisional ?? input.speakable?.hourUnknownProvisional ?? false,
  };
}

function hasOpenCandidateSupport(
  free: FreeInterpretation | undefined,
  supported: Element[],
): boolean {
  if (supported.length === 0) return false;
  if (!free) {
    // Need supportedElements already passed resolution — treat as open-candidate-equivalent.
    return true;
  }
  const open = new Set(
    free.supportItems
      .filter((item) => item.stance === "open-candidate" && item.element)
      .map((item) => item.element!),
  );
  return supported.some((element) => open.has(element));
}

function collectContextualElements(
  need: NeedResolution,
  free: FreeInterpretation | undefined,
  speakable: SpeakableOutput | undefined,
): Element[] {
  const fromNeed = need.climateOnlyElements.map((item) => item.element);
  const fromFree =
    free?.climateNotes
      .filter(
        (item) =>
          item.element &&
          (item.stance === "tentative" || item.stance === "context-only"),
      )
      .map((item) => item.element!) ?? [];
  const fromBag = speakable?.musicRecommendationHints.elementThemeBag ?? [];
  // Never pull deferred / caution / Observation. Bag is soft context only when climate path.
  return uniqueElements([...fromNeed, ...fromFree, ...fromBag]);
}

function hasContextualSignal(
  need: NeedResolution,
  free: FreeInterpretation | undefined,
  contextualElements: Element[],
): boolean {
  if (need.relationPattern === "climate-only") return true;
  if (need.climateOnlyElements.length > 0) return true;
  if (contextualElements.length > 0) return true;
  if (
    free?.climateNotes.some(
      (item) => item.stance === "tentative" || item.stance === "context-only",
    )
  ) {
    return true;
  }
  return false;
}

function isCertaintyPartial(need: NeedResolution): boolean {
  return need.certainty.strength === "partial" || need.certainty.climate === "partial";
}

function gate(
  state: MusicRecommendationState,
  elementMode: MusicRecommendationElementMode,
  supportedElements: Element[],
  contextualElements: Element[],
  reasons: string[],
): MusicRecommendationGate {
  return {
    state,
    elementMode,
    supportedElements,
    contextualElements: state === "HOLD" || elementMode === "off" ? [] : contextualElements,
    reasons,
  };
}

/**
 * Derive music recommendation gate from Need + Free/Speakable.
 * Does not select songs, invent scores, or read ObservationInterpretation.
 */
export function deriveMusicRecommendationGate(
  input: DeriveMusicRecommendationGateInput,
): MusicRecommendationGate {
  const need = input.needResolution;
  const free = input.freeInterpretation;
  const { hourUnknown, hourUnknownProvisional } = resolveHourFlags(input);

  const supportedElements = supportedElementList(need);
  const deferredOnly =
    supportedElements.length === 0 && need.deferredElements.length > 0;
  const contested = needHasContested(need);
  const contextualElements = collectContextualElements(need, free, input.speakable);
  const contextualSignal = hasContextualSignal(need, free, contextualElements);
  const openCandidateOk = hasOpenCandidateSupport(free, supportedElements);

  // 1) Competing / indeterminate → HOLD
  if (hasCompetingOrIndeterminate(need)) {
    return gate("HOLD", "off", [], [], [
      "status-competing-or-indeterminate",
      ...(deferredOnly ? ["deferred-only-not-supported"] : []),
    ]);
  }

  // 2) DIRECT
  if (
    supportedElements.length >= 1 &&
    need.decisionBlockedBy.length === 0 &&
    !contested &&
    !hourUnknown &&
    !hourUnknownProvisional &&
    !isCertaintyPartial(need) &&
    openCandidateOk
  ) {
    return gate("DIRECT", "supported-soft", supportedElements, [], [
      "supported-ready",
      "no-blockers",
      "open-candidate-ok",
    ]);
  }

  // 3) Contested / hard blockers with supported → never PROVISIONAL; HOLD
  if (
    supportedElements.length >= 1 &&
    (contested || hasHardBlockers(need) || need.decisionBlockedBy.includes("competing-axes"))
  ) {
    return gate("HOLD", "off", [], [], [
      "supported-present-but-blocked",
      ...(contested ? ["contested-inherited"] : []),
      ...need.decisionBlockedBy.map((blocker) => `blocker:${blocker}`),
    ]);
  }

  // 4) PROVISIONAL — supported + provisional hour/certainty, no contested/competing
  if (
    supportedElements.length >= 1 &&
    !contested &&
    !hasCompetingOrIndeterminate(need) &&
    openCandidateOk &&
    (hourUnknown || hourUnknownProvisional || isCertaintyPartial(need))
  ) {
    return gate("PROVISIONAL", "supported-soft", supportedElements, [], [
      "supported-with-provisional-flags",
      ...(hourUnknown || hourUnknownProvisional ? ["hour-unknown-or-provisional"] : []),
      ...(isCertaintyPartial(need) ? ["certainty-partial"] : []),
    ]);
  }

  // 5) CONTEXTUAL — no supported; climate / tentative context exists (incl. contested climate-only)
  if (supportedElements.length === 0 && contextualSignal) {
    return gate("CONTEXTUAL", "context-soft", [], contextualElements, [
      "no-supported-elements",
      "climate-or-context-signal",
      ...(contested ? ["contested-climate-kept-contextual"] : []),
      ...(deferredOnly ? ["deferred-not-promoted"] : []),
      "element-mode-context-soft",
    ]);
  }

  // 6) deferred-only or empty grounds → HOLD
  const reasons = ["insufficient-recommendation-grounds"];
  if (deferredOnly) reasons.push("deferred-only-not-supported");
  if (supportedElements.length === 0) reasons.push("no-supported-elements");
  if (!contextualSignal) reasons.push("no-contextual-signal");

  return gate("HOLD", "off", [], [], reasons);
}
