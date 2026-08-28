import { describe, expect, it } from "vitest";
import { buildSupplementPresentation } from "@/lib/saju/final/buildSupplementPresentation";
import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { buildNeedResolution } from "@/lib/saju/elements/needResolution";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { buildStrengthSummary } from "@/lib/saju/elements/strengthSummary";
import { buildCoreElementState } from "@/lib/saju/final/buildCoreElementState";
import { buildCoreScopedCorridors } from "@/lib/saju/final/buildCoreScopedCorridors";
import { resolveFinalElement } from "@/lib/saju/final/resolveFinalElement";
import { resolveSupplementFlow } from "@/lib/saju/final/resolveSupplementFlow";
import { buildAnnualPresentation } from "@/lib/saju/luck/annual/buildAnnualPresentation";
import {
  deriveAnnualPresentationGate,
  type DeriveAnnualPresentationGateContext,
} from "@/lib/saju/luck/annual/deriveAnnualPresentationGate";
import { resolveAnnualSupplementFlowV2 } from "@/lib/saju/luck/annual/resolveAnnualSupplementFlowV2";
import type { AnnualSupplementFlowV2Resolution } from "@/lib/saju/luck/annual/resolveAnnualSupplementFlowV2";
import type { AnnualSupplementFlowV2 } from "@/lib/saju/luck/annual/resolveAnnualSupplementFlowV2";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import type { Element, FourPillars } from "@/lib/saju/types";

const REP_PILLARS: FourPillars = {
  year: { stem: "辛", branch: "酉" },
  month: { stem: "乙", branch: "未" },
  day: { stem: "丙", branch: "申" },
  hour: { stem: "戊", branch: "戌" },
  hourCertainty: "confirmed",
  warnings: [],
};

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

function assertNoInternalLeak(text: string): void {
  expect(text).not.toMatch(/A[1-5]|F[1-8]/);
  expect(text).not.toMatch(/NEW_CLIMATE|RESIDUAL|ACTIVE|CAUTION|INACTIVE/i);
  expect(text).not.toMatch(/partial|일부|불확실/i);
}

function natalBalance(over: {
  coreElement?: Element | null;
  supplementElement?: Element | null;
  supplementStatus?: "resolved" | "unresolved";
}) {
  return buildSupplementPresentation({
    coreElement: over.coreElement ?? "火",
    coreCertainty: "confirmed",
    coreRole: "R2",
    supplementElement: over.supplementElement ?? "木",
    supplementStatus: over.supplementStatus ?? "resolved",
    reasons: [],
  });
}

describe("buildAnnualPresentation — A resolved", () => {
  it("displayable + 木 → element shown, status=resolved", () => {
    const res = resolution({
      status: "resolved",
      annualSupplementElement: "木",
    });
    const gate = deriveAnnualPresentationGate(res);
    expect(gate.selectionDisplayStatus).toBe("displayable");

    const view = buildAnnualPresentation({
      year: 2026,
      gate,
      resolution: res,
      natalBalancePresentation: natalBalance({ supplementElement: "水" }),
    });

    expect(view).toMatchObject({
      status: "resolved",
      element: "木",
      name: "나무",
      showAnnualElement: true,
      showAnnualMusic: true,
      headline: "2026년 보강 기운은 나무예요.",
      description: "올해의 흐름을 기준으로 지금 보강하면 좋은 방향을 살펴봤어요.",
    });
    assertNoInternalLeak(view.headline);
  });
});

describe("buildAnnualPresentation — B/C displayable-partial", () => {
  it("partial 木 + displayable-partial gate → show without weak copy", () => {
    const res = resolution({
      status: "partial",
      annualSupplementElement: "木",
      unresolvedImbalances: ["NEW_CLIMATE_IMBALANCE"],
    });
    const gate = deriveAnnualPresentationGate(res, cleanContext());
    expect(gate.selectionDisplayStatus).toBe("displayable-partial");

    const view = buildAnnualPresentation({
      year: 2026,
      gate,
      resolution: res,
      natalBalancePresentation: natalBalance({ supplementElement: "木" }),
    });

    expect(view).toMatchObject({
      status: "partial",
      element: "木",
      name: "나무",
      symbol: "🌱",
      showAnnualElement: true,
      showAnnualMusic: true,
      headline: "2026년에는 나무의 성질을 보강하는 방향이 잘 맞아요.",
      description: "올해의 흐름을 기준으로 지금 보강하면 좋은 방향을 살펴봤어요.",
    });
    expect(view.headline).toContain("2026년");
    expect(view.headline).toContain("나무");
    expect(view.headline).not.toMatch(/정하기 어려워요|partial|일부|불확실/);
    assertNoInternalLeak(view.headline);
  });

  it("partial 水 + displayable-partial gate → 물 표시", () => {
    const res = resolution({
      status: "partial",
      annualSupplementElement: "水",
      unresolvedImbalances: ["NEW_CLIMATE_IMBALANCE"],
    });
    const gate = deriveAnnualPresentationGate(res, cleanContext());

    const view = buildAnnualPresentation({
      year: 2026,
      gate,
      resolution: res,
      natalBalancePresentation: natalBalance({ supplementElement: "水" }),
    });

    expect(view).toMatchObject({
      status: "partial",
      element: "水",
      name: "물",
      showAnnualElement: true,
      showAnnualMusic: true,
      headline: "2026년에는 물의 성질을 보강하는 방향이 잘 맞아요.",
    });
  });
});

