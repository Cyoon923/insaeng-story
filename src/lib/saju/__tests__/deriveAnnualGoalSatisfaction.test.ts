import { describe, expect, it } from "vitest";
import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { buildCoreElementState } from "@/lib/saju/final/buildCoreElementState";
import {
  buildCoreScopedCorridors,
  type CoreScopedCorridor,
} from "@/lib/saju/final/buildCoreScopedCorridors";
import { coreParentElement } from "@/lib/saju/final/buildCoreElementState";
import { buildAnnualLuckEvidence } from "@/lib/saju/luck/annual/buildAnnualLuckEvidence";
import { buildAnnualTarget } from "@/lib/saju/luck/annual/buildAnnualTarget";
import { deriveAnnualGoalSatisfaction } from "@/lib/saju/luck/annual/deriveAnnualGoalSatisfaction";
import { deriveAnnualImbalances } from "@/lib/saju/luck/annual/deriveAnnualImbalances";
import type {
  AnnualGoalSatisfaction,
  AnnualLuckEvidence,
  NatalDeficitGoal,
} from "@/lib/saju/luck/annual/types";
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

function evidenceFor(input: {
  year?: number;
  core: Element;
  supplement: Element | null;
  stemElement?: Element;
  branchElement?: Element;
}): AnnualLuckEvidence {
  const target = buildAnnualTarget(input.year ?? 2026);
  const custom = {
    ...target,
    stemElement: input.stemElement ?? target.stemElement,
    branchMainElement: input.branchElement ?? target.branchMainElement,
  };
  return buildAnnualLuckEvidence({
    target: custom,
    natalCoreElement: input.core,
    natalSupplementElement: input.supplement,
  });
}

function byGoal(rows: AnnualGoalSatisfaction[]) {
  return Object.fromEntries(rows.map((row) => [row.goal, row]));
}

function deficitGoal(input: {
  kind: NatalDeficitGoal["kind"];
  methods: NatalDeficitGoal["methods"];
  targetElement?: Element;
  sourceElement?: Element;
  sourceFunctions?: NatalDeficitGoal["sourceFunctions"];
}): NatalDeficitGoal {
  const sourceFunctions =
    input.sourceFunctions ??
    (input.methods.includes("generative")
      ? (["F2_GENERATIVE"] as const)
      : input.methods.includes("direct")
        ? (["F1_DIRECT"] as const)
        : input.methods.includes("corridor-mid")
          ? (["F6_INCOMING_MEDIATION"] as const)
          : input.methods.includes("climate-fire-water")
            ? (["F7_CLIMATE_MITIGATION"] as const)
            : []);
  return {
    kind: input.kind,
    targetElement: input.targetElement ?? "火",
    sourceElement: input.sourceElement ?? "木",
    sourceFunctions: [...sourceFunctions],
    methods: input.methods,
    reasons: [],
  };
}

