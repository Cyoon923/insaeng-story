import { describe, expect, it } from "vitest";
import { resolveAnnualSupplementWinnerV2 } from "@/lib/saju/luck/annual/resolveAnnualSupplementWinnerV2";
import type {
  AnnualEvidenceQuality,
  AnnualImbalanceId,
  AnnualResidualGoal,
  AnnualWinnerCandidate,
  AnnualWinnerCandidateState,
  AnnualCandidateSafety,
} from "@/lib/saju/luck/annual/types";
import type { Element } from "@/lib/saju/types";

function candidate(input: {
  element: Element;
  state?: AnnualWinnerCandidateState;
  safety?: AnnualCandidateSafety;
  goals?: AnnualResidualGoal[];
  quality?: AnnualEvidenceQuality;
}): AnnualWinnerCandidate {
  return {
    element: input.element,
    state: input.state ?? "INACTIVE",
    safety: input.safety ?? "unknown",
    residualGoalsAddressed: input.goals ?? [],
    evidenceQuality: input.quality ?? "direct",
  };
}

function permute<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    const head = items[i]!;
    const rest = items.filter((_, idx) => idx !== i);
    for (const tail of permute(rest)) {
      out.push([head, ...tail]);
    }
  }
  return out;
}

describe("resolveAnnualSupplementWinnerV2 — A–J patterns", () => {
  it("A. ACTIVE 1 → resolved when open set fully covered", () => {
    const result = resolveAnnualSupplementWinnerV2({
      year: 2026,
      openGoals: ["INCOMING_MEDIATION"],
      openImbalances: ["RESIDUAL_INCOMING_MEDIATION"],
      candidates: [
        candidate({
          element: "金",
          state: "ACTIVE",
          safety: "clean",
          goals: ["INCOMING_MEDIATION"],
          quality: "structural-mediation",
        }),
        candidate({ element: "火", state: "INACTIVE" }),
      ],
    });
    expect(result).toMatchObject({
      annualSupplementElement: "金",
      status: "resolved",
      unresolvedGoals: [],
      unresolvedImbalances: [],
    });
  });

  it("B. ACTIVE 1 + unrelated CAUTION → selection ACTIVE, CAUTION not promoted", () => {
    const result = resolveAnnualSupplementWinnerV2({
      year: 2026,
      openGoals: ["CORE_SUPPORT"],
      openImbalances: ["RESIDUAL_CORE_SUPPORT"],
      candidates: [
        candidate({
          element: "木",
          state: "ACTIVE",
          safety: "clean",
          goals: ["CORE_SUPPORT"],
          quality: "generative",
        }),
        candidate({
          element: "土",
          state: "CAUTION",
          safety: "conditional",
          goals: ["CLIMATE_MITIGATION"],
          quality: "climate-mitigation",
        }),
      ],
    });
    expect(result.annualSupplementElement).toBe("木");
    expect(result.status).toBe("resolved");
    expect(result.reasons).toEqual(
      expect.arrayContaining([expect.stringMatching(/caution-count=1/)]),
    );
    expect(result.reasons.join("\n")).not.toMatch(/selection=土/);
  });

  it("C. ACTIVE 1 + unresolved climate → partial, climate issues remain", () => {
    const result = resolveAnnualSupplementWinnerV2({
      year: 2026,
      openGoals: ["INCOMING_MEDIATION", "CLIMATE_MITIGATION"],
      openImbalances: [
        "RESIDUAL_INCOMING_MEDIATION",
        "NEW_CLIMATE_IMBALANCE",
      ],
      candidates: [
        candidate({
          element: "土",
          state: "ACTIVE",
          safety: "clean",
          goals: ["INCOMING_MEDIATION"],
          quality: "structural-mediation",
        }),
        candidate({
          element: "水",
          state: "CAUTION",
          safety: "conflicting",
          goals: ["CLIMATE_MITIGATION"],
          quality: "climate-mitigation",
        }),
      ],
    });
    expect(result).toMatchObject({
      annualSupplementElement: "土",
      status: "partial",
      unresolvedGoals: ["CLIMATE_MITIGATION"],
    });
    expect(result.unresolvedImbalances).toEqual(["NEW_CLIMATE_IMBALANCE"]);
  });

  it("D. same-goal ACTIVE 2 → stronger evidence wins", () => {
    const result = resolveAnnualSupplementWinnerV2({
      year: 2026,
      openGoals: ["CORE_SUPPORT"],
      openImbalances: ["RESIDUAL_CORE_SUPPORT"],
      candidates: [
        candidate({
          element: "火",
          state: "ACTIVE",
          safety: "clean",
          goals: ["CORE_SUPPORT"],
          quality: "generative",
        }),
        candidate({
          element: "木",
          state: "ACTIVE",
          safety: "clean",
          goals: ["CORE_SUPPORT"],
          quality: "direct",
        }),
      ],
    });
    expect(result).toMatchObject({
      annualSupplementElement: "木",
      status: "resolved",
    });
  });

  it("D2. same-goal ACTIVE 2 equal quality → unresolved", () => {
    const result = resolveAnnualSupplementWinnerV2({
      year: 2026,
      openGoals: ["CORE_SUPPORT"],
      openImbalances: ["RESIDUAL_CORE_SUPPORT"],
      candidates: [
        candidate({
          element: "火",
          state: "ACTIVE",
          safety: "clean",
          goals: ["CORE_SUPPORT"],
          quality: "direct",
        }),
        candidate({
          element: "木",
          state: "ACTIVE",
          safety: "clean",
          goals: ["CORE_SUPPORT"],
          quality: "direct",
        }),
      ],
    });
    expect(result).toMatchObject({
      annualSupplementElement: null,
      status: "unresolved",
    });
  });

  it("E. different-goal ACTIVE 2 → unresolved (no fixed goal precedence)", () => {
    const result = resolveAnnualSupplementWinnerV2({
      year: 2026,
      openGoals: ["CORE_SUPPORT", "CLIMATE_MITIGATION"],
      openImbalances: [
        "RESIDUAL_CORE_SUPPORT",
        "RESIDUAL_CLIMATE_MITIGATION",
      ],
      candidates: [
        candidate({
          element: "木",
          state: "ACTIVE",
          safety: "clean",
          goals: ["CORE_SUPPORT"],
          quality: "generative",
        }),
        candidate({
          element: "水",
          state: "ACTIVE",
          safety: "clean",
          goals: ["CLIMATE_MITIGATION"],
          quality: "climate-mitigation",
        }),
      ],
    });
    expect(result).toMatchObject({
      annualSupplementElement: null,
      status: "unresolved",
    });
    expect(result.unresolvedGoals).toEqual(
      expect.arrayContaining(["CORE_SUPPORT", "CLIMATE_MITIGATION"]),
    );
  });

  it("F. strict-superset coverage wins", () => {
    const result = resolveAnnualSupplementWinnerV2({
      year: 2026,
      openGoals: ["CORE_SUPPORT", "CLIMATE_MITIGATION"],
      openImbalances: [
        "RESIDUAL_CORE_SUPPORT",
        "RESIDUAL_CLIMATE_MITIGATION",
      ],
      candidates: [
        candidate({
          element: "金",
          state: "ACTIVE",
          safety: "clean",
          goals: ["CORE_SUPPORT"],
          quality: "direct",
        }),
        candidate({
          element: "水",
          state: "ACTIVE",
          safety: "clean",
          goals: ["CORE_SUPPORT", "CLIMATE_MITIGATION"],
          quality: "climate-mitigation",
        }),
      ],
    });
    expect(result).toMatchObject({
      annualSupplementElement: "水",
      status: "resolved",
      unresolvedGoals: [],
      unresolvedImbalances: [],
    });
  });

  it("G. CAUTION only → unresolved, no promotion", () => {
    const result = resolveAnnualSupplementWinnerV2({
      year: 2026,
      openGoals: ["CLIMATE_MITIGATION"],
      openImbalances: ["NEW_CLIMATE_IMBALANCE"],
      candidates: [
        candidate({
          element: "水",
          state: "CAUTION",
          safety: "conflicting",
          goals: ["CLIMATE_MITIGATION"],
          quality: "climate-mitigation",
        }),
      ],
    });
    expect(result).toMatchObject({
      annualSupplementElement: null,
      status: "unresolved",
    });
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        "unresolved:no-clean-active",
        "caution-not-promoted-to-winner",
      ]),
    );
  });

  it("H. ACTIVE 0 → unresolved", () => {
    const result = resolveAnnualSupplementWinnerV2({
      year: 2026,
      openGoals: ["CORE_SUPPORT"],
      openImbalances: ["RESIDUAL_CORE_SUPPORT"],
      candidates: [
        candidate({ element: "木", state: "INACTIVE" }),
        candidate({ element: "火", state: "INACTIVE" }),
      ],
    });
    expect(result).toMatchObject({
      annualSupplementElement: null,
      status: "unresolved",
      unresolvedGoals: ["CORE_SUPPORT"],
    });
  });

  it("I. structural ACTIVE + climate CAUTION → partial (generic elements)", () => {
    const result = resolveAnnualSupplementWinnerV2({
      year: 2026,
      openGoals: ["INCOMING_MEDIATION", "CLIMATE_MITIGATION"],
      openImbalances: [
        "RESIDUAL_INCOMING_MEDIATION",
        "NEW_CLIMATE_IMBALANCE",
      ],
      candidates: [
        candidate({
          element: "金",
          state: "ACTIVE",
          safety: "clean",
          goals: ["INCOMING_MEDIATION"],
          quality: "structural-mediation",
        }),
        candidate({
          element: "火",
          state: "CAUTION",
          safety: "conflicting",
          goals: ["CLIMATE_MITIGATION"],
          quality: "climate-mitigation",
        }),
      ],
    });
    expect(result.annualSupplementElement).toBe("金");
    expect(result.status).toBe("partial");
    expect(result.unresolvedGoals).toEqual(["CLIMATE_MITIGATION"]);
    expect(result.unresolvedImbalances).toEqual(["NEW_CLIMATE_IMBALANCE"]);
  });

  it("J. climate ACTIVE + structural open → selection climate, structural issues remain", () => {
    const result = resolveAnnualSupplementWinnerV2({
      year: 2026,
      openGoals: ["INCOMING_MEDIATION", "CLIMATE_MITIGATION"],
      openImbalances: [
        "RESIDUAL_INCOMING_MEDIATION",
        "RESIDUAL_CLIMATE_MITIGATION",
      ],
      candidates: [
        candidate({
          element: "水",
          state: "ACTIVE",
          safety: "clean",
          goals: ["CLIMATE_MITIGATION"],
          quality: "climate-mitigation",
        }),
        candidate({
          element: "木",
          state: "CAUTION",
          safety: "conditional",
          goals: ["INCOMING_MEDIATION"],
          quality: "structural-mediation",
        }),
      ],
    });
    expect(result).toMatchObject({
      annualSupplementElement: "水",
      status: "partial",
      unresolvedGoals: ["INCOMING_MEDIATION"],
    });
    expect(result.unresolvedImbalances).toEqual([
      "RESIDUAL_INCOMING_MEDIATION",
    ]);
  });
});

