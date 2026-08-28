import { describe, expect, it } from "vitest";
import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { buildNeedResolution } from "@/lib/saju/elements/needResolution";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { buildStrengthSummary } from "@/lib/saju/elements/strengthSummary";
import { buildCoreScopedCorridors } from "@/lib/saju/final/buildCoreScopedCorridors";
import type { SupplementCandidatePolicy } from "@/lib/saju/final/deriveSupplementCandidatePolicyStates";
import { resolveFinalElement } from "@/lib/saju/final/resolveFinalElement";
import { resolveSupplementFlow } from "@/lib/saju/final/resolveSupplementFlow";
import { deriveNatalDeficitGoals } from "@/lib/saju/luck/annual/deriveNatalDeficitGoals";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import type {
  AdjustedClimateSummary,
  Element,
  FourPillars,
} from "@/lib/saju/types";

const REP_PILLARS: FourPillars = {
  year: { stem: "辛", branch: "酉" },
  month: { stem: "乙", branch: "未" },
  day: { stem: "丙", branch: "申" },
  hour: { stem: "戊", branch: "戌" },
  hourCertainty: "confirmed",
  warnings: [],
};

function emptyClimate(
  over: Partial<AdjustedClimateSummary> = {},
): AdjustedClimateSummary {
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
    ...over,
  };
}

function policy(
  element: Element,
  positive: SupplementCandidatePolicy["positiveFunctions"] = [],
  state: SupplementCandidatePolicy["state"] = "ACTIVE",
): SupplementCandidatePolicy {
  return {
    element,
    state,
    positiveFunctions: positive,
    cautionFunctions: [],
    reasons: [],
  };
}

function baseInput(over: {
  core?: Element;
  supplement?: Element | null;
  status?: "resolved" | "unresolved";
  policies?: SupplementCandidatePolicy[];
  corridors?: ReturnType<typeof buildCoreScopedCorridors>;
  climate?: AdjustedClimateSummary;
}) {
  return {
    natalCoreElement: over.core ?? "火",
    natalSupplementElement: over.supplement ?? "木",
    natalSupplementStatus: over.status ?? "resolved",
    natalPolicies: over.policies ?? [policy("木", ["F2_GENERATIVE"])],
    natalCorridors: over.corridors ?? [],
    natalClimate: over.climate ?? emptyClimate(),
  };
}

describe("deriveNatalDeficitGoals — representative 辛酉/乙未/丙申/戊戌", () => {
  it("Core=火 Supplement=木 → CORE_SUPPORT + INCOMING_MEDIATION, no CLIMATE", () => {
    const evidence = collectStrengthEvidence(REP_PILLARS);
    const observations = buildStrengthObservations(REP_PILLARS, evidence);
    const climate = buildAdjustedClimateSummary(REP_PILLARS);
    const needResolution = buildNeedResolution(REP_PILLARS);
    const fer = resolveFinalElement({
      pillars: REP_PILLARS,
      summary: buildStrengthSummary(REP_PILLARS),
      evidence,
      observations,
      climate,
      needResolution,
    });
    const flow = resolveSupplementFlow({
      pillars: REP_PILLARS,
      finalResolution: fer,
      observations,
      climate,
      needResolution,
    });

    expect(flow.resolution.supplementElement).toBe("木");
    expect(flow.resolution.supplementStatus).toBe("resolved");

    const goals = deriveNatalDeficitGoals({
      natalCoreElement: "火",
      natalSupplementElement: flow.resolution.supplementElement,
      natalSupplementStatus: flow.resolution.supplementStatus,
      natalPolicies: flow.policies,
      natalCorridors: flow.corridors,
      natalClimate: climate,
    });

    const kinds = goals.map((row) => row.kind);
    expect(kinds).toEqual(["CORE_SUPPORT", "INCOMING_MEDIATION"]);
    expect(kinds).not.toContain("CLIMATE_MITIGATION");

    const core = goals.find((row) => row.kind === "CORE_SUPPORT")!;
    expect(core.sourceFunctions).toEqual(["F2_GENERATIVE"]);
    expect(core.methods).toEqual(["generative"]);
    expect(core.targetElement).toBe("火");
    expect(core.sourceElement).toBe("木");

    const incoming = goals.find((row) => row.kind === "INCOMING_MEDIATION")!;
    expect(incoming.sourceFunctions).toEqual(["F6_INCOMING_MEDIATION"]);
    expect(incoming.targetElement).toBe("火");
    expect(incoming.sourceElement).toBe("木");
  });
});

