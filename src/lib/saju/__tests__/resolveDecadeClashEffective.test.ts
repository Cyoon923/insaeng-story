/**
 * 대운 ↔ 원국 clash — 계산된 대운 입력을 받는 boundary.
 * 대운 간지 산출 · Luck Transform · Opening · 월운/일운은 범위 밖이다.
 */
import { describe, expect, it } from "vitest";
import { buildElementStrengthProfiles } from "@/lib/saju/elements/buildElementStrengthProfiles";
import { buildNeedResolution } from "@/lib/saju/elements/needResolution";
import { toElementStrengthDisplayProfiles } from "@/lib/saju/elements/toElementStrengthDisplayProfiles";
import { resolveAnnualClashEffective } from "@/lib/saju/luck/annual/resolveAnnualClashEffective";
import {
  buildDecadeClashModifiers,
  resolveDecadeClashEffective,
  toDecadeClashTarget,
} from "@/lib/saju/luck/decade/resolveDecadeClashEffective";
import type { DecadeLuckInput } from "@/lib/saju/luck/decade/types";
import type { Branch, FourPillars, HourPillar, Pillar, Stem } from "@/lib/saju/types";
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
/** 이미 계산된 대운 (산출은 이 모듈 밖의 책임). */
function decade(stem: Stem, branch: Branch): DecadeLuckInput {
  return {
    stem,
    branch,
    windowStart: new Date("2024-03-01T00:00:00Z"),
    windowEnd: new Date("2034-03-01T00:00:00Z"),
  };
}

describe("toDecadeClashTarget", () => {
  it("luckKind decade · branch · window만 넘긴다", () => {
    const target = toDecadeClashTarget(decade("丙", "午"));
    expect(Object.keys(target).sort()).toEqual(["branch", "luckKind", "window"]);
    expect(target.luckKind).toBe("decade");
    expect(target.branch).toBe("午");
    for (const forbidden of ["stem", "windowStart", "windowEnd", "year"]) {
      expect(target).not.toHaveProperty(forbidden);
    }
  });

  it("window 값을 보존하고 Date를 복사한다", () => {
    const input = decade("丙", "午");
    const start = input.windowStart.getTime();
    const target = toDecadeClashTarget(input);
    expect(target.window.start.getTime()).toBe(start);
    expect(target.window.end.getTime()).toBe(input.windowEnd.getTime());
    target.window.start.setFullYear(1999);
    expect(input.windowStart.getTime()).toBe(start);
  });
});

describe("대운 clash 탐지", () => {
  it("대운 지지가 원국과 충하지 않으면 attenuation 0", () => {
    const result = resolveDecadeClashEffective({
      pillars: chart("甲寅", "乙卯", "丙辰", "丁巳"),
      decade: decade("庚", "午"), // 午의 충 상대 子가 원국에 없음
    });
    expect(result.relations).toEqual([]);
    for (const profile of result.profiles) expect(profile.attenuation).toBe(0);
  });

  it("원국 1슬롯과 충하면 그 슬롯 rootElements만 δ=4", () => {
    const result = resolveDecadeClashEffective({
      pillars: chart("甲寅", "乙卯", "丙子", "丁巳"),
      decade: decade("庚", "午"), // 子午충
    });
    expect(result.relations).toHaveLength(1);
    expect(result.relations[0]!.natalSlot).toBe("day");
    expect(result.relations[0]!.source).toBe("decade");
    expect(result.relations[0]!.clashPairId).toBe("clash-zi-wu");

    const water = result.profiles.find((p) => p.element === "水")!;
    expect(water.attenuation).toBe(4); // 子 = 癸 정기 → 水만
    for (const element of ELEMENTS) {
      if (element !== "水") {
        expect(result.profiles.find((p) => p.element === element)!.attenuation).toBe(0);
      }
    }
  });

  it("같은 지지가 원국 여러 슬롯과 충하면 슬롯별로 누적된다", () => {
    const result = resolveDecadeClashEffective({
      pillars: chart("甲子", "乙卯", "丙子", "丁巳"),
      decade: decade("庚", "午"),
    });
    expect(result.relations).toHaveLength(2);
    expect(result.profiles.find((p) => p.element === "水")!.attenuation).toBe(8);
  });

  it("hour unknown이면 hour relation이 생기지 않는다", () => {
    const result = resolveDecadeClashEffective({
      pillars: chart("甲寅", "乙卯", "丙辰", "unknown"),
      decade: decade("庚", "午"),
    });
    for (const relation of result.relations) expect(relation.natalSlot).not.toBe("hour");
  });
});

describe("세운 경로와의 동등성 · 불변 계약", () => {
  it("같은 지지라면 세운과 대운의 감쇠 숫자가 같다 (source 가중 없음)", () => {
    const pillars = chart("甲子", "乙丑", "丙寅", "丁卯");
    // 2026 세운 = 丙午 → 지지 午. 대운도 午로 맞춘다.
    const annual = resolveAnnualClashEffective({ pillars, year: 2026 });
    const decadeResult = resolveDecadeClashEffective({ pillars, decade: decade("庚", "午") });

    expect(annual.relations.map((r) => r.natalSlot)).toEqual(
      decadeResult.relations.map((r) => r.natalSlot),
    );
    for (const profile of decadeResult.profiles) {
      const same = annual.profiles.find((p) => p.element === profile.element)!;
      expect(profile.attenuation).toBe(same.attenuation);
      expect(profile.internalEffectiveScore).toBe(same.internalEffectiveScore);
      expect(profile.effectiveStrengthLevel).toBe(same.effectiveStrengthLevel);
    }
    // source만 다르다
    expect(decadeResult.relations.every((r) => r.source === "decade")).toBe(true);
    expect(annual.relations.every((r) => r.source === "annual-year")).toBe(true);
  });

  it("Natal Strength profile과 Need가 전후 동일하다", () => {
    const pillars = chart("甲子", "乙丑", "丙寅", "丁卯");
    const strengthBefore = toElementStrengthDisplayProfiles(buildElementStrengthProfiles(pillars));
    const needBefore = buildNeedResolution(pillars);

    resolveDecadeClashEffective({ pillars, decade: decade("庚", "午") });

    expect(toElementStrengthDisplayProfiles(buildElementStrengthProfiles(pillars))).toEqual(
      strengthBefore,
    );
    expect(buildNeedResolution(pillars)).toEqual(needBefore);
  });

  it("FourPillars와 대운 입력을 변경하지 않는다", () => {
    const pillars = chart("甲子", "乙丑", "丙寅", "丁卯");
    const input = decade("庚", "午");
    const pillarsBefore = JSON.parse(JSON.stringify(pillars));
    const decadeBefore = JSON.parse(JSON.stringify(input));

    resolveDecadeClashEffective({ pillars, decade: input });

    expect(JSON.parse(JSON.stringify(pillars))).toEqual(pillarsBefore);
    expect(JSON.parse(JSON.stringify(input))).toEqual(decadeBefore);
  });

  it("modifier 경계도 노출되고 결정론적이다", () => {
    const pillars = chart("甲子", "乙丑", "丙寅", "丁卯");
    const input = decade("庚", "午");
    const a = buildDecadeClashModifiers({ pillars, decade: input });
    expect(a.modifiers.length).toBeGreaterThan(0);
    expect(a).toEqual(buildDecadeClashModifiers({ pillars, decade: input }));
    expect(resolveDecadeClashEffective({ pillars, decade: input })).toEqual(
      resolveDecadeClashEffective({ pillars, decade: input }),
    );
  });
});
