import type { JulianDayTt } from "@/lib/saju/validation/experimental/timeScales";
import { julianCenturyTt } from "@/lib/saju/validation/experimental/timeScales";

/**
 * IAU 1980 nutation (Wahr/Seidelmann).
 * Coefficients from ERFA eraNut80 / IAU SOFA nut80, units 0.1 mas.
 * Arguments: multiples of l, l′, F, D, Ω (Moon anomaly, Sun anomaly, F, D, node).
 * Reference: Explanatory Supplement (Seidelmann 1992) §3.222.
 */
const IAU_1980_NUTATION: ReadonlyArray<readonly [number, number, number, number, number, number, number, number, number]> = [
  [0, 0, 0, 0, 1, -171996, -174.2, 92025, 8.9],
  [0, 0, 0, 0, 2, 2062, 0.2, -895, 0.5],
  [-2, 0, 2, 0, 1, 46, 0, -24, 0],
  [2, 0, -2, 0, 0, 11, 0, 0, 0],
  [-2, 0, 2, 0, 2, -3, 0, 1, 0],
  [1, -1, 0, -1, 0, -3, 0, 0, 0],
  [0, -2, 2, -2, 1, -2, 0, 1, 0],
  [2, 0, -2, 0, 1, 1, 0, 0, 0],
  [0, 0, 2, -2, 2, -13187, -1.6, 5736, -3.1],
  [0, 1, 0, 0, 0, 1426, -3.4, 54, -0.1],
  [0, 1, 2, -2, 2, -517, 1.2, 224, -0.6],
  [0, -1, 2, -2, 2, 217, -0.5, -95, 0.3],
  [0, 0, 2, -2, 1, 129, 0.1, -70, 0],
  [2, 0, 0, -2, 0, 48, 0, 1, 0],
  [0, 0, 2, -2, 0, -22, 0, 0, 0],
  [0, 2, 0, 0, 0, 17, -0.1, 0, 0],
  [0, 1, 0, 0, 1, -15, 0, 9, 0],
  [0, 2, 2, -2, 2, -16, 0.1, 7, 0],
  [0, -1, 0, 0, 1, -12, 0, 6, 0],
  [-2, 0, 0, 2, 1, -6, 0, 3, 0],
  [0, -1, 2, -2, 1, -5, 0, 3, 0],
  [2, 0, 0, -2, 1, 4, 0, -2, 0],
  [0, 1, 2, -2, 1, 4, 0, -2, 0],
  [1, 0, 0, -1, 0, -4, 0, 0, 0],
  [2, 1, 0, -2, 0, 1, 0, 0, 0],
  [0, 0, -2, 2, 1, 1, 0, 0, 0],
  [0, 1, -2, 2, 0, -1, 0, 0, 0],
  [0, 1, 0, 0, 2, 1, 0, 0, 0],
  [-1, 0, 0, 1, 1, 1, 0, 0, 0],
  [0, 1, 2, -2, 0, -1, 0, 0, 0],
  [0, 0, 2, 0, 2, -2274, -0.2, 977, -0.5],
  [1, 0, 0, 0, 0, 712, 0.1, -7, 0],
  [0, 0, 2, 0, 1, -386, -0.4, 200, 0],
  [1, 0, 2, 0, 2, -301, 0, 129, -0.1],
  [1, 0, 0, -2, 0, -158, 0, -1, 0],
  [-1, 0, 2, 0, 2, 123, 0, -53, 0],
  [0, 0, 0, 2, 0, 63, 0, -2, 0],
  [1, 0, 0, 0, 1, 63, 0.1, -33, 0],
  [-1, 0, 0, 0, 1, -58, -0.1, 32, 0],
  [-1, 0, 2, 2, 2, -59, 0, 26, 0],
  [1, 0, 2, 0, 1, -51, 0, 27, 0],
  [0, 0, 2, 2, 2, -38, 0, 16, 0],
  [2, 0, 0, 0, 0, 29, 0, -1, 0],
  [1, 0, 2, -2, 2, 29, 0, -12, 0],
  [2, 0, 2, 0, 2, -31, 0, 13, 0],
  [0, 0, 2, 0, 0, 26, 0, -1, 0],
  [-1, 0, 2, 0, 1, 21, 0, -10, 0],
  [-1, 0, 0, 2, 1, 16, 0, -8, 0],
  [1, 0, 0, -2, 1, -13, 0, 7, 0],
  [-1, 0, 2, 2, 1, -10, 0, 5, 0],
  [1, 1, 0, -2, 0, -7, 0, 0, 0],
  [0, 1, 2, 0, 2, 7, 0, -3, 0],
  [0, -1, 2, 0, 2, -7, 0, 3, 0],
  [1, 0, 2, 2, 2, -8, 0, 3, 0],
  [1, 0, 0, 2, 0, 6, 0, 0, 0],
  [2, 0, 2, -2, 2, 6, 0, -3, 0],
  [0, 0, 0, 2, 1, -6, 0, 3, 0],
  [0, 0, 2, 2, 1, -7, 0, 3, 0],
  [1, 0, 2, -2, 1, 6, 0, -3, 0],
  [0, 0, 0, -2, 1, -5, 0, 3, 0],
  [1, -1, 0, 0, 0, 5, 0, 0, 0],
  [2, 0, 2, 0, 1, -5, 0, 3, 0],
  [0, 1, 0, -2, 0, -4, 0, 0, 0],
  [1, 0, -2, 0, 0, 4, 0, 0, 0],
  [0, 0, 0, 1, 0, -4, 0, 0, 0],
  [1, 1, 0, 0, 0, -3, 0, 0, 0],
  [1, 0, 2, 0, 0, 3, 0, 0, 0],
  [1, -1, 2, 0, 2, -3, 0, 1, 0],
  [-1, -1, 2, 2, 2, -3, 0, 1, 0],
  [-2, 0, 0, 0, 1, -2, 0, 1, 0],
  [3, 0, 2, 0, 2, -3, 0, 1, 0],
  [0, -1, 2, 2, 2, -3, 0, 1, 0],
  [1, 1, 2, 0, 2, 2, 0, -1, 0],
  [-1, 0, 2, -2, 1, -2, 0, 1, 0],
  [2, 0, 0, 0, 1, 2, 0, -1, 0],
  [1, 0, 0, 0, 2, -2, 0, 1, 0],
  [3, 0, 0, 0, 0, 2, 0, 0, 0],
  [0, 0, 2, 1, 2, 2, 0, -1, 0],
  [-1, 0, 0, 0, 2, 1, 0, -1, 0],
  [1, 0, 0, -4, 0, -1, 0, 0, 0],
  [-2, 0, 2, 2, 2, 1, 0, -1, 0],
  [-1, 0, 2, 4, 2, -2, 0, 1, 0],
  [2, 0, 0, -4, 0, -1, 0, 0, 0],
  [1, 1, 2, -2, 2, 1, 0, -1, 0],
  [1, 0, 2, 2, 1, -1, 0, 1, 0],
  [-2, 0, 2, 4, 2, -1, 0, 1, 0],
  [-1, 0, 4, 0, 2, 1, 0, 0, 0],
  [1, -1, 0, -2, 0, 1, 0, 0, 0],
  [2, 0, 2, -2, 1, 1, 0, -1, 0],
  [2, 0, 2, 2, 2, -1, 0, 0, 0],
  [1, 0, 0, 2, 1, -1, 0, 0, 0],
  [0, 0, 4, -2, 2, 1, 0, 0, 0],
  [3, 0, 2, -2, 2, 1, 0, 0, 0],
  [1, 0, 2, -2, 0, -1, 0, 0, 0],
  [0, 1, 2, 0, 1, 1, 0, 0, 0],
  [-1, -1, 0, 2, 1, 1, 0, 0, 0],
  [0, 0, -2, 0, 1, -1, 0, 0, 0],
  [0, 0, 2, -1, 2, -1, 0, 0, 0],
  [0, 1, 0, 2, 0, -1, 0, 0, 0],
  [1, 0, -2, -2, 0, -1, 0, 0, 0],
  [0, -1, 2, 0, 1, -1, 0, 0, 0],
  [1, 1, 0, -2, 1, -1, 0, 0, 0],
  [1, 0, -2, 2, 0, -1, 0, 0, 0],
  [2, 0, 0, 2, 0, 1, 0, 0, 0],
  [0, 0, 2, 4, 2, -1, 0, 0, 0],
  [0, 1, 0, 1, 0, 1, 0, 0, 0],
];

