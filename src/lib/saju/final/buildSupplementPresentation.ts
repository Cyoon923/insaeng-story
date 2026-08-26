/**
 * User-facing presentation for CoreAndSupplementResolution.
 * Screen hero uses Supplement Element, not FER Core.
 */

import type {
  CoreAndSupplementResolution,
  SupplementResolutionStatus,
} from "@/lib/saju/final/types";
import type { Element } from "@/lib/saju/types";

export type SupplementPresentation = {
  /** User-facing representative element (Supplement). */
  element: Element | null;
  symbol: string | null;
  name: string | null;
  keyword: string | null;
  headline: string;
  reasonTitle: string | null;
  reasonFlow: string[];
  /** Internal meta — not the hero title element. */
  coreElement: Element | null;
  supplementStatus: SupplementResolutionStatus;
};

type ElementCopy = {
  symbol: string;
  name: string;
  keyword: string;
};

/** Same element copy as buildFinalPresentation (symbol / name / keyword). */
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

const OBJECT_PARTICLE: Record<Element, string> = {
  木: "나무를",
  火: "불을",
  土: "흙을",
  金: "금을",
  水: "물을",
};

const UNRESOLVED_HEADLINE =
  "지금 정보만으로는 보강할 기운을 하나로 정하기 어려워요.";

function unresolvedPresentation(
  resolution: CoreAndSupplementResolution,
): SupplementPresentation {
  return {
    element: null,
    symbol: null,
    name: null,
    keyword: null,
    headline: UNRESOLVED_HEADLINE,
    reasonTitle: null,
    reasonFlow: [],
    coreElement: resolution.coreElement,
    supplementStatus: "unresolved",
  };
}

function reasonFlowFor(
  core: Element,
  supplement: Element,
): [string, string, string] {
  const coreName = ELEMENT_COPY[core].name;
  const supplementName = ELEMENT_COPY[supplement].name;

  if (core === supplement) {
    return ["직접 보강", coreName, "균형"];
  }

  return [supplementName, `${OBJECT_PARTICLE[core]} 도움`, "균형"];
}

/**
 * Build user presentation from combined Core + Supplement resolution.
 * Does not re-resolve winners or expose R1–R6 / F2 / F6 terms.
 */
export function buildSupplementPresentation(
  resolution: CoreAndSupplementResolution,
): SupplementPresentation {
  const {
    coreElement,
    coreCertainty,
    supplementElement,
    supplementStatus,
  } = resolution;

  if (
    coreCertainty === "unresolved" ||
    coreElement === null ||
    supplementStatus === "unresolved" ||
    supplementElement === null
  ) {
    return unresolvedPresentation({
      ...resolution,
      supplementStatus: "unresolved",
    });
  }

  const copy = ELEMENT_COPY[supplementElement];
  return {
    element: supplementElement,
    symbol: copy.symbol,
    name: copy.name,
    keyword: copy.keyword,
    headline: `지금은 ${copy.name}의 성질을 보강하는 방향이 잘 맞아요.`,
    reasonTitle: `왜 ${copy.name}일까요?`,
    reasonFlow: [...reasonFlowFor(coreElement, supplementElement)],
    coreElement,
    supplementStatus: "resolved",
  };
}
