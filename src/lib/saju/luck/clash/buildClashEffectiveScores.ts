/**
 * Natal 좌표 + 감쇠 modifier → 오행별 Internal Effective Score
 * (TBD-01c-wiring · W3 · 5단계).
 *
 * 확정 공식 (§1.5.9.5 · §1.6.8.0):
 *   Internal Effective = Natal Display Score − Σ clash attenuation   ← **unclamped**
 *
 * 하지 않는 것: 8~96 clamp · Level 재판정 · Transform/Opening modifier 합성 ·
 * Need/Core/Supplement 연결. Natal 입력은 변경하지 않는다.
 */

import { sumClashAttenuationByElement } from "@/lib/saju/luck/clash/buildClashAttenuationModifiers";
import type {
  ClashAttenuationModifier,
  ClashEffectiveScore,
  NatalElementScore,
} from "@/lib/saju/luck/clash/types";
import type { Element } from "@/lib/saju/types";
import { ELEMENTS } from "@/lib/saju/types";

const ELEMENT_ORDER: Record<Element, number> = ELEMENTS.reduce(
  (acc, element, index) => {
    acc[element] = index;
    return acc;
  },
  {} as Record<Element, number>,
);

/**
 * 오행별 Internal Effective Score를 만든다.
 *
 * - 피격되지 않은 오행은 `attenuation: 0`, Effective = Natal (전역 패널티 없음)
 * - Internal은 **clamp하지 않는다** — 8 미만·음수도 그대로 둔다
 * - 결과는 ELEMENTS 순서로 정렬된다
 *
 * 비정상 입력은 throw한다(collapse 단계와 동일 계약). 조용히 무시하면
 * 수치가 소리 없이 어긋난다.
 */
export function buildClashEffectiveScores(
  natalScores: readonly NatalElementScore[],
  modifiers: readonly ClashAttenuationModifier[],
): ClashEffectiveScore[] {
  const scoreByElement = new Map<Element, number>();
  for (const row of natalScores) {
    if (scoreByElement.has(row.element)) {
      throw new Error(
        `buildClashEffectiveScores: duplicate natal score for element ${row.element}`,
      );
    }
    scoreByElement.set(row.element, row.natalScore);
  }

  const totals = sumClashAttenuationByElement(modifiers);
  for (const element of Object.keys(totals) as Element[]) {
    if (!scoreByElement.has(element)) {
      throw new Error(
        `buildClashEffectiveScores: modifier references element ${element} absent from natal scores`,
      );
    }
  }

  const rows: ClashEffectiveScore[] = [...scoreByElement.entries()].map(
    ([element, natalScore]) => {
      const attenuation = totals[element] ?? 0;
      return {
        element,
        natalScore,
        attenuation,
        internalEffectiveScore: natalScore - attenuation,
      };
    },
  );

  return rows.sort((a, b) => ELEMENT_ORDER[a.element] - ELEMENT_ORDER[b.element]);
}
