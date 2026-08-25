import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildStrengthSummary } from "@/lib/saju/elements/strengthSummary";
import type { FourPillars, HourPillar, Pillar } from "@/lib/saju/types";

type SamplePillars = {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  hour: HourPillar;
};

const axisSamples = JSON.parse(
  readFileSync(path.join(__dirname, "axisReview.fixtures.json"), "utf8"),
).samples as Array<{ id: string; name: string; pillars: SamplePillars }>;

const conflictFixtures = JSON.parse(
  readFileSync(path.join(__dirname, "conflictType.fixtures.json"), "utf8"),
) as {
  typeC: Array<{ id: string; name: string; pillars: SamplePillars }>;
  typeI: Array<{ id: string; name: string; pillars: SamplePillars }>;
};

function chart(partial: SamplePillars): FourPillars {
  return {
    ...partial,
    hourCertainty: partial.hour === "unknown" ? "unknown" : "confirmed",
    warnings: [],
  };
}

function forbiddenFields(summary: ReturnType<typeof buildStrengthSummary>) {
  expect(summary).not.toHaveProperty("score");
  expect(summary).not.toHaveProperty("strength");
  expect(summary).not.toHaveProperty("deukryeong");
  expect(summary).not.toHaveProperty("yongsin");
  expect(summary).not.toHaveProperty("need");
}

