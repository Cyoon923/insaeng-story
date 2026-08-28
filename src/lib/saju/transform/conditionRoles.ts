/**
 * C-* 역할 매트릭스 (§1.5.4.2 확정). **표만** 둔다 — 평가 로직 없음.
 *
 * 六合·반합은 화기 비대상이라 L1 표에도 없고 여기에도 없다(§1.5.4.2 †‡).
 */

import type {
  TransformCombineKind,
  TransformConditionKey,
  TransformConditionRole,
} from "@/lib/saju/transform/types";

type RoleRow = Readonly<Record<TransformConditionKey, TransformConditionRole>>;

/** 五合: 월령 R · 세력 S · 통근 R · 투간 R · 방해 B · 거리 R · 중복 게이트 · 경쟁 S */
const WU_HE_ROLES: RoleRow = {
  monthCommand: "required",
  force: "supporting",
  root: "required",
  stemExposure: "required",
  obstruction: "blocking",
  distance: "required",
  duplicate: "gate",
  competition: "supporting",
};

/** 삼합·방합: 월령 R · 세력 S · 통근 S · 투간 R · 방해 B · 거리 N · 중복 게이트 · 경쟁 S */
const BRANCH_COMBINE_ROLES: RoleRow = {
  monthCommand: "required",
  force: "supporting",
  root: "supporting",
  stemExposure: "required",
  obstruction: "blocking",
  distance: "not-applicable",
  duplicate: "gate",
  competition: "supporting",
};

export const TRANSFORM_CONDITION_ROLES: Readonly<Record<TransformCombineKind, RoleRow>> = {
  五合: WU_HE_ROLES,
  삼합: BRANCH_COMBINE_ROLES,
  방합: BRANCH_COMBINE_ROLES,
};

/** 평가 순서 고정 — evidence 배열의 결정론적 순서. */
export const TRANSFORM_CONDITION_ORDER: readonly TransformConditionKey[] = [
  "monthCommand",
  "force",
  "root",
  "stemExposure",
  "obstruction",
  "distance",
  "duplicate",
  "competition",
];
