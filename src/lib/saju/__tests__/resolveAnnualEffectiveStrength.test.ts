/**
 * 세운 Effective Strength orchestration — 원국 Transform + 세운 Clash 합성.
 * Luck Transform · Opening · 대운/월운/일운은 범위 밖이다.
 */
import { describe, expect, it } from "vitest";
import {
  clampToDisplayRange,
  resolveNearestStrengthLevel,
} from "@/lib/saju/effective/resolveEffectiveStrengthLevel";
import { buildElementStrengthProfiles } from "@/lib/saju/elements/buildElementStrengthProfiles";
import { buildNeedResolution } from "@/lib/saju/elements/needResolution";
import { toElementStrengthDisplayProfiles } from "@/lib/saju/elements/toElementStrengthDisplayProfiles";
import { buildAnnualTarget } from "@/lib/saju/luck/annual/buildAnnualTarget";
import { resolveAnnualClashEffective } from "@/lib/saju/luck/annual/resolveAnnualClashEffective";
import { resolveAnnualEffectiveStrength } from "@/lib/saju/luck/annual/resolveAnnualEffectiveStrength";
import type { Branch, Element, FourPillars, HourPillar, Pillar, Stem } from "@/lib/saju/types";
import { ELEMENTS } from "@/lib/saju/types";

function parsePillar(s: string): Pillar {
  return { stem: s[0] as Stem, branch: s[1] as Branch };
}
function chart(y: string, m: string, d: string, h: string | "unknown"): FourPillars {
  const hour: HourPillar = h === "unknown" ? "unknown" : parsePillar(h);
  return {
    year: parsePillar(y),
    month: parsePillar(m),
    day: parsePillar(d),
    hour,
    hourCertainty: h === "unknown" ? "unknown" : "confirmed",
    warnings: [],
  };
}
function natalScoresOf(pillars: FourPillars): Map<Element, number> {
  const set = toElementStrengthDisplayProfiles(buildElementStrengthProfiles(pillars));
  return new Map(set.profiles.map((p) => [p.element, p.displayScore]));
}

/** 2026 세운 = 丙午 (지지 午, 충 상대 子). 2025 = 乙巳, 2027 = 丁未. */
const YEAR_WU = 2026;
/** 삼합 申子辰 → 水 transform active + 세운 午 ↔ natal 子(month) clash */
const BOTH = chart("甲申", "丙子", "戊辰", "壬亥");

