import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { HIDDEN_STEMS } from "@/lib/saju/data/hiddenStems";
import { buildStrengthReviewReport } from "@/lib/saju/review/strengthReport";
import type { FourPillars, HourPillar, Pillar } from "@/lib/saju/types";

type AxisSample = {
  id: string;
  name: string;
  pillars: {
    year: Pillar;
    month: Pillar;
    day: Pillar;
    hour: HourPillar;
  };
};

const samples = JSON.parse(
  readFileSync(path.join(__dirname, "axisReview.fixtures.json"), "utf8"),
).samples as AxisSample[];

function chart(partial: AxisSample["pillars"]): FourPillars {
  return {
    ...partial,
    hourCertainty: partial.hour === "unknown" ? "unknown" : "confirmed",
    warnings: [],
  };
}

describe("Strength 검토 리포트", () => {
  it("builds a report for all 16 charts", () => {
    expect(samples).toHaveLength(16);
    for (const sample of samples) {
      const report = buildStrengthReviewReport(chart(sample.pillars));
      expect(report.dayStem).toBe(sample.pillars.day.stem);
      expect(report.monthBranch).toBe(sample.pillars.month.branch);
      expect(report).not.toHaveProperty("score");
      expect(report).not.toHaveProperty("strength");
      expect(report).not.toHaveProperty("deukryeong");
    }
  });

  it("keeps sourceKeys and root/branch overlap trackable", () => {
    for (const sample of samples) {
      const report = buildStrengthReviewReport(chart(sample.pillars));
      expect(report.hiddenRelations.branchRelationEvidence.every((item) => item.sourceKey.length > 0)).toBe(true);
      expect(report.sourceOverlap.totalBranchRelationSources).toBe(
        new Set(report.hiddenRelations.branchRelationEvidence.map((item) => item.sourceKey)).size,
      );
      expect(report.sourceOverlap.totalRootSources).toBe(report.rootEvidence.hits.length);
      for (const key of report.sourceOverlap.overlappingSourceKeys) {
        expect(report.rootEvidence.hits.some((hit) => hit.sourceKey === key)).toBe(true);
        expect(report.hiddenRelations.branchRelationEvidence.some((item) => item.sourceKey === key)).toBe(true);
      }
    }
  });

  it("separates visible stem relations from hidden branch relations", () => {
    const report = buildStrengthReviewReport(
      chart({
        year: { stem: "甲", branch: "酉" },
        month: { stem: "庚", branch: "酉" },
        day: { stem: "甲", branch: "酉" },
        hour: "unknown",
      }),
    );
    expect(report.visibleRelations.pressureEvidence.every((item) => item.stem === "庚")).toBe(true);
    expect(report.hiddenRelations.branchRelationEvidence.every((item) => item.hiddenStem === "辛")).toBe(true);
  });

  it("omits hour only when unknown and includes hour when confirmed", () => {
    const unknown = buildStrengthReviewReport(
      chart({
        year: { stem: "甲", branch: "寅" },
        month: { stem: "甲", branch: "寅" },
        day: { stem: "甲", branch: "子" },
        hour: "unknown",
      }),
    );
    expect(unknown.hourUnknown).toBe(true);
    expect(unknown.includedSlots).toEqual(["year", "month", "day"]);
    expect(unknown.omittedSlots).toEqual(["hour"]);
    expect(unknown.hourNote).toBe("시주가 없으므로 현재 Evidence는 3주 기준");
    expect(unknown.rootEvidence.hits.every((hit) => hit.slot !== "hour")).toBe(true);
    expect(unknown.hiddenRelations.branchRelationEvidence.every((item) => item.slot !== "hour")).toBe(true);

    const confirmed = buildStrengthReviewReport(
      chart({
        year: { stem: "甲", branch: "辰" },
        month: { stem: "丙", branch: "午" },
        day: { stem: "丁", branch: "酉" },
        hour: { stem: "庚", branch: "申" },
      }),
    );
    expect(confirmed.hourUnknown).toBe(false);
    expect(confirmed.includedSlots).toContain("hour");
    expect(confirmed.omittedSlots).toEqual([]);
    expect(confirmed.hiddenRelations.branchRelationEvidence.some((item) => item.slot === "hour")).toBe(true);
  });

  it("keeps 辰未戌丑 hidden stems instead of collapsing them to 土", () => {
    const withEarth = samples.filter((sample) =>
      [sample.pillars.year.branch, sample.pillars.month.branch, sample.pillars.day.branch].some((branch) =>
        ["辰", "未", "戌", "丑"].includes(branch),
      ) ||
      (sample.pillars.hour !== "unknown" && ["辰", "未", "戌", "丑"].includes(sample.pillars.hour.branch)),
    );
    expect(withEarth.length).toBeGreaterThan(0);

    for (const sample of withEarth) {
      const report = buildStrengthReviewReport(chart(sample.pillars));
      for (const earth of ["辰", "未", "戌", "丑"] as const) {
        const items = report.hiddenRelations.branchRelationEvidence.filter((item) => item.branch === earth);
        if (items.length === 0) continue;
        expect(items.map((item) => item.hiddenStem)).toEqual(HIDDEN_STEMS[earth].map((part) => part.stem));
      }
    }
  });
});
