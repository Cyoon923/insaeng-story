/**
 * 대운 ↔ 원국 generic 육충 Effective (TBD-01c-source).
 *
 * 세운(`luck/annual`)과 **동일한 clash 파이프라인을 재사용**한다 —
 * source만 `decade`로 바뀔 뿐 δ·collapse·Effective 규칙은 전부 동일하다
 * (§1.6.8.9.5: source별 가중 없음, 수치 계층 단일 상수).
 *
 * 하지 않는 것: 대운 간지 산출 · Luck Transform · Opening · 월운/일운 ·
 * Natal Strength/Need/Core/Supplement 변경.
 */

import { buildElementStrengthProfiles } from "@/lib/saju/elements/buildElementStrengthProfiles";
import { toElementStrengthDisplayProfiles } from "@/lib/saju/elements/toElementStrengthDisplayProfiles";
import { buildClashAttenuationModifiers } from "@/lib/saju/luck/clash/buildClashAttenuationModifiers";
import { buildClashEffectiveProfiles } from "@/lib/saju/luck/clash/buildClashEffectiveProfiles";
import { buildClashEffectiveScores } from "@/lib/saju/luck/clash/buildClashEffectiveScores";
import { buildNatalClashSnapshot } from "@/lib/saju/luck/clash/buildNatalClashSnapshot";
import { collapseClashAttenuationKeys } from "@/lib/saju/luck/clash/collapseClashAttenuationKeys";
import { detectLuckClashRelations } from "@/lib/saju/luck/clash/detectLuckClashRelations";
import type {
  ClashAttenuationModifier,
  ClashEffectiveProfile,
  ClashRelation,
  LuckClashTarget,
  NatalElementScore,
} from "@/lib/saju/luck/clash/types";
import type { DecadeLuckInput } from "@/lib/saju/luck/decade/types";
import type { FourPillars } from "@/lib/saju/types";

/**
 * 계산된 대운 → generic `LuckClashTarget`.
 *
 * `stem`은 넘기지 않는다 — 지지 육충 판정에 쓰이지 않으며, generic target에
 * kind 전용 필드를 넣지 않는 계약(§1.6.8.10.4)을 따른다.
 * Date는 복사해 원본 mutation을 차단한다.
 */
export function toDecadeClashTarget(decade: DecadeLuckInput): LuckClashTarget {
  return {
    luckKind: "decade",
    branch: decade.branch,
    window: {
      start: new Date(decade.windowStart.getTime()),
      end: new Date(decade.windowEnd.getTime()),
    },
  };
}

export type ResolveDecadeClashEffectiveInput = {
  pillars: FourPillars;
  /** 이미 산출된 대운. 이 모듈은 간지를 계산하지 않는다. */
  decade: DecadeLuckInput;
};

export type DecadeClashModifiers = {
  target: LuckClashTarget;
  relations: ClashRelation[];
  modifiers: ClashAttenuationModifier[];
};

/** 대운 충의 modifier 단계까지. Natal Strength/Display를 읽지 않는다. */
export function buildDecadeClashModifiers(
  input: ResolveDecadeClashEffectiveInput,
): DecadeClashModifiers {
  const snapshot = buildNatalClashSnapshot(input.pillars);
  const target = toDecadeClashTarget(input.decade);
  const relations = detectLuckClashRelations(snapshot, [target]);
  const modifiers = buildClashAttenuationModifiers(
    collapseClashAttenuationKeys(snapshot, relations),
  );
  return { target, relations, modifiers };
}

export type DecadeClashEffective = {
  target: LuckClashTarget;
  relations: ClashRelation[];
  profiles: ClashEffectiveProfile[];
};

/**
 * FourPillars + 계산된 대운 → 대운 충 Effective.
 * 순수 함수이며 입력을 변경하지 않는다.
 */
export function resolveDecadeClashEffective(
  input: ResolveDecadeClashEffectiveInput,
): DecadeClashEffective {
  const displaySet = toElementStrengthDisplayProfiles(
    buildElementStrengthProfiles(input.pillars),
  );
  const natalScores: NatalElementScore[] = displaySet.profiles.map((profile) => ({
    element: profile.element,
    natalScore: profile.displayScore,
  }));

  const { target, relations, modifiers } = buildDecadeClashModifiers(input);
  const profiles = buildClashEffectiveProfiles(
    buildClashEffectiveScores(natalScores, modifiers),
  );

  return { target, relations, profiles };
}
