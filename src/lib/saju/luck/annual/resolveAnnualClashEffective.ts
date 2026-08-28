/**
 * 세운(annual-year) ↔ 원국 generic 육충 Effective 파이프라인 orchestration
 * (TBD-01c-wiring · W3 · 7단계).
 *
 * 기존 annual Supplement 흐름(`resolveAnnualSupplementFlowV2`)과 **별도 축**이다.
 * 그쪽은 Core/Supplement/Need 축이고 `FourPillars`를 받지 않으며 `coreBlocksAnnual`
 * skip 경로가 있다. 충 감쇠는 Strength 축이고 Core 해석 성패와 무관하게 계산돼야 하므로
 * 섞지 않는다.
 *
 * 배치: `annual/`이 generic `clash/`를 **소비**한다 (§1.6.8.10.7 W3). 역방향 의존 없음.
 *
 * 하지 않는 것: Natal Strength/Need/Core/Supplement 변경 · 기존 annual evidence 변경 ·
 * Transform/Opening modifier 합성 · source severity · 대운/월운/일운.
 */

import { buildElementStrengthProfiles } from "@/lib/saju/elements/buildElementStrengthProfiles";
import { toElementStrengthDisplayProfiles } from "@/lib/saju/elements/toElementStrengthDisplayProfiles";
import { buildAnnualTarget } from "@/lib/saju/luck/annual/buildAnnualTarget";
import type { AnnualTarget } from "@/lib/saju/luck/annual/types";
import { buildClashAttenuationModifiers } from "@/lib/saju/luck/clash/buildClashAttenuationModifiers";
import { buildClashEffectiveProfiles } from "@/lib/saju/luck/clash/buildClashEffectiveProfiles";
import { buildClashEffectiveScores } from "@/lib/saju/luck/clash/buildClashEffectiveScores";
import { buildNatalClashSnapshot } from "@/lib/saju/luck/clash/buildNatalClashSnapshot";
import { collapseClashAttenuationKeys } from "@/lib/saju/luck/clash/collapseClashAttenuationKeys";
import { detectLuckClashRelations } from "@/lib/saju/luck/clash/detectLuckClashRelations";
import type {
  ClashEffectiveProfile,
  ClashRelation,
  LuckClashTarget,
  NatalElementScore,
} from "@/lib/saju/luck/clash/types";
import type { FourPillars } from "@/lib/saju/types";

/**
 * `AnnualTarget` → generic `LuckClashTarget`.
 *
 * 충 판정에 쓰이는 것은 지지와 활성 구간뿐이다. `year` · `boundaryBasis` ·
 * `stem` · `stemElement` · `branchMainElement`는 **넘기지 않는다** — 넘기면
 * 대운·월운·일운 확장 시 detector를 다시 써야 한다(§1.6.8.10.4).
 *
 * `window`는 시작 포함 · 끝 배타이며, Date를 복사해 원본 mutation을 차단한다.
 */
export function toLuckClashTarget(target: AnnualTarget): LuckClashTarget {
  return {
    luckKind: "annual-year",
    branch: target.branch,
    window: {
      start: new Date(target.windowStart.getTime()),
      end: new Date(target.windowEnd.getTime()),
    },
  };
}

export type ResolveAnnualClashEffectiveInput = {
  pillars: FourPillars;
  year: number;
};

/**
 * 세운 충 Effective 결과. 기존 annual evidence와 **별개의 파생 결과**다.
 */
export type AnnualClashEffective = {
  /** 이번 평가에 쓰인 generic target (지지 + 활성 구간). */
  target: LuckClashTarget;
  /** 탐지된 육충 관계 전량 (L1-S — 수치는 붕괴돼도 관계는 보존). */
  relations: ClashRelation[];
  /** 오행별 Effective. 피격 없으면 attenuation 0, Natal 그대로. */
  profiles: ClashEffectiveProfile[];
};

/**
 * FourPillars + 연도 → 세운 충 Effective.
 *
 * Natal Strength / Need / Core / Supplement를 **읽지도 바꾸지도 않는다**
 * (Display Score 좌표만 경계에서 빌려 쓴다). 순수 함수이며 입력을 변경하지 않는다.
 */
export function resolveAnnualClashEffective(
  input: ResolveAnnualClashEffectiveInput,
): AnnualClashEffective {
  const { pillars, year } = input;

  const displaySet = toElementStrengthDisplayProfiles(buildElementStrengthProfiles(pillars));
  const natalScores: NatalElementScore[] = displaySet.profiles.map((profile) => ({
    element: profile.element,
    natalScore: profile.displayScore,
  }));

  const snapshot = buildNatalClashSnapshot(pillars);
  const target = toLuckClashTarget(buildAnnualTarget(year));

  const relations = detectLuckClashRelations(snapshot, [target]);
  const keys = collapseClashAttenuationKeys(snapshot, relations);
  const modifiers = buildClashAttenuationModifiers(keys);
  const profiles = buildClashEffectiveProfiles(
    buildClashEffectiveScores(natalScores, modifiers),
  );

  return { target, relations, profiles };
}
