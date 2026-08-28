/**
 * 육충 relation → 감쇠 단위 collapse (TBD-01c-wiring · W3 · 3단계).
 *
 * 확정 규칙 L1-S (§1.6.8.9.4):
 *   attenuation key = `(element × natal 지지슬롯)`, 활성 relation 수·source와 무관하게 **1회**.
 *   relation 자체는 호출자의 `ClashRelation[]`에 **전량 남는다** — 여기서 버리지 않는다.
 *
 * relation에는 `element`가 없으므로, 각 relation의 `natalSlot`으로 snapshot을 찾아
 * 그 슬롯의 `rootElements`로 확장한다. **`RootHit` 레코드 수는 쓰지 않는다**
 * (polarity 중복으로 감쇠가 2배가 된다).
 *
 * δ는 여기서 적용하지 않는다. Opening 대상 쌍(丑未·辰戌)도 generic 키를 정상 생성하며,
 * 개고 효과는 별도 경로다.
 */

import type {
  ClashAttenuationKey,
  ClashRelation,
  NatalClashSnapshot,
} from "@/lib/saju/luck/clash/types";
import type { Element, PillarSlot } from "@/lib/saju/types";
import { ELEMENTS } from "@/lib/saju/types";

const SLOT_ORDER: Record<PillarSlot, number> = {
  year: 0,
  month: 1,
  day: 2,
  hour: 3,
};

const ELEMENT_ORDER: Record<Element, number> = ELEMENTS.reduce(
  (acc, element, index) => {
    acc[element] = index;
    return acc;
  },
  {} as Record<Element, number>,
);

/**
 * relation 집합을 감쇠 단위로 붕괴한다.
 *
 * 정렬은 **오행(ELEMENTS 순) → 슬롯(year→hour)** 이다. 키 이름이
 * `(element × slot)`이고 하위 소비자가 Level 계산을 위해 오행별로 묶으므로
 * 오행을 major 축으로 둔다. (relation 목록은 슬롯 앵커라 슬롯 major로 정렬한다 —
 * 축이 다르므로 정렬 기준도 다르다.)
 *
 * 비정상 입력은 **throw**한다. 본 모듈은 내부 pure pipeline이고, relation과
 * snapshot의 불일치는 호출자의 결함이다. 조용히 무시하면 감쇠가 조용히 어긋나
 * §1.6.8.5.1 불변식이 소리 없이 깨진다.
 */
export function collapseClashAttenuationKeys(
  snapshot: NatalClashSnapshot,
  relations: readonly ClashRelation[],
): ClashAttenuationKey[] {
  const slotByName = new Map(snapshot.slots.map((slot) => [slot.slot, slot]));
  const seen = new Set<string>();
  const keys: ClashAttenuationKey[] = [];

  for (const relation of relations) {
    const slot = slotByName.get(relation.natalSlot);
    if (slot === undefined) {
      throw new Error(
        `collapseClashAttenuationKeys: relation references slot ${relation.natalSlot} not present in snapshot`,
      );
    }
    if (slot.branch !== relation.natalBranch) {
      throw new Error(
        `collapseClashAttenuationKeys: relation natalBranch ${relation.natalBranch} does not match snapshot ${slot.slot} branch ${slot.branch}`,
      );
    }

    for (const element of slot.rootElements) {
      const id = `${element}:${slot.slot}`;
      if (seen.has(id)) continue;
      seen.add(id);
      keys.push({ element, natalSlot: slot.slot });
    }
  }

  return keys.sort((a, b) => {
    const elementDiff = ELEMENT_ORDER[a.element] - ELEMENT_ORDER[b.element];
    if (elementDiff !== 0) return elementDiff;
    return SLOT_ORDER[a.natalSlot] - SLOT_ORDER[b.natalSlot];
  });
}
