import type { CoreLinkBand } from "@/lib/saju/final/coreGenerationLinkBand";
import { describe, expect, it } from "vitest";
import {
  buildAnnualWinnerResolverInput,
  buildOpenGoals,
  buildOpenImbalances,
} from "@/lib/saju/luck/annual/buildAnnualWinnerResolverInput";
import type { AnnualCandidatePolicy } from "@/lib/saju/luck/annual/deriveAnnualCandidatePolicyStates";
import { resolveAnnualSupplementWinnerV2 } from "@/lib/saju/luck/annual/resolveAnnualSupplementWinnerV2";
import type { CoreScopedCorridor } from "@/lib/saju/final/buildCoreScopedCorridors";
import {
  coreParentElement,
} from "@/lib/saju/final/buildCoreElementState";
import type {
  AnnualElementSafetyInput,
  AnnualGoalSatisfactionInput,
  AnnualUnresolvedImbalanceInput,
} from "@/lib/saju/luck/annual/types";
import type { Element } from "@/lib/saju/types";
import { ELEMENTS } from "@/lib/saju/types";

function inactivePolicy(element: Element): AnnualCandidatePolicy {
  return {
    element,
    state: "INACTIVE",
    positiveFunctions: [],
    cautionFunctions: [],
    traceFunctions: [],
    reasons: [],
  };
}

function policiesWith(
  overrides: Partial<Record<Element, Partial<AnnualCandidatePolicy>>>,
): AnnualCandidatePolicy[] {
  return ELEMENTS.map((element) => {
    const base = inactivePolicy(element);
    const over = overrides[element];
    if (!over) return base;
    return {
      ...base,
      ...over,
      element,
      positiveFunctions: over.positiveFunctions ?? base.positiveFunctions,
      cautionFunctions: over.cautionFunctions ?? base.cautionFunctions,
      traceFunctions: over.traceFunctions ?? base.traceFunctions,
      state: over.state ?? base.state,
      reasons: over.reasons ?? base.reasons,
    };
  });
}

function incomingCorridor(
  core: Element,
  legs: { first: CoreLinkBand; second: CoreLinkBand },
): CoreScopedCorridor {
  const mid = coreParentElement(core);
  const from = coreParentElement(mid);
  return {
    kind: "incoming-mid",
    mid,
    from,
    to: core,
    firstLeg: legs.first,
    secondLeg: legs.second,
  };
}

function allUnknownSafety(): AnnualElementSafetyInput[] {
  return ELEMENTS.map((element) => ({ element, safety: "unknown" as const }));
}

function safetyRows(
  map: Partial<Record<Element, AnnualElementSafetyInput["safety"]>>,
): AnnualElementSafetyInput[] {
  return ELEMENTS.map((element) => ({
    element,
    safety: map[element] ?? "unknown",
  }));
}

describe("buildOpenGoals / buildOpenImbalances", () => {
  it("met excluded; partial/not-met/unknown open; F1/F2 already one CORE_SUPPORT", () => {
    const goals: AnnualGoalSatisfactionInput[] = [
      { goal: "CORE_SUPPORT", status: "partially-met" },
      { goal: "CORE_SUPPORT", status: "not-met" },
      { goal: "INCOMING_MEDIATION", status: "met" },
      { goal: "CLIMATE_MITIGATION", status: "unknown" },
    ];
    expect(buildOpenGoals(goals)).toEqual([
      "CORE_SUPPORT",
      "CLIMATE_MITIGATION",
    ]);
  });

  it("maps climate reinforcement risk to NEW_CLIMATE_IMBALANCE", () => {
    const rows: AnnualUnresolvedImbalanceInput[] = [
      { kind: "RESIDUAL_INCOMING_MEDIATION" },
      { kind: "CLIMATE_REINFORCEMENT_RISK" },
      { kind: "NEW_CLIMATE_IMBALANCE" },
    ];
    expect(buildOpenImbalances(rows)).toEqual([
      "RESIDUAL_INCOMING_MEDIATION",
      "NEW_CLIMATE_IMBALANCE",
    ]);
  });
});