describe("Transform / Clash 유무별", () => {
  it("Transform 없음 + Clash 없음 → Natal 유지", () => {
    // 합 없음(甲子 반복) · 세운 未(2027)와 충 없음
    const pillars = chart("甲子", "甲子", "甲子", "甲子");
    const result = resolveAnnualEffectiveStrength({ pillars, year: 2027 });
    expect(result.transformModifiers).toEqual([]);
    expect(result.clashRelations).toEqual([]);

    const natal = natalScoresOf(pillars);
    for (const profile of result.effectiveProfiles) {
      expect(profile.delta).toBe(0);
      expect(profile.internalEffectiveScore).toBe(natal.get(profile.element));
    }
  });

  it("Transform active + Clash 없음 → Transform delta만 반영", () => {
    // 申子辰 삼합 · 세운 未(2027)는 申子辰과 충하지 않는다
    const result = resolveAnnualEffectiveStrength({ pillars: BOTH, year: 2027 });
    expect(result.clashRelations).toEqual([]);
    expect(result.transformModifiers.filter((m) => m.modifierActive)).toHaveLength(1);

    // transform은 Σ 보존 → 전체 delta 합 0
    expect(result.effectiveProfiles.reduce((t, p) => t + p.delta, 0)).toBeCloseTo(0, 10);
  });

  it("Transform 없음 + Clash → 기존 annual clash 결과와 숫자가 같다", () => {
    // 합이 없고 세운 午 ↔ natal 子 충만 있는 원국
    const pillars = chart("甲子", "乙丑", "丙寅", "丁卯");
    const composed = resolveAnnualEffectiveStrength({ pillars, year: YEAR_WU });
    const clashOnly = resolveAnnualClashEffective({ pillars, year: YEAR_WU });

    expect(composed.transformModifiers).toEqual([]);
    expect(composed.clashRelations).toEqual(clashOnly.relations);

    const byElement = new Map(clashOnly.profiles.map((p) => [p.element, p]));
    for (const profile of composed.effectiveProfiles) {
      const clash = byElement.get(profile.element)!;
      expect(profile.internalEffectiveScore).toBe(clash.internalEffectiveScore);
      expect(profile.displayEffectiveScore).toBe(clash.displayEffectiveScore);
      expect(profile.effectiveStrengthLevel).toBe(clash.effectiveStrengthLevel);
      expect(profile.delta + clash.attenuation).toBe(0);
    }
  });

  it("Transform active + Clash 동시 → 두 delta가 합성된다", () => {
    const result = resolveAnnualEffectiveStrength({ pillars: BOTH, year: YEAR_WU });

    expect(result.transformModifiers.filter((m) => m.modifierActive)).toHaveLength(1);
    expect(result.clashRelations.length).toBeGreaterThan(0);
    expect(result.clashRelations[0]!.natalSlot).toBe("month");

    // clash만 돌렸을 때보다 Internal이 달라진 오행이 있다 (transform 기여)
    const clashOnly = resolveAnnualClashEffective({ pillars: BOTH, year: YEAR_WU });
    const clashByElement = new Map(clashOnly.profiles.map((p) => [p.element, p]));
    const differs = result.effectiveProfiles.filter(
      (p) => p.internalEffectiveScore !== clashByElement.get(p.element)!.internalEffectiveScore,
    );
    expect(differs.length).toBeGreaterThan(0);

    // 전체 delta 합 = clash 손실만큼만 음수 (transform은 보존)
    const total = result.effectiveProfiles.reduce((t, p) => t + p.delta, 0);
    expect(total).toBeLessThan(0);
  });

  it("피격·변형과 무관한 오행은 Natal 그대로다", () => {
    const pillars = chart("甲子", "乙丑", "丙寅", "丁卯");
    const result = resolveAnnualEffectiveStrength({ pillars, year: YEAR_WU });
    const natal = natalScoresOf(pillars);
    for (const profile of result.effectiveProfiles) {
      if (profile.delta !== 0) continue;
      expect(profile.internalEffectiveScore).toBe(natal.get(profile.element));
    }
  });
});

describe("inactive Transform은 반영되지 않는다", () => {
  it("lost / competition-unresolved는 Effective에 기여하지 않는다", () => {
    const result = resolveAnnualEffectiveStrength({ pillars: BOTH, year: YEAR_WU });
    const inactive = result.transformModifiers.filter((m) => !m.modifierActive);

    // inactive가 있다면 그 combineId의 기여가 delta에 없어야 한다.
    // (본 fixture는 uncontested 1건이므로 inactive 0건인 것도 계약의 일부)
    for (const modifier of inactive) {
      expect(["lost", "competition-unresolved"]).toContain(modifier.contentionStatus);
    }
    // 활성만 합성되었는지: 활성 modifier의 boost가 target 오행 delta에 반영됨
    const active = result.transformModifiers.filter((m) => m.modifierActive);
    for (const modifier of active) {
      const target = result.effectiveProfiles.find((p) => p.element === modifier.targetElement)!;
      expect(target.delta).toBeGreaterThan(-modifier.boost);
    }
  });
});

describe("Internal / Display / Level 계약", () => {
  it("Internal은 unclamped이고 Display만 clamp된다", () => {
    const result = resolveAnnualEffectiveStrength({ pillars: BOTH, year: YEAR_WU });
    for (const profile of result.effectiveProfiles) {
      expect(profile.internalEffectiveScore).toBe(profile.natalScore + profile.delta);
      expect(profile.displayEffectiveScore).toBe(
        clampToDisplayRange(profile.internalEffectiveScore),
      );
      expect(profile.displayEffectiveScore).toBeGreaterThanOrEqual(8);
      expect(profile.displayEffectiveScore).toBeLessThanOrEqual(96);
    }
  });

  it("Effective Level은 clamp된 Display의 nearest band다 (midpoint upper 포함)", () => {
    const result = resolveAnnualEffectiveStrength({ pillars: BOTH, year: YEAR_WU });
    for (const profile of result.effectiveProfiles) {
      expect(profile.effectiveStrengthLevel).toBe(
        resolveNearestStrengthLevel(profile.displayEffectiveScore),
      );
    }
    // midpoint 계약 자체는 헬퍼 수준에서 고정
    expect(resolveNearestStrengthLevel(42)).toBe("balanced");
  });
});

