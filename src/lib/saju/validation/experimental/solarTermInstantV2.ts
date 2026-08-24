import { JIE_TERMS, SOLAR_TERMS } from "@/lib/saju/data/solarTerms";
import type { MonthBranch, SolarInstant, SolarTermName } from "@/lib/saju/types";
import { longitudeDeltaDeg, sunApparentLongitudeV2 } from "@/lib/saju/validation/experimental/sunApparentLongitudeV2";
import {
  deltaTSecondsAtJdUtc,
  formatKstClock,
  jdTtFromJdUt,
  jdUtcFromKst,
  jdUtFromJdUtc,
  kstClockFromJdTt,
  kstFromJdTt,
  type JulianDayTt,
  type KstClockRaw,
} from "@/lib/saju/validation/experimental/timeScales";

const MEAN_SOLAR_DEGREES_PER_DAY = 360 / 365.242189;
const MAX_SEARCH_DRIFT_DAYS = 8;
const BISECTION_TOLERANCE_DAYS = 0.05 / 86400;

function ttAtKst(instant: SolarInstant, second = 0): { jdTt: JulianDayTt; deltaTSeconds: number } {
  const jdUtc = jdUtcFromKst(instant, second);
  const deltaTSeconds = deltaTSecondsAtJdUtc(jdUtc);
  const jdTt = jdTtFromJdUt(jdUtFromJdUtc(jdUtc), deltaTSeconds);
  return { jdTt, deltaTSeconds };
}

function residual(jdTtValue: number, targetDeg: number): number {
  return longitudeDeltaDeg(sunApparentLongitudeV2({ kind: "tt", jdTt: jdTtValue }), targetDeg);
}

function newtonThenBisection(aroundJdTt: number, targetDeg: number): number {
  let guess = aroundJdTt;
  for (let i = 0; i < 8; i++) {
    guess -= residual(guess, targetDeg) / MEAN_SOLAR_DEGREES_PER_DAY;
  }

  const drifted = Math.abs(guess - aroundJdTt);
  if (drifted > MAX_SEARCH_DRIFT_DAYS) {
    throw new Error(`v2 절기 탐색이 연초 추정에서 ${drifted.toFixed(1)}일 벗어났습니다.`);
  }

  let span = 0.02;
  let lo = guess - span;
  let hi = guess + span;
  let flo = residual(lo, targetDeg);
  let fhi = residual(hi, targetDeg);
  for (let i = 0; i < 24 && flo * fhi > 0; i++) {
    span *= 2;
    lo = guess - span;
    hi = guess + span;
    flo = residual(lo, targetDeg);
    fhi = residual(hi, targetDeg);
  }
  if (flo * fhi > 0) {
    throw new Error(`v2 절기 탐색 구간에서 부호가 바뀌지 않습니다. f(${lo})=${flo}, f(${hi})=${fhi}`);
  }

  for (let i = 0; i < 64; i++) {
    const mid = (lo + hi) / 2;
    const fm = residual(mid, targetDeg);
    if (Math.abs(hi - lo) < BISECTION_TOLERANCE_DAYS || fm === 0) return mid;
    if (flo * fm <= 0) {
      hi = mid;
      fhi = fm;
    } else {
      lo = mid;
      flo = fm;
    }
  }
  return (lo + hi) / 2;
}

function approximateTermJdTt(year: number, targetDeg: number): { jdTt: number; deltaTSeconds: number } {
  const jan1 = ttAtKst({ year, month: 1, day: 1, hour: 12, minute: 0 });
  const lon0 = sunApparentLongitudeV2(jan1.jdTt);
  const degreesAhead = (targetDeg - lon0 + 360) % 360;
  return {
    jdTt: jan1.jdTt.jdTt + degreesAhead / MEAN_SOLAR_DEGREES_PER_DAY,
    deltaTSeconds: jan1.deltaTSeconds,
  };
}

const termCache = new Map<string, SolarInstant>();

function solarTermCrossingTt(year: number, name: SolarTermName): { jdTt: JulianDayTt; deltaTSeconds: number } {
  const term = SOLAR_TERMS.find((item) => item.name === name);
  if (!term) throw new Error(`Unknown solar term: ${name}`);
  const approx = approximateTermJdTt(year, term.longitude);
  const jdTtValue = newtonThenBisection(approx.jdTt, term.longitude);
  return { jdTt: { kind: "tt", jdTt: jdTtValue }, deltaTSeconds: approx.deltaTSeconds };
}

export function solarTermInstantV2(year: number, name: SolarTermName): SolarInstant {
  const key = `${year}:${name}`;
  const cached = termCache.get(key);
  if (cached) return cached;

  const crossing = solarTermCrossingTt(year, name);
  const instant = kstFromJdTt(crossing.jdTt, crossing.deltaTSeconds);
  termCache.set(key, instant);
  return instant;
}

export type SolarTermCrossingV2Raw = {
  year: number;
  name: SolarTermName;
  jdTt: JulianDayTt;
  deltaTSeconds: number;
  rawKst: KstClockRaw;
  rawKstText: string;
  roundedMinute: SolarInstant;
};

/** Same crossing as solarTermInstantV2, before minute rounding. Experimental only. */
export function solarTermCrossingV2Raw(year: number, name: SolarTermName): SolarTermCrossingV2Raw {
  const crossing = solarTermCrossingTt(year, name);
  const rawKst = kstClockFromJdTt(crossing.jdTt, crossing.deltaTSeconds);
  return {
    year,
    name,
    jdTt: crossing.jdTt,
    deltaTSeconds: crossing.deltaTSeconds,
    rawKst,
    rawKstText: formatKstClock(rawKst),
    roundedMinute: kstFromJdTt(crossing.jdTt, crossing.deltaTSeconds),
  };
}

export function lichunInstantV2(year: number): SolarInstant {
  return solarTermInstantV2(year, "입춘");
}

function kstMinutes(instant: SolarInstant): number {
  return Date.UTC(instant.year, instant.month - 1, instant.day, instant.hour, instant.minute) / 60000;
}

export function jieTermAtV2(instant: SolarInstant): {
  name: SolarTermName;
  monthBranch: MonthBranch;
  startedAt: SolarInstant;
} {
  const jd = kstMinutes(instant);
  let bestName: SolarTermName = "소한";
  let bestBranch: MonthBranch = "丑";
  let bestStarted = solarTermInstantV2(instant.year - 1, "소한");
  let bestJd = kstMinutes(bestStarted);

  for (const offsetYear of [instant.year - 1, instant.year, instant.year + 1]) {
    for (const term of JIE_TERMS) {
      if (!term.monthBranch) continue;
      const startedAt = solarTermInstantV2(offsetYear, term.name);
      const startJd = kstMinutes(startedAt);
      if (startJd <= jd && startJd >= bestJd) {
        bestName = term.name;
        bestBranch = term.monthBranch;
        bestStarted = startedAt;
        bestJd = startJd;
      }
    }
  }

  return { name: bestName, monthBranch: bestBranch, startedAt: bestStarted };
}
