/**
 * Reference manseryeok for 1981-07-17 19:17 (Korea / solar).
 *
 * Unyul v1 hour path: nationwide −30 min (반시).
 * LMT helper clocks remain documented separately; buildFourPillars uses ban-si.
 */
import { describe, expect, it } from "vitest";
import {
  applyMinuteOffsetToClock,
  resolveHourCalcClock,
} from "@/lib/saju/calendar/localMeanTime";
import { toSolarInstant } from "@/lib/saju/calendar/toSolar";
import { buildFourPillars } from "@/lib/saju/pillars/build";
import type { BirthInput, Pillar } from "@/lib/saju/types";

const REFERENCE = {
  year: { stem: "辛", branch: "酉" } satisfies Pillar,
  month: { stem: "乙", branch: "未" } satisfies Pillar,
  day: { stem: "丙", branch: "申" } satisfies Pillar,
  hour: { stem: "丁", branch: "酉" } satisfies Pillar,
};

function baseInput(extra: Partial<BirthInput> = {}): BirthInput {
  return {
    calendar: "solar",
    year: 1981,
    month: 7,
    day: 17,
    isLeapMonth: false,
    time: { hour: 19, minute: 17 },
    timezone: "Asia/Seoul",
    ...extra,
  };
}

describe("manseryeok reference — 1981-07-17 19:17 Korea ban-si", () => {
  it("wall 19:17 → calc 18:47 → 丁酉; Y/M/D match reference with or without birthPlace", () => {
    const wallInput = baseInput();
    const seoulInput = baseInput({ birthPlace: { id: "seoul" } });

    const instant = toSolarInstant(wallInput);
    const lmtClocks = resolveHourCalcClock(instant, { id: "seoul" });
    const banSiClock = applyMinuteOffsetToClock(lmtClocks.wallClock, -30);

    expect(lmtClocks.wallClock).toEqual({ hour: 19, minute: 17 });
    // LMT helper still yields Seoul longitude clock (not used by buildFourPillars).
    expect(lmtClocks.hourCalcClock).toEqual({ hour: 18, minute: 45 });
    expect(banSiClock).toEqual({ hour: 18, minute: 47 });

    const wall = buildFourPillars(wallInput);
    const seoul = buildFourPillars(seoulInput);

    expect(wall.year).toEqual(REFERENCE.year);
    expect(wall.month).toEqual(REFERENCE.month);
    expect(wall.day).toEqual(REFERENCE.day);
    expect(wall.hour).toEqual(REFERENCE.hour);

    expect(seoul.year).toEqual(REFERENCE.year);
    expect(seoul.month).toEqual(REFERENCE.month);
    expect(seoul.day).toEqual(REFERENCE.day);
    expect(seoul.hour).toEqual(REFERENCE.hour);

    expect(seoul.year).toEqual(wall.year);
    expect(seoul.month).toEqual(wall.month);
    expect(seoul.day).toEqual(wall.day);
    expect(seoul.hour).toEqual(wall.hour);
  });
});
