import { VSOP87D_EARTH } from "@/lib/saju/validation/experimental/vsop87dEarth";
import { nutationIau1980 } from "@/lib/saju/validation/experimental/nutation1980";
import { julianMillenniumTt, type JulianDayTt } from "@/lib/saju/validation/experimental/timeScales";

const TWO_PI = 2 * Math.PI;
const ABERRATION_ARCSEC = 20.4898;
const FK5_LONGITUDE_ARCSEC = 0.09033;

function wrapTwoPi(rad: number): number {
  const value = rad % TWO_PI;
  return value < 0 ? value + TWO_PI : value;
}

function sumVsop(series: ReadonlyArray<ReadonlyArray<readonly [number, number, number]>>, T: number): number {
  let total = 0;
  let power = 1;
  for (let p = 0; p < series.length; p++) {
    if (p > 0) power *= T;
    let sum = 0;
    const terms = series[p];
    for (const [A, B, C] of terms) {
      sum += A * Math.cos(B + C * T);
    }
    total += p === 0 ? sum : sum * power;
  }
  return total;
}

export type SunApparentLongitudeV2 = {
  /** Earth heliocentric ecliptic longitude, equinox of date (rad). */
  earthHeliocentricLongitudeRad: number;
  /** Earth heliocentric latitude (rad). */
  earthHeliocentricLatitudeRad: number;
  /** Earth–Sun distance (AU). */
  radiusAu: number;
  /** Geocentric geometric ecliptic longitude of the Sun, equinox of date (deg). */
  geometricLongitudeDeg: number;
  /** IAU 1980 nutation in longitude (arcsec). Applied once. */
  nutationDeltaPsiArcsec: number;
  /** Annual aberration −20.4898″/R (arcsec). Not stacked on Meeus v1 −0.00569°. */
  aberrationArcsec: number;
  /** Apparent geocentric ecliptic longitude of date (deg, 0–360). */
  apparentLongitudeDeg: number;
};

/**
 * Apparent geocentric ecliptic longitude of the Sun.
 *
 * Pipeline (each correction once):
 * 1. VSOP87D Earth L,B,R at TT (heliocentric, ecliptic/equinox of date)
 * 2. geometric Sun = Earth L + 180°
 * 3. FK5 dynamical-to-FK5 offset −0.09033″ (Meeus AA ch.32)
 * 4. IAU 1980 nutation in longitude Δψ
 * 5. aberration −20.4898″/R
 *
 * Does not reuse Meeus v1 −0.00569 − 0.00478 sin Ω.
 */
export function sunApparentLongitudeV2Details(jdTt: JulianDayTt): SunApparentLongitudeV2 {
  const T = julianMillenniumTt(jdTt);
  const earthL = wrapTwoPi(sumVsop(VSOP87D_EARTH.l, T));
  const earthB = sumVsop(VSOP87D_EARTH.b, T);
  const radiusAu = sumVsop(VSOP87D_EARTH.r, T);
  const geometricLongitudeDeg = (wrapTwoPi(earthL + Math.PI) * 180) / Math.PI;
  const nutation = nutationIau1980(jdTt);
  const aberrationArcsec = -ABERRATION_ARCSEC / radiusAu;
  const apparentLongitudeDeg =
    geometricLongitudeDeg +
    (-FK5_LONGITUDE_ARCSEC + nutation.deltaPsiArcsec + aberrationArcsec) / 3600;

  return {
    earthHeliocentricLongitudeRad: earthL,
    earthHeliocentricLatitudeRad: earthB,
    radiusAu,
    geometricLongitudeDeg,
    nutationDeltaPsiArcsec: nutation.deltaPsiArcsec,
    aberrationArcsec,
    apparentLongitudeDeg: wrap360(apparentLongitudeDeg),
  };
}

function wrap360(deg: number): number {
  const value = deg % 360;
  return value < 0 ? value + 360 : value;
}

export function sunApparentLongitudeV2(jdTt: JulianDayTt): number {
  return sunApparentLongitudeV2Details(jdTt).apparentLongitudeDeg;
}

export function longitudeDeltaDeg(actualDeg: number, targetDeg: number): number {
  return ((actualDeg - targetDeg + 540) % 360) - 180;
}
