/**
 * Unyul v1 Korea-wide hour policy: wall clock −30 min (반시) for hour pillar only.
 * Regional LMT helpers remain; buildFourPillars / free path do not use region for hour.
 */
import { describe, expect, it } from "vitest";
import { applyMinuteOffsetToClock } from "@/lib/saju/calendar/localMeanTime";
import {
  buildFreeSajuPillars,
  type FreeSajuBirthFormInput,
} from "@/lib/saju/free/buildFreeSajuPillars";
import { buildFourPillars } from "@/lib/saju/pillars/build";
import type { BirthInput, FourPillars, Pillar } from "@/lib/saju/types";

const REFERENCE_HOUR = { stem: "丁", branch: "酉" } satisfies Pillar;

/** Free-form region labels that must not affect hour (including unmapped cities). */
const REGION_VARIANTS: Array<string | undefined> = [
  undefined,
  "서울",
  "부산",
  "제주",
];

function base1981(extra: Partial<BirthInput> = {}): BirthInput {
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

function freeBirth(
  time: { hour: number; minute: number },
  region?: string,
): FreeSajuBirthFormInput {
  return {
    calendar: "solar",
    year: 1981,
    month: 7,
    day: 17,
    hour: time.hour,
    minute: time.minute,
    ...(region !== undefined ? { region } : {}),
  };
}

function confirmedHour(pillars: FourPillars): Pillar {
  if (pillars.hour === "unknown") {
    throw new Error("expected confirmed hour");
  }
  return pillars.hour;
}

function pillarKey(pillars: FourPillars): string {
  const hour = confirmedHour(pillars);
  return [
    `${pillars.year.stem}${pillars.year.branch}`,
    `${pillars.month.stem}${pillars.month.branch}`,
    `${pillars.day.stem}${pillars.day.branch}`,
    `${hour.stem}${hour.branch}`,
  ].join("|");
}

/** Assert every region variant yields identical four pillars (and matches expected hour). */
function expectRegionInvariant(
  time: { hour: number; minute: number },
  expectedHourBranch: Pillar["branch"],
): void {
  const results = REGION_VARIANTS.map((region) =>
    buildFreeSajuPillars(freeBirth(time, region)),
  );
  const keys = results.map(pillarKey);
  expect(new Set(keys).size).toBe(1);

  for (const pillars of results) {
    expect(confirmedHour(pillars).branch).toBe(expectedHourBranch);
  }

  // Engine BirthInput.birthPlace must also be ignored (LMT longitude path unused).
  const withPlaces = [
    buildFourPillars(base1981({ time })),
    buildFourPillars(base1981({ time, birthPlace: { id: "seoul" } })),
    buildFourPillars(
      base1981({ time, birthPlace: { longitudeEast: 129.0756 } }),
    ),
    buildFourPillars(
      base1981({ time, birthPlace: { longitudeEast: 126.5312 } }),
    ),
  ];
  expect(new Set(withPlaces.map(pillarKey)).size).toBe(1);
  expect(pillarKey(withPlaces[0]!)).toBe(keys[0]);
}

describe("Korea ban-si (−30) hour policy — 1981-07-17 19:17", () => {
  it("corrects wall 19:17 → calc 18:47 and yields 丁酉", () => {
    const wall = { hour: 19, minute: 17 };
    const calc = applyMinuteOffsetToClock(wall, -30);
    expect(calc).toEqual({ hour: 18, minute: 47 });

    const pillars = buildFourPillars(base1981());
    expect(pillars.year).toEqual({ stem: "辛", branch: "酉" });
    expect(pillars.month).toEqual({ stem: "乙", branch: "未" });
    expect(pillars.day).toEqual({ stem: "丙", branch: "申" });
    expect(confirmedHour(pillars)).toEqual(REFERENCE_HOUR);

    expect(
      pillars.warnings.some(
        (w) =>
          w.includes("−30분") &&
          w.includes("wall=19:17") &&
          w.includes("calc=18:47"),
      ),
    ).toBe(true);
  });

  it("region 없음 / 서울 / 부산 / 제주 — same 丁酉", () => {
    const results = REGION_VARIANTS.map((region) =>
      buildFreeSajuPillars(freeBirth({ hour: 19, minute: 17 }, region)),
    );
    for (const pillars of results) {
      expect(confirmedHour(pillars)).toEqual(REFERENCE_HOUR);
    }
    expect(new Set(results.map(pillarKey)).size).toBe(1);
  });

  it("서울·부산·대구·광주·제주 birthPlace — same wall time → same hour pillar", () => {
    const places: Array<BirthInput["birthPlace"] | undefined> = [
      undefined,
      { id: "seoul" },
      { longitudeEast: 129.0756 }, // 부산
      { longitudeEast: 128.6014 }, // 대구
      { longitudeEast: 126.8526 }, // 광주
      { longitudeEast: 126.5312 }, // 제주
    ];

    const hours = places.map((birthPlace) =>
      confirmedHour(buildFourPillars(base1981({ birthPlace }))),
    );

    for (const hour of hours) {
      expect(hour).toEqual(REFERENCE_HOUR);
    }
    expect(new Set(hours.map((h) => `${h.stem}${h.branch}`)).size).toBe(1);
  });
});

describe("Korea ban-si (−30) — region/birthPlace invariant at hour boundaries", () => {
  it.each([
    // wall → calc (−30): branch flips at calc hour boundaries
    { wall: { hour: 1, minute: 29 }, calc: { hour: 0, minute: 59 }, branch: "子" as const },
    { wall: { hour: 1, minute: 30 }, calc: { hour: 1, minute: 0 }, branch: "丑" as const },
    { wall: { hour: 17, minute: 29 }, calc: { hour: 16, minute: 59 }, branch: "申" as const },
    { wall: { hour: 17, minute: 30 }, calc: { hour: 17, minute: 0 }, branch: "酉" as const },
    { wall: { hour: 19, minute: 29 }, calc: { hour: 18, minute: 59 }, branch: "酉" as const },
    { wall: { hour: 19, minute: 30 }, calc: { hour: 19, minute: 0 }, branch: "戌" as const },
    { wall: { hour: 23, minute: 29 }, calc: { hour: 22, minute: 59 }, branch: "亥" as const },
    { wall: { hour: 23, minute: 30 }, calc: { hour: 23, minute: 0 }, branch: "子" as const },
  ])(
    "wall $wall.hour:$wall.minute → calc $calc.hour:$calc.minute ($branch); region-invariant",
    ({ wall, calc, branch }) => {
      expect(applyMinuteOffsetToClock(wall, -30)).toEqual(calc);
      expectRegionInvariant(wall, branch);
    },
  );
});
