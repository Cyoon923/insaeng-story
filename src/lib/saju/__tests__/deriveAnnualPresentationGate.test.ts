import { describe, expect, it } from "vitest";
import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { buildNeedResolution } from "@/lib/saju/elements/needResolution";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { buildStrengthSummary } from "@/lib/saju/elements/strengthSummary";
import { buildCoreElementState } from "@/lib/saju/final/buildCoreElementState";
import { buildCoreScopedCorridors } from "@/lib/saju/final/buildCoreScopedCorridors";
import { resolveFinalElement } from "@/lib/saju/final/resolveFinalElement";
import { resolveSupplementFlow } from "@/lib/saju/final/resolveSupplementFlow";
import {
  deriveAnnualPresentationGate,
  type DeriveAnnualPresentationGateContext,
} from "@/lib/saju/luck/annual/deriveAnnualPresentationGate";
import { resolveAnnualSupplementFlowV2 } from "@/lib/saju/luck/annual/resolveAnnualSupplementFlowV2";
import type { AnnualSupplementFlowV2Resolution } from "@/lib/saju/luck/annual/resolveAnnualSupplementFlowV2";
import type { AnnualSupplementFlowV2 } from "@/lib/saju/luck/annual/resolveAnnualSupplementFlowV2";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import type {
  EarthlyBranch,
  Element,
  FourPillars,
  HeavenlyStem,
  HourPillar,
  Pillar,
} from "@/lib/saju/types";

const REP_PILLARS: FourPillars = {
  year: { stem: "辛", branch: "酉" },
  month: { stem: "乙", branch: "未" },
  day: { stem: "丙", branch: "申" },
  hour: { stem: "戊", branch: "戌" },
  hourCertainty: "confirmed",
  warnings: [],
};

function parsePillar(s: string): Pillar {
  return { stem: s[0] as HeavenlyStem, branch: s[1] as EarthlyBranch };
}

function chart(y: string, m: string, d: string, h: string | "unknown"): FourPillars {
  const hour: HourPillar = h === "unknown" ? "unknown" : parsePillar(h);
  return {
    year: parsePillar(y),
    month: parsePillar(m),
    day: parsePillar(d),
    hour,
    hourCertainty: h === "unknown" ? "unknown" : "confirmed",
    warnings: [],
  };
}

function resolution(
  over: Partial<AnnualSupplementFlowV2Resolution>,
): AnnualSupplementFlowV2Resolution {
  return {
    year: 2026,
    annualStemBranch: "丙午",
    annualSupplementElement: null,
    status: "unresolved",
    unresolvedGoals: [],
    unresolvedImbalances: [],
    reasons: [],
    ...over,
  };
}

function cleanContext(
  over: Partial<DeriveAnnualPresentationGateContext> = {},
): DeriveAnnualPresentationGateContext {
  return {
    selectedWinnerSafety: "clean",
    selectedConflictingGoals: [],
    ...over,
  };
}

function gateContextFromFlow(flow: AnnualSupplementFlowV2): DeriveAnnualPresentationGateContext {
  const el = flow.resolution.annualSupplementElement;
  const safety = flow.safeties.find((row) => row.element === el);
  return {
    selectedWinnerSafety: safety?.safety,
    selectedConflictingGoals: safety?.conflictingGoals ?? [],
  };
}

function repFlow2026() {
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
  return resolveAnnualSupplementFlowV2({
    year: 2026,
    natalCoreElement: "火",
    natalCoreCertainty: fer.certainty,
    natalSupplementElement: natalFlow.resolution.supplementElement,
    natalSupplementStatus: natalFlow.resolution.supplementStatus,
    natalPolicies: natalFlow.policies,
    natalCorridors: buildCoreScopedCorridors({ core: "火", observations }),
    natalCoreState: buildCoreElementState({
      pillars: REP_PILLARS,
      core: "火",
      observations,
    }),
    natalClimate: climate,
    needResolution,
  });
}

function partialFlowFromPillars(pillars: FourPillars) {
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
  const natalFlow = resolveSupplementFlow({
    pillars,
    finalResolution: fer,
    observations,
    climate,
    needResolution,
  });
  return resolveAnnualSupplementFlowV2({
    year: 2026,
    natalCoreElement: natalFlow.resolution.coreElement,
    natalCoreCertainty: natalFlow.resolution.coreCertainty,
    natalSupplementElement: natalFlow.resolution.supplementElement,
    natalSupplementStatus: natalFlow.resolution.supplementStatus,
    natalPolicies: natalFlow.policies,
    natalCorridors: natalFlow.corridors,
    natalCoreState: natalFlow.coreState,
    natalClimate: climate,
    needResolution,
  });
}

