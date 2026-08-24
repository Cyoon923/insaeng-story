import { jieTermAt, solarTermInstant } from "@/lib/saju/calendar/solarTerms";
import { buildFourPillars } from "@/lib/saju/pillars/build";
import type { SolarInstant, SolarTermName } from "@/lib/saju/types";
import {
  JIE_TERM_NAMES,
  OFFICIAL_SOLAR_TERM_YEARS,
  officialInstantOf,
  SOLAR_TERM_YEAR_ORDER,
  type OfficialSolarTermYear,
} from "@/lib/saju/validation/calculation/officialSolarTerms";

export type EngineEarlierOrLater = "earlier" | "later" | "same";

export type SolarTermErrorRow = {
  year: number;
  termName: SolarTermName;
  isJie: boolean;
  officialInstantKst: SolarInstant;
  engineInstant: SolarInstant;
  differenceMinutes: number;
  engineEarlierOrLater: EngineEarlierOrLater;
  sourceReference: OfficialSolarTermYear["sourceReference"];
  sourceType: OfficialSolarTermYear["sourceType"];
  directOfficial: boolean;
  boundaryRiskWindow: {
    start: SolarInstant;
    endExclusive: SolarInstant;
    widthMinutes: number;
  } | null;
};

export type OfficialBoundarySample = {
  offset: -1 | 0 | 1;
  instant: SolarInstant;
  yearPillar: { stem: string; branch: string };
  monthPillar: { stem: string; branch: string };
  latestJie: SolarTermName;
  kasiExpectedJie: SolarTermName | null;
  jieMatchesKasi: boolean | null;
};

function kstMinutes(instant: SolarInstant): number {
  return Date.UTC(instant.year, instant.month - 1, instant.day, instant.hour, instant.minute) / 60000;
}

