import { describe, expect, it } from "vitest";
import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { buildCoreElementState } from "@/lib/saju/final/buildCoreElementState";
import { buildCoreScopedCorridors } from "@/lib/saju/final/buildCoreScopedCorridors";
import { coreParentElement } from "@/lib/saju/final/buildCoreElementState";
import { buildAnnualLuckEvidence } from "@/lib/saju/luck/annual/buildAnnualLuckEvidence";
import { buildAnnualTarget } from "@/lib/saju/luck/annual/buildAnnualTarget";
import {
  deriveAnnualCandidateSafeties,
  safetiesForWinnerInput,
} from "@/lib/saju/luck/annual/deriveAnnualCandidateSafeties";
import { deriveAnnualGoalSatisfaction } from "@/lib/saju/luck/annual/deriveAnnualGoalSatisfaction";
import { deriveAnnualImbalances } from "@/lib/saju/luck/annual/deriveAnnualImbalances";
import { deriveNatalDeficitGoals } from "@/lib/saju/luck/annual/deriveNatalDeficitGoals";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import { resolveSupplementFlow } from "@/lib/saju/final/resolveSupplementFlow";
import { resolveFinalElement } from "@/lib/saju/final/resolveFinalElement";
import { buildStrengthSummary } from "@/lib/saju/elements/strengthSummary";
import { buildNeedResolution } from "@/lib/saju/elements/needResolution";
import type { CoreScopedCorridor } from "@/lib/saju/final/buildCoreScopedCorridors";
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

function evidenceFor(input: {
  core: Element;
  supplement?: Element | null;
  year?: number;
  stemElement?: Element;
  branchElement?: Element;
}) {
  const target = buildAnnualTarget(input.year ?? 2026);
  return buildAnnualLuckEvidence({
    target: {
      ...target,
      stemElement: input.stemElement ?? target.stemElement,
      branchMainElement: input.branchElement ?? target.branchMainElement,
    },
    natalCoreElement: input.core,
    natalSupplementElement: input.supplement ?? null,
  });
}

function incomingCorridor(
  core: Element,
  legs: { first: "surface" | "hidden"; second: "surface" | "hidden" },
): CoreScopedCorridor {
  const mid = coreParentElement(core);
  return {
    kind: "incoming-mid",
    mid,
    from: coreParentElement(mid),
    to: core,
    firstLeg: legs.first,
    secondLeg: legs.second,
  };
}

function byElement<T extends { element: Element }>(rows: T[]) {
  return Object.fromEntries(rows.map((row) => [row.element, row]));
}

