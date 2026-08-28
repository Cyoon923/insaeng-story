/**
 * User-facing annual (세운) presentation for free result screens.
 * Maps v2 resolution + presentation gate + natal baseline — no re-judgment.
 */

import type { SupplementPresentation } from "@/lib/saju/final/buildSupplementPresentation";
import type { AnnualPresentationGate } from "@/lib/saju/luck/annual/deriveAnnualPresentationGate";
import type { AnnualSupplementFlowV2Resolution } from "@/lib/saju/luck/annual/resolveAnnualSupplementFlowV2";
import type { Element } from "@/lib/saju/types";

export type AnnualPresentation = {
  year: number;
  status: "resolved" | "partial" | "unresolved";
  element: Element | null;
  symbol: string | null;
  name: string | null;
  keyword: string | null;
  headline: string;
  description: string;
  natalBaseline: {
    element: Element | null;
    symbol: string | null;
    name: string | null;
  } | null;
  showAnnualElement: boolean;
  showAnnualMusic: boolean;
};

export type BuildAnnualPresentationInput = {
  year: number;
  gate: AnnualPresentationGate;
  resolution: AnnualSupplementFlowV2Resolution;
  natalBalancePresentation: SupplementPresentation;
};

type ElementCopy = {
  symbol: string;
  name: string;
  keyword: string;
};

/** Same element copy as buildSupplementPresentation (symbol / name / keyword). */
const ELEMENT_COPY: Record<Element, ElementCopy> = {
  木: {
    symbol: "🌱",
    name: "나무",
    keyword: "성장하고, 시작하고, 방향을 만드는 힘",
  },
  火: {
    symbol: "🔥",
    name: "불",
    keyword: "표현하고, 움직이고, 활력을 만드는 힘",
  },
  土: {
    symbol: "🪨",
    name: "흙",
    keyword: "중심을 잡고, 안정시키고, 받쳐 주는 힘",
  },
  金: {
    symbol: "✨",
    name: "금",
    keyword: "정리하고, 기준을 세우고, 결단하는 힘",
  },
  水: {
    symbol: "💧",
    name: "물",
    keyword: "흐르고, 식히고, 여유를 만드는 힘",
  },
};

const SHOW_DESCRIPTION =
  "올해의 흐름을 기준으로 지금 보강하면 좋은 방향을 살펴봤어요.";

const BLOCKED_PARTIAL_HEADLINE =
  "2026년의 흐름을 한 가지 방향으로만 설명하기는 어려워요.";

const BLOCKED_UNRESOLVED_HEADLINE =
  "현재 정보로는 2026년 보강 방향을 한 가지로 정하기 어려워요.";

const BLOCKED_PARTIAL_DESCRIPTION =
  "한 가지 기운으로 단정하기보다 여러 흐름의 균형을 함께 살펴보는 해예요.";

const BLOCKED_UNRESOLVED_DESCRIPTION =
  "올해의 보강 방향을 확정하기 전, 흐름을 더 살펴볼 필요가 있어요.";

/** Copula phrase for displayable headline (e.g. 물 → 물이에요, 나무 → 나무예요). */
function copulaPhrase(name: string): string {
  if (name === "나무") return "나무예요";
  if (name === "불") return "불이에요";
  if (name === "흙") return "흙이에요";
  if (name === "금") return "금이에요";
  if (name === "물") return "물이에요";
  return `${name}예요`;
}

function buildNatalBaseline(
  natal: SupplementPresentation,
): AnnualPresentation["natalBaseline"] {
  if (
    natal.supplementStatus !== "resolved" ||
    natal.element === null ||
    natal.name === null ||
    natal.symbol === null
  ) {
    return null;
  }

  return {
    element: natal.element,
    symbol: natal.symbol,
    name: natal.name,
  };
}

function hiddenAnnualFields(): Pick<
  AnnualPresentation,
  "element" | "symbol" | "name" | "keyword"
> {
  return {
    element: null,
    symbol: null,
    name: null,
    keyword: null,
  };
}

function elementPresentation(element: Element): Pick<
  AnnualPresentation,
  "element" | "symbol" | "name" | "keyword"
> {
  const copy = ELEMENT_COPY[element];
  return {
    element,
    symbol: copy.symbol,
    name: copy.name,
    keyword: copy.keyword,
  };
}

function blockedHeadline(
  year: number,
  resolution: AnnualSupplementFlowV2Resolution,
): string {
  if (resolution.status === "partial") {
    return BLOCKED_PARTIAL_HEADLINE.replace("2026", String(year));
  }
  return BLOCKED_UNRESOLVED_HEADLINE.replace("2026", String(year));
}

function blockedDescription(
  resolution: AnnualSupplementFlowV2Resolution,
): string {
  if (resolution.status === "partial") {
    return BLOCKED_PARTIAL_DESCRIPTION;
  }
  return BLOCKED_UNRESOLVED_DESCRIPTION;
}

/**
 * Build free-screen annual presentation from gate + resolution + natal baseline.
 * Display eligibility follows gate.selectionDisplayStatus — not resolution.status alone.
 */
export function buildAnnualPresentation(
  input: BuildAnnualPresentationInput,
): AnnualPresentation {
  const { year, gate, resolution, natalBalancePresentation } = input;
  const natalBaseline = buildNatalBaseline(natalBalancePresentation);

  const base = {
    year,
    status: resolution.status,
    natalBaseline,
  };

  if (
    gate.selectionDisplayStatus === "displayable" &&
    gate.presentationElement !== null
  ) {
    const copy = ELEMENT_COPY[gate.presentationElement];
    return {
      ...base,
      ...elementPresentation(gate.presentationElement),
      headline: `${year}년 보강 기운은 ${copulaPhrase(copy.name)}.`,
      description: SHOW_DESCRIPTION,
      showAnnualElement: true,
      showAnnualMusic: true,
    };
  }

  if (
    gate.selectionDisplayStatus === "displayable-partial" &&
    gate.presentationElement !== null
  ) {
    const copy = ELEMENT_COPY[gate.presentationElement];
    return {
      ...base,
      ...elementPresentation(gate.presentationElement),
      headline: `${year}년에는 ${copy.name}의 성질을 보강하는 방향이 잘 맞아요.`,
      description: SHOW_DESCRIPTION,
      showAnnualElement: true,
      showAnnualMusic: true,
    };
  }

  return {
    ...base,
    ...hiddenAnnualFields(),
    headline: blockedHeadline(year, resolution),
    description: blockedDescription(resolution),
    showAnnualElement: false,
    showAnnualMusic: false,
  };
}
