import { describe, expect, it } from "vitest";
import { buildFourPillars } from "@/lib/saju";
import { lichunInstant, solarTermInstant } from "@/lib/saju/calendar/solarTerms";
import { toSolarInstant } from "@/lib/saju/calendar/toSolar";
import { JIE_TERMS } from "@/lib/saju/data/solarTerms";
import type { BirthInput, Pillar, SolarInstant } from "@/lib/saju/types";

function solar(year: number, month: number, day: number, hour: number, minute: number, extra?: Partial<BirthInput>): BirthInput {
  return {
    calendar: "solar",
    year,
    month,
    day,
    isLeapMonth: false,
    time: { hour, minute },
    ...extra,
  };
}

function shiftKst(instant: SolarInstant, minuteDelta: number): SolarInstant {
  const shifted = new Date(
    Date.UTC(instant.year, instant.month - 1, instant.day, instant.hour, instant.minute + minuteDelta),
  );
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

const JIE_MONTH_AFTER_2020: Record<string, Pillar> = {
  입춘: { stem: "戊", branch: "寅" },
  경칩: { stem: "己", branch: "卯" },
  청명: { stem: "庚", branch: "辰" },
  입하: { stem: "辛", branch: "巳" },
  망종: { stem: "壬", branch: "午" },
  소서: { stem: "癸", branch: "未" },
  입추: { stem: "甲", branch: "申" },
  백로: { stem: "乙", branch: "酉" },
  한로: { stem: "丙", branch: "戌" },
  입동: { stem: "丁", branch: "亥" },
  대설: { stem: "戊", branch: "子" },
  소한: { stem: "丁", branch: "丑" },
};

const JIE_MONTH_BEFORE_2020: Record<string, Pillar> = {
  입춘: { stem: "丁", branch: "丑" },
  경칩: { stem: "戊", branch: "寅" },
  청명: { stem: "己", branch: "卯" },
  입하: { stem: "庚", branch: "辰" },
  망종: { stem: "辛", branch: "巳" },
  소서: { stem: "壬", branch: "午" },
  입추: { stem: "癸", branch: "未" },
  백로: { stem: "甲", branch: "申" },
  한로: { stem: "乙", branch: "酉" },
  입동: { stem: "丙", branch: "戌" },
  대설: { stem: "丁", branch: "亥" },
  소한: { stem: "丙", branch: "子" },
};

describe("입춘 직전/직후 (엔진이 구한 절입 시각 기준)", () => {
  it("changes year and month pillars across the computed 입춘", () => {
    const lichun = lichunInstant(2020);
    const before = shiftKst(lichun, -1);
    const after = shiftKst(lichun, 0);
    const beforePillars = buildFourPillars(solar(before.year, before.month, before.day, before.hour, before.minute));
    const afterPillars = buildFourPillars(solar(after.year, after.month, after.day, after.hour, after.minute));
    expect(beforePillars.year).toEqual({ stem: "己", branch: "亥" });
    expect(afterPillars.year).toEqual({ stem: "庚", branch: "子" });
    expect(beforePillars.month).toEqual({ stem: "丁", branch: "丑" });
    expect(afterPillars.month).toEqual({ stem: "戊", branch: "寅" });
  });
});

describe("12절 월주 경계 (절입 1분 전/후)", () => {
  it.each(JIE_TERMS.map((term) => term.name))("%s changes the full month pillar", (name) => {
    const startedAt = solarTermInstant(2020, name);
    const before = shiftKst(startedAt, -1);
    const after = shiftKst(startedAt, 0);
    const beforePillars = buildFourPillars(solar(before.year, before.month, before.day, before.hour, before.minute));
    const afterPillars = buildFourPillars(solar(after.year, after.month, after.day, after.hour, after.minute));
    expect(beforePillars.month).toEqual(JIE_MONTH_BEFORE_2020[name]);
    expect(afterPillars.month).toEqual(JIE_MONTH_AFTER_2020[name]);
  });
});

describe("시진·일주 시각 경계 (현재 기본값 night_ja 동작)", () => {
  it("keeps the civil day pillar from 00:00 through 22:59", () => {
    const samples = [
      [0, 0],
      [0, 59],
      [1, 0],
      [22, 59],
    ] as const;
    for (const [hour, minute] of samples) {
      const result = buildFourPillars(solar(2000, 1, 1, hour, minute));
      expect(result.day).toEqual({ stem: "戊", branch: "午" });
    }
  });

  it("uses the next civil day pillar at 23:00 and 23:59 under night_ja", () => {
    for (const [hour, minute] of [
      [23, 0],
      [23, 59],
    ] as const) {
      const result = buildFourPillars(solar(2000, 1, 1, hour, minute));
      expect(result.day).toEqual({ stem: "己", branch: "未" });
    }
  });

  it("does not advance the day pillar at 23:00 when dayBoundary is early_ja", () => {
    const night = buildFourPillars(solar(2000, 1, 1, 23, 0, { dayBoundary: "night_ja" }));
    const early = buildFourPillars(solar(2000, 1, 1, 23, 0, { dayBoundary: "early_ja" }));
    expect(night.day).toEqual({ stem: "己", branch: "未" });
    expect(early.day).toEqual({ stem: "戊", branch: "午" });
  });

  it("maps hour branches around 자/축", () => {
    expect(buildFourPillars(solar(2000, 1, 1, 22, 59)).hour).toMatchObject({ branch: "亥" });
    expect(buildFourPillars(solar(2000, 1, 1, 23, 0)).hour).toMatchObject({ branch: "子" });
    expect(buildFourPillars(solar(2000, 1, 1, 0, 59)).hour).toMatchObject({ branch: "子" });
    expect(buildFourPillars(solar(2000, 1, 1, 1, 0)).hour).toMatchObject({ branch: "丑" });
  });
});

describe("음력 평달 / 윤달", () => {
  it("converts 2020 설날 and regular vs leap month 4 to different solar dates", () => {
    const seollal = toSolarInstant({
      calendar: "lunar",
      year: 2020,
      month: 1,
      day: 1,
      isLeapMonth: false,
      time: { hour: 0, minute: 0 },
    });
    const month4 = toSolarInstant({
      calendar: "lunar",
      year: 2020,
      month: 4,
      day: 1,
      isLeapMonth: false,
      time: { hour: 0, minute: 0 },
    });
    const leap4 = toSolarInstant({
      calendar: "lunar",
      year: 2020,
      month: 4,
      day: 1,
      isLeapMonth: true,
      time: { hour: 0, minute: 0 },
    });
    expect(seollal).toMatchObject({ year: 2020, month: 1, day: 25 });
    expect(month4).toMatchObject({ year: 2020, month: 4, day: 23 });
    expect(leap4).toMatchObject({ year: 2020, month: 5, day: 23 });
  });
});

describe("연말 / 연초", () => {
  it("keeps the same year pillar from Dec 31 to Jan 1 when both are before 입춘", () => {
    const dec = buildFourPillars(solar(1990, 12, 31, 12, 0));
    const jan = buildFourPillars(solar(1991, 1, 1, 12, 0));
    expect(dec.year).toEqual(jan.year);
    expect(dec.year).toEqual({ stem: "庚", branch: "午" });
  });
});

describe("출생시간 unknown", () => {
  it("does not confirm an hour pillar and uses 00:00 only for date-based pillars", () => {
    const unknown = buildFourPillars({
      calendar: "solar",
      year: 2020,
      month: 2,
      day: 4,
      isLeapMonth: false,
      time: "unknown",
    });
    const midnight = buildFourPillars(solar(2020, 2, 4, 0, 0));
    expect(unknown.hour).toBe("unknown");
    expect(unknown.hourCertainty).toBe("unknown");
    expect(unknown.year).toEqual(midnight.year);
    expect(unknown.month).toEqual(midnight.month);
    expect(unknown.day).toEqual(midnight.day);
  });
});

describe("지원 연도 경계", () => {
  it("accepts 1900-01-01 and 2100-12-31", () => {
    expect(() => buildFourPillars(solar(1900, 1, 1, 8, 0))).not.toThrow();
    expect(() => buildFourPillars(solar(2100, 12, 31, 8, 0))).not.toThrow();
  });

  it("rejects 1899 and 2101", () => {
    expect(() => buildFourPillars(solar(1899, 12, 31, 8, 0))).toThrow("범위");
    expect(() => buildFourPillars(solar(2101, 1, 1, 8, 0))).toThrow("범위");
  });
});
