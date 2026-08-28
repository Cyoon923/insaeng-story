/**
 * transform modifier → 공통 signed delta (Effective 합성 입력).
 *
 * **`modifierActive === true`인 modifier만** 소비한다 — `lost` ·
 * `competition-unresolved`는 delta 0이다. `contentionStatus` 문자열이 아니라
 * `modifierActive`를 최종 게이트로 쓴다(§1.5.10.3).
 *
 * 참여 자리 attenuation은 음수, 목표 오행 boost는 양수이며, 같은 오행이 여러
 * 자리에 걸리면 **전부 합산**한다. relation·candidate를 다시 평가하지 않는다.
 * clash 모듈을 import하지 않는다.
 */

import type { ElementEffectiveDelta } from "@/lib/saju/effective/types";
import type { TransformResolvedModifier } from "@/lib/saju/transform/types";
import type { Element } from "@/lib/saju/types";
import { ELEMENTS } from "@/lib/saju/types";

/** 활성 modifier만 오행별 signed delta로 환원한다. */
export function buildTransformElementDeltas(
  modifiers: readonly TransformResolvedModifier[],
): ElementEffectiveDelta[] {
  const totals: Partial<Record<Element, number>> = {};

  for (const modifier of modifiers) {
    if (!modifier.modifierActive) continue;

    for (const row of modifier.attenuations) {
      totals[row.element] = (totals[row.element] ?? 0) - row.attenuation;
    }
    totals[modifier.targetElement] = (totals[modifier.targetElement] ?? 0) + modifier.boost;
  }

  return ELEMENTS.filter((element) => totals[element] !== undefined).map((element: Element) => ({
    element,
    delta: totals[element] ?? 0,
  }));
}
