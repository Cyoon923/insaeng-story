/**
 * 감쇠 단위 → 수치 modifier (TBD-01c-wiring · W3 · 4단계).
 *
 * 확정 규칙 (§1.6.8.0):
 *   key 1건당 `CLASH_ATTENUATION_DELTA`(=4). source·relation 개수에 따라 달라지지 않는다.
 *   중복 제거는 collapse 단계에서 이미 끝났으므로 여기서는 1:1로 수치만 붙인다.
 *
 * 하지 않는 것: Natal score 합성 · Effective 계산 · 8~96 clamp ·
 * Level 재판정 · Opening 효과 합산 · source severity.
 */

import { CLASH_ATTENUATION_DELTA } from "@/lib/saju/luck/clash/constants";
import type {
  ClashAttenuationKey,
  ClashAttenuationModifier,
} from "@/lib/saju/luck/clash/types";
import type { Element } from "@/lib/saju/types";

/**
 * key 배열에 확정 δ를 적용한다.
 *
 * 입력 순서를 그대로 보존한다 — 유일한 정상 생산자인
 * `collapseClashAttenuationKeys`가 이미 결정론적으로 정렬해 내보내므로,
 * 여기서 다시 정렬하지 않는다(정렬 기준 중복 정의를 피한다).
 * 입력은 변경하지 않는다.
 */
export function buildClashAttenuationModifiers(
  keys: readonly ClashAttenuationKey[],
): ClashAttenuationModifier[] {
  return keys.map((key) => ({
    element: key.element,
    natalSlot: key.natalSlot,
    attenuation: CLASH_ATTENUATION_DELTA,
  }));
}

/**
 * 오행별 총 감쇠량(양수 합).
 *
 * 피격되지 않은 오행은 **키 자체가 없다** — 0을 채우지 않는다.
 * 전역 오행 패널티 금지(§1.6.2 D)를 자료구조로 드러내기 위함이다.
 */
export function sumClashAttenuationByElement(
  modifiers: readonly ClashAttenuationModifier[],
): Partial<Record<Element, number>> {
  const totals: Partial<Record<Element, number>> = {};
  for (const modifier of modifiers) {
    totals[modifier.element] = (totals[modifier.element] ?? 0) + modifier.attenuation;
  }
  return totals;
}