describe("resolveAnnualSupplementWinnerV2 — 2026 representative structure", () => {
  it("structural clean ACTIVE + climate CAUTION → partial (木/水 instance, not hardcoded preference)", () => {
    const result = resolveAnnualSupplementWinnerV2({
      year: 2026,
      openGoals: ["INCOMING_MEDIATION", "CLIMATE_MITIGATION"],
      openImbalances: [
        "RESIDUAL_INCOMING_MEDIATION",
        "NEW_CLIMATE_IMBALANCE",
      ],
      candidates: [
        candidate({
          element: "木",
          state: "ACTIVE",
          safety: "clean",
          goals: ["INCOMING_MEDIATION"],
          quality: "structural-mediation",
        }),
        candidate({
          element: "水",
          state: "CAUTION",
          safety: "conflicting",
          goals: ["CLIMATE_MITIGATION"],
          quality: "climate-mitigation",
        }),
        candidate({ element: "火", state: "INACTIVE" }),
        candidate({ element: "土", state: "INACTIVE" }),
        candidate({ element: "金", state: "INACTIVE" }),
      ],
    });
    expect(result.annualSupplementElement).toBe("木");
    expect(result.status).toBe("partial");
    expect(result.unresolvedGoals).toContain("CLIMATE_MITIGATION");
    expect(result.unresolvedImbalances).toContain("NEW_CLIMATE_IMBALANCE");
  });

  it("same structure with swapped element labels still selects structural ACTIVE", () => {
    const result = resolveAnnualSupplementWinnerV2({
      year: 2026,
      openGoals: ["INCOMING_MEDIATION", "CLIMATE_MITIGATION"],
      openImbalances: [
        "RESIDUAL_INCOMING_MEDIATION",
        "NEW_CLIMATE_IMBALANCE",
      ],
      candidates: [
        candidate({
          element: "土",
          state: "ACTIVE",
          safety: "clean",
          goals: ["INCOMING_MEDIATION"],
          quality: "structural-mediation",
        }),
        candidate({
          element: "火",
          state: "CAUTION",
          safety: "conflicting",
          goals: ["CLIMATE_MITIGATION"],
          quality: "climate-mitigation",
        }),
      ],
    });
    expect(result.annualSupplementElement).toBe("土");
    expect(result.status).toBe("partial");
  });
});

