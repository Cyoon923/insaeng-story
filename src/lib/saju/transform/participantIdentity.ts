/**
 * 참여 자리 identity — 경합(§1.5.10 S1) 판정의 유일 기준.
 *
 * 원국은 **궁위 × 층**, 운은 **출처 × 층**으로 식별한다.
 * 운 간지에는 궁위가 없으므로 natal 슬롯 키와 충돌하지 않는다.
 * (`month`가 PillarSlot과 LuckClashKind 양쪽에 존재하므로 origin 없이는 충돌한다.)
 */

import type {
  TransformParticipant,
  TransformParticipantAttenuation,
} from "@/lib/saju/transform/types";

export function participantKey(
  participant: TransformParticipant | TransformParticipantAttenuation,
): string {
  return participant.origin === "natal"
    ? `natal:${participant.layer}:${participant.slot}`
    : `${participant.origin}:${participant.layer}`;
}

/** 운 간지가 하나라도 참여하면 Luck Transform이다. */
export function involvesLuck(
  participants: ReadonlyArray<TransformParticipant | TransformParticipantAttenuation>,
): boolean {
  return participants.some((participant) => participant.origin !== "natal");
}