describe("buildAnnualWinnerResolverInput — STRUCTURAL_MEDIATION", () => {
  it("surface+surface incoming mid gets INCOMING_MEDIATION structural; climate not attached", () => {
    const core: Element = "土";
    const mid = coreParentElement(core); // 火
    const built = buildAnnualWinnerResolverInput({
      year: 2026,
      natalCoreElement: core,
      goalSatisfactions: [
        { goal: "INCOMING_MEDIATION", status: "not-met" },
        { goal: "CLIMATE_MITIGATION", status: "not-met" },
      ],
      unresolvedImbalances: [
        { kind: "RESIDUAL_INCOMING_MEDIATION" },
        { kind: "NEW_CLIMATE_IMBALANCE" },
      ],
      policies: policiesWith({}),
      corridors: [incomingCorridor(core, { first: "surface", second: "surface" })],
      safeties: safetyRows({ [mid]: "clean" }),
    });

    const row = built.candidates.find((c) => c.element === mid)!;
    expect(row.residualGoalsAddressed).toEqual(["INCOMING_MEDIATION"]);
    expect(row.evidenceQuality).toBe("structural-mediation");
    expect(row.state).toBe("ACTIVE");
    expect(row.residualGoalsAddressed).not.toContain("CLIMATE_MITIGATION");
  });

  it("hidden leg does not grant STRUCTURAL_MEDIATION", () => {
    const core: Element = "金";
    const mid = coreParentElement(core);
    const built = buildAnnualWinnerResolverInput({
      year: 2026,
      natalCoreElement: core,
      goalSatisfactions: [{ goal: "INCOMING_MEDIATION", status: "not-met" }],
      unresolvedImbalances: [{ kind: "RESIDUAL_INCOMING_MEDIATION" }],
      policies: policiesWith({}),
      corridors: [incomingCorridor(core, { first: "surface", second: "hidden-context" })],
      safeties: safetyRows({ [mid]: "clean" }),
    });
    const row = built.candidates.find((c) => c.element === mid)!;
    expect(row.residualGoalsAddressed).not.toContain("INCOMING_MEDIATION");
    expect(row.state).toBe("INACTIVE");
  });

  it("no corridor → no structural mediation", () => {
    const core: Element = "水";
    const mid = coreParentElement(core);
    const built = buildAnnualWinnerResolverInput({
      year: 2026,
      natalCoreElement: core,
      goalSatisfactions: [{ goal: "INCOMING_MEDIATION", status: "not-met" }],
      unresolvedImbalances: [{ kind: "RESIDUAL_INCOMING_MEDIATION" }],
      policies: policiesWith({}),
      corridors: [],
      safeties: safetyRows({ [mid]: "clean" }),
    });
    expect(
      built.candidates.find((c) => c.element === mid)!.residualGoalsAddressed,
    ).toEqual([]);
  });

  it("climate-only open → no STRUCTURAL_MEDIATION on mid", () => {
    const core: Element = "木";
    const mid = coreParentElement(core);
    const built = buildAnnualWinnerResolverInput({
      year: 2026,
      natalCoreElement: core,
      goalSatisfactions: [{ goal: "CLIMATE_MITIGATION", status: "not-met" }],
      unresolvedImbalances: [{ kind: "RESIDUAL_CLIMATE_MITIGATION" }],
      policies: policiesWith({}),
      corridors: [incomingCorridor(core, { first: "surface", second: "surface" })],
      safeties: safetyRows({ [mid]: "clean" }),
    });
    const row = built.candidates.find((c) => c.element === mid)!;
    expect(row.residualGoalsAddressed).not.toContain("INCOMING_MEDIATION");
    expect(row.residualGoalsAddressed).not.toContain("CLIMATE_MITIGATION");
  });

  it("protected harm blocks STRUCTURAL_MEDIATION", () => {
    const core: Element = "火";
    const mid = coreParentElement(core);
    const built = buildAnnualWinnerResolverInput({
      year: 2026,
      natalCoreElement: core,
      goalSatisfactions: [{ goal: "INCOMING_MEDIATION", status: "not-met" }],
      unresolvedImbalances: [{ kind: "RESIDUAL_INCOMING_MEDIATION" }],
      policies: policiesWith({}),
      corridors: [incomingCorridor(core, { first: "surface", second: "surface" })],
      safeties: safetyRows({ [mid]: "clean" }),
      protectedHarmElements: [mid],
    });
    expect(
      built.candidates.find((c) => c.element === mid)!.residualGoalsAddressed,
    ).not.toContain("INCOMING_MEDIATION");
  });

  it("natal Supplement ≠ mid still allows structural when corridor matches mid", () => {
    const core: Element = "火";
    const mid = coreParentElement(core); // 木
    const natalSupplement: Element = "土";
    expect(natalSupplement).not.toBe(mid);
    const built = buildAnnualWinnerResolverInput({
      year: 2026,
      natalCoreElement: core,
      goalSatisfactions: [{ goal: "INCOMING_MEDIATION", status: "not-met" }],
      unresolvedImbalances: [{ kind: "RESIDUAL_INCOMING_MEDIATION" }],
      policies: policiesWith({}),
      corridors: [incomingCorridor(core, { first: "surface", second: "surface" })],
      safeties: safetyRows({ [mid]: "clean", [natalSupplement]: "clean" }),
    });
    expect(
      built.candidates.find((c) => c.element === mid)!.state,
    ).toBe("ACTIVE");
    expect(
      built.candidates.find((c) => c.element === natalSupplement)!
        .residualGoalsAddressed,
    ).not.toContain("INCOMING_MEDIATION");
  });
});