describe("resolveAnnualSupplementWinnerV2 — safety / pool gates", () => {
  it("ACTIVE but safety≠clean is excluded from pool", () => {
    const result = resolveAnnualSupplementWinnerV2({
      year: 2026,
      openGoals: ["CLIMATE_MITIGATION"],
      openImbalances: ["RESIDUAL_CLIMATE_MITIGATION"],
      candidates: [
        candidate({
          element: "水",
          state: "ACTIVE",
          safety: "conflicting",
          goals: ["CLIMATE_MITIGATION"],
          quality: "climate-mitigation",
        }),
      ],
    });
    expect(result).toMatchObject({
      annualSupplementElement: null,
      status: "unresolved",
    });
  });

  it("duplicate CORE_SUPPORT goals on one candidate count as one coverage slot", () => {
    const result = resolveAnnualSupplementWinnerV2({
      year: 2026,
      openGoals: ["CORE_SUPPORT", "CLIMATE_MITIGATION"],
      openImbalances: [
        "RESIDUAL_CORE_SUPPORT",
        "RESIDUAL_CLIMATE_MITIGATION",
      ],
      candidates: [
        candidate({
          element: "火",
          state: "ACTIVE",
          safety: "clean",
          // same goal listed twice must not fake multi-coverage
          goals: ["CORE_SUPPORT", "CORE_SUPPORT"],
          quality: "direct",
        }),
        candidate({
          element: "水",
          state: "ACTIVE",
          safety: "clean",
          goals: ["CLIMATE_MITIGATION"],
          quality: "climate-mitigation",
        }),
      ],
    });
    expect(result.status).toBe("unresolved");
    expect(result.annualSupplementElement).toBeNull();
  });
});

