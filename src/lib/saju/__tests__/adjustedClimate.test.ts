import { describe, expect, it } from "vitest";
import { buildAdjustedClimateSummary, collectClimateEvidence } from "@/lib/saju";
import type { FourPillars, HourPillar, Pillar } from "@/lib/saju/types";

function chart(partial: { year: Pillar; month: Pillar; day: Pillar; hour: HourPillar }): FourPillars {
  return {
    ...partial,
    hourCertainty: partial.hour === "unknown" ? "unknown" : "confirmed",
    warnings: [],
  };
}

function forbidden(summary: ReturnType<typeof buildAdjustedClimateSummary>) {
  expect(summary).not.toHaveProperty("score");
  expect(summary).not.toHaveProperty("neededElement");
  expect(summary).not.toHaveProperty("climateNeedCandidates");
  expect(summary).not.toHaveProperty("need");
}

describe("AdjustedClimateSummary CASE", () => {
  it("CASE 1 己卯 丙子 戊午 戊午 — Fire clear, Water absent, max balanced", () => {
    const pillars = chart({
      year: { stem: "己", branch: "卯" },
      month: { stem: "丙", branch: "子" },
      day: { stem: "戊", branch: "午" },
      hour: { stem: "戊", branch: "午" },
    });
    const evidence = collectClimateEvidence(pillars);
    const summary = buildAdjustedClimateSummary(pillars);

    expect(summary.baseClimate).toEqual({ temperature: "cold", moisture: "moist" });
    expect(summary.baseClimate).toEqual(evidence.baseClimate);
    expect(summary.certainty).toBe("complete");
    expect(summary.fireQuality).toBe("clear");
    expect(summary.waterQuality).toBe("absent");
    expect(summary.temperature).toEqual({ status: "resolved", value: "balanced" });
    expect(summary.moisture).toEqual({ status: "resolved", value: "balanced" });
    expect(summary.temperature.value).not.toBe("warm");
    expect(summary.moisture.value).not.toBe("dry");
    expect(summary.omittedSlots).toEqual([]);
    forbidden(summary);
  });

  it("CASE 2 甲辰 丙午 丁酉 庚申 — Fire substantial reinforcement, Water hidden", () => {
    const pillars = chart({
      year: { stem: "甲", branch: "辰" },
      month: { stem: "丙", branch: "午" },
      day: { stem: "丁", branch: "酉" },
      hour: { stem: "庚", branch: "申" },
    });
    const evidence = collectClimateEvidence(pillars);
    const summary = buildAdjustedClimateSummary(pillars);

    expect(summary.baseClimate).toEqual({ temperature: "warm", moisture: "dry" });
    expect(summary.baseClimate).toEqual(evidence.baseClimate);
    expect(summary.certainty).toBe("complete");
    expect(summary.fireQuality).toBe("substantial");
    expect(summary.waterQuality).toBe("hidden");
    expect(summary.temperature).toEqual({ status: "resolved", value: "warm" });
    expect(summary.moisture).toEqual({ status: "resolved", value: "dry" });
    expect(summary.reinforcementFactors.some((factor) => factor.element === "火")).toBe(true);
    expect(summary.mitigationFactors.some((factor) => factor.element === "水")).toBe(true);
    forbidden(summary);
  });

  it("CASE 3 壬寅 己亥 丙子 unknown — mitigation and reinforcement together", () => {
    const summary = buildAdjustedClimateSummary(
      chart({
        year: { stem: "壬", branch: "寅" },
        month: { stem: "己", branch: "亥" },
        day: { stem: "丙", branch: "子" },
        hour: "unknown",
      }),
    );

    expect(summary.baseClimate).toEqual({ temperature: "cold", moisture: "moist" });
    expect(summary.certainty).toBe("partial");
    expect(summary.fireQuality).toBe("substantial");
    expect(summary.waterQuality).toBe("clear");
    expect(summary.temperature).toEqual({ status: "unresolved", value: null });
    expect(summary.moisture).toEqual({ status: "unresolved", value: null });
    expect(summary.unresolvedReasons).toEqual(
      expect.arrayContaining(["substantial-mitigation-and-reinforcement", "hour-unknown-may-change-climate-factors"]),
    );
    expect(summary.conflicts).toContain("substantial-mitigation-and-reinforcement");
    expect(summary.omittedSlots).toEqual(["hour"]);
    forbidden(summary);
  });

  it("CASE 4 庚子 己未 辛卯 unknown — year 子 is not Water clear", () => {
    const summary = buildAdjustedClimateSummary(
      chart({
        year: { stem: "庚", branch: "子" },
        month: { stem: "己", branch: "未" },
        day: { stem: "辛", branch: "卯" },
        hour: "unknown",
      }),
    );

    expect(summary.baseClimate).toEqual({ temperature: "warm", moisture: "dry" });
    expect(summary.certainty).toBe("partial");
    expect(summary.waterQuality).not.toBe("clear");
    expect(["hidden", "branch-only"]).toContain(summary.waterQuality);
    expect(summary.fireQuality).toBe("absent");
    expect(summary.temperature).toEqual({ status: "resolved", value: "warm" });
    expect(summary.moisture).toEqual({ status: "resolved", value: "dry" });
    forbidden(summary);
  });

  it("CASE 5 甲酉 庚酉 甲酉 unknown — no Fire/Water, balanced+dry stays", () => {
    const summary = buildAdjustedClimateSummary(
      chart({
        year: { stem: "甲", branch: "酉" },
        month: { stem: "庚", branch: "酉" },
        day: { stem: "甲", branch: "酉" },
        hour: "unknown",
      }),
    );

    expect(summary.baseClimate).toEqual({ temperature: "balanced", moisture: "dry" });
    expect(summary.certainty).toBe("partial");
    expect(summary.fireQuality).toBe("absent");
    expect(summary.waterQuality).toBe("absent");
    expect(summary.temperature).toEqual({ status: "resolved", value: "balanced" });
    expect(summary.moisture).toEqual({ status: "resolved", value: "dry" });
    expect(summary.mitigationFactors).toEqual([]);
    expect(summary.reinforcementFactors).toEqual([]);
    forbidden(summary);
  });
});

