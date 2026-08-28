/**
 * 화기 결과 오행 표 (§1.5.8 확정).
 *
 * 목표 오행은 **판정 후보의 결과**이므로 L1 relation이 아니라 L2에서 붙인다.
 */

import type { Element } from "@/lib/saju/types";

/** combineId → 화기 결과 오행. */
export const TRANSFORM_TARGET_BY_COMBINE_ID: Readonly<Record<string, Element>> = {
  // 천간 五合
  "五合-甲己": "土",
  "五合-乙庚": "金",
  "五合-丙辛": "水",
  "五合-丁壬": "木",
  "五合-戊癸": "火",
  // 지지 삼합 (완합)
  "삼합-申子辰": "水",
  "삼합-亥卯未": "木",
  "삼합-寅午戌": "火",
  "삼합-巳酉丑": "金",
  // 지지 방합
  "방합-寅卯辰": "木",
  "방합-巳午未": "火",
  "방합-申酉戌": "金",
  "방합-亥子丑": "水",
};

export function transformTargetOf(combineId: string): Element {
  const target = TRANSFORM_TARGET_BY_COMBINE_ID[combineId];
  if (target === undefined) {
    throw new Error(`transformTargetOf: unknown combineId ${combineId}`);
  }
  return target;
}
