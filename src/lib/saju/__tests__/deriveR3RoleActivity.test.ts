import { describe, expect, it } from "vitest";
import { deriveR3RoleActivity } from "@/lib/saju/final/deriveR3RoleActivity";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { generatedElement } from "@/lib/saju/observation/elementGenerates";
import { stemElement } from "@/lib/saju/constants/elements";
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

function isOutputShiShen(shiShen: string): boolean {
  return shiShen === "식신" || shiShen === "상관";
}

describe("deriveR3RoleActivity", () => {
  it("returns C when rooted-visible 식상 pressure exists", () => {
    const pillars = chart({
      year: { stem: "丙", branch: "午" },
      month: { stem: "戊", branch: "午" },
      day: { stem: "甲", branch: "子" },
      hour: "unknown",
    });
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);

    expect(
      evidence.pressureEvidence.items.some(
        (item) => isOutputShiShen(item.shiShen) && item.presence === "rooted-visible",
      ),
    ).toBe(true);

    expect(deriveR3RoleActivity({ pillars, evidence, observations })).toBe("C");
  });

  it("returns C when pressure-branch-anchor confirms day output surface", () => {
    const pillars = chart({
      year: { stem: "辛", branch: "酉" },
      month: { stem: "乙", branch: "未" },
      day: { stem: "丙", branch: "申" },
      hour: { stem: "丁", branch: "酉" },
    });
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);
    const outputElement = generatedElement(stemElement(pillars.day.stem));

    expect(evidence.pressureEvidence.items.some((item) => isOutputShiShen(item.shiShen))).toBe(
      false,
    );
    expect(
      observations.structureObservation.pressureRelations.some(
        (relation) =>
          relation.kind === "pressure-branch-anchor" && relation.element === outputElement,
      ),
    ).toBe(true);

    expect(deriveR3RoleActivity({ pillars, evidence, observations })).toBe("C");
  });

  it("returns B when 식상 is unrooted-visible only", () => {
    const pillars = chart({
      year: { stem: "丙", branch: "子" },
      month: { stem: "庚", branch: "申" },
      day: { stem: "甲", branch: "子" },
      hour: "unknown",
    });
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);
    const outputPressure = evidence.pressureEvidence.items.filter((item) =>
      isOutputShiShen(item.shiShen),
    );

    expect(outputPressure.length).toBeGreaterThan(0);
    expect(outputPressure.every((item) => item.presence === "unrooted-visible")).toBe(true);

    expect(deriveR3RoleActivity({ pillars, evidence, observations })).toBe("B");
  });

  it("returns B when 식상 is hidden-only", () => {
    const pillars = chart({
      year: { stem: "甲", branch: "寅" },
      month: { stem: "甲", branch: "寅" },
      day: { stem: "甲", branch: "子" },
      hour: { stem: "甲", branch: "子" },
    });
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);

    expect(evidence.pressureEvidence.items.some((item) => isOutputShiShen(item.shiShen))).toBe(
      false,
    );
    expect(
      evidence.branchRelationEvidence.items.some(
        (item) => isOutputShiShen(item.shiShen) && item.presence === "hidden-only",
      ),
    ).toBe(true);

    expect(deriveR3RoleActivity({ pillars, evidence, observations })).toBe("B");
  });

  it("never returns C when output element only appears in generationChains", () => {
    const pillars = chart({
      year: { stem: "丙", branch: "子" },
      month: { stem: "庚", branch: "申" },
      day: { stem: "甲", branch: "子" },
      hour: "unknown",
    });
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);
    const outputElement = generatedElement(stemElement(pillars.day.stem));

    expect(
      observations.generationChains.some((chain) => {
        if (chain.from.element === outputElement) return true;
        return !("target" in chain.to) && chain.to.element === outputElement;
      }),
    ).toBe(true);
    expect(
      evidence.pressureEvidence.items.some(
        (item) => isOutputShiShen(item.shiShen) && item.presence === "rooted-visible",
      ),
    ).toBe(false);
    expect(
      observations.structureObservation.pressureRelations.some(
        (relation) =>
          relation.kind === "pressure-branch-anchor" && relation.element === outputElement,
      ),
    ).toBe(false);

    expect(deriveR3RoleActivity({ pillars, evidence, observations })).not.toBe("C");
  });

  it("returns A when there is no output role evidence", () => {
    const pillars = chart({
      year: { stem: "己", branch: "丑" },
      month: { stem: "戊", branch: "辰" },
      day: { stem: "甲", branch: "子" },
      hour: "unknown",
    });
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);
    const outputElement = generatedElement(stemElement(pillars.day.stem));

    expect(evidence.pressureEvidence.items.some((item) => isOutputShiShen(item.shiShen))).toBe(
      false,
    );
    expect(evidence.branchRelationEvidence.items.some((item) => isOutputShiShen(item.shiShen))).toBe(
      false,
    );
    expect(
      observations.generationChains.some((chain) => {
        if (chain.from.element === outputElement) return true;
        return !("target" in chain.to) && chain.to.element === outputElement;
      }),
    ).toBe(false);

    expect(deriveR3RoleActivity({ pillars, evidence, observations })).toBe("A");
  });
});