describe("deriveAnnualCandidateSafeties — generic A–J", () => {
  it("A. clean direct remedy (same-to-core signal, no harm)", () => {
    const rows = deriveAnnualCandidateSafeties({
      openGoals: ["CORE_SUPPORT"],
      imbalances: [{ kind: "RESIDUAL_CORE_SUPPORT", origin: "residual-natal-goal", evidence: [] }],
      goalSatisfactions: [{ goal: "CORE_SUPPORT", status: "not-met" }],
      natalCoreState: { core: "火", presence: "absent" },
      natalClimate: emptyClimate(),
      evidence: evidenceFor({
        core: "火",
        stemElement: "火",
        branchElement: "土",
      }),
      corridors: [],
    });
    expect(byElement(rows)["火"].safety).toBe("clean");
    expect(byElement(rows)["火"].conflictingGoals).toEqual([]);
  });

  it("B. 剋/controls relation alone → not conflicting", () => {
    const climate = buildAdjustedClimateSummary(REP_PILLARS);
    const rows = deriveAnnualCandidateSafeties({
      openGoals: ["CORE_SUPPORT", "CLIMATE_MITIGATION"],
      imbalances: [
        { kind: "RESIDUAL_CORE_SUPPORT", origin: "residual-natal-goal", evidence: [] },
        { kind: "CLIMATE_REINFORCEMENT_RISK", origin: "new-annual", evidence: [] },
      ],
      goalSatisfactions: [{ goal: "CORE_SUPPORT", status: "partially-met" }],
      natalCoreState: { core: "火", presence: "rooted-visible" },
      natalClimate: climate,
      evidence: evidenceFor({ core: "火", supplement: "木" }),
      corridors: [incomingCorridor("火", { first: "surface", second: "surface" })],
    });
    const water = byElement(rows)["水"];
    expect(water.safety).not.toBe("conflicting");
    expect(water.conflictingGoals).not.toContain("CORE_SUPPORT");
  });

  it("C. explicit protected harm → conflicting", () => {
    const climate = buildAdjustedClimateSummary(REP_PILLARS);
    const rows = deriveAnnualCandidateSafeties({
      candidates: [{ element: "火", addressedGoals: ["CLIMATE_MITIGATION"] }],
      openGoals: ["CLIMATE_MITIGATION"],
      imbalances: [{ kind: "CLIMATE_REINFORCEMENT_RISK", origin: "new-annual", evidence: [] }],
      goalSatisfactions: [{ goal: "CLIMATE_MITIGATION", status: "not-met" }],
      natalCoreState: { core: "火", presence: "rooted-visible" },
      natalClimate: climate,
      evidence: evidenceFor({ core: "火", stemElement: "火", branchElement: "火" }),
      corridors: [],
    });
    const fire = rows[0]!;
    expect(fire.safety).toBe("conflicting");
    expect(fire.conflictingGoals).toContain("CLIMATE_MITIGATION");
  });

  it("D. no remedy evidence → unknown", () => {
    const rows = deriveAnnualCandidateSafeties({
      openGoals: ["CORE_SUPPORT"],
      imbalances: [],
      natalCoreState: { core: "火", presence: "rooted-visible" },
      natalClimate: emptyClimate(),
      evidence: evidenceFor({ core: "火", stemElement: "土", branchElement: "金" }),
      corridors: [],
    });
    expect(byElement(rows)["土"].safety).toBe("unknown");
  });

  it("E. climate positive + controller relation + partial core → conditional", () => {
    const climate = buildAdjustedClimateSummary(REP_PILLARS);
    const rows = deriveAnnualCandidateSafeties({
      openGoals: ["CORE_SUPPORT", "INCOMING_MEDIATION"],
      imbalances: [
        { kind: "RESIDUAL_CORE_SUPPORT", origin: "residual-natal-goal", evidence: [] },
        { kind: "CLIMATE_REINFORCEMENT_RISK", origin: "new-annual", evidence: [] },
      ],
      goalSatisfactions: [
        { goal: "CORE_SUPPORT", status: "partially-met" },
        { goal: "INCOMING_MEDIATION", status: "not-met" },
      ],
      natalCoreState: { core: "火", presence: "rooted-visible" },
      natalClimate: climate,
      evidence: evidenceFor({ core: "火", supplement: "木" }),
      corridors: [incomingCorridor("火", { first: "surface", second: "surface" })],
    });
    expect(byElement(rows)["水"].safety).toBe("conditional");
  });

  it("F. structural surface+surface + no harm → clean", () => {
    const rows = deriveAnnualCandidateSafeties({
      openGoals: ["INCOMING_MEDIATION"],
      imbalances: [
        { kind: "RESIDUAL_INCOMING_MEDIATION", origin: "residual-natal-goal", evidence: [] },
      ],
      goalSatisfactions: [{ goal: "INCOMING_MEDIATION", status: "not-met" }],
      natalCoreState: { core: "火", presence: "rooted-visible" },
      natalClimate: emptyClimate(),
      evidence: evidenceFor({ core: "火" }),
      corridors: [incomingCorridor("火", { first: "surface", second: "surface" })],
    });
    expect(byElement(rows)[coreParentElement("火")].safety).toBe("clean");
  });

  it("G. structural hidden leg → not clean", () => {
    const mid = coreParentElement("火");
    const rows = deriveAnnualCandidateSafeties({
      openGoals: ["INCOMING_MEDIATION"],
      imbalances: [],
      goalSatisfactions: [{ goal: "INCOMING_MEDIATION", status: "not-met" }],
      natalCoreState: { core: "火", presence: "rooted-visible" },
      natalClimate: emptyClimate(),
      evidence: evidenceFor({ core: "火" }),
      corridors: [incomingCorridor("火", { first: "surface", second: "hidden" })],
    });
    expect(byElement(rows)[mid].safety).not.toBe("clean");
  });

  it("H. climate reinforcement candidate (火, warm/dry) → not clean winner pool", () => {
    const climate = buildAdjustedClimateSummary(REP_PILLARS);
    const rows = deriveAnnualCandidateSafeties({
      openGoals: ["CORE_SUPPORT"],
      imbalances: [{ kind: "CLIMATE_REINFORCEMENT_RISK", origin: "new-annual", evidence: [] }],
      goalSatisfactions: [{ goal: "CORE_SUPPORT", status: "partially-met" }],
      natalCoreState: { core: "火", presence: "rooted-visible" },
      natalClimate: climate,
      evidence: evidenceFor({ core: "火", stemElement: "火", branchElement: "火" }),
      corridors: [],
    });
    const fire = byElement(rows)["火"];
    expect(fire.safety).not.toBe("clean");
  });

  it("I. 木土金 without climate remedy → unknown for climate assessment", () => {
    const climate = buildAdjustedClimateSummary(REP_PILLARS);
    const rows = deriveAnnualCandidateSafeties({
      openGoals: ["CLIMATE_MITIGATION"],
      imbalances: [{ kind: "CLIMATE_REINFORCEMENT_RISK", origin: "new-annual", evidence: [] }],
      natalCoreState: { core: "火", presence: "rooted-visible" },
      natalClimate: climate,
      evidence: evidenceFor({ core: "火" }),
      corridors: [],
    });
    expect(byElement(rows)["木"].safety).toBe("unknown");
    expect(byElement(rows)["土"].safety).toBe("unknown");
    expect(byElement(rows)["金"].safety).toBe("unknown");
  });

  it("J. Core 5-cycle: no open goals → all unknown (no auto clean)", () => {
    for (const core of ELEMENTS) {
      const rows = deriveAnnualCandidateSafeties({
        openGoals: [],
        imbalances: [],
        natalCoreState: { core, presence: "absent" },
        natalClimate: emptyClimate(),
        evidence: evidenceFor({
          core,
          stemElement: "火",
          branchElement: "火",
        }),
        corridors: [],
      });
      expect(rows.every((row) => row.safety === "unknown")).toBe(true);
    }
  });
});

