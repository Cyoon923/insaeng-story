/**
 * Expanded manseryeok (four-pillar) contract cases.
 *
 * Purpose: ensure hour/LMT/year-month-day behavior is not fitted to a single chart.
 * Does NOT change pillar or LMT formulas — asserts current engine contract only.
 *
 * Categories covered:
 * - solar-term before/after (입춘)
 * - civil midnight / night_ja day boundary
 * - 子 hour boundary (KST vs Seoul LMT)
 * - 2-hour 酉→戌 boundary (KST vs Seoul LMT)
 * - Seoul LMT changes hour branch
 * - Seoul LMT applied but hour branch unchanged
 * - reference 1981-07-17 19:17 서울
 */
import { describe, expect, it } from "vitest";
import { resolveHourCalcClock } from "@/lib/saju/calendar/localMeanTime";
import { toSolarInstant } from "@/lib/saju/calendar/toSolar";
import {
  buildFreeSajuPillars,
  toBirthInput,
  type FreeSajuBirthFormInput,
} from "@/lib/saju/free/buildFreeSajuPillars";
import type { Pillar } from "@/lib/saju/types";

type PillarExpect = {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  hour: Pillar;
};

type Case = {
  id: string;
  categories: string[];
  input: FreeSajuBirthFormInput;
  expected: PillarExpect;
  /** Optional LMT clock checks (when region maps to seoul). */
  lmt?: {
    applied: boolean;
    wall: { hour: number; minute: number };
    hourCalc: { hour: number; minute: number };
  };
};

function pillar(stem: Pillar["stem"], branch: Pillar["branch"]): Pillar {
  return { stem, branch };
}

function assertFourPillars(
  actual: ReturnType<typeof buildFreeSajuPillars>,
  expected: PillarExpect,
  id: string,
): void {
  const mismatches: string[] = [];
  const slots: Array<keyof PillarExpect> = ["year", "month", "day", "hour"];
  for (const slot of slots) {
    const got = actual[slot];
    const exp = expected[slot];
    if (got === "unknown") {
      mismatches.push(`${slot}: got unknown, expected ${exp.stem}${exp.branch}`);
      continue;
    }
    if (got.stem !== exp.stem || got.branch !== exp.branch) {
      mismatches.push(
        `${slot}: got ${got.stem}${got.branch}, expected ${exp.stem}${exp.branch}`,
      );
    }
  }
  if (mismatches.length > 0) {
    expect.fail(`[${id}] pillar mismatch — ${mismatches.join("; ")}`);
  }
}

