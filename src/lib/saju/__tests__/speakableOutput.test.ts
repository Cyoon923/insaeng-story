import { describe, expect, it } from "vitest";
import {
  buildAdjustedClimateSummary,
  buildNeedCandidateSet,
  buildNeedResolution,
  buildStrengthSummary,
} from "@/lib/saju";
import { buildSpeakableOutput } from "@/lib/saju/speakable/buildSpeakableOutput";
import type { FourPillars, HourPillar, Pillar } from "@/lib/saju/types";

function chart(partial: { year: Pillar; month: Pillar; day: Pillar; hour: HourPillar }): FourPillars {
  return {
    ...partial,
    hourCertainty: partial.hour === "unknown" ? "unknown" : "confirmed",
    warnings: [],
  };
}

function speakableFrom(pillars: FourPillars) {
  const strength = buildStrengthSummary(pillars);
  const climate = buildAdjustedClimateSummary(pillars);
  const needCandidates = buildNeedCandidateSet(pillars);
  const needResolution = buildNeedResolution(pillars);
  return {
    strength,
    needCandidates,
    needResolution,
    output: buildSpeakableOutput({
      strength,
      climate,
      needCandidates,
      needResolution,
      hourUnknown: pillars.hour === "unknown",
    }),
  };
}

function assertNoForbiddenFields(output: ReturnType<typeof buildSpeakableOutput>) {
  expect(output).not.toHaveProperty("yongsin");
  expect(output).not.toHaveProperty("heesin");
  expect(output).not.toHaveProperty("neededElement");
  expect(output).not.toHaveProperty("finalElement");
  expect(output).not.toHaveProperty("winner");
  expect(output).not.toHaveProperty("score");
  expect(output).not.toHaveProperty("rank");
  expect(output).not.toHaveProperty("priority");
  expect(output.provisional).toBe(true);
  expect(output.musicRecommendationHints).not.toHaveProperty("winner");
  expect(output.musicRecommendationHints).not.toHaveProperty("element");
}