describe("StrengthSummary CASE", () => {
  it("CASE 1 甲寅 / 甲寅 / 甲子 / unknown → leaning-strong", () => {
    const summary = buildStrengthSummary(
      chart({
        year: { stem: "甲", branch: "寅" },
        month: { stem: "甲", branch: "寅" },
        day: { stem: "甲", branch: "子" },
        hour: "unknown",
      }),
    );

    expect(summary.seasonalPhase).toBe("왕");
    expect(summary.rootQuality).toBe("clear");
    expect(summary.strongSideEvidence).toEqual(
      expect.arrayContaining([
        { kind: "seasonal", quality: "왕" },
        { kind: "root", quality: "clear" },
        expect.objectContaining({
          kind: "visible-support",
          quality: "rooted-visible",
          shiShen: "비견",
        }),
      ]),
    );
    expect(summary.weakSideEvidence.some((item) => item.kind === "visible-pressure" && item.quality === "rooted-visible")).toBe(
      false,
    );
    expect(summary.hiddenSupportNotes.every((item) => item.sourceKey !== "year:寅:甲:정기")).toBe(true);
    expect(summary.hiddenSupportNotes.every((item) => item.sourceKey !== "month:寅:甲:정기")).toBe(true);
    expect(summary.directionCandidate).toBe("leaning-strong");
    expect(summary.certainty).toBe("partial");
    expect(summary.resolution).toBe("clear-direction");
    expect(summary.directionSensitivity).toBe("hour-unknown-provisional");
    expect(summary.omittedSlots).toEqual(["hour"]);
    expect(summary.sourceBreakdown).toEqual({
      peer: { rootedVisible: true, unrootedVisible: false },
      resource: { rootedVisible: false, unrootedVisible: false },
      output: { rootedVisible: false, unrootedVisible: false },
      wealth: { rootedVisible: false, unrootedVisible: false },
      officer: { rootedVisible: false, unrootedVisible: false },
    });
    forbiddenFields(summary);
  });

  it("CASE 2 甲酉 / 庚酉 / 甲酉 / unknown → leaning-weak", () => {
    const summary = buildStrengthSummary(
      chart({
        year: { stem: "甲", branch: "酉" },
        month: { stem: "庚", branch: "酉" },
        day: { stem: "甲", branch: "酉" },
        hour: "unknown",
      }),
    );

    expect(summary.seasonalPhase).toBe("사");
    expect(summary.rootQuality).toBe("absent");
    expect(summary.strongSideEvidence).toEqual([
      expect.objectContaining({
        kind: "visible-support",
        stem: "甲",
        shiShen: "비견",
        quality: "unrooted-visible",
      }),
    ]);
    expect(summary.weakSideEvidence).toEqual(
      expect.arrayContaining([
        { kind: "seasonal", quality: "사" },
        { kind: "root", quality: "absent" },
        expect.objectContaining({
          kind: "visible-pressure",
          stem: "庚",
          shiShen: "편관",
          quality: "rooted-visible",
        }),
      ]),
    );
    expect(summary.hiddenPressureNotes).toHaveLength(3);
    expect(summary.hiddenPressureNotes.every((item) => item.hiddenStem === "辛" && item.shiShen === "정관")).toBe(true);
    expect(summary.hiddenPressureNotes.every((item) => item.elementPresence === "rooted-visible")).toBe(true);
    expect(summary.hiddenPressureNotes.every((item) => item.exactStemVisible === false)).toBe(true);
    expect(summary.weakSideEvidence.filter((item) => item.shiShen === "정관")).toHaveLength(0);
    expect(summary.directionCandidate).toBe("leaning-weak");
    expect(summary.certainty).toBe("partial");
    expect(summary.resolution).toBe("clear-direction");
    expect(summary.directionSensitivity).toBe("hour-unknown-provisional");
    expect(summary.sourceBreakdown).toEqual({
      peer: { rootedVisible: false, unrootedVisible: true },
      resource: { rootedVisible: false, unrootedVisible: false },
      output: { rootedVisible: false, unrootedVisible: false },
      wealth: { rootedVisible: false, unrootedVisible: false },
      officer: { rootedVisible: true, unrootedVisible: false },
    });
    forbiddenFields(summary);
  });

  it("CASE 3 甲寅 / 庚申 / 甲子 / unknown → mixed", () => {
    const summary = buildStrengthSummary(
      chart({
        year: { stem: "甲", branch: "寅" },
        month: { stem: "庚", branch: "申" },
        day: { stem: "甲", branch: "子" },
        hour: "unknown",
      }),
    );

    expect(summary.seasonalPhase).toBe("사");
    expect(summary.rootQuality).toBe("clear");
    expect(summary.strongSideEvidence).toEqual(
      expect.arrayContaining([
        { kind: "root", quality: "clear" },
        expect.objectContaining({ kind: "visible-support", shiShen: "비견", quality: "rooted-visible" }),
      ]),
    );
    expect(summary.weakSideEvidence).toEqual(
      expect.arrayContaining([
        { kind: "seasonal", quality: "사" },
        expect.objectContaining({ kind: "visible-pressure", shiShen: "편관", quality: "rooted-visible" }),
      ]),
    );
    expect(summary.directionCandidate).toBe("mixed");
    expect(summary.certainty).toBe("partial");
    expect(summary.resolution).toBe("mixed");
    forbiddenFields(summary);
  });

  it("CASE 4 丙子 / 丁酉 / 甲子 / unknown → unresolved", () => {
    const summary = buildStrengthSummary(
      chart({
        year: { stem: "丙", branch: "子" },
        month: { stem: "丁", branch: "酉" },
        day: { stem: "甲", branch: "子" },
        hour: "unknown",
      }),
    );

    expect(summary.seasonalPhase).toBe("사");
    expect(summary.rootQuality).toBe("absent");
    expect(summary.weakSideEvidence.filter((item) => item.kind === "visible-pressure").every((item) => item.quality === "unrooted-visible")).toBe(
      true,
    );
    expect(summary.hiddenPressureNotes.some((item) => item.shiShen === "정관")).toBe(true);
    expect(summary.hiddenSupportNotes.some((item) => item.shiShen === "정인")).toBe(true);
    expect(summary.directionCandidate).toBeNull();
    expect(summary.resolution).toBe("unresolved");
    expect(summary.certainty).toBe("partial");
    expect(summary.directionSensitivity).toBeNull();
    expect(summary.unresolvedReasons.length).toBeGreaterThan(0);
    forbiddenFields(summary);
  });

  it("CASE 5 甲辰 / 丙午 / 丁酉 / 庚申 → mixed", () => {
    const summary = buildStrengthSummary(
      chart({
        year: { stem: "甲", branch: "辰" },
        month: { stem: "丙", branch: "午" },
        day: { stem: "丁", branch: "酉" },
        hour: { stem: "庚", branch: "申" },
      }),
    );

    expect(summary.seasonalPhase).toBe("왕");
    expect(summary.rootQuality).toBe("clear");
    expect(summary.strongSideEvidence.some((item) => item.kind === "visible-support" && item.quality === "rooted-visible")).toBe(
      true,
    );
    expect(summary.weakSideEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "visible-pressure", slot: "hour", stem: "庚", shiShen: "정재", quality: "rooted-visible" }),
      ]),
    );
    expect(summary.directionCandidate).toBe("mixed");
    expect(summary.resolution).toBe("mixed");
    expect(summary.certainty).toBe("complete");
    expect(summary.directionSensitivity).toBeNull();
    expect(summary.omittedSlots).toEqual([]);
    forbiddenFields(summary);
  });
});

