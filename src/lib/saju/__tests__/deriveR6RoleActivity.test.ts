import { describe, expect, it } from "vitest";
import { deriveR6RoleActivity } from "@/lib/saju/final/deriveR6RoleActivity";
import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { analyzeElementPresence } from "@/lib/saju/elements/presence";
import type { FourPillars, HourPillar, Pillar } from "@/lib/saju/types";

function chart(partial: {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  hour: HourPillar;
}): FourPillars {
  return {
    ...partial,
    hourCertainty: partial.hour === "unknown" ? "unknown" : "confirmed",
    warnings: [],
  };
}

describe("deriveR6RoleActivity", () => {
  it("returns C when resolved axes are closed by clear mitigation (balanced)", () => {
    const pillars = chart({
      year: { stem: "己", branch: "卯" },
      month: { stem: "丙", branch: "子" },
      day: { stem: "戊", branch: "午" },
      hour: { stem: "戊", branch: "午" },
    });
    const climate = buildAdjustedClimateSummary(pillars);

    expect(climate.baseClimate).toEqual({ temperature: "cold", moisture: "moist" });
    expect(climate.temperature).toEqual({
      status: "resolved",
      value: "balanced",
      outcome: "balanced",
    });
    expect(climate.moisture).toEqual({
      status: "resolved",
      value: "balanced",
      outcome: "balanced",
    });
    expect(climate.mitigationFactors.length).toBeGreaterThan(0);

    expect(deriveR6RoleActivity({ pillars, climate })).toBe("C");
  });

  it("returns B when climate factors exist but polar bias remains", () => {
    const pillars = chart({
      year: { stem: "甲", branch: "辰" },
      month: { stem: "丙", branch: "午" },
      day: { stem: "丁", branch: "酉" },
      hour: { stem: "庚", branch: "申" },
    });
    const climate = buildAdjustedClimateSummary(pillars);

    expect(climate.temperature).toEqual({
      status: "resolved",
      value: "warm",
      outcome: "unchanged",
    });
    expect(climate.moisture).toEqual({
      status: "resolved",
      value: "dry",
      outcome: "unchanged",
    });
    expect(climate.fireQuality).not.toBe("absent");
    expect(
      climate.mitigationFactors.length + climate.reinforcementFactors.length,
    ).toBeGreaterThan(0);

    expect(deriveR6RoleActivity({ pillars, climate })).toBe("B");
  });

  it("returns B and never C when climate is contested/partial mitigation", () => {
    const contested = chart({
      year: { stem: "壬", branch: "寅" },
      month: { stem: "己", branch: "亥" },
      day: { stem: "丙", branch: "子" },
      hour: "unknown",
    });
    const contestedClimate = buildAdjustedClimateSummary(contested);
    expect(contestedClimate.temperature.outcome).toBe("mitigation-reinforcement-conflict");
    expect(contestedClimate.certainty).toBe("partial");
    expect(deriveR6RoleActivity({ pillars: contested, climate: contestedClimate })).toBe("B");
    expect(deriveR6RoleActivity({ pillars: contested, climate: contestedClimate })).not.toBe("C");

    const partial = chart({
      year: { stem: "庚", branch: "午" },
      month: { stem: "壬", branch: "午" },
      day: { stem: "甲", branch: "寅" },
      hour: { stem: "戊", branch: "辰" },
    });
    const partialClimate = buildAdjustedClimateSummary(partial);
    expect(partialClimate.temperature.outcome).toBe("partially-mitigated");
    expect(deriveR6RoleActivity({ pillars: partial, climate: partialClimate })).toBe("B");
    expect(deriveR6RoleActivity({ pillars: partial, climate: partialClimate })).not.toBe("C");
  });

  it("returns A when resolved bias remains but regulation complement is empty", () => {
    // Climate need-like dry axis, but no fire/water regulation factors → empty complement.
    const pillars = chart({
      year: { stem: "甲", branch: "酉" },
      month: { stem: "庚", branch: "酉" },
      day: { stem: "甲", branch: "酉" },
      hour: { stem: "庚", branch: "酉" },
    });
    const climate = buildAdjustedClimateSummary(pillars);

    expect(climate.moisture).toEqual({
      status: "resolved",
      value: "dry",
      outcome: "unchanged",
    });
    expect(climate.fireQuality).toBe("absent");
    expect(climate.waterQuality).toBe("absent");
    expect(climate.mitigationFactors).toEqual([]);
    expect(climate.reinforcementFactors).toEqual([]);

    expect(deriveR6RoleActivity({ pillars, climate })).toBe("A");
  });

  it("does not return C for fire/water presence alone without completed regulation", () => {
    const pillars = chart({
      year: { stem: "甲", branch: "寅" },
      month: { stem: "甲", branch: "寅" },
      day: { stem: "甲", branch: "寅" },
      hour: { stem: "甲", branch: "寅" },
    });
    const climate = buildAdjustedClimateSummary(pillars);

    expect(analyzeElementPresence(pillars, "火").presence).not.toBe("absent");
    expect(climate.fireQuality).not.toBe("absent");
    expect(climate.temperature.outcome).not.toBe("balanced");
    expect(climate.moisture.outcome).not.toBe("balanced");

    expect(deriveR6RoleActivity({ pillars, climate })).not.toBe("C");
  });

  it("distinguishes regulation-complete C from never-needed A on balanced+unchanged", () => {
    // Completed regulation: base cold/moist → clear mitigation → balanced.
    const completed = chart({
      year: { stem: "己", branch: "卯" },
      month: { stem: "丙", branch: "子" },
      day: { stem: "戊", branch: "午" },
      hour: { stem: "戊", branch: "午" },
    });
    const completedClimate = buildAdjustedClimateSummary(completed);
    expect(completedClimate.baseClimate.temperature).not.toBe("balanced");
    expect(completedClimate.temperature.outcome).toBe("balanced");
    expect(deriveR6RoleActivity({ pillars: completed, climate: completedClimate })).toBe("C");

    // Never needed on temperature: base already balanced → unchanged (CLI-028),
    // and moisture dry with empty complement → overall no operating R6 role (A).
    const neverNeeded = chart({
      year: { stem: "甲", branch: "酉" },
      month: { stem: "庚", branch: "酉" },
      day: { stem: "甲", branch: "酉" },
      hour: { stem: "庚", branch: "酉" },
    });
    const neverNeededClimate = buildAdjustedClimateSummary(neverNeeded);
    expect(neverNeededClimate.baseClimate.temperature).toBe("balanced");
    expect(neverNeededClimate.temperature).toEqual({
      status: "resolved",
      value: "balanced",
      outcome: "unchanged",
    });
    expect(neverNeededClimate.fireQuality).toBe("absent");
    expect(neverNeededClimate.waterQuality).toBe("absent");
    expect(deriveR6RoleActivity({ pillars: neverNeeded, climate: neverNeededClimate })).toBe("A");
  });
});
