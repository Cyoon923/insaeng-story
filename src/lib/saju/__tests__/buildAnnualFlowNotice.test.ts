import { describe, expect, it } from "vitest";
import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { buildNeedResolution } from "@/lib/saju/elements/needResolution";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { buildStrengthSummary } from "@/lib/saju/elements/strengthSummary";
import { buildCoreElementState } from "@/lib/saju/final/buildCoreElementState";
import { buildCoreScopedCorridors } from "@/lib/saju/final/buildCoreScopedCorridors";
import { resolveFinalElement } from "@/lib/saju/final/resolveFinalElement";
import { resolveSupplementFlow } from "@/lib/saju/final/resolveSupplementFlow";
import { buildAnnualFlowNotice } from "@/lib/saju/luck/annual/buildAnnualFlowNotice";
import {
  deriveAnnualPresentationGate,
  type DeriveAnnualPresentationGateContext,
} from "@/lib/saju/luck/annual/deriveAnnualPresentationGate";
import {
  resolveAnnualSupplementFlowV2,
  type AnnualSupplementFlowV2,
  type AnnualSupplementFlowV2Resolution,
} from "@/lib/saju/luck/annual/resolveAnnualSupplementFlowV2";
import type { AnnualImbalance } from "@/lib/saju/luck/annual/types";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import type { AdjustedClimateSummary, FourPillars } from "@/lib/saju/types";

const REP_PILLARS: FourPillars = {
  year: { stem: "辛", branch: "酉" },
  month: { stem: "乙", branch: "未" },
  day: { stem: "丙", branch: "申" },
  hour: { stem: "戊", branch: "戌" },
  hourCertainty: "confirmed",
  warnings: [],
};

const FORBIDDEN_PHRASES = [
  "나무가",
  "물을 보강",
  "건강에",
  "화기가",
  "위험",
  "조후",
  "NEW_CLIMATE",
  "partial",
  "resolved",
  "A1",
  "F6",
];

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

function partialGate(res = resolution({ status: "partial", annualSupplementElement: "木" })) {
  return deriveAnnualPresentationGate(
    {
      ...res,
      unresolvedImbalances: ["NEW_CLIMATE_IMBALANCE"],
    },
    cleanContext(),
  );
}

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

function climateRisk(
  token: "warm-or-dry" | "cold-or-moist",
  temp: string,
  moist: string,
): AnnualImbalance {
  return {
    kind: "CLIMATE_REINFORCEMENT_RISK",
    origin: "new-annual",
    evidence: [
      `climate-risk:${token}`,
      "climate-risk:annual-fire-signal",
      `climate-risk:temp=${temp}`,
      `climate-risk:moist=${moist}`,
    ],
  };
}

function assertNoInternalLeak(text: string): void {
  expect(text).not.toMatch(/A[1-5]|F[1-8]|NEW_CLIMATE|RESIDUAL|ACTIVE|CAUTION/i);
  expect(text).not.toMatch(/\bpartial\b|\bresolved\b|\bunresolved\b/i);
}

function assertNoForbiddenPhrases(text: string): void {
  for (const phrase of FORBIDDEN_PHRASES) {
    expect(text).not.toContain(phrase);
  }
}