describe("deriveAnnualGoalSatisfaction — CORE_SUPPORT", () => {
  const goal = deficitGoal({
    kind: "CORE_SUPPORT",
    methods: ["generative"],
  });

  it("same-to-Core stem-only → partially-met", () => {
    const rows = deriveAnnualGoalSatisfaction({
      goals: [goal],
      evidence: evidenceFor({
        core: "火",
        supplement: null,
        stemElement: "火",
        branchElement: "土", // generated-by Core — not CORE_SUPPORT substitute
      }),
      natalCoreState: { core: "火", presence: "absent" },
      natalClimate: emptyClimate(),
    });
    expect(byGoal(rows).CORE_SUPPORT).toMatchObject({
      status: "partially-met",
      signalCoherence: "stem-only",
      satisfyingMethods: ["same-to-core"],
    });
  });

  it("same-to-Core branch-only → partially-met", () => {
    const rows = deriveAnnualGoalSatisfaction({
      goals: [goal],
      evidence: evidenceFor({
        core: "火",
        supplement: null,
        stemElement: "土",
        branchElement: "火",
      }),
      natalCoreState: { core: "火", presence: "absent" },
      natalClimate: emptyClimate(),
    });
    expect(byGoal(rows).CORE_SUPPORT).toMatchObject({
      status: "partially-met",
      signalCoherence: "branch-main-only",
    });
  });

  it("coherent same-to-Core + generative natal + rooted-visible → partially-met (never met)", () => {
    const rows = deriveAnnualGoalSatisfaction({
      goals: [goal],
      evidence: evidenceFor({
        core: "火",
        supplement: "木",
        stemElement: "火",
        branchElement: "火",
      }),
      natalCoreState: { core: "火", presence: "rooted-visible" },
      natalClimate: emptyClimate(),
    });
    expect(byGoal(rows).CORE_SUPPORT).toMatchObject({
      status: "partially-met",
      signalCoherence: "coherent",
      satisfyingMethods: ["same-to-core"],
    });
  });

  it("generates-Core coherent → met", () => {
    const rows = deriveAnnualGoalSatisfaction({
      goals: [deficitGoal({ kind: "CORE_SUPPORT", methods: ["direct"] })],
      evidence: evidenceFor({
        core: "火",
        supplement: null,
        stemElement: "木",
        branchElement: "木",
      }),
      natalCoreState: { core: "火", presence: "absent" },
      natalClimate: emptyClimate(),
    });
    expect(byGoal(rows).CORE_SUPPORT).toMatchObject({
      status: "met",
      signalCoherence: "coherent",
      satisfyingMethods: ["generates-core"],
    });
  });
});

describe("deriveAnnualGoalSatisfaction — INCOMING_MEDIATION", () => {
  const goal = deficitGoal({
    kind: "INCOMING_MEDIATION",
    methods: ["corridor-mid"],
  });

  it("theoretical / same-to-Core only → not-met", () => {
    const rows = deriveAnnualGoalSatisfaction({
      goals: [goal],
      evidence: evidenceFor({
        core: "火",
        supplement: "木",
        stemElement: "火",
        branchElement: "火",
      }),
      natalCoreState: { core: "火", presence: "rooted-visible" },
      natalClimate: emptyClimate(),
      corridors: [],
    });
    expect(byGoal(rows).INCOMING_MEDIATION.status).toBe("not-met");
  });

  it("actual surface+surface annual-mid → met when coherent", () => {
    const core: Element = "火";
    const mid = coreParentElement(core);
    const corridor: CoreScopedCorridor = {
      kind: "incoming-mid",
      mid,
      from: coreParentElement(mid),
      to: core,
      firstLeg: "surface",
      secondLeg: "surface",
    };
    const rows = deriveAnnualGoalSatisfaction({
      goals: [goal],
      evidence: evidenceFor({
        core,
        supplement: mid,
        stemElement: mid,
        branchElement: mid,
      }),
      natalCoreState: { core, presence: "rooted-visible" },
      natalClimate: emptyClimate(),
      corridors: [corridor],
    });
    expect(byGoal(rows).INCOMING_MEDIATION).toMatchObject({
      status: "met",
      satisfyingMethods: ["corridor-mid"],
      signalCoherence: "coherent",
    });
  });
});

