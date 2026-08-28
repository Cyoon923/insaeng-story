/**
 * Transform modifier 확정 수치 (TBD-01b · §1.5.9.10 — **B안 확정**).
 *
 * production에 승격된 수치는 **五合 12 / 삼합·방합 16 뿐**이다.
 * 기각된 A(8/12) · C(16/20) 후보는 비교 기록으로만 문서에 남고 여기에는 없다.
 *
 * kind → pool 매핑은 **이 파일에만** 존재한다.
 */

import type { TransformCombineKind } from "@/lib/saju/transform/types";

/** 합 종류별 transform pool. 참여 자리 수로 균등 분배된다(§1.5.9.10.1). */
export const TRANSFORM_POOL_BY_KIND: Readonly<Record<TransformCombineKind, number>> = {
  五合: 12,
  삼합: 16,
  방합: 16,
};

export function transformPoolOf(kind: TransformCombineKind): number {
  return TRANSFORM_POOL_BY_KIND[kind];
}