describe("deriveNatalDeficitGoals — F mapping fixtures", () => {
  it("F1 only → CORE_SUPPORT direct", () => {
    const goals = deriveNatalDeficitGoals(
      baseInput({
        supplement: "火",
        policies: [policy("火", ["F1_DIRECT"])],
      }),
    );
    expect(goals).toHaveLength(1);
    expect(goals[0]).toMatchObject({
      kind: "CORE_SUPPORT",
      sourceFunctions: ["F1_DIRECT"],
      methods: ["direct"],
      targetElement: "火",
      sourceElement: "火",
    });
  });

  it("F2 only → CORE_SUPPORT generative", () => {
    const goals = deriveNatalDeficitGoals(
      baseInput({
        supplement: "木",
        policies: [policy("木", ["F2_GENERATIVE"])],
      }),
    );
    expect(goals[0]).toMatchObject({
      kind: "CORE_SUPPORT",
      sourceFunctions: ["F2_GENERATIVE"],
      methods: ["generative"],
    });
  });

  it("F1+F2 → single CORE_SUPPORT with both sourceFunctions", () => {
    const goals = deriveNatalDeficitGoals(
      baseInput({
        supplement: "木",
        policies: [policy("木", ["F1_DIRECT", "F2_GENERATIVE"])],
      }),
    );
    expect(goals.filter((row) => row.kind === "CORE_SUPPORT")).toHaveLength(1);
    expect(goals[0]!.sourceFunctions).toEqual(["F1_DIRECT", "F2_GENERATIVE"]);
    expect(goals[0]!.methods).toEqual(["direct", "generative"]);
  });

  it("F6 policy without corridor → no INCOMING_MEDIATION goal", () => {
    const goals = deriveNatalDeficitGoals(
      baseInput({
        supplement: "木",
        policies: [policy("木", ["F2_GENERATIVE", "F6_INCOMING_MEDIATION"])],
        corridors: [],
      }),
    );
    expect(goals.map((row) => row.kind)).toEqual(["CORE_SUPPORT"]);
  });

  it("F7 水 winner + usable warm/dry climate → CLIMATE_MITIGATION", () => {
    const climate = buildAdjustedClimateSummary(REP_PILLARS);
    const goals = deriveNatalDeficitGoals(
      baseInput({
        core: "火",
        supplement: "水",
        policies: [policy("水", ["F7_CLIMATE_MITIGATION"])],
        climate,
      }),
    );
    expect(goals).toHaveLength(1);
    expect(goals[0]).toMatchObject({
      kind: "CLIMATE_MITIGATION",
      sourceFunctions: ["F7_CLIMATE_MITIGATION"],
      targetElement: "水",
      sourceElement: "水",
      methods: ["climate-fire-water"],
    });
  });

  it("F7 on 木 winner → no CLIMATE goal even if policy string present", () => {
    const climate = buildAdjustedClimateSummary(REP_PILLARS);
    const goals = deriveNatalDeficitGoals(
      baseInput({
        supplement: "木",
        policies: [policy("木", ["F2_GENERATIVE", "F7_CLIMATE_MITIGATION"])],
        climate,
      }),
    );
    expect(goals.every((row) => row.kind !== "CLIMATE_MITIGATION")).toBe(true);
  });
});

describe("deriveNatalDeficitGoals — guard rails", () => {
  it("Supplement unresolved or null → []", () => {
    expect(
      deriveNatalDeficitGoals(
        baseInput({ supplement: null, status: "unresolved" }),
      ),
    ).toEqual([]);
    expect(
      deriveNatalDeficitGoals(
        baseInput({ supplement: "木", status: "unresolved" }),
      ),
    ).toEqual([]);
  });

  it("CAUTION-only functions → no goals", () => {
    const goals = deriveNatalDeficitGoals(
      baseInput({
        supplement: "火",
        policies: [
          {
            element: "火",
            state: "CAUTION",
            positiveFunctions: [],
            cautionFunctions: ["F8_CLIMATE_REINFORCEMENT"],
            reasons: [],
          },
        ],
      }),
    );
    expect(goals).toEqual([]);
  });

  it("does not mix other candidate positives into winner goals", () => {
    const corridor = {
      kind: "incoming-mid" as const,
      mid: "木" as Element,
      from: "水" as Element,
      to: "火" as Element,
      firstLeg: "surface" as const,
      secondLeg: "surface" as const,
    };
    const goals = deriveNatalDeficitGoals(
      baseInput({
        supplement: "木",
        policies: [
          policy("木", ["F2_GENERATIVE", "F6_INCOMING_MEDIATION"]),
          policy("水", ["F7_CLIMATE_MITIGATION"]),
        ],
        corridors: [corridor],
        climate: buildAdjustedClimateSummary(REP_PILLARS),
      }),
    );
    expect(goals.map((row) => row.kind)).toEqual([
      "CORE_SUPPORT",
      "INCOMING_MEDIATION",
    ]);
    expect(goals.some((row) => row.kind === "CLIMATE_MITIGATION")).toBe(false);
  });

  it("F8 caution on winner does not create goals", () => {
    const goals = deriveNatalDeficitGoals(
      baseInput({
        supplement: "水",
        policies: [
          {
            element: "水",
            state: "CAUTION",
            positiveFunctions: [],
            cautionFunctions: ["F8_CLIMATE_REINFORCEMENT"],
            reasons: [],
          },
        ],
        climate: buildAdjustedClimateSummary(REP_PILLARS),
      }),
    );
    expect(goals).toEqual([]);
  });
});
