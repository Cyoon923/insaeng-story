import { describe, expect, it } from "vitest";
import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { buildNeedResolution } from "@/lib/saju/elements/needResolution";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { buildStrengthSummary } from "@/lib/saju/elements/strengthSummary";
import { buildCoreElementState } from "@/lib/saju/final/buildCoreElementState";
import { buildCoreScopedCorridors } from "@/lib/saju/final/buildCoreScopedCorridors";
import { resolveFinalElement } from "@/lib/saju/final/resolveFinalElement";
import { resolveSupplementFlow } from "@/lib/saju/final/resolveSupplementFlow";
import { buildAnnualLuckEvidence } from "@/lib/saju/luck/annual/buildAnnualLuckEvidence";
import {
  buildAnnualReasonsPresentation,
  type AnnualReasonCategory,
  type BuildAnnualReasonsPresentationInput,
} from "@/lib/saju/luck/annual/buildAnnualReasonsPresentation";
import { buildAnnualTarget } from "@/lib/saju/luck/annual/buildAnnualTarget";
import {
  deriveAnnualPresentationGate,
  type DeriveAnnualPresentationGateContext,
} from "@/lib/saju/luck/annual/deriveAnnualPresentationGate";
import type { AnnualCandidatePolicy } from "@/lib/saju/luck/annual/deriveAnnualCandidatePolicyStates";
import {
  resolveAnnualSupplementFlowV2,
  type AnnualSupplementFlowV2,
  type AnnualSupplementFlowV2Resolution,
} from "@/lib/saju/luck/annual/resolveAnnualSupplementFlowV2";
import type {
  AnnualCandidateSafetyRecord,
  AnnualGoalSatisfaction,
  AnnualImbalance,
  AnnualLuckEvidence,
  AnnualWinnerCandidate,
  NatalDeficitGoal,
} from "@/lib/saju/luck/annual/types";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import type { Element, FourPillars } from "@/lib/saju/types";
import { ELEMENTS } from "@/lib/saju/types";

const REP_PILLARS: FourPillars = {
  year: { stem: "辛", branch: "酉" },
  month: { stem: "乙", branch: "未" },
  day: { stem: "丙", branch: "申" },
  hour: { stem: "戊", branch: "戌" },
  hourCertainty: "confirmed",
  warnings: [],
};

