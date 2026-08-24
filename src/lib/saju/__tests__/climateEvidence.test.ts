import { describe, expect, it } from "vitest";
import { collectClimateEvidence } from "@/lib/saju";
import { BASE_CLIMATE } from "@/lib/saju/data/baseClimate";
import { BRANCHES } from "@/lib/saju/types";
import type { FourPillars, HourPillar, Pillar } from "@/lib/saju/types";

function chart(partial: { year: Pillar; month: Pillar; day: Pillar; hour: HourPillar }): FourPillars {
  return {
    ...partial,
    hourCertainty: partial.hour === "unknown" ? "unknown" : "confirmed",
    warnings: [],
  };
}

describe("baseClimate", () => {
  it("maps all 12 month branches from the fixed table only", () => {
    expect(BASE_CLIMATE.寅).toEqual({ temperature: "balanced", moisture: "moist" });
    expect(BASE_CLIMATE.卯).toEqual({ temperature: "balanced", moisture: "moist" });
    expect(BASE_CLIMATE.辰).toEqual({ temperature: "balanced", moisture: "moist" });
    expect(BASE_CLIMATE.巳).toEqual({ temperature: "warm", moisture: "dry" });
    expect(BASE_CLIMATE.午).toEqual({ temperature: "warm", moisture: "dry" });
    expect(BASE_CLIMATE.未).toEqual({ temperature: "warm", moisture: "dry" });
    expect(BASE_CLIMATE.申).toEqual({ temperature: "balanced", moisture: "dry" });
    expect(BASE_CLIMATE.酉).toEqual({ temperature: "balanced", moisture: "dry" });
    expect(BASE_CLIMATE.戌).toEqual({ temperature: "balanced", moisture: "dry" });
    expect(BASE_CLIMATE.亥).toEqual({ temperature: "cold", moisture: "moist" });
    expect(BASE_CLIMATE.子).toEqual({ temperature: "cold", moisture: "moist" });
    expect(BASE_CLIMATE.丑).toEqual({ temperature: "cold", moisture: "moist" });
    expect(Object.keys(BASE_CLIMATE)).toHaveLength(BRANCHES.length);
  });
});