describe("deriveAnnualPresentationGate — resolved / unresolved", () => {
  it("A. resolved + 木 → displayable", () => {
    const gate = deriveAnnualPresentationGate(
      resolution({
        status: "resolved",
        annualSupplementElement: "木",
      }),
    );
    expect(gate).toMatchObject({
      showAnnualElement: true,
      showAnnualMusic: true,
      presentationElement: "木",
      state: "resolved",
      selectionDisplayStatus: "displayable",
    });
  });

  it("B. resolved + 水 → displayable", () => {
    const gate = deriveAnnualPresentationGate(
      resolution({
        status: "resolved",
        annualSupplementElement: "水",
      }),
    );
    expect(gate.selectionDisplayStatus).toBe("displayable");
    expect(gate.showAnnualElement).toBe(true);
    expect(gate.showAnnualMusic).toBe(true);
    expect(gate.presentationElement).toBe("水");
  });

  it("D. unresolved → blocked", () => {
    const gate = deriveAnnualPresentationGate(
      resolution({ status: "unresolved", annualSupplementElement: null }),
    );
    expect(gate).toMatchObject({
      showAnnualElement: false,
      showAnnualMusic: false,
      presentationElement: null,
      state: "unresolved",
      selectionDisplayStatus: "blocked",
    });
  });

  it("E. resolved + null abnormal → blocked", () => {
    const gate = deriveAnnualPresentationGate(
      resolution({ status: "resolved", annualSupplementElement: null }),
    );
    expect(gate).toMatchObject({
      showAnnualElement: false,
      showAnnualMusic: false,
      presentationElement: null,
      state: "unresolved",
      selectionDisplayStatus: "blocked",
    });
    expect(gate.reasons).toContain("gate:abnormal-resolved-null-element");
  });
});

describe("deriveAnnualPresentationGate — displayable-partial", () => {
  it("C. partial + 木 + NEW_CLIMATE + clean context → displayable-partial", () => {
    const gate = deriveAnnualPresentationGate(
      resolution({
        status: "partial",
        annualSupplementElement: "木",
        unresolvedImbalances: ["NEW_CLIMATE_IMBALANCE"],
      }),
      cleanContext(),
    );
    expect(gate).toMatchObject({
      showAnnualElement: true,
      showAnnualMusic: true,
      presentationElement: "木",
      state: "partial",
      selectionDisplayStatus: "displayable-partial",
    });
    expect(gate.reasons).toContain("gate:partial-completeness-only=NEW_CLIMATE_IMBALANCE");
  });

  it("partial without safety context → blocked", () => {
    const gate = deriveAnnualPresentationGate(
      resolution({
        status: "partial",
        annualSupplementElement: "木",
        unresolvedImbalances: ["NEW_CLIMATE_IMBALANCE"],
      }),
    );
    expect(gate.selectionDisplayStatus).toBe("blocked");
    expect(gate.showAnnualElement).toBe(false);
    expect(gate.reasons).toContain("gate:partial-missing-winner-safety-context");
  });
});

