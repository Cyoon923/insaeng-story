import { describe, expect, it } from "vitest";
import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { buildNeedResolution } from "@/lib/saju/elements/needResolution";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { buildStrengthSummary } from "@/lib/saju/elements/strengthSummary";
import { buildCoreElementState } from "@/lib/saju/final/buildCoreElementState";
import type { CoreElementState } from "@/lib/saju/final/buildCoreElementState";
import { buildCoreScopedCorridors } from "@/lib/saju/final/buildCoreScopedCorridors";
import type { CoreScopedCorridor } from "@/lib/saju/final/buildCoreScopedCorridors";
import { buildSupplementCandidateStates } from "@/lib/saju/final/buildSupplementCandidateStates";
import type { SupplementCandidateState } from "@/lib/saju/final/buildSupplementCandidateStates";
import { deriveSupplementCandidatePolicyStates } from "@/lib/saju/final/deriveSupplementCandidatePolicyStates";
import { resolveFinalElement } from "@/lib/saju/final/resolveFinalElement";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import type {
  AdjustedClimateSummary,
  ClimateFactor,
  Element,
  ElementPresenceKind,
  FourPillars,
  NeedResolution,
} from "@/lib/saju/types";

function emptyClimate(
  partial: Partial<AdjustedClimateSummary> = {},
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
    ...partial,
  };
}

function climateFactor(
  partial: Pick<ClimateFactor, "element"> & Partial<ClimateFactor>,
): ClimateFactor {
  return {
    slot: "day",
    layer: "stem",
    presence: "rooted-visible",
    visible: true,
    hidden: false,
    temperatureRole: "contextual",
    moistureRole: "contextual",
    ...partial,
  };
}

function coreState(partial: Partial<CoreElementState> & Pick<CoreElementState, "core">): CoreElementState {
  return {
    presence: "rooted-visible",
    parent: "木",
    child: "土",
    controller: "水",
    incomingGeneration: "none",
    controlPresence: "controller-absent",
    outgoingDrainage: "none",
    ...partial,
  };
}

function candidate(
  partial: Partial<SupplementCandidateState> & Pick<SupplementCandidateState, "element" | "relationToCore">,
): SupplementCandidateState {
  return {
    presence: "rooted-visible",
    generationToCore: "none",
    generationFromCore: "none",
    isParent: false,
    isChild: false,
    isController: false,
    corridorMidForCore: null,
    ...partial,
  };
}

function derive(input: {
  coreState: CoreElementState;
  candidateStates: SupplementCandidateState[];
  corridors?: CoreScopedCorridor[];
  climate?: AdjustedClimateSummary;
  needResolution?: NeedResolution;
}) {
  return deriveSupplementCandidatePolicyStates({
    coreState: input.coreState,
    candidateStates: input.candidateStates,
    corridors: input.corridors ?? [],
    climate: input.climate ?? emptyClimate(),
    needResolution: input.needResolution,
  });
}

describe("deriveSupplementCandidatePolicyStates — regression 辛酉/乙未/丙申/戊戌", () => {
  const pillars: FourPillars = {
    year: { stem: "辛", branch: "酉" },
    month: { stem: "乙", branch: "未" },
    day: { stem: "丙", branch: "申" },
    hour: { stem: "戊", branch: "戌" },
    hourCertainty: "confirmed",
    warnings: [],
  };

  it("classifies five candidates without asserting Supplement winner", () => {
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

    const core = buildCoreElementState({
      pillars,
      core: fer.finalElement!,
      observations,
    });
    const candidateStates = buildSupplementCandidateStates({
      pillars,
      coreState: core,
      observations,
    });
    const corridors = buildCoreScopedCorridors({
      core: fer.finalElement!,
      observations,
    });
    const policies = deriveSupplementCandidatePolicyStates({
      coreState: core,
      candidateStates,
      corridors,
      climate,
      needResolution,
    });

    const byElement = Object.fromEntries(policies.map((row) => [row.element, row]));

    expect(byElement["木"]?.state).toBe("ACTIVE");
    expect(byElement["木"]?.positiveFunctions).toEqual(
      expect.arrayContaining(["F2_GENERATIVE", "F6_INCOMING_MEDIATION"]),
    );
    expect(byElement["木"]?.cautionFunctions).toEqual([]);

    expect(byElement["火"]?.state).toBe("CAUTION");
    expect(byElement["火"]?.positiveFunctions).toEqual([]);
    expect(byElement["火"]?.cautionFunctions).toContain("F8_CLIMATE_REINFORCEMENT");

    expect(byElement["土"]?.state).toBe("INACTIVE");
    expect(byElement["金"]?.state).toBe("INACTIVE");
    expect(byElement["水"]?.state).toBe("INACTIVE");

    // No winner field / no sole-winner assertion
    for (const row of policies) {
      expect(row).not.toHaveProperty("winner");
      expect(row).not.toHaveProperty("selected");
    }
  });
});

