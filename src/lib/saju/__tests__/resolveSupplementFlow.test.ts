import { describe, expect, it, vi } from "vitest";
import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { buildNeedResolution } from "@/lib/saju/elements/needResolution";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { buildStrengthSummary } from "@/lib/saju/elements/strengthSummary";
import * as derivePolicy from "@/lib/saju/final/deriveSupplementCandidatePolicyStates";
import type { SupplementCandidatePolicy } from "@/lib/saju/final/deriveSupplementCandidatePolicyStates";
import { resolveFinalElement } from "@/lib/saju/final/resolveFinalElement";
import { resolveSupplementFlow } from "@/lib/saju/final/resolveSupplementFlow";
import type { FinalResolution } from "@/lib/saju/final/types";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import type { AdjustedClimateSummary, FourPillars } from "@/lib/saju/types";

const EMPTY_ROLES: FinalResolution["roleActivities"] = {
  R1: "C",
  R2: "C",
  R3: "C",
  R4: "C",
  R5: "C",
  R6: "C",
};

function emptyClimate(): AdjustedClimateSummary {
  return {
    certainty: "complete",
    baseClimate: { temperature: "balanced", moisture: "balanced" },
    temperature: { status: "resolved", value: "balanced", outcome: "unchanged" },
    moisture: { status: "resolved", value: "balanced", outcome: "unchanged" },
    fireQuality: "absent",
    waterQuality: "absent",
    mitigationFactors: [],
    reinforcementFactors: [],
    conflicts: [],
    unresolvedReasons: [],
    omittedSlots: [],
  };
}

function finalResolution(
  partial: Pick<FinalResolution, "finalElement" | "finalRole" | "certainty"> &
    Partial<FinalResolution>,
): FinalResolution {
  return {
    roleActivities: EMPTY_ROLES,
    r2Bottleneck: null,
    r5Bottleneck: null,
    hourStability: null,
    reasons: ["fer:test"],
    decisionTrace: [],
    ...partial,
  };
}

const BASE_PILLARS: FourPillars = {
  year: { stem: "甲", branch: "子" },
  month: { stem: "甲", branch: "子" },
  day: { stem: "丙", branch: "午" },
  hour: { stem: "甲", branch: "子" },
  hourCertainty: "confirmed",
  warnings: [],
};

describe("resolveSupplementFlow — regression 辛酉/乙未/丙申/戊戌", () => {
  const pillars: FourPillars = {
    year: { stem: "辛", branch: "酉" },
    month: { stem: "乙", branch: "未" },
    day: { stem: "丙", branch: "申" },
    hour: { stem: "戊", branch: "戌" },
    hourCertainty: "confirmed",
    warnings: [],
  };

  it("Core=火 → Supplement=木 resolved pipeline", () => {
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);
    const climate = buildAdjustedClimateSummary(pillars);
    const needResolution = buildNeedResolution(pillars);
    const fer = resolveFinalElement({
      pillars,
      summary: buildStrengthSummary(pillars),
      evidence,
      observations,
      climate,
      needResolution,
    });
    expect(fer.finalElement).toBe("火");

    const flow = resolveSupplementFlow({
      pillars,
      finalResolution: fer,
      observations,
      climate,
      needResolution,
    });

    expect(flow.coreState?.core).toBe("火");

    const byElement = Object.fromEntries(
      flow.policies.map((row: SupplementCandidatePolicy) => [row.element, row.state]),
    );
    expect(byElement["木"]).toBe("ACTIVE");
    expect(byElement["火"]).toBe("CAUTION");
    expect(byElement["土"]).toBe("INACTIVE");
    expect(byElement["金"]).toBe("INACTIVE");
    expect(byElement["水"]).toBe("INACTIVE");

    expect(flow.resolution).toMatchObject({
      coreElement: "火",
      supplementElement: "木",
      supplementStatus: "resolved",
    });
  });
});

