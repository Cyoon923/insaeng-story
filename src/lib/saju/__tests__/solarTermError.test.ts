import { describe, expect, it } from "vitest";
import { lichunInstant, solarTermInstant } from "@/lib/saju/calendar/solarTerms";
import {
  MISSING_OFFICIAL_YEARS,
  OFFICIAL_SOLAR_TERM_YEARS,
  REJECTED_OFFICIAL_CANDIDATES,
  officialInstantOf,
} from "@/lib/saju/validation/calculation/officialSolarTerms";
import {
  measureAllSolarTermErrors,
  sampleAllOfficialJieBoundaries,
  summarizeSolarTermErrors,
} from "@/lib/saju/validation/calculation/solarTermError";

function clock(instant: { year: number; month: number; day: number; hour: number; minute: number }): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${instant.year}-${pad(instant.month)}-${pad(instant.day)} ${pad(instant.hour)}:${pad(instant.minute)}`;
}

describe("절기 공식 시각 vs 엔진 오차 (계산 코드 미수정)", () => {
  const rows = measureAllSolarTermErrors();
  const summary = summarizeSolarTermErrors(rows);
  const year2020 = OFFICIAL_SOLAR_TERM_YEARS.find((item) => item.year === 2020);

  it("stores official times without copying engine instants", () => {
    expect(OFFICIAL_SOLAR_TERM_YEARS.map((item) => item.year)).toEqual([
      2000, 2012, 2013, 2014, 2015, 2016, 2017, 2020, 2021, 2022, 2023, 2024, 2025, 2026,
    ]);
    expect(MISSING_OFFICIAL_YEARS).toEqual([1900, 1955, 1960, 1984, 1988, 2050, 2099, 2100]);
    expect(REJECTED_OFFICIAL_CANDIDATES.map((item) => item.year)).toEqual([2011]);
    if (!year2020) throw new Error("2020 official year missing");
    const lichun2020 = officialInstantOf(year2020, "입춘");
    const engine2020 = solarTermInstant(2020, "입춘");
    expect(lichun2020).toEqual({ year: 2020, month: 2, day: 4, hour: 18, minute: 3 });
    expect(engine2020).not.toEqual(lichun2020);
  });

  it("records signed minute differences for every official term", () => {
    expect(rows).toHaveLength(14 * 24);
    expect(summary.count).toBe(336);
    expect(summary.maxAbs).toBeGreaterThan(1);
    expect(summary.note).toContain("보정값으로 쓰지 않는다");
    const lichun = rows.filter((row) => row.termName === "입춘");
    console.log(
      JSON.stringify(
        {
          summary: {
            count: summary.count,
            min: summary.min,
            max: summary.max,
            maxAbs: summary.maxAbs,
            mean: summary.mean,
            meanAbs: summary.meanAbs,
            later: summary.later,
            earlier: summary.earlier,
            same: summary.same,
            byYear: summary.byYear,
            bySeason: summary.bySeason,
            byTerm: Object.fromEntries(
              Object.entries(summary.byTerm).map(([name, stats]) => [name, { min: stats.min, max: stats.max, mean: stats.mean }]),
            ),
          },
          lichun: lichun.map((row) => ({
            year: row.year,
            official: clock(row.officialInstantKst),
            engine: clock(row.engineInstant),
            diff: row.differenceMinutes,
            dir: row.engineEarlierOrLater,
          })),
        },
        null,
        2,
      ),
    );
  });

  it("keeps 2020 exact-minute comparison separate from the ±15 minute date test", () => {
    const y2020 = rows.filter((row) => row.year === 2020);
    expect(y2020).toHaveLength(24);
    expect(y2020.every((row) => Number.isInteger(row.differenceMinutes))).toBe(true);
    expect(y2020.some((row) => row.differenceMinutes !== 0)).toBe(true);
    console.log(
      JSON.stringify(
        {
          y2020: y2020.map((row) => ({
            term: row.termName,
            official: clock(row.officialInstantKst),
            engine: clock(row.engineInstant),
            diff: row.differenceMinutes,
            dir: row.engineEarlierOrLater,
            risk: row.boundaryRiskWindow
              ? `${clock(row.boundaryRiskWindow.start)} ≤ birth < ${clock(row.boundaryRiskWindow.endExclusive)}`
              : null,
          })),
          y2024: rows
            .filter((row) => row.year === 2024)
            .map((row) => ({
              term: row.termName,
              official: clock(row.officialInstantKst),
              engine: clock(row.engineInstant),
              diff: row.differenceMinutes,
              dir: row.engineEarlierOrLater,
            })),
        },
        null,
        2,
      ),
    );
  });

  it("samples official ±1 minute jie boundaries without rewriting expected", () => {
    const boundaries = sampleAllOfficialJieBoundaries();
    const mismatches = boundaries.flatMap((item) =>
      item.mismatchOffsets.map((offset) => ({
        year: item.year,
        term: item.termName,
        offset,
        diff: item.differenceMinutes,
        dir: item.engineEarlierOrLater,
        official: clock(item.official.instant),
        yearAtOfficial: `${item.official.yearPillar.stem}${item.official.yearPillar.branch}`,
        monthAtOfficial: `${item.official.monthPillar.stem}${item.official.monthPillar.branch}`,
        yearAtOffset:
          offset === -1
            ? `${item.officialMinus1.yearPillar.stem}${item.officialMinus1.yearPillar.branch}`
            : offset === 0
              ? `${item.official.yearPillar.stem}${item.official.yearPillar.branch}`
              : `${item.officialPlus1.yearPillar.stem}${item.officialPlus1.yearPillar.branch}`,
        monthAtOffset:
          offset === -1
            ? `${item.officialMinus1.monthPillar.stem}${item.officialMinus1.monthPillar.branch}`
            : offset === 0
              ? `${item.official.monthPillar.stem}${item.official.monthPillar.branch}`
              : `${item.officialPlus1.monthPillar.stem}${item.officialPlus1.monthPillar.branch}`,
        engineJie: offset === -1 ? item.officialMinus1.latestJie : offset === 0 ? item.official.latestJie : item.officialPlus1.latestJie,
        kasiJie:
          offset === -1 ? item.officialMinus1.kasiExpectedJie : offset === 0 ? item.official.kasiExpectedJie : item.officialPlus1.kasiExpectedJie,
      })),
    );
    const mismatchByYear: Record<number, number> = {};
    for (const item of mismatches) mismatchByYear[item.year] = (mismatchByYear[item.year] ?? 0) + 1;
    console.log(
      JSON.stringify(
        {
          jieBoundaryCount: boundaries.length,
          mismatchCount: mismatches.length,
          mismatchByYear,
          lichunWindows: boundaries
            .filter((item) => item.termName === "입춘")
            .map((item) => ({
              year: item.year,
              diff: item.differenceMinutes,
              dir: item.engineEarlierOrLater,
              risk: item.boundaryRiskWindow
                ? `${clock(item.boundaryRiskWindow.start)} ≤ birth < ${clock(item.boundaryRiskWindow.endExclusive)}`
                : null,
              mismatchOffsets: item.mismatchOffsets,
              minus1: {
                year: `${item.officialMinus1.yearPillar.stem}${item.officialMinus1.yearPillar.branch}`,
                month: `${item.officialMinus1.monthPillar.stem}${item.officialMinus1.monthPillar.branch}`,
                jie: item.officialMinus1.latestJie,
              },
              at: {
                year: `${item.official.yearPillar.stem}${item.official.yearPillar.branch}`,
                month: `${item.official.monthPillar.stem}${item.official.monthPillar.branch}`,
                jie: item.official.latestJie,
              },
              plus1: {
                year: `${item.officialPlus1.yearPillar.stem}${item.officialPlus1.yearPillar.branch}`,
                month: `${item.officialPlus1.monthPillar.stem}${item.officialPlus1.monthPillar.branch}`,
                jie: item.officialPlus1.latestJie,
              },
            })),
        },
        null,
        2,
      ),
    );
    expect(boundaries).toHaveLength(14 * 12);
    expect(Array.isArray(mismatches)).toBe(true);
  });

  it("does not invent a 1984 official lichun time", () => {
    const engine1984 = lichunInstant(1984);
    expect(MISSING_OFFICIAL_YEARS).toContain(1984);
    console.log(JSON.stringify({ engineOnly1984Lichun: clock(engine1984), official1984: null }, null, 2));
    expect(engine1984.month).toBe(2);
    expect(engine1984.day).toBeGreaterThanOrEqual(3);
    expect(engine1984.day).toBeLessThanOrEqual(5);
  });
});