describe("ClimateEvidence 사례", () => {
  it("CASE 1 己卯 丙子 戊午 戊午 — 子월, 확정 시주", () => {
    const evidence = collectClimateEvidence(
      chart({
        year: { stem: "己", branch: "卯" },
        month: { stem: "丙", branch: "子" },
        day: { stem: "戊", branch: "午" },
        hour: { stem: "戊", branch: "午" },
      }),
    );

    expect(evidence.baseClimate).toEqual({ temperature: "cold", moisture: "moist" });
    expect(evidence.hourUnknown).toBe(false);
    expect(evidence.includedSlots).toEqual(["year", "month", "day", "hour"]);
    expect(evidence.omittedSlots).toEqual([]);
    expect(evidence.factors.some((factor) => factor.slot === "month" && factor.layer !== "stem")).toBe(
      false,
    );
    expect(evidence.factors).toEqual([
      {
        element: "火",
        slot: "month",
        layer: "stem",
        sourceStem: "丙",
        presence: "rooted-visible",
        visible: true,
        hidden: false,
        temperatureRole: "mitigation",
        moistureRole: "mitigation",
      },
      {
        element: "火",
        slot: "day",
        layer: "branch",
        sourceBranch: "午",
        presence: "rooted-visible",
        visible: true,
        hidden: false,
        temperatureRole: "mitigation",
        moistureRole: "mitigation",
      },
      {
        element: "火",
        slot: "day",
        layer: "hiddenStem",
        sourceStem: "丁",
        sourceBranch: "午",
        role: "정기",
        presence: "rooted-visible",
        visible: false,
        hidden: true,
        temperatureRole: "mitigation",
        moistureRole: "mitigation",
      },
      {
        element: "火",
        slot: "hour",
        layer: "branch",
        sourceBranch: "午",
        presence: "rooted-visible",
        visible: true,
        hidden: false,
        temperatureRole: "mitigation",
        moistureRole: "mitigation",
      },
      {
        element: "火",
        slot: "hour",
        layer: "hiddenStem",
        sourceStem: "丁",
        sourceBranch: "午",
        role: "정기",
        presence: "rooted-visible",
        visible: false,
        hidden: true,
        temperatureRole: "mitigation",
        moistureRole: "mitigation",
      },
    ]);
    expect(evidence).not.toHaveProperty("adjustedClimate");
    expect(evidence).not.toHaveProperty("climateNeedCandidates");
  });

  it("CASE 2 甲辰 丙午 丁酉 庚申 — 午월, 월지 중복 없이 일간 火 포함", () => {
    const evidence = collectClimateEvidence(
      chart({
        year: { stem: "甲", branch: "辰" },
        month: { stem: "丙", branch: "午" },
        day: { stem: "丁", branch: "酉" },
        hour: { stem: "庚", branch: "申" },
      }),
    );

    expect(evidence.baseClimate).toEqual({ temperature: "warm", moisture: "dry" });
    expect(evidence.hourUnknown).toBe(false);
    expect(evidence.includedSlots).toContain("hour");
    expect(evidence.factors.some((factor) => factor.slot === "month" && factor.sourceBranch === "午")).toBe(
      false,
    );
    expect(evidence.factors.some((factor) => factor.slot === "month" && factor.sourceStem === "丁")).toBe(
      false,
    );
    expect(evidence.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          element: "火",
          slot: "month",
          layer: "stem",
          sourceStem: "丙",
          temperatureRole: "reinforcement",
          moistureRole: "reinforcement",
        }),
        expect.objectContaining({
          element: "火",
          slot: "day",
          layer: "stem",
          sourceStem: "丁",
          temperatureRole: "reinforcement",
          moistureRole: "reinforcement",
        }),
        expect.objectContaining({
          element: "水",
          slot: "year",
          layer: "hiddenStem",
          sourceStem: "癸",
          sourceBranch: "辰",
          hidden: true,
          temperatureRole: "mitigation",
          moistureRole: "mitigation",
        }),
        expect.objectContaining({
          element: "水",
          slot: "hour",
          layer: "hiddenStem",
          sourceStem: "壬",
          sourceBranch: "申",
          hidden: true,
          temperatureRole: "mitigation",
          moistureRole: "mitigation",
        }),
      ]),
    );
    expect(evidence.factors.filter((factor) => factor.element === "火")).toHaveLength(2);
    expect(evidence.factors.filter((factor) => factor.element === "水")).toHaveLength(2);
  });

  it("CASE 3 壬寅 己亥 丙子 시주미상", () => {
    const evidence = collectClimateEvidence(
      chart({
        year: { stem: "壬", branch: "寅" },
        month: { stem: "己", branch: "亥" },
        day: { stem: "丙", branch: "子" },
        hour: "unknown",
      }),
    );

    expect(evidence.baseClimate).toEqual({ temperature: "cold", moisture: "moist" });
    expect(evidence.hourUnknown).toBe(true);
    expect(evidence.includedSlots).toEqual(["year", "month", "day"]);
    expect(evidence.omittedSlots).toEqual(["hour"]);
    expect(evidence.factors.every((factor) => factor.slot !== "hour")).toBe(true);
    expect(evidence.factors.some((factor) => factor.slot === "month" && factor.layer !== "stem")).toBe(
      false,
    );
    expect(evidence.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          element: "水",
          slot: "year",
          layer: "stem",
          sourceStem: "壬",
          temperatureRole: "reinforcement",
          moistureRole: "reinforcement",
        }),
        expect.objectContaining({
          element: "火",
          slot: "day",
          layer: "stem",
          sourceStem: "丙",
          temperatureRole: "mitigation",
          moistureRole: "mitigation",
        }),
        expect.objectContaining({
          element: "水",
          slot: "day",
          layer: "branch",
          sourceBranch: "子",
          temperatureRole: "reinforcement",
          moistureRole: "reinforcement",
        }),
      ]),
    );
  });

  it("CASE 4 庚子 己未 辛卯 시주미상", () => {
    const evidence = collectClimateEvidence(
      chart({
        year: { stem: "庚", branch: "子" },
        month: { stem: "己", branch: "未" },
        day: { stem: "辛", branch: "卯" },
        hour: "unknown",
      }),
    );

    expect(evidence.baseClimate).toEqual({ temperature: "warm", moisture: "dry" });
    expect(evidence.hourUnknown).toBe(true);
    expect(evidence.factors.every((factor) => factor.slot !== "hour")).toBe(true);
    expect(evidence.factors.some((factor) => factor.slot === "month")).toBe(false);
    expect(evidence.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          element: "水",
          slot: "year",
          layer: "branch",
          sourceBranch: "子",
          temperatureRole: "mitigation",
          moistureRole: "mitigation",
        }),
      ]),
    );
    expect(evidence.factors.every((factor) => factor.element === "水")).toBe(true);
  });

  it("CASE 5 甲酉 庚酉 甲酉 시주미상 — 火·水 없음", () => {
    const evidence = collectClimateEvidence(
      chart({
        year: { stem: "甲", branch: "酉" },
        month: { stem: "庚", branch: "酉" },
        day: { stem: "甲", branch: "酉" },
        hour: "unknown",
      }),
    );

    expect(evidence.baseClimate).toEqual({ temperature: "balanced", moisture: "dry" });
    expect(evidence.factors).toEqual([]);
  });

  it("does not change baseClimate when extra fire sits on a winter month", () => {
    const evidence = collectClimateEvidence(
      chart({
        year: { stem: "己", branch: "卯" },
        month: { stem: "丙", branch: "子" },
        day: { stem: "戊", branch: "午" },
        hour: { stem: "戊", branch: "午" },
      }),
    );
    expect(evidence.baseClimate).toEqual({ temperature: "cold", moisture: "moist" });
  });
});
