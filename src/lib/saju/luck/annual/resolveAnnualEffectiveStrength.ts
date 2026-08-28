/**
 * 세운(annual-year) 최종 Effective Strength orchestration.
 *
 * **책임 분리 — 이름이 오해를 만들지 않도록 명시한다:**
 * - **Transform은 원국(Natal) 전용**이다. 세운 간지는 합 relation의 참여자가 **아니다**.
 *   세운과 원국이 만드는 합(Luck Transform)은 **이번 범위 밖**이다.
 * - **세운은 Clash source로만** 작용한다 (§1.6.8.9 · TBD-01c-source).
 * - "annual effective"는 *세운 시점의* Effective라는 뜻이지, 세운이 Transform을
 *   일으킨다는 뜻이 아니다.
 *
 * 하지 않는 것: Luck Transform · Opening · 개고 magnitude · source severity ·
 * 대운/월운/일운 · Natal Strength/Need/Core/Supplement 변경.
 */

import {
  buildElementEffectiveProfiles,
  composeElementEffectiveScores,
} from "@/lib/saju/effective/composeElementEffectiveScores";
import type { ElementEffectiveProfile, NatalElementScore } from "@/lib/saju/effective/types";
import { buildElementStrengthProfiles } from "@/lib/saju/elements/buildElementStrengthProfiles";
import { toElementStrengthDisplayProfiles } from "@/lib/saju/elements/toElementStrengthDisplayProfiles";
import { buildAnnualClashModifiers } from "@/lib/saju/luck/annual/resolveAnnualClashEffective";
import { buildClashElementDeltas } from "@/lib/saju/luck/clash/buildClashElementDeltas";
import type { ClashRelation, LuckClashTarget } from "@/lib/saju/luck/clash/types";
import { buildTransformElementDeltas } from "@/lib/saju/transform/buildTransformElementDeltas";
import { buildTransformRawModifiers } from "@/lib/saju/transform/buildTransformRawModifiers";
import { detectTransformRelations } from "@/lib/saju/transform/detectTransformRelations";
import { evaluateTransformCandidates } from "@/lib/saju/transform/evaluateTransformCandidates";
import { resolveTransformCompetition } from "@/lib/saju/transform/resolveTransformCompetition";
import type { TransformResolvedModifier } from "@/lib/saju/transform/types";
import type { FourPillars } from "@/lib/saju/types";

export type ResolveAnnualEffectiveStrengthInput = {
  pillars: FourPillars;
  year: number;
};

/**
 * 최종 결과. 중간 산출물(transform relation·candidate·raw modifier, clash key 등)은
 * **노출하지 않는다** — 소비자가 필요로 하는 최소 진단만 싣는다.
 */
export type AnnualEffectiveStrength = {
  /** 이번 평가에 쓰인 세운 target (지지 + 활성 구간). Clash source. */
  target: LuckClashTarget;
  /** 세운 ↔ 원국 육충 관계 전량 (수치는 붕괴돼도 관계는 보존). */
  clashRelations: ClashRelation[];
  /** **원국** Transform의 경합 해소 결과. `modifierActive`가 합성 게이트다. */
  transformModifiers: TransformResolvedModifier[];
  /** 오행별 최종 Effective (Internal unclamped · Display clamp · 파생 Level). */
  effectiveProfiles: ElementEffectiveProfile[];
};

/**
 * FourPillars + 연도 → 원국 Transform + 세운 Clash를 합성한 Effective Strength.
 *
 * Natal Strength / Need / Core / Supplement를 **읽기만** 하고 바꾸지 않는다.
 * 순수 함수이며 입력을 변경하지 않는다.
 */
export function resolveAnnualEffectiveStrength(
  input: ResolveAnnualEffectiveStrengthInput,
): AnnualEffectiveStrength {
  const { pillars } = input;

  // Natal Display 좌표는 여기서 **한 번만** 만든다.
  const displaySet = toElementStrengthDisplayProfiles(buildElementStrengthProfiles(pillars));
  const natalScores: NatalElementScore[] = displaySet.profiles.map((profile) => ({
    element: profile.element,
    natalScore: profile.displayScore,
  }));

  // A. 원국 Transform (L1 → L4). 세운은 참여하지 않는다.
  const candidates = evaluateTransformCandidates(pillars, detectTransformRelations(pillars));
  const transformModifiers = resolveTransformCompetition(
    buildTransformRawModifiers(candidates),
    candidates,
  );
  const transformDeltas = buildTransformElementDeltas(transformModifiers);

  // B. 세운 ↔ 원국 Clash.
  const { target, relations, modifiers } = buildAnnualClashModifiers(input);
  const clashDeltas = buildClashElementDeltas(modifiers);

  // C. 공통 Effective 합성.
  const effectiveProfiles = buildElementEffectiveProfiles(
    composeElementEffectiveScores(natalScores, clashDeltas, transformDeltas),
  );

  return { target, clashRelations: relations, transformModifiers, effectiveProfiles };
}
