/**
 * Basic eight-glyph element mapping + tally (no hidden stems / season / Strength).
 *
 * Chart: 辛酉 / 乙未 / 丙申 / 丁酉
 * Expected: 木1 火2 土1 金4 水0
 */
import { describe, expect, it } from "vitest";
import { BRANCH_ELEMENT, STEM_ELEMENT } from "@/lib/saju/constants/elements";
import { collectElementMaterials } from "@/lib/saju/elements/materials";
import type { Element, FourPillars, Pillar } from "@/lib/saju/types";
import { ELEMENTS } from "@/lib/saju/types";

const CHART_1981_DINGYOU: FourPillars = {
  year: { stem: "辛", branch: "酉" },
  month: { stem: "乙", branch: "未" },
  day: { stem: "丙", branch: "申" },
  hour: { stem: "丁", branch: "酉" },
};

const EXPECTED_GLYPH_ELEMENTS: Array<{
  slot: string;
  glyph: string;
  element: Element;
}> = [
  { slot: "year.stem", glyph: "辛", element: "金" },
  { slot: "year.branch", glyph: "酉", element: "金" },
  { slot: "month.stem", glyph: "乙", element: "木" },
  { slot: "month.branch", glyph: "未", element: "土" },
  { slot: "day.stem", glyph: "丙", element: "火" },
  { slot: "day.branch", glyph: "申", element: "金" },
  { slot: "hour.stem", glyph: "丁", element: "火" },
  { slot: "hour.branch", glyph: "酉", element: "金" },
];

const EXPECTED_BASIC_TALLY: Record<Element, number> = {
  木: 1,
  火: 2,
  土: 1,
  金: 4,
  水: 0,
};

function emptyTally(): Record<Element, number> {
  return { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
}

/** Stem + branch only — before 지장간 / 월령 / Strength weights. */
function tallyBasicEightGlyphs(pillars: FourPillars): Record<Element, number> {
  const tally = emptyTally();
  const slots: Array<Pillar> = [pillars.year, pillars.month, pillars.day];
  if (pillars.hour !== "unknown") slots.push(pillars.hour);
  for (const pillar of slots) {
    tally[STEM_ELEMENT[pillar.stem]] += 1;
    tally[BRANCH_ELEMENT[pillar.branch]] += 1;
  }
  return tally;
}

describe("1981 辛酉/乙未/丙申/丁酉 — basic element mapping", () => {
  it("maps each of the eight glyphs to the expected element", () => {
    for (const row of EXPECTED_GLYPH_ELEMENTS) {
      const [pillarSlot, layer] = row.slot.split(".") as ["year" | "month" | "day" | "hour", "stem" | "branch"];
      const pillar = CHART_1981_DINGYOU[pillarSlot];
      expect(pillar).not.toBe("unknown");
      if (pillar === "unknown") continue;
      if (layer === "stem") {
        expect(STEM_ELEMENT[pillar.stem]).toBe(row.element);
        expect(pillar.stem).toBe(row.glyph);
      } else {
        expect(BRANCH_ELEMENT[pillar.branch]).toBe(row.element);
        expect(pillar.branch).toBe(row.glyph);
      }
    }
  });

  it("tallies 木1 火2 土1 金4 水0 before hidden stems / season / Strength", () => {
    const actual = tallyBasicEightGlyphs(CHART_1981_DINGYOU);
    expect(actual).toEqual(EXPECTED_BASIC_TALLY);
    expect(ELEMENTS.reduce((sum, el) => sum + actual[el], 0)).toBe(8);
  });

  it("engine STEM_ELEMENT / BRANCH_ELEMENT match the same tally", () => {
    // Explicit engine lookup path (same tables used elsewhere).
    const viaTables = emptyTally();
    for (const row of EXPECTED_GLYPH_ELEMENTS) {
      viaTables[row.element] += 1;
    }
    expect(viaTables).toEqual(EXPECTED_BASIC_TALLY);
    expect(tallyBasicEightGlyphs(CHART_1981_DINGYOU)).toEqual(viaTables);
  });

  it("materials stem+branch layers alone also equal basic tally (hidden excluded)", () => {
    const materials = collectElementMaterials(CHART_1981_DINGYOU);
    const stemBranch = emptyTally();
    for (const item of materials.items) {
      if (item.layer === "stem" || item.layer === "branch") {
        stemBranch[item.element] += 1;
      }
    }
    expect(stemBranch).toEqual(EXPECTED_BASIC_TALLY);
  });
});