describe("deriveAnnualCandidateSafeties — 2026 representative", () => {
  it("structural 木 clean; 水 climate conditional not conflicting", () => {
    const evidenceStrength = collectStrengthEvidence(REP_PILLARS);
    const observations = buildStrengthObservations(REP_PILLARS, evidenceStrength);
    const climate = buildAdjustedClimateSummary(REP_PILLARS);
    const needResolution = buildNeedResolution(REP_PILLARS);
    const fer = resolveFinalElement({
      pillars: REP_PILLARS,
      summary: buildStrengthSummary(REP_PILLARS),
      evidence: evidenceStrength,
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
    const corridors = buildCoreScopedCorridors({ core: "火", observations });
    const annualEvidence = buildAnnualLuckEvidence({
      target: buildAnnualTarget(2026),
      natalCoreElement: "火",
      natalSupplementElement: "木",
    });
    const goals = deriveNatalDeficitGoals({
      natalCoreElement: "火",
      natalSupplementElement: natalFlow.resolution.supplementElement,
      natalSupplementStatus: natalFlow.resolution.supplementStatus,
      natalPolicies: natalFlow.policies,
      natalCorridors: natalFlow.corridors,
      natalClimate: climate,
    });
    const satisfaction = deriveAnnualGoalSatisfaction({
      goals,
      evidence: annualEvidence,
      natalCoreState: buildCoreElementState({
        pillars: REP_PILLARS,
        core: "火",
        observations,
      }),
      natalClimate: climate,
      corridors,
    });
    const imbalances = deriveAnnualImbalances({
      goalSatisfaction: satisfaction,
      evidence: annualEvidence,
      natalCoreState: buildCoreElementState({
        pillars: REP_PILLARS,
        core: "火",
        observations,
      }),
      natalClimate: climate,
      natalSupplementElement: "木",
    });
    const openGoals = satisfaction
      .filter((row) => row.status !== "met")
      .map((row) => row.goal);

    const safeties = deriveAnnualCandidateSafeties({
      openGoals,
      imbalances,
      goalSatisfactions: satisfaction.map((row) => ({
        goal: row.goal,
        status: row.status,
      })),
      natalCoreState: buildCoreElementState({
        pillars: REP_PILLARS,
        core: "火",
        observations,
      }),
      natalClimate: climate,
      evidence: annualEvidence,
      corridors,
    });
    const map = byElement(safeties);

    expect(map["木"].safety).toBe("clean");
    expect(map["木"].conflictingGoals).toEqual([]);
    expect(map["木"].reasons.join("\n")).not.toMatch(/climate.*safe|climate.*mitig/i);

    expect(map["水"].safety).toBe("conditional");
    expect(map["水"].safety).not.toBe("conflicting");

    const winnerInput = safetiesForWinnerInput(safeties);
    expect(winnerInput.protectedHarmElements).not.toContain("水");
  });
});

describe("safetiesForWinnerInput — integration audit", () => {
  it("maps records to AnnualElementSafetyInput without manual conflicting", () => {
    const records = deriveAnnualCandidateSafeties({
      openGoals: ["INCOMING_MEDIATION"],
      imbalances: [],
      goalSatisfactions: [{ goal: "INCOMING_MEDIATION", status: "not-met" }],
      natalCoreState: { core: "火", presence: "rooted-visible" },
      natalClimate: emptyClimate(),
      evidence: evidenceFor({ core: "火" }),
      corridors: [incomingCorridor("火", { first: "surface", second: "surface" })],
    });
    const mapped = safetiesForWinnerInput(records);
    expect(mapped.safeties).toHaveLength(5);
    expect(mapped.safeties.every((row) => row.safety)).toBe(true);
    expect(mapped.protectedHarmElements).toEqual([]);
  });
});
