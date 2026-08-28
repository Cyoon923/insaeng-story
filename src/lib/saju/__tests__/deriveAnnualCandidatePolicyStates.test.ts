import { describe, expect, it } from "vitest";
import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { buildAnnualLuckEvidence } from "@/lib/saju/luck/annual/buildAnnualLuckEvidence";
import { buildAnnualTarget } from "@/lib/saju/luck/annual/buildAnnualTarget";
import {
  deriveAnnualCandidatePolicyStates,
  type AnnualCandidatePolicy,
} from "@/lib/saju/luck/annual/deriveAnnualCandidatePolicyStates";
import type { AnnualLuckEvidence, AnnualSignal } from "@/lib/saju/luck/annual/types";
import type {
  AdjustedClimateSummary,
  ClimateMitigationOutcome,
  Element,
  FourPillars,
} from "@/lib/saju/types";

function byElement(rows: AnnualCandidatePolicy[]): Record<Element, AnnualCandidatePolicy> {
  return Object.fromEntries(rows.map((row) => [row.element, row])) as Record<
    Element,
    AnnualCandidatePolicy
  >;
}

function emptyClimate(
  over: {
    temperature?: Partial<AdjustedClimateSummary["temperature"]>;
    moisture?: Partial<AdjustedClimateSummary["moisture"]>;
  } = {},
): AdjustedClimateSummary {
  return {
    certainty: "complete",
    baseClimate: { temperature: "balanced", moisture: "balanced" },
    temperature: {
      status: "resolved",
      value: "balanced",
      outcome: "unchanged",
      ...over.temperature,
    },
    moisture: {
      status: "resolved",
      value: "balanced",
      outcome: "unchanged",
      ...over.moisture,
    },
    fireQuality: "absent",
    waterQuality: "absent",
    mitigationFactors: [],
    reinforcementFactors: [],
    conflicts: [],
    unresolvedReasons: [],
    omittedSlots: [],
  };
}

function evidenceWithSignals(
  signals: AnnualSignal[],
  year = 2026,
): AnnualLuckEvidence {
  const target = buildAnnualTarget(year);
  return {
    target,
    signals,
    climateSignals: signals.map((s) =>
      s.element === "火" ? "fire-signal" : s.element === "水" ? "water-signal" : "none",
    ),
    reasons: ["test"],
  };
}

function signal(
  partial: Pick<AnnualSignal, "source" | "element"> &
    Partial<AnnualSignal>,
): AnnualSignal {
  return {
    relationToNatalCore: "same",
    relationToNatalSupplement: null,
    ...partial,
  };
}

const REP_PILLARS: FourPillars = {
  year: { stem: "辛", branch: "酉" },
  month: { stem: "乙", branch: "未" },
  day: { stem: "丙", branch: "申" },
  hour: { stem: "戊", branch: "戌" },
  hourCertainty: "confirmed",
  warnings: [],
};

describe("deriveAnnualCandidatePolicyStates — 2026 대표", () => {
  it("Core=火 Supp=木 warm/dry → 木 ACTIVE A3, 火 CAUTION A5, 水 ACTIVE A4", () => {
    const natalClimate = buildAdjustedClimateSummary(REP_PILLARS);
    expect(natalClimate.temperature).toMatchObject({ status: "resolved", value: "warm" });
    expect(natalClimate.moisture).toMatchObject({ status: "resolved", value: "dry" });

    const evidence = buildAnnualLuckEvidence({
      target: buildAnnualTarget(2026),
      natalCoreElement: "火",
      natalSupplementElement: "木",
    });

    const map = byElement(
      deriveAnnualCandidatePolicyStates({
        evidence,
        natalCoreElement: "火",
        natalSupplementElement: "木",
        natalClimate,
      }),
    );

    expect(map["木"]).toMatchObject({
      state: "ACTIVE",
      positiveFunctions: ["A3_SUPPLEMENT_OFFSET"],
      cautionFunctions: [],
      traceFunctions: ["A1_CORE_SUPPORT"],
    });
    expect(map["火"]).toMatchObject({
      state: "CAUTION",
      positiveFunctions: [],
      cautionFunctions: ["A5_CLIMATE_REINFORCEMENT"],
      traceFunctions: ["A1_CORE_SUPPORT"],
    });
    expect(map["水"]).toMatchObject({
      state: "ACTIVE",
      positiveFunctions: ["A4_CLIMATE_MITIGATION"],
      cautionFunctions: [],
    });
    expect(map["土"].state).toBe("INACTIVE");
    expect(map["金"].state).toBe("INACTIVE");

    const blob = JSON.stringify(map);
    expect(blob).not.toMatch(/winner|tie-break|annualSupplementElement/);
  });
});

