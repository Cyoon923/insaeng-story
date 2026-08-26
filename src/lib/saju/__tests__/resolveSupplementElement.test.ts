import { describe, expect, it } from "vitest";
import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { buildNeedResolution } from "@/lib/saju/elements/needResolution";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { buildStrengthSummary } from "@/lib/saju/elements/strengthSummary";
import { buildCoreElementState } from "@/lib/saju/final/buildCoreElementState";
import { buildCoreScopedCorridors } from "@/lib/saju/final/buildCoreScopedCorridors";
import { buildSupplementCandidateStates } from "@/lib/saju/final/buildSupplementCandidateStates";
import {
  deriveSupplementCandidatePolicyStates,
  type SupplementCandidatePolicy,
  type SupplementFunction,
} from "@/lib/saju/final/deriveSupplementCandidatePolicyStates";
import { resolveSupplementElement } from "@/lib/saju/final/resolveSupplementElement";
import { resolveFinalElement } from "@/lib/saju/final/resolveFinalElement";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import type { Element, FourPillars } from "@/lib/saju/types";

function policy(
  partial: Pick<SupplementCandidatePolicy, "element" | "state"> &
    Partial<SupplementCandidatePolicy>,
): SupplementCandidatePolicy {
  return {
    positiveFunctions: [],
    cautionFunctions: [],
    reasons: [],
    ...partial,
  };
}

function resolve(core: Element, policies: SupplementCandidatePolicy[]) {
  return resolveSupplementElement({ core, policies });
}

describe("resolveSupplementElement — regression 辛酉/乙未/丙申/戊戌", () => {
  const pillars: FourPillars = {
    year: { stem: "辛", branch: "酉" },
    month: { stem: "乙", branch: "未" },
    day: { stem: "丙", branch: "申" },
    hour: { stem: "戊", branch: "戌" },
  };

  it("policy ACTIVE 木 alone → resolved 木", () => {
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

    const coreState = buildCoreElementState({
      pillars,
      core: fer.finalElement!,
      observations,
    });
    const candidateStates = buildSupplementCandidateStates({
      pillars,
      coreState,
      observations,
    });
    const corridors = buildCoreScopedCorridors({
      core: fer.finalElement!,
      observations,
    });
    const policies = deriveSupplementCandidatePolicyStates({
      coreState,
      candidateStates,
      corridors,
      climate,
      needResolution,
    });

    const result = resolveSupplementElement({
      core: fer.finalElement!,
      policies,
    });

    expect(result).toMatchObject({
      supplementElement: "木",
      status: "resolved",
    });
    expect(result.reasons.some((line) => line.includes("single-active=木"))).toBe(true);
  });
});

describe("resolveSupplementElement — selection rules", () => {
  it("1. ACTIVE 1개 → resolved", () => {
    const result = resolve("火", [
      policy({
        element: "木",
        state: "ACTIVE",
        positiveFunctions: ["F2_GENERATIVE"],
      }),
      policy({ element: "火", state: "CAUTION" }),
      policy({ element: "土", state: "INACTIVE" }),
    ]);
    expect(result).toMatchObject({
      supplementElement: "木",
      status: "resolved",
    });
    expect(result.reasons).toEqual(expect.arrayContaining(["resolved:single-active=木"]));
  });

  it("2. ACTIVE 0개 → unresolved", () => {
    const result = resolve("火", [
      policy({ element: "火", state: "CAUTION" }),
      policy({ element: "土", state: "INACTIVE" }),
    ]);
    expect(result.supplementElement).toBeNull();
    expect(result.status).toBe("unresolved");
    expect(result.reasons).toEqual(
      expect.arrayContaining(["unresolved:no-active", "caution-not-promoted-to-winner"]),
    );
  });

  it("3. ACTIVE 2개, F2+F6 vs single positive → mediated-generative", () => {
    const mediated: SupplementFunction[] = ["F2_GENERATIVE", "F6_INCOMING_MEDIATION"];
    const result = resolve("火", [
      policy({
        element: "水",
        state: "ACTIVE",
        positiveFunctions: ["F7_CLIMATE_MITIGATION"],
      }),
      policy({
        element: "木",
        state: "ACTIVE",
        positiveFunctions: mediated,
      }),
    ]);
    expect(result).toMatchObject({
      supplementElement: "木",
      status: "resolved",
    });
    expect(result.reasons.some((line) => line.includes("tie-break-mediated-generative=木"))).toBe(
      true,
    );
  });

  it("4. ACTIVE 2개 동급 → unresolved", () => {
    const result = resolve("火", [
      policy({
        element: "木",
        state: "ACTIVE",
        positiveFunctions: ["F2_GENERATIVE"],
      }),
      policy({
        element: "水",
        state: "ACTIVE",
        positiveFunctions: ["F7_CLIMATE_MITIGATION"],
      }),
    ]);
    expect(result.supplementElement).toBeNull();
    expect(result.status).toBe("unresolved");
    expect(result.reasons.some((line) => line.includes("unresolved:multiple-active"))).toBe(true);
  });

  it("5. CAUTION 1개만 → unresolved", () => {
    const result = resolve("火", [
      policy({
        element: "火",
        state: "CAUTION",
        cautionFunctions: ["F8_CLIMATE_REINFORCEMENT"],
      }),
    ]);
    expect(result).toMatchObject({
      supplementElement: null,
      status: "unresolved",
    });
  });

  it("6. ACTIVE 1 + CAUTION 여러개 → ACTIVE 선택", () => {
    const result = resolve("火", [
      policy({ element: "火", state: "CAUTION" }),
      policy({
        element: "木",
        state: "ACTIVE",
        positiveFunctions: ["F2_GENERATIVE", "F6_INCOMING_MEDIATION"],
      }),
      policy({ element: "水", state: "CAUTION" }),
    ]);
    expect(result).toMatchObject({
      supplementElement: "木",
      status: "resolved",
    });
  });

  it("7. INACTIVE만 → unresolved", () => {
    const result = resolve("火", [
      policy({ element: "土", state: "INACTIVE" }),
      policy({ element: "金", state: "INACTIVE" }),
    ]);
    expect(result).toMatchObject({
      supplementElement: null,
      status: "unresolved",
    });
  });

  it("does not prefer array order when multiple equal ACTIVE", () => {
    const result = resolve("火", [
      policy({
        element: "金",
        state: "ACTIVE",
        positiveFunctions: ["F1_DIRECT"],
      }),
      policy({
        element: "木",
        state: "ACTIVE",
        positiveFunctions: ["F2_GENERATIVE"],
      }),
    ]);
    expect(result.status).toBe("unresolved");
    expect(result.supplementElement).toBeNull();
  });
});