describe("deriveAnnualGoalSatisfaction — CLIMATE_MITIGATION", () => {
  const goal = deficitGoal({
    kind: "CLIMATE_MITIGATION",
    methods: ["climate-fire-water"],
    targetElement: "水",
    sourceElement: "水",
  });

  it("usable warm/dry + water signal → met when coherent", () => {
    const climate = emptyClimate({
      temperature: { status: "resolved", value: "warm", outcome: "unchanged" },
      moisture: { status: "resolved", value: "dry", outcome: "unchanged" },
    });
    const rows = deriveAnnualGoalSatisfaction({
      goals: [goal],
      evidence: evidenceFor({
        core: "土",
        supplement: null,
        stemElement: "水",
        branchElement: "水",
      }),
      natalCoreState: { core: "土", presence: "absent" },
      natalClimate: climate,
    });
    expect(byGoal(rows).CLIMATE_MITIGATION.status).toBe("met");
  });

  it("climate conflict outcome → unknown", () => {
    const climate = emptyClimate({
      temperature: {
        status: "resolved",
        value: "warm",
        outcome: "mitigation-reinforcement-conflict",
      },
      moisture: { status: "resolved", value: "dry", outcome: "unchanged" },
    });
    const rows = deriveAnnualGoalSatisfaction({
      goals: [goal],
      evidence: evidenceFor({
        core: "土",
        supplement: null,
        stemElement: "水",
        branchElement: "水",
      }),
      natalCoreState: { core: "土", presence: "absent" },
      natalClimate: climate,
    });
    expect(byGoal(rows).CLIMATE_MITIGATION.status).toBe("unknown");
  });
});

describe("deriveAnnualImbalances", () => {
  it("goal met → residual removed", () => {
    const satisfaction: AnnualGoalSatisfaction[] = [
      {
        goal: "CORE_SUPPORT",
        status: "met",
        satisfyingMethods: ["generates-core"],
        signalCoherence: "coherent",
        reasons: [],
      },
    ];
    const imbalances = deriveAnnualImbalances({
      goalSatisfaction: satisfaction,
      evidence: evidenceFor({
        core: "火",
        supplement: null,
        stemElement: "木",
        branchElement: "木",
      }),
      natalCoreState: { core: "火", presence: "absent" },
      natalClimate: emptyClimate(),
      natalSupplementElement: null,
    });
    expect(
      imbalances.find((row) => row.kind === "RESIDUAL_CORE_SUPPORT"),
    ).toBeUndefined();
  });

  it("goal unknown → UNKNOWN imbalance", () => {
    const imbalances = deriveAnnualImbalances({
      goalSatisfaction: [
        {
          goal: "CLIMATE_MITIGATION",
          status: "unknown",
          satisfyingMethods: [],
          signalCoherence: "none",
          reasons: ["x"],
        },
      ],
      evidence: evidenceFor({
        core: "土",
        supplement: null,
        stemElement: "木",
        branchElement: "木",
      }),
      natalCoreState: { core: "土", presence: "absent" },
      natalClimate: emptyClimate(),
      natalSupplementElement: null,
    });
    expect(imbalances.some((row) => row.kind === "UNKNOWN")).toBe(true);
  });

  it("supplement drain relation present vs absent", () => {
    const withDrain = deriveAnnualImbalances({
      goalSatisfaction: [],
      evidence: evidenceFor({
        core: "火",
        supplement: "木",
        stemElement: "火",
        branchElement: "火",
      }),
      natalCoreState: { core: "火", presence: "rooted-visible" },
      natalClimate: emptyClimate(),
      natalSupplementElement: "木",
    });
    expect(
      withDrain.some((row) => row.kind === "SUPPLEMENT_DRAIN_SHIFT"),
    ).toBe(true);

    // 火 vs natal 水 → controlled-by (not generated-by / controls) → no drain
    const noDrain = deriveAnnualImbalances({
      goalSatisfaction: [],
      evidence: evidenceFor({
        core: "火",
        supplement: "水",
        stemElement: "火",
        branchElement: "火",
      }),
      natalCoreState: { core: "火", presence: "rooted-visible" },
      natalClimate: emptyClimate(),
      natalSupplementElement: "水",
    });
    expect(
      noDrain.some((row) => row.kind === "SUPPLEMENT_DRAIN_SHIFT"),
    ).toBe(false);
  });

  it("CORE_REINFORCEMENT_RISK requires rooted-visible + same + support met/partial", () => {
    const supportPartial: AnnualGoalSatisfaction = {
      goal: "CORE_SUPPORT",
      status: "partially-met",
      satisfyingMethods: ["same-to-core"],
      signalCoherence: "coherent",
      reasons: [],
    };
    const yes = deriveAnnualImbalances({
      goalSatisfaction: [supportPartial],
      evidence: evidenceFor({
        core: "火",
        supplement: null,
        stemElement: "火",
        branchElement: "火",
      }),
      natalCoreState: { core: "火", presence: "rooted-visible" },
      natalClimate: emptyClimate(),
      natalSupplementElement: null,
    });
    expect(yes.some((row) => row.kind === "CORE_REINFORCEMENT_RISK")).toBe(true);

    const no = deriveAnnualImbalances({
      goalSatisfaction: [supportPartial],
      evidence: evidenceFor({
        core: "火",
        supplement: null,
        stemElement: "火",
        branchElement: "火",
      }),
      natalCoreState: { core: "火", presence: "absent" },
      natalClimate: emptyClimate(),
      natalSupplementElement: null,
    });
    expect(no.some((row) => row.kind === "CORE_REINFORCEMENT_RISK")).toBe(false);
  });
});

