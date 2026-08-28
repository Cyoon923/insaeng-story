import { describe, expect, it } from "vitest";
import { lichunInstant } from "@/lib/saju/calendar/solarTerms";
import {
  buildAnnualTarget,
  solarInstantToUtcDate,
} from "@/lib/saju/luck/annual/buildAnnualTarget";
import {
  buildAnnualLuckEvidence,
  relationFromTo,
} from "@/lib/saju/luck/annual/buildAnnualLuckEvidence";
import type { Element } from "@/lib/saju/types";

describe("buildAnnualTarget", () => {
  it("2026 → 丙午 with lichun-kst window", () => {
    const target = buildAnnualTarget(2026);
    expect(target.luckKind).toBe("annual-year");
    expect(target.year).toBe(2026);
    expect(target.stem).toBe("丙");
    expect(target.branch).toBe("午");
    expect(target.stemElement).toBe("火");
    expect(target.branchMainElement).toBe("火");
    expect(target.boundaryBasis).toBe("lichun-kst");
    expect(target.windowStart.getTime()).toBe(
      solarInstantToUtcDate(lichunInstant(2026)).getTime(),
    );
    expect(target.windowEnd.getTime()).toBe(
      solarInstantToUtcDate(lichunInstant(2027)).getTime(),
    );
  });

  it("2027 stem/branch ganzhi", () => {
    const target = buildAnnualTarget(2027);
    expect(target.year).toBe(2027);
    expect(target.stem).toBe("丁");
    expect(target.branch).toBe("未");
    expect(target.stemElement).toBe("火");
    expect(target.branchMainElement).toBe("土");
  });

  it("window continuity: year N windowEnd === year N+1 windowStart", () => {
    for (const year of [2025, 2026, 2027, 2028]) {
      const a = buildAnnualTarget(year);
      const b = buildAnnualTarget(year + 1);
      expect(a.windowEnd.getTime()).toBe(b.windowStart.getTime());
    }
  });
});

describe("relationFromTo", () => {
  it("covers same / generates / generated-by / controls / controlled-by", () => {
    expect(relationFromTo("火", "火")).toBe("same");
    expect(relationFromTo("木", "火")).toBe("generates");
    expect(relationFromTo("火", "木")).toBe("generated-by");
    expect(relationFromTo("火", "金")).toBe("controls");
    expect(relationFromTo("金", "火")).toBe("controlled-by");
  });
});

describe("buildAnnualLuckEvidence — 2026 대표 (Core=火, Supp=木)", () => {
  it("records stem/branch-main fire signals without count merge or A1–A5", () => {
    const target = buildAnnualTarget(2026);
    const evidence = buildAnnualLuckEvidence({
      target,
      natalCoreElement: "火",
      natalSupplementElement: "木",
    });

    expect(evidence.target.stem).toBe("丙");
    expect(evidence.target.branch).toBe("午");
    expect(evidence.signals).toHaveLength(2);

    const stem = evidence.signals.find((s) => s.source === "stem");
    const branch = evidence.signals.find((s) => s.source === "branch-main");
    expect(stem).toMatchObject({
      element: "火",
      relationToNatalCore: "same",
      relationToNatalSupplement: "generated-by", // 火 ← 木生火
    });
    expect(branch).toMatchObject({
      element: "火",
      relationToNatalCore: "same",
      relationToNatalSupplement: "generated-by",
    });

    // Two source evidences, not “火×2”
    expect(evidence.climateSignals).toEqual(["fire-signal", "fire-signal"]);
    expect(evidence.reasons.some((r) => r.includes("natal-core=火"))).toBe(true);
    expect(evidence.reasons.some((r) => r.includes("natal-supplement=木"))).toBe(true);

    const blob = JSON.stringify(evidence);
    expect(blob).not.toMatch(/A1|A2|A3|A4|A5|ACTIVE|CAUTION|annualSupplement/);
  });
});

describe("buildAnnualLuckEvidence — edges", () => {
  it("Core=水 + annual 火 → controlled-by toward Core", () => {
    const evidence = buildAnnualLuckEvidence({
      target: buildAnnualTarget(2026),
      natalCoreElement: "水",
      natalSupplementElement: "金",
    });
    for (const signal of evidence.signals) {
      expect(signal.element).toBe("火");
      expect(signal.relationToNatalCore).toBe("controlled-by"); // 水剋火
    }
  });

  it("natalSupplement=null → relationToNatalSupplement null", () => {
    const evidence = buildAnnualLuckEvidence({
      target: buildAnnualTarget(2026),
      natalCoreElement: "火",
      natalSupplementElement: null,
    });
    for (const signal of evidence.signals) {
      expect(signal.relationToNatalSupplement).toBeNull();
    }
    expect(evidence.reasons).toContain("luck:natal-supplement=null");
  });

  it("branchMain 木/土/金 → climate none on that source", () => {
    // 2027 丁未: stem 火, branchMain 土
    const evidence = buildAnnualLuckEvidence({
      target: buildAnnualTarget(2027),
      natalCoreElement: "木",
      natalSupplementElement: "水",
    });
    expect(evidence.signals[0]?.element).toBe("火");
    expect(evidence.signals[1]?.element).toBe("土");
    expect(evidence.climateSignals).toEqual(["fire-signal", "none"]);
  });

});

describe("buildAnnualLuckEvidence — 木/土/金 branch climate none (explicit years)", () => {
  function evidenceForYear(year: number) {
    return buildAnnualLuckEvidence({
      target: buildAnnualTarget(year),
      natalCoreElement: "火",
      natalSupplementElement: "木",
    });
  }

  it("finds years where branchMain is 木/土/金 and climate is none", () => {
    const hits: Partial<Record<Element, number>> = {};
    for (let year = 1984; year <= 2043; year++) {
      const target = buildAnnualTarget(year);
      const el = target.branchMainElement;
      if (el === "木" || el === "土" || el === "金") {
        hits[el] ??= year;
      }
    }
    expect(hits["木"]).toBeTypeOf("number");
    expect(hits["土"]).toBeTypeOf("number");
    expect(hits["金"]).toBeTypeOf("number");

    for (const el of ["木", "土", "金"] as const) {
      const year = hits[el]!;
      const evidence = evidenceForYear(year);
      const branchIdx = evidence.signals.findIndex((s) => s.source === "branch-main");
      expect(evidence.signals[branchIdx]?.element).toBe(el);
      expect(evidence.climateSignals[branchIdx]).toBe("none");
    }
  });
});
