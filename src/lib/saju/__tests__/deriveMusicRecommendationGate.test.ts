import { describe, expect, it } from "vitest";
import { deriveMusicRecommendationGate } from "@/lib/saju/music/deriveMusicRecommendationGate";
import type { FreeInterpretation } from "@/lib/saju/interpretation/types";
import type {
  ClimateCertainty,
  NeedCandidate,
  NeedResolution,
  StrengthCertainty,
} from "@/lib/saju/types";

function candidate(
  partial: Partial<NeedCandidate> & Pick<NeedCandidate, "element" | "source">,
): NeedCandidate {
  return {
    reasons: [],
    direction: partial.source === "climate" ? "climate" : "resource",
    existingPresence: "absent",
    alreadyPresent: false,
    certainty: "complete",
    status: "candidate",
    evidenceRefs: [],
    boundary: null,
    ...partial,
  };
}

function emptyNeed(overrides: Partial<NeedResolution> = {}): NeedResolution {
  return {
    status: "indeterminate",
    relationPattern: "no-candidates",
    supportedElements: [],
    singleAxisElements: [],
    strengthOnlyElements: [],
    climateOnlyElements: [],
    competingElementsByAxis: { strength: [], climate: [] },
    deferredElements: [],
    suppressedSharedElements: [],
    counterSignals: [],
    elementStates: [],
    strengthAxisStatus: "unresolved",
    climateAxisStatus: "unresolved",
    certainty: { strength: "complete" as StrengthCertainty, climate: "complete" as ClimateCertainty },
    policyGaps: [],
    decisionBlockedBy: [],
    reasons: [],
    originalStrengthCandidates: [],
    originalClimateCandidates: [],
    ...overrides,
  };
}

function freeOf(partial: Partial<FreeInterpretation> = {}): FreeInterpretation {
  return {
    headline: "테스트",
    explanation: null,
    supportItems: [],
    cautionItems: [],
    climateNotes: [],
    uncertaintyNotes: [],
    ...partial,
  };
}

/** Chart A/B shared Need shape: climate-only 水 contested + strength unresolved. */
function climateOnlyWaterNeed(): NeedResolution {
  const water = candidate({
    element: "水",
    source: "climate",
    boundary: "contested-inherited",
    direction: "climate",
  });
  return emptyNeed({
    status: "single-axis",
    relationPattern: "climate-only",
    climateOnlyElements: [water],
    singleAxisElements: [water],
    decisionBlockedBy: ["strength-axis-unresolved", "climate-need-contested-inherited"],
    climateAxisStatus: "ready",
    originalClimateCandidates: [water],
  });
}

describe("deriveMusicRecommendationGate — A/B climate-only contested", () => {
  it("A/B: never DIRECT; CONTEXTUAL with contextualElements=[水]", () => {
    const need = climateOnlyWaterNeed();
    const free = freeOf({
      climateNotes: [
        {
          text: "물 참고",
          element: "水",
          stance: "tentative",
          origin: "climate-context",
        },
      ],
    });

    for (const label of ["A", "B"] as const) {
      const gate = deriveMusicRecommendationGate({
        needResolution: need,
        freeInterpretation: free,
        hourUnknown: false,
      });
      expect(gate.state, label).not.toBe("DIRECT");
      expect(gate.state, label).toBe("CONTEXTUAL");
      expect(gate.elementMode, label).toBe("context-soft");
      expect(gate.supportedElements, label).toEqual([]);
      expect(gate.contextualElements, label).toEqual(["水"]);
      expect(gate.reasons.join(" "), label).toContain("context-soft");
    }
  });
});

