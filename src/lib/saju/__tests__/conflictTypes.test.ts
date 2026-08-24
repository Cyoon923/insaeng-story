import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BRANCHES, STEMS } from "@/lib/saju/types";
import { stemElement } from "@/lib/saju/constants/elements";
import { hiddenStemsOf } from "@/lib/saju/data/hiddenStems";
import { seasonPhaseOf } from "@/lib/saju/elements/season";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { buildStrengthReviewReport } from "@/lib/saju/review/strengthReport";
import type { FourPillars, HourPillar, Pillar } from "@/lib/saju/types";

type ConflictSample = {
  id: string;
  name: string;
  pillars: {
    year: Pillar;
    month: Pillar;
    day: Pillar;
    hour: HourPillar;
  };
  expected: Record<string, unknown>;
};

const fixtures = JSON.parse(
  readFileSync(path.join(__dirname, "conflictType.fixtures.json"), "utf8"),
) as {
  typeC: ConflictSample[];
  typeI: ConflictSample[];
};

const axisSamples = JSON.parse(
  readFileSync(path.join(__dirname, "axisReview.fixtures.json"), "utf8"),
).samples as Array<{ pillars: ConflictSample["pillars"] }>;

function chart(partial: ConflictSample["pillars"]): FourPillars {
  return {
    ...partial,
    hourCertainty: partial.hour === "unknown" ? "unknown" : "confirmed",
    warnings: [],
  };
}

describe("유형 B 왕+무근 구조 검토", () => {
  it("does not invent a 왕 + 무근 chart because every 왕 month already hides the day element", () => {
    const wangMonths: Array<{ stem: string; element: string; branch: string; hidden: string[] }> = [];

    for (const stem of STEMS) {
      const element = stemElement(stem);
      for (const branch of BRANCHES) {
        if (seasonPhaseOf(element, branch) !== "왕") continue;
        const sameElement = hiddenStemsOf(branch).filter((part) => stemElement(part.stem) === element);
        wangMonths.push({
          stem,
          element,
          branch,
          hidden: sameElement.map((part) => `${part.stem}:${part.role}`),
        });
        expect(sameElement.length, `${stem} + ${branch}`).toBeGreaterThan(0);
      }
    }

    expect(wangMonths).toHaveLength(24);
    expect(fixtures.typeC).toHaveLength(2);
  });
});

describe("유형 C", () => {
  it("keeps two 사 + 정기 root + visible rooted support charts", () => {
    expect(fixtures.typeC).toHaveLength(2);

    for (const sample of fixtures.typeC) {
      const report = buildStrengthReviewReport(chart(sample.pillars));
      const expected = sample.expected as {
        dayStem: string;
        monthBranch: string;
        phase: string;
        hasRoot: boolean;
        clearRootRoles: string[];
        visibleSupportShiShen: string[];
        visibleSupportPresence: string[];
      };

      expect(report.dayStem).toBe(expected.dayStem);
      expect(report.monthBranch).toBe(expected.monthBranch);
      expect(report.seasonalEvidence.phase).toBe(expected.phase);
      expect(report.rootEvidence.hasRoot).toBe(expected.hasRoot);
      expect(report.rootEvidence.rolesSeen).toEqual(expect.arrayContaining(expected.clearRootRoles));
      expect(report.visibleRelations.supportEvidence.map((item) => item.shiShen)).toEqual(
        expected.visibleSupportShiShen,
      );
      expect(report.visibleRelations.supportEvidence.map((item) => item.presence)).toEqual(
        expected.visibleSupportPresence,
      );
      expect(report).not.toHaveProperty("score");
      expect(report).not.toHaveProperty("leaning");
    }
  });
});

describe("유형 I", () => {
  it("keeps visible unrooted pressure separate from month hidden pressure", () => {
    expect(fixtures.typeI).toHaveLength(2);

    for (const sample of fixtures.typeI) {
      const report = buildStrengthReviewReport(chart(sample.pillars));
      const expected = sample.expected as {
        dayStem: string;
        monthBranch: string;
        visiblePressureHasUnrooted: boolean;
        monthHiddenPressureRoles: string[];
        monthHiddenPressureShiShen: string[];
      };

      expect(report.dayStem).toBe(expected.dayStem);
      expect(report.monthBranch).toBe(expected.monthBranch);
      expect(report.visibleRelations.pressureEvidence.some((item) => item.presence === "unrooted-visible")).toBe(
        expected.visiblePressureHasUnrooted,
      );

      const monthPressure = report.hiddenRelations.branchRelationEvidence.filter(
        (item) => item.slot === "month" && item.relationSide === "pressure" && ["정기", "중기"].includes(item.hiddenRole),
      );
      expect(monthPressure.map((item) => item.hiddenRole)).toEqual(expected.monthHiddenPressureRoles);
      expect(monthPressure.map((item) => item.shiShen)).toEqual(expected.monthHiddenPressureShiShen);
      expect(report).not.toHaveProperty("score");
    }
  });
});