describe("resolveSupplementFlow — edge contracts", () => {
  it("1. Core unresolved → supplement null + empty intermediate arrays", () => {
    const pillars = BASE_PILLARS;
    const observations = buildStrengthObservations(pillars);
    const flow = resolveSupplementFlow({
      pillars,
      finalResolution: finalResolution({
        finalElement: null,
        finalRole: null,
        certainty: "unresolved",
      }),
      observations,
      climate: emptyClimate(),
    });

    expect(flow.coreState).toBeNull();
    expect(flow.candidateStates).toEqual([]);
    expect(flow.corridors).toEqual([]);
    expect(flow.policies).toEqual([]);
    expect(flow.resolution).toMatchObject({
      coreElement: null,
      supplementElement: null,
      supplementStatus: "unresolved",
      coreCertainty: "unresolved",
    });
  });

  it("2. Core resolved + ACTIVE 1개 → resolved", () => {
    const pillars: FourPillars = {
      year: { stem: "辛", branch: "酉" },
      month: { stem: "乙", branch: "未" },
      day: { stem: "丙", branch: "申" },
      hour: { stem: "戊", branch: "戌" },
      hourCertainty: "confirmed",
      warnings: [],
    };
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);
    const climate = buildAdjustedClimateSummary(pillars);
    const needResolution = buildNeedResolution(pillars);
    const fer = resolveFinalElement({
      pillars,
      summary: buildStrengthSummary(pillars),
      evidence,
      observations,
      climate,
      needResolution,
    });

    const flow = resolveSupplementFlow({
      pillars,
      finalResolution: fer,
      observations,
      climate,
      needResolution,
    });

    const active = flow.policies.filter((row) => row.state === "ACTIVE");
    expect(active).toHaveLength(1);
    expect(flow.resolution.supplementStatus).toBe("resolved");
    expect(flow.resolution.supplementElement).toBe(active[0]?.element);
  });

  it("3. Core resolved + Supplement ACTIVE 0 → Supplement unresolved, Core kept", () => {
    const pillars: FourPillars = {
      year: { stem: "丙", branch: "午" },
      month: { stem: "丁", branch: "巳" },
      day: { stem: "丙", branch: "午" },
      hour: { stem: "丁", branch: "巳" },
      hourCertainty: "confirmed",
      warnings: [],
    };
    const observations = buildStrengthObservations(pillars);
    const climate = buildAdjustedClimateSummary(pillars);
    const flow = resolveSupplementFlow({
      pillars,
      finalResolution: finalResolution({
        finalElement: "火",
        finalRole: "R2",
        certainty: "provisional",
      }),
      observations,
      climate,
    });

    expect(flow.coreState?.core).toBe("火");
    expect(flow.policies.filter((row) => row.state === "ACTIVE")).toHaveLength(0);
    expect(flow.resolution).toMatchObject({
      coreElement: "火",
      supplementElement: null,
      supplementStatus: "unresolved",
    });
  });

  it("4. Core resolved + ACTIVE 복수 동률 → Supplement unresolved", () => {
    const pillars = BASE_PILLARS;
    const observations = buildStrengthObservations(pillars);
    const spy = vi
      .spyOn(derivePolicy, "deriveSupplementCandidatePolicyStates")
      .mockReturnValue([
        {
          element: "木",
          state: "ACTIVE",
          positiveFunctions: ["F2_GENERATIVE"],
          cautionFunctions: [],
          reasons: [],
        },
        {
          element: "水",
          state: "ACTIVE",
          positiveFunctions: ["F7_CLIMATE_MITIGATION"],
          cautionFunctions: [],
          reasons: [],
        },
        {
          element: "火",
          state: "INACTIVE",
          positiveFunctions: [],
          cautionFunctions: [],
          reasons: [],
        },
        {
          element: "土",
          state: "INACTIVE",
          positiveFunctions: [],
          cautionFunctions: [],
          reasons: [],
        },
        {
          element: "金",
          state: "INACTIVE",
          positiveFunctions: [],
          cautionFunctions: [],
          reasons: [],
        },
      ]);

    try {
      const flow = resolveSupplementFlow({
        pillars,
        finalResolution: finalResolution({
          finalElement: "火",
          finalRole: "R2",
          certainty: "provisional",
        }),
        observations,
        climate: emptyClimate(),
      });

      expect(flow.resolution).toMatchObject({
        coreElement: "火",
        supplementElement: null,
        supplementStatus: "unresolved",
      });
      expect(flow.policies.filter((row) => row.state === "ACTIVE")).toHaveLength(2);
    } finally {
      spy.mockRestore();
    }
  });
});
