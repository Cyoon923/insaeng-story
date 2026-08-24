import { describe, expect, it } from "vitest";
import { solarTermInstant } from "@/lib/saju/calendar/solarTerms";
import { deltaTSecondsEspenakMeeus } from "@/lib/saju/validation/experimental/deltaT";
import {
  compareOfficialV1V2,
  lichunFocus,
  riskWindows,
  sampleV2OfficialBoundaries,
  summarizeV2Comparison,
} from "@/lib/saju/validation/experimental/compareV2";

describe("solar term v2 experiment (product API stays on v1)", () => {
  it("keeps v1 2020 입춘 regression", () => {
    expect(solarTermInstant(2020, "입춘")).toEqual({ year: 2020, month: 2, day: 4, hour: 18, minute: 8 });
  });

  it("uses Espenak-Meeus ΔT near 1900/2000/2100", () => {
    const d1900 = deltaTSecondsEspenakMeeus(1900, 7);
    const d2000 = deltaTSecondsEspenakMeeus(2000, 7);
    const d2020 = deltaTSecondsEspenakMeeus(2020, 7);
    const d2100 = deltaTSecondsEspenakMeeus(2100, 7);
    expect(d1900).toBeGreaterThan(-10);
    expect(d1900).toBeLessThan(10);
    expect(d2000).toBeGreaterThan(62);
    expect(d2000).toBeLessThan(66);
    expect(d2020).toBeGreaterThan(68);
    expect(d2020).toBeLessThan(74);
    expect(d2100).toBeGreaterThan(60);
    expect(d2100).toBeLessThan(250);
  });

  it("compares v1 and v2 against KASI 336 without rewriting expected", () => {
    const rows = compareOfficialV1V2();
    const summary = summarizeV2Comparison(rows);
    const lichun = lichunFocus(rows);
    const windows = riskWindows(rows);
    const boundaries = sampleV2OfficialBoundaries();
    const jieMismatch = boundaries.filter((item) => !item.jieMatches);
    const yearMismatch = boundaries.filter((item) => !item.yearMatches);
    const publishedYears = rows.filter((row) => row.year !== 2026);
    const publishedJie = publishedYears.filter((row) => row.isJie);
    const dateMismatch = publishedJie.filter(
      (row) => row.v2.year !== row.official.year || row.v2.month !== row.official.month || row.v2.day !== row.official.day,
    );
    const pass = {
      jieDate100: dateMismatch.length === 0,
      jieMaxAbsLe1: Math.max(...publishedJie.map((row) => Math.abs(row.v2DiffMinutes))) <= 1,
      jieBoundary100: jieMismatch.filter((item) => item.year !== 2026).length === 0 && yearMismatch.filter((item) => item.year !== 2026).length === 0,
      noSingleYearRegression: Object.entries(summary.byYear).every(([, stats]) => stats.v2.maxAbs <= stats.v1.maxAbs + 1),
    };

    console.log(
      JSON.stringify(
        {
          summary,
          lichun,
          windows,
          pass,
          jieMismatchCount: jieMismatch.length,
          yearMismatchCount: yearMismatch.length,
          jieMismatch: jieMismatch.slice(0, 40),
        },
        null,
        2,
      ),
    );

    expect(rows).toHaveLength(336);
    expect(boundaries).toHaveLength(14 * 12 * 3);
    expect(dateMismatch).toEqual([]);
  });
});