describe("exactStemVisibility", () => {
  it("甲酉 / 庚酉 / 甲酉 — 酉辛 is 金 rooted-visible but 辛 is not on any stem", () => {
    const report = buildStrengthReviewReport(
      chart({
        year: { stem: "甲", branch: "酉" },
        month: { stem: "庚", branch: "酉" },
        day: { stem: "甲", branch: "酉" },
        hour: "unknown",
      }),
    );

    const xin = report.hiddenRelations.branchRelationEvidence.filter((item) => item.hiddenStem === "辛");
    expect(xin).toHaveLength(3);
    for (const item of xin) {
      expect(item.shiShen).toBe("정관");
      expect(item.element).toBe("金");
      expect(item.elementPresence).toBe("rooted-visible");
      expect(item.presence).toBe("rooted-visible");
      expect(item.exactStemVisible).toBe(false);
      expect(item.exactStemVisibleAt).toEqual([]);
    }
  });

  it("甲辰 / 丙午 / 丁酉 / 庚申 — 申 정기 庚 matches hour stem without merging sources", () => {
    const report = buildStrengthReviewReport(
      chart({
        year: { stem: "甲", branch: "辰" },
        month: { stem: "丙", branch: "午" },
        day: { stem: "丁", branch: "酉" },
        hour: { stem: "庚", branch: "申" },
      }),
    );

    const hourGeng = report.hiddenRelations.branchRelationEvidence.find(
      (item) => item.sourceKey === "hour:申:庚:정기",
    );
    expect(hourGeng).toMatchObject({
      hiddenStem: "庚",
      shiShen: "정재",
      exactStemVisible: true,
    });
    expect(hourGeng?.exactStemVisibleAt).toEqual(["hour"]);
    expect(report.visibleRelations.pressureEvidence).toEqual([
      expect.objectContaining({ slot: "hour", stem: "庚", shiShen: "정재" }),
    ]);
    expect(report.sourceOverlap.overlappingSourceKeys).not.toContain("hour:申:庚:정기");
  });

  it("omits hour from exactStemVisibleAt when hour is unknown", () => {
    const evidence = collectStrengthEvidence(
      chart({
        year: { stem: "甲", branch: "寅" },
        month: { stem: "甲", branch: "寅" },
        day: { stem: "甲", branch: "子" },
        hour: "unknown",
      }),
    );

    expect(evidence.branchRelationEvidence.items.every((item) => !item.exactStemVisibleAt.includes("hour"))).toBe(
      true,
    );
    const jia = evidence.branchRelationEvidence.items.filter((item) => item.hiddenStem === "甲");
    expect(jia.every((item) => item.exactStemVisible)).toBe(true);
    expect(jia[0]?.exactStemVisibleAt).toEqual(["year", "month", "day"]);
  });

  it("re-runs all 16 review charts with exactStem fields and no score", () => {
    expect(axisSamples).toHaveLength(16);
    for (const sample of axisSamples) {
      const report = buildStrengthReviewReport(chart(sample.pillars));
      expect(report.hiddenRelations.branchRelationEvidence.length).toBeGreaterThan(0);
      expect(
        report.hiddenRelations.branchRelationEvidence.every(
          (item) => item.elementPresence === item.presence && typeof item.exactStemVisible === "boolean",
        ),
      ).toBe(true);
      if (report.hourUnknown) {
        expect(report.hiddenRelations.branchRelationEvidence.every((item) => !item.exactStemVisibleAt.includes("hour"))).toBe(
          true,
        );
      }
      expect(report).not.toHaveProperty("score");
      expect(report).not.toHaveProperty("strength");
      expect(report).not.toHaveProperty("yongsin");
    }
  });
});
