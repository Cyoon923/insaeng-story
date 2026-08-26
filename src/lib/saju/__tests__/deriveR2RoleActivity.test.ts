import { describe, expect, it } from "vitest";
import { deriveR2RoleActivity } from "@/lib/saju/final/deriveR2RoleActivity";
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

function isPeerShiShen(shiShen: string): boolean {
  return shiShen === "비견" || shiShen === "겁재";
}

describe("deriveR2RoleActivity", () => {
  it("returns C when day-외 rooted-visible peer stem exists", () => {
    const pillars = chart({
      year: { stem: "甲", branch: "寅" },
      month: { stem: "己", branch: "未" },
      day: { stem: "甲", branch: "子" },
      hour: { stem: "己", branch: "巳" },
    });
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);

    expect(
      evidence.supportEvidence.items.some(
        (item) => isPeerShiShen(item.shiShen) && item.presence === "rooted-visible",
      ),
    ).toBe(true);
    expect(
      observations.structureObservation.supportRelations.some(
        (relation) => relation.kind === "peer-support",
      ),
    ).toBe(true);

    expect(deriveR2RoleActivity({ pillars, evidence, observations })).toBe("C");
  });

  it("returns B when day-외 peer is unrooted-visible only", () => {
    const pillars = chart({
      year: { stem: "甲", branch: "酉" },
      month: { stem: "庚", branch: "申" },
      day: { stem: "甲", branch: "子" },
      hour: "unknown",
    });
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);
    const peerSupport = evidence.supportEvidence.items.filter((item) => isPeerShiShen(item.shiShen));

    expect(peerSupport.length).toBeGreaterThan(0);
    expect(peerSupport.every((item) => item.presence === "unrooted-visible")).toBe(true);

    expect(deriveR2RoleActivity({ pillars, evidence, observations })).toBe("B");
  });

  it("returns B when peer is hidden-only outside day", () => {
    const pillars = chart({
      year: { stem: "辛", branch: "酉" },
      month: { stem: "乙", branch: "未" },
      day: { stem: "丙", branch: "申" },
      hour: { stem: "戊", branch: "戌" },
    });
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);

    expect(evidence.supportEvidence.items.some((item) => isPeerShiShen(item.shiShen))).toBe(false);
    expect(
      evidence.branchRelationEvidence.items.some(
        (item) =>
          item.slot !== "day" &&
          isPeerShiShen(item.shiShen) &&
          item.exactStemVisible === false,
      ),
    ).toBe(true);

    expect(deriveR2RoleActivity({ pillars, evidence, observations })).toBe("B");
  });

  it("returns A when only day has the same element and no day-외 peer", () => {
    const pillars = chart({
      year: { stem: "己", branch: "丑" },
      month: { stem: "戊", branch: "午" },
      day: { stem: "甲", branch: "寅" },
      hour: "unknown",
    });
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);

    expect(evidence.supportEvidence.items.some((item) => isPeerShiShen(item.shiShen))).toBe(false);
    expect(
      evidence.branchRelationEvidence.items.some(
        (item) => item.slot !== "day" && isPeerShiShen(item.shiShen),
      ),
    ).toBe(false);
    expect(observations.elementClusters.some((cluster) => cluster.element === "木")).toBe(true);

    expect(deriveR2RoleActivity({ pillars, evidence, observations })).toBe("A");
  });

  it("returns A when hour is unknown and year/month have no peer", () => {
    const pillars = chart({
      year: { stem: "己", branch: "丑" },
      month: { stem: "戊", branch: "午" },
      day: { stem: "甲", branch: "戌" },
      hour: "unknown",
    });
    const evidence = collectStrengthEvidence(pillars);

    expect(evidence.hourUnknown).toBe(true);
    expect(evidence.supportEvidence.items.some((item) => isPeerShiShen(item.shiShen))).toBe(false);
    expect(
      evidence.branchRelationEvidence.items.some(
        (item) => item.slot !== "day" && isPeerShiShen(item.shiShen),
      ),
    ).toBe(false);

    expect(deriveR2RoleActivity({ pillars, evidence })).toBe("A");
  });
});
