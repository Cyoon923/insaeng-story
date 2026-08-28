/**
 * L3 — `transform-ok` 후보 → raw modifier (TBD-02g · §1.5.9.4 4단계).
 *
 * 하지 않는 것: C-* 재평가 · 경합 승자 판정 · `modifierActive`/`contentionStatus` 부여 ·
 * clash 합성 · Effective 계산 · Natal 변경.
 *
 * 입력은 `TransformCandidate[]`만으로 충분하다 — `FourPillars`를 받지 않는다.
 */

import { transformPoolOf } from "@/lib/saju/transform/constants";
import type {
  TransformCandidate,
  TransformParticipantAttenuation,
  TransformRawModifier,
} from "@/lib/saju/transform/types";

/**
 * `transform-ok` 후보만 modifier로 바꾼다.
 *
 * - pool을 **참여 자리 수**로 균등 분배하고 반올림하지 않는다
 * - `boost`는 실제 `attenuations` 합에서 **유도**한다 → `Σatten === boost`가 부동소수점과 무관하게 성립
 * - participant identity(`slot`/`layer`/`element`)를 보존하며 오행별로 합치지 않는다
 * - `targetElement`는 L2 후보의 값을 **그대로** 쓴다 (표를 다시 조회하지 않는다)
 * - 입력 순서를 보존하고 입력을 변경하지 않는다
 */
export function buildTransformRawModifiers(
  candidates: readonly TransformCandidate[],
): TransformRawModifier[] {
  const modifiers: TransformRawModifier[] = [];

  for (const candidate of candidates) {
    if (candidate.status !== "transform-ok") continue;

    const { relation, targetElement } = candidate;
    const pool = transformPoolOf(relation.kind);
    const perParticipant = pool / relation.participants.length;

    const attenuations: TransformParticipantAttenuation[] = relation.participants.map(
      (participant) => ({
        slot: participant.slot,
        layer: participant.layer,
        element: participant.element,
        attenuation: perParticipant,
      }),
    );

    const boost = attenuations.reduce((total, row) => total + row.attenuation, 0);

    modifiers.push({
      combineId: relation.combineId,
      kind: relation.kind,
      attenuations,
      targetElement,
      boost,
    });
  }

  return modifiers;
}