describe("deriveMusicRecommendationGate — core states", () => {
  it("supported + no blockers + open-candidate → DIRECT", () => {
    const wood = candidate({ element: "木", source: "strength", direction: "resource" });
    const gate = deriveMusicRecommendationGate({
      needResolution: emptyNeed({
        status: "single-axis",
        relationPattern: "strength-only",
        supportedElements: [{ element: "木", supports: [wood] }],
        strengthOnlyElements: [wood],
        singleAxisElements: [wood],
        strengthAxisStatus: "ready",
        decisionBlockedBy: [],
      }),
      freeInterpretation: freeOf({
        supportItems: [
          {
            text: "나무 후보",
            element: "木",
            stance: "open-candidate",
            origin: "strength-support",
          },
        ],
      }),
      hourUnknown: false,
    });

    expect(gate).toMatchObject({
      state: "DIRECT",
      elementMode: "supported-soft",
      supportedElements: ["木"],
      contextualElements: [],
    });
  });

  it("supported + hour unknown → PROVISIONAL", () => {
    const water = candidate({ element: "水", source: "strength", direction: "resource" });
    const gate = deriveMusicRecommendationGate({
      needResolution: emptyNeed({
        status: "single-axis",
        relationPattern: "strength-only",
        supportedElements: [{ element: "水", supports: [water] }],
        strengthOnlyElements: [water],
        singleAxisElements: [water],
        strengthAxisStatus: "ready",
        certainty: { strength: "partial", climate: "complete" },
        decisionBlockedBy: [],
      }),
      freeInterpretation: freeOf({
        supportItems: [
          {
            text: "물 후보",
            element: "水",
            stance: "open-candidate",
            origin: "strength-support",
          },
        ],
      }),
      hourUnknown: true,
      hourUnknownProvisional: true,
    });

    expect(gate.state).toBe("PROVISIONAL");
    expect(gate.elementMode).toBe("supported-soft");
    expect(gate.supportedElements).toEqual(["水"]);
  });

  it("competing / indeterminate → HOLD", () => {
    const competing = deriveMusicRecommendationGate({
      needResolution: emptyNeed({
        status: "competing",
        relationPattern: "disjoint",
        decisionBlockedBy: ["competing-axes"],
        competingElementsByAxis: {
          strength: [candidate({ element: "木", source: "strength" })],
          climate: [candidate({ element: "水", source: "climate" })],
        },
      }),
    });
    expect(competing.state).toBe("HOLD");
    expect(competing.elementMode).toBe("off");
    expect(competing.contextualElements).toEqual([]);

    const indeterminate = deriveMusicRecommendationGate({
      needResolution: emptyNeed({
        status: "indeterminate",
        decisionBlockedBy: ["strength-axis-unresolved", "no-active-climate-need"],
      }),
    });
    expect(indeterminate.state).toBe("HOLD");
    expect(indeterminate.elementMode).toBe("off");
  });

  it("deferred-only → never DIRECT, ends HOLD", () => {
    const deferred = candidate({ element: "木", source: "strength", direction: "resource" });
    const gate = deriveMusicRecommendationGate({
      needResolution: emptyNeed({
        status: "indeterminate",
        relationPattern: "strength-only",
        deferredElements: [deferred],
        decisionBlockedBy: ["deferred-strength-only-element"],
      }),
      freeInterpretation: freeOf({
        supportItems: [
          {
            text: "보류",
            element: "木",
            stance: "held-aside",
            origin: "strength-support",
          },
        ],
      }),
    });

    expect(gate.state).not.toBe("DIRECT");
    expect(gate.state).toBe("HOLD");
    expect(gate.supportedElements).toEqual([]);
    expect(gate.reasons.some((reason) => reason.includes("deferred"))).toBe(true);
  });

  it("does not promote cautionItems elements into supported/contextual bags", () => {
    const gate = deriveMusicRecommendationGate({
      needResolution: emptyNeed({
        status: "indeterminate",
        decisionBlockedBy: ["strength-axis-unresolved", "no-active-climate-need"],
      }),
      freeInterpretation: freeOf({
        cautionItems: [
          {
            text: "주의",
            element: "金",
            stance: "open-candidate",
            origin: "strength-caution",
          },
        ],
      }),
    });

    expect(gate.supportedElements).not.toContain("金");
    expect(gate.contextualElements).not.toContain("金");
    expect(gate.state).toBe("HOLD");
  });

  it("contested supported does not become PROVISIONAL", () => {
    const water = candidate({
      element: "水",
      source: "climate",
      boundary: "contested-inherited",
    });
    const gate = deriveMusicRecommendationGate({
      needResolution: emptyNeed({
        status: "single-axis",
        relationPattern: "climate-only",
        supportedElements: [{ element: "水", supports: [water] }],
        climateOnlyElements: [water],
        decisionBlockedBy: ["climate-need-contested-inherited"],
      }),
      hourUnknown: true,
    });

    expect(gate.state).not.toBe("PROVISIONAL");
    expect(gate.state).not.toBe("DIRECT");
    expect(gate.state).toBe("HOLD");
  });
});
