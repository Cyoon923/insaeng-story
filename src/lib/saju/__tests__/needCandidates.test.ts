import { describe, expect, it } from "vitest";
import { analyzeElementPresence, buildNeedCandidateSet, buildStrengthSummary, seasonPhaseOf, suppressedForLeaningStrong } from "@/lib/saju";
import type { FourPillars, HourPillar, Pillar } from "@/lib/saju/types";

function chart(partial: { year: Pillar; month: Pillar; day: Pillar; hour: HourPillar }): FourPillars {
  return {
    ...partial,
    hourCertainty: partial.hour === "unknown" ? "unknown" : "confirmed",
    warnings: [],
  };
}

function forbidden(set: ReturnType<typeof buildNeedCandidateSet>) {
  expect(set).not.toHaveProperty("score");
  expect(set).not.toHaveProperty("rank");
  expect(set).not.toHaveProperty("priority");
  expect(set).not.toHaveProperty("neededElement");
  expect(set).not.toHaveProperty("yongsin");
  for (const candidate of [...set.strengthNeedCandidates, ...set.climateNeedCandidates]) {
    expect(candidate).not.toHaveProperty("score");
    expect(candidate).not.toHaveProperty("rank");
    expect(candidate).not.toHaveProperty("priority");
  }
}

describe("NeedCandidateSet CASE", () => {
  it("CASE 1 己卯 丙子 戊午 戊午 — mixed Strength, balanced Climate", () => {
    const set = buildNeedCandidateSet(
      chart({
        year: { stem: "己", branch: "卯" },
        month: { stem: "丙", branch: "子" },
        day: { stem: "戊", branch: "午" },
        hour: { stem: "戊", branch: "午" },
      }),
    );
    expect(set.strengthNeedCandidates).toEqual([]);
    expect(set.strengthNeedStatus).toBe("unresolved");
    expect(set.climateNeedCandidates).toEqual([]);
    expect(set.climateNeedStatus).toBe("ready");
    forbidden(set);
  });

  it("CASE 2 甲寅 甲寅 甲子 unknown — leaning-strong 木, no Climate candidates", () => {
    const pillars = chart({
      year: { stem: "甲", branch: "寅" },
      month: { stem: "甲", branch: "寅" },
      day: { stem: "甲", branch: "子" },
      hour: "unknown",
    });
    const set = buildNeedCandidateSet(pillars);
    expect(buildStrengthSummary(pillars).directionCandidate).toBe("leaning-strong");
    expect(set.strengthNeedStatus).toBe("ready");
    expect(set.strengthNeedCandidates.map((item) => [item.element, item.direction, item.reasons[0], item.status])).toEqual([
      ["火", "output", "drain-day-master-output", "candidate"],
      ["土", "wealth", "use-day-master-wealth", "candidate"],
      ["金", "official", "control-day-master-official", "candidate"],
    ]);
    expect(set.strengthNeedCandidates.map((item) => item.existingPresence)).toEqual([
      analyzeElementPresence(pillars, "火").presence,
      analyzeElementPresence(pillars, "土").presence,
      analyzeElementPresence(pillars, "金").presence,
    ]);
    expect(set.climateNeedCandidates).toEqual([]);
    expect(set.climateNeedStatus).toBe("ready");
    expect(set.strengthNeedCandidates[0]?.certainty).toBe("partial");
    forbidden(set);
  });

  it("CASE 3 甲酉 庚酉 甲酉 unknown — Strength 木/水 and Climate 水 stay separate", () => {
    const set = buildNeedCandidateSet(
      chart({
        year: { stem: "甲", branch: "酉" },
        month: { stem: "庚", branch: "酉" },
        day: { stem: "甲", branch: "酉" },
        hour: "unknown",
      }),
    );
    expect(set.strengthNeedStatus).toBe("ready");
    expect(set.strengthNeedCandidates).toEqual([
      expect.objectContaining({
        element: "木",
        source: "strength",
        direction: "peer",
        reasons: ["strengthen-day-master-peer"],
        status: "candidate",
      }),
      expect.objectContaining({
        element: "水",
        source: "strength",
        direction: "resource",
        reasons: ["strengthen-day-master-resource"],
        status: "candidate",
      }),
    ]);
    expect(set.climateNeedCandidates).toEqual([
      expect.objectContaining({
        element: "水",
        source: "climate",
        reasons: ["climate-moisture-dry"],
        direction: "climate",
        status: "candidate",
      }),
    ]);
    expect(set.strengthNeedCandidates.filter((item) => item.element === "水")).toHaveLength(1);
    expect(set.climateNeedCandidates.filter((item) => item.element === "水")).toHaveLength(1);
    forbidden(set);
  });

  it("CASE 4 庚子 己未 辛卯 unknown — mixed Strength, one Climate 水 with two reasons", () => {
    const set = buildNeedCandidateSet(
      chart({
        year: { stem: "庚", branch: "子" },
        month: { stem: "己", branch: "未" },
        day: { stem: "辛", branch: "卯" },
        hour: "unknown",
      }),
    );
    expect(set.strengthNeedCandidates).toEqual([]);
    expect(set.strengthNeedStatus).toBe("unresolved");
    expect(set.climateNeedCandidates).toHaveLength(1);
    expect(set.climateNeedCandidates[0]).toMatchObject({
      element: "水",
      source: "climate",
      reasons: ["climate-temperature-warm", "climate-moisture-dry"],
      certainty: "partial",
    });
    expect(set.climateNeedStatus).toBe("ready");
    forbidden(set);
  });

  it("CASE 5 丙午 戊戌 甲申 unknown — leaning-weak 木, Climate 水 separate", () => {
    const set = buildNeedCandidateSet(
      chart({
        year: { stem: "丙", branch: "午" },
        month: { stem: "戊", branch: "戌" },
        day: { stem: "甲", branch: "申" },
        hour: "unknown",
      }),
    );
    expect(set.strengthNeedCandidates.map((item) => [item.element, item.direction])).toEqual([
      ["木", "peer"],
      ["水", "resource"],
    ]);
    expect(set.climateNeedCandidates).toEqual([
      expect.objectContaining({ element: "水", source: "climate", reasons: ["climate-moisture-dry"] }),
    ]);
    expect(set.strengthNeedCandidates.some((item) => item.element === "水" && item.source === "strength")).toBe(true);
    expect(set.climateNeedCandidates.some((item) => item.element === "水" && item.source === "climate")).toBe(true);
    forbidden(set);
  });

  it("CASE 6 甲寅 辛亥 庚子 unknown — Strength unresolved, Climate Fire from cold", () => {
    const set = buildNeedCandidateSet(
      chart({
        year: { stem: "甲", branch: "寅" },
        month: { stem: "辛", branch: "亥" },
        day: { stem: "庚", branch: "子" },
        hour: "unknown",
      }),
    );
    expect(set.strengthNeedCandidates).toEqual([]);
    expect(set.strengthNeedStatus).toBe("unresolved");
    expect(set.climateNeedCandidates).toEqual([
      expect.objectContaining({
        element: "火",
        reasons: ["climate-temperature-cold"],
      }),
    ]);
    expect(set.climateNeedCandidates.some((item) => item.reasons.includes("climate-moisture-moist"))).toBe(false);
    expect(set.climateNeedStatus).toBe("ready");
    forbidden(set);
  });
});