const ARCSEC_PER_REVOLUTION = 1_296_000;
const DEG2RAD = Math.PI / 180;

function wrap360(deg: number): number {
  const value = deg % 360;
  return value < 0 ? value + 360 : value;
}

function meanMoonAnomalyDeg(T: number): number {
  return wrap360(134.96298 + 477198.867398 * T + 0.0086972 * T * T + (T * T * T) / 56250);
}

function meanSunAnomalyDeg(T: number): number {
  return wrap360(357.52772 + 35999.05034 * T - 0.0001603 * T * T - (T * T * T) / 300000);
}

function meanArgumentOfLatitudeDeg(T: number): number {
  return wrap360(93.27191 + 483202.017538 * T - 0.0036825 * T * T + (T * T * T) / 327270);
}

function meanElongationDeg(T: number): number {
  return wrap360(297.85036 + 445267.11148 * T - 0.0019142 * T * T + (T * T * T) / 189474);
}

function lunarNodeDeg(T: number): number {
  return wrap360(125.04452 - 1934.136261 * T + 0.0020708 * T * T + (T * T * T) / 450000);
}

export type Nutation = {
  deltaPsiArcsec: number;
  deltaEpsilonArcsec: number;
};

export function nutationIau1980(jdTt: JulianDayTt): Nutation {
  const T = julianCenturyTt(jdTt);
  const l = meanMoonAnomalyDeg(T) * DEG2RAD;
  const lp = meanSunAnomalyDeg(T) * DEG2RAD;
  const f = meanArgumentOfLatitudeDeg(T) * DEG2RAD;
  const d = meanElongationDeg(T) * DEG2RAD;
  const om = lunarNodeDeg(T) * DEG2RAD;

  let dp = 0;
  let de = 0;
  for (const [nl, nlp, nf, nd, nom, sp, spt, ce, cet] of IAU_1980_NUTATION) {
    const arg = nl * l + nlp * lp + nf * f + nd * d + nom * om;
    dp += (sp + spt * T) * Math.sin(arg);
    de += (ce + cet * T) * Math.cos(arg);
  }

  return {
    deltaPsiArcsec: dp / 10_000,
    deltaEpsilonArcsec: de / 10_000,
  };
}

export function meanObliquityArcsec(jdTt: JulianDayTt): number {
  const T = julianCenturyTt(jdTt);
  return 84381.448 - 46.815 * T - 0.00059 * T * T + 0.001813 * T * T * T;
}

/** Unused by apparent longitude (ecliptic of date); kept to document the IAU 1980 frame. */
export function arcsecToDegrees(arcsec: number): number {
  return arcsec / ARCSEC_PER_REVOLUTION * 360;
}
