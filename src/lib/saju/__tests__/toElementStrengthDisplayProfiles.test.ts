import { describe, expect, it } from "vitest";
import {
  buildElementStrengthProfiles,
  type ElementStrengthLevel,
  type ElementStrengthProfileSet,
} from "@/lib/saju/elements/buildElementStrengthProfiles";
import {
  STRENGTH_DISPLAY_BANDS,
  bandMidpoint,
  buildStrengthDisplayOrdinalTuple,
  compareStrengthDisplayOrdinalTuples,
  displayProfileOf,
  toElementStrengthDisplayProfiles,
} from "@/lib/saju/elements/toElementStrengthDisplayProfiles";
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

function displayFromChart(y: string, m: string, d: string, h: string | "unknown") {
  const profileSet = buildElementStrengthProfiles(chart(y, m, d, h));
  return { profileSet, displaySet: toElementStrengthDisplayProfiles(profileSet) };
}

function scoreMap(set: ReturnType<typeof toElementStrengthDisplayProfiles>) {
  return Object.fromEntries(set.profiles.map((p) => [p.element, p.displayScore])) as Record<
    Element,
    number
  >;
}

function levelMap(set: ElementStrengthProfileSet) {
  return Object.fromEntries(set.profiles.map((p) => [p.element, p.strengthLevel])) as Record<
    Element,
    ElementStrengthLevel
  >;
}

describe("toElementStrengthDisplayProfiles — invariants", () => {
  const fixtures = [
    chart("辛酉", "乙未", "丙申", "戊戌"),
    chart("甲寅", "甲寅", "甲子", "甲子"),
    chart("己卯", "丙子", "戊午", "戊午"),
    chart("己巳", "丁丑", "庚辰", "庚辰"),
    chart("乙酉", "甲申", "甲子", "壬申"),
    chart("乙亥", "乙酉", "甲寅", "甲子"),
  ];

  it("A. every displayScore stays inside its level band", () => {
    for (const pillars of fixtures) {
      const displaySet = toElementStrengthDisplayProfiles(buildElementStrengthProfiles(pillars));
      for (const profile of displaySet.profiles) {
        const band = STRENGTH_DISPLAY_BANDS[profile.strengthLevel];
        expect(profile.displayScore).toBeGreaterThanOrEqual(band.lo);
        expect(profile.displayScore).toBeLessThanOrEqual(band.hi);
        expect(profile.displayScore).not.toBe(0);
        expect(profile.displayScore).not.toBe(100);
      }
    }
  });

  it("B. cross-level scores never invert (VS > S > B > W > VW)", () => {
    for (const pillars of fixtures) {
      const displaySet = toElementStrengthDisplayProfiles(buildElementStrengthProfiles(pillars));
      const byLevel = new Map<ElementStrengthLevel, number[]>();
      for (const profile of displaySet.profiles) {
        const list = byLevel.get(profile.strengthLevel) ?? [];
        list.push(profile.displayScore);
        byLevel.set(profile.strengthLevel, list);
      }

      const maxOf = (level: ElementStrengthLevel) => {
        const values = byLevel.get(level);
        return values && values.length > 0 ? Math.max(...values) : null;
      };
      const minOf = (level: ElementStrengthLevel) => {
        const values = byLevel.get(level);
        return values && values.length > 0 ? Math.min(...values) : null;
      };

      const pairs: Array<[ElementStrengthLevel, ElementStrengthLevel]> = [
        ["very-strong", "strong"],
        ["strong", "balanced"],
        ["balanced", "weak"],
        ["weak", "very-weak"],
      ];
      for (const [higher, lower] of pairs) {
        const hiMin = minOf(higher);
        const loMax = maxOf(lower);
        if (hiMin === null || loMax === null) continue;
        expect(hiMin).toBeGreaterThan(loMax);
      }
    }
  });

  it("C. deterministic for identical input", () => {
    const pillars = chart("辛酉", "乙未", "丙申", "戊戌");
    const a = toElementStrengthDisplayProfiles(buildElementStrengthProfiles(pillars));
    const b = toElementStrengthDisplayProfiles(buildElementStrengthProfiles(pillars));
    expect(a).toEqual(b);
  });

  it("D. shuffling profiles array does not change per-element scores", () => {
    const profileSet = buildElementStrengthProfiles(chart("辛酉", "乙未", "丙申", "戊戌"));
    const reversed: ElementStrengthProfileSet = {
      ...profileSet,
      profiles: [...profileSet.profiles].reverse(),
    };
    const rotated: ElementStrengthProfileSet = {
      ...profileSet,
      profiles: [
        profileSet.profiles[2]!,
        profileSet.profiles[4]!,
        profileSet.profiles[0]!,
        profileSet.profiles[3]!,
        profileSet.profiles[1]!,
      ],
    };

    const base = scoreMap(toElementStrengthDisplayProfiles(profileSet));
    expect(scoreMap(toElementStrengthDisplayProfiles(reversed))).toEqual(base);
    expect(scoreMap(toElementStrengthDisplayProfiles(rotated))).toEqual(base);
  });

  it("E. identical ordinal tuples share the same displayScore", () => {
    const profileSet = buildElementStrengthProfiles(chart("己卯", "丙子", "戊午", "戊午"));
    const balanced = profileSet.profiles.filter((p) => p.strengthLevel === "balanced");
    const displaySet = toElementStrengthDisplayProfiles(profileSet);

    const byTuple = new Map<string, number[]>();
    for (const profile of balanced) {
      const key = buildStrengthDisplayOrdinalTuple(profile).join(",");
      const score = displayProfileOf(displaySet, profile.element).displayScore;
      const list = byTuple.get(key) ?? [];
      list.push(score);
      byTuple.set(key, list);
    }
    for (const scores of byTuple.values()) {
      expect(new Set(scores).size).toBe(1);
    }
  });

  it("F. partial locks every score to level midpoint", () => {
    const profileSet = buildElementStrengthProfiles(chart("辛酉", "乙未", "丙申", "unknown"));
    expect(profileSet.certainty).toBe("partial");
    const displaySet = toElementStrengthDisplayProfiles(profileSet);
    expect(displaySet.certainty).toBe("partial");
    for (const profile of displaySet.profiles) {
      expect(profile.certainty).toBe("partial");
      expect(profile.displayScore).toBe(bandMidpoint(profile.strengthLevel));
      expect(profile.strengthLevel).toBe(
        profileSet.profiles.find((p) => p.element === profile.element)!.strengthLevel,
      );
    }
  });
});

