import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildSajuValidationReport, emptyExpertReview } from "@/lib/saju/validation";
import { emptyPilotExpertMapping, emptyPilotExpertRaw } from "@/lib/saju/validation/pilot";
import type { BirthInput, PilotValidationCase } from "@/lib/saju/validation";

const fixture = JSON.parse(
  readFileSync(path.join(__dirname, "../validation/pilot/cases.json"), "utf8"),
) as {
  set: string;
  phase: string;
  pilotSize: number;
  notAccuracySample: boolean;
  forbiddenCaseIds: string[];
  cases: PilotValidationCase[];
  emptyExpertReview: Record<string, unknown>;
};

const comparisonTemplate = JSON.parse(
  readFileSync(path.join(__dirname, "../validation/pilot/pilot-comparison-template.json"), "utf8"),
) as {
  layers: string[];
  matchStatus: string[];
  template: { expert: Record<string, unknown>; engine: { strengthDirection: string | null } };
};

function solarInput(year: number, month: number, day: number, time: BirthInput["time"]): BirthInput {
  return {
    calendar: "solar",
    year,
    month,
    day,
    isLeapMonth: false,
    time,
  };
}

describe("Interpretive Pilot 5 — templates only", () => {
  it("has five empty shells and does not reuse design fixtures", () => {
    expect(fixture.set).toBe("interpretive-pilot");
    expect(fixture.phase).toBe("pilot");
    expect(fixture.notAccuracySample).toBe(true);
    expect(fixture.pilotSize).toBe(5);
    expect(fixture.cases).toHaveLength(5);
    expect(fixture.cases.map((item) => item.id)).toEqual([
      "pilot-001",
      "pilot-002",
      "pilot-003",
      "pilot-004",
      "pilot-005",
    ]);
    expect(fixture.cases.filter((item) => item.hourTarget === "confirmed")).toHaveLength(4);
    expect(fixture.cases.filter((item) => item.hourTarget === "unknown")).toHaveLength(1);
    expect(fixture.cases.every((item) => item.status === "unreviewed")).toBe(true);
    expect(fixture.cases.every((item) => item.input === null)).toBe(true);
    expect(fixture.cases.every((item) => item.expectedFourPillars === null)).toBe(true);
    expect(fixture.cases.every((item) => item.comparison === null)).toBe(true);
    expect(fixture.cases.every((item) => item.personName === null)).toBe(true);
    expect(fixture.cases.every((item) => !fixture.forbiddenCaseIds.includes(item.id))).toBe(true);
  });

  it("keeps expert raw, mapping, and review empty of engine values", () => {
    const raw = emptyPilotExpertRaw();
    const mapping = emptyPilotExpertMapping();
    expect(raw).toEqual(fixture.cases[0]?.expertRaw);
    expect(mapping).toEqual(fixture.cases[0]?.mapping);
    expect(Object.values(raw).every((value) => value === null)).toBe(true);
    expect(mapping.mappedBy).toBeNull();
    expect(mapping.needCandidates).toEqual([]);

    for (const item of fixture.cases) {
      expect(item.expertReview).toEqual(fixture.emptyExpertReview);
      expect(item.expertReview).not.toHaveProperty("strengthDirection");
      expect(item.expertReview).not.toHaveProperty("neededElement");
      expect(item.expertReview).not.toHaveProperty("yongsin");
      expect(item.expertReview).not.toHaveProperty("leaning-strong");
      expect(item.expertRaw.expertStrengthRaw).toBeNull();
      expect(item.mapping.strength).toBeNull();
    }

    const report = buildSajuValidationReport(solarInput(2000, 1, 1, { hour: 12, minute: 0 }));
    const expert = emptyExpertReview();
    expect(expert).toEqual(fixture.emptyExpertReview);
    expect(expert.strengthAssessment).not.toBe(String(report.strengthSummary.directionCandidate));
    expect(JSON.stringify(fixture)).not.toMatch(/"neededElement"/);
  });

  it("defines comparison layers without scoring", () => {
    expect(comparisonTemplate.layers).toEqual([
      "four-pillars",
      "month-command",
      "root",
      "strength-direction",
      "climate-temperature",
      "climate-moisture",
      "need-candidates",
      "decision-blocked",
    ]);
    expect(comparisonTemplate.matchStatus).toEqual([
      "match",
      "partial-match",
      "difference",
      "expert-unresolved",
      "engine-unresolved",
      "not-comparable",
    ]);
    expect(comparisonTemplate.template.engine.strengthDirection).toBeNull();
    expect(comparisonTemplate.template.expert).not.toHaveProperty("neededElement");
    expect(JSON.stringify(comparisonTemplate)).not.toMatch(/accuracyPercent|neededElementScore/);
  });
});