function shiftMinute(instant: SolarInstant, delta: number): SolarInstant {
  const shifted = new Date(
    Date.UTC(instant.year, instant.month - 1, instant.day, instant.hour, instant.minute + delta),
  );
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

function earlierOrLater(differenceMinutes: number): EngineEarlierOrLater {
  if (differenceMinutes < 0) return "earlier";
  if (differenceMinutes > 0) return "later";
  return "same";
}

function previousJie(name: SolarTermName): SolarTermName {
  const index = JIE_TERM_NAMES.indexOf(name as (typeof JIE_TERM_NAMES)[number]);
  if (index < 0) return name;
  return JIE_TERM_NAMES[(index + JIE_TERM_NAMES.length - 1) % JIE_TERM_NAMES.length];
}

export function measureSolarTermError(yearRecord: OfficialSolarTermYear, name: SolarTermName): SolarTermErrorRow {
  const official = officialInstantOf(yearRecord, name);
  const engine = solarTermInstant(yearRecord.year, name);
  const differenceMinutes = kstMinutes(engine) - kstMinutes(official);
  const direction = earlierOrLater(differenceMinutes);
  const isJie = (JIE_TERM_NAMES as readonly string[]).includes(name);

  let boundaryRiskWindow: SolarTermErrorRow["boundaryRiskWindow"] = null;
  if (differenceMinutes !== 0) {
    const start = differenceMinutes > 0 ? official : engine;
    const endExclusive = differenceMinutes > 0 ? engine : official;
    boundaryRiskWindow = {
      start,
      endExclusive,
      widthMinutes: Math.abs(differenceMinutes),
    };
  }

  return {
    year: yearRecord.year,
    termName: name,
    isJie,
    officialInstantKst: official,
    engineInstant: engine,
    differenceMinutes,
    engineEarlierOrLater: direction,
    sourceReference: yearRecord.sourceReference,
    sourceType: yearRecord.sourceType,
    directOfficial: yearRecord.directOfficial,
    boundaryRiskWindow,
  };
}

export function measureAllSolarTermErrors(): SolarTermErrorRow[] {
  const rows: SolarTermErrorRow[] = [];
  for (const yearRecord of OFFICIAL_SOLAR_TERM_YEARS) {
    for (const name of SOLAR_TERM_YEAR_ORDER) {
      rows.push(measureSolarTermError(yearRecord, name));
    }
  }
  return rows;
}

export function sampleOfficialBoundary(yearRecord: OfficialSolarTermYear, name: SolarTermName): OfficialBoundarySample[] {
  const official = officialInstantOf(yearRecord, name);
  const kasiAtOrAfter = name;
  const kasiBefore = previousJie(name);
  return ([-1, 0, 1] as const).map((offset) => {
    const instant = shiftMinute(official, offset);
    const pillars = buildFourPillars({
      calendar: "solar",
      year: instant.year,
      month: instant.month,
      day: instant.day,
      isLeapMonth: false,
      time: { hour: instant.hour, minute: instant.minute },
    });
    const latestJie = jieTermAt(instant).name;
    const kasiExpectedJie = (JIE_TERM_NAMES as readonly string[]).includes(name)
      ? offset < 0
        ? kasiBefore
        : kasiAtOrAfter
      : null;
    return {
      offset,
      instant,
      yearPillar: pillars.year,
      monthPillar: pillars.month,
      latestJie,
      kasiExpectedJie,
      jieMatchesKasi: kasiExpectedJie ? latestJie === kasiExpectedJie : null,
    };
  });
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function seasonOf(month: number): "spring" | "summer" | "autumn" | "winter" {
  if (month <= 3) return "spring";
  if (month <= 6) return "summer";
  if (month <= 9) return "autumn";
  return "winter";
}

function statsOf(values: number[]) {
  if (values.length === 0) {
    return { count: 0, min: 0, max: 0, maxAbs: 0, mean: 0, meanAbs: 0 };
  }
  const abs = values.map((value) => Math.abs(value));
  return {
    count: values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    maxAbs: Math.max(...abs),
    mean: Number(mean(values).toFixed(2)),
    meanAbs: Number(mean(abs).toFixed(2)),
  };
}

export function summarizeSolarTermErrors(rows: SolarTermErrorRow[]) {
  const diffs = rows.map((row) => row.differenceMinutes);
  const later = rows.filter((row) => row.engineEarlierOrLater === "later").length;
  const earlier = rows.filter((row) => row.engineEarlierOrLater === "earlier").length;
  const same = rows.filter((row) => row.engineEarlierOrLater === "same").length;
  const byTerm: Record<string, number[]> = {};
  const byYear: Record<number, number[]> = {};
  const bySeason: Record<string, number[]> = {};
  for (const row of rows) {
    (byTerm[row.termName] ??= []).push(row.differenceMinutes);
    (byYear[row.year] ??= []).push(row.differenceMinutes);
    (bySeason[seasonOf(row.officialInstantKst.month)] ??= []).push(row.differenceMinutes);
  }
  return {
    ...statsOf(diffs),
    later,
    earlier,
    same,
    byTerm: Object.fromEntries(Object.entries(byTerm).map(([name, values]) => [name, statsOf(values)])),
    byYear: Object.fromEntries(Object.entries(byYear).map(([year, values]) => [year, statsOf(values)])),
    bySeason: Object.fromEntries(Object.entries(bySeason).map(([season, values]) => [season, statsOf(values)])),
    note: "통계는 원인 파악용이다. 평균을 보정값으로 쓰지 않는다.",
  };
}

export function sampleAllOfficialJieBoundaries() {
  return OFFICIAL_SOLAR_TERM_YEARS.flatMap((yearRecord) =>
    JIE_TERM_NAMES.map((name) => {
      const error = measureSolarTermError(yearRecord, name);
      const samples = sampleOfficialBoundary(yearRecord, name);
      return {
        year: yearRecord.year,
        termName: name,
        differenceMinutes: error.differenceMinutes,
        engineEarlierOrLater: error.engineEarlierOrLater,
        boundaryRiskWindow: error.boundaryRiskWindow,
        officialMinus1: samples[0],
        official: samples[1],
        officialPlus1: samples[2],
        mismatchOffsets: samples.filter((sample) => sample.jieMatchesKasi === false).map((sample) => sample.offset),
      };
    }),
  );
}
