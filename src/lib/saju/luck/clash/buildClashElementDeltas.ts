/**
 * clash modifier → 공통 signed delta (Effective 합성 입력).
 *
 * clash는 **순손실**이므로 delta는 항상 음수(또는 0건)다.
 * collapse는 이미 끝난 상태이므로 relation multiplicity를 **다시 세지 않는다** —
 * 이미 (오행 × 슬롯)당 1건으로 붕괴된 modifier만 소비한다.
 *
 * transform 모듈을 import하지 않는다.
 */

import { sumClashAttenuationByElement } from "@/lib/saju/luck/clash/buildClashAttenuationModifiers";
import type { ClashAttenuationModifier } from "@/lib/saju/luck/clash/types";
import type { ElementEffectiveDelta } from "@/lib/saju/effective/types";
import type { Element } from "@/lib/saju/types";
import { ELEMENTS } from "@/lib/saju/types";

/** 오행별 총 감쇠를 음수 delta로 바꾼다. 피격 없는 오행은 행이 없다. */
export function buildClashElementDeltas(
  modifiers: readonly ClashAttenuationModifier[],
): ElementEffectiveDelta[] {
  const totals = sumClashAttenuationByElement(modifiers);
  return ELEMENTS.filter((element) => totals[element] !== undefined).map((element: Element) => ({
    element,
    delta: -(totals[element] ?? 0),
  }));
}