describe("deriveAnnualPresentationGate — blocked-partial", () => {
  it("F. unresolvedGoals → blocked even with clean context", () => {
    const gate = deriveAnnualPresentationGate(
      resolution({
        status: "partial",
        annualSupplementElement: "木",
        unresolvedGoals: ["CORE_SUPPORT"],
      }),
      cleanContext(),
    );
    expect(gate.selectionDisplayStatus).toBe("blocked");
    expect(gate.showAnnualElement).toBe(false);
    expect(gate.reasons).toContain("gate:partial-unresolved-goals=CORE_SUPPORT");
  });

  it("winner safety conditional → blocked", () => {
    const gate = deriveAnnualPresentationGate(
      resolution({
        status: "partial",
        annualSupplementElement: "火",
        unresolvedImbalances: ["NEW_CLIMATE_IMBALANCE"],
      }),
      cleanContext({ selectedWinnerSafety: "conditional" }),
    );
    expect(gate).toMatchObject({
      selectionDisplayStatus: "blocked",
      showAnnualElement: false,
      showAnnualMusic: false,
      presentationElement: null,
    });
    expect(gate.reasons).toContain("gate:partial-winner-safety=conditional");
  });

  it("winner safety conflicting → blocked", () => {
    const gate = deriveAnnualPresentationGate(
      resolution({
        status: "partial",
        annualSupplementElement: "火",
        unresolvedImbalances: ["NEW_CLIMATE_IMBALANCE"],
      }),
      cleanContext({ selectedWinnerSafety: "conflicting" }),
    );
    expect(gate.selectionDisplayStatus).toBe("blocked");
    expect(gate.showAnnualElement).toBe(false);
  });

  it("conflictingGoals → blocked", () => {
    const gate = deriveAnnualPresentationGate(
      resolution({
        status: "partial",
        annualSupplementElement: "木",
        unresolvedImbalances: ["NEW_CLIMATE_IMBALANCE"],
      }),
      cleanContext({ selectedConflictingGoals: ["CORE_SUPPORT"] }),
    );
    expect(gate.selectionDisplayStatus).toBe("blocked");
    expect(gate.showAnnualElement).toBe(false);
    expect(gate.reasons).toContain("gate:partial-conflicting-goals=CORE_SUPPORT");
  });

  it("explicit unresolved imbalance (non-climate) → blocked", () => {
    const gate = deriveAnnualPresentationGate(
      resolution({
        status: "partial",
        annualSupplementElement: "木",
        unresolvedImbalances: ["RESIDUAL_CORE_SUPPORT"],
      }),
      cleanContext(),
    );
    expect(gate.selectionDisplayStatus).toBe("blocked");
    expect(gate.showAnnualElement).toBe(false);
    expect(gate.reasons).toContain("gate:partial-explicit-imbalance-conflict");
  });

  it("H. no natal/Core fallback — presentationElement from resolution only", () => {
    const gate = deriveAnnualPresentationGate(
      resolution({
        status: "partial",
        annualSupplementElement: "木",
        unresolvedImbalances: ["NEW_CLIMATE_IMBALANCE"],
      }),
      cleanContext(),
    );
    expect(gate.presentationElement).toBe("木");
    expect(gate.presentationElement).not.toBe("火" as Element);
  });
});

describe("deriveAnnualPresentationGate — partial fixture trio", () => {
  const cases = [
    {
      id: "LW-eulhae",
      pillars: chart("乙亥", "乙酉", "甲寅", "甲子"),
      expected: "水" as Element,
    },
    {
      id: "LW-bingo",
      pillars: chart("丙午", "戊戌", "甲申", "甲子"),
      expected: "水" as Element,
    },
    {
      id: "MX-1981",
      pillars: chart("辛酉", "乙未", "丙申", "戊戌"),
      expected: "木" as Element,
    },
  ] as const;

  for (const { id, pillars, expected } of cases) {
    it(`${id} → ${expected} displayable-partial with music`, () => {
      const flow = partialFlowFromPillars(pillars);
      expect(flow.resolution.status).toBe("partial");
      expect(flow.resolution.annualSupplementElement).toBe(expected);
      expect(flow.resolution.unresolvedGoals).toEqual([]);
      expect(flow.resolution.unresolvedImbalances).toEqual(
        expect.arrayContaining(["NEW_CLIMATE_IMBALANCE"]),
      );

      const gate = deriveAnnualPresentationGate(
        flow.resolution,
        gateContextFromFlow(flow),
      );
      expect(gate).toMatchObject({
        selectionDisplayStatus: "displayable-partial",
        showAnnualElement: true,
        showAnnualMusic: true,
        presentationElement: expected,
        state: "partial",
      });
    });
  }
});

describe("deriveAnnualPresentationGate — 2026 representative", () => {
  it("internal 木 partial + safety context → displayable-partial", () => {
    const flow = repFlow2026();
    expect(flow.resolution.annualSupplementElement).toBe("木");
    expect(flow.resolution.status).toBe("partial");

    const gate = deriveAnnualPresentationGate(
      flow.resolution,
      gateContextFromFlow(flow),
    );
    expect(gate).toMatchObject({
      state: "partial",
      presentationElement: "木",
      showAnnualElement: true,
      showAnnualMusic: true,
      selectionDisplayStatus: "displayable-partial",
    });
  });
});
