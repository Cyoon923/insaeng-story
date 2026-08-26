import { describe, expect, it } from "vitest";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { buildStrengthSummary } from "@/lib/saju/elements/strengthSummary";
import {
  bottleneckIsClear,
  r1HasClearEvidence,
  r3HasClearEvidence,
  r4HasClearEvidence,
  structuralRoleHasClearEvidence,
} from "@/lib/saju/final/deriveRoleClearGrade";
import type { FourPillars, HourPillar, Pillar, StrengthSummary } from "@/lib/saju/types";

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

function baseSummary(direction: StrengthSummary["directionCandidate"] = "leaning-weak"): StrengthSummary {
  const summary = buildStrengthSummary(
    chart({
      year: { stem: "甲", branch: "子" },
      month: { stem: "甲", branch: "子" },
      day: { stem: "甲", branch: "子" },
      hour: { stem: "甲", branch: "子" },
    }),
  );
  return { ...summary, directionCandidate: direction };
}

describe("deriveRoleClearGrade", () => {
  it("R1 CLEAR: resource RV + visible 인성 support", () => {
    const pillars = chart({
      year: { stem: "壬", branch: "子" },
      month: { stem: "癸", branch: "酉" },
      day: { stem: "甲", branch: "亥" },
      hour: { stem: "壬", branch: "子" },
    });
    const evidence = collectStrengthEvidence(pillars);
    const summary = buildStrengthSummary(pillars);
    expect(summary.sourceBreakdown.resource.rootedVisible).toBe(true);
    expect(r1HasClearEvidence(summary, evidence)).toBe(true);
    expect(structuralRoleHasClearEvidence("R1", summary, evidence)).toBe(true);
  });

  it("R1 POSSIBLE: no resource RV", () => {
    const summary = baseSummary("mixed");
    summary.sourceBreakdown = {
      ...summary.sourceBreakdown,
      resource: { rootedVisible: false, unrootedVisible: false },
    };
    expect(r1HasClearEvidence(summary, undefined)).toBe(false);
    expect(structuralRoleHasClearEvidence("R1", summary, undefined)).toBe(false);
  });

  it("R3 CLEAR: output RV", () => {
    const summary = baseSummary("leaning-strong");
    summary.sourceBreakdown = {
      ...summary.sourceBreakdown,
      output: { rootedVisible: true, unrootedVisible: false },
    };
    expect(r3HasClearEvidence(summary, undefined)).toBe(true);
    expect(structuralRoleHasClearEvidence("R3", summary, undefined)).toBe(true);
  });

  it("R3 POSSIBLE: no output RV and no rooted 식상 pressure", () => {
    const summary = baseSummary("leaning-strong");
    summary.sourceBreakdown = {
      ...summary.sourceBreakdown,
      output: { rootedVisible: false, unrootedVisible: true },
    };
    expect(r3HasClearEvidence(summary, undefined)).toBe(false);
    expect(structuralRoleHasClearEvidence("R3", summary, undefined)).toBe(false);
  });

  it("R4 CLEAR: wealth or officer RV", () => {
    const summary = baseSummary("leaning-weak");
    summary.sourceBreakdown = {
      ...summary.sourceBreakdown,
      wealth: { rootedVisible: true, unrootedVisible: false },
      officer: { rootedVisible: false, unrootedVisible: false },
    };
    expect(r4HasClearEvidence(summary, undefined)).toBe(true);
    expect(structuralRoleHasClearEvidence("R4", summary, undefined)).toBe(true);
  });

  it("R4 POSSIBLE: no wealth/officer RV", () => {
    const summary = baseSummary("leaning-weak");
    summary.sourceBreakdown = {
      ...summary.sourceBreakdown,
      wealth: { rootedVisible: false, unrootedVisible: false },
      officer: { rootedVisible: false, unrootedVisible: false },
    };
    expect(r4HasClearEvidence(summary, undefined)).toBe(false);
    expect(structuralRoleHasClearEvidence("R4", summary, undefined)).toBe(false);
  });

  it("bottleneckIsClear mirrors CLEAR only", () => {
    expect(bottleneckIsClear("CLEAR")).toBe(true);
    expect(bottleneckIsClear("POSSIBLE")).toBe(false);
    expect(bottleneckIsClear("NOT")).toBe(false);
  });
});