describe("StrengthSummary directionSensitivity", () => {
  it("marks hour-unknown-provisional when unknown hour yields leaning-*", () => {
    const strong = buildStrengthSummary(
      chart({
        year: { stem: "甲", branch: "寅" },
        month: { stem: "甲", branch: "寅" },
        day: { stem: "甲", branch: "子" },
        hour: "unknown",
      }),
    );
    expect(strong.directionCandidate).toBe("leaning-strong");
    expect(strong.resolution).toBe("clear-direction");
    expect(strong.certainty).toBe("partial");
    expect(strong.directionSensitivity).toBe("hour-unknown-provisional");

    const weak = buildStrengthSummary(
      chart({
        year: { stem: "甲", branch: "酉" },
        month: { stem: "庚", branch: "酉" },
        day: { stem: "甲", branch: "酉" },
        hour: "unknown",
      }),
    );
    expect(weak.directionCandidate).toBe("leaning-weak");
    expect(weak.resolution).toBe("clear-direction");
    expect(weak.certainty).toBe("partial");
    expect(weak.directionSensitivity).toBe("hour-unknown-provisional");
  });

  it("omits hour-unknown-provisional when hour is confirmed and leaning-*", () => {
    const summary = buildStrengthSummary(
      chart({
        year: { stem: "甲", branch: "寅" },
        month: { stem: "甲", branch: "寅" },
        day: { stem: "甲", branch: "子" },
        hour: { stem: "甲", branch: "子" },
      }),
    );
    expect(summary.directionCandidate).toBe("leaning-strong");
    expect(summary.resolution).toBe("clear-direction");
    expect(summary.certainty).toBe("complete");
    expect(summary.directionSensitivity).toBeNull();
  });
});

describe("StrengthSummary 회귀", () => {
  it("builds summaries for 16 axis charts plus C/I without scores", () => {
    const all = [
      ...axisSamples,
      ...conflictFixtures.typeC,
      ...conflictFixtures.typeI,
    ];
    expect(all.length).toBeGreaterThanOrEqual(20);

    for (const sample of all) {
      const summary = buildStrengthSummary(chart(sample.pillars));
      expect(["complete", "partial"]).toContain(summary.certainty);
      expect(["왕", "상", "휴", "수", "사"]).toContain(summary.seasonalPhase);
      expect(["clear", "present", "shallow", "absent"]).toContain(summary.rootQuality);
      expect(["leaning-strong", "mixed", "leaning-weak", null]).toContain(summary.directionCandidate);
      expect(["clear-direction", "mixed", "unresolved"]).toContain(summary.resolution);
      expect(Array.isArray(summary.strongSideEvidence)).toBe(true);
      expect(Array.isArray(summary.weakSideEvidence)).toBe(true);
      expect(Array.isArray(summary.hiddenSupportNotes)).toBe(true);
      expect(Array.isArray(summary.hiddenPressureNotes)).toBe(true);
      expect(summary.sourceBreakdown).toEqual(
        expect.objectContaining({
          peer: expect.objectContaining({ rootedVisible: expect.any(Boolean), unrootedVisible: expect.any(Boolean) }),
          resource: expect.objectContaining({ rootedVisible: expect.any(Boolean), unrootedVisible: expect.any(Boolean) }),
          output: expect.objectContaining({ rootedVisible: expect.any(Boolean), unrootedVisible: expect.any(Boolean) }),
          wealth: expect.objectContaining({ rootedVisible: expect.any(Boolean), unrootedVisible: expect.any(Boolean) }),
          officer: expect.objectContaining({ rootedVisible: expect.any(Boolean), unrootedVisible: expect.any(Boolean) }),
        }),
      );
      expect(Array.isArray(summary.conflicts)).toBe(true);
      expect(Array.isArray(summary.unresolvedReasons)).toBe(true);
      expect(Array.isArray(summary.omittedSlots)).toBe(true);
      if (summary.directionCandidate === "leaning-strong" || summary.directionCandidate === "leaning-weak") {
        expect(summary.resolution).toBe("clear-direction");
        if (sample.pillars.hour === "unknown") {
          expect(summary.directionSensitivity).toBe("hour-unknown-provisional");
        } else {
          expect(summary.directionSensitivity).toBeNull();
        }
      } else {
        expect(summary.directionSensitivity).toBeNull();
      }
      if (summary.directionCandidate === "mixed") expect(summary.resolution).toBe("mixed");
      if (summary.directionCandidate === null) expect(summary.resolution).toBe("unresolved");
      if (summary.seasonalPhase === "휴") {
        expect(summary.strongSideEvidence.some((item) => item.kind === "seasonal")).toBe(false);
        expect(summary.weakSideEvidence.some((item) => item.kind === "seasonal")).toBe(false);
      }
      forbiddenFields(summary);
    }
  });

  it("does not treat 정기 겁재 as weaker than 정기 비견", () => {
    const summary = buildStrengthSummary(
      chart({
        year: { stem: "庚", branch: "申" },
        month: { stem: "甲", branch: "寅" },
        day: { stem: "乙", branch: "酉" },
        hour: "unknown",
      }),
    );
    expect(summary.rootQuality).toBe("clear");
  });
});