describe("toElementStrengthDisplayProfiles — 1981 golden", () => {
  it("土 > 金 > 火 > 木 > 水 with fixed scores", () => {
    const { profileSet, displaySet } = displayFromChart("辛酉", "乙未", "丙申", "戊戌");
    expect(levelMap(profileSet)).toEqual({
      木: "balanced",
      火: "balanced",
      土: "very-strong",
      金: "strong",
      水: "weak",
    });

    const scores = scoreMap(displaySet);
    expect(scores).toEqual({
      土: 90,
      金: 72,
      火: 60,
      木: 44,
      水: 32,
    });

    expect(scores.土).toBeGreaterThan(scores.金);
    expect(scores.金).toBeGreaterThan(scores.火);
    expect(scores.火).toBeGreaterThan(scores.木);
    expect(scores.木).toBeGreaterThan(scores.水);

    // 火 > 木 from season 휴 > 수 inside balanced
    const fireTuple = buildStrengthDisplayOrdinalTuple(
      profileSet.profiles.find((p) => p.element === "火")!,
    );
    const woodTuple = buildStrengthDisplayOrdinalTuple(
      profileSet.profiles.find((p) => p.element === "木")!,
    );
    expect(compareStrengthDisplayOrdinalTuples(fireTuple, woodTuple)).toBeGreaterThan(0);
  });
});

describe("toElementStrengthDisplayProfiles — other fixtures", () => {
  it("LS-gapin: 木 outermost, 金 innermost", () => {
    const { profileSet, displaySet } = displayFromChart("甲寅", "甲寅", "甲子", "甲子");
    expect(levelMap(profileSet).木).toBe("very-strong");
    expect(levelMap(profileSet).金).toBe("very-weak");
    const scores = scoreMap(displaySet);
    expect(scores.木).toBe(90);
    expect(scores.金).toBe(14);
    expect(scores.木).toBeGreaterThan(scores.金);
    for (const el of ELEMENTS) {
      if (el === "木") continue;
      expect(scores.木).toBeGreaterThan(scores[el]);
    }
  });

  it("NL-2005: 水 strong outer, 火 very-weak inner", () => {
    const { profileSet, displaySet } = displayFromChart("乙酉", "甲申", "甲子", "壬申");
    expect(levelMap(profileSet).水).toBe("strong");
    expect(levelMap(profileSet).火).toBe("very-weak");
    const scores = scoreMap(displaySet);
    expect(scores.水).toBe(72);
    expect(scores.火).toBe(14);
    expect(scores.水).toBeGreaterThan(scores.火);
  });

  it("MX-1990: 土 > 金 > weak 木/水", () => {
    const { profileSet, displaySet } = displayFromChart("己巳", "丁丑", "庚辰", "庚辰");
    expect(levelMap(profileSet).土).toBe("very-strong");
    expect(levelMap(profileSet).金).toBe("strong");
    expect(levelMap(profileSet).木).toBe("weak");
    expect(levelMap(profileSet).水).toBe("weak");
    const scores = scoreMap(displaySet);
    expect(scores.土).toBe(90);
    expect(scores.金).toBe(72);
    expect(scores.土).toBeGreaterThan(scores.金);
    expect(scores.金).toBeGreaterThan(scores.木);
    expect(scores.金).toBeGreaterThan(scores.水);
    expect(STRENGTH_DISPLAY_BANDS.weak.lo).toBeLessThanOrEqual(scores.木);
    expect(scores.木).toBeLessThanOrEqual(STRENGTH_DISPLAY_BANDS.weak.hi);
    expect(STRENGTH_DISPLAY_BANDS.weak.lo).toBeLessThanOrEqual(scores.水);
    expect(scores.水).toBeLessThanOrEqual(STRENGTH_DISPLAY_BANDS.weak.hi);
  });
});

describe("toElementStrengthDisplayProfiles — contract", () => {
  it("always returns 木火土金水 in ELEMENTS order without score on strength profiles", () => {
    const profileSet = buildElementStrengthProfiles(chart("辛酉", "乙未", "丙申", "戊戌"));
    const displaySet = toElementStrengthDisplayProfiles(profileSet);
    expect(displaySet.profiles.map((p) => p.element)).toEqual([...ELEMENTS]);
    expect(displaySet.certainty).toBe("resolved");
    for (const profile of profileSet.profiles) {
      expect("score" in profile).toBe(false);
    }
  });

  it("does not change strengthLevel from the input profile set", () => {
    const profileSet = buildElementStrengthProfiles(chart("乙酉", "甲申", "甲子", "壬申"));
    const displaySet = toElementStrengthDisplayProfiles(profileSet);
    for (const element of ELEMENTS) {
      expect(displayProfileOf(displaySet, element).strengthLevel).toBe(
        profileSet.profiles.find((p) => p.element === element)!.strengthLevel,
      );
    }
  });
});
