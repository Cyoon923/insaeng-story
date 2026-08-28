import { describe, expect, it } from "vitest";
import {
  applyMinuteOffsetToClock,
  longitudeOffsetMinutes,
  resolveHourCalcClock,
  KOREA_STANDARD_MERIDIAN_EAST_DEG,
} from "@/lib/saju/calendar/localMeanTime";
import { toSolarInstant } from "@/lib/saju/calendar/toSolar";
import { buildFourPillars } from "@/lib/saju/pillars/build";
import { hourBranchIndex, hourPillar } from "@/lib/saju/pillars/hour";
import type { BirthInput, ClockTime, Pillar } from "@/lib/saju/types";

const SEOUL = { id: "seoul" } as const;

function solar(
  year: number,
  month: number,
  day: number,
  time: ClockTime,
  birthPlace?: BirthInput["birthPlace"],
): BirthInput {
  return {
    calendar: "solar",
    year,
    month,
    day,
    isLeapMonth: false,
    time,
    timezone: "Asia/Seoul",
    birthPlace,
  };
}

function hourOf(pillars: ReturnType<typeof buildFourPillars>): Pillar {
  if (pillars.hour === "unknown") {
    throw new Error("expected confirmed hour");
  }
  return pillars.hour;
}

describe("local mean time — structure", () => {
  it("uses Korea 135°E meridian and (lon − 135) × 4 minutes", () => {
    expect(KOREA_STANDARD_MERIDIAN_EAST_DEG).toBe(135);
    expect(longitudeOffsetMinutes(126.978)).toBeCloseTo((126.978 - 135) * 4, 6);
    expect(longitudeOffsetMinutes(135)).toBe(0);
  });

  it("applies minute offset with 24h wrap without inventing calendar math", () => {
    expect(applyMinuteOffsetToClock({ hour: 19, minute: 17 }, -32.088)).toEqual({
      hour: 18,
      minute: 45,
    });
    expect(applyMinuteOffsetToClock({ hour: 0, minute: 10 }, -30)).toEqual({
      hour: 23,
      minute: 40,
    });
  });
});

describe("local mean time — 1981-07-17 19:17 Seoul (helper only)", () => {
  it("resolveHourCalcClock keeps Seoul LMT 18:45; buildFourPillars uses ban-si 丁酉", () => {
    const withoutPlace = solar(1981, 7, 17, { hour: 19, minute: 17 });
    const withSeoul = solar(1981, 7, 17, { hour: 19, minute: 17 }, SEOUL);

    const clocks = resolveHourCalcClock(toSolarInstant(withoutPlace), SEOUL);
    expect(clocks.wallClock).toEqual({ hour: 19, minute: 17 });
    expect(clocks.hourCalcClock).toEqual({ hour: 18, minute: 45 });
    expect(clocks.reason).toBe("longitude-lmt");

    // LMT module preserved; Unyul v1 build path uses nationwide −30 instead.
    const baseline = buildFourPillars(withoutPlace);
    const seoul = buildFourPillars(withSeoul);

    expect(hourOf(baseline)).toEqual({ stem: "丁", branch: "酉" });
    expect(hourOf(seoul)).toEqual({ stem: "丁", branch: "酉" });
    expect(seoul.year).toEqual(baseline.year);
    expect(seoul.month).toEqual(baseline.month);
    expect(seoul.day).toEqual(baseline.day);
    expect(seoul.year).toEqual({ stem: "辛", branch: "酉" });
    expect(seoul.month).toEqual({ stem: "乙", branch: "未" });
    expect(seoul.day).toEqual({ stem: "丙", branch: "申" });

    expect(seoul.warnings.some((w) => w.includes("−30분"))).toBe(true);
    expect(seoul.warnings.some((w) => w.includes("calc=18:47"))).toBe(true);
  });
});

describe("local mean time — Seoul 酉→戌 boundary (helper clocks)", () => {
  /**
   * Round(offset) = −32 for Seoul 126.978°.
   * KST 戌 starts at hour 19; LMT stays 酉 until wall 19:31, joins 戌 at 19:32.
   */
  it.each([
    { wall: { hour: 18, minute: 59 }, kst: "酉", lmt: "酉", lmtClock: { hour: 18, minute: 27 } },
    { wall: { hour: 19, minute: 0 }, kst: "戌", lmt: "酉", lmtClock: { hour: 18, minute: 28 } },
    { wall: { hour: 19, minute: 17 }, kst: "戌", lmt: "酉", lmtClock: { hour: 18, minute: 45 } },
    { wall: { hour: 19, minute: 31 }, kst: "戌", lmt: "酉", lmtClock: { hour: 18, minute: 59 } },
    { wall: { hour: 19, minute: 32 }, kst: "戌", lmt: "戌", lmtClock: { hour: 19, minute: 0 } },
  ] as const)(
    "wall $wall.hour:$wall.minute → KST $kst / Seoul LMT $lmt (hourPillar only)",
    ({ wall, kst, lmt, lmtClock }) => {
      const instant = toSolarInstant(solar(1981, 7, 17, wall));
      const resolved = resolveHourCalcClock(instant, SEOUL);
      expect(resolved.wallClock).toEqual(wall);
      expect(resolved.hourCalcClock).toEqual(lmtClock);

      const kstBranch = hourPillar("丙", wall.hour).branch;
      const lmtBranch = hourPillar("丙", resolved.hourCalcClock.hour).branch;
      expect(kstBranch).toBe(kst);
      expect(lmtBranch).toBe(lmt);
    },
  );
});

