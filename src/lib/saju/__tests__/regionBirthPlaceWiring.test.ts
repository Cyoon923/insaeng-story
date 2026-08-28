import { describe, expect, it } from "vitest";
import {
  buildFreeSajuPillars,
  toBirthInput,
} from "@/lib/saju/free/buildFreeSajuPillars";
import { buildElementStrengthProfiles } from "@/lib/saju/elements/buildElementStrengthProfiles";
import { toElementStrengthDisplayProfiles } from "@/lib/saju/elements/toElementStrengthDisplayProfiles";
import { mapRegionToBirthPlace } from "@/lib/saju/free/mapRegionToBirthPlace";
import {
  freeSajuBirthFromSearchParams,
  freeSajuBirthToQuery,
} from "@/lib/saju/free/unyulBirthQuery";

describe("mapRegionToBirthPlace", () => {
  it("maps 서울 labels to seoul id", () => {
    expect(mapRegionToBirthPlace("서울")).toEqual({ id: "seoul" });
    expect(mapRegionToBirthPlace(" 서울 ")).toEqual({ id: "seoul" });
    expect(mapRegionToBirthPlace("서울특별시")).toEqual({ id: "seoul" });
  });

  it("returns undefined for empty or unmapped region", () => {
    expect(mapRegionToBirthPlace(undefined)).toBeUndefined();
    expect(mapRegionToBirthPlace("")).toBeUndefined();
    expect(mapRegionToBirthPlace("부산")).toBeUndefined();
  });
});

describe("buildFreeSajuPillars — region does not affect hour (ban-si)", () => {
  it("1981-07-17 19:17 region 서울 → 辛酉 / 乙未 / 丙申 / 丁酉", () => {
    const pillars = buildFreeSajuPillars({
      calendar: "solar",
      year: 1981,
      month: 7,
      day: 17,
      hour: 19,
      minute: 17,
      region: "서울",
    });

    expect(toBirthInput({
      calendar: "solar",
      year: 1981,
      month: 7,
      day: 17,
      hour: 19,
      minute: 17,
      region: "서울",
    })).toMatchObject({
      timezone: "Asia/Seoul",
    });
    expect(toBirthInput({
      calendar: "solar",
      year: 1981,
      month: 7,
      day: 17,
      hour: 19,
      minute: 17,
      region: "서울",
    }).birthPlace).toBeUndefined();

    expect(pillars.year).toEqual({ stem: "辛", branch: "酉" });
    expect(pillars.month).toEqual({ stem: "乙", branch: "未" });
    expect(pillars.day).toEqual({ stem: "丙", branch: "申" });
    expect(pillars.hour).toEqual({ stem: "丁", branch: "酉" });
  });

  it("1981-07-17 19:17 서울 → Strength Display 金72 outermost", () => {
    const pillars = buildFreeSajuPillars({
      calendar: "solar",
      year: 1981,
      month: 7,
      day: 17,
      hour: 19,
      minute: 17,
      region: "서울",
    });
    const displaySet = toElementStrengthDisplayProfiles(
      buildElementStrengthProfiles(pillars),
    );
    const scores = Object.fromEntries(
      displaySet.profiles.map((profile) => [profile.element, profile.displayScore]),
    );

    expect(scores).toEqual({
      木: 44,
      火: 52,
      土: 60,
      金: 72,
      水: 32,
    });

    const outermost = [...displaySet.profiles].sort(
      (a, b) => b.displayScore - a.displayScore,
    )[0];
    expect(outermost?.element).toBe("金");
    expect(outermost?.displayScore).toBe(72);
  });

  it("same birth without region still uses ban-si hour 丁酉", () => {
    const pillars = buildFreeSajuPillars({
      calendar: "solar",
      year: 1981,
      month: 7,
      day: 17,
      hour: 19,
      minute: 17,
    });

    expect(toBirthInput({
      calendar: "solar",
      year: 1981,
      month: 7,
      day: 17,
      hour: 19,
      minute: 17,
    }).birthPlace).toBeUndefined();

    expect(pillars.year).toEqual({ stem: "辛", branch: "酉" });
    expect(pillars.month).toEqual({ stem: "乙", branch: "未" });
    expect(pillars.day).toEqual({ stem: "丙", branch: "申" });
    expect(pillars.hour).toEqual({ stem: "丁", branch: "酉" });
  });
});

describe("unyulBirthQuery — region round-trip", () => {
  it("serializes and restores region=서울", () => {
    const input = {
      calendar: "solar" as const,
      year: 1981,
      month: 7,
      day: 17,
      hour: 19,
      minute: 17,
      region: "서울",
    };
    const query = freeSajuBirthToQuery(input);
    expect(query).toContain("region=");
    expect(decodeURIComponent(query)).toContain("서울");

    const parsed = freeSajuBirthFromSearchParams(
      Object.fromEntries(new URLSearchParams(query)),
    );
    expect(parsed).toEqual({
      ok: true,
      input: {
        calendar: "solar",
        year: 1981,
        month: 7,
        day: 17,
        isLeapMonth: false,
        timeUnknown: false,
        hour: 19,
        minute: 17,
        region: "서울",
      },
    });

    if (!parsed.ok) throw new Error("parse failed");
    const pillars = buildFreeSajuPillars(parsed.input);
    expect(pillars.hour).toEqual({ stem: "丁", branch: "酉" });
  });

  it("omits region when absent (legacy query)", () => {
    const query = freeSajuBirthToQuery({
      calendar: "solar",
      year: 1990,
      month: 1,
      day: 15,
      hour: 12,
      minute: 0,
    });
    expect(query).not.toContain("region=");
  });
});