describe("deriveAnnualCandidatePolicyStates — A2/A3", () => {
  const climate = emptyClimate();

  it("1. A2 same → CAUTION on S", () => {
    const evidence = evidenceWithSignals([
      signal({
        source: "stem",
        element: "木",
        relationToNatalCore: "generates",
        relationToNatalSupplement: "same",
      }),
      signal({
        source: "branch-main",
        element: "土",
        relationToNatalCore: "generated-by",
        relationToNatalSupplement: "controlled-by",
      }),
    ]);
    const map = byElement(
      deriveAnnualCandidatePolicyStates({
        evidence,
        natalCoreElement: "火",
        natalSupplementElement: "木",
        natalClimate: climate,
      }),
    );
    expect(map["木"].cautionFunctions).toContain("A2_SUPPLEMENT_REINFORCEMENT");
    expect(map["木"].reasons.some((r) => r.includes("a2:same:"))).toBe(true);
    expect(map["木"].state).toBe("CAUTION");
  });

  it("2. A2 generates → CAUTION on S", () => {
    const evidence = evidenceWithSignals([
      signal({
        source: "stem",
        element: "水",
        relationToNatalCore: "controls",
        relationToNatalSupplement: "generates", // 水生木
      }),
      signal({
        source: "branch-main",
        element: "水",
        relationToNatalCore: "controls",
        relationToNatalSupplement: "generates",
      }),
    ]);
    const map = byElement(
      deriveAnnualCandidatePolicyStates({
        evidence,
        natalCoreElement: "火",
        natalSupplementElement: "木",
        natalClimate: climate,
      }),
    );
    expect(map["木"].cautionFunctions).toContain("A2_SUPPLEMENT_REINFORCEMENT");
    expect(map["木"].reasons.some((r) => r.includes("a2:generates:"))).toBe(true);
    expect(map["木"].state).toBe("CAUTION");
  });

  it("3. A3 annual controls S → ACTIVE", () => {
    const evidence = evidenceWithSignals([
      signal({
        source: "stem",
        element: "金",
        relationToNatalCore: "controlled-by",
        relationToNatalSupplement: "controls", // 金剋木
      }),
      signal({
        source: "branch-main",
        element: "金",
        relationToNatalCore: "controlled-by",
        relationToNatalSupplement: "controls",
      }),
    ]);
    const map = byElement(
      deriveAnnualCandidatePolicyStates({
        evidence,
        natalCoreElement: "火",
        natalSupplementElement: "木",
        natalClimate: climate,
      }),
    );
    expect(map["木"].positiveFunctions).toEqual(["A3_SUPPLEMENT_OFFSET"]);
    expect(map["木"].state).toBe("ACTIVE");
  });

  it("4. A3 S generates annual → ACTIVE", () => {
    const evidence = evidenceWithSignals([
      signal({
        source: "stem",
        element: "火",
        relationToNatalCore: "same",
        relationToNatalSupplement: "generated-by",
      }),
      signal({
        source: "branch-main",
        element: "火",
        relationToNatalCore: "same",
        relationToNatalSupplement: "generated-by",
      }),
    ]);
    const map = byElement(
      deriveAnnualCandidatePolicyStates({
        evidence,
        natalCoreElement: "火",
        natalSupplementElement: "木",
        natalClimate: climate,
      }),
    );
    expect(map["木"].positiveFunctions).toContain("A3_SUPPLEMENT_OFFSET");
    expect(map["木"].state).toBe("ACTIVE");
  });

  it("5. S controls annual → A3 아님", () => {
    const evidence = evidenceWithSignals([
      signal({
        source: "stem",
        element: "土",
        relationToNatalCore: "generated-by",
        relationToNatalSupplement: "controlled-by", // 木剋土
      }),
      signal({
        source: "branch-main",
        element: "土",
        relationToNatalCore: "generated-by",
        relationToNatalSupplement: "controlled-by",
      }),
    ]);
    const map = byElement(
      deriveAnnualCandidatePolicyStates({
        evidence,
        natalCoreElement: "火",
        natalSupplementElement: "木",
        natalClimate: climate,
      }),
    );
    expect(map["木"].positiveFunctions).not.toContain("A3_SUPPLEMENT_OFFSET");
    expect(map["木"].reasons.some((r) => r.includes("a3:not:s-controls-annual"))).toBe(true);
  });

  it("9. natalSupplement=null → A2/A3 없음", () => {
    const evidence = buildAnnualLuckEvidence({
      target: buildAnnualTarget(2026),
      natalCoreElement: "火",
      natalSupplementElement: null,
    });
    const rows = deriveAnnualCandidatePolicyStates({
      evidence,
      natalCoreElement: "火",
      natalSupplementElement: null,
      natalClimate: climate,
    });
    for (const row of rows) {
      expect(row.positiveFunctions).not.toContain("A3_SUPPLEMENT_OFFSET");
      expect(row.cautionFunctions).not.toContain("A2_SUPPLEMENT_REINFORCEMENT");
    }
  });
});

