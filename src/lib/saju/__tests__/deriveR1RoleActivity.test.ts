import { describe, expect, it } from "vitest";
import { deriveR1RoleActivity } from "@/lib/saju/final/deriveR1RoleActivity";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
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

describe("deriveR1RoleActivity", () => {
  it("returns C when rooted-visible resource-to-day-master exists", () => {
    const pillars = chart({
      year: { stem: "辛", branch: "酉" },
      month: { stem: "乙", branch: "未" },
      day: { stem: "丙", branch: "申" },
      hour: { stem: "丁", branch: "酉" },
    });
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);

    expect(
      observations.generationChains.some(
        (chain) =>
          chain.relation === "resource-to-day-master" &&
          chain.from.presence === "rooted-visible",
      ),
    ).toBe(true);

    expect(deriveR1RoleActivity({ pillars, evidence, observations })).toBe("C");
  });

  it("returns B when resource-to-day-master is hidden-only only", () => {
    const pillars = chart({
      year: { stem: "丙", branch: "午" },
      month: { stem: "戊", branch: "戌" },
      day: { stem: "甲", branch: "申" },
      hour: "unknown",
    });
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);
    const resourceToDay = observations.generationChains.filter(
      (chain) => chain.relation === "resource-to-day-master",
    );

    expect(resourceToDay.length).toBeGreaterThan(0);
    expect(resourceToDay.every((chain) => chain.from.presence === "hidden-only")).toBe(true);
    expect(evidence.supportEvidence.items.some((item) => item.shiShen === "정인" || item.shiShen === "편인")).toBe(
      false,
    );

    expect(deriveR1RoleActivity({ pillars, evidence, observations })).toBe("B");
  });

  it("returns A when there is no resource role evidence toward day", () => {
    const pillars = chart({
      year: { stem: "己", branch: "未" },
      month: { stem: "己", branch: "未" },
      day: { stem: "甲", branch: "寅" },
      hour: { stem: "己", branch: "巳" },
    });
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);

    expect(observations.generationChains.some((chain) => chain.relation === "resource-to-day-master")).toBe(
      false,
    );
    expect(evidence.supportEvidence.items.some((item) => item.shiShen === "정인" || item.shiShen === "편인")).toBe(
      false,
    );

    expect(deriveR1RoleActivity({ pillars, evidence, observations })).toBe("A");
  });

  it("does not return C for unrelated element-generates chains alone", () => {
    const pillars = chart({
      year: { stem: "己", branch: "未" },
      month: { stem: "己", branch: "未" },
      day: { stem: "甲", branch: "寅" },
      hour: { stem: "己", branch: "巳" },
    });
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);

    expect(observations.generationChains.some((chain) => chain.relation === "element-generates")).toBe(
      true,
    );
    expect(observations.generationChains.some((chain) => chain.relation === "resource-to-day-master")).toBe(
      false,
    );

    expect(deriveR1RoleActivity({ pillars, evidence, observations })).not.toBe("C");
    expect(deriveR1RoleActivity({ pillars, evidence, observations })).toBe("A");
  });
});
