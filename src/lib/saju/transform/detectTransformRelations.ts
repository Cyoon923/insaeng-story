/**
 * L1 — 원국 합 relation-hit 탐지 (TBD-02g · §1.5.11.2).
 *
 * **관계 사실만** 만든다. `transform-ok` 판정 · 목표 오행 · pool · modifier ·
 * 경합은 여기 없다. Strength / Need / Core / Supplement / clash 모듈을
 * import하지 않는다 — L1은 四柱만 소비한다.
 *
 * multiplicity 보존: 같은 글자 조합이라도 **참여 자리 조합이 다르면 별개 relation**이다.
 * (예: year甲·day己 와 month甲·day己 는 relation 2건)
 */

import { branchElement, stemElement } from "@/lib/saju/constants/elements";
import { confirmedSlots } from "@/lib/saju/elements/slots";
import {
  BRANCH_FANG_HE_COMBINATIONS,
  BRANCH_SAN_HE_COMBINATIONS,
  STEM_HE_COMBINATIONS,
  type BranchCombination,
} from "@/lib/saju/transform/combinationTables";
import type { TransformParticipant, TransformRelation } from "@/lib/saju/transform/types";
import type { Branch, FourPillars, PillarSlot, Stem } from "@/lib/saju/types";

/**
 * 원국에서 성립하는 합 relation 전량.
 *
 * - `hour === "unknown"`이면 시주는 `confirmedSlots`에서 빠지므로 참여하지 않는다
 * - 결과 순서는 표 순서 → 자리 순서(year→month→day→hour)로 결정론적이다
 * - 입력을 변경하지 않는다
 */
export function detectTransformRelations(pillars: FourPillars): TransformRelation[] {
  const slots = confirmedSlots(pillars);

  const slotsWithStem = (stem: Stem): PillarSlot[] =>
    slots.filter(({ pillar }) => pillar.stem === stem).map(({ slot }) => slot);
  const slotsWithBranch = (branch: Branch): PillarSlot[] =>
    slots.filter(({ pillar }) => pillar.branch === branch).map(({ slot }) => slot);

  const relations: TransformRelation[] = [];

  // 천간 五合 — 두 글자는 항상 서로 다르므로 자리 집합이 겹치지 않는다.
  for (const combination of STEM_HE_COMBINATIONS) {
    const [firstStem, secondStem] = combination.stems;
    for (const firstSlot of slotsWithStem(firstStem)) {
      for (const secondSlot of slotsWithStem(secondStem)) {
        const participants: TransformParticipant[] = [
          { slot: firstSlot, layer: "stem", element: stemElement(firstStem) },
          { slot: secondSlot, layer: "stem", element: stemElement(secondStem) },
        ];
        relations.push({ combineId: combination.id, kind: combination.kind, participants });
      }
    }
  }

  // 지지 삼합·방합 완성형 — 세 글자 모두 서로 다르다.
  const branchCombinations: readonly BranchCombination[] = [
    ...BRANCH_SAN_HE_COMBINATIONS,
    ...BRANCH_FANG_HE_COMBINATIONS,
  ];
  for (const combination of branchCombinations) {
    const [firstBranch, secondBranch, thirdBranch] = combination.branches;
    for (const firstSlot of slotsWithBranch(firstBranch)) {
      for (const secondSlot of slotsWithBranch(secondBranch)) {
        for (const thirdSlot of slotsWithBranch(thirdBranch)) {
          const participants: TransformParticipant[] = [
            // branch layer의 element는 지지 **본기(정기)** 오행이다 (§1.5.9.10.1).
            // BRANCH_ELEMENT는 12지지 전부에서 정기 지장간의 오행과 일치한다.
            { slot: firstSlot, layer: "branch", element: branchElement(firstBranch) },
            { slot: secondSlot, layer: "branch", element: branchElement(secondBranch) },
            { slot: thirdSlot, layer: "branch", element: branchElement(thirdBranch) },
          ];
          relations.push({ combineId: combination.id, kind: combination.kind, participants });
        }
      }
    }
  }

  return relations;
}