describe("deriveSupplementCandidatePolicyStates — synthetic", () => {
  it("1. Core absent direct → F1 ACTIVE", () => {
    const [row] = derive({
      coreState: coreState({ core: "火", presence: "absent" }),
      candidateStates: [candidate({ element: "火", relationToCore: "direct" })],
    });
    expect(row.state).toBe("ACTIVE");
    expect(row.positiveFunctions).toEqual(["F1_DIRECT"]);
  });

  it("2. Core hidden-only direct → F1 ACTIVE", () => {
    const [row] = derive({
      coreState: coreState({ core: "火", presence: "hidden-only" }),
      candidateStates: [candidate({ element: "火", relationToCore: "direct" })],
    });
    expect(row.state).toBe("ACTIVE");
    expect(row.positiveFunctions).toEqual(["F1_DIRECT"]);
  });

  it("3. rooted-visible direct only → INACTIVE", () => {
    const [row] = derive({
      coreState: coreState({ core: "火", presence: "rooted-visible" }),
      candidateStates: [candidate({ element: "火", relationToCore: "direct" })],
    });
    expect(row.state).toBe("INACTIVE");
    expect(row.positiveFunctions).toEqual([]);
  });

  it("4. F2 surface → ACTIVE", () => {
    const [row] = derive({
      coreState: coreState({ core: "火" }),
      candidateStates: [
        candidate({
          element: "木",
          relationToCore: "generates-core",
          generationToCore: "surface",
          isParent: true,
        }),
      ],
    });
    expect(row.state).toBe("ACTIVE");
    expect(row.positiveFunctions).toEqual(["F2_GENERATIVE"]);
  });

  it("5. F2 hidden-context only → INACTIVE", () => {
    const [row] = derive({
      coreState: coreState({ core: "火" }),
      candidateStates: [
        candidate({
          element: "木",
          relationToCore: "generates-core",
          generationToCore: "hidden-context",
          isParent: true,
        }),
      ],
    });
    expect(row.state).toBe("INACTIVE");
    expect(row.positiveFunctions).toEqual([]);
  });

  it("6. F6 incoming surface+surface → ACTIVE", () => {
    const [row] = derive({
      coreState: coreState({ core: "火" }),
      candidateStates: [candidate({ element: "木", relationToCore: "generates-core" })],
      corridors: [
        {
          kind: "incoming-mid",
          mid: "木",
          from: "水",
          to: "火",
          firstLeg: "surface",
          secondLeg: "surface",
        },
      ],
    });
    expect(row.state).toBe("ACTIVE");
    expect(row.positiveFunctions).toContain("F6_INCOMING_MEDIATION");
  });

  it("7. F8 reinforcement + positive → CAUTION", () => {
    const [row] = derive({
      coreState: coreState({ core: "水", presence: "absent", parent: "金", child: "木", controller: "土" }),
      candidateStates: [candidate({ element: "水", relationToCore: "direct" })],
      climate: emptyClimate({
        temperature: { status: "resolved", value: "cold", outcome: "unchanged" },
        reinforcementFactors: [
          climateFactor({
            element: "水",
            temperatureRole: "reinforcement",
            moistureRole: "contextual",
          }),
        ],
      }),
    });
    // F1 positive (absent) + F8 caution → CAUTION
    expect(row.positiveFunctions).toContain("F1_DIRECT");
    expect(row.cautionFunctions).toContain("F8_CLIMATE_REINFORCEMENT");
    expect(row.state).toBe("CAUTION");
  });

  it("8. F8 caution only direct path → CAUTION", () => {
    const [row] = derive({
      coreState: coreState({ core: "火", presence: "rooted-visible" }),
      candidateStates: [candidate({ element: "火", relationToCore: "direct" })],
      climate: emptyClimate({
        temperature: { status: "resolved", value: "warm", outcome: "unchanged" },
        moisture: { status: "resolved", value: "dry", outcome: "unchanged" },
        reinforcementFactors: [
          climateFactor({
            element: "火",
            temperatureRole: "reinforcement",
            moistureRole: "reinforcement",
          }),
        ],
      }),
    });
    expect(row.positiveFunctions).toEqual([]);
    expect(row.cautionFunctions).toContain("F8_CLIMATE_REINFORCEMENT");
    expect(row.state).toBe("CAUTION");
  });

  it("9. F3 only → INACTIVE", () => {
    const [row] = derive({
      coreState: coreState({ core: "火" }),
      candidateStates: [
        candidate({
          element: "土",
          relationToCore: "generated-by-core",
          generationFromCore: "surface",
          isChild: true,
        }),
      ],
      corridors: [
        {
          kind: "outgoing-mid",
          mid: "土",
          from: "火",
          to: "金",
          firstLeg: "surface",
          secondLeg: "surface",
        },
      ],
    });
    expect(row.state).toBe("INACTIVE");
    expect(row.positiveFunctions).toEqual([]);
  });

  it("10. F4 only → INACTIVE", () => {
    const [row] = derive({
      coreState: coreState({ core: "火" }),
      candidateStates: [
        candidate({
          element: "水",
          relationToCore: "controls-core",
          presence: "hidden-only" as ElementPresenceKind,
          isController: true,
        }),
      ],
    });
    expect(row.state).toBe("INACTIVE");
    expect(row.positiveFunctions).toEqual([]);
  });

  it("11. F5 only → INACTIVE", () => {
    const [row] = derive({
      coreState: coreState({ core: "火" }),
      candidateStates: [
        candidate({ element: "金", relationToCore: "controlled-by-core" }),
      ],
    });
    expect(row.state).toBe("INACTIVE");
    expect(row.positiveFunctions).toEqual([]);
  });
});