describe("resolveAnnualSupplementWinnerV2 — permutation stability", () => {
  it("no array-order tie-break for different-goal ACTIVE pair", () => {
    const a = candidate({
      element: "木",
      state: "ACTIVE",
      safety: "clean",
      goals: ["CORE_SUPPORT"],
      quality: "generative",
    });
    const b = candidate({
      element: "水",
      state: "ACTIVE",
      safety: "clean",
      goals: ["CLIMATE_MITIGATION"],
      quality: "climate-mitigation",
    });
    const openGoals: AnnualResidualGoal[] = [
      "CORE_SUPPORT",
      "CLIMATE_MITIGATION",
    ];
    const openImbalances: AnnualImbalanceId[] = [
      "RESIDUAL_CORE_SUPPORT",
      "RESIDUAL_CLIMATE_MITIGATION",
    ];

    for (const candidates of permute([a, b])) {
      const result = resolveAnnualSupplementWinnerV2({
        year: 2026,
        candidates,
        openGoals,
        openImbalances,
      });
      expect(result.status).toBe("unresolved");
      expect(result.annualSupplementElement).toBeNull();
    }
  });

  it("strict-superset winner stable under permutation", () => {
    const narrow = candidate({
      element: "木",
      state: "ACTIVE",
      safety: "clean",
      goals: ["CORE_SUPPORT"],
      quality: "direct",
    });
    const wide = candidate({
      element: "水",
      state: "ACTIVE",
      safety: "clean",
      goals: ["CORE_SUPPORT", "CLIMATE_MITIGATION"],
      quality: "climate-mitigation",
    });
    const filler = candidate({ element: "金", state: "INACTIVE" });

    for (const candidates of permute([narrow, wide, filler])) {
      const result = resolveAnnualSupplementWinnerV2({
        year: 2026,
        candidates,
        openGoals: ["CORE_SUPPORT", "CLIMATE_MITIGATION"],
        openImbalances: [
          "RESIDUAL_CORE_SUPPORT",
          "RESIDUAL_CLIMATE_MITIGATION",
        ],
      });
      expect(result.annualSupplementElement).toBe("水");
      expect(result.status).toBe("resolved");
    }
  });

  it("same-goal quality winner stable under permutation", () => {
    const generative = candidate({
      element: "木",
      state: "ACTIVE",
      safety: "clean",
      goals: ["CORE_SUPPORT"],
      quality: "generative",
    });
    const direct = candidate({
      element: "火",
      state: "ACTIVE",
      safety: "clean",
      goals: ["CORE_SUPPORT"],
      quality: "direct",
    });

    for (const candidates of permute([generative, direct])) {
      const result = resolveAnnualSupplementWinnerV2({
        year: 2026,
        candidates,
        openGoals: ["CORE_SUPPORT"],
        openImbalances: ["RESIDUAL_CORE_SUPPORT"],
      });
      expect(result.annualSupplementElement).toBe("火");
      expect(result.status).toBe("resolved");
    }
  });
});
