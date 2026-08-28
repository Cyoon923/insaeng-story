import { describe, expect, it } from "vitest";
import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { resolveAnnualSupplementFlow } from "@/lib/saju/luck/annual/resolveAnnualSupplementFlow";
import type { AdjustedClimateSummary, Element, FourPillars } from "@/lib/saju/types";

const REP_PILLARS: FourPillars = {
  year: { stem: "辛", branch: "酉" },
  month: { stem: "乙", branch: "未" },
  day: { stem: "丙", branch: "申" },
  hour: { stem: "戊", branch: "戌" },
  hourCertainty: "confirmed",
  warnings: [],
};

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

function byState(policies: { element: Element; state: string; positiveFunctions: string[] }[]) {
  return Object.fromEntries(
    policies.map((row) => [
      row.element,
      { state: row.state, positive: row.positiveFunctions },
    ]),
  );
}

describe("resolveAnnualSupplementFlow — 2026 대표", () => {
  it("Core=火 provisional / Supp=木 → 丙午 unresolved (木 A3 vs 水 A4)", () => {
    const natalClimate = buildAdjustedClimateSummary(REP_PILLARS);
    const flow = resolveAnnualSupplementFlow({
      year: 2026,
      natalCoreElement: "火",
      natalCoreCertainty: "provisional",
      natalSupplementElement: "木",
      natalClimate,
    });

    expect(flow.target).toMatchObject({
      year: 2026,
      stem: "丙",
      branch: "午",
    });
    expect(flow.evidence).not.toBeNull();

    const map = byState(flow.policies);
    expect(map["木"]).toMatchObject({ state: "ACTIVE", positive: ["A3_SUPPLEMENT_OFFSET"] });
    expect(map["火"].state).toBe("CAUTION");
    expect(map["水"]).toMatchObject({ state: "ACTIVE", positive: ["A4_CLIMATE_MITIGATION"] });
    expect(map["土"].state).toBe("INACTIVE");
    expect(map["金"].state).toBe("INACTIVE");

    expect(flow.resolution).toMatchObject({
      year: 2026,
      annualStemBranch: "丙午",
      annualSupplementElement: null,
      status: "unresolved",
      natalCoreElement: "火",
      natalSupplementElement: "木",
    });
    expect(flow.resolution.reasons[0]).toBe("annual-scope:year-luck-only");
    expect(flow.resolution.reasons.join("\n")).not.toMatch(
      /fallback|copy-natal|natal-as-annual/i,
    );
  });
});

describe("resolveAnnualSupplementFlow — skip / edges", () => {
  it("1. Core unresolved → annual 전체 skip", () => {
    const flow = resolveAnnualSupplementFlow({
      year: 2026,
      natalCoreElement: "火",
      natalCoreCertainty: "unresolved",
      natalSupplementElement: "木",
      natalClimate: emptyClimate(),
    });
    expect(flow.target).toBeNull();
    expect(flow.evidence).toBeNull();
    expect(flow.policies).toEqual([]);
    expect(flow.resolution).toMatchObject({
      annualSupplementElement: null,
      status: "unresolved",
      natalCoreElement: "火",
      natalSupplementElement: "木",
      annualStemBranch: "",
    });
    expect(flow.resolution.reasons).toEqual(
      expect.arrayContaining([
        "annual-scope:year-luck-only",
        "flow:skip:natal-core-certainty-unresolved",
      ]),
    );
  });

  it("2. Core null → skip", () => {
    const flow = resolveAnnualSupplementFlow({
      year: 2026,
      natalCoreElement: null,
      natalCoreCertainty: "provisional",
      natalSupplementElement: "木",
      natalClimate: emptyClimate(),
    });
    expect(flow.target).toBeNull();
    expect(flow.evidence).toBeNull();
    expect(flow.policies).toEqual([]);
    expect(flow.resolution.annualSupplementElement).toBeNull();
    expect(flow.resolution.status).toBe("unresolved");
    expect(flow.resolution.reasons).toContain("flow:skip:natal-core-element-null");
  });

  it("3. ACTIVE 1개 → resolved", () => {
    // cold/moist + no natal supp → 火 A4 only ACTIVE (丙午 火 is also A5? cold/moist → 火 A4, 水 A5)
    // warm blocked: use cold/moist so 火 ACTIVE A4, 水 CAUTION A5, no A3
    const flow = resolveAnnualSupplementFlow({
      year: 2026,
      natalCoreElement: "土",
      natalCoreCertainty: "confirmed",
      natalSupplementElement: null,
      natalClimate: emptyClimate({
        temperature: { value: "cold", status: "resolved", outcome: "unchanged" },
        moisture: { value: "moist", status: "resolved", outcome: "unchanged" },
      }),
    });
    const active = flow.policies.filter((row) => row.state === "ACTIVE");
    expect(active).toHaveLength(1);
    expect(active[0]?.element).toBe("火");
    expect(flow.resolution).toMatchObject({
      annualStemBranch: "丙午",
      annualSupplementElement: "火",
      status: "resolved",
    });
  });

  it("4. ACTIVE tie → unresolved", () => {
    const flow = resolveAnnualSupplementFlow({
      year: 2026,
      natalCoreElement: "火",
      natalCoreCertainty: "provisional",
      natalSupplementElement: "木",
      natalClimate: buildAdjustedClimateSummary(REP_PILLARS),
    });
    expect(flow.resolution.status).toBe("unresolved");
    expect(flow.resolution.annualSupplementElement).toBeNull();
  });

  it("5. natalSupplement=null이어도 Core resolved면 annual 계산 가능", () => {
    const flow = resolveAnnualSupplementFlow({
      year: 2026,
      natalCoreElement: "金",
      natalCoreCertainty: "provisional",
      natalSupplementElement: null,
      natalClimate: emptyClimate({
        temperature: { value: "warm", status: "resolved", outcome: "unchanged" },
        moisture: { value: "dry", status: "resolved", outcome: "unchanged" },
      }),
    });
    expect(flow.target).not.toBeNull();
    expect(flow.evidence).not.toBeNull();
    expect(flow.policies).toHaveLength(5);
    expect(flow.resolution.natalSupplementElement).toBeNull();
    // warm/dry → 水 ACTIVE A4 only
    expect(flow.resolution.status).toBe("resolved");
    expect(flow.resolution.annualSupplementElement).toBe("水");
  });

  it("6. 2027도 동일 pipeline 동작", () => {
    const flow = resolveAnnualSupplementFlow({
      year: 2027,
      natalCoreElement: "火",
      natalCoreCertainty: "provisional",
      natalSupplementElement: "木",
      natalClimate: emptyClimate(),
    });
    expect(flow.target).toMatchObject({ year: 2027, stem: "丁", branch: "未" });
    expect(flow.resolution.year).toBe(2027);
    expect(flow.resolution.annualStemBranch).toBe("丁未");
    expect(flow.policies).toHaveLength(5);
    expect(flow.resolution.reasons[0]).toBe("annual-scope:year-luck-only");
  });
});
