/**
 * Luck ↔ Natal 육충 relation 탐지 (TBD-01c-wiring · W3 · 2단계).
 *
 * **관계만** 만든다. collapse · δ · modifier · Effective 반영 · severity ·
 * Opening 효과는 여기 없다. Strength 모듈도 import하지 않는다.
 *
 * relation multiplicity는 **전량 보존**한다 — 같은 natal 슬롯을 여러 운이
 * 충하면 relation도 그 수만큼 나온다. 수치 붕괴는 다음 단계(collapse)의 몫이다.
 *
 * 설계 근거: docs/unyul-judgment-rules-draft-v0.md §1.6.8.10
 */

import { resolveBranchClashPairId } from "@/lib/saju/luck/clash/branchClashPairs";
import type {
  ClashRelation,
  LuckClashKind,
  LuckClashTarget,
  NatalClashSnapshot,
} from "@/lib/saju/luck/clash/types";
import type { PillarSlot } from "@/lib/saju/types";

const SLOT_ORDER: Record<PillarSlot, number> = {
  year: 0,
  month: 1,
  day: 2,
  hour: 3,
};

const LUCK_KIND_ORDER: Record<LuckClashKind, number> = {
  decade: 0,
  "annual-year": 1,
  month: 2,
  day: 3,
};

/** 결정론적 정렬 키: 슬롯 → 운 종류 → 상대 지지 → window. */
function compareRelations(a: ClashRelation, b: ClashRelation): number {
  const slotDiff = SLOT_ORDER[a.natalSlot] - SLOT_ORDER[b.natalSlot];
  if (slotDiff !== 0) return slotDiff;

  const aKind = a.source === "natal" ? -1 : LUCK_KIND_ORDER[a.source];
  const bKind = b.source === "natal" ? -1 : LUCK_KIND_ORDER[b.source];
  if (aKind !== bKind) return aKind - bKind;

  if (a.otherBranch !== b.otherBranch) return a.otherBranch < b.otherBranch ? -1 : 1;

  const aStart = a.window?.start.getTime() ?? 0;
  const bStart = b.window?.start.getTime() ?? 0;
  if (aStart !== bStart) return aStart - bStart;

  const aEnd = a.window?.end.getTime() ?? 0;
  const bEnd = b.window?.end.getTime() ?? 0;
  return aEnd - bEnd;
}

/**
 * natal 스냅샷과 운 대상들 사이의 육충 relation 전량.
 *
 * - 입력을 변경하지 않는다 (snapshot · targets 모두 읽기 전용 취급)
 * - 같은 슬롯에 여러 운이 걸리면 relation을 **여러 건** 낸다
 * - 결과 순서는 targets 입력 순서와 무관하게 결정론적이다
 * - `window`는 target의 값을 **그대로** 보존한다
 */
export function detectLuckClashRelations(
  snapshot: NatalClashSnapshot,
  targets: readonly LuckClashTarget[],
): ClashRelation[] {
  const relations: ClashRelation[] = [];

  for (const slot of snapshot.slots) {
    for (const target of targets) {
      const clashPairId = resolveBranchClashPairId(slot.branch, target.branch);
      if (clashPairId === null) continue;

      relations.push({
        natalSlot: slot.slot,
        natalBranch: slot.branch,
        otherBranch: target.branch,
        source: target.luckKind,
        clashPairId,
        window: { start: target.window.start, end: target.window.end },
      });
    }
  }

  return relations.sort(compareRelations);
}
