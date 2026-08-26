/**
 * User-facing presentation contract for FinalResolution.
 * Does not re-resolve Final, alter certainty, or expose internal FER terms.
 */

import type { Certainty, FinalResolution } from "@/lib/saju/final/types";
import type { Element } from "@/lib/saju/types";

export type FinalPresentation = {
  element: Element | null;
  symbol: string;
  name: string;
  keyword: string;
  headline: string;
  reasonTitle: string;
  /** Up to 3 short phrases for UI flow chips (e.g. 열기 → 관계 → 균형). */
  reasonFlow: string[];
  certainty: Certainty;
};

type ElementCopy = {
  symbol: string;
  name: string;
  keyword: string;
  reasonFlow: readonly [string, string, string];
};

const ELEMENT_COPY: Record<Element, ElementCopy> = {
  木: {
    symbol: "🌱",
    name: "나무",
    keyword: "성장하고, 시작하고, 방향을 만드는 힘",
    reasonFlow: ["시작", "성장", "방향"],
  },
  火: {
    symbol: "🔥",
    name: "불",
    keyword: "표현하고, 움직이고, 활력을 만드는 힘",
    reasonFlow: ["표현", "활력", "움직임"],
  },
  土: {
    symbol: "🪨",
    name: "흙",
    keyword: "중심을 잡고, 안정시키고, 받쳐 주는 힘",
    reasonFlow: ["중심", "안정", "받침"],
  },
  金: {
    symbol: "✨",
    name: "금",
    keyword: "정리하고, 기준을 세우고, 결단하는 힘",
    reasonFlow: ["정리", "기준", "결단"],
  },
  水: {
    symbol: "💧",
    name: "물",
    keyword: "흐르고, 식히고, 여유를 만드는 힘",
    reasonFlow: ["흐름", "여유", "균형"],
  },
};

const UNRESOLVED_HEADLINE = "지금 정보만으로는 한 가지 방향을 정하기 어려워요.";

function unresolvedPresentation(certainty: Certainty): FinalPresentation {
  return {
    element: null,
    symbol: "",
    name: "",
    keyword: "",
    headline: UNRESOLVED_HEADLINE,
    reasonTitle: "",
    reasonFlow: [],
    certainty,
  };
}

/**
 * Maps FinalResolution to short user-facing copy.
 * Internal roles / bottlenecks / traces are never surfaced.
 */
export function buildFinalPresentation(resolution: FinalResolution): FinalPresentation {
  const { certainty, finalElement } = resolution;

  if (certainty === "unresolved" || finalElement === null) {
    return unresolvedPresentation(certainty);
  }

  const copy = ELEMENT_COPY[finalElement];
  return {
    element: finalElement,
    symbol: copy.symbol,
    name: copy.name,
    keyword: copy.keyword,
    headline: `지금은 ${copy.name}의 성질을 보완하는 방향이 가장 잘 맞아요.`,
    reasonTitle: `왜 ${copy.name}일까요?`,
    reasonFlow: [...copy.reasonFlow],
    certainty,
  };
}
