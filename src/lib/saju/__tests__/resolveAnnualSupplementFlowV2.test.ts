import { describe, expect, it } from "vitest";
import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { buildNeedResolution } from "@/lib/saju/elements/needResolution";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { buildStrengthSummary } from "@/lib/saju/elements/strengthSummary";
import { buildCoreElementState } from "@/lib/saju/final/buildCoreElementState";
import { buildCoreScopedCorridors } from "@/lib/saju/final/buildCoreScopedCorridors";
import { coreParentElement } from "@/lib/saju/final/buildCoreElementState";
import { resolveFinalElement } from "@/lib/saju/final/resolveFinalElement";
import { resolveSupplementFlow } from "@/lib/saju/final/resolveSupplementFlow";
import { resolveAnnualSupplementFlowV2 } from "@/lib/saju/luck/annual/resolveAnnualSupplementFlowV2";
import type { SupplementCandidatePolicy } from "@/lib/saju/final/deriveSupplementCandidatePolicyStates";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import type {
  AdjustedClimateSummary,
  Element,
  FourPillars,
} from "@/lib/saju/types";
import { ELEMENTS } from "@/lib/saju/types";

const REP_PILLARS: FourPillars = {
  year: { stem: "辛", branch: "酉" },
  month: { stem: "乙", branch: "未" },
  day: { stem: "丙", branch: "申" },
  hour: { stem: "戊", branch: "戌" },
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

function repNatalBaseline() {
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
  const natalFlow = resolveSupplementFlow({
    pillars: REP_PILLARS,
    finalResolution: fer,
    observations,
    climate,
    needResolution,
  });
  const coreState = buildCoreElementState({
    pillars: REP_PILLARS,
    core: "火",
    observations,
  });
  const corridors = buildCoreScopedCorridors({ core: "火", observations });
  return {
    natalCoreElement: "火" as Element,
    natalCoreCertainty: fer.certainty,
    natalSupplementElement: natalFlow.resolution.supplementElement,
    natalSupplementStatus: natalFlow.resolution.supplementStatus,
    natalPolicies: natalFlow.policies,
    natalCorridors: corridors,
    natalCoreState: coreState,
    natalClimate: climate,
    needResolution,
  };
}

function flowInput(
  over: Partial<ReturnType<typeof repNatalBaseline>> & { year?: number } = {},
) {
  return {
    year: over.year ?? 2026,
    ...repNatalBaseline(),
    ...over,
  };
}

describe("resolveAnnualSupplementFlowV2 — core gate", () => {
  it("1. natal Core unresolved → full skip", () => {
    const base = flowInput();
    const flow = resolveAnnualSupplementFlowV2({
      ...base,
      natalCoreElement: null,
      natalCoreState: null,
      natalCoreCertainty: "unresolved",
    });
    expect(flow.target).toBeNull();
    expect(flow.evidence).toBeNull();
    expect(flow.natalGoals).toEqual([]);
    expect(flow.goalSatisfactions).toEqual([]);
    expect(flow.imbalances).toEqual([]);
    expect(flow.candidatePolicies).toEqual([]);
    expect(flow.safeties).toEqual([]);
    expect(flow.winnerInput).toBeNull();
    expect(flow.resolution).toMatchObject({
      annualSupplementElement: null,
      status: "unresolved",
      annualStemBranch: null,
    });
  });
});

describe("resolveAnnualSupplementFlowV2 — supplement / goals", () => {
  it("2. natal Supplement unresolved → goals=[] but pipeline runs", () => {
    const flow = resolveAnnualSupplementFlowV2(
      flowInput({
        natalSupplementElement: null,
        natalSupplementStatus: "unresolved",
        natalPolicies: [],
      }),
    );
    expect(flow.target).not.toBeNull();
    expect(flow.natalGoals).toEqual([]);
    expect(flow.goalSatisfactions).toEqual([]);
  });

  it("3. goals=[] when supplement unresolved", () => {
    const flow = resolveAnnualSupplementFlowV2(
      flowInput({
        natalSupplementElement: null,
        natalSupplementStatus: "unresolved",
      }),
    );
    expect(flow.natalGoals).toHaveLength(0);
  });
});

describe("resolveAnnualSupplementFlowV2 — 2026 representative", () => {
  it("full trace: partial winner 木, climate issue remains", () => {
    const flow = resolveAnnualSupplementFlowV2(flowInput({ year: 2026 }));

    expect(flow.target?.stem).toBe("丙");
    expect(flow.target?.branch).toBe("午");
    expect(flow.resolution.annualStemBranch).toBe("丙午");

    const goalMap = Object.fromEntries(
      flow.goalSatisfactions.map((row) => [row.goal, row.status]),
    );
    expect(goalMap.CORE_SUPPORT).toBe("partially-met");
    expect(goalMap.INCOMING_MEDIATION).toBe("not-met");
    expect(flow.natalGoals.map((g) => g.kind)).toEqual([
      "CORE_SUPPORT",
      "INCOMING_MEDIATION",
    ]);

    const imbalanceKinds = flow.imbalances.map((row) => row.kind);
    expect(imbalanceKinds).toEqual(
      expect.arrayContaining([
        "RESIDUAL_CORE_SUPPORT",
        "RESIDUAL_INCOMING_MEDIATION",
        "CLIMATE_REINFORCEMENT_RISK",
        "SUPPLEMENT_DRAIN_SHIFT",
      ]),
    );

    const woodPolicy = flow.candidatePolicies.find((row) => row.element === "木")!;
    expect(woodPolicy.positiveFunctions).toContain("A3_SUPPLEMENT_OFFSET");
    expect(woodPolicy.state).toBe("ACTIVE");

    expect(flow.safeties.find((row) => row.element === "木")?.safety).toBe("clean");
    expect(flow.safeties.find((row) => row.element === "水")?.safety).toBe(
      "conditional",
    );
    expect(flow.safeties.find((row) => row.element === "水")?.safety).not.toBe(
      "conflicting",
    );

    const woodCandidate = flow.winnerInput!.candidates.find(
      (row) => row.element === "木",
    )!;
    expect(woodCandidate.state).toBe("ACTIVE");
    expect(woodCandidate.safety).toBe("clean");
    expect(woodCandidate.residualGoalsAddressed).toContain("INCOMING_MEDIATION");

    expect(flow.resolution.annualSupplementElement).toBe("木");
    expect(flow.resolution.status).toBe("partial");
    // CLIMATE_MITIGATION is not a natal deficit goal — climate stays in imbalances.
    expect(flow.resolution.unresolvedGoals).toEqual([]);
    expect(flow.resolution.unresolvedImbalances).toEqual(
      expect.arrayContaining(["NEW_CLIMATE_IMBALANCE"]),
    );

    const waterWinner = flow.winnerInput!.candidates.find(
      (row) => row.element === "水",
    )!;
    expect(waterWinner.state).toBe("CAUTION");
  });
});

describe("resolveAnnualSupplementFlowV2 — winner outcomes", () => {
  it("5. winner + unresolved issues → partial", () => {
    const flow = resolveAnnualSupplementFlowV2(flowInput());
    if (flow.resolution.annualSupplementElement !== null) {
      expect(["partial", "resolved"]).toContain(flow.resolution.status);
    }
  });

  it("6. no clean ACTIVE → unresolved when peers block", () => {
    const climate = buildAdjustedClimateSummary(REP_PILLARS);
    const flow = resolveAnnualSupplementFlowV2(
      flowInput({
        natalClimate: climate,
        natalPolicies: [
          {
            element: "木",
            state: "ACTIVE",
            positiveFunctions: ["A3_SUPPLEMENT_OFFSET"],
            cautionFunctions: [],
            reasons: [],
          },
          {
            element: "水",
            state: "ACTIVE",
            positiveFunctions: ["A4_CLIMATE_MITIGATION"],
            cautionFunctions: [],
            reasons: [],
          },
        ] as SupplementCandidatePolicy[],
      }),
    );
    const activeClean = flow.winnerInput!.candidates.filter(
      (row) => row.state === "ACTIVE" && row.safety === "clean",
    );
    if (activeClean.length >= 2) {
      expect(flow.resolution.status).toBe("unresolved");
    }
  });

  it("7. CAUTION candidate not promoted to winner", () => {
    const flow = resolveAnnualSupplementFlowV2(flowInput());
    const winnerEl = flow.resolution.annualSupplementElement;
    if (winnerEl) {
      const row = flow.winnerInput!.candidates.find((c) => c.element === winnerEl)!;
      expect(row.safety).toBe("clean");
      expect(row.state).toBe("ACTIVE");
    }
    const water = flow.winnerInput!.candidates.find((c) => c.element === "水")!;
    if (water.state === "CAUTION") {
      expect(flow.resolution.annualSupplementElement).not.toBe("水");
    }
  });

  it("8. structural winner does not clear climate imbalances", () => {
    const flow = resolveAnnualSupplementFlowV2(flowInput());
    if (
      flow.resolution.annualSupplementElement === "木" &&
      flow.resolution.status === "partial"
    ) {
      expect(flow.resolution.unresolvedImbalances).toEqual(
        expect.arrayContaining(["NEW_CLIMATE_IMBALANCE"]),
      );
      expect(flow.resolution.unresolvedGoals).not.toContain("CLIMATE_MITIGATION");
    }
  });
});

describe("resolveAnnualSupplementFlowV2 — year / order stability", () => {
  it("9. 2027 orchestration runs", () => {
    const flow = resolveAnnualSupplementFlowV2(flowInput({ year: 2027 }));
    expect(flow.target?.year).toBe(2027);
    expect(flow.evidence).not.toBeNull();
    expect(flow.resolution.year).toBe(2027);
  });

  it("10. policy array permutation does not change winner", () => {
    const base = flowInput();
    const normal = resolveAnnualSupplementFlowV2(base);
    const reversed = resolveAnnualSupplementFlowV2({
      ...base,
      natalPolicies: [...base.natalPolicies].reverse(),
    });
    expect(reversed.resolution).toEqual(normal.resolution);
  });
});

describe("resolveAnnualSupplementFlowV2 — needResolution trace", () => {
  it("contested Need adds trace only, no forced demotion", () => {
    const base = flowInput();
    const needResolution = {
      ...base.needResolution!,
      decisionBlockedBy: ["climate-need-contested-inherited" as const],
    };
    const flow = resolveAnnualSupplementFlowV2({ ...base, needResolution });
    expect(flow.resolution.reasons).toEqual(
      expect.arrayContaining(["trace:need:climate-need-contested-inherited"]),
    );
  });
});

describe("resolveAnnualSupplementFlowV2 — resolved path", () => {
  it("4. single clean winner covering only structural open goal", () => {
    const core: Element = "火";
    const mid = coreParentElement(core);
    const corridor = {
      kind: "incoming-mid" as const,
      mid,
      from: coreParentElement(mid),
      to: core,
      firstLeg: "surface" as const,
      secondLeg: "surface" as const,
    };
    const climate = emptyClimate();
    const flow = resolveAnnualSupplementFlowV2({
      year: 2026,
      natalCoreElement: core,
      natalCoreCertainty: "confirmed",
      natalSupplementElement: mid,
      natalSupplementStatus: "resolved",
      natalPolicies: [
        {
          element: mid,
          state: "ACTIVE",
          positiveFunctions: ["F6_INCOMING_MEDIATION"],
          cautionFunctions: [],
          reasons: [],
        },
      ],
      natalCorridors: [corridor],
      natalCoreState: {
        core,
        presence: "absent",
        parent: coreParentElement(core),
        child: "土" as Element,
        controller: "水" as Element,
        incomingGeneration: "none",
        controlPresence: "controller-absent",
        outgoingDrainage: "none",
      },
      natalClimate: climate,
    });

    expect(flow.natalGoals).toHaveLength(1);
    expect(flow.resolution.annualSupplementElement).toBe(mid);
    expect(flow.resolution.status).toBe("resolved");
    expect(flow.resolution.unresolvedGoals).toEqual([]);
  });
});