describe("buildSpeakableOutput", () => {
  it("1. confirmed hour + usable Need → strength need themes and bag allowed", () => {
    const pillars = chart({
      year: { stem: "丙", branch: "午" },
      month: { stem: "戊", branch: "戌" },
      day: { stem: "甲", branch: "申" },
      hour: { stem: "甲", branch: "子" },
    });
    const { strength, needCandidates, needResolution, output } = speakableFrom(pillars);

    expect(strength.directionCandidate).toBe("leaning-weak");
    expect(strength.directionSensitivity).toBeNull();
    expect(needCandidates.strengthNeedStatus).toBe("ready");
    expect(output.hourUnknown).toBe(false);
    expect(output.hourUnknownProvisional).toBe(false);
    expect(output.provisional).toBe(true);
    // deferred-strength-only 등 blocker가 있으면 resolution 결론 금지 → partial-hold (계약 §9)
    // 그래도 Strength Need 후보 테마·가방은 허용
    expect(["ready-provisional", "partial-hold"]).toContain(output.speakableStatus);
    expect(output.supportThemes.length).toBeGreaterThan(0);
    expect(output.supportThemes.every((item) => item.kind === "need-strength-candidate")).toBe(true);
    expect(output.musicRecommendationHints.elementThemeBag).toEqual(
      expect.arrayContaining(["木", "水"]),
    );
    expect(output.musicRecommendationHints.moodTags.length).toBeGreaterThan(0);
    if (needResolution.decisionBlockedBy.length > 0) {
      expect(output.fallbackApplied).toContain("FB-RESOLUTION-BLOCKED");
      expect(output.speakableStatus).toBe("partial-hold");
    } else {
      expect(output.speakableStatus).toBe("ready-provisional");
    }
    assertNoForbiddenFields(output);
  });

  it("2. hour unknown + provisional Strength → Strength Need themes empty", () => {
    const pillars = chart({
      year: { stem: "甲", branch: "寅" },
      month: { stem: "甲", branch: "寅" },
      day: { stem: "甲", branch: "子" },
      hour: "unknown",
    });
    const { strength, needCandidates, output } = speakableFrom(pillars);

    expect(strength.directionCandidate).toBe("leaning-strong");
    expect(strength.directionSensitivity).toBe("hour-unknown-provisional");
    expect(needCandidates.strengthNeedStatus).toBe("unresolved");
    expect(needCandidates.strengthNeedCandidates).toEqual([]);

    expect(output.hourUnknown).toBe(true);
    expect(output.hourUnknownProvisional).toBe(true);
    expect(output.speakableStatus).toBe("partial-hold");
    expect(output.confidence).toBe("partial");
    expect(output.observationThemes.length).toBeGreaterThan(0);
    expect(output.observationThemes[0]?.phrase).toContain("잠정");
    expect(output.supportThemes).toEqual([]);
    expect(output.cautionThemes).toEqual([]);
    expect(output.fallbackApplied).toEqual(
      expect.arrayContaining(["FB-HOUR-UNKNOWN-PROVISIONAL", "FB-STRENGTH-NEED-GATED"]),
    );
    expect(
      output.musicRecommendationHints.elementThemeBag.every((element) =>
        output.climateThemes.some((theme) => theme.elements?.includes(element)),
      ),
    ).toBe(true);
    assertNoForbiddenFields(output);
  });

  it("3. mixed / unresolved → hold or fallback", () => {
    const pillars = chart({
      year: { stem: "己", branch: "卯" },
      month: { stem: "丙", branch: "子" },
      day: { stem: "戊", branch: "午" },
      hour: { stem: "戊", branch: "午" },
    });
    const { strength, needCandidates, output } = speakableFrom(pillars);

    expect(strength.directionCandidate).toBe("mixed");
    expect(needCandidates.strengthNeedStatus).toBe("unresolved");
    expect(output.supportThemes).toEqual([]);
    expect(output.cautionThemes).toEqual([]);
    expect(output.fallbackApplied).toContain("FB-STRENGTH-MIXED");
    expect(["partial-hold", "diagnostic-only"]).toContain(output.speakableStatus);
    expect(["partial", "hold"]).toContain(output.confidence);
    assertNoForbiddenFields(output);
  });

  it("4. climate-only → climate themes without Strength Need", () => {
    const pillars = chart({
      year: { stem: "庚", branch: "子" },
      month: { stem: "己", branch: "未" },
      day: { stem: "辛", branch: "卯" },
      hour: "unknown",
    });
    const { needCandidates, needResolution, output } = speakableFrom(pillars);

    expect(needCandidates.strengthNeedStatus).toBe("unresolved");
    expect(needCandidates.climateNeedCandidates.length).toBeGreaterThan(0);
    expect(needResolution.relationPattern).toBe("climate-only");

    expect(output.supportThemes).toEqual([]);
    expect(output.cautionThemes).toEqual([]);
    expect(output.climateThemes.some((item) => item.kind === "need-climate-candidate")).toBe(true);
    expect(output.musicRecommendationHints.elementThemeBag).toEqual(
      expect.arrayContaining(needCandidates.climateNeedCandidates.map((item) => item.element)),
    );
    expect(output.internal.relationPattern).toBe("climate-only");
    expect(output.internal.resolutionStatus).toBe("single-axis");
    assertNoForbiddenFields(output);
  });

  it("5. contested dry climate boundary is not promoted to definitive phrasing", () => {
    const pillars = chart({
      year: { stem: "甲", branch: "酉" },
      month: { stem: "庚", branch: "酉" },
      day: { stem: "甲", branch: "酉" },
      hour: "unknown",
    });
    const { needCandidates, output } = speakableFrom(pillars);

    const dryNeed = needCandidates.climateNeedCandidates.find((item) =>
      item.reasons.includes("climate-moisture-dry"),
    );
    expect(dryNeed?.element).toBe("水");

    const dryThemes = output.climateThemes.filter(
      (item) =>
        item.provenance.some((p) => p.evidenceRef.includes("dry")) ||
        item.provenance.some((p) => p.evidenceRef.includes("climate-moisture-dry")),
    );
    expect(dryThemes.length).toBeGreaterThan(0);
    for (const item of dryThemes) {
      expect(item.phrase).toMatch(/잠정|보일 수 있어요|후보일 수 있어요/);
      expect(item.phrase).not.toMatch(/확정|한습합니다|조열합니다|용신/);
      expect(
        item.provenance.some((p) => p.evidenceRef === "climate.boundary=contested-inherited") ||
          item.provenance.some((p) => p.evidenceRef === "need.climate.boundary=contested-inherited"),
      ).toBe(true);
    }
    expect(output.provisional).toBe(true);
    assertNoForbiddenFields(output);
  });

  it("6. forbidden fields are absent; convergent is not a truth flag", () => {
    const pillars = chart({
      year: { stem: "丙", branch: "午" },
      month: { stem: "戊", branch: "戌" },
      day: { stem: "甲", branch: "申" },
      hour: { stem: "甲", branch: "子" },
    });
    const { output } = speakableFrom(pillars);
    assertNoForbiddenFields(output);

    const serialized = JSON.stringify(output);
    expect(serialized).not.toMatch(/"yongsin"/);
    expect(serialized).not.toMatch(/"neededElement"/);
    expect(serialized).not.toMatch(/"winner"/);
    expect(serialized).not.toMatch(/"score"/);
    expect(output.musicRecommendationHints.forbidden).toEqual(
      expect.arrayContaining(["용신 확정", "convergent=정답"]),
    );
    expect(output.observationThemes.every((item) => item.kind !== "relation-meta")).toBe(true);
    if (output.internal.resolutionStatus === "convergent") {
      expect(output.observationThemes.some((item) => item.phrase.includes("용신"))).toBe(false);
    }
  });
});
