import { describe, expect, it } from "vitest";
import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { buildNeedResolution } from "@/lib/saju/elements/needResolution";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { buildStrengthSummary } from "@/lib/saju/elements/strengthSummary";
import { buildCoreElementState } from "@/lib/saju/final/buildCoreElementState";
import { buildCoreScopedCorridors } from "@/lib/saju/final/buildCoreScopedCorridors";
import { buildSupplementCandidateStates } from "@/lib/saju/final/buildSupplementCandidateStates";
import { deriveSupplementCandidatePolicyStates } from "@/lib/saju/final/deriveSupplementCandidatePolicyStates";
import { resolveCoreAndSupplement } from "@/lib/saju/final/resolveCoreAndSupplement";
import { resolveFinalElement } from "@/lib/saju/final/resolveFinalElement";
import { resolveSupplementElement } from "@/lib/saju/final/resolveSupplementElement";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import type { FinalResolution } from "@/lib/saju/final/types";
import type { FourPillars } from "@/lib/saju/types";

const EMPTY_ROLES: FinalResolution["roleActivities"] = {
  R1: "C",
  R2: "C",
  R3: "C",
  R4: "C",
  R5: "C",
  R6: "C",
};

function finalResolution(
  partial: Pick<FinalResolution, "finalElement" | "finalRole" | "certainty"> &
    Partial<FinalResolution>,
): FinalResolution {
  return {
    roleActivities: EMPTY_ROLES,
    r2Bottleneck: null,
    r5Bottleneck: null,
    hourStability: null,
    reasons: ["core-reason"],
    decisionTrace: [],
    ...partial,
  };
}

describe("resolveCoreAndSupplement", () => {
  it("1. Core 火 + Supplement 木", () => {
    const result = resolveCoreAndSupplement({
      finalResolution: finalResolution({
        finalElement: "火",
        finalRole: "R2",
        certainty: "provisional",
      }),
      supplementResolution: {
        supplementElement: "木",
        status: "resolved",
        reasons: ["resolved:single-active=木"],
      },
    });
    expect(result).toMatchObject({
      coreElement: "火",
      coreRole: "R2",
      coreCertainty: "provisional",
      supplementElement: "木",
      supplementStatus: "resolved",
    });
  });

  it("2. Core 火 + Supplement 火", () => {
    const result = resolveCoreAndSupplement({
      finalResolution: finalResolution({
        finalElement: "火",
        finalRole: "R1",
        certainty: "confirmed",
      }),
      supplementResolution: {
        supplementElement: "火",
        status: "resolved",
        reasons: ["resolved:single-active=火"],
      },
    });
    expect(result).toMatchObject({
      coreElement: "火",
      supplementElement: "火",
      supplementStatus: "resolved",
    });
  });

  it("3. Core resolved + Supplement unresolved", () => {
    const result = resolveCoreAndSupplement({
      finalResolution: finalResolution({
        finalElement: "火",
        finalRole: "R2",
        certainty: "provisional",
      }),
      supplementResolution: {
        supplementElement: null,
        status: "unresolved",
        reasons: ["unresolved:no-active"],
      },
    });
    expect(result).toMatchObject({
      coreElement: "火",
      coreRole: "R2",
      supplementElement: null,
      supplementStatus: "unresolved",
    });
  });

  it("4. Core unresolved → Supplement 강제 null", () => {
    const result = resolveCoreAndSupplement({
      finalResolution: finalResolution({
        finalElement: null,
        finalRole: null,
        certainty: "unresolved",
        reasons: ["certainty:unresolved"],
      }),
      supplementResolution: {
        supplementElement: "木",
        status: "resolved",
        reasons: ["resolved:single-active=木"],
      },
    });
    expect(result).toMatchObject({
      coreElement: null,
      coreRole: null,
      coreCertainty: "unresolved",
      supplementElement: null,
      supplementStatus: "unresolved",
    });
    expect(result.reasons).toContain("core:unresolved-forces-supplement-null");
  });

  it("5. reasons 합치기", () => {
    const result = resolveCoreAndSupplement({
      finalResolution: finalResolution({
        finalElement: "火",
        finalRole: "R2",
        certainty: "provisional",
        reasons: ["alpha", "beta"],
      }),
      supplementResolution: {
        supplementElement: "木",
        status: "resolved",
        reasons: ["gamma"],
      },
    });
    expect(result.reasons).toEqual([
      "core:alpha",
      "core:beta",
      "supplement:gamma",
    ]);
  });
});

describe("resolveCoreAndSupplement — regression 辛酉/乙未/丙申/戊戌", () => {
  it("coreElement=火, supplementElement=木", () => {
    const pillars: FourPillars = {
      year: { stem: "辛", branch: "酉" },
      month: { stem: "乙", branch: "未" },
      day: { stem: "丙", branch: "申" },
      hour: { stem: "戊", branch: "戌" },
    };
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);
    const climate = buildAdjustedClimateSummary(pillars);
    const needResolution = buildNeedResolution(pillars);
    const finalResolution = resolveFinalElement({
      pillars,
      summary: buildStrengthSummary(pillars),
      evidence,
      observations,
      climate,
      needResolution,
    });
    const coreState = buildCoreElementState({
      pillars,
      core: finalResolution.finalElement!,
      observations,
    });
    const policies = deriveSupplementCandidatePolicyStates({
      coreState,
      candidateStates: buildSupplementCandidateStates({
        pillars,
        coreState,
        observations,
      }),
      corridors: buildCoreScopedCorridors({
        core: finalResolution.finalElement!,
        observations,
      }),
      climate,
      needResolution,
    });
    const supplementResolution = resolveSupplementElement({
      core: finalResolution.finalElement!,
      policies,
    });
    const combined = resolveCoreAndSupplement({
      finalResolution,
      supplementResolution,
    });

    expect(combined.coreElement).toBe("火");
    expect(combined.supplementElement).toBe("木");
    expect(combined.supplementStatus).toBe("resolved");
  });
});