describe("local mean time — 子 hour boundaries (亥→子 / 子→丑)", () => {
  it("documents hourBranchIndex edges for 子 without changing the formula", () => {
    expect(hourBranchIndex(22)).toBe(11); // 亥
    expect(hourBranchIndex(23)).toBe(0); // 子
    expect(hourBranchIndex(0)).toBe(0); // 子
    expect(hourBranchIndex(1)).toBe(1); // 丑
  });

  it.each([
    // 亥 → 子 divergence window (KST 子, Seoul LMT still 亥)
    { wall: { hour: 22, minute: 59 }, kst: "亥", lmt: "亥" },
    { wall: { hour: 23, minute: 0 }, kst: "子", lmt: "亥" },
    { wall: { hour: 23, minute: 31 }, kst: "子", lmt: "亥" },
    { wall: { hour: 23, minute: 32 }, kst: "子", lmt: "子" },
    // 子 across civil midnight — both stay 子; YMD unchanged under LMT wrap
    { wall: { hour: 0, minute: 0 }, kst: "子", lmt: "子" },
    { wall: { hour: 0, minute: 10 }, kst: "子", lmt: "子" },
    { wall: { hour: 0, minute: 31 }, kst: "子", lmt: "子" },
    // 子 → 丑 divergence window (KST 丑, Seoul LMT still 子)
    { wall: { hour: 0, minute: 59 }, kst: "子", lmt: "子" },
    { wall: { hour: 1, minute: 0 }, kst: "丑", lmt: "子" },
    { wall: { hour: 1, minute: 31 }, kst: "丑", lmt: "子" },
    { wall: { hour: 1, minute: 32 }, kst: "丑", lmt: "丑" },
  ] as const)("wall $wall.hour:$wall.minute → KST $kst / LMT $lmt (hourPillar only)", ({ wall, kst, lmt }) => {
    const input = solar(2000, 1, 2, wall);
    const resolved = resolveHourCalcClock(toSolarInstant(input), SEOUL);
    expect(hourPillar("甲", wall.hour).branch).toBe(kst);
    expect(hourPillar("甲", resolved.hourCalcClock.hour).branch).toBe(lmt);
  });
});

describe("local mean time — civil-date wrap (helper + Y/M/D via build)", () => {
  it("KST 00:10 Seoul LMT 23:38; build Y/M/D stay on KST civil day", () => {
    const wall = solar(2000, 1, 2, { hour: 0, minute: 10 });
    const withSeoul = { ...wall, birthPlace: SEOUL };

    const resolved = resolveHourCalcClock(toSolarInstant(wall), SEOUL);
    expect(resolved.wallClock).toEqual({ hour: 0, minute: 10 });
    expect(resolved.hourCalcClock).toEqual({ hour: 23, minute: 38 });

    const a = buildFourPillars(wall);
    const b = buildFourPillars(withSeoul);
    expect(b.year).toEqual(a.year);
    expect(b.month).toEqual(a.month);
    expect(b.day).toEqual(a.day);
    // Ban-si −30 → 23:40; both 子.
    expect(hourOf(a).branch).toBe("子");
    expect(hourOf(b).branch).toBe("子");
  });

  it("KST 01:00 Seoul LMT 00:28; build uses ban-si (both 子), Y/M/D unchanged", () => {
    const wall = solar(2000, 1, 2, { hour: 1, minute: 0 });
    const withSeoul = { ...wall, birthPlace: SEOUL };
    const resolved = resolveHourCalcClock(toSolarInstant(wall), SEOUL);

    expect(resolved.hourCalcClock).toEqual({ hour: 0, minute: 28 });
    const a = buildFourPillars(wall);
    const b = buildFourPillars(withSeoul);
    // Ban-si −30 → 00:30 → 子 (LMT would also be 子 at 00:28).
    expect(hourOf(a).branch).toBe("子");
    expect(hourOf(b).branch).toBe("子");
    expect(b.day).toEqual(a.day);
  });
});
