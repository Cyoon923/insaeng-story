/**
 * 오행별 signed delta 합성 → Internal Effective → Display → Effective Level.
 *
 * **층을 모른다.** clash·transform 등 어떤 층이든 `ElementEffectiveDelta[]`로
 * 환원해서 넣는다. 이 모듈은 clash/transform 모듈을 import하지 않는다.
 *
 * 공식: `Internal Effective = Natal displayScore + Σ delta` (**unclamped**)
 * Display만 8–96 clamp, Effective Level은 clamp된 좌표의 nearest band.
 * Natal Strength Level · Need · Core · Supplement는 변경하지 않는다.
 */

import {
  clampToDisplayRange,
  resolveNearestStrengthLevel,
} from "@/lib/saju/effective/resolveEffectiveStrengthLevel";
import type {
  ElementEffectiveDelta,
  ElementEffectiveProfile,
  ElementEffectiveScore,
  NatalElementScore,
} from "@/lib/saju/effective/types";
import type { Element } from "@/lib/saju/types";
import { ELEMENTS } from "@/lib/saju/types";

const ELEMENT_ORDER: Record<Element, number> = ELEMENTS.reduce(
  (acc, element, index) => {
    acc[element] = index;
    return acc;
  },
  {} as Record<Element, number>,
);

/** 여러 층의 delta를 오행별로 합산한다. 비관련 오행은 키가 생기지 않는다. */
export function sumElementDeltas(
  ...deltaGroups: ReadonlyArray<readonly ElementEffectiveDelta[]>
): Partial<Record<Element, number>> {
  const totals: Partial<Record<Element, number>> = {};
  for (const group of deltaGroups) {
    for (const row of group) {
      totals[row.element] = (totals[row.element] ?? 0) + row.delta;
    }
  }
  return totals;
}

/**
 * Natal 좌표 + delta → Internal Effective.
 *
 * - delta가 없는 오행은 `delta: 0`, Effective = Natal (전역 패널티 없음)
 * - Internal은 **clamp하지 않는다** (8 미만·음수·96 초과 허용)
 * - 결과는 ELEMENTS 순서로 정렬된다
 * - 입력을 변경하지 않는다
 */
export function composeElementEffectiveScores(
  natalScores: readonly NatalElementScore[],
  ...deltaGroups: ReadonlyArray<readonly ElementEffectiveDelta[]>
): ElementEffectiveScore[] {
  const scoreByElement = new Map<Element, number>();
  for (const row of natalScores) {
    if (scoreByElement.has(row.element)) {
      throw new Error(
        `composeElementEffectiveScores: duplicate natal score for element ${row.element}`,
      );
    }
    scoreByElement.set(row.element, row.natalScore);
  }

  const totals = sumElementDeltas(...deltaGroups);
  for (const element of Object.keys(totals) as Element[]) {
    if (!scoreByElement.has(element)) {
      throw new Error(
        `composeElementEffectiveScores: delta references element ${element} absent from natal scores`,
      );
    }
  }

  return [...scoreByElement.entries()]
    .map(([element, natalScore]) => {
      const delta = totals[element] ?? 0;
      return { element, natalScore, delta, internalEffectiveScore: natalScore + delta };
    })
    .sort((a, b) => ELEMENT_ORDER[a.element] - ELEMENT_ORDER[b.element]);
}

/** Internal → Display(clamp) + Effective Level. 입력 순서를 보존한다. */
export function buildElementEffectiveProfiles(
  scores: readonly ElementEffectiveScore[],
): ElementEffectiveProfile[] {
  return scores.map((score) => {
    const displayEffectiveScore = clampToDisplayRange(score.internalEffectiveScore);
    return {
      ...score,
      displayEffectiveScore,
      effectiveStrengthLevel: resolveNearestStrengthLevel(displayEffectiveScore),
    };
  });
}
