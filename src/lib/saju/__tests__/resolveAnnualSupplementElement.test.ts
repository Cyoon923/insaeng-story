import { describe, expect, it } from "vitest";
import type {
  AnnualCandidatePolicy,
  AnnualCandidateState,
  AnnualFunction,
} from "@/lib/saju/luck/annual/deriveAnnualCandidatePolicyStates";
import { resolveAnnualSupplementElement } from "@/lib/saju/luck/annual/resolveAnnualSupplementElement";
import type { Element } from "@/lib/saju/types";

function policy(
  element: Element,
  state: AnnualCandidateState,
  positive: AnnualFunction[] = [],
  caution: AnnualFunction[] = [],
  trace: AnnualFunction[] = [],
): AnnualCandidatePolicy {
  return {
    element,
    state,
    positiveFunctions: positive,
    cautionFunctions: caution,
    traceFunctions: trace,
    reasons: [],
  };
}

function five(rows: AnnualCandidatePolicy[]): AnnualCandidatePolicy[] {
  const by = Object.fromEntries(rows.map((row) => [row.element, row]));
  const elements: Element[] = ["木", "火", "土", "金", "水"];
  return elements.map(
    (element) =>
      by[element] ??
      policy(element, "INACTIVE"),
  );
}

describe("resolveAnnualSupplementElement — 2026 대표", () => {
  it("木 A3-only vs 水 A4-only → unresolved (A1 unused)", () => {
    const policies = five([
      policy("木", "ACTIVE", ["A3_SUPPLEMENT_OFFSET"], [], ["A1_CORE_SUPPORT"]),
      policy("火", "CAUTION", [], ["A5_CLIMATE_REINFORCEMENT"], ["A1_CORE_SUPPORT"]),
      policy("水", "ACTIVE", ["A4_CLIMATE_MITIGATION"]),
    ]);
    const result = resolveAnnualSupplementElement({ year: 2026, policies });
    expect(result).toMatchObject({
      annualSupplementElement: null,
      status: "unresolved",
    });
    expect(result.reasons).toEqual(
      expect.arrayContaining(["unresolved:a3-only-vs-a4-only-peer"]),
    );
    expect(result.reasons.join("\n")).not.toMatch(/a1|tie-break-a1|natal|core-auto/i);
  });
});

describe("resolveAnnualSupplementElement — winner rules", () => {
  it("1. ACTIVE 1개 → resolved", () => {
    const result = resolveAnnualSupplementElement({
      year: 2026,
      policies: five([policy("金", "ACTIVE", ["A3_SUPPLEMENT_OFFSET"])]),
    });
    expect(result).toMatchObject({
      annualSupplementElement: "金",
      status: "resolved",
    });
  });

  it("2. ACTIVE 0개 → unresolved, CAUTION 승격 금지", () => {
    const result = resolveAnnualSupplementElement({
      year: 2026,
      policies: five([
        policy("火", "CAUTION", [], ["A5_CLIMATE_REINFORCEMENT"]),
        policy("水", "CAUTION", [], ["A2_SUPPLEMENT_REINFORCEMENT"]),
      ]),
    });
    expect(result.annualSupplementElement).toBeNull();
    expect(result.status).toBe("unresolved");
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        "unresolved:no-active",
        "caution-not-promoted-to-winner",
      ]),
    );
  });

  it("3. A3-only vs A4-only → unresolved", () => {
    const result = resolveAnnualSupplementElement({
      year: 2026,
      policies: five([
        policy("木", "ACTIVE", ["A3_SUPPLEMENT_OFFSET"]),
        policy("水", "ACTIVE", ["A4_CLIMATE_MITIGATION"]),
      ]),
    });
    expect(result).toMatchObject({
      annualSupplementElement: null,
      status: "unresolved",
    });
  });

  it("4. A3+A4 vs A3-only → composite resolved", () => {
    const result = resolveAnnualSupplementElement({
      year: 2026,
      policies: five([
        policy("木", "ACTIVE", ["A3_SUPPLEMENT_OFFSET", "A4_CLIMATE_MITIGATION"]),
        policy("金", "ACTIVE", ["A3_SUPPLEMENT_OFFSET"]),
      ]),
    });
    expect(result).toMatchObject({
      annualSupplementElement: "木",
      status: "resolved",
    });
    expect(result.reasons.some((r) => r.includes("tie-break-a3-and-a4=木"))).toBe(true);
  });

  it("5. A3+A4 vs A4-only → composite resolved", () => {
    const result = resolveAnnualSupplementElement({
      year: 2026,
      policies: five([
        policy("水", "ACTIVE", ["A3_SUPPLEMENT_OFFSET", "A4_CLIMATE_MITIGATION"]),
        policy("火", "ACTIVE", ["A4_CLIMATE_MITIGATION"]),
      ]),
    });
    expect(result).toMatchObject({
      annualSupplementElement: "水",
      status: "resolved",
    });
  });

  it("6. A3+A4 후보 2개 → unresolved", () => {
    const result = resolveAnnualSupplementElement({
      year: 2026,
      policies: five([
        policy("木", "ACTIVE", ["A3_SUPPLEMENT_OFFSET", "A4_CLIMATE_MITIGATION"]),
        policy("水", "ACTIVE", ["A3_SUPPLEMENT_OFFSET", "A4_CLIMATE_MITIGATION"]),
      ]),
    });
    expect(result).toMatchObject({
      annualSupplementElement: null,
      status: "unresolved",
    });
    expect(result.reasons.some((r) => r.includes("multiple-a3-and-a4"))).toBe(true);
  });

  it("7. CAUTION-only → unresolved", () => {
    const result = resolveAnnualSupplementElement({
      year: 2026,
      policies: five([
        policy("火", "CAUTION", [], ["A5_CLIMATE_REINFORCEMENT"], ["A1_CORE_SUPPORT"]),
      ]),
    });
    expect(result).toMatchObject({
      annualSupplementElement: null,
      status: "unresolved",
    });
  });

  it("8. A1 trace 차이가 있어도 tie 깨지 않음", () => {
    const result = resolveAnnualSupplementElement({
      year: 2026,
      policies: five([
        policy("木", "ACTIVE", ["A3_SUPPLEMENT_OFFSET"], [], ["A1_CORE_SUPPORT"]),
        policy("水", "ACTIVE", ["A4_CLIMATE_MITIGATION"], [], []),
      ]),
    });
    expect(result.annualSupplementElement).toBeNull();
    expect(result.status).toBe("unresolved");
    expect(result.reasons.join(" ")).not.toMatch(/a1|trace-break/i);
  });
});
