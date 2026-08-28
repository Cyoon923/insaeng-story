/**
 * Natal clash snapshot builder (TBD-01c-wiring · W3 · 1단계).
 *
 * Natal을 **읽기만** 하고 파생 스냅샷을 만든다. mutation 없음.
 * 육충 관계 탐지 · collapse · δ modifier는 **여기서 하지 않는다.**
 *
 * 재사용 원칙: root 판정을 다시 구현하지 않고 Strength 쪽 기존 산출물인
 * `analyzeElementPresence(...).rootedSlots`를 그대로 쓴다. 슬롯 확정 역시
 * `confirmedSlots`를 그대로 쓴다 — hour unknown 제외가 여기에 이미 들어 있다.
 *
 * 설계 근거: docs/unyul-judgment-rules-draft-v0.md §1.6.8.10
 */

import { analyzeElementPresence } from "@/lib/saju/elements/presence";
import { confirmedSlots } from "@/lib/saju/elements/slots";
import type { NatalClashSnapshot, NatalClashSlot } from "@/lib/saju/luck/clash/types";
import type { Element, FourPillars, PillarSlot } from "@/lib/saju/types";
import { ELEMENTS } from "@/lib/saju/types";

/**
 * FourPillars → 충 판정용 최소 스냅샷.
 *
 * - confirmed 슬롯만 포함 (`hour === "unknown"`이면 hour 제외)
 * - `rootElements`는 오행당 1개 (ELEMENTS 순서, 중복 없음)
 * - 입력 `pillars`는 변경하지 않는다
 */
export function buildNatalClashSnapshot(pillars: FourPillars): NatalClashSnapshot {
  // 오행별 root 슬롯 집합 — Strength의 rootedSlots를 그대로 재사용한다.
  const rootedSlotsByElement = new Map<Element, ReadonlySet<PillarSlot>>();
  for (const element of ELEMENTS) {
    rootedSlotsByElement.set(
      element,
      new Set(analyzeElementPresence(pillars, element).rootedSlots),
    );
  }

  const slots: NatalClashSlot[] = confirmedSlots(pillars).map(({ slot, pillar }) => ({
    slot,
    branch: pillar.branch,
    // ELEMENTS를 한 번만 훑으므로 오행 중복이 구조적으로 불가능하다.
    rootElements: ELEMENTS.filter((element) => rootedSlotsByElement.get(element)!.has(slot)),
  }));

  return { slots };
}