describe("deriveAnnualCandidatePolicyStates — climate A4/A5", () => {
  it("6. warm/dry → 水 A4, 火 A5", () => {
    const climate = emptyClimate({
      temperature: { value: "warm", status: "resolved", outcome: "unchanged" },
      moisture: { value: "dry", status: "resolved", outcome: "unchanged" },
    });
    const evidence = buildAnnualLuckEvidence({
      target: buildAnnualTarget(2026),
      natalCoreElement: "土",
      natalSupplementElement: null,
    });
    const map = byElement(
      deriveAnnualCandidatePolicyStates({
        evidence,
        natalCoreElement: "土",
        natalSupplementElement: null,
        natalClimate: climate,
      }),
    );
    expect(map["水"].positiveFunctions).toContain("A4_CLIMATE_MITIGATION");
    expect(map["水"].state).toBe("ACTIVE");
    expect(map["火"].cautionFunctions).toContain("A5_CLIMATE_REINFORCEMENT");
    expect(map["火"].state).toBe("CAUTION");
  });

  it("7. cold/moist → 火 A4, 水 A5", () => {
    const climate = emptyClimate({
      temperature: { value: "cold", status: "resolved", outcome: "unchanged" },
      moisture: { value: "moist", status: "resolved", outcome: "unchanged" },
    });
    const evidence = buildAnnualLuckEvidence({
      target: buildAnnualTarget(2026),
      natalCoreElement: "土",
      natalSupplementElement: null,
    });
    const map = byElement(
      deriveAnnualCandidatePolicyStates({
        evidence,
        natalCoreElement: "土",
        natalSupplementElement: null,
        natalClimate: climate,
      }),
    );
    expect(map["火"].positiveFunctions).toContain("A4_CLIMATE_MITIGATION");
    expect(map["火"].state).toBe("ACTIVE");
    expect(map["水"].cautionFunctions).toContain("A5_CLIMATE_REINFORCEMENT");
    expect(map["水"].state).toBe("CAUTION");
  });

  it.each([
    "partially-mitigated",
    "mitigation-reinforcement-conflict",
    "unresolved",
  ] as ClimateMitigationOutcome[])("8. climate outcome %s → A4/A5 blocked", (outcome) => {
    const climate = emptyClimate({
      temperature: { value: "warm", status: "resolved", outcome },
      moisture: { value: "dry", status: "resolved", outcome: "unchanged" },
    });
    const evidence = buildAnnualLuckEvidence({
      target: buildAnnualTarget(2026),
      natalCoreElement: "土",
      natalSupplementElement: null,
    });
    const map = byElement(
      deriveAnnualCandidatePolicyStates({
        evidence,
        natalCoreElement: "土",
        natalSupplementElement: null,
        natalClimate: climate,
      }),
    );
    expect(map["水"].positiveFunctions).not.toContain("A4_CLIMATE_MITIGATION");
    expect(map["火"].cautionFunctions).not.toContain("A5_CLIMATE_REINFORCEMENT");
  });
});

describe("deriveAnnualCandidatePolicyStates — A1 only INACTIVE", () => {
  it("10. A1 only → INACTIVE", () => {
    const climate = emptyClimate();
    const evidence = evidenceWithSignals([
      signal({
        source: "stem",
        element: "金",
        relationToNatalCore: "controlled-by",
        relationToNatalSupplement: null,
      }),
      signal({
        source: "branch-main",
        element: "金",
        relationToNatalCore: "controlled-by",
        relationToNatalSupplement: null,
      }),
    ]);
    const map = byElement(
      deriveAnnualCandidatePolicyStates({
        evidence,
        natalCoreElement: "火",
        natalSupplementElement: null,
        natalClimate: climate,
      }),
    );
    // 木 generates 火 → A1 trace only
    expect(map["木"].traceFunctions).toEqual(["A1_CORE_SUPPORT"]);
    expect(map["木"].positiveFunctions).toEqual([]);
    expect(map["木"].cautionFunctions).toEqual([]);
    expect(map["木"].state).toBe("INACTIVE");
  });
});
