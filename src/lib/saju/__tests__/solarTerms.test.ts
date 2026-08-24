import { describe, expect, it } from "vitest";
import { compareKst, lichunInstant, solarTermInstant } from "@/lib/saju/calendar/solarTerms";
import { SOLAR_TERMS } from "@/lib/saju/data/solarTerms";
import type { SolarInstant, SolarTermName } from "@/lib/saju/types";

const YEAR_ORDER_2020: readonly SolarTermName[] = [
  "소한",
  "대한",
  "입춘",
  "우수",
  "경칩",
  "춘분",
  "청명",
  "곡우",
  "입하",
  "소만",
  "망종",
  "하지",
  "소서",
  "대서",
  "입추",
  "처서",
  "백로",
  "추분",
  "한로",
  "상강",
  "입동",
  "소설",
  "대설",
  "동지",
];

/** 2020 KASI 역서(한국표준시). 날짜가 하루 이상 다르면 실패로 본다. */
const KASI_2020: Record<SolarTermName, SolarInstant> = {
  소한: { year: 2020, month: 1, day: 6, hour: 6, minute: 30 },
  대한: { year: 2020, month: 1, day: 20, hour: 23, minute: 55 },
  입춘: { year: 2020, month: 2, day: 4, hour: 18, minute: 3 },
  우수: { year: 2020, month: 2, day: 19, hour: 13, minute: 57 },
  경칩: { year: 2020, month: 3, day: 5, hour: 11, minute: 57 },
  춘분: { year: 2020, month: 3, day: 20, hour: 12, minute: 50 },
  청명: { year: 2020, month: 4, day: 4, hour: 16, minute: 38 },
  곡우: { year: 2020, month: 4, day: 19, hour: 23, minute: 45 },
  입하: { year: 2020, month: 5, day: 5, hour: 9, minute: 51 },
  소만: { year: 2020, month: 5, day: 20, hour: 22, minute: 49 },
  망종: { year: 2020, month: 6, day: 5, hour: 13, minute: 58 },
  하지: { year: 2020, month: 6, day: 21, hour: 6, minute: 44 },
  소서: { year: 2020, month: 7, day: 7, hour: 0, minute: 14 },
  대서: { year: 2020, month: 7, day: 22, hour: 17, minute: 37 },
  입추: { year: 2020, month: 8, day: 7, hour: 10, minute: 6 },
  처서: { year: 2020, month: 8, day: 23, hour: 0, minute: 45 },
  백로: { year: 2020, month: 9, day: 7, hour: 13, minute: 8 },
  추분: { year: 2020, month: 9, day: 22, hour: 22, minute: 31 },
  한로: { year: 2020, month: 10, day: 8, hour: 4, minute: 55 },
  상강: { year: 2020, month: 10, day: 23, hour: 8, minute: 0 },
  입동: { year: 2020, month: 11, day: 7, hour: 8, minute: 14 },
  소설: { year: 2020, month: 11, day: 22, hour: 5, minute: 40 },
  대설: { year: 2020, month: 12, day: 7, hour: 1, minute: 9 },
  동지: { year: 2020, month: 12, day: 21, hour: 19, minute: 2 },
};

function kstMinutes(instant: SolarInstant): number {
  return Date.UTC(instant.year, instant.month - 1, instant.day, instant.hour, instant.minute) / 60000;
}

describe("2020 24절기 연중 순서", () => {
  it("increases strictly through the calendar year", () => {
    const instants = YEAR_ORDER_2020.map((name) => solarTermInstant(2020, name));
    for (let index = 1; index < instants.length; index++) {
      expect(compareKst(instants[index - 1], instants[index])).toBeLessThan(0);
    }
  });

  it("does not invert 경칩/입하/입추/입동", () => {
    expect(compareKst(solarTermInstant(2020, "입춘"), solarTermInstant(2020, "경칩"))).toBeLessThan(0);
    expect(solarTermInstant(2020, "입하").month).toBe(5);
    expect(solarTermInstant(2020, "입추").month).toBe(8);
    expect(solarTermInstant(2020, "입동").month).toBe(11);
  });
});

describe("2020 KASI 날짜 대조", () => {
  it.each(SOLAR_TERMS.map((term) => [term.name, term.longitude] as const))(
    "%s (%d°) stays on the KASI calendar day",
    (name) => {
      const computed = solarTermInstant(2020, name);
      const kasi = KASI_2020[name];
      expect({ year: computed.year, month: computed.month, day: computed.day }).toEqual({
        year: kasi.year,
        month: kasi.month,
        day: kasi.day,
      });
      expect(Math.abs(kstMinutes(computed) - kstMinutes(kasi))).toBeLessThanOrEqual(15);
    },
  );
});

describe("입춘 위치 범위", () => {
  it("places 입춘 between February 3 and 5 in KST", () => {
    for (const year of [1900, 1984, 2000, 2020, 2024, 2100]) {
      const lichun = lichunInstant(year);
      expect(lichun.month).toBe(2);
      expect(lichun.day).toBeGreaterThanOrEqual(3);
      expect(lichun.day).toBeLessThanOrEqual(5);
    }
  });
});