const FORBIDDEN_PHRASES = [
  "강하게",
  "폭발",
  "부족했던",
  "충분해",
  "더 안전",
  "완화해",
  "주의하세요",
  "이어준",
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

function assertNoInternalLeak(text: string): void {
  expect(text).not.toMatch(/A[1-5]|F[1-8]/);
  expect(text).not.toMatch(
    /NEW_CLIMATE|RESIDUAL|ACTIVE|CAUTION|INACTIVE|CORE_SUPPORT|INCOMING_MEDIATION/i,
  );
  expect(text).not.toMatch(/\bpartial\b|\bresolved\b|\bunresolved\b/i);
}

function assertNoForbiddenPhrases(text: string): void {
  for (const phrase of FORBIDDEN_PHRASES) {
    expect(text).not.toContain(phrase);
  }
}

function categories(items: { category: AnnualReasonCategory }[]): AnnualReasonCategory[] {
  return items.map((item) => item.category);
}

function emptySafeties(): AnnualCandidateSafetyRecord[] {
  return ELEMENTS.map((element) => ({
    element,
    safety: "unknown",
    protectedGoals: [],
    conflictingGoals: [],
    reasons: [],
  }));
}

function inactivePolicies(): AnnualCandidatePolicy[] {
  return ELEMENTS.map((element) => ({
    element,
    state: "INACTIVE" as const,
    positiveFunctions: [],
    cautionFunctions: [],
    traceFunctions: [],
    reasons: [],
  }));
}

function candidate(
  element: Element,
  over: Partial<AnnualWinnerCandidate> = {},
): AnnualWinnerCandidate {
  return {
    element,
    state: "ACTIVE",
    safety: "clean",
    residualGoalsAddressed: [],
    evidenceQuality: "direct",
    ...over,
  };
}

function evidence2026Fire(): AnnualLuckEvidence {
  return buildAnnualLuckEvidence({
    target: buildAnnualTarget(2026),
    natalCoreElement: "火",
    natalSupplementElement: "木",
  });
}

function baseInput(
  over: Partial<BuildAnnualReasonsPresentationInput> = {},
): BuildAnnualReasonsPresentationInput {
  const res = resolution({
    status: "resolved",
    annualSupplementElement: "木",
  });
  const gate = deriveAnnualPresentationGate(res, cleanContext());
  return {
    year: 2026,
    evidence: evidence2026Fire(),
    natalGoals: [],
    goalSatisfactions: [],
    imbalances: [],
    candidatePolicies: inactivePolicies(),
    safeties: emptySafeties(),
    winnerInput: { candidates: [], openGoals: [], openImbalances: [] },
    resolution: res,
    presentationGate: gate,
    ...over,
  };
}

function repAnnualFlow(): AnnualSupplementFlowV2 {
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
}

function flowReasonsInput(flow: AnnualSupplementFlowV2): BuildAnnualReasonsPresentationInput {
  const gate = deriveAnnualPresentationGate(flow.resolution, gateContextFromFlow(flow));
  return {
    year: flow.resolution.year,
    evidence: flow.evidence,
    natalGoals: flow.natalGoals,
    goalSatisfactions: flow.goalSatisfactions,
    imbalances: flow.imbalances,
    candidatePolicies: flow.candidatePolicies,
    safeties: flow.safeties,
    winnerInput: flow.winnerInput,
    resolution: flow.resolution,
    presentationGate: gate,
  };
}

describe("buildAnnualReasonsPresentation — 2026 representative 木", () => {
  it("辛酉/乙未/丙申/戊戌 → 3 reasons (arrival + structural + climate)", () => {
    const flow = repAnnualFlow();
    const view = buildAnnualReasonsPresentation(flowReasonsInput(flow));

    expect(view.title).toBe("왜 이 기운일까요?");
    expect(view.items).toHaveLength(3);
    expect(categories(view.items)).toEqual([
      "ANNUAL_ARRIVAL",
      "STRUCTURAL_CONNECTION",
      "CLIMATE_NOTICE",
    ]);
    expect(view.items[0]!.text).toBe("2026년에는 불(火)의 기운이 들어와요.");
    expect(view.items[1]!.text).toBe(
      "나무는 기본 흐름에서 기운을 이어주는 연결 역할을 해요.",
    );
    expect(view.items[2]!.text).toBe(
      "올해는 열과 건조의 흐름도 함께 살펴볼 필요가 있어요.",
    );

    for (const item of view.items) {
      assertNoInternalLeak(item.text);
      assertNoForbiddenPhrases(item.text);
    }
    expect(view.items.map((item) => item.text).join("\n")).not.toMatch(/水→木→火/);
  });
});

describe("buildAnnualReasonsPresentation — gate / blocked", () => {
  it("blocked gate → empty items", () => {
    const res = resolution({
      status: "partial",
      annualSupplementElement: "木",
      unresolvedGoals: ["CORE_SUPPORT"],
    });
    const gate = deriveAnnualPresentationGate(res, cleanContext());
    expect(gate.selectionDisplayStatus).toBe("blocked");

    const view = buildAnnualReasonsPresentation(
      baseInput({
        resolution: res,
        presentationGate: gate,
      }),
    );

    expect(view.items).toEqual([]);
  });

  it("presentationElement=null → empty items", () => {
    const view = buildAnnualReasonsPresentation(
      baseInput({
        presentationGate: {
          showAnnualElement: false,
          showAnnualMusic: false,
          presentationElement: null,
          state: "partial",
          selectionDisplayStatus: "blocked",
          reasons: [],
        },
      }),
    );
    expect(view.items).toEqual([]);
  });
});

describe("buildAnnualReasonsPresentation — resolved vs partial", () => {
  it("resolved → max 2 items, no climate notice", () => {
    const res = resolution({
      status: "resolved",
      annualSupplementElement: "木",
    });
    const gate = deriveAnnualPresentationGate(res, cleanContext());

    const natalGoals: NatalDeficitGoal[] = [
      {
        kind: "INCOMING_MEDIATION",
        targetElement: "火",
        sourceFunctions: ["F6_INCOMING_MEDIATION"],
        sourceElement: "木",
        methods: ["corridor-mid"],
        reasons: [],
      },
    ];

    const view = buildAnnualReasonsPresentation(
      baseInput({
        resolution: res,
        presentationGate: gate,
        natalGoals,
        winnerInput: {
          candidates: [
            candidate("木", {
              residualGoalsAddressed: ["INCOMING_MEDIATION"],
              evidenceQuality: "structural-mediation",
            }),
          ],
          openGoals: [],
          openImbalances: [],
        },
        imbalances: [
          {
            kind: "CLIMATE_REINFORCEMENT_RISK",
            origin: "new-annual",
            evidence: ["climate-risk:warm-or-dry"],
          },
        ],
      }),
    );

    expect(view.items.length).toBeLessThanOrEqual(2);
    expect(categories(view.items)).not.toContain("CLIMATE_NOTICE");
  });

  it("displayable-partial adds climate notice when imbalance remains", () => {
    const res = resolution({
      status: "partial",
      annualSupplementElement: "木",
      unresolvedImbalances: ["NEW_CLIMATE_IMBALANCE"],
    });
    const gate = deriveAnnualPresentationGate(res, cleanContext());
    expect(gate.selectionDisplayStatus).toBe("displayable-partial");

    const view = buildAnnualReasonsPresentation(
      baseInput({
        resolution: res,
        presentationGate: gate,
        natalGoals: [
          {
            kind: "INCOMING_MEDIATION",
            targetElement: "火",
            sourceFunctions: ["F6_INCOMING_MEDIATION"],
            sourceElement: "木",
            methods: ["corridor-mid"],
            reasons: [],
          },
        ],
        winnerInput: {
          candidates: [
            candidate("木", {
              residualGoalsAddressed: ["INCOMING_MEDIATION"],
              evidenceQuality: "structural-mediation",
            }),
          ],
          openGoals: [],
          openImbalances: ["NEW_CLIMATE_IMBALANCE"],
        },
        imbalances: [
          {
            kind: "CLIMATE_REINFORCEMENT_RISK",
            origin: "new-annual",
            evidence: ["climate-risk:warm-or-dry"],
          },
        ],
      }),
    );

    expect(view.items.length).toBeLessThanOrEqual(3);
    expect(categories(view.items)).toContain("CLIMATE_NOTICE");
  });
});

describe("buildAnnualReasonsPresentation — category rules", () => {
  it("CORE_ANNUAL_RELATION when partially-met and no structural duplicate", () => {
    const goalSatisfactions: AnnualGoalSatisfaction[] = [
      {
        goal: "CORE_SUPPORT",
        status: "partially-met",
        satisfyingMethods: ["same-to-core"],
        signalCoherence: "coherent",
        reasons: [],
      },
    ];

    const view = buildAnnualReasonsPresentation(
      baseInput({ goalSatisfactions, natalGoals: [] }),
    );

    expect(categories(view.items)).toContain("CORE_ANNUAL_RELATION");
    expect(view.items.find((item) => item.category === "CORE_ANNUAL_RELATION")?.text).toBe(
      "올해 들어온 불의 기운이 기본 흐름을 일부 보태고 있어요.",
    );
  });

  it("STRUCTURAL beats BASELINE when both qualify", () => {
    const natalGoals: NatalDeficitGoal[] = [
      {
        kind: "CORE_SUPPORT",
        targetElement: "火",
        sourceFunctions: ["F2_GENERATIVE"],
        sourceElement: "木",
        methods: ["generative"],
        reasons: [],
      },
      {
        kind: "INCOMING_MEDIATION",
        targetElement: "火",
        sourceFunctions: ["F6_INCOMING_MEDIATION"],
        sourceElement: "木",
        methods: ["corridor-mid"],
        reasons: [],
      },
    ];

    const view = buildAnnualReasonsPresentation(
      baseInput({
        natalGoals,
        winnerInput: {
          candidates: [
            candidate("木", {
              residualGoalsAddressed: ["INCOMING_MEDIATION", "CORE_SUPPORT"],
              evidenceQuality: "generative",
            }),
          ],
          openGoals: [],
          openImbalances: [],
        },
      }),
    );

    expect(categories(view.items)).toContain("STRUCTURAL_CONNECTION");
    expect(categories(view.items)).not.toContain("BASELINE_SUPPORT");
    expect(categories(view.items)).not.toContain("CORE_ANNUAL_RELATION");
  });

  it("no structural corridor → no STRUCTURAL_CONNECTION", () => {
    const view = buildAnnualReasonsPresentation(
      baseInput({
        natalGoals: [
          {
            kind: "CORE_SUPPORT",
            targetElement: "火",
            sourceFunctions: ["F2_GENERATIVE"],
            sourceElement: "木",
            methods: ["generative"],
            reasons: [],
          },
        ],
        winnerInput: {
          candidates: [candidate("木", { residualGoalsAddressed: ["CORE_SUPPORT"] })],
          openGoals: [],
          openImbalances: [],
        },
      }),
    );

    expect(categories(view.items)).not.toContain("STRUCTURAL_CONNECTION");
    expect(categories(view.items)).toContain("BASELINE_SUPPORT");
  });

  it("SUPPLEMENT_ANNUAL_OFFSET omitted when higher-priority reasons fill partial quota", () => {
    const policies = inactivePolicies().map((row) =>
      row.element === "木"
        ? {
            ...row,
            state: "ACTIVE" as const,
            positiveFunctions: ["A3_SUPPLEMENT_OFFSET" as const],
          }
        : row,
    );

    const partialRes = resolution({
      status: "partial",
      annualSupplementElement: "木",
      unresolvedImbalances: ["NEW_CLIMATE_IMBALANCE"],
    });

    const view = buildAnnualReasonsPresentation(
      baseInput({
        candidatePolicies: policies,
        imbalances: [
          {
            kind: "CLIMATE_REINFORCEMENT_RISK",
            origin: "new-annual",
            evidence: ["climate-risk:warm-or-dry"],
          },
          {
            kind: "SUPPLEMENT_DRAIN_SHIFT",
            origin: "new-annual",
            evidence: ["drain:natal-supplement=木"],
          },
        ],
        natalGoals: [
          {
            kind: "INCOMING_MEDIATION",
            targetElement: "火",
            sourceFunctions: ["F6_INCOMING_MEDIATION"],
            sourceElement: "木",
            methods: ["corridor-mid"],
            reasons: [],
          },
        ],
        winnerInput: {
          candidates: [
            candidate("木", {
              residualGoalsAddressed: ["INCOMING_MEDIATION"],
              evidenceQuality: "structural-mediation",
            }),
          ],
          openGoals: [],
          openImbalances: ["NEW_CLIMATE_IMBALANCE"],
        },
        resolution: partialRes,
        presentationGate: deriveAnnualPresentationGate(partialRes, cleanContext()),
      }),
    );

    expect(categories(view.items)).not.toContain("SUPPLEMENT_ANNUAL_OFFSET");
    expect(view.items.length).toBeLessThanOrEqual(3);
  });
});

describe("buildAnnualReasonsPresentation — generic winners", () => {
  it("winner 水 (natal≠annual) → arrival + baseline, no structural", () => {
    const res = resolution({
      status: "resolved",
      annualSupplementElement: "水",
    });
    const gate = deriveAnnualPresentationGate(res, cleanContext());

    const view = buildAnnualReasonsPresentation(
      baseInput({
        resolution: res,
        presentationGate: gate,
        natalGoals: [
          {
            kind: "CORE_SUPPORT",
            targetElement: "火",
            sourceFunctions: ["F1_DIRECT"],
            sourceElement: "水",
            methods: ["direct"],
            reasons: [],
          },
        ],
      }),
    );

    expect(categories(view.items)).toContain("ANNUAL_ARRIVAL");
    expect(categories(view.items)).toContain("BASELINE_SUPPORT");
    expect(categories(view.items)).not.toContain("STRUCTURAL_CONNECTION");
    expect(view.items.map((item) => item.text).join("\n")).toContain(
      "물은 원래의 균형을 받쳐주는 기본 방향이기도 해요.",
    );
    expect(view.items.map((item) => item.text).join("\n")).not.toContain("물는");
    expect(view.items.length).toBeLessThanOrEqual(2);
  });

  it("topic particle 은/는 for all element Korean names", () => {
    const expected: Record<Element, string> = {
      木: "나무는",
      火: "불은",
      土: "흙은",
      金: "금은",
      水: "물은",
    };

    for (const element of ELEMENTS) {
      const res = resolution({
        status: "resolved",
        annualSupplementElement: element,
      });
      const gate = deriveAnnualPresentationGate(res, cleanContext());
      const view = buildAnnualReasonsPresentation(
        baseInput({
          resolution: res,
          presentationGate: gate,
          evidence: null,
          natalGoals: [
            {
              kind: "CORE_SUPPORT",
              targetElement: "火",
              sourceFunctions: ["F2_GENERATIVE"],
              sourceElement: element,
              methods: ["generative"],
              reasons: [],
            },
          ],
        }),
      );

      const baseline = view.items.find((item) => item.category === "BASELINE_SUPPORT");
      expect(baseline?.text).toBe(
        `${expected[element]} 원래의 균형을 받쳐주는 기본 방향이기도 해요.`,
      );
    }
  });

  it("winner 金 without corridor → arrival only when no other evidence", () => {
    const res = resolution({
      status: "resolved",
      annualSupplementElement: "金",
    });
    const gate = deriveAnnualPresentationGate(res, cleanContext());

    const view = buildAnnualReasonsPresentation(
      baseInput({
        resolution: res,
        presentationGate: gate,
        natalGoals: [],
      }),
    );

    expect(view.items).toHaveLength(1);
    expect(view.items[0]).toMatchObject({
      category: "ANNUAL_ARRIVAL",
      text: "2026년에는 불(火)의 기운이 들어와요.",
    });
  });

  it("natal supplement = annual winner → baseline only when structural absent", () => {
    const res = resolution({
      status: "resolved",
      annualSupplementElement: "木",
    });
    const gate = deriveAnnualPresentationGate(res, cleanContext());

    const view = buildAnnualReasonsPresentation(
      baseInput({
        resolution: res,
        presentationGate: gate,
        natalGoals: [
          {
            kind: "CORE_SUPPORT",
            targetElement: "火",
            sourceFunctions: ["F2_GENERATIVE"],
            sourceElement: "木",
            methods: ["generative"],
            reasons: [],
          },
        ],
      }),
    );

    expect(categories(view.items)).toEqual(["ANNUAL_ARRIVAL", "BASELINE_SUPPORT"]);
  });

  it("never exceeds 3 items", () => {
    const res = resolution({
      status: "partial",
      annualSupplementElement: "木",
      unresolvedImbalances: ["NEW_CLIMATE_IMBALANCE"],
    });
    const gate = deriveAnnualPresentationGate(res, cleanContext());

    const policies = inactivePolicies().map((row) =>
      row.element === "木"
        ? {
            ...row,
            state: "ACTIVE" as const,
            positiveFunctions: ["A3_SUPPLEMENT_OFFSET" as const],
          }
        : row,
    );

    const goalSatisfactions: AnnualGoalSatisfaction[] = [
      {
        goal: "CORE_SUPPORT",
        status: "partially-met",
        satisfyingMethods: ["same-to-core"],
        signalCoherence: "coherent",
        reasons: [],
      },
    ];

    const view = buildAnnualReasonsPresentation(
      baseInput({
        resolution: res,
        presentationGate: gate,
        candidatePolicies: policies,
        goalSatisfactions,
        imbalances: [
          {
            kind: "CLIMATE_REINFORCEMENT_RISK",
            origin: "new-annual",
            evidence: ["climate-risk:warm-or-dry"],
          },
          {
            kind: "SUPPLEMENT_DRAIN_SHIFT",
            origin: "new-annual",
            evidence: [],
          },
        ],
        natalGoals: [
          {
            kind: "CORE_SUPPORT",
            targetElement: "火",
            sourceFunctions: ["F2_GENERATIVE"],
            sourceElement: "木",
            methods: ["generative"],
            reasons: [],
          },
          {
            kind: "INCOMING_MEDIATION",
            targetElement: "火",
            sourceFunctions: ["F6_INCOMING_MEDIATION"],
            sourceElement: "木",
            methods: ["corridor-mid"],
            reasons: [],
          },
        ],
        winnerInput: {
          candidates: [
            candidate("木", {
              residualGoalsAddressed: ["INCOMING_MEDIATION", "CORE_SUPPORT"],
              evidenceQuality: "generative",
            }),
          ],
          openGoals: [],
          openImbalances: ["NEW_CLIMATE_IMBALANCE"],
        },
      }),
    );

    expect(view.items.length).toBeLessThanOrEqual(3);
    for (const item of view.items) {
      assertNoInternalLeak(item.text);
      assertNoForbiddenPhrases(item.text);
    }
  });
});

describe("buildAnnualReasonsPresentation — climate notice variants", () => {
  it("no climate imbalance → no CLIMATE_NOTICE", () => {
    const res = resolution({
      status: "partial",
      annualSupplementElement: "木",
      unresolvedImbalances: [],
    });
    const gate = deriveAnnualPresentationGate(res, cleanContext());

    const view = buildAnnualReasonsPresentation(
      baseInput({
        resolution: res,
        presentationGate: gate,
        imbalances: [],
      }),
    );

    expect(categories(view.items)).not.toContain("CLIMATE_NOTICE");
  });

  it("cold/moist climate risk → alternate notice copy", () => {
    const res = resolution({
      status: "partial",
      annualSupplementElement: "水",
      unresolvedImbalances: ["NEW_CLIMATE_IMBALANCE"],
    });
    const gate = deriveAnnualPresentationGate(res, cleanContext());

    const imbalances: AnnualImbalance[] = [
      {
        kind: "CLIMATE_REINFORCEMENT_RISK",
        origin: "new-annual",
        evidence: ["climate-risk:cold-or-moist"],
      },
    ];

    const view = buildAnnualReasonsPresentation(
      baseInput({
        resolution: res,
        presentationGate: gate,
        imbalances,
      }),
    );

    const climate = view.items.find((item) => item.category === "CLIMATE_NOTICE");
    expect(climate?.text).toBe(
      "올해는 한기와 습기의 흐름도 함께 살펴볼 필요가 있어요.",
    );
  });
});