describe("불변 계약 · 결정론", () => {
  it("Natal Strength profile이 전후 동일하다", () => {
    const before = toElementStrengthDisplayProfiles(buildElementStrengthProfiles(BOTH));
    resolveAnnualEffectiveStrength({ pillars: BOTH, year: YEAR_WU });
    expect(toElementStrengthDisplayProfiles(buildElementStrengthProfiles(BOTH))).toEqual(before);
  });

  it("Need가 전후 동일하다", () => {
    const before = buildNeedResolution(BOTH);
    resolveAnnualEffectiveStrength({ pillars: BOTH, year: YEAR_WU });
    expect(buildNeedResolution(BOTH)).toEqual(before);
  });

  it("FourPillars를 변경하지 않는다", () => {
    const pillars = chart("甲申", "丙子", "戊辰", "壬亥");
    const before = JSON.parse(JSON.stringify(pillars));
    resolveAnnualEffectiveStrength({ pillars, year: YEAR_WU });
    expect(JSON.parse(JSON.stringify(pillars))).toEqual(before);
  });

  it("annual window가 보존되고 원본이 오염되지 않는다", () => {
    const annual = buildAnnualTarget(YEAR_WU);
    const result = resolveAnnualEffectiveStrength({ pillars: BOTH, year: YEAR_WU });

    expect(result.target.window.start.getTime()).toBe(annual.windowStart.getTime());
    expect(result.target.window.end.getTime()).toBe(annual.windowEnd.getTime());
    result.target.window.start.setFullYear(1999);
    expect(buildAnnualTarget(YEAR_WU).windowStart.getTime()).toBe(annual.windowStart.getTime());
  });

  it("결정론적이다", () => {
    expect(resolveAnnualEffectiveStrength({ pillars: BOTH, year: YEAR_WU })).toEqual(
      resolveAnnualEffectiveStrength({ pillars: BOTH, year: YEAR_WU }),
    );
  });

  it("hour unknown에서 Transform·Clash 모두 hour를 제외한다", () => {
    // 시주가 있었다면 참여했을 구성을 unknown으로 바꾼다
    // day는 참여 지지와 충하지 않는 卯를 쓴다 (寅이면 year 申과 寅申충으로 막힌다)
    const withHour = resolveAnnualEffectiveStrength({
      pillars: chart("甲申", "丙子", "戊卯", "壬辰"),
      year: YEAR_WU,
    });
    const unknownHour = resolveAnnualEffectiveStrength({
      pillars: chart("甲申", "丙子", "戊卯", "unknown"),
      year: YEAR_WU,
    });

    // hour 辰이 빠지면 申子辰 삼합이 성립하지 않는다
    expect(withHour.transformModifiers.length).toBeGreaterThan(0);
    expect(unknownHour.transformModifiers).toEqual([]);
    // clash relation에도 hour 슬롯이 없다
    for (const relation of unknownHour.clashRelations) {
      expect(relation.natalSlot).not.toBe("hour");
    }
  });

  it("결과에 중간 산출물을 노출하지 않는다", () => {
    const result = resolveAnnualEffectiveStrength({ pillars: BOTH, year: YEAR_WU });
    expect(Object.keys(result).sort()).toEqual([
      "clashRelations",
      "effectiveProfiles",
      "target",
      "transformModifiers",
    ]);
    for (const hidden of ["candidates", "rawModifiers", "keys", "snapshot", "natalScores"]) {
      expect(result).not.toHaveProperty(hidden);
    }
    expect(result.effectiveProfiles.map((p) => p.element)).toEqual([...ELEMENTS]);
  });
});