describe("buildAnnualFlowNotice — null cases", () => {
  it("resolved gate → null", () => {
    const res = resolution({ status: "resolved", annualSupplementElement: "木" });
    const gate = deriveAnnualPresentationGate(res, cleanContext());
    expect(gate.selectionDisplayStatus).toBe("displayable");

    expect(
      buildAnnualFlowNotice({
        year: 2026,
        presentationGate: gate,
        resolution: res,
        imbalances: [climateRisk("warm-or-dry", "warm", "dry")],
        natalClimate: emptyClimate({
          temperature: { status: "resolved", value: "warm", outcome: "unchanged" },
          moisture: { status: "resolved", value: "dry", outcome: "unchanged" },
        }),
      }),
    ).toBeNull();
  });

  it("blocked gate → null", () => {
    const res = resolution({
      status: "partial",
      annualSupplementElement: "木",
      unresolvedGoals: ["CORE_SUPPORT"],
    });
    const gate = deriveAnnualPresentationGate(res, cleanContext());
    expect(gate.selectionDisplayStatus).toBe("blocked");

    expect(
      buildAnnualFlowNotice({
        year: 2026,
        presentationGate: gate,
        resolution: res,
        imbalances: [climateRisk("warm-or-dry", "warm", "dry")],
        natalClimate: emptyClimate(),
      }),
    ).toBeNull();
  });

  it("displayable-partial without NEW_CLIMATE_IMBALANCE → null", () => {
    const res = resolution({
      status: "partial",
      annualSupplementElement: "木",
      unresolvedImbalances: [],
    });
    const gate = partialGate(res);

    expect(
      buildAnnualFlowNotice({
        year: 2026,
        presentationGate: gate,
        resolution: res,
        imbalances: [climateRisk("warm-or-dry", "warm", "dry")],
        natalClimate: emptyClimate({
          temperature: { status: "resolved", value: "warm", outcome: "unchanged" },
          moisture: { status: "resolved", value: "dry", outcome: "unchanged" },
        }),
      }),
    ).toBeNull();
  });

  it("NEW_CLIMATE without climate reinforcement imbalance → null", () => {
    const res = resolution({
      status: "partial",
      annualSupplementElement: "木",
      unresolvedImbalances: ["NEW_CLIMATE_IMBALANCE"],
    });

    expect(
      buildAnnualFlowNotice({
        year: 2026,
        presentationGate: partialGate(res),
        resolution: res,
        imbalances: [],
        natalClimate: emptyClimate(),
      }),
    ).toBeNull();
  });
});

describe("buildAnnualFlowNotice — warm / dry profiles", () => {
  it("warm + dry → combined copy", () => {
    const res = resolution({
      status: "partial",
      annualSupplementElement: "木",
      unresolvedImbalances: ["NEW_CLIMATE_IMBALANCE"],
    });

    const notice = buildAnnualFlowNotice({
      year: 2026,
      presentationGate: partialGate(res),
      resolution: res,
      imbalances: [climateRisk("warm-or-dry", "warm", "dry")],
      natalClimate: emptyClimate({
        temperature: { status: "resolved", value: "warm", outcome: "unchanged" },
        moisture: { status: "resolved", value: "dry", outcome: "unchanged" },
      }),
    });

    expect(notice).toEqual({
      title: "2026년에는 이런 흐름도 함께 보여요",
      description:
        "올해는 열과 건조의 흐름이 함께 나타날 수 있어, 한쪽으로 치우치지 않도록 균형 있게 살펴보는 것이 좋아요.",
    });
    assertNoInternalLeak(notice!.title + notice!.description);
    assertNoForbiddenPhrases(notice!.description);
  });

  it("warm only → 따뜻한 흐름 copy", () => {
    const res = resolution({
      status: "partial",
      annualSupplementElement: "木",
      unresolvedImbalances: ["NEW_CLIMATE_IMBALANCE"],
    });

    const notice = buildAnnualFlowNotice({
      year: 2026,
      presentationGate: partialGate(res),
      resolution: res,
      imbalances: [climateRisk("warm-or-dry", "warm", "balanced")],
      natalClimate: emptyClimate({
        temperature: { status: "resolved", value: "warm", outcome: "unchanged" },
        moisture: { status: "resolved", value: "balanced", outcome: "unchanged" },
      }),
    });

    expect(notice?.description).toBe(
      "올해는 따뜻한 흐름이 함께 나타날 수 있어, 한쪽으로 치우치지 않도록 균형 있게 살펴보는 것이 좋아요.",
    );
    expect(notice?.description).not.toContain("건조");
  });

  it("dry only → 건조한 흐름 copy", () => {
    const res = resolution({
      status: "partial",
      annualSupplementElement: "木",
      unresolvedImbalances: ["NEW_CLIMATE_IMBALANCE"],
    });

    const notice = buildAnnualFlowNotice({
      year: 2026,
      presentationGate: partialGate(res),
      resolution: res,
      imbalances: [climateRisk("warm-or-dry", "balanced", "dry")],
      natalClimate: emptyClimate({
        temperature: { status: "resolved", value: "balanced", outcome: "unchanged" },
        moisture: { status: "resolved", value: "dry", outcome: "unchanged" },
      }),
    });

    expect(notice?.description).toBe(
      "올해는 건조한 흐름이 함께 나타날 수 있어, 한쪽으로 치우치지 않도록 균형 있게 살펴보는 것이 좋아요.",
    );
    expect(notice?.description).not.toContain("열과");
    expect(notice?.description).not.toContain("따뜻");
  });
});

