import { describe, expect, it } from "vitest";
import {
  buildElementStrengthProfiles,
  profileOf,
  resolveElementRootStatus,
  type ElementStrengthLevel,
} from "@/lib/saju/elements/buildElementStrengthProfiles";
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

type ExpectedLevels = Record<Element, ElementStrengthLevel>;

function expectLevels(pillars: FourPillars, expected: ExpectedLevels): void {
  const set = buildElementStrengthProfiles(pillars);
  expect(set.profiles).toHaveLength(5);
  expect(set.profiles.map((p) => p.element)).toEqual([...ELEMENTS]);
  for (const element of ELEMENTS) {
    expect(profileOf(set, element).strengthLevel).toBe(expected[element]);
    expect(profileOf(set, element)).not.toHaveProperty("score");
  }
}

describe("buildElementStrengthProfiles v1 — golden fixtures", () => {
  it("MX-1981 辛酉/乙未/丙申/戊戌", () => {
    expectLevels(chart("辛酉", "乙未", "丙申", "戊戌"), {
      木: "balanced",
      火: "balanced",
      土: "very-strong",
      金: "strong",
      水: "weak",
    });
  });

  it("LS-gapin 甲寅/甲寅/甲子/甲子", () => {
    expectLevels(chart("甲寅", "甲寅", "甲子", "甲子"), {
      木: "very-strong",
      火: "weak",
      土: "weak",
      金: "very-weak",
      水: "balanced",
    });
  });

  it("MX-gimo 己卯/丙子/戊午/戊午", () => {
    expectLevels(chart("己卯", "丙子", "戊午", "戊午"), {
      木: "balanced",
      火: "balanced",
      土: "balanced",
      金: "very-weak",
      水: "balanced",
    });
  });

  it("MX-1990 己巳/丁丑/庚辰/庚辰", () => {
    expectLevels(chart("己巳", "丁丑", "庚辰", "庚辰"), {
      木: "weak",
      火: "balanced",
      土: "very-strong",
      金: "strong",
      水: "weak",
    });
  });

  it("NL-2005 乙酉/甲申/甲子/壬申", () => {
    expectLevels(chart("乙酉", "甲申", "甲子", "壬申"), {
      木: "weak",
      火: "very-weak",
      土: "weak",
      金: "balanced",
      水: "strong",
    });
  });

  it("LW-eulhae 乙亥/乙酉/甲寅/甲子", () => {
    expectLevels(chart("乙亥", "乙酉", "甲寅", "甲子"), {
      木: "balanced",
      火: "weak",
      土: "weak",
      金: "balanced",
      水: "balanced",
    });
  });
});

describe("buildElementStrengthProfiles v1 — hourUnknown + guards", () => {
  it("hourUnknown uses partial evidence and does not invent hour weakness", () => {
    const set = buildElementStrengthProfiles(chart("辛酉", "乙未", "丙申", "unknown"));
    expect(set.certainty).toBe("partial");
    expect(set.omittedSlots).toContain("hour");
    for (const profile of set.profiles) {
      expect(profile.reasons).toContain("hour-unknown-partial");
      expect(profile.rawEvidence.visibleSlots).not.toContain("hour");
      expect(profile.rawEvidence.rootedSlots).not.toContain("hour");
      expect(profile.rawEvidence.rootHits.every((hit) => hit.slot !== "hour")).toBe(true);
    }
  });

  it("does not expose score on profiles", () => {
    const set = buildElementStrengthProfiles(chart("辛酉", "乙未", "丙申", "戊戌"));
    for (const profile of set.profiles) {
      expect("score" in profile).toBe(false);
    }
  });

  it("resolveElementRootStatus follows 정기 > 중기 > 여기", () => {
    expect(resolveElementRootStatus([])).toBe("root-absent");
    expect(
      resolveElementRootStatus([
        { slot: "month", branch: "未", hiddenStem: "丁", role: "여기", polarity: "비견" },
      ]),
    ).toBe("root-shallow");
    expect(
      resolveElementRootStatus([
        { slot: "month", branch: "未", hiddenStem: "乙", role: "중기", polarity: "비견" },
      ]),
    ).toBe("root-present");
    expect(
      resolveElementRootStatus([
        { slot: "month", branch: "未", hiddenStem: "己", role: "정기", polarity: "비견" },
        { slot: "day", branch: "申", hiddenStem: "戊", role: "여기", polarity: "겁재" },
      ]),
    ).toBe("root-clear");
  });
});

describe("buildElementStrengthProfiles v1 — MX-1981 trace", () => {
  it("reports evidence axes for each element", () => {
    const set = buildElementStrengthProfiles(chart("辛酉", "乙未", "丙申", "戊戌"));
    expect(set.certainty).toBe("complete");

    const wood = profileOf(set, "木");
    expect(wood.rawEvidence.seasonPhase).toBe("수");
    expect(wood.rawEvidence.presence).toBe("rooted-visible");
    expect(resolveElementRootStatus(wood.rawEvidence.rootHits)).toBe("root-present");
    expect(wood.rawEvidence.visibleSlots).toEqual(["month"]);
    expect(wood.strengthLevel).toBe("balanced");

    const fire = profileOf(set, "火");
    expect(fire.rawEvidence.seasonPhase).toBe("휴");
    expect(fire.rawEvidence.presence).toBe("rooted-visible");
    expect(fire.strengthLevel).toBe("balanced");

    const earth = profileOf(set, "土");
    expect(earth.rawEvidence.seasonPhase).toBe("왕");
    expect(earth.rawEvidence.presence).toBe("rooted-visible");
    expect(resolveElementRootStatus(earth.rawEvidence.rootHits)).toBe("root-clear");
    expect(earth.rawEvidence.exactStemVisible).toBe(true);
    expect(earth.strengthLevel).toBe("very-strong");

    const metal = profileOf(set, "金");
    expect(metal.rawEvidence.seasonPhase).toBe("상");
    expect(metal.rawEvidence.presence).toBe("rooted-visible");
    expect(resolveElementRootStatus(metal.rawEvidence.rootHits)).toBe("root-clear");
    expect(metal.strengthLevel).toBe("strong");

    const water = profileOf(set, "水");
    expect(water.rawEvidence.seasonPhase).toBe("사");
    expect(water.rawEvidence.presence).toBe("hidden-only");
    expect(resolveElementRootStatus(water.rawEvidence.rootHits)).toBe("root-present");
    expect(water.rawEvidence.visibleSlots).toEqual([]);
    expect(water.strengthLevel).toBe("weak");
  });
});