describe("buildAnnualWinnerResolverInput — safety / residuals", () => {
  it("does not upgrade conflicting safety to clean ACTIVE", () => {
    const built = buildAnnualWinnerResolverInput({
      year: 2026,
      natalCoreElement: "火",
      goalSatisfactions: [{ goal: "CLIMATE_MITIGATION", status: "not-met" }],
      unresolvedImbalances: [{ kind: "NEW_CLIMATE_IMBALANCE" }],
      policies: policiesWith({
        水: {
          state: "ACTIVE",
          positiveFunctions: ["A4_CLIMATE_MITIGATION"],
        },
      }),
      corridors: [],
      safeties: safetyRows({ 水: "conflicting" }),
    });
    const water = built.candidates.find((c) => c.element === "水")!;
    expect(water.safety).toBe("conflicting");
    expect(water.state).toBe("CAUTION");
    expect(water.residualGoalsAddressed).toEqual(["CLIMATE_MITIGATION"]);
  });

  it("met residual excluded from openGoals and candidate coverage", () => {
    const core: Element = "火";
    const mid = coreParentElement(core);
    const built = buildAnnualWinnerResolverInput({
      year: 2026,
      natalCoreElement: core,
      goalSatisfactions: [
        { goal: "INCOMING_MEDIATION", status: "met" },
        { goal: "CORE_SUPPORT", status: "met" },
      ],
      unresolvedImbalances: [],
      policies: policiesWith({}),
      corridors: [incomingCorridor(core, { first: "surface", second: "surface" })],
      safeties: safetyRows({ [mid]: "clean" }),
    });
    expect(built.openGoals).toEqual([]);
    expect(
      built.candidates.find((c) => c.element === mid)!.residualGoalsAddressed,
    ).toEqual([]);
  });

  it("partially-met structural residual stays open", () => {
    expect(
      buildOpenGoals([{ goal: "CORE_SUPPORT", status: "partially-met" }]),
    ).toEqual(["CORE_SUPPORT"]);
  });

  it("Core cycle: only incoming mid gets structural; parent auto alone is not enough without corridor", () => {
    for (const core of ELEMENTS) {
      const mid = coreParentElement(core);
      const withCorridor = buildAnnualWinnerResolverInput({
        year: 2026,
        natalCoreElement: core,
        goalSatisfactions: [{ goal: "INCOMING_MEDIATION", status: "not-met" }],
        unresolvedImbalances: [{ kind: "RESIDUAL_INCOMING_MEDIATION" }],
        policies: policiesWith({}),
        corridors: [
          incomingCorridor(core, { first: "surface", second: "surface" }),
        ],
        safeties: safetyRows(
          Object.fromEntries(ELEMENTS.map((e) => [e, "clean"])) as Partial<
            Record<Element, "clean">
          >,
        ),
      });
      const structural = withCorridor.candidates.filter((c) =>
        c.residualGoalsAddressed.includes("INCOMING_MEDIATION"),
      );
      expect(structural.map((c) => c.element)).toEqual([mid]);

      const noCorridor = buildAnnualWinnerResolverInput({
        year: 2026,
        natalCoreElement: core,
        goalSatisfactions: [{ goal: "INCOMING_MEDIATION", status: "not-met" }],
        unresolvedImbalances: [{ kind: "RESIDUAL_INCOMING_MEDIATION" }],
        policies: policiesWith({}),
        corridors: [],
        safeties: allUnknownSafety().map((row) =>
          row.element === mid ? { ...row, safety: "clean" } : row,
        ),
      });
      expect(
        noCorridor.candidates.every(
          (c) => !c.residualGoalsAddressed.includes("INCOMING_MEDIATION"),
        ),
      ).toBe(true);
    }
  });
});

