import { describe, expect, it } from "vitest";
import { deriveRoleActivities } from "@/lib/saju/final/deriveRoleActivities";
import { deriveR1RoleActivity } from "@/lib/saju/final/deriveR1RoleActivity";
import { deriveR2RoleActivity } from "@/lib/saju/final/deriveR2RoleActivity";
import { deriveR3RoleActivity } from "@/lib/saju/final/deriveR3RoleActivity";
import { deriveR4RoleActivity } from "@/lib/saju/final/deriveR4RoleActivity";
import { deriveR5RoleActivity } from "@/lib/saju/final/deriveR5RoleActivity";
import { deriveR6RoleActivity } from "@/lib/saju/final/deriveR6RoleActivity";
import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
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

function individualMap(pillars: FourPillars) {
  const evidence = collectStrengthEvidence(pillars);
  const observations = buildStrengthObservations(pillars, evidence);
  const climate = buildAdjustedClimateSummary(pillars);
  const shared = { pillars, evidence, observations };
  return {
    R1: deriveR1RoleActivity(shared),
    R2: deriveR2RoleActivity(shared),
    R3: deriveR3RoleActivity(shared),
    R4: deriveR4RoleActivity(shared),
    R5: deriveR5RoleActivity(shared),
    R6: deriveR6RoleActivity({ pillars, climate }),
  };
}

describe("deriveRoleActivities", () => {
  it("matches individual R1–R6 helpers on a confirmed-hour chart (MX-style)", () => {
    const pillars = chart({
      year: { stem: "辛", branch: "酉" },
      month: { stem: "乙", branch: "未" },
      day: { stem: "丙", branch: "申" },
      hour: { stem: "丁", branch: "酉" },
    });

    const expected = individualMap(pillars);
    const actual = deriveRoleActivities({ pillars });

    expect(actual).toEqual(expected);
  });

  it("matches individual helpers on a second representative chart (non-day R5 corridor)", () => {
    const pillars = chart({
      year: { stem: "壬", branch: "子" },
      month: { stem: "甲", branch: "寅" },
      day: { stem: "庚", branch: "申" },
      hour: { stem: "丙", branch: "午" },
    });

    expect(deriveRoleActivities({ pillars })).toEqual(individualMap(pillars));
  });

  it("matches individual helpers when hour is unknown", () => {
    const pillars = chart({
      year: { stem: "壬", branch: "寅" },
      month: { stem: "己", branch: "亥" },
      day: { stem: "丙", branch: "子" },
      hour: "unknown",
    });

    expect(pillars.hour).toBe("unknown");
    expect(deriveRoleActivities({ pillars })).toEqual(individualMap(pillars));
  });

  it("reuses provided evidence, observations, and climate without changing results", () => {
    const pillars = chart({
      year: { stem: "己", branch: "卯" },
      month: { stem: "丙", branch: "子" },
      day: { stem: "戊", branch: "午" },
      hour: { stem: "戊", branch: "午" },
    });
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);
    const climate = buildAdjustedClimateSummary(pillars);

    expect(
      deriveRoleActivities({ pillars, evidence, observations, climate }),
    ).toEqual(individualMap(pillars));
  });
});
