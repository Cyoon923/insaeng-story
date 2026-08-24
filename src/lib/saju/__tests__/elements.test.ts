import { describe, expect, it } from "vitest";
import { buildFourPillars, collectElementMaterials } from "@/lib/saju";
import { BRANCH_ELEMENT, STEM_ELEMENT } from "@/lib/saju/constants/elements";
import { HIDDEN_STEMS } from "@/lib/saju/data/hiddenStems";
import { BRANCHES, STEMS } from "@/lib/saju/types";
import type { BirthInput } from "@/lib/saju/types";

function solarNoon(): BirthInput {
  return {
    calendar: "solar",
    year: 2000,
    month: 1,
    day: 1,
    isLeapMonth: false,
    time: { hour: 12, minute: 0 },
  };
}

describe("천간·지지 오행 표", () => {
  it("maps every stem and branch to one of 木火土金水", () => {
    for (const stem of STEMS) {
      expect(["木", "火", "土", "金", "水"]).toContain(STEM_ELEMENT[stem]);
    }
    for (const branch of BRANCHES) {
      expect(["木", "火", "土", "金", "水"]).toContain(BRANCH_ELEMENT[branch]);
    }
    expect(STEM_ELEMENT.甲).toBe("木");
    expect(STEM_ELEMENT.丙).toBe("火");
    expect(STEM_ELEMENT.戊).toBe("土");
    expect(STEM_ELEMENT.庚).toBe("金");
    expect(STEM_ELEMENT.壬).toBe("水");
    expect(BRANCH_ELEMENT.寅).toBe("木");
    expect(BRANCH_ELEMENT.午).toBe("火");
    expect(BRANCH_ELEMENT.辰).toBe("土");
    expect(BRANCH_ELEMENT.酉).toBe("金");
    expect(BRANCH_ELEMENT.子).toBe("水");
  });
});

describe("지장간 표", () => {
  it("stores 여기/중기/정기 without weights for all 12 branches", () => {
    expect(Object.keys(HIDDEN_STEMS)).toHaveLength(12);
    expect(HIDDEN_STEMS.子).toEqual([{ stem: "癸", role: "정기" }]);
    expect(HIDDEN_STEMS.午.map((part) => part.role)).toEqual(["중기", "정기"]);
    expect(HIDDEN_STEMS.寅.map((part) => part.stem)).toEqual(["戊", "丙", "甲"]);
    for (const branch of BRANCHES) {
      for (const part of HIDDEN_STEMS[branch]) {
        expect(part).toEqual({ stem: expect.any(String), role: expect.stringMatching(/여기|중기|정기/) });
        expect(part).not.toHaveProperty("weight");
        expect(part).not.toHaveProperty("days");
        expect(part).not.toHaveProperty("score");
      }
    }
  });
});

describe("Four Pillars → 오행 원재료", () => {
  it("lists stem, branch, and hidden stems per confirmed pillar", () => {
    const pillars = buildFourPillars(solarNoon());
    const materials = collectElementMaterials(pillars);
    expect(materials.hourUnknown).toBe(false);
    expect(materials.dayStem).toBe(pillars.day.stem);
    expect(pillars.hour).not.toBe("unknown");
    const slots = new Set(materials.items.map((item) => item.slot));
    expect(slots).toEqual(new Set(["year", "month", "day", "hour"]));
    expect(materials.items.some((item) => item.layer === "stem" && item.slot === "day")).toBe(true);
    expect(materials.items.some((item) => item.layer === "hiddenStem" && item.role === "정기")).toBe(true);
    expect(materials).not.toHaveProperty("strength");
    expect(materials).not.toHaveProperty("need");
    expect(materials).not.toHaveProperty("yongsin");
  });

  it("keeps hour unknown and omits the hour slot", () => {
    const pillars = buildFourPillars({
      calendar: "solar",
      year: 2000,
      month: 1,
      day: 1,
      isLeapMonth: false,
      time: "unknown",
    });
    const materials = collectElementMaterials(pillars);
    expect(pillars.hour).toBe("unknown");
    expect(pillars.hourCertainty).toBe("unknown");
    expect(materials.hourUnknown).toBe(true);
    expect(materials.items.some((item) => item.slot === "hour")).toBe(false);
    expect(new Set(materials.items.map((item) => item.slot))).toEqual(new Set(["year", "month", "day"]));
  });
});
