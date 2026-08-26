import { describe, expect, it } from "vitest";
import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { buildNeedResolution } from "@/lib/saju/elements/needResolution";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { buildStrengthSummary } from "@/lib/saju/elements/strengthSummary";
import { stemElement } from "@/lib/saju/constants/elements";
import { resolveFinalElement } from "@/lib/saju/final/resolveFinalElement";
import { generatedElement } from "@/lib/saju/observation/elementGenerates";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
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

function resolve(
  pillars: FourPillars,
  summaryOverride?: Partial<StrengthSummary>,
) {
  const evidence = collectStrengthEvidence(pillars);
  const observations = buildStrengthObservations(pillars, evidence);
  const summary = { ...buildStrengthSummary(pillars), ...summaryOverride };
  if (summaryOverride?.sourceBreakdown) {
    summary.sourceBreakdown = {
      ...buildStrengthSummary(pillars).sourceBreakdown,
      ...summaryOverride.sourceBreakdown,
    };
  }
  const climate = buildAdjustedClimateSummary(pillars);
  const needResolution = buildNeedResolution(pillars);
  return resolveFinalElement({
    pillars,
    summary,
    evidence,
    observations,
    climate,
    needResolution,
  });
}

describe("resolveFinalElement", () => {
  it("1. MX-1981 → 火 / R2 / provisional", () => {
    const result = resolve(
      chart({
        year: { stem: "辛", branch: "酉" },
        month: { stem: "乙", branch: "未" },
        day: { stem: "丙", branch: "申" },
        hour: { stem: "戊", branch: "戌" },
      }),
    );
    expect(result.finalElement).toBe("火");
    expect(result.finalRole).toBe("R2");
    expect(result.certainty).toBe("provisional");
  });

  it("2. confirmed R2 CLEAR 합성 → dayElement / R2 / confirmed", () => {
    const pillars = chart({
      year: { stem: "壬", branch: "子" },
      month: { stem: "癸", branch: "酉" },
      day: { stem: "甲", branch: "亥" },
      hour: { stem: "壬", branch: "子" },
    });
    const result = resolve(pillars);
    expect(result.r2Bottleneck).toBe("CLEAR");
    expect(result.finalRole).toBe("R2");
    expect(result.finalElement).toBe(stemElement(pillars.day.stem));
    expect(result.certainty).toBe("confirmed");
  });

  it("3. confirmed R3 CLEAR 합성 → output element / R3 / confirmed", () => {
    const pillars = chart({
      year: { stem: "丙", branch: "巳" },
      month: { stem: "甲", branch: "寅" },
      day: { stem: "丙", branch: "巳" },
      hour: { stem: "庚", branch: "午" },
    });
    const base = buildStrengthSummary(pillars);
    const result = resolve(pillars, {
      directionCandidate: "leaning-strong",
      sourceBreakdown: {
        ...base.sourceBreakdown,
        output: { rootedVisible: true, unrootedVisible: false },
      },
    });
    expect(result.finalRole).toBe("R3");
    expect(result.finalElement).toBe(generatedElement(stemElement(pillars.day.stem)));
    expect(result.certainty).toBe("confirmed");
  });

  it("4. HU-LS hour unknown → null / null / unresolved + hourStability=C", () => {
    const result = resolve(
      chart({
        year: { stem: "甲", branch: "寅" },
        month: { stem: "甲", branch: "寅" },
        day: { stem: "甲", branch: "子" },
        hour: "unknown",
      }),
    );
    expect(result.hourStability).toBe("C");
    expect(result.certainty).toBe("unresolved");
    expect(result.finalElement).toBeNull();
    expect(result.finalRole).toBeNull();
  });

  it("5. NL-gaphae hour unknown → null / null / unresolved + hourStability=C", () => {
    const result = resolve(
      chart({
        year: { stem: "甲", branch: "寅" },
        month: { stem: "辛", branch: "亥" },
        day: { stem: "庚", branch: "子" },
        hour: "unknown",
      }),
    );
    expect(result.hourStability).toBe("C");
    expect(result.certainty).toBe("unresolved");
    expect(result.finalElement).toBeNull();
    expect(result.finalRole).toBeNull();
  });

  it("6. LW-gapyu hour unknown → null / null / unresolved + hourStability=C", () => {
    const result = resolve(
      chart({
        year: { stem: "甲", branch: "酉" },
        month: { stem: "庚", branch: "酉" },
        day: { stem: "甲", branch: "酉" },
        hour: "unknown",
      }),
    );
    expect(result.hourStability).toBe("C");
    expect(result.certainty).toBe("unresolved");
    expect(result.finalElement).toBeNull();
    expect(result.finalRole).toBeNull();
  });

  it("7. LS-birth → 金/R1 vs clear 火 → null / null / unresolved", () => {
    const result = resolve(
      chart({
        year: { stem: "己", branch: "卯" },
        month: { stem: "丙", branch: "子" },
        day: { stem: "癸", branch: "卯" },
        hour: { stem: "壬", branch: "子" },
      }),
    );
    expect(result.certainty).toBe("unresolved");
    expect(result.finalElement).toBeNull();
    expect(result.finalRole).toBeNull();
    expect(result.reasons).toContain("unresolved:candidate-status");
  });

  it("8. unresolved 계약: certainty=unresolved → finalElement/finalRole null", () => {
    const cases = [
      chart({
        year: { stem: "甲", branch: "寅" },
        month: { stem: "甲", branch: "寅" },
        day: { stem: "甲", branch: "子" },
        hour: "unknown",
      }),
      chart({
        year: { stem: "己", branch: "卯" },
        month: { stem: "丙", branch: "子" },
        day: { stem: "癸", branch: "卯" },
        hour: { stem: "壬", branch: "子" },
      }),
    ];
    for (const pillars of cases) {
      const result = resolve(pillars);
      expect(result.certainty).toBe("unresolved");
      expect(result.finalElement).toBeNull();
      expect(result.finalRole).toBeNull();
    }
  });

  it("9. decisionTrace에 각 단계가 실행 순서로 포함", () => {
    const result = resolve(
      chart({
        year: { stem: "辛", branch: "酉" },
        month: { stem: "乙", branch: "未" },
        day: { stem: "丙", branch: "申" },
        hour: { stem: "戊", branch: "戌" },
      }),
    );
    const steps = [
      "deriveRoleActivities:",
      "deriveR2Bottleneck:",
      "deriveR5Bottleneck:",
      "deriveRoleElementCandidates:",
      "deriveHourStability:",
      "derivePriorityRoles:",
      "resolveStructuralElement:",
      "resolveStructureVsClimate:",
      "deriveFinalCertainty:",
    ];
    let cursor = 0;
    for (const step of steps) {
      const idx = result.decisionTrace.findIndex(
        (line, i) => i >= cursor && line.startsWith(step),
      );
      expect(idx).toBeGreaterThanOrEqual(0);
      cursor = idx + 1;
    }
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.decisionTrace.some((line) => line.startsWith("deriveFinalCertainty:"))).toBe(
      true,
    );
  });
});
