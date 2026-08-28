/**
 * Local mean time (LMT / 지방시) for hour-pillar calculation only.
 *
 * Three hour-time standards (do not mix names):
 * 1) KST wall clock — input Asia/Seoul civil time (default when no birthPlace)
 * 2) LMT — wall + longitude offset vs 135°E; THIS MODULE implements (2)
 * 3) True solar (진태양시) — LMT + equation of time (EOT); NOT implemented
 *
 * Policy (v1):
 * - Year / month / day pillars: always KST wall SolarInstant
 * - Hour pillar: optional LMT clock’s hour → hourPillar (2-hour blocks unchanged)
 * - Offset minutes = (longitudeEast − standardMeridianEast) × 4
 * - Math.round applied when folding offset into clock minutes
 *
 * Future (out of scope here): region catalog, EOT / true solar.
 */

import { longitudeEastForPlaceId } from "@/lib/saju/data/birthPlaces";
import type { BirthPlaceRef, ClockTime, SolarInstant } from "@/lib/saju/types";

/** Korea Standard Time legal meridian (UTC+9). */
export const KOREA_STANDARD_MERIDIAN_EAST_DEG = 135;

export type HourCalcClockResolution = {
  /** KST (timezone) wall clock from SolarInstant — never EOT-adjusted. */
  wallClock: ClockTime;
  /**
   * Clock fed into hourPillar.
   * - LMT when longitude correction applied
   * - else same as wallClock
   * Not true solar time (no equation of time).
   */
  hourCalcClock: ClockTime;
  /** Resolved east longitude, if any. */
  longitudeEast: number | null;
  /** Standard meridian used for the offset. */
  standardMeridianEast: number;
  /** (longitude − meridian) × 4, minutes. Null when not applied. */
  offsetMinutes: number | null;
  /** True when longitude was resolved and offset applied. */
  applied: boolean;
  reason: "longitude-lmt" | "no-birth-place" | "unresolved-place";
};

export function resolveBirthLongitudeEast(place: BirthPlaceRef | undefined): number | null {
  if (!place) return null;
  if (typeof place.longitudeEast === "number" && Number.isFinite(place.longitudeEast)) {
    return place.longitudeEast;
  }
  if (place.id) {
    return longitudeEastForPlaceId(place.id);
  }
  return null;
}

/** Longitude correction in minutes (east of meridian → positive / later). */
export function longitudeOffsetMinutes(
  longitudeEast: number,
  standardMeridianEast: number = KOREA_STANDARD_MERIDIAN_EAST_DEG,
): number {
  return (longitudeEast - standardMeridianEast) * 4;
}

/**
 * Apply a minute offset to a clock, wrapping within 24h.
 * Day wrap does not feed back into year/month/day pillars (caller responsibility).
 */
export function applyMinuteOffsetToClock(clock: ClockTime, offsetMinutes: number): ClockTime {
  const total = clock.hour * 60 + clock.minute + Math.round(offsetMinutes);
  const dayMinutes = 24 * 60;
  const wrapped = ((total % dayMinutes) + dayMinutes) % dayMinutes;
  return {
    hour: Math.floor(wrapped / 60),
    minute: wrapped % 60,
  };
}

export function wallClockFromInstant(instant: SolarInstant): ClockTime {
  return { hour: instant.hour, minute: instant.minute };
}

/**
 * Resolve the clock used for hourPillar only.
 * Without a resolvable longitude, returns wall clock (legacy behavior).
 */
export function resolveHourCalcClock(
  instant: SolarInstant,
  birthPlace?: BirthPlaceRef,
  standardMeridianEast: number = KOREA_STANDARD_MERIDIAN_EAST_DEG,
): HourCalcClockResolution {
  const wallClock = wallClockFromInstant(instant);
  const longitudeEast = resolveBirthLongitudeEast(birthPlace);

  if (!birthPlace) {
    return {
      wallClock,
      hourCalcClock: wallClock,
      longitudeEast: null,
      standardMeridianEast,
      offsetMinutes: null,
      applied: false,
      reason: "no-birth-place",
    };
  }

  if (longitudeEast === null) {
    return {
      wallClock,
      hourCalcClock: wallClock,
      longitudeEast: null,
      standardMeridianEast,
      offsetMinutes: null,
      applied: false,
      reason: "unresolved-place",
    };
  }

  const offsetMinutes = longitudeOffsetMinutes(longitudeEast, standardMeridianEast);
  const hourCalcClock = applyMinuteOffsetToClock(wallClock, offsetMinutes);

  return {
    wallClock,
    hourCalcClock,
    longitudeEast,
    standardMeridianEast,
    offsetMinutes,
    applied: true,
    reason: "longitude-lmt",
  };
}
