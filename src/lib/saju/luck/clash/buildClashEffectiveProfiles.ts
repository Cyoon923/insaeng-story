/**
 * Internal Effective → Display Effective + Effective Level
 * (TBD-01c-wiring · W3 · 6단계).
 *
 * Internal은 unclamped로 그대로 싣고, Display만 표시 구간으로 자른 뒤
 * nearest-band로 Effective Level을 얻는다.
 *
 * 하지 않는 것: Natal `strengthLevel` 변경 · Need/Core/Supplement 재계산 ·
 * Transform/Opening modifier 합성.
 */

import {
  clampToDisplayRange,
  resolveNearestStrengthLevel,
} from "@/lib/saju/luck/clash/resolveEffectiveStrengthLevel";
import type {
  ClashEffectiveProfile,
  ClashEffectiveScore,
} from "@/lib/saju/luck/clash/types";

/**
 * `buildClashEffectiveScores` 결과에 clamp·Level을 붙인다.
 * 입력 순서(ELEMENTS 순)를 그대로 보존하며 입력을 변경하지 않는다.
 */
export function buildClashEffectiveProfiles(
  scores: readonly ClashEffectiveScore[],
): ClashEffectiveProfile[] {
  return scores.map((score) => {
    const displayEffectiveScore = clampToDisplayRange(score.internalEffectiveScore);
    return {
      element: score.element,
      natalScore: score.natalScore,
      attenuation: score.attenuation,
      internalEffectiveScore: score.internalEffectiveScore,
      displayEffectiveScore,
      effectiveStrengthLevel: resolveNearestStrengthLevel(displayEffectiveScore),
    };
  });
}
