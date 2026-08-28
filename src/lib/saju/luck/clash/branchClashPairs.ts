/**
 * 지지 육충 6쌍 표 (§1.6.1 확정).
 *
 * 쌍은 **무순서**다. 조회는 두 지지의 순서와 무관하게 같은 `ClashPairId`를 낸다.
 * 개고 여부·효과는 여기서 판단하지 않는다 — `clashPairId`만 싣고 분기는 별도 평가기가 한다.
 */

import type { ClashPairId } from "@/lib/saju/luck/clash/types";
import type { Branch } from "@/lib/saju/types";

export type BranchClashPair = {
  id: ClashPairId;
  pair: readonly [Branch, Branch];
};

/** 육충 6쌍. 12지지를 정확히 분할하는 완전 매칭이다. */
export const BRANCH_CLASH_PAIRS: readonly BranchClashPair[] = [
  { id: "clash-zi-wu", pair: ["子", "午"] },
  { id: "clash-chou-wei", pair: ["丑", "未"] },
  { id: "clash-yin-shen", pair: ["寅", "申"] },
  { id: "clash-mao-you", pair: ["卯", "酉"] },
  { id: "clash-chen-xu", pair: ["辰", "戌"] },
  { id: "clash-si-hai", pair: ["巳", "亥"] },
];

/** 지지 → 충 상대. 완전 매칭이므로 상대는 항상 유일하다. */
const PARTNER: Partial<Record<Branch, Branch>> = (() => {
  const map: Partial<Record<Branch, Branch>> = {};
  for (const { pair } of BRANCH_CLASH_PAIRS) {
    map[pair[0]] = pair[1];
    map[pair[1]] = pair[0];
  }
  return map;
})();

const PAIR_ID: Partial<Record<Branch, ClashPairId>> = (() => {
  const map: Partial<Record<Branch, ClashPairId>> = {};
  for (const { id, pair } of BRANCH_CLASH_PAIRS) {
    map[pair[0]] = id;
    map[pair[1]] = id;
  }
  return map;
})();

/** 해당 지지의 충 상대. 육충은 12지지 완전 매칭이라 항상 존재한다. */
export function clashPartnerOf(branch: Branch): Branch {
  const partner = PARTNER[branch];
  if (partner === undefined) {
    throw new Error(`clashPartnerOf: unknown branch ${branch}`);
  }
  return partner;
}

/**
 * 두 지지가 육충이면 canonical id, 아니면 `null`.
 * 인자 순서와 무관하게 같은 값을 돌려준다.
 */
export function resolveBranchClashPairId(a: Branch, b: Branch): ClashPairId | null {
  return PARTNER[a] === b ? (PAIR_ID[a] ?? null) : null;
}
