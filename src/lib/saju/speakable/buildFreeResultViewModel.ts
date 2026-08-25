import { ELEMENTS, type Element, type ElementPresenceAnalysis, type ElementPresenceKind } from "@/lib/saju/types";
import type { SpeakableOutput, SpeakableTheme } from "@/lib/saju/speakable/types";

const HEADLINE_FALLBACK = "지금은 한쪽으로 단정하지 않아요.";

const PRESENCE_LABEL: Record<ElementPresenceKind, string> = {
  "rooted-visible": "뚜렷",
  "unrooted-visible": "드러남·뿌리 약함",
  "hidden-only": "숨음",
  absent: "없음",
};

export type FreeResultBalanceItem = {
  element: Element;
  presence: ElementPresenceKind;
  label: string;
};

export type FreeResultComplementSource = "strength-support" | "strength-caution" | "climate";

/** Unranked complement chip. No score / rank / winner. */
export type FreeResultComplementChip = {
  element: Element;
  source: FreeResultComplementSource;
  provisional: true;
};

export type FreeResultViewModel = {
  headline: string;
  balance: FreeResultBalanceItem[];
  complementChips: FreeResultComplementChip[];
  cautions: string[];
};

export type FreeResultPresenceInput =
  | ReadonlyArray<ElementPresenceAnalysis>
  | Record<Element, ElementPresenceAnalysis>;

function presenceList(input: FreeResultPresenceInput): ElementPresenceAnalysis[] {
  if (Array.isArray(input)) return [...input];
  return ELEMENTS.map((element) => input[element]);
}

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

function collectThemeElements(themes: SpeakableTheme[]): Element[] {
  const out: Element[] = [];
  for (const theme of themes) {
    if (!theme.elements) continue;
    out.push(...theme.elements);
  }
  return out;
}

function buildBalance(presence: FreeResultPresenceInput): FreeResultBalanceItem[] {
  const byElement = new Map(presenceList(presence).map((item) => [item.element, item]));
  return ELEMENTS.map((element) => {
    const analysis = byElement.get(element);
    const kind = analysis?.presence ?? "absent";
    return {
      element,
      presence: kind,
      label: PRESENCE_LABEL[kind],
    };
  });
}

function buildComplementChips(speakable: SpeakableOutput): FreeResultComplementChip[] {
  const excludeStrength = speakable.hourUnknown || speakable.hourUnknownProvisional;
  const chips: FreeResultComplementChip[] = [];
  const seen = new Set<Element>();

  const push = (element: Element, source: FreeResultComplementSource) => {
    if (seen.has(element)) return;
    seen.add(element);
    chips.push({ element, source, provisional: true });
  };

  if (!excludeStrength) {
    for (const element of uniqueElements(collectThemeElements(speakable.supportThemes))) {
      push(element, "strength-support");
    }
    // elements only — phrases go to cautions
    for (const element of uniqueElements(collectThemeElements(speakable.cautionThemes))) {
      push(element, "strength-caution");
    }
  }

  const climateNeedThemes = speakable.climateThemes.filter(
    (theme) => theme.kind === "need-climate-candidate",
  );
  for (const element of uniqueElements(collectThemeElements(climateNeedThemes))) {
    push(element, "climate");
  }

  return chips;
}

function buildCautions(speakable: SpeakableOutput): string[] {
  const phrases: string[] = [];
  const seen = new Set<string>();
  for (const theme of speakable.cautionThemes) {
    const phrase = theme.phrase.trim();
    if (!phrase || seen.has(phrase)) continue;
    seen.add(phrase);
    phrases.push(phrase);
  }
  return phrases;
}

/**
 * UI-only view model for the free result screen.
 * Does not re-judge Strength / Climate / Need. Does not use musicRecommendationHints.
 */
export function buildFreeResultViewModel(
  speakable: SpeakableOutput,
  presence: FreeResultPresenceInput,
): FreeResultViewModel {
  const first = speakable.observationThemes[0]?.phrase.trim();
  return {
    headline: first && first.length > 0 ? first : HEADLINE_FALLBACK,
    balance: buildBalance(presence),
    complementChips: buildComplementChips(speakable),
    cautions: buildCautions(speakable),
  };
}
