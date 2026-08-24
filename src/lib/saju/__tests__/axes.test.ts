import { describe, expect, it } from "vitest";
import { analyzeElementPresence, analyzeStemRoots, buildFourPillars, labelStemSeasonPhase, seasonPhaseOf } from "@/lib/saju";
import type { FourPillars } from "@/lib/saju/types";

function chart(partial: Pick<FourPillars, "year" | "month" | "day" | "hour">): FourPillars {
  return {
    ...partial,
    hourCertainty: partial.hour === "unknown" ? "unknown" : "confirmed",
    warnings: [],
  };
}

describe("월령 라벨", () => {
  it("labels 왕상휴수사 from the month branch only", () => {
    expect(seasonPhaseOf("木", "寅")).toBe("왕");
    expect(seasonPhaseOf("火", "亥")).toBe("사");
    expect(seasonPhaseOf("金", "酉")).toBe("왕");
    expect(seasonPhaseOf("水", "午")).toBe("수");
    expect(seasonPhaseOf("土", "辰")).toBe("왕");
    expect(labelStemSeasonPhase("甲", "寅")).toEqual({
      monthBranch: "寅",
      season: "봄",
      element: "木",
      phase: "왕",
    });
    expect(labelStemSeasonPhase("丙", "亥").phase).toBe("사");
    expect(labelStemSeasonPhase("庚", "酉").phase).toBe("왕");
    expect(labelStemSeasonPhase("壬", "午").phase).toBe("수");
  });
});

describe("통근 분석", () => {
  it("records 지장간 hits with role and polarity, not a 득령 verdict", () => {
    const pillars = chart({
      year: { stem: "庚", branch: "申" },
      month: { stem: "甲", branch: "寅" },
      day: { stem: "甲", branch: "子" },
      hour: "unknown",
    });
    const roots = analyzeStemRoots(pillars, "甲");
    expect(roots.hourUnknown).toBe(true);
    expect(roots.hits.some((hit) => hit.slot === "hour")).toBe(false);
    expect(roots.hits).toContainEqual({
      slot: "month",
      branch: "寅",
      hiddenStem: "甲",
      role: "정기",
      polarity: "비견",
    });
    expect(roots).not.toHaveProperty("deukryeong");
    expect(roots).not.toHaveProperty("strength");
  });
});

describe("presence 분석", () => {
  it("distinguishes rooted-visible, unrooted-visible, and hidden-only", () => {
    const rooted = analyzeElementPresence(
      chart({
        year: { stem: "甲", branch: "寅" },
        month: { stem: "甲", branch: "寅" },
        day: { stem: "甲", branch: "子" },
        hour: { stem: "庚", branch: "申" },
      }),
      "木",
    );
    expect(rooted.presence).toBe("rooted-visible");
    expect(rooted.visibleSlots).toEqual(["year", "month", "day"]);
    expect(rooted.rootedSlots).toContain("month");
    expect(rooted.monthOutletSlots).toEqual(["year", "month", "day"]);

    const unrooted = analyzeElementPresence(
      chart({
        year: { stem: "甲", branch: "酉" },
        month: { stem: "庚", branch: "酉" },
        day: { stem: "甲", branch: "酉" },
        hour: "unknown",
      }),
      "木",
    );
    expect(unrooted.presence).toBe("unrooted-visible");
    expect(unrooted.hourUnknown).toBe(true);
    expect(unrooted.rootedSlots).toEqual([]);

    const hidden = analyzeElementPresence(
      chart({
        year: { stem: "庚", branch: "寅" },
        month: { stem: "庚", branch: "申" },
        day: { stem: "庚", branch: "申" },
        hour: "unknown",
      }),
      "木",
    );
    expect(hidden.presence).toBe("hidden-only");
    expect(hidden.visibleSlots).toEqual([]);
    expect(hidden.rootedSlots).toEqual(["year"]);
  });
});

describe("시간 미상과 실제 명식", () => {
  it("omits the hour pillar when time is unknown", () => {
    const unknown = buildFourPillars({
      calendar: "solar",
      year: 2000,
      month: 1,
      day: 1,
      isLeapMonth: false,
      time: "unknown",
    });
    const roots = analyzeStemRoots(unknown, unknown.day.stem);
    const presence = analyzeElementPresence(unknown, "土");
    expect(unknown.hour).toBe("unknown");
    expect(roots.hourUnknown).toBe(true);
    expect(presence.hourUnknown).toBe(true);
    expect(roots.hits.every((hit) => hit.slot !== "hour")).toBe(true);
    expect(presence.visibleSlots.includes("hour")).toBe(false);
    expect(labelStemSeasonPhase(unknown.day.stem, unknown.month.branch).phase).toBe("수");
  });
});
