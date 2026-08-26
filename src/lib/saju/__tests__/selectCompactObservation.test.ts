import { describe, expect, it } from "vitest";
import {
  buildAdjustedClimateSummary,
  buildFreeInterpretation,
  buildNeedCandidateSet,
  buildNeedResolution,
  buildStrengthSummary,
} from "@/lib/saju";
import { buildObservationInterpretation } from "@/lib/saju/observation/interpretation/buildObservationInterpretation";
import { selectCompactObservation } from "@/lib/saju/observation/interpretation/selectCompactObservation";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import { buildSpeakableOutput } from "@/lib/saju/speakable/buildSpeakableOutput";
import type { FourPillars, HourPillar, Pillar } from "@/lib/saju/types";

function chart(partial: {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  hour: HourPillar;
}): FourPillars {
  return {
    ...partial,
    hourCertainty: partial.hour === "unknown" ? "unknown" : "confirmed",
    warnings: [],
  };
}

const chartB = chart({
  year: { stem: "辛", branch: "酉" },
  month: { stem: "乙", branch: "未" },
  day: { stem: "丙", branch: "申" },
  hour: { stem: "丁", branch: "酉" },
});

function buildView(pillars: FourPillars) {
  const strength = buildStrengthSummary(pillars);
  const climate = buildAdjustedClimateSummary(pillars);
  const needCandidates = buildNeedCandidateSet(pillars);
  const needResolution = buildNeedResolution(pillars);
  const speakable = buildSpeakableOutput({
    strength,
    climate,
    needCandidates,
    needResolution,
    hourUnknown: pillars.hour === "unknown",
  });
  const interpretation = buildFreeInterpretation({
    speakable,
    strength,
    climate,
    needCandidates,
    needResolution,
  });
  const observations = buildStrengthObservations(pillars);
  const observation = buildObservationInterpretation({
    dayStem: observations.dayStem,
    structureObservation: observations.structureObservation,
  });
  return selectCompactObservation({ headline: interpretation.headline, interpretation, observation });
}

describe("selectCompactObservation — chart B", () => {
  it("selects compact basic view for B", () => {
    const compact = buildView(chartB);

    expect(compact.basicHelping.map((item) => item.text)).toEqual([
      "나무와 불의 성질이 서로 이어지는 관계가 보여요.",
      "같은 불의 성질이 함께 자리하는 모습이 보여요.",
    ]);
    expect(compact.basicActing.map((item) => item.text)).toEqual([
      "쇠의 성질이 여러 자리에서 함께 나타나요.",
    ]);
    expect(compact.basicCoexistence).toBeNull();
    expect(compact.basicClimateNote?.text).toBe(
      "따뜻한 성향을 볼 때 물(水)의 차분하고 식혀 주는 성질을 참고해 볼 수 있어요. 꼭 필요한 기운으로 정한 것은 아니에요.",
    );
    expect(compact.detailHelping.map((item) => item.kind)).toEqual(["resource-support"]);
    expect(compact.detailActing.map((item) => item.kind)).toEqual(["pressure-visible-stem"]);
    expect(compact.detailCoexistence?.text).toBe(
      "나를 돕는 관계와 다른 성질이 함께 나타나는 모습이 보여요.",
    );
    expect(compact.detailHiddenContext).toHaveLength(3);
  });
});