describe("AdjustedClimateSummary 극단 Fire / Water", () => {
  it("子월 + 천간 丙丁 + 월지 외 午 → temperature/moisture balanced, base stays cold+moist", () => {
    const pillars = chart({
      year: { stem: "丙", branch: "寅" },
      month: { stem: "戊", branch: "子" },
      day: { stem: "丁", branch: "午" },
      hour: "unknown",
    });
    const evidence = collectClimateEvidence(pillars);
    const summary = buildAdjustedClimateSummary(pillars);

    expect(summary.baseClimate).toEqual({ temperature: "cold", moisture: "moist" });
    expect(summary.baseClimate).toEqual(evidence.baseClimate);
    expect(summary.fireQuality).toBe("clear");
    expect(summary.waterQuality).toBe("absent");
    expect(summary.temperature).toEqual({ status: "resolved", value: "balanced" });
    expect(summary.moisture).toEqual({ status: "resolved", value: "balanced" });
    expect(summary.certainty).toBe("partial");
    forbidden(summary);
  });

  it("午월 + 천간 壬癸 + 월지 외 亥子 → temperature/moisture balanced, base stays warm+dry", () => {
    const pillars = chart({
      year: { stem: "壬", branch: "亥" },
      month: { stem: "甲", branch: "午" },
      day: { stem: "癸", branch: "子" },
      hour: "unknown",
    });
    const evidence = collectClimateEvidence(pillars);
    const summary = buildAdjustedClimateSummary(pillars);

    expect(summary.baseClimate).toEqual({ temperature: "warm", moisture: "dry" });
    expect(summary.baseClimate).toEqual(evidence.baseClimate);
    expect(summary.waterQuality).toBe("clear");
    expect(summary.fireQuality).toBe("absent");
    expect(summary.temperature).toEqual({ status: "resolved", value: "balanced" });
    expect(summary.moisture).toEqual({ status: "resolved", value: "balanced" });
    expect(summary.temperature.value).not.toBe("cold");
    expect(summary.moisture.value).not.toBe("moist");
    forbidden(summary);
  });
});

describe("AdjustedClimateSummary 규칙", () => {
  it("does not move a balanced temperature base even with Fire", () => {
    const summary = buildAdjustedClimateSummary(
      chart({
        year: { stem: "丙", branch: "寅" },
        month: { stem: "甲", branch: "辰" },
        day: { stem: "丁", branch: "酉" },
        hour: "unknown",
      }),
    );
    expect(summary.baseClimate.temperature).toBe("balanced");
    expect(summary.temperature).toEqual({ status: "resolved", value: "balanced" });
    expect(summary.fireQuality).not.toBe("absent");
  });

  it("keeps temperature and moisture resolutions independent", () => {
    const summary = buildAdjustedClimateSummary(
      chart({
        year: { stem: "甲", branch: "辰" },
        month: { stem: "丙", branch: "午" },
        day: { stem: "丁", branch: "酉" },
        hour: { stem: "庚", branch: "申" },
      }),
    );
    expect(summary.temperature.status).toBe("resolved");
    expect(summary.moisture.status).toBe("resolved");
    expect(summary.temperature.value).toBe("warm");
    expect(summary.moisture.value).toBe("dry");
  });
});