describe("buildAnnualPresentation — D blocked partial", () => {
  it("partial + blocked gate → hidden element", () => {
    const res = resolution({
      status: "partial",
      annualSupplementElement: "木",
      unresolvedGoals: ["CORE_SUPPORT"],
    });
    const gate = deriveAnnualPresentationGate(res, cleanContext());
    expect(gate.selectionDisplayStatus).toBe("blocked");

    const view = buildAnnualPresentation({
      year: 2026,
      gate,
      resolution: res,
      natalBalancePresentation: natalBalance({}),
    });

    expect(view).toMatchObject({
      status: "partial",
      element: null,
      name: null,
      showAnnualElement: false,
      showAnnualMusic: false,
      headline: "2026년의 흐름을 한 가지 방향으로만 설명하기는 어려워요.",
    });
    expect(view.headline).not.toContain("보강 기운을 한 가지로");
  });
});

describe("buildAnnualPresentation — E unresolved", () => {
  it("unresolved + blocked gate → hidden", () => {
    const res = resolution({ status: "unresolved" });
    const gate = deriveAnnualPresentationGate(res);

    const view = buildAnnualPresentation({
      year: 2026,
      gate,
      resolution: res,
      natalBalancePresentation: natalBalance({
        supplementElement: null,
        supplementStatus: "unresolved",
      }),
    });

    expect(view).toMatchObject({
      status: "unresolved",
      element: null,
      showAnnualElement: false,
      showAnnualMusic: false,
      headline: "현재 정보로는 2026년 보강 방향을 한 가지로 정하기 어려워요.",
      natalBaseline: null,
    });
  });
});

describe("buildAnnualPresentation — F/G natal baseline", () => {
  it("natal 木 + annual 木 → both kept independently", () => {
    const res = resolution({
      status: "partial",
      annualSupplementElement: "木",
      unresolvedImbalances: ["NEW_CLIMATE_IMBALANCE"],
    });
    const gate = deriveAnnualPresentationGate(res, cleanContext());
    const balance = natalBalance({ supplementElement: "木" });

    const view = buildAnnualPresentation({
      year: 2026,
      gate,
      resolution: res,
      natalBalancePresentation: balance,
    });

    expect(view.element).toBe("木");
    expect(view.natalBaseline).toEqual({
      element: "木",
      symbol: "🌱",
      name: "나무",
    });
    expect(view.element).not.toBe(view.natalBaseline);
  });

  it("natal 木 + annual 水 → independent", () => {
    const res = resolution({
      status: "resolved",
      annualSupplementElement: "水",
    });
    const gate = deriveAnnualPresentationGate(res);
    const balance = natalBalance({ supplementElement: "木" });

    const view = buildAnnualPresentation({
      year: 2026,
      gate,
      resolution: res,
      natalBalancePresentation: balance,
    });

    expect(view.element).toBe("水");
    expect(view.natalBaseline?.element).toBe("木");
  });
});

describe("buildAnnualPresentation — 2026 representative", () => {
  it("辛酉/乙未/丙申/戊戌 → displayable-partial 木", () => {
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
    const natalBalance = buildSupplementPresentation(natalFlow.resolution);
    const annualFlow = resolveAnnualSupplementFlowV2({
      year: 2026,
      natalCoreElement: natalFlow.resolution.coreElement,
      natalCoreCertainty: natalFlow.resolution.coreCertainty,
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
    const gate = deriveAnnualPresentationGate(
      annualFlow.resolution,
      gateContextFromFlow(annualFlow),
    );

    const view = buildAnnualPresentation({
      year: 2026,
      gate,
      resolution: annualFlow.resolution,
      natalBalancePresentation: natalBalance,
    });

    expect(view).toMatchObject({
      status: "partial",
      element: "木",
      name: "나무",
      showAnnualElement: true,
      showAnnualMusic: true,
      headline: "2026년에는 나무의 성질을 보강하는 방향이 잘 맞아요.",
    });
    expect(view.natalBaseline?.element).toBe("木");
  });
});
