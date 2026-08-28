import { describe, expect, it } from "vitest";
import { buildFourPillars, listHourCandidates } from "@/lib/saju";
import { lichunInstant } from "@/lib/saju/calendar/solarTerms";
import { toSolarInstant } from "@/lib/saju/calendar/toSolar";
import { validateBirthInput } from "@/lib/saju/calendar/validate";
import type { BirthInput } from "@/lib/saju/types";
import fixtures from "./fixtures.json";

function solarInput(partial: Omit<BirthInput, "calendar" | "isLeapMonth">): BirthInput {
  return { calendar: "solar", isLeapMonth: false, ...partial };
}

describe("buildFourPillars fixtures", () => {
  it.each(fixtures.charts)("$name", (chart) => {
    const result = buildFourPillars(chart.input as BirthInput);
    if (chart.expected.year) expect(result.year).toEqual(chart.expected.year);
    if (chart.expected.month) expect(result.month).toEqual(chart.expected.month);
    if (chart.expected.day) expect(result.day).toEqual(chart.expected.day);
    if (chart.expected.hour) expect(result.hour).toEqual(chart.expected.hour);
  });
});

describe("unknown time", () => {
  it("does not invent an hour pillar", () => {
    const result = buildFourPillars(
      solarInput({
        year: 1990,
        month: 1,
        day: 15,
        time: "unknown",
      }),
    );
    expect(result.hour).toBe("unknown");
    expect(result.hourCertainty).toBe("unknown");
    expect(result.year).toEqual({ stem: "己", branch: "巳" });
    expect(result.month).toEqual({ stem: "丁", branch: "丑" });
    expect(result.dayBoundaryNote).toContain("23시");
  });
});

describe("야자시", () => {
  it("changes day pillar at 23:00; ban-si hour stays 亥 until wall 23:30", () => {
    const before = buildFourPillars(
      solarInput({ year: 2000, month: 1, day: 1, time: { hour: 22, minute: 59 } }),
    );
    const after = buildFourPillars(
      solarInput({ year: 2000, month: 1, day: 1, time: { hour: 23, minute: 0 } }),
    );
    expect(before.day).toEqual({ stem: "戊", branch: "午" });
    expect(after.day).not.toEqual(before.day);
    expect(after.day).toEqual({ stem: "己", branch: "未" });
    expect(before.hour).toEqual({ stem: "癸", branch: "亥" });
    expect(after.hour).toEqual({ stem: "乙", branch: "亥" });
  });
});

describe("listHourCandidates", () => {
  it("returns 12 unique pillars for a day stem", () => {
    const candidates = listHourCandidates("戊");
    expect(candidates).toHaveLength(12);
    const keys = new Set(candidates.map((item) => `${item.stem}${item.branch}`));
    expect(keys.size).toBe(12);
    expect(candidates[0]).toEqual({ stem: "壬", branch: "子" });
  });
});

describe("solar terms smoke", () => {
  it("places 입춘 between February 3 and 5 in KST", () => {
    for (const year of [1900, 1984, 2000, 2024, 2100]) {
      const lichun = lichunInstant(year);
      expect(lichun.month).toBe(2);
      expect(lichun.day).toBeGreaterThanOrEqual(3);
      expect(lichun.day).toBeLessThanOrEqual(5);
    }
  });
});

describe("lunar conversion", () => {
  it("converts 1984-1-1 lunar to 1984-02-02 solar", () => {
    const solar = toSolarInstant({
      calendar: "lunar",
      year: 1984,
      month: 1,
      day: 1,
      isLeapMonth: false,
      time: { hour: 0, minute: 0 },
    });
    expect(solar).toMatchObject({ year: 1984, month: 2, day: 2 });
  });

  it("rejects a leap month that does not exist", () => {
    expect(() =>
      validateBirthInput({
        calendar: "lunar",
        year: 1984,
        month: 1,
        day: 1,
        isLeapMonth: true,
        time: "unknown",
      }),
    ).toThrow("윤달");
  });
});

describe("range", () => {
  it("rejects years outside 1900–2100", () => {
    expect(() =>
      buildFourPillars(solarInput({ year: 1899, month: 6, day: 1, time: { hour: 8, minute: 0 } })),
    ).toThrow("범위");
  });
});
