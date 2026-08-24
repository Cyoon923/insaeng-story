import { JIE_TERMS, SOLAR_TERMS } from "@/lib/saju/data/solarTerms";
import type { MonthBranch, SolarInstant, SolarTermName } from "@/lib/saju/types";

const J2000 = 2451545;
const MS_PER_DAY = 86400000;
const UNIX_JD = 2440587.5;

function deg2rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function mod360(deg: number): number {
  const value = deg % 360;
  return value < 0 ? value + 360 : value;
}

function longitudeDelta(actual: number, target: number): number {
  return ((actual - target + 540) % 360) - 180;
}

export function julianFromKst(instant: SolarInstant): number {
  const utcMs = Date.UTC(
    instant.year,
    instant.month - 1,
    instant.day,
    instant.hour - 9,
    instant.minute,
    0,
  );
  return utcMs / MS_PER_DAY + UNIX_JD;
}

export function kstFromJulian(jd: number): SolarInstant {
  const ms = (jd - UNIX_JD) * MS_PER_DAY + 9 * 60 * 60 * 1000;
  const kst = new Date(Math.round(ms / 60000) * 60000);
  return {
    year: kst.getUTCFullYear(),
    month: kst.getUTCMonth() + 1,
    day: kst.getUTCDate(),
    hour: kst.getUTCHours(),
    minute: kst.getUTCMinutes(),
  };
}

export function compareKst(a: SolarInstant, b: SolarInstant): number {
  return julianFromKst(a) - julianFromKst(b);
}

/**
 * Meeus 기반 진태양 황경(도). 명리 공식이 아니라 천문 근사다.
 */
export function sunApparentLongitude(jd: number): number {
  const T = (jd - J2000) / 36525;
  const T2 = T * T;
  const T3 = T2 * T;
  const L0 = mod360(280.4664567 + 36000.76982779 * T + 0.0003032028 * T2 + T3 / 49931000);
  const M = mod360(357.52910918 + 35999.0502919 * T - 0.0001537 * T2 + T3 / 24490000);
  const Mr = deg2rad(M);
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T2) * Math.sin(Mr) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * Mr) +
    0.000289 * Math.sin(3 * Mr);
  const trueLongitude = mod360(L0 + C);
  const omega = 125.04 - 1934.136 * T;
  return mod360(trueLongitude - 0.00569 - 0.00478 * Math.sin(deg2rad(omega)));
}

const MEAN_SOLAR_DEGREES_PER_DAY = 360 / 365.2422;
const MAX_SEARCH_DRIFT_DAYS = 8;

/**
 * 해당 연 1월 1일의 실제 태양황경에서 목표 황경까지 남은 각도로
 * 그 절기의 연중 위치를 추정한다. 입춘을 1월 1일로 두지 않는다.
 */
function approximateTermJd(year: number, target: number): number {
  const jan1 = julianFromKst({ year, month: 1, day: 1, hour: 12, minute: 0 });
  const lon0 = sunApparentLongitude(jan1);
  const degreesAhead = (target - lon0 + 360) % 360;
  return jan1 + degreesAhead / MEAN_SOLAR_DEGREES_PER_DAY;
}

function findLongitudeInstant(aroundJd: number, target: number): number {
  let jd = aroundJd;
  for (let i = 0; i < 16; i++) {
    const error = longitudeDelta(sunApparentLongitude(jd), target);
    jd -= error / MEAN_SOLAR_DEGREES_PER_DAY;
  }

  const drifted = Math.abs(jd - aroundJd);
  if (drifted > MAX_SEARCH_DRIFT_DAYS) {
    throw new Error(`절기 탐색이 연초 황경 추정에서 ${drifted.toFixed(1)}일 벗어났습니다.`);
  }

  return jd;
}

const termCache = new Map<string, SolarInstant>();

export function solarTermInstant(year: number, name: SolarTermName): SolarInstant {
  const key = `${year}:${name}`;
  const cached = termCache.get(key);
  if (cached) return cached;

  const term = SOLAR_TERMS.find((item) => item.name === name);
  if (!term) {
    throw new Error(`Unknown solar term: ${name}`);
  }

  const instant = kstFromJulian(findLongitudeInstant(approximateTermJd(year, term.longitude), term.longitude));
  termCache.set(key, instant);
  return instant;
}

export function lichunInstant(year: number): SolarInstant {
  return solarTermInstant(year, "입춘");
}

export function jieTermAt(instant: SolarInstant): {
  name: SolarTermName;
  monthBranch: MonthBranch;
  startedAt: SolarInstant;
} {
  const jd = julianFromKst(instant);
  let bestName: SolarTermName = "소한";
  let bestBranch: MonthBranch = "丑";
  let bestStarted = solarTermInstant(instant.year - 1, "소한");
  let bestJd = julianFromKst(bestStarted);

  for (const offsetYear of [instant.year - 1, instant.year, instant.year + 1]) {
    for (const term of JIE_TERMS) {
      if (!term.monthBranch) continue;
      const startedAt = solarTermInstant(offsetYear, term.name);
      const startJd = julianFromKst(startedAt);
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
