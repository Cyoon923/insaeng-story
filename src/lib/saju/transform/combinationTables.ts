/**
 * 합 구성 표 (§1.5.8 확정). **표만** 두고 탐지 로직은 두지 않는다.
 *
 * 목표 오행(화기 결과)은 **여기 넣지 않는다** — 목표는 `transform-ok` 판정 결과이지
 * 관계 사실이 아니다(§1.5.11.3). L2 이후 계층에서 부여한다.
 *
 * 六合·반합은 현재 transform path가 없어 표에 넣지 않는다(§1.5.11.7 · TBD-02b).
 */

import type { TransformCombineKind } from "@/lib/saju/transform/types";
import type { Branch, Stem } from "@/lib/saju/types";

export type StemHeCombination = {
  id: string;
  kind: Extract<TransformCombineKind, "五合">;
  /** canonical 순서. participants도 이 순서를 따른다. */
  stems: readonly [Stem, Stem];
};

export type BranchCombination = {
  id: string;
  kind: Extract<TransformCombineKind, "삼합" | "방합">;
  /** canonical 순서. participants도 이 순서를 따른다. */
  branches: readonly [Branch, Branch, Branch];
};

/** 천간 五合 5쌍. */
export const STEM_HE_COMBINATIONS: readonly StemHeCombination[] = [
  { id: "五合-甲己", kind: "五合", stems: ["甲", "己"] },
  { id: "五合-乙庚", kind: "五合", stems: ["乙", "庚"] },
  { id: "五合-丙辛", kind: "五合", stems: ["丙", "辛"] },
  { id: "五合-丁壬", kind: "五合", stems: ["丁", "壬"] },
  { id: "五合-戊癸", kind: "五合", stems: ["戊", "癸"] },
];

/** 지지 삼합 완성형 4종. 반합(2자)은 범위 밖. */
export const BRANCH_SAN_HE_COMBINATIONS: readonly BranchCombination[] = [
  { id: "삼합-申子辰", kind: "삼합", branches: ["申", "子", "辰"] },
  { id: "삼합-亥卯未", kind: "삼합", branches: ["亥", "卯", "未"] },
  { id: "삼합-寅午戌", kind: "삼합", branches: ["寅", "午", "戌"] },
  { id: "삼합-巳酉丑", kind: "삼합", branches: ["巳", "酉", "丑"] },
];

/** 지지 방합 완성형 4종. */
export const BRANCH_FANG_HE_COMBINATIONS: readonly BranchCombination[] = [
  { id: "방합-寅卯辰", kind: "방합", branches: ["寅", "卯", "辰"] },
  { id: "방합-巳午未", kind: "방합", branches: ["巳", "午", "未"] },
  { id: "방합-申酉戌", kind: "방합", branches: ["申", "酉", "戌"] },
  { id: "방합-亥子丑", kind: "방합", branches: ["亥", "子", "丑"] },
];
