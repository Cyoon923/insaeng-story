/**
 * Natal + Luck Transform 통합 해소 (L1 → L4).
 *
 * 원국 합과 운 참여 합을 **같은 경합 집합에서** 평가한다 — 둘이 원국 자리를
 * 공유하면 §1.5.10의 S1 경합 대상이므로 따로 돌리면 중복 적용이 생긴다.
 * 반환할 때만 natal / luck로 나눈다.
 *
 * 하지 않는 것: Opening · 六合/반합 · 월운/일운 · 五合 TBD 해소 · 대운 간지 산출.
 */

import { buildTransformRawModifiers } from "@/lib/saju/transform/buildTransformRawModifiers";
import {
  detectLuckTransformRelations,
  type LuckTransformSource,
} from "@/lib/saju/transform/detectLuckTransformRelations";
import { detectTransformRelations } from "@/lib/saju/transform/detectTransformRelations";
import { evaluateTransformCandidates } from "@/lib/saju/transform/evaluateTransformCandidates";
import { involvesLuck } from "@/lib/saju/transform/participantIdentity";
import { resolveTransformCompetition } from "@/lib/saju/transform/resolveTransformCompetition";
import type { TransformResolvedModifier } from "@/lib/saju/transform/types";
import type { FourPillars } from "@/lib/saju/types";

export type ResolveTransformWithLuckInput = {
  pillars: FourPillars;
  /** 참여시킬 운 간지. 비우면 원국 Transform만 해소한다. */
  luckSources?: readonly LuckTransformSource[];
};

export type TransformWithLuckResult = {
  /** 원국 자리만으로 성립한 합. */
  natalModifiers: TransformResolvedModifier[];
  /** 운 간지가 참여한 합. */
  luckModifiers: TransformResolvedModifier[];
};

/**
 * 원국·운 합을 함께 해소하고 출처별로 나눠 돌려준다.
 * 순수 함수이며 입력을 변경하지 않는다.
 */
export function resolveTransformWithLuck(
  input: ResolveTransformWithLuckInput,
): TransformWithLuckResult {
  const { pillars, luckSources = [] } = input;

  const relations = [
    ...detectTransformRelations(pillars),
    ...detectLuckTransformRelations(pillars, luckSources),
  ];
  const candidates = evaluateTransformCandidates(pillars, relations, luckSources);
  const resolved = resolveTransformCompetition(
    buildTransformRawModifiers(candidates),
    candidates,
  );

  return {
    natalModifiers: resolved.filter((modifier) => !involvesLuck(modifier.attenuations)),
    luckModifiers: resolved.filter((modifier) => involvesLuck(modifier.attenuations)),
  };
}
