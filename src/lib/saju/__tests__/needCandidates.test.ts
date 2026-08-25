import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeElementPresence, buildNeedCandidateSet, buildStrengthSummary, seasonPhaseOf } from "@/lib/saju";
import { collectLeaningStrongNeedCandidates } from "@/lib/saju/elements/needCandidates";
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
  expect(set.climateCounterSignals).toEqual([]);
  for (const candidate of [...set.strengthNeedCandidates, ...set.climateNeedCandidates]) {
    expect(candidate).not.toHaveProperty("score");
    expect(candidate).not.toHaveProperty("rank");
    expect(candidate).not.toHaveProperty("priority");
  }
}

const suppressionFixture = JSON.parse(
  readFileSync(path.join(__dirname, "needSuppression.fixtures.json"), "utf8"),
).suppression as { pillars: { year: Pillar; month: Pillar; day: Pillar; hour: HourPillar } };

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

  it("CASE 2 甲寅 甲寅 甲子 unknown — leaning-strong 木, Strength only, Need gated", () => {
    const pillars = chart({
      year: { stem: "甲", branch: "寅" },
      month: { stem: "甲", branch: "寅" },
      day: { stem: "甲", branch: "子" },
      hour: "unknown",
    });
    const strength = buildStrengthSummary(pillars);
    const set = buildNeedCandidateSet(pillars);
    expect(strength.directionCandidate).toBe("leaning-strong");
    expect(strength.directionSensitivity).toBe("hour-unknown-provisional");
    expect(strength.certainty).toBe("partial");
    expect(set.strengthNeedStatus).toBe("unresolved");
    expect(set.strengthNeedCandidates).toEqual([]);
    expect(set.climateNeedCandidates).toEqual([]);
    expect(set.climateNeedStatus).toBe("ready");
    forbidden(set);
  });

  it("CASE 3 甲酉 庚酉 甲酉 unknown — Strength gated, Climate 水 only", () => {
    const set = buildNeedCandidateSet(
      chart({
        year: { stem: "甲", branch: "酉" },
        month: { stem: "庚", branch: "酉" },
        day: { stem: "甲", branch: "酉" },
        hour: "unknown",
      }),
    );
    expect(set.strengthNeedStatus).toBe("unresolved");
    expect(set.strengthNeedCandidates).toEqual([]);
    expect(set.climateNeedCandidates).toEqual([
      expect.objectContaining({
        element: "水",
        source: "climate",
        reasons: ["climate-moisture-dry"],
        direction: "climate",
        status: "candidate",
      }),
    ]);
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

  it("CASE 5 丙午 戊戌 甲申 unknown — leaning-weak Strength gated, Climate 水 only", () => {
    const pillars = chart({
      year: { stem: "丙", branch: "午" },
      month: { stem: "戊", branch: "戌" },
      day: { stem: "甲", branch: "申" },
      hour: "unknown",
    });
    const strength = buildStrengthSummary(pillars);
    const set = buildNeedCandidateSet(pillars);
    expect(strength.directionCandidate).toBe("leaning-weak");
    expect(strength.directionSensitivity).toBe("hour-unknown-provisional");
    expect(set.strengthNeedStatus).toBe("unresolved");
    expect(set.strengthNeedCandidates).toEqual([]);
    expect(set.climateNeedCandidates).toEqual([
      expect.objectContaining({ element: "水", source: "climate", reasons: ["climate-moisture-dry"] }),
    ]);
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

describe("NeedCandidateSet CL-NEED-HOUR gate", () => {
  it("A. hour unknown + leaning-strong — Strength 유지, Need gated", () => {
    const pillars = chart({
      year: { stem: "甲", branch: "寅" },
      month: { stem: "甲", branch: "寅" },
      day: { stem: "甲", branch: "子" },
      hour: "unknown",
    });
    const strength = buildStrengthSummary(pillars);
    const set = buildNeedCandidateSet(pillars);
    expect(strength.directionCandidate).toBe("leaning-strong");
    expect(strength.certainty).toBe("partial");
    expect(strength.directionSensitivity).toBe("hour-unknown-provisional");
    expect(strength.resolution).toBe("clear-direction");
    expect(set.strengthNeedStatus).toBe("unresolved");
    expect(set.strengthNeedCandidates).toEqual([]);
  });

  it("B. hour unknown + leaning-weak — Strength 유지, Need gated", () => {
    const pillars = chart({
      year: { stem: "丙", branch: "午" },
      month: { stem: "戊", branch: "戌" },
      day: { stem: "甲", branch: "申" },
      hour: "unknown",
    });
    const strength = buildStrengthSummary(pillars);
    const set = buildNeedCandidateSet(pillars);
    expect(strength.directionCandidate).toBe("leaning-weak");
    expect(strength.certainty).toBe("partial");
    expect(strength.directionSensitivity).toBe("hour-unknown-provisional");
    expect(strength.resolution).toBe("clear-direction");
    expect(set.strengthNeedStatus).toBe("unresolved");
    expect(set.strengthNeedCandidates).toEqual([]);
  });

  it("C. hour confirmed + leaning-strong — 기존 Need ready 유지", () => {
    const pillars = chart({
      year: { stem: "甲", branch: "寅" },
      month: { stem: "甲", branch: "寅" },
      day: { stem: "甲", branch: "子" },
      hour: { stem: "甲", branch: "子" },
    });
    const strength = buildStrengthSummary(pillars);
    const set = buildNeedCandidateSet(pillars);
    expect(strength.directionCandidate).toBe("leaning-strong");
    expect(strength.directionSensitivity).toBeNull();
    expect(strength.certainty).toBe("complete");
    expect(set.strengthNeedStatus).toBe("ready");
    expect(set.strengthNeedCandidates.map((item) => item.element)).toEqual(["火", "土", "金"]);
  });

  it("C. hour confirmed + leaning-weak — 기존 Need ready 유지", () => {
    const pillars = chart({
      year: { stem: "丙", branch: "午" },
      month: { stem: "戊", branch: "戌" },
      day: { stem: "甲", branch: "申" },
      hour: { stem: "甲", branch: "子" },
    });
    const strength = buildStrengthSummary(pillars);
    const set = buildNeedCandidateSet(pillars);
    expect(strength.directionCandidate).toBe("leaning-weak");
    expect(strength.directionSensitivity).toBeNull();
    expect(set.strengthNeedStatus).toBe("ready");
    expect(set.strengthNeedCandidates.map((item) => item.element)).toEqual(["木", "水"]);
  });

  it("D. mixed / unresolved — 기존 Need unresolved 유지", () => {
    const mixed = buildNeedCandidateSet(
      chart({
        year: { stem: "己", branch: "卯" },
        month: { stem: "丙", branch: "子" },
        day: { stem: "戊", branch: "午" },
        hour: { stem: "戊", branch: "午" },
      }),
    );
    expect(mixed.strengthNeedStatus).toBe("unresolved");
    expect(mixed.strengthNeedCandidates).toEqual([]);

    const unresolved = buildNeedCandidateSet(
      chart({
        year: { stem: "甲", branch: "寅" },
        month: { stem: "辛", branch: "亥" },
        day: { stem: "庚", branch: "子" },
        hour: "unknown",
      }),
    );
    expect(unresolved.strengthNeedStatus).toBe("unresolved");
    expect(unresolved.strengthNeedCandidates).toEqual([]);
  });
});

describe("NeedCandidateSet suppression", () => {
  it("does not suppress leaning-weak peer/resource when confirmed hour exposes Need", () => {
    const set = buildNeedCandidateSet(
      chart({
        year: { stem: "甲", branch: "酉" },
        month: { stem: "庚", branch: "酉" },
        day: { stem: "甲", branch: "酉" },
        hour: { stem: "癸", branch: "酉" },
      }),
    );
    expect(set.strengthNeedStatus).toBe("ready");
    expect(set.strengthNeedCandidates.every((item) => item.status === "candidate")).toBe(true);
    expect(set.strengthNeedCandidates.every((item) => !item.reasons.includes("already-established-relation"))).toBe(true);
  });

  it("collectLeaningStrongNeedCandidates still suppresses rooted-visible 상 output", () => {
    const pillars = chart(suppressionFixture.pillars);
    const candidates = collectLeaningStrongNeedCandidates(pillars, "partial");
    const output = candidates.find((item) => item.direction === "output");
    const wealth = candidates.find((item) => item.direction === "wealth");
    const official = candidates.find((item) => item.direction === "official");

    expect(analyzeElementPresence(pillars, "火").presence).toBe("rooted-visible");
    expect(seasonPhaseOf("火", "寅")).toBe("상");
    expect(output).toMatchObject({
      element: "火",
      status: "suppressed",
      reasons: ["drain-day-master-output", "already-established-relation"],
    });
    expect(wealth?.status).toBe("candidate");
    expect(official?.status).toBe("candidate");
    expect(wealth?.reasons.includes("already-established-relation")).toBe(false);
    expect(official?.reasons.includes("already-established-relation")).toBe(false);

    expect(buildStrengthSummary(pillars).directionCandidate).toBe("mixed");
    expect(buildNeedCandidateSet(pillars).strengthNeedCandidates).toEqual([]);
  });
});