const CASES: Case[] = [
  {
    id: "1981-07-17 19:17 Seoul — LMT changes 戌→酉 (reference)",
    categories: ["reference", "lmt-branch-change", "two-hour-boundary"],
    input: {
      calendar: "solar",
      year: 1981,
      month: 7,
      day: 17,
      hour: 19,
      minute: 17,
      region: "서울",
    },
    expected: {
      year: pillar("辛", "酉"),
      month: pillar("乙", "未"),
      day: pillar("丙", "申"),
      hour: pillar("丁", "酉"),
    },
    lmt: {
      applied: true,
      wall: { hour: 19, minute: 17 },
      hourCalc: { hour: 18, minute: 45 },
    },
  },
  {
    id: "1990-01-15 12:00 — before 입춘 (절기 전)",
    categories: ["solar-term-before"],
    input: {
      calendar: "solar",
      year: 1990,
      month: 1,
      day: 15,
      hour: 12,
      minute: 0,
    },
    expected: {
      year: pillar("己", "巳"),
      month: pillar("丁", "丑"),
      day: pillar("庚", "辰"),
      hour: pillar("壬", "午"),
    },
  },
  {
    id: "1990-02-10 12:00 — after 입춘 (절기 후)",
    categories: ["solar-term-after"],
    input: {
      calendar: "solar",
      year: 1990,
      month: 2,
      day: 10,
      hour: 12,
      minute: 0,
    },
    expected: {
      year: pillar("庚", "午"),
      month: pillar("戊", "寅"),
      day: pillar("丙", "午"),
      hour: pillar("甲", "午"),
    },
  },
  {
    id: "2000-01-01 22:59 — before night_ja (자정/야자시 전)",
    categories: ["midnight-before"],
    input: {
      calendar: "solar",
      year: 2000,
      month: 1,
      day: 1,
      hour: 22,
      minute: 59,
    },
    expected: {
      year: pillar("己", "卯"),
      month: pillar("丙", "子"),
      day: pillar("戊", "午"),
      hour: pillar("癸", "亥"),
    },
  },
  {
    id: "2000-01-01 23:00 — night_ja day rolls (자정/야자시 후)",
    categories: ["midnight-after", "zi-hour"],
    input: {
      calendar: "solar",
      year: 2000,
      month: 1,
      day: 1,
      hour: 23,
      minute: 0,
    },
    expected: {
      year: pillar("己", "卯"),
      month: pillar("丙", "子"),
      day: pillar("己", "未"),
      // Ban-si −30 → 22:30 → 亥 (day still rolls on wall 23:00)
      hour: pillar("乙", "亥"),
    },
  },
  {
    id: "2000-01-02 23:00 — ban-si stays 亥 at wall 23:00",
    categories: ["zi-boundary-kst"],
    input: {
      calendar: "solar",
      year: 2000,
      month: 1,
      day: 2,
      hour: 23,
      minute: 0,
    },
    expected: {
      year: pillar("己", "卯"),
      month: pillar("丙", "子"),
      day: pillar("庚", "申"),
      hour: pillar("丁", "亥"),
    },
  },
  {
    id: "2000-01-02 23:00 Seoul — 子시 경계 LMT→亥 (시지 변경)",
    categories: ["zi-boundary-lmt-change", "lmt-branch-change"],
    input: {
      calendar: "solar",
      year: 2000,
      month: 1,
      day: 2,
      hour: 23,
      minute: 0,
      region: "서울",
    },
    expected: {
      year: pillar("己", "卯"),
      month: pillar("丙", "子"),
      day: pillar("庚", "申"),
      hour: pillar("丁", "亥"),
    },
    lmt: {
      applied: true,
      wall: { hour: 23, minute: 0 },
      hourCalc: { hour: 22, minute: 28 },
    },
  },
  {
    id: "1981-07-17 19:00 Seoul — 酉/戌 경계 LMT still 酉",
    categories: ["two-hour-boundary", "lmt-branch-change"],
    input: {
      calendar: "solar",
      year: 1981,
      month: 7,
      day: 17,
      hour: 19,
      minute: 0,
      region: "서울",
    },
    expected: {
      year: pillar("辛", "酉"),
      month: pillar("乙", "未"),
      day: pillar("丙", "申"),
      hour: pillar("丁", "酉"),
    },
    lmt: {
      applied: true,
      wall: { hour: 19, minute: 0 },
      hourCalc: { hour: 18, minute: 28 },
    },
  },
  {
    id: "1981-07-17 19:32 Seoul — 酉/戌 경계 LMT joins 戌",
    categories: ["two-hour-boundary", "lmt-no-branch-vs-kst-sul"],
    input: {
      calendar: "solar",
      year: 1981,
      month: 7,
      day: 17,
      hour: 19,
      minute: 32,
      region: "서울",
    },
    expected: {
      year: pillar("辛", "酉"),
      month: pillar("乙", "未"),
      day: pillar("丙", "申"),
      hour: pillar("戊", "戌"),
    },
    lmt: {
      applied: true,
      wall: { hour: 19, minute: 32 },
      hourCalc: { hour: 19, minute: 0 },
    },
  },
  {
    id: "1990-02-10 12:00 Seoul — LMT applied, 午 branch unchanged",
    categories: ["lmt-no-branch-change", "solar-term-after"],
    input: {
      calendar: "solar",
      year: 1990,
      month: 2,
      day: 10,
      hour: 12,
      minute: 0,
      region: "서울",
    },
    expected: {
      year: pillar("庚", "午"),
      month: pillar("戊", "寅"),
      day: pillar("丙", "午"),
      hour: pillar("甲", "午"),
    },
    lmt: {
      applied: true,
      wall: { hour: 12, minute: 0 },
      hourCalc: { hour: 11, minute: 28 },
    },
  },
  {
    id: "2000-01-02 00:10 Seoul — LMT wraps to 23:38, YMD unchanged",
    categories: ["lmt-date-wrap", "zi-hour"],
    input: {
      calendar: "solar",
      year: 2000,
      month: 1,
      day: 2,
      hour: 0,
      minute: 10,
      region: "서울",
    },
    expected: {
      year: pillar("己", "卯"),
      month: pillar("丙", "子"),
      day: pillar("己", "未"),
      hour: pillar("甲", "子"),
    },
    lmt: {
      applied: true,
      wall: { hour: 0, minute: 10 },
      hourCalc: { hour: 23, minute: 38 },
    },
  },
  {
    id: "2000-01-02 01:00 Seoul — 子→丑 LMT stays 子",
    categories: ["zi-boundary-lmt-change", "lmt-branch-change"],
    input: {
      calendar: "solar",
      year: 2000,
      month: 1,
      day: 2,
      hour: 1,
      minute: 0,
      region: "서울",
    },
    expected: {
      year: pillar("己", "卯"),
      month: pillar("丙", "子"),
      day: pillar("己", "未"),
      hour: pillar("甲", "子"),
    },
    lmt: {
      applied: true,
      wall: { hour: 1, minute: 0 },
      hourCalc: { hour: 0, minute: 28 },
    },
  },
];

