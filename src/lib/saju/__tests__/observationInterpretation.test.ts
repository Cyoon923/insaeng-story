import { describe, expect, it } from "vitest";
import {
  assertObservationInterpretationCopySafe,
  buildObservationInterpretation,
} from "@/lib/saju/observation/interpretation/buildObservationInterpretation";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
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

function interpret(pillars: FourPillars) {
  const observations = buildStrengthObservations(pillars);
  const interpretation = buildObservationInterpretation({
    dayStem: observations.dayStem,
    structureObservation: observations.structureObservation,
  });
  assertObservationInterpretationCopySafe(interpretation);
  return interpretation;
}

const chartB = chart({
  year: { stem: "辛", branch: "酉" },
  month: { stem: "乙", branch: "未" },
  day: { stem: "丙", branch: "申" },
  hour: { stem: "丁", branch: "酉" },
});

const chartRC01 = chart({
  year: { stem: "甲", branch: "寅" },
  month: { stem: "甲", branch: "寅" },
  day: { stem: "甲", branch: "子" },
  hour: { stem: "甲", branch: "子" },
});

describe("buildObservationInterpretation — chart B", () => {
  it("builds helping, acting, coexistence, and hidden detail for B", () => {
    const interpretation = interpret(chartB);

    expect(interpretation.dayStem).toBe("丙");
    expect(interpretation.helpingRelations).toEqual([
      expect.objectContaining({
        kind: "generation-support",
        elements: ["木", "火"],
        text: "나무와 불의 성질이 서로 이어지는 관계가 보여요.",
      }),
      expect.objectContaining({
        kind: "resource-support",
        elements: ["木"],
        text: "나무의 성질이 나와 이어지는 관계도 보여요.",
      }),
      expect.objectContaining({
        kind: "peer-support",
        elements: ["火"],
        text: "같은 불의 성질이 함께 자리하는 모습이 보여요.",
      }),
    ]);

    expect(interpretation.actingStructures).toEqual([
      expect.objectContaining({
        kind: "pressure-visible-stem",
        element: "金",
        text: "쇠의 성질이 겉으로 드러난 자리에서도 보여요.",
      }),
      expect.objectContaining({
        kind: "pressure-branch-anchor",
        element: "金",
        text: "쇠의 성질이 여러 자리에서 함께 나타나요.",
      }),
    ]);

    expect(interpretation.coexistence).toEqual({
      kind: "support-and-pressure-coexist",
      text: "나를 돕는 관계와 다른 성질이 함께 나타나는 모습이 보여요.",
    });

    expect(interpretation.hiddenContextDetail.map((item) => item.element).sort()).toEqual(["土", "水", "金"]);
    expect(
      interpretation.actingStructures.some((item) => item.element === "土"),
    ).toBe(false);
  });

  it("does not expose internal enum strings in user-facing text", () => {
    const interpretation = interpret(chartB);
    const userText = [
      ...interpretation.helpingRelations.map((item) => item.text),
      ...interpretation.actingStructures.map((item) => item.text),
      ...(interpretation.coexistence ? [interpretation.coexistence.text] : []),
      ...interpretation.hiddenContextDetail.map((item) => item.text),
    ].join("\n");

    expect(userText).not.toContain("generation-support");
    expect(userText).not.toContain("pressure-visible-stem");
    expect(userText).not.toContain("정인");
    expect(userText).not.toContain("겁재");
  });
});

describe("buildObservationInterpretation — edge cases", () => {
  it("support-only chart has helping relations without coexistence", () => {
    const interpretation = interpret(
      chart({
        year: { stem: "甲", branch: "寅" },
        month: { stem: "丙", branch: "寅" },
        day: { stem: "丙", branch: "寅" },
        hour: { stem: "丁", branch: "午" },
      }),
    );

    expect(interpretation.helpingRelations.length).toBeGreaterThan(0);
    expect(interpretation.actingStructures).toEqual([]);
    expect(interpretation.coexistence).toBeNull();
  });

  it("pressure-only chart has acting or hidden detail without helping or coexistence", () => {
    const interpretation = interpret(
      chart({
        year: { stem: "庚", branch: "申" },
        month: { stem: "辛", branch: "酉" },
        day: { stem: "丙", branch: "子" },
        hour: { stem: "庚", branch: "申" },
      }),
    );

    expect(interpretation.helpingRelations).toEqual([]);
    expect(interpretation.coexistence).toBeNull();
    expect(
      interpretation.actingStructures.length + interpretation.hiddenContextDetail.length,
    ).toBeGreaterThan(0);
  });

  it("hidden-only pressure (RC-01) keeps detail-only copy and skips acting/coexistence", () => {
    const interpretation = interpret(chartRC01);

    expect(interpretation.helpingRelations.length).toBeGreaterThan(0);
    expect(interpretation.actingStructures).toEqual([]);
    expect(interpretation.coexistence).toBeNull();
    expect(interpretation.hiddenContextDetail.length).toBeGreaterThan(0);
    expect(interpretation.hiddenContextDetail.every((item) => item.detailOnly)).toBe(true);
  });
});
