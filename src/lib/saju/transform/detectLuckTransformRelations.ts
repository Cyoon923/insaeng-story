/**
 * Luck Transform L1 — 운 간지가 원국과 함께 참여하는 합 relation 탐지.
 *
 * 기존 Natal L1(`detectTransformRelations`)과 **같은 확정 표**(§1.5.8)를 쓴다.
 * 새 명리 규칙을 만들지 않는다. 五合 / 삼합 / 방합 완성형만 대상이며
 * 六合·반합은 범위 밖이다.
 *
 * 운 참여자는 궁위가 없으므로 `origin`으로만 식별한다(`participantIdentity`).
 * **운 간지끼리만 이루는 합은 만들지 않는다** — 원국이 최소 1자리는 참여해야
 * 원국 Effective에 영향을 주는 관계다.
 */

import { branchElement, stemElement } from "@/lib/saju/constants/elements";
import { confirmedSlots } from "@/lib/saju/elements/slots";
import {
  BRANCH_FANG_HE_COMBINATIONS,
  BRANCH_SAN_HE_COMBINATIONS,
  STEM_HE_COMBINATIONS,
  type BranchCombination,
} from "@/lib/saju/transform/combinationTables";
import type {
  TransformParticipant,
  TransformParticipantOrigin,
  TransformRelation,
} from "@/lib/saju/transform/types";
import type { Branch, FourPillars, PillarSlot, Stem } from "@/lib/saju/types";

/** 합에 참여할 수 있는 운 한 구간의 간지. */
export type LuckTransformSource = {
  /** `"annual-year"` | `"decade"` — 참여자 identity가 된다. */
  origin: Exclude<TransformParticipantOrigin, "natal">;
  stem: Stem;
  branch: Branch;
};

type StemHolder = { participant: TransformParticipant; stem: Stem };
type BranchHolder = { participant: TransformParticipant; branch: Branch };

function collectStemHolders(
  pillars: FourPillars,
  luckSources: readonly LuckTransformSource[],
): StemHolder[] {
  const holders: StemHolder[] = confirmedSlots(pillars).map(({ slot, pillar }) => ({
    stem: pillar.stem,
    participant: {
      origin: "natal",
      slot: slot as PillarSlot,
      layer: "stem",
      element: stemElement(pillar.stem),
    },
  }));
  for (const source of luckSources) {
    holders.push({
      stem: source.stem,
      participant: {
        origin: source.origin,
        layer: "stem",
        element: stemElement(source.stem),
      },
    });
  }
  return holders;
}

function collectBranchHolders(
  pillars: FourPillars,
  luckSources: readonly LuckTransformSource[],
): BranchHolder[] {
  const holders: BranchHolder[] = confirmedSlots(pillars).map(({ slot, pillar }) => ({
    branch: pillar.branch,
    participant: {
      origin: "natal",
      slot: slot as PillarSlot,
      layer: "branch",
      element: branchElement(pillar.branch),
    },
  }));
  for (const source of luckSources) {
    holders.push({
      branch: source.branch,
      participant: {
        origin: source.origin,
        layer: "branch",
        element: branchElement(source.branch),
      },
    });
  }
  return holders;
}

function hasNatal(participants: readonly TransformParticipant[]): boolean {
  return participants.some((participant) => participant.origin === "natal");
}

function hasLuck(participants: readonly TransformParticipant[]): boolean {
  return participants.some((participant) => participant.origin !== "natal");
}

/**
 * 운이 **실제로 참여하는** 합 relation만 돌려준다.
 *
 * - 원국끼리만 이루는 합은 제외한다 (그건 `detectTransformRelations`의 몫)
 * - 운끼리만 이루는 합도 제외한다 (원국 Effective와 무관)
 * - 자리 조합마다 별개 relation (multiplicity 보존)
 * - 결과 순서는 표 순서 → 자리 순서로 결정론적이며 입력을 변경하지 않는다
 */
export function detectLuckTransformRelations(
  pillars: FourPillars,
  luckSources: readonly LuckTransformSource[],
): TransformRelation[] {
  const stemHolders = collectStemHolders(pillars, luckSources);
  const branchHolders = collectBranchHolders(pillars, luckSources);
  const relations: TransformRelation[] = [];

  const push = (combineId: string, kind: TransformRelation["kind"], participants: TransformParticipant[]) => {
    if (!hasNatal(participants) || !hasLuck(participants)) return;
    relations.push({ combineId, kind, participants });
  };

  for (const combination of STEM_HE_COMBINATIONS) {
    const [firstStem, secondStem] = combination.stems;
    for (const first of stemHolders.filter((holder) => holder.stem === firstStem)) {
      for (const second of stemHolders.filter((holder) => holder.stem === secondStem)) {
        push(combination.id, combination.kind, [first.participant, second.participant]);
      }
    }
  }

  const branchCombinations: readonly BranchCombination[] = [
    ...BRANCH_SAN_HE_COMBINATIONS,
    ...BRANCH_FANG_HE_COMBINATIONS,
  ];
  for (const combination of branchCombinations) {
    const [a, b, c] = combination.branches;
    for (const first of branchHolders.filter((holder) => holder.branch === a)) {
      for (const second of branchHolders.filter((holder) => holder.branch === b)) {
        for (const third of branchHolders.filter((holder) => holder.branch === c)) {
          push(combination.id, combination.kind, [
            first.participant,
            second.participant,
            third.participant,
          ]);
        }
      }
    }
  }

  return relations;
}