describe("manseryeok expanded validation (engine contract)", () => {
  it("covers required category tags with ≥8 cases", () => {
    expect(CASES.length).toBeGreaterThanOrEqual(8);
    const tags = new Set(CASES.flatMap((c) => c.categories));
    expect(tags.has("solar-term-before") || tags.has("solar-term-after")).toBe(true);
    expect(tags.has("midnight-before") || tags.has("midnight-after")).toBe(true);
    expect(
      [...tags].some((t) => t.startsWith("zi-")),
    ).toBe(true);
    expect(tags.has("two-hour-boundary")).toBe(true);
    expect(tags.has("lmt-branch-change")).toBe(true);
    expect(tags.has("lmt-no-branch-change")).toBe(true);
    expect(tags.has("reference")).toBe(true);
  });

  it.each(CASES)("$id", (c) => {
    const birth = toBirthInput(c.input);
    expect(birth.timezone).toBe("Asia/Seoul");

    if (c.lmt) {
      // LMT helper still documents Seoul longitude clocks; free path no longer sets birthPlace.
      const clocks = resolveHourCalcClock(toSolarInstant(birth), { id: "seoul" });
      expect(clocks.applied).toBe(c.lmt.applied);
      expect(clocks.wallClock).toEqual(c.lmt.wall);
      expect(clocks.hourCalcClock).toEqual(c.lmt.hourCalc);
      expect(birth.birthPlace).toBeUndefined();
    } else if (!c.input.region) {
      expect(birth.birthPlace).toBeUndefined();
    }

    const pillars = buildFreeSajuPillars(c.input);
    assertFourPillars(pillars, c.expected, c.id);

    // Year/month/day must not depend on Seoul LMT when comparing to no-region twin
    // for cases that only differ by region on the same civil wall clock.
    if (c.input.region === "서울" && c.input.hour !== undefined && c.input.minute !== undefined) {
      const withoutRegion = buildFreeSajuPillars({
        ...c.input,
        region: undefined,
      });
      expect(pillars.year).toEqual(withoutRegion.year);
      expect(pillars.month).toEqual(withoutRegion.month);
      expect(pillars.day).toEqual(withoutRegion.day);
    }
  });
});
