import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compareCalculationCase } from "@/lib/saju/validation/calculation/compare";
import type { CalculationCase, CalculationCompareResult } from "@/lib/saju/validation/calculation/compare";

const fixture = JSON.parse(
  readFileSync(path.join(__dirname, "../validation/calculation/cases.json"), "utf8"),
) as { cases: CalculationCase[] };

function runAll(): CalculationCompareResult[] {
  return fixture.cases.map((item) => compareCalculationCase(item));
}

describe("Calculation Validation Set", () => {
  it("has at least 30 official cases across the phase-1 groups", () => {
    const groups = new Set(fixture.cases.map((item) => item.group));
    expect(fixture.cases.length).toBeGreaterThanOrEqual(30);
    expect(groups).toEqual(
      new Set(["jie-boundary", "lichun", "day-pillar", "lunar", "gregorian", "hour-boundary", "dst"]),
    );
    expect(fixture.cases.filter((item) => item.group === "jie-boundary")).toHaveLength(18);
    expect(fixture.cases.filter((item) => item.group === "day-pillar")).toHaveLength(20);
    expect(fixture.cases.some((item) => item.directOfficial === true)).toBe(true);
    expect(fixture.cases.some((item) => item.directOfficial === false)).toBe(true);
    expect(fixture.cases.every((item) => item.sourceReference?.publisher)).toBe(true);
    expect(JSON.stringify(fixture)).not.toMatch(/neededElement|yongsin|finalElement/);
  });

  it("compares official expected to ValidationReport without rewriting expected", () => {
    const results = runAll();
    const differences = results.filter((item) => item.differenceType.length > 0);
    const summary = {
      total: results.length,
      match: results.length - differences.length,
      difference: differences.length,
      differenceIds: differences.map((item) => item.caseId),
    };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(summary, null, 2));

    for (const item of differences) {
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify(
          {
            caseId: item.caseId,
            differenceType: item.differenceType,
            sourceReference: item.sourceReference,
            fields: Object.fromEntries(
              Object.entries(item.fields).filter(([, value]) => value.status === "difference"),
            ),
          },
          null,
          2,
        ),
      );
    }

    expect(results).toHaveLength(fixture.cases.length);
    expect(results.every((item) => item.fields)).toBe(true);
    expect(differences.every((item) => item.sourceReference)).toBe(true);
  });

  it("does not treat night_ja as the only correct 23:00 policy", () => {
    const hourCases = fixture.cases.filter((item) => item.group === "hour-boundary");
    expect(hourCases).toHaveLength(7);
    for (const item of hourCases) {
      expect(item.expected.policyOutcomes?.night_ja).toBeTruthy();
      expect(item.expected.policyOutcomes?.early_ja).toBeTruthy();
    }
  });
});