describe("2026 representative 辛酉/乙未/丙申/戊戌", () => {
  it("CORE_SUPPORT partial, INCOMING not-met, expected imbalances", () => {
    const evidenceStrength = collectStrengthEvidence(REP_PILLARS);
    const observations = buildStrengthObservations(REP_PILLARS, evidenceStrength);
    const climate = buildAdjustedClimateSummary(REP_PILLARS);
    const coreState = buildCoreElementState({
      pillars: REP_PILLARS,
      core: "火",
      observations,
    });
    const corridors = buildCoreScopedCorridors({
      core: "火",
      observations,
    });
    const evidence = buildAnnualLuckEvidence({
      target: buildAnnualTarget(2026),
      natalCoreElement: "火",
      natalSupplementElement: "木",
    });

    expect(climate.temperature).toMatchObject({
      status: "resolved",
      value: "warm",
    });
    expect(climate.moisture).toMatchObject({
      status: "resolved",
      value: "dry",
    });
    expect(coreState.presence).toBe("rooted-visible");

    const goals: NatalDeficitGoal[] = [
      deficitGoal({ kind: "CORE_SUPPORT", methods: ["generative"] }),
      deficitGoal({ kind: "INCOMING_MEDIATION", methods: ["corridor-mid"] }),
    ];

    const satisfaction = deriveAnnualGoalSatisfaction({
      goals,
      evidence,
      natalCoreState: coreState,
      natalClimate: climate,
      corridors,
    });
    const map = byGoal(satisfaction);

    expect(map.CORE_SUPPORT.status).toBe("partially-met");
    expect(map.CORE_SUPPORT.signalCoherence).toBe("coherent");
    expect(map.INCOMING_MEDIATION.status).toBe("not-met");

    const imbalances = deriveAnnualImbalances({
      goalSatisfaction: satisfaction,
      evidence,
      natalCoreState: coreState,
      natalClimate: climate,
      natalSupplementElement: "木",
    });
    const kinds = imbalances.map((row) => row.kind);

    expect(kinds).toEqual(
      expect.arrayContaining([
        "RESIDUAL_CORE_SUPPORT",
        "RESIDUAL_INCOMING_MEDIATION",
        "CLIMATE_REINFORCEMENT_RISK",
        "SUPPLEMENT_DRAIN_SHIFT",
      ]),
    );

    // same-to-Core alone is insufficient; with rooted-visible + partial it may appear.
    // Assert it is never emitted without the frozen triad of conditions (covered above).
    if (kinds.includes("CORE_REINFORCEMENT_RISK")) {
      expect(coreState.presence).toBe("rooted-visible");
      expect(map.CORE_SUPPORT.status).toMatch(/met/);
    }
  });
});