describe("StrengthSummary sourceBreakdown", () => {
  it("maps peer/resource/output/wealth/officer without changing directionCandidate", () => {
    const summary = buildStrengthSummary(
      chart({
        year: { stem: "壬", branch: "子" },
        month: { stem: "乙", branch: "卯" },
        day: { stem: "甲", branch: "寅" },
        hour: { stem: "戊", branch: "午" },
      }),
    );

    // 壬=정인 resource, 乙=겁재 peer, 戊=편재 wealth; hour 午 may root 戊
    expect(summary.sourceBreakdown.peer.rootedVisible || summary.sourceBreakdown.peer.unrootedVisible).toBe(true);
    expect(summary.sourceBreakdown.resource.rootedVisible || summary.sourceBreakdown.resource.unrootedVisible).toBe(true);
    expect(summary.sourceBreakdown.wealth.rootedVisible || summary.sourceBreakdown.wealth.unrootedVisible).toBe(true);
    expect(summary.sourceBreakdown.output).toEqual({ rootedVisible: false, unrootedVisible: false });
    expect(summary.sourceBreakdown.officer).toEqual({ rootedVisible: false, unrootedVisible: false });

    const again = buildStrengthSummary(
      chart({
        year: { stem: "壬", branch: "子" },
        month: { stem: "乙", branch: "卯" },
        day: { stem: "甲", branch: "寅" },
        hour: { stem: "戊", branch: "午" },
      }),
    );
    expect(again.directionCandidate).toBe(summary.directionCandidate);
    expect(again.sourceBreakdown).toEqual(summary.sourceBreakdown);
  });

  it("maps output and officer on pressure stems", () => {
    const summary = buildStrengthSummary(
      chart({
        year: { stem: "丙", branch: "午" },
        month: { stem: "庚", branch: "申" },
        day: { stem: "甲", branch: "子" },
        hour: "unknown",
      }),
    );

    // 丙=식신 output, 庚=편관 officer for 甲
    expect(summary.sourceBreakdown.output.rootedVisible || summary.sourceBreakdown.output.unrootedVisible).toBe(true);
    expect(summary.sourceBreakdown.officer.rootedVisible || summary.sourceBreakdown.officer.unrootedVisible).toBe(true);
    expect(summary.sourceBreakdown.peer).toEqual({ rootedVisible: false, unrootedVisible: false });
    expect(summary.sourceBreakdown.resource).toEqual({ rootedVisible: false, unrootedVisible: false });
    expect(summary.sourceBreakdown.wealth).toEqual({ rootedVisible: false, unrootedVisible: false });
    expect(["leaning-strong", "mixed", "leaning-weak", null]).toContain(summary.directionCandidate);
  });
});