describe("buildAnnualWinnerResolverInput — 2026 structure + winner integration", () => {
  it("structural ACTIVE + climate CAUTION → winner V2 partial (generic labels)", () => {
    const core: Element = "火";
    const structuralMid = coreParentElement(core); // 木 for 火 — derived, not hardcoded rule
    const climateEl: Element = "水";

    const built = buildAnnualWinnerResolverInput({
      year: 2026,
      natalCoreElement: core,
      goalSatisfactions: [
        { goal: "CORE_SUPPORT", status: "partially-met" },
        { goal: "INCOMING_MEDIATION", status: "not-met" },
        { goal: "CLIMATE_MITIGATION", status: "not-met" },
      ],
      unresolvedImbalances: [
        { kind: "RESIDUAL_CORE_SUPPORT" },
        { kind: "RESIDUAL_INCOMING_MEDIATION" },
        { kind: "CLIMATE_REINFORCEMENT_RISK" },
      ],
      policies: policiesWith({
        [climateEl]: {
          state: "ACTIVE",
          positiveFunctions: ["A4_CLIMATE_MITIGATION"],
        },
      }),
      corridors: [
        incomingCorridor(core, { first: "surface", second: "surface" }),
      ],
      safeties: safetyRows({
        [structuralMid]: "clean",
        [climateEl]: "conflicting",
        火: "conditional",
      }),
    });

    expect(built.openGoals).toEqual([
      "CORE_SUPPORT",
      "INCOMING_MEDIATION",
      "CLIMATE_MITIGATION",
    ]);
    expect(built.openImbalances).toEqual([
      "RESIDUAL_CORE_SUPPORT",
      "RESIDUAL_INCOMING_MEDIATION",
      "NEW_CLIMATE_IMBALANCE",
    ]);

    const midRow = built.candidates.find((c) => c.element === structuralMid)!;
    expect(midRow.state).toBe("ACTIVE");
    expect(midRow.safety).toBe("clean");
    expect(midRow.residualGoalsAddressed).toEqual(
      expect.arrayContaining(["INCOMING_MEDIATION", "CORE_SUPPORT"]),
    );
    expect(midRow.residualGoalsAddressed).not.toContain("CLIMATE_MITIGATION");

    const climateRow = built.candidates.find((c) => c.element === climateEl)!;
    expect(climateRow.state).toBe("CAUTION");
    expect(climateRow.safety).toBe("conflicting");
    expect(climateRow.residualGoalsAddressed).toEqual(["CLIMATE_MITIGATION"]);

    const resolution = resolveAnnualSupplementWinnerV2({
      year: 2026,
      candidates: built.candidates,
      openGoals: built.openGoals,
      openImbalances: built.openImbalances,
    });

    expect(resolution.annualSupplementElement).toBe(structuralMid);
    expect(resolution.status).toBe("partial");
    expect(resolution.unresolvedGoals).toContain("CLIMATE_MITIGATION");
    expect(resolution.unresolvedImbalances).toContain("NEW_CLIMATE_IMBALANCE");
  });
});
