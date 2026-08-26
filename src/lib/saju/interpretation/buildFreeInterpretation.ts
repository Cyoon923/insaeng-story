import type { Element, MixedStrengthPattern, NeedResolution } from "@/lib/saju/types";
import type { SpeakableTheme } from "@/lib/saju/speakable/types";
import type {
  FreeDirectionItem,
  FreeInterpretation,
  FreeInterpretationInput,
} from "@/lib/saju/interpretation/types";

const HEADLINE_FALLBACK = "지금은 한쪽으로 단정하기보다, 여러 가능성을 가볍게 살펴보면 좋아요.";

const HEADLINE_LEANING_STRONG = "스스로 밀고 나가는 힘이 비교적 강하게 보일 수 있어요.";
const HEADLINE_LEANING_WEAK =
  "혼자 밀어붙이기보다 도움을 받으며 힘을 채우는 쪽이 더 편할 수 있어요.";
/** directionCandidate=null — evidence insufficient; do not reuse mixed “coexistence” copy. */
const HEADLINE_NULL =
  "지금 확인되는 관계만으로는 어느 한쪽 흐름이라고 정하기 어려워요.";
/** mixed fallback when pattern is missing (should not happen for direction=mixed). */
const HEADLINE_MIXED_DEFAULT =
  "서로 다른 힘이 함께 작용해 한쪽 흐름만으로 설명하기 어려워요.";

/**
 * Deterministic mixedPattern → headline. Pattern ids never shown to users.
 * Soft coexistence wording only — no ranking, needed-element, or new judgment.
 */
const MIXED_PATTERN_HEADLINES: Record<MixedStrengthPattern, string> = {
  "strong-base-with-pressure":
    "힘이 자리한 바탕 위에도 다른 기운이 함께 작용해 한쪽 흐름만으로 설명하기 어려워요.",
  "weak-season-with-support":
    "힘이 덜한 계절감 속에서도 돕는 기운이 함께 보여 한쪽 흐름만으로 설명하기 어려워요.",
  "weak-season-root-under-pressure":
    "힘이 덜한 계절감 속에서 다른 기운의 압박도 함께 보여 한쪽 흐름만으로 설명하기 어려워요.",
  "shallow-root-under-pressure":
    "뿌리가 얕은 가운데 다른 기운의 압박이 함께 보여 한쪽 흐름만으로 설명하기 어려워요.",
  "help-season-absent-root":
    "돕는 계절감은 보이지만 뿌리 기운이 약해 한쪽 흐름만으로 설명하기 어려워요.",
  "neutral-season-conflict":
    "계절감이 한쪽으로 기울지 않은 가운데 서로 다른 힘이 함께 작용해요.",
  "other-mixed": HEADLINE_MIXED_DEFAULT,
};

const ELEMENT_SOFT: Record<Element, string> = {
  木: "나무",
  火: "불",
  土: "흙",
  金: "쇠",
  水: "물",
};

function uniqueStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function mixedHeadlineOf(pattern: MixedStrengthPattern | null): string {
  if (pattern == null) return HEADLINE_MIXED_DEFAULT;
  return MIXED_PATTERN_HEADLINES[pattern];
}

function rewriteObservationHeadline(
  theme: SpeakableTheme,
  mixedPattern: MixedStrengthPattern | null,
): string {
  if (theme.id.includes("leaning-strong")) {
    return HEADLINE_LEANING_STRONG;
  }
  if (theme.id.includes("leaning-weak")) {
    return HEADLINE_LEANING_WEAK;
  }
  if (theme.id.includes("obs-strength-mixed") || theme.id.endsWith("-mixed")) {
    return mixedHeadlineOf(mixedPattern);
  }
  if (theme.id.includes("obs-strength-null") || theme.id.endsWith("-null")) {
    return HEADLINE_NULL;
  }
  return theme.phrase
    .replaceAll("이야기·가사에서는 ", "")
    .replaceAll("시간이 확실해지면 달라질 수 있는 잠정 관찰이에요. ", "");
}

/** Merge climate observations into at most one short natural sentence. */
function buildClimateExplanation(themes: SpeakableTheme[]): string | null {
  const kinds = new Set<string>();
  for (const theme of themes) {
    if (theme.kind !== "climate-observation") continue;
    if (theme.id.includes("cold")) kinds.add("cold");
    if (theme.id.includes("warm")) kinds.add("warm");
    if (theme.id.includes("dry")) kinds.add("dry");
  }
  if (kinds.size === 0) return null;

  if (kinds.has("warm") && kinds.has("dry")) {
    return "따뜻하고 메마른 성향이 함께 보일 수 있어요.";
  }
  if (kinds.has("cold") && kinds.has("dry")) {
    return "서늘하고 메마른 성향이 함께 보일 수 있어요.";
  }
  if (kinds.has("cold")) return "차분하고 서늘한 성향이 보일 수 있어요.";
  if (kinds.has("warm")) return "따뜻한 성향이 보일 수 있어요.";
  if (kinds.has("dry")) return "메마른 성향이 보일 수 있어요.";
  return null;
}

