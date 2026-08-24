/**
 * Policy investigation only. Does not change v2 astronomy or product pillars.
 * Thresholds below are analysis bands, not a product rounding rule.
 */
import type { SolarInstant, SolarTermName } from "@/lib/saju/types";
import {
  compareOfficialV1V2,
  sampleV2OfficialBoundaries,
  type V2BoundarySample,
  type V2CompareRow,
} from "@/lib/saju/validation/experimental/compareV2";
import { solarTermCrossingV2Raw } from "@/lib/saju/validation/experimental/solarTermInstantV2";

/** Analysis band only. Not a product decision threshold. */
const NEAR_BOUNDARY_SECONDS = 10;

export type MinuteDiscrepancyClass = "near-minute-boundary" | "materially-inside-minute" | "unknown";

function pad(value: number, width = 2): string {
  return String(value).padStart(width, "0");
}

function clockMinute(instant: SolarInstant): string {
  return `${instant.year}-${pad(instant.month)}-${pad(instant.day)} ${pad(instant.hour)}:${pad(instant.minute)}`;
}

function officialMinuteStartMs(official: SolarInstant): number {
  return Date.UTC(official.year, official.month - 1, official.day, official.hour, official.minute, 0, 0);
}

export type MinuteMismatchRow = {
  year: number;
  term: SolarTermName;
  isJie: boolean;
  officialMinute: string;
  v2RawKst: string;
  v2RoundedMinute: string;
  v2DiffMinutes: number;
  differenceSecondsFromOfficialMinuteStart: number;
  secondsIntoV2Minute: number;
  classification: MinuteDiscrepancyClass;
  roundingNote: string;
};

function classify(differenceSeconds: number): MinuteDiscrepancyClass {
  if (!Number.isFinite(differenceSeconds)) return "unknown";
  return Math.abs(differenceSeconds) <= NEAR_BOUNDARY_SECONDS ? "near-minute-boundary" : "materially-inside-minute";
}

function roundingNote(differenceSeconds: number, secondsIntoV2Minute: number): string {
  if (differenceSeconds < 0 && secondsIntoV2Minute >= 50) {
    return "v2 is in the last 10s of the previous minute; a few-second ephemeris offset could move nearest-minute to the KASI minute";
  }
  if (differenceSeconds < 0 && secondsIntoV2Minute < 30) {
    return "nearest-minute rounding of this v2 instant would not produce the later KASI minute";
  }
  if (differenceSeconds > 0 && secondsIntoV2Minute <= 10) {
    return "v2 is in the first 10s of the next minute; a few-second ephemeris offset could move nearest-minute to the KASI minute";
  }
  if (differenceSeconds > 0 && secondsIntoV2Minute > 30) {
    return "nearest-minute rounding of this v2 instant would not produce the earlier KASI minute";
  }
  return "mid-minute; KASI nearest-minute rounding of this v2 instant would not match KASI published minute without a different crossing";
}

export function analyzeMinuteMismatches(rows: V2CompareRow[] = compareOfficialV1V2()): MinuteMismatchRow[] {
  return rows
    .filter((row) => row.v2DiffMinutes !== 0)
    .map((row) => {
      const raw = solarTermCrossingV2Raw(row.year, row.termName);
      const differenceSeconds = (raw.rawKst.unixMs - officialMinuteStartMs(row.official)) / 1000;
      return {
        year: row.year,
        term: row.termName,
        isJie: row.isJie,
        officialMinute: clockMinute(row.official),
        v2RawKst: raw.rawKstText,
        v2RoundedMinute: clockMinute(raw.roundedMinute),
        v2DiffMinutes: row.v2DiffMinutes,
        differenceSecondsFromOfficialMinuteStart: Number(differenceSeconds.toFixed(3)),
        secondsIntoV2Minute: Number(raw.rawKst.second.toFixed(3)),
        classification: classify(differenceSeconds),
        roundingNote: roundingNote(differenceSeconds, raw.rawKst.second),
      };
    });
}

export type JieBoundaryMismatchRow = {
  year: number;
  term: SolarTermName;
  kasiMinute: string;
  v2RawKst: string;
  v2RoundedMinute: string;
  differenceSecondsFromOfficialMinuteStart: number;
  classification: MinuteDiscrepancyClass;
  offsets: Array<{
    offset: -1 | 0 | 1;
    instant: string;
    jieMatches: boolean;
    yearMatches: boolean;
    v2Year: string;
    v2Month: string;
    v2Jie: SolarTermName;
    kasiYear: string;
    kasiJie: SolarTermName;
  }>;
};

export function analyzeJieBoundaryMismatches(
  mismatches: MinuteMismatchRow[] = analyzeMinuteMismatches(),
  samples: V2BoundarySample[] = sampleV2OfficialBoundaries(),
): JieBoundaryMismatchRow[] {
  const jieMismatches = mismatches.filter((row) => row.isJie);
  return jieMismatches.map((row) => {
    const related = samples.filter((sample) => sample.year === row.year && sample.termName === row.term);
    return {
      year: row.year,
      term: row.term,
      kasiMinute: row.officialMinute,
      v2RawKst: row.v2RawKst,
      v2RoundedMinute: row.v2RoundedMinute,
      differenceSecondsFromOfficialMinuteStart: row.differenceSecondsFromOfficialMinuteStart,
      classification: row.classification,
      offsets: related.map((sample) => ({
        offset: sample.offset,
        instant: clockMinute(sample.instant),
        jieMatches: sample.jieMatches,
        yearMatches: sample.yearMatches,
        v2Year: sample.v2Year,
        v2Month: sample.v2Month,
        v2Jie: sample.v2Jie,
        kasiYear: sample.kasiYear,
        kasiJie: sample.kasiJie,
      })),
    };
  });
}

export function summarizeDiscrepancyClasses(rows: MinuteMismatchRow[]) {
  const count = (classification: MinuteDiscrepancyClass) => rows.filter((row) => row.classification === classification).length;
  const abs = rows.map((row) => Math.abs(row.differenceSecondsFromOfficialMinuteStart));
  return {
    total: rows.length,
    jie: rows.filter((row) => row.isJie).length,
    nearMinuteBoundary: count("near-minute-boundary"),
    materiallyInsideMinute: count("materially-inside-minute"),
    unknown: count("unknown"),
    minAbsSeconds: abs.length ? Math.min(...abs) : 0,
    maxAbsSeconds: abs.length ? Math.max(...abs) : 0,
    meanAbsSeconds: abs.length ? Number((abs.reduce((sum, value) => sum + value, 0) / abs.length).toFixed(3)) : 0,
    analysisBandSeconds: NEAR_BOUNDARY_SECONDS,
    note: "Bands are for analysis only. They are not a product rounding rule.",
  };
}

export function lichun2023Raw() {
  const raw = solarTermCrossingV2Raw(2023, "입춘");
  const official: SolarInstant = { year: 2023, month: 2, day: 4, hour: 11, minute: 43 };
  const differenceSeconds = (raw.rawKst.unixMs - officialMinuteStartMs(official)) / 1000;
  return {
    kasiMinute: clockMinute(official),
    v2RawKst: raw.rawKstText,
    v2RoundedMinute: clockMinute(raw.roundedMinute),
    differenceSecondsFromOfficialMinuteStart: Number(differenceSeconds.toFixed(3)),
    secondsIntoV2Minute: Number(raw.rawKst.second.toFixed(3)),
    classification: classify(differenceSeconds),
    roundingNote: roundingNote(differenceSeconds, raw.rawKst.second),
    deltaTSeconds: Number(raw.deltaTSeconds.toFixed(3)),
  };
}
