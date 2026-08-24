import { describe, expect, it } from "vitest";
import { buildFourPillars } from "@/lib/saju";
import { GANZHI60, ganzhiByIndex } from "@/lib/saju/constants/ganzhi";
import type { BirthInput, Pillar } from "@/lib/saju/types";

function solarNoon(year: number, month: number, day: number): BirthInput {
  return {
    calendar: "solar",
    year,
    month,
    day,
    isLeapMonth: false,
    time: { hour: 12, minute: 0 },
  };
}

function dayAt(year: number, month: number, day: number, hour = 12, minute = 0): Pillar {
  const result = buildFourPillars({
    calendar: "solar",
    year,
    month,
    day,
    isLeapMonth: false,
    time: { hour, minute },
  });
  if (result.day === "unknown") {
    throw new Error("day pillar missing");
  }
  return result.day;
}

function nextGanzhi(pillar: Pillar): Pillar {
  const index = GANZHI60.findIndex((item) => item.stem === pillar.stem && item.branch === pillar.branch);
  return ganzhiByIndex(index + 1);
}

function addUtcDays(year: number, month: number, day: number, offset: number): { year: number; month: number; day: number } {
  const shifted = new Date(Date.UTC(year, month - 1, day + offset));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

describe("외부 일진 대조 (정오 KST, 야자시 제외)", () => {
  it.each([
    { date: "1900-01-01", year: 1900, month: 1, day: 1, stem: "甲", branch: "戌", source: "KASI 2000-01-01 무오 + 그레고리 일수" },
    { date: "1919-03-01", year: 1919, month: 3, day: 1, stem: "壬", branch: "子", source: "KASI 2000-01-01 무오 + 그레고리 일수" },
    { date: "1945-08-15", year: 1945, month: 8, day: 15, stem: "丙", branch: "辰", source: "KASI 2000-01-01 무오 + 그레고리 일수" },
    { date: "1950-06-25", year: 1950, month: 6, day: 25, stem: "辛", branch: "卯", source: "KASI 2000-01-01 무오 + 그레고리 일수" },
    { date: "1960-04-19", year: 1960, month: 4, day: 19, stem: "丁", branch: "丑", source: "KASI 2000-01-01 무오 + 그레고리 일수" },
    { date: "1984-02-02", year: 1984, month: 2, day: 2, stem: "丙", branch: "寅", source: "KASI 2000-01-01 무오 + 그레고리 일수" },
    { date: "1988-09-17", year: 1988, month: 9, day: 17, stem: "乙", branch: "亥", source: "KASI 2000-01-01 무오 + 그레고리 일수" },
    { date: "2000-01-01", year: 2000, month: 1, day: 1, stem: "戊", branch: "午", source: "KASI 2000 월력요항 / 한국어 위키 달력" },
    { date: "2000-02-01", year: 2000, month: 2, day: 1, stem: "己", branch: "丑", source: "KASI 2000 월력요항 각월 1일 일진" },
    { date: "2000-02-29", year: 2000, month: 2, day: 29, stem: "丁", branch: "巳", source: "KASI 2000-03-01 무오 하루 전" },
    { date: "2000-03-01", year: 2000, month: 3, day: 1, stem: "戊", branch: "午", source: "KASI 2000 월력요항 각월 1일 일진" },
    { date: "2000-12-01", year: 2000, month: 12, day: 1, stem: "癸", branch: "巳", source: "KASI 2000 월력요항 각월 1일 일진" },
    { date: "2020-01-01", year: 2020, month: 1, day: 1, stem: "癸", branch: "卯", source: "한국어 위키 달력 2020년 1월" },
    { date: "2021-02-12", year: 2021, month: 2, day: 12, stem: "辛", branch: "卯", source: "KASI 달력자료 2021 설날 일진" },
    { date: "2022-02-01", year: 2022, month: 2, day: 1, stem: "乙", branch: "酉", source: "KASI 달력자료 2022 설날 일진" },
    { date: "2023-01-22", year: 2023, month: 1, day: 22, stem: "庚", branch: "辰", source: "KASI 달력자료 2023 설날 일진" },
    { date: "2024-01-01", year: 2024, month: 1, day: 1, stem: "甲", branch: "子", source: "한국어 위키 달력 2024년 1월" },
    { date: "2024-02-10", year: 2024, month: 2, day: 10, stem: "甲", branch: "辰", source: "KASI 달력자료 2024 설날 일진" },
    { date: "2024-12-31", year: 2024, month: 12, day: 31, stem: "己", branch: "巳", source: "KASI 달력자료 2024 음력 12/1" },
    { date: "2025-01-29", year: 2025, month: 1, day: 29, stem: "戊", branch: "戌", source: "KASI 달력자료 2025 설날 일진" },
    { date: "2026-02-17", year: 2026, month: 2, day: 17, stem: "壬", branch: "戌", source: "KASI 달력자료 2026 설날 일진" },
    { date: "2028-01-27", year: 2028, month: 1, day: 27, stem: "辛", branch: "亥", source: "KASI 달력자료 2028 설날 일진" },
    { date: "2099-12-31", year: 2099, month: 12, day: 31, stem: "壬", branch: "寅", source: "KASI 2000-01-01 무오 + 그레고리 일수" },
    { date: "2100-01-01", year: 2100, month: 1, day: 1, stem: "癸", branch: "卯", source: "KASI 2000-01-01 무오 + 그레고리 일수" },
    { date: "2100-03-01", year: 2100, month: 3, day: 1, stem: "壬", branch: "寅", source: "KASI 2000-01-01 무오 + 그레고리 일수" },
  ])("$date $stem$branch ($source)", ({ year, month, day, stem, branch }) => {
    expect(buildFourPillars(solarNoon(year, month, day)).day).toEqual({ stem, branch });
  });
});

describe("연속 날짜 60갑자 +1", () => {
  it.each([
    { label: "일반 월말", from: [2024, 1, 31], to: [2024, 2, 1] },
    { label: "연말", from: [1990, 12, 31], to: [1991, 1, 1] },
    { label: "윤년 2/28→2/29", from: [2024, 2, 28], to: [2024, 2, 29] },
    { label: "윤년 2/29→3/1", from: [2024, 2, 29], to: [2024, 3, 1] },
    { label: "평년 2/28→3/1", from: [2023, 2, 28], to: [2023, 3, 1] },
    { label: "1900 세기년 평년", from: [1900, 2, 28], to: [1900, 3, 1] },
    { label: "2000 세기 윤년 2/28→2/29", from: [2000, 2, 28], to: [2000, 2, 29] },
    { label: "2000 세기 윤년 2/29→3/1", from: [2000, 2, 29], to: [2000, 3, 1] },
    { label: "2100 세기년 평년", from: [2100, 2, 28], to: [2100, 3, 1] },
  ] as const)("$label", ({ from, to }) => {
    const first = dayAt(from[0], from[1], from[2]);
    const second = dayAt(to[0], to[1], to[2]);
    expect(second).toEqual(nextGanzhi(first));
  });
});

describe("60갑자 전체 순환", () => {
  it("lists each of 60 pillars once, returns on day 60, and advances on day 61", () => {
    const start = { year: 2000, month: 1, day: 1 };
    const seen = new Set<string>();
    const first = dayAt(start.year, start.month, start.day);

    for (let offset = 0; offset < 60; offset++) {
      const date = addUtcDays(start.year, start.month, start.day, offset);
      const pillar = dayAt(date.year, date.month, date.day);
      seen.add(`${pillar.stem}${pillar.branch}`);
    }

    expect(seen.size).toBe(60);
    expect(GANZHI60.every((item) => seen.has(`${item.stem}${item.branch}`))).toBe(true);

    const day60 = addUtcDays(start.year, start.month, start.day, 60);
    const day61 = addUtcDays(start.year, start.month, start.day, 61);
    expect(dayAt(day60.year, day60.month, day60.day)).toEqual(first);
    expect(dayAt(day61.year, day61.month, day61.day)).toEqual(nextGanzhi(first));
  });
});

describe("기준일 2000-01-01 戊午", () => {
  it("matches KASI and Wikipedia at noon and stays the same from 01:00 to 22:59", () => {
    expect(dayAt(2000, 1, 1, 12, 0)).toEqual({ stem: "戊", branch: "午" });
    expect(dayAt(2000, 1, 1, 1, 0)).toEqual({ stem: "戊", branch: "午" });
    expect(dayAt(2000, 1, 1, 22, 59)).toEqual({ stem: "戊", branch: "午" });
  });
});
