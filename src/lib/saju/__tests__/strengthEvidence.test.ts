import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  analyzeElementPresence,
  collectStrengthEvidence,
  labelStemSeasonPhase,
  shiShenOf,
} from "@/lib/saju";
import { STEMS } from "@/lib/saju/types";
import type { FourPillars, HourPillar, Pillar, ShiShen, Stem } from "@/lib/saju/types";

type ShiShenPair = {
  dayStem: Stem;
  targetStem: Stem;
  shiShen: ShiShen;
};

type AxisSample = {
  id: string;
  pillars: {
    year: Pillar;
    month: Pillar;
    day: Pillar;
    hour: HourPillar;
  };
};

const shiShenPairs = JSON.parse(
  readFileSync(path.join(__dirname, "shiShen.fixtures.json"), "utf8"),
).pairs as ShiShenPair[];

const axisSamples = JSON.parse(
  readFileSync(path.join(__dirname, "axisReview.fixtures.json"), "utf8"),
).samples as AxisSample[];

function chart(partial: AxisSample["pillars"]): FourPillars {
  return {
    ...partial,
    hourCertainty: partial.hour === "unknown" ? "unknown" : "confirmed",
    warnings: [],
  };
}

describe("십신 100조합", () => {
  it("has a hand-written row for every day stem × target stem", () => {
    expect(shiShenPairs).toHaveLength(100);
    for (const dayStem of STEMS) {
      for (const targetStem of STEMS) {
        const row = shiShenPairs.find(
          (pair) => pair.dayStem === dayStem && pair.targetStem === targetStem,
        );
        expect(row, `${dayStem}×${targetStem}`).toBeDefined();
      }
    }
  });

  it("matches the hand-written table and does not invent extra labels", () => {
    for (const pair of shiShenPairs) {
      expect(shiShenOf(pair.dayStem, pair.targetStem)).toBe(pair.shiShen);
    }
  });
});

