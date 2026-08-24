import { deltaTSecondsEspenakMeeus } from "@/lib/saju/validation/experimental/deltaT";
import type { SolarInstant } from "@/lib/saju/types";

const MS_PER_DAY = 86_400_000;
const UNIX_JD = 2_440_587.5;
const J2000_JD = 2_451_545.0;
const SECONDS_PER_DAY = 86_400;
const KST_OFFSET_HOURS = 9;

export type JulianDayUtc = { readonly kind: "utc"; readonly jdUtc: number };
export type JulianDayUt = { readonly kind: "ut"; readonly jdUt: number };
export type JulianDayTt = { readonly kind: "tt"; readonly jdTt: number };

export function jdUtcFromUnixMs(utcMs: number): JulianDayUtc {
  return { kind: "utc", jdUtc: utcMs / MS_PER_DAY + UNIX_JD };
}

/**
 * KST clock → UTC Julian Day. Seconds may be fractional.
 * DST is not applied; KASI 절기 표 is Korea Standard Time (UTC+9).
 */
export function jdUtcFromKst(instant: SolarInstant, second = 0): JulianDayUtc {
  const utcMs = Date.UTC(instant.year, instant.month - 1, instant.day, instant.hour - KST_OFFSET_HOURS, instant.minute, 0, second * 1000);
  return jdUtcFromUnixMs(utcMs);
}

/**
 * UT1 ≈ UTC (DUT1 ignored). Distinct named value so TT is never stored in jdUtc.
 */
export function jdUtFromJdUtc(jdUtc: JulianDayUtc): JulianDayUt {
  return { kind: "ut", jdUt: jdUtc.jdUtc };
}

export function deltaTSecondsAtJdUtc(jdUtc: JulianDayUtc): number {
  const utcMs = (jdUtc.jdUtc - UNIX_JD) * MS_PER_DAY;
  const utc = new Date(utcMs);
  return deltaTSecondsEspenakMeeus(utc.getUTCFullYear(), utc.getUTCMonth() + 1);
}

export function jdTtFromJdUt(jdUt: JulianDayUt, deltaTSeconds: number): JulianDayTt {
  return { kind: "tt", jdTt: jdUt.jdUt + deltaTSeconds / SECONDS_PER_DAY };
}

export function jdUtcFromJdTt(jdTt: JulianDayTt, deltaTSeconds: number): JulianDayUtc {
  return { kind: "utc", jdUtc: jdTt.jdTt - deltaTSeconds / SECONDS_PER_DAY };
}

export function julianCenturyTt(jdTt: JulianDayTt): number {
  return (jdTt.jdTt - J2000_JD) / 36_525;
}

export function julianMillenniumTt(jdTt: JulianDayTt): number {
  return (jdTt.jdTt - J2000_JD) / 365_250;
}

export function unixMsFromJdUtc(jdUtc: JulianDayUtc): number {
  return (jdUtc.jdUtc - UNIX_JD) * MS_PER_DAY;
}

/**
 * UTC JD → KST civil clock. Round to the nearest minute only here.
 */
export function kstMinuteFromJdUtc(jdUtc: JulianDayUtc): SolarInstant {
  const kstMs = unixMsFromJdUtc(jdUtc) + KST_OFFSET_HOURS * 60 * 60 * 1000;
  const rounded = new Date(Math.round(kstMs / 60_000) * 60_000);
  return {
    year: rounded.getUTCFullYear(),
    month: rounded.getUTCMonth() + 1,
    day: rounded.getUTCDate(),
    hour: rounded.getUTCHours(),
    minute: rounded.getUTCMinutes(),
  };
}

export function kstFromJdTt(jdTt: JulianDayTt, deltaTSeconds: number): SolarInstant {
  return kstMinuteFromJdUtc(jdUtcFromJdTt(jdTt, deltaTSeconds));
}

export type KstClockRaw = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** Seconds including fraction, 0 ≤ value < 60. Not rounded to a minute. */
  second: number;
  unixMs: number;
};

/**
 * UTC JD → KST civil clock with seconds. Does not round to the minute.
 * Display rounding stays in kstMinuteFromJdUtc only.
 */
export function kstClockFromJdUtc(jdUtc: JulianDayUtc): KstClockRaw {
  const kstMs = unixMsFromJdUtc(jdUtc) + KST_OFFSET_HOURS * 60 * 60 * 1000;
  const wholeMs = Math.floor(kstMs);
  const clock = new Date(wholeMs);
  const second = clock.getUTCSeconds() + (clock.getUTCMilliseconds() + (kstMs - wholeMs)) / 1000;
  return {
    year: clock.getUTCFullYear(),
    month: clock.getUTCMonth() + 1,
    day: clock.getUTCDate(),
    hour: clock.getUTCHours(),
    minute: clock.getUTCMinutes(),
    second,
    unixMs: kstMs,
  };
}

export function kstClockFromJdTt(jdTt: JulianDayTt, deltaTSeconds: number): KstClockRaw {
  return kstClockFromJdUtc(jdUtcFromJdTt(jdTt, deltaTSeconds));
}

export function formatKstClock(clock: KstClockRaw): string {
  const pad = (value: number, width = 2) => String(value).padStart(width, "0");
  const wholeSecond = Math.floor(clock.second);
  const millis = Math.round((clock.second - wholeSecond) * 1000);
  return `${clock.year}-${pad(clock.month)}-${pad(clock.day)} ${pad(clock.hour)}:${pad(clock.minute)}:${pad(wholeSecond)}.${pad(millis, 3)}`;
}