function buildHeadline(input: FreeInterpretationInput): string {
  const first = input.speakable.observationThemes[0];
  if (!first) return HEADLINE_FALLBACK;

  const direction = input.strength.directionCandidate;
  if (direction === "leaning-strong") return HEADLINE_LEANING_STRONG;
  if (direction === "leaning-weak") return HEADLINE_LEANING_WEAK;
  if (direction === "mixed") return mixedHeadlineOf(input.strength.mixedPattern);
  if (direction === null) return HEADLINE_NULL;

  return rewriteObservationHeadline(first, input.strength.mixedPattern);
}

/** Only real extra observations; no filler. Null when empty. Max two sentences. */
function buildExplanation(input: FreeInterpretationInput, headline: string): string | null {
  const parts: string[] = [];
  const observations = input.speakable.observationThemes;
  const mixedPattern = input.strength.mixedPattern;

  for (let i = 0; i < observations.length; i += 1) {
    if (i === 0) continue;
    const rewritten = rewriteObservationHeadline(observations[i], mixedPattern);
    if (rewritten && rewritten !== headline) parts.push(rewritten);
  }

  const climatePart = buildClimateExplanation(input.speakable.climateThemes);
  if (climatePart) parts.push(climatePart);

  const outcomes = new Set([input.climate.temperature.outcome, input.climate.moisture.outcome]);
  if (outcomes.has("partially-mitigated")) {
    parts.push("한쪽이 강하게 보이지만, 이를 부드럽게 만드는 기운도 함께 보여요.");
  }
  if (outcomes.has("mitigation-reinforcement-conflict")) {
    parts.push("서로 다른 기운이 함께 보여 한쪽으로 단정하기 어려워요.");
  }

  const unique = uniqueStrings(parts).filter((part) => part !== headline);
  if (unique.length === 0) return null;
  return unique.slice(0, 2).join(" ");
}

function strengthSupportText(theme: SpeakableTheme, stance: FreeDirectionItem["stance"]): string {
  if (theme.id.includes("peer")) {
    return stance === "held-aside"
      ? "주변의 도움을 받는 방향도 보이지만, 지금은 참고 후보로만 봐요."
      : "주변과 기대며 도움을 주고받는 방향을 후보로 볼 수 있어요.";
  }
  if (theme.id.includes("resource")) {
    return stance === "held-aside"
      ? "쉬며 힘을 채우는 방향도 보이지만, 지금은 참고 후보로만 봐요."
      : "쉬면서 힘을 채우고 회복하는 방향을 후보로 볼 수 있어요.";
  }
  return stance === "held-aside"
    ? "함께 보이는 방향도 있지만, 지금은 참고 후보로만 봐요."
    : "참고해 볼 수 있는 방향을 후보로 볼 수 있어요.";
}

function deferredElementsOf(resolution: NeedResolution): Set<Element> {
  return new Set(resolution.deferredElements.map((item) => item.element));
}

function buildSupportItems(input: FreeInterpretationInput): FreeDirectionItem[] {
  const deferred = deferredElementsOf(input.needResolution);
  const items: FreeDirectionItem[] = [];

  for (const theme of input.speakable.supportThemes) {
    if (theme.kind !== "need-strength-candidate") continue;
    const elements = theme.elements ?? [];
    if (elements.length === 0) {
      items.push({
        text: strengthSupportText(theme, "open-candidate"),
        stance: "open-candidate",
        origin: "strength-support",
      });
      continue;
    }
    for (const element of elements) {
      const stance = deferred.has(element) ? "held-aside" : "open-candidate";
      items.push({
        text: strengthSupportText(theme, stance),
        element,
        stance,
        origin: "strength-support",
      });
    }
  }

  return items;
}

function cautionText(theme: SpeakableTheme): string {
  if (theme.id.includes("output")) {
    return "에너지를 밖으로 표현하고 펼치는 쪽을 살펴볼 수 있어요.";
  }
  if (theme.id.includes("wealth")) {
    return "안정적으로 정리하고 현실에 적용하는 쪽을 살펴볼 수 있어요.";
  }
  if (theme.id.includes("official")) {
    return "기준을 세우고 정리하는 쪽을 살펴볼 수 있어요.";
  }
  return "한쪽으로만 치우치지 않고 균형 있게 살펴볼 수 있어요.";
}

function buildCautionItems(input: FreeInterpretationInput): FreeDirectionItem[] {
  const items: FreeDirectionItem[] = [];
  for (const theme of input.speakable.cautionThemes) {
    const elements = theme.elements ?? [];
    if (elements.length === 0) {
      items.push({
        text: cautionText(theme),
        stance: "open-candidate",
        origin: "strength-caution",
      });
      continue;
    }
    for (const element of elements) {
      items.push({
        text: cautionText(theme),
        element,
        stance: "open-candidate",
        origin: "strength-caution",
      });
    }
  }
  return items;
}