describe("StrengthEvidence 사례", () => {
  it("CASE 1 甲寅 甲寅 甲子 시주미상", () => {
    const evidence = collectStrengthEvidence(
      chart({
        year: { stem: "甲", branch: "寅" },
        month: { stem: "甲", branch: "寅" },
        day: { stem: "甲", branch: "子" },
        hour: "unknown",
      }),
    );

    expect(evidence.seasonalEvidence).toEqual({
      monthBranch: "寅",
      season: "봄",
      element: "木",
      phase: "왕",
    });
    expect(evidence.rootEvidence.hits).toEqual([
      { slot: "year", branch: "寅", hiddenStem: "甲", role: "정기", polarity: "비견" },
      { slot: "month", branch: "寅", hiddenStem: "甲", role: "정기", polarity: "비견" },
    ]);
    expect(evidence.supportEvidence.items.map((item) => item.stem)).toEqual(["甲", "甲"]);
    expect(evidence.supportEvidence.items.every((item) => item.shiShen === "비견")).toBe(true);
    expect(evidence.supportEvidence.items.every((item) => item.slot !== "day")).toBe(true);
    expect(evidence.pressureEvidence.items).toEqual([]);
    expect(evidence.hourUnknown).toBe(true);
    expect(evidence.omittedSlots).toEqual(["hour"]);
  });

  it("CASE 2 甲酉 庚酉 甲酉 시주미상", () => {
    const pillars = chart({
      year: { stem: "甲", branch: "酉" },
      month: { stem: "庚", branch: "酉" },
      day: { stem: "甲", branch: "酉" },
      hour: "unknown",
    });
    const evidence = collectStrengthEvidence(pillars);

    expect(evidence.seasonalEvidence.phase).toBe("사");
    expect(evidence.seasonalEvidence.element).toBe("木");
    expect(evidence.rootEvidence.hasRoot).toBe(false);
    expect(evidence.supportEvidence.items).toEqual([
      {
        slot: "year",
        layer: "stem",
        stem: "甲",
        shiShen: "비견",
        elementPhase: "사",
        presence: "unrooted-visible",
      },
    ]);
    expect(evidence.pressureEvidence.items).toEqual([
      {
        slot: "month",
        layer: "stem",
        stem: "庚",
        shiShen: "편관",
        elementPhase: "왕",
        presence: "rooted-visible",
      },
    ]);
    expect(analyzeElementPresence(pillars, "金").presence).toBe("rooted-visible");
  });

  it("CASE 3 甲子 丙寅 己卯 시주미상", () => {
    const evidence = collectStrengthEvidence(
      chart({
        year: { stem: "甲", branch: "子" },
        month: { stem: "丙", branch: "寅" },
        day: { stem: "己", branch: "卯" },
        hour: "unknown",
      }),
    );

    expect(shiShenOf("己", "丙")).toBe("정인");
    expect(shiShenOf("己", "甲")).toBe("정관");
    expect(evidence.seasonalEvidence).toEqual({
      monthBranch: "寅",
      season: "봄",
      element: "土",
      phase: "사",
    });
    expect(evidence.rootEvidence.hits).toEqual([
      { slot: "month", branch: "寅", hiddenStem: "戊", role: "여기", polarity: "겁재" },
    ]);
    expect(evidence.supportEvidence.items).toEqual([
      {
        slot: "month",
        layer: "stem",
        stem: "丙",
        shiShen: "정인",
        elementPhase: "상",
        presence: "rooted-visible",
      },
    ]);
    expect(evidence.pressureEvidence.items).toEqual([
      {
        slot: "year",
        layer: "stem",
        stem: "甲",
        shiShen: "정관",
        elementPhase: "왕",
        presence: "rooted-visible",
      },
    ]);
  });

  it("CASE 4 甲辰 丙午 丁酉 庚申", () => {
    const evidence = collectStrengthEvidence(
      chart({
        year: { stem: "甲", branch: "辰" },
        month: { stem: "丙", branch: "午" },
        day: { stem: "丁", branch: "酉" },
        hour: { stem: "庚", branch: "申" },
      }),
    );

    expect(shiShenOf("丁", "丙")).toBe("겁재");
    expect(shiShenOf("丁", "甲")).toBe("정인");
    expect(shiShenOf("丁", "庚")).toBe("정재");
    expect(evidence.seasonalEvidence).toEqual({
      monthBranch: "午",
      season: "여름",
      element: "火",
      phase: "왕",
    });
    expect(evidence.hourUnknown).toBe(false);
    expect(evidence.includedSlots).toEqual(["year", "month", "day", "hour"]);
    expect(evidence.omittedSlots).toEqual([]);
    expect(evidence.rootEvidence.hits).toEqual([
      { slot: "month", branch: "午", hiddenStem: "丁", role: "정기", polarity: "비견" },
    ]);
    expect(evidence.supportEvidence.items).toEqual([
      {
        slot: "year",
        layer: "stem",
        stem: "甲",
        shiShen: "정인",
        elementPhase: "휴",
        presence: "rooted-visible",
      },
      {
        slot: "month",
        layer: "stem",
        stem: "丙",
        shiShen: "겁재",
        elementPhase: "왕",
        presence: "rooted-visible",
      },
    ]);
    expect(evidence.pressureEvidence.items).toEqual([
      {
        slot: "hour",
        layer: "stem",
        stem: "庚",
        shiShen: "정재",
        elementPhase: "사",
        presence: "rooted-visible",
      },
    ]);
  });

  it("CASE 5 시간 미상이면 hour가 모든 evidence에서 빠진다", () => {
    const evidence = collectStrengthEvidence(
      chart({
        year: { stem: "壬", branch: "寅" },
        month: { stem: "己", branch: "亥" },
        day: { stem: "丙", branch: "子" },
        hour: "unknown",
      }),
    );

    expect(evidence.hourUnknown).toBe(true);
    expect(evidence.includedSlots).toEqual(["year", "month", "day"]);
    expect(evidence.omittedSlots).toEqual(["hour"]);
    expect(evidence.rootEvidence.hits.every((hit) => hit.slot !== "hour")).toBe(true);
    expect(evidence.supportEvidence.items.every((item) => item.slot !== "hour")).toBe(true);
    expect(evidence.pressureEvidence.items.every((item) => item.slot !== "hour")).toBe(true);
  });
});

describe("기존 16개 명식 StrengthEvidence", () => {
  it("includes hour only when the hour pillar is confirmed", () => {
    expect(axisSamples.length).toBeGreaterThanOrEqual(16);

    for (const sample of axisSamples) {
      const pillars = chart(sample.pillars);
      const evidence = collectStrengthEvidence(pillars);
      const hourUnknown = pillars.hour === "unknown";

      expect(evidence.dayStem).toBe(pillars.day.stem);
      expect(evidence.hourUnknown).toBe(hourUnknown);
      expect(evidence.includedSlots).toEqual(
        hourUnknown ? ["year", "month", "day"] : ["year", "month", "day", "hour"],
      );
      expect(evidence.omittedSlots).toEqual(hourUnknown ? ["hour"] : []);
      expect(evidence.seasonalEvidence).toEqual(
        labelStemSeasonPhase(pillars.day.stem, pillars.month.branch),
      );
      if (hourUnknown) {
        expect(evidence.rootEvidence.hits.every((hit) => hit.slot !== "hour")).toBe(true);
        expect(evidence.supportEvidence.items.every((item) => item.slot !== "hour")).toBe(true);
        expect(evidence.pressureEvidence.items.every((item) => item.slot !== "hour")).toBe(true);
      }
      expect(evidence.supportEvidence.items.every((item) => item.slot !== "day")).toBe(true);
      expect(evidence.pressureEvidence.items.every((item) => item.slot !== "day")).toBe(true);
      expect(evidence.supportEvidence.items.every((item) => item.layer === "stem")).toBe(true);
      expect(evidence.pressureEvidence.items.every((item) => item.layer === "stem")).toBe(true);
      expect(evidence).not.toHaveProperty("score");
      expect(evidence).not.toHaveProperty("strength");
      expect(evidence).not.toHaveProperty("deukryeong");
    }
  });
});