describe("buildAnnualFlowNotice — cold / moist profiles", () => {
  it("cold + moist → combined copy", () => {
    const res = resolution({
      status: "partial",
      annualSupplementElement: "水",
      unresolvedImbalances: ["NEW_CLIMATE_IMBALANCE"],
    });

    const notice = buildAnnualFlowNotice({
      year: 2026,
      presentationGate: partialGate(res),
      resolution: res,
      imbalances: [climateRisk("cold-or-moist", "cold", "moist")],
      natalClimate: emptyClimate({
        temperature: { status: "resolved", value: "cold", outcome: "unchanged" },
        moisture: { status: "resolved", value: "moist", outcome: "unchanged" },
      }),
    });

    expect(notice?.description).toBe(
      "올해는 한기와 습기의 흐름이 함께 나타날 수 있어, 한쪽으로 치우치지 않도록 균형 있게 살펴보는 것이 좋아요.",
    );
  });

  it("cold only", () => {
    const res = resolution({
      status: "partial",
      annualSupplementElement: "水",
      unresolvedImbalances: ["NEW_CLIMATE_IMBALANCE"],
    });

    const notice = buildAnnualFlowNotice({
      year: 2026,
      presentationGate: partialGate(res),
      resolution: res,
      imbalances: [climateRisk("cold-or-moist", "cold", "balanced")],
      natalClimate: emptyClimate({
        temperature: { status: "resolved", value: "cold", outcome: "unchanged" },
        moisture: { status: "resolved", value: "balanced", outcome: "unchanged" },
      }),
    });

    expect(notice?.description).toBe(
      "올해는 한기의 흐름이 함께 나타날 수 있어, 한쪽으로 치우치지 않도록 균형 있게 살펴보는 것이 좋아요.",
    );
    expect(notice?.description).not.toContain("습기");
  });

  it("moist only", () => {
    const res = resolution({
      status: "partial",
      annualSupplementElement: "水",
      unresolvedImbalances: ["NEW_CLIMATE_IMBALANCE"],
    });

    const notice = buildAnnualFlowNotice({
      year: 2026,
      presentationGate: partialGate(res),
      resolution: res,
      imbalances: [climateRisk("cold-or-moist", "balanced", "moist")],
      natalClimate: emptyClimate({
        temperature: { status: "resolved", value: "balanced", outcome: "unchanged" },
        moisture: { status: "resolved", value: "moist", outcome: "unchanged" },
      }),
    });

    expect(notice?.description).toBe(
      "올해는 습기의 흐름이 함께 나타날 수 있어, 한쪽으로 치우치지 않도록 균형 있게 살펴보는 것이 좋아요.",
    );
    expect(notice?.description).not.toContain("한기와");
  });
});

describe("buildAnnualFlowNotice — 2026 representative", () => {
  it("辛酉/乙未/丙申/戊戌 → warm+dry flow notice", () => {
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
    const flow = resolveAnnualSupplementFlowV2({
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
    const gate = deriveAnnualPresentationGate(flow.resolution, gateContextFromFlow(flow));

    expect(gate.selectionDisplayStatus).toBe("displayable-partial");
    expect(flow.resolution.unresolvedImbalances).toContain("NEW_CLIMATE_IMBALANCE");

    const notice = buildAnnualFlowNotice({
      year: 2026,
      presentationGate: gate,
      resolution: flow.resolution,
      imbalances: flow.imbalances,
      natalClimate: climate,
    });

    expect(notice).toEqual({
      title: "2026년에는 이런 흐름도 함께 보여요",
      description:
        "올해는 열과 건조의 흐름이 함께 나타날 수 있어, 한쪽으로 치우치지 않도록 균형 있게 살펴보는 것이 좋아요.",
    });
    assertNoInternalLeak(notice!.title + notice!.description);
    assertNoForbiddenPhrases(notice!.description);
  });
});
