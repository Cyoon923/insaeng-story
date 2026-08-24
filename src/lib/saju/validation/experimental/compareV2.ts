import { solarTermInstant } from "@/lib/saju/calendar/solarTerms";
import {
  MONTH_BRANCHES_FROM_YIN,
  YIN_MONTH_STEM_BY_YEAR_STEM,
  ganzhiByIndex,
  stemByIndex,
  stemIndex,
} from "@/lib/saju/constants/ganzhi";
import type { Pillar, SolarInstant, SolarTermName } from "@/lib/saju/types";
import {
  JIE_TERM_NAMES,
  OFFICIAL_SOLAR_TERM_YEARS,
  officialInstantOf,
  SOLAR_TERM_YEAR_ORDER,
} from "@/lib/saju/validation/calculation/officialSolarTerms";
import { jieTermAtV2, lichunInstantV2, solarTermInstantV2 } from "@/lib/saju/validation/experimental/solarTermInstantV2";

export type EarlierOrLater = "earlier" | "later" | "same";

function kstMinutes(instant: SolarInstant): number {
  return Date.UTC(instant.year, instant.month - 1, instant.day, instant.hour, instant.minute) / 60000;
}

function shiftMinute(instant: SolarInstant, delta: number): SolarInstant {
  const shifted = new Date(Date.UTC(instant.year, instant.month - 1, instant.day, instant.hour, instant.minute + delta));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

function directionOf(diff: number): EarlierOrLater {
  if (diff < 0) return "earlier";
  if (diff > 0) return "later";
  return "same";
}

function clock(instant: SolarInstant): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${instant.year}-${pad(instant.month)}-${pad(instant.day)} ${pad(instant.hour)}:${pad(instant.minute)}`;
}

function yearPillarV2(instant: SolarInstant): Pillar {
  const lichun = lichunInstantV2(instant.year);
  const ganzhiYear = kstMinutes(instant) < kstMinutes(lichun) ? instant.year - 1 : instant.year;
  return ganzhiByIndex(ganzhiYear - 4);
}

function monthPillarV2(instant: SolarInstant): Pillar {
  const { monthBranch } = jieTermAtV2(instant);
  const yinStem = YIN_MONTH_STEM_BY_YEAR_STEM[yearPillarV2(instant).stem];
  const monthIndex = MONTH_BRANCHES_FROM_YIN.indexOf(monthBranch);
  return {
    stem: stemByIndex(stemIndex(yinStem) + monthIndex),
    branch: monthBranch,
  };
}

function previousJie(name: SolarTermName): SolarTermName {
  const index = JIE_TERM_NAMES.indexOf(name as (typeof JIE_TERM_NAMES)[number]);
  if (index < 0) return name;
  return JIE_TERM_NAMES[(index + JIE_TERM_NAMES.length - 1) % JIE_TERM_NAMES.length];
}

function kasiYearPillar(instant: SolarInstant, jieName: SolarTermName, offset: -1 | 0 | 1): Pillar {
  const lichun = officialInstantOf(OFFICIAL_SOLAR_TERM_YEARS.find((item) => item.year === instant.year) ?? OFFICIAL_SOLAR_TERM_YEARS[0], "입춘");
  const beforeLichun = jieName === "입춘" ? offset < 0 : kstMinutes(instant) < kstMinutes(lichun);
  const ganzhiYear = beforeLichun ? instant.year - 1 : instant.year;
  if (jieName === "입춘") {
    return ganzhiByIndex((offset < 0 ? instant.year - 1 : instant.year) - 4);
  }
  return ganzhiByIndex(ganzhiYear - 4);
}

export type V2CompareRow = {
  year: number;
  termName: SolarTermName;
  isJie: boolean;
  official: SolarInstant;
  v1: SolarInstant;
  v1DiffMinutes: number;
  v2: SolarInstant;
  v2DiffMinutes: number;
  v1Dir: EarlierOrLater;
  v2Dir: EarlierOrLater;
};

export function compareOfficialV1V2(): V2CompareRow[] {
  const rows: V2CompareRow[] = [];
  for (const yearRecord of OFFICIAL_SOLAR_TERM_YEARS) {
    for (const name of SOLAR_TERM_YEAR_ORDER) {
      const official = officialInstantOf(yearRecord, name);
      const v1 = solarTermInstant(yearRecord.year, name);
      const v2 = solarTermInstantV2(yearRecord.year, name);
      const v1DiffMinutes = kstMinutes(v1) - kstMinutes(official);
      const v2DiffMinutes = kstMinutes(v2) - kstMinutes(official);
      rows.push({
        year: yearRecord.year,
        termName: name,
        isJie: (JIE_TERM_NAMES as readonly string[]).includes(name),
        official,
        v1,
        v1DiffMinutes,
        v2,
        v2DiffMinutes,
        v1Dir: directionOf(v1DiffMinutes),
        v2Dir: directionOf(v2DiffMinutes),
      });
    }
  }
  return rows;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function errorStats(diffs: number[]) {
  const abs = diffs.map((value) => Math.abs(value));
  return {
    count: diffs.length,
    exact: diffs.filter((value) => value === 0).length,
    within1: diffs.filter((value) => Math.abs(value) <= 1).length,
    within2: diffs.filter((value) => Math.abs(value) <= 2).length,
    maxAbs: Math.max(...abs),
    meanAbs: Number(mean(abs).toFixed(3)),
    min: Math.min(...diffs),
    max: Math.max(...diffs),
    earlier: diffs.filter((value) => value < 0).length,
    later: diffs.filter((value) => value > 0).length,
    same: diffs.filter((value) => value === 0).length,
  };
}

export function summarizeV2Comparison(rows: V2CompareRow[]) {
  const v1All = rows.map((row) => row.v1DiffMinutes);
  const v2All = rows.map((row) => row.v2DiffMinutes);
  const jie = rows.filter((row) => row.isJie);
  const byYear = Object.fromEntries(
    [...new Set(rows.map((row) => row.year))].map((year) => {
      const subset = rows.filter((row) => row.year === year);
      const preview = year === 2026;
      return [
        year,
        {
          preview,
          v1: errorStats(subset.map((row) => row.v1DiffMinutes)),
          v2: errorStats(subset.map((row) => row.v2DiffMinutes)),
        },
      ];
    }),
  );
  return {
    all24: { v1: errorStats(v1All), v2: errorStats(v2All) },
    jie12: { v1: errorStats(jie.map((row) => row.v1DiffMinutes)), v2: errorStats(jie.map((row) => row.v2DiffMinutes)) },
    byYear,
    note: "알고리즘 비교용. 정확도 %를 제품 confidence로 쓰지 않는다.",
  };
}

export type V2BoundarySample = {
  year: number;
  termName: SolarTermName;
  offset: -1 | 0 | 1;
  instant: SolarInstant;
  v2Year: string;
  v2Month: string;
  v2Jie: SolarTermName;
  kasiJie: SolarTermName;
  kasiYear: string;
  jieMatches: boolean;
  yearMatches: boolean;
};

export function sampleV2OfficialBoundaries(): V2BoundarySample[] {
  const samples: V2BoundarySample[] = [];
  for (const yearRecord of OFFICIAL_SOLAR_TERM_YEARS) {
    for (const name of JIE_TERM_NAMES) {
      const official = officialInstantOf(yearRecord, name);
      for (const offset of [-1, 0, 1] as const) {
        const instant = shiftMinute(official, offset);
        const yearP = yearPillarV2(instant);
        const monthP = monthPillarV2(instant);
        const jie = jieTermAtV2(instant).name;
        const kasiJie = offset < 0 ? previousJie(name) : name;
        const kasiYear = kasiYearPillar(instant, name, offset);
        samples.push({
          year: yearRecord.year,
          termName: name,
          offset,
          instant,
          v2Year: `${yearP.stem}${yearP.branch}`,
          v2Month: `${monthP.stem}${monthP.branch}`,
          v2Jie: jie,
          kasiJie,
          kasiYear: `${kasiYear.stem}${kasiYear.branch}`,
          jieMatches: jie === kasiJie,
          yearMatches: `${yearP.stem}${yearP.branch}` === `${kasiYear.stem}${kasiYear.branch}`,
        });
      }
    }
  }
  return samples;
}

export function lichunFocus(rows: V2CompareRow[]) {
  return [2017, 2020, 2023, 2024].map((year) => {
    const row = rows.find((item) => item.year === year && item.termName === "입춘");
    if (!row) throw new Error(`missing 입춘 ${year}`);
    return {
      year,
      official: clock(row.official),
      v1: clock(row.v1),
      v1DiffMinutes: row.v1DiffMinutes,
      v2: clock(row.v2),
      v2DiffMinutes: row.v2DiffMinutes,
    };
  });
}

export function riskWindows(rows: V2CompareRow[]) {
  return {
    v1Open: rows.filter((row) => row.isJie && row.v1DiffMinutes !== 0).length,
    v2Open: rows.filter((row) => row.isJie && row.v2DiffMinutes !== 0).length,
    v2JieWindows: rows
      .filter((row) => row.isJie && row.v2DiffMinutes !== 0)
      .map((row) => ({
        year: row.year,
        term: row.termName,
        official: clock(row.official),
        v2: clock(row.v2),
        diff: row.v2DiffMinutes,
      })),
  };
}