describe("NeedCandidateSet suppression", () => {
  it("does not suppress leaning-weak peer/resource even when rooted-visible", () => {
    const set = buildNeedCandidateSet(
      chart({
        year: { stem: "甲", branch: "酉" },
        month: { stem: "庚", branch: "酉" },
        day: { stem: "甲", branch: "酉" },
        hour: "unknown",
      }),
    );
    expect(set.strengthNeedCandidates.every((item) => item.status === "candidate")).toBe(true);
    expect(set.strengthNeedCandidates.every((item) => !item.reasons.includes("already-established-relation"))).toBe(true);
  });

  it("keeps hidden-only 상 output as candidate on a leaning-strong chart", () => {
    const pillars = chart({
      year: { stem: "甲", branch: "寅" },
      month: { stem: "甲", branch: "寅" },
      day: { stem: "甲", branch: "子" },
      hour: "unknown",
    });
    const set = buildNeedCandidateSet(pillars);
    const output = set.strengthNeedCandidates.find((item) => item.direction === "output");
    expect(seasonPhaseOf("火", "寅")).toBe("상");
    expect(output?.existingPresence).toBe("hidden-only");
    expect(output?.status).toBe("candidate");
  });

  it("fixture 丙寅 甲寅 甲子 — 火 is rooted-visible and 상, so that output relation is suppressed when the rule applies", () => {
    const pillars = chart({
      year: { stem: "丙", branch: "寅" },
      month: { stem: "甲", branch: "寅" },
      day: { stem: "甲", branch: "子" },
      hour: "unknown",
    });
    const presence = analyzeElementPresence(pillars, "火").presence;
    const phase = seasonPhaseOf("火", "寅");
    const wealthPhase = seasonPhaseOf("土", "寅");
    const officialPhase = seasonPhaseOf("金", "寅");

    expect(presence).toBe("rooted-visible");
    expect(phase).toBe("상");
    expect(suppressedForLeaningStrong(presence, phase)).toBe(true);
    expect(suppressedForLeaningStrong(analyzeElementPresence(pillars, "土").presence, wealthPhase)).toBe(false);
    expect(suppressedForLeaningStrong(analyzeElementPresence(pillars, "金").presence, officialPhase)).toBe(false);
  });
});