function climateCandidateContested(input: FreeInterpretationInput, element: Element): boolean {
  return input.needCandidates.climateNeedCandidates.some(
    (candidate) =>
      candidate.element === element &&
      candidate.status === "candidate" &&
      candidate.boundary === "contested-inherited",
  );
}

function strengthNeedOpen(input: FreeInterpretationInput): boolean {
  return (
    input.needCandidates.strengthNeedStatus === "ready" &&
    input.needCandidates.strengthNeedCandidates.some((item) => item.status === "candidate")
  );
}

function climateCandidateText(
  theme: SpeakableTheme,
  stance: FreeDirectionItem["stance"],
  element?: Element,
): string {
  const soft = element ? `${ELEMENT_SOFT[element]}(${element})` : null;
  let base: string;
  if (theme.id.includes("climate-moisture-dry") && soft) {
    base = `메마른 성향을 볼 때 ${soft}의 부드럽고 유연한 성질을 참고해 볼 수 있어요.`;
  } else if (theme.id.includes("climate-temperature-cold") && soft) {
    base = `서늘한 성향을 볼 때 ${soft}의 따뜻하고 활기찬 성질을 참고해 볼 수 있어요.`;
  } else if (theme.id.includes("climate-temperature-warm") && soft) {
    base = `따뜻한 성향을 볼 때 ${soft}의 차분하고 식혀 주는 성질을 참고해 볼 수 있어요.`;
  } else {
    base = soft
      ? `${soft}의 성질을 환경적인 관찰에서 참고해 볼 수 있어요.`
      : "환경적인 관찰에서 참고해 볼 수 있어요.";
  }

  if (stance === "tentative" || stance === "context-only") {
    return `${base} 꼭 필요한 기운으로 정한 것은 아니에요.`;
  }
  return base;
}

function buildClimateNotes(input: FreeInterpretationInput): FreeDirectionItem[] {
  const items: FreeDirectionItem[] = [];
  const strengthOpen = strengthNeedOpen(input);

  for (const theme of input.speakable.climateThemes) {
    if (theme.kind !== "need-climate-candidate") continue;
    const elements = theme.elements ?? [];
    const targets = elements.length > 0 ? elements : [undefined];

    for (const element of targets) {
      const contested = element ? climateCandidateContested(input, element) : false;
      const climateOnly = !strengthOpen;
      const stance = contested ? "tentative" : climateOnly ? "context-only" : "open-candidate";
      items.push({
        text: climateCandidateText(theme, stance, element),
        ...(element ? { element } : {}),
        stance,
        origin: "climate-context",
      });
    }
  }

  return items;
}

const CONFLICT_UNCERTAINTY =
  "서로 다른 기운이 함께 보여 한쪽으로 단정하기 어려워요.";
const PARTIAL_UNCERTAINTY =
  "누그러뜨리는 흐름은 있지만 아직 어느 정도인지는 단정하기 어려워요.";

function buildUncertaintyNotes(
  input: FreeInterpretationInput,
  explanation: string | null,
): string[] {
  const notes: string[] = [];

  if (input.speakable.hourUnknown) {
    notes.push("태어난 시간을 알면 해석이 달라질 수 있어요.");
  }

  const hasContestedClimate = input.needCandidates.climateNeedCandidates.some(
    (item) => item.status === "candidate" && item.boundary === "contested-inherited",
  );
  if (hasContestedClimate) {
    notes.push("이 부분은 참고 정도로 가볍게 봐 주세요.");
  }

  if (input.needResolution.decisionBlockedBy.length > 0) {
    notes.push("지금 단계에서는 하나로 단정하지 않고 여러 가능성을 함께 봐요.");
  }

  // mixed/null direction is already stated in headline — do not repeat in uncertaintyNotes.
  const outcomes = [input.climate.temperature.outcome, input.climate.moisture.outcome];
  if (outcomes.includes("partially-mitigated")) {
    notes.push(PARTIAL_UNCERTAINTY);
  }
  if (outcomes.includes("mitigation-reinforcement-conflict")) {
    // Keep conflict meaning, but do not echo explanation.
    if (!explanation?.includes(CONFLICT_UNCERTAINTY)) {
      notes.push(CONFLICT_UNCERTAINTY);
    }
  }

  return uniqueStrings(notes);
}

/**
 * Maps Speakable + engine summaries into free-v1 user copy.
 * Preserves supported / deferred / contested / climate-only stance. No re-judgment.
 */
export function buildFreeInterpretation(input: FreeInterpretationInput): FreeInterpretation {
  const headline = buildHeadline(input);
  const explanation = buildExplanation(input, headline);
  return {
    headline,
    explanation,
    supportItems: buildSupportItems(input),
    cautionItems: buildCautionItems(input),
    climateNotes: buildClimateNotes(input),
    uncertaintyNotes: buildUncertaintyNotes(input, explanation),
  };
}
