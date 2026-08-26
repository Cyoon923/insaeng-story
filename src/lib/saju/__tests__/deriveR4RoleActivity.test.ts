import { describe, expect, it } from "vitest";
import { deriveR4RoleActivity } from "@/lib/saju/final/deriveR4RoleActivity";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
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

function isControlShiShen(shiShen: string): boolean {
  return shiShen === "정재" || shiShen === "편재" || shiShen === "정관" || shiShen === "편관";
}

function isOutputShiShen(shiShen: string): boolean {
  return shiShen === "식신" || shiShen === "상관";
}

function isWealthShiShen(shiShen: string): boolean {
  return shiShen === "정재" || shiShen === "편재";
}

function isOfficerShiShen(shiShen: string): boolean {
  return shiShen === "정관" || shiShen === "편관";
}

describe("deriveR4RoleActivity", () => {
  it("returns C when rooted-visible 재성 pressure exists", () => {
    const pillars = chart({
      year: { stem: "戊", branch: "辰" },
      month: { stem: "己", branch: "未" },
      day: { stem: "甲", branch: "子" },
      hour: "unknown",
    });
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);

    expect(
      evidence.pressureEvidence.items.some(
        (item) => isWealthShiShen(item.shiShen) && item.presence === "rooted-visible",
      ),
    ).toBe(true);

    expect(deriveR4RoleActivity({ pillars, evidence, observations })).toBe("C");
  });

  it("returns C when rooted-visible 관성 pressure exists", () => {
    const pillars = chart({
      year: { stem: "庚", branch: "申" },
      month: { stem: "辛", branch: "酉" },
      day: { stem: "甲", branch: "子" },
      hour: "unknown",
    });
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);

    expect(
      evidence.pressureEvidence.items.some(
        (item) => isOfficerShiShen(item.shiShen) && item.presence === "rooted-visible",
      ),
    ).toBe(true);

    expect(deriveR4RoleActivity({ pillars, evidence, observations })).toBe("C");
  });

  it("returns C when pressure-branch-anchor confirms wealth/officer surface", () => {
    const pillars = chart({
      year: { stem: "乙", branch: "卯" },
      month: { stem: "乙", branch: "未" },
      day: { stem: "甲", branch: "子" },
      hour: "unknown",
    });
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);

    expect(evidence.pressureEvidence.items.some((item) => isControlShiShen(item.shiShen))).toBe(
      false,
    );
    expect(
      evidence.branchRelationEvidence.items.some(
        (item) => isControlShiShen(item.shiShen) && item.presence === "hidden-only",
      ),
    ).toBe(true);

    const controlElements = new Set(
      evidence.branchRelationEvidence.items
        .filter((item) => isControlShiShen(item.shiShen))
        .map((item) => item.element),
    );
    expect(
      observations.structureObservation.pressureRelations.some(
        (relation) =>
          relation.kind === "pressure-branch-anchor" && controlElements.has(relation.element),
      ),
    ).toBe(true);

    expect(deriveR4RoleActivity({ pillars, evidence, observations })).toBe("C");
  });

  it("returns B when 재/관 is unrooted-visible only", () => {
    const pillars = chart({
      year: { stem: "庚", branch: "子" },
      month: { stem: "甲", branch: "子" },
      day: { stem: "甲", branch: "子" },
      hour: "unknown",
    });
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);
    const controlPressure = evidence.pressureEvidence.items.filter((item) =>
      isControlShiShen(item.shiShen),
    );

    expect(controlPressure.length).toBeGreaterThan(0);
    expect(controlPressure.every((item) => item.presence === "unrooted-visible")).toBe(true);

    expect(deriveR4RoleActivity({ pillars, evidence, observations })).toBe("B");
  });

  it("returns B when 재/관 is hidden-only", () => {
    const pillars = chart({
      year: { stem: "甲", branch: "寅" },
      month: { stem: "甲", branch: "寅" },
      day: { stem: "甲", branch: "子" },
      hour: { stem: "甲", branch: "子" },
    });
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);

    expect(evidence.pressureEvidence.items.some((item) => isControlShiShen(item.shiShen))).toBe(
      false,
    );
    expect(
      evidence.branchRelationEvidence.items.some(
        (item) => isControlShiShen(item.shiShen) && item.presence === "hidden-only",
      ),
    ).toBe(true);
    expect(
      observations.structureObservation.pressureRelations
        .filter((relation) =>
          evidence.branchRelationEvidence.items.some(
            (item) => isControlShiShen(item.shiShen) && item.element === relation.element,
          ),
        )
        .every((relation) => relation.kind === "pressure-hidden-context"),
    ).toBe(true);

    expect(deriveR4RoleActivity({ pillars, evidence, observations })).toBe("B");
  });

  it("returns A when only 식상 pressure exists", () => {
    const pillars = chart({
      year: { stem: "丙", branch: "子" },
      month: { stem: "丁", branch: "亥" },
      day: { stem: "甲", branch: "子" },
      hour: "unknown",
    });
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);

    expect(evidence.pressureEvidence.items.some((item) => isOutputShiShen(item.shiShen))).toBe(true);
    expect(evidence.pressureEvidence.items.some((item) => isControlShiShen(item.shiShen))).toBe(
      false,
    );
    expect(evidence.branchRelationEvidence.items.some((item) => isControlShiShen(item.shiShen))).toBe(
      false,
    );

    expect(deriveR4RoleActivity({ pillars, evidence, observations })).toBe("A");
  });

  it("returns A when there is no wealth/officer control evidence", () => {
    const pillars = chart({
      year: { stem: "甲", branch: "子" },
      month: { stem: "甲", branch: "子" },
      day: { stem: "甲", branch: "子" },
      hour: "unknown",
    });
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);

    expect(evidence.pressureEvidence.items.some((item) => isControlShiShen(item.shiShen))).toBe(
      false,
    );
    expect(evidence.branchRelationEvidence.items.some((item) => isControlShiShen(item.shiShen))).toBe(
      false,
    );
    expect(stemElement(pillars.day.stem)).toBe("木");

    expect(deriveR4RoleActivity({ pillars, evidence, observations })).toBe("A");
  });
});
