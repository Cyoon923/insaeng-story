import { describe, expect, it } from "vitest";
import { deriveR2Bottleneck } from "@/lib/saju/final/deriveR2Bottleneck";
import { deriveRoleActivities } from "@/lib/saju/final/deriveRoleActivities";
import { buildStrengthSummary } from "@/lib/saju/elements/strengthSummary";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import type { FourPillars, HourPillar, Pillar, StrengthSummary } from "@/lib/saju/types";

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

function pack(pillars: FourPillars, summaryOverride?: Partial<StrengthSummary>) {
  const evidence = collectStrengthEvidence(pillars);
  const observations = buildStrengthObservations(pillars, evidence);
  const summary = { ...buildStrengthSummary(pillars), ...summaryOverride };
  const roleActivities = deriveRoleActivities({ pillars, evidence, observations });
  return { pillars, summary, evidence, observations, roleActivities };
}

/** leaning-weak + R1C + resource RV + peer gap + root present + hour confirmed */
const CLEAR_PILLARS = chart({
  year: { stem: "壬", branch: "子" },
  month: { stem: "癸", branch: "酉" },
  day: { stem: "甲", branch: "亥" },
  hour: { stem: "壬", branch: "子" },
});

describe("deriveR2Bottleneck", () => {
  it("1. leaning-weak + R1C + resource RV + peer gap + root present + hour confirmed → CLEAR", () => {
    const input = pack(CLEAR_PILLARS);
    expect(input.summary.directionCandidate).toBe("leaning-weak");
    expect(input.summary.rootQuality).toBe("present");
    expect(input.summary.sourceBreakdown.resource.rootedVisible).toBe(true);
    expect(input.summary.sourceBreakdown.peer).toEqual({
      rootedVisible: false,
      unrootedVisible: false,
    });
    expect(input.roleActivities.R1).toBe("C");
    expect(input.roleActivities.R2 === "A" || input.roleActivities.R2 === "B").toBe(true);
    expect(input.evidence.hourUnknown).toBe(false);

    expect(deriveR2Bottleneck(input)).toBe("CLEAR");
  });

  it("2. same as CLEAR but root absent → POSSIBLE", () => {
    const input = pack(CLEAR_PILLARS, { rootQuality: "absent" });
    expect(input.summary.directionCandidate).toBe("leaning-weak");
    expect(input.summary.rootQuality).toBe("absent");
    expect(deriveR2Bottleneck(input)).toBe("POSSIBLE");
  });

  it("3. mixed + resource RV + peer gap → POSSIBLE (MX-1981)", () => {
    const pillars = chart({
      year: { stem: "辛", branch: "酉" },
      month: { stem: "乙", branch: "未" },
      day: { stem: "丙", branch: "申" },
      hour: { stem: "戊", branch: "戌" },
    });
    const input = pack(pillars);
    expect(input.summary.directionCandidate).toBe("mixed");
    expect(input.summary.sourceBreakdown.resource.rootedVisible).toBe(true);
    expect(input.summary.sourceBreakdown.peer).toEqual({
      rootedVisible: false,
      unrootedVisible: false,
    });
    expect(input.roleActivities.R1).toBe("C");
    expect(deriveR2Bottleneck(input)).toBe("POSSIBLE");
  });

  it("4. null + resource RV + peer gap → POSSIBLE", () => {
    const pillars = chart({
      year: { stem: "壬", branch: "子" },
      month: { stem: "癸", branch: "酉" },
      day: { stem: "甲", branch: "子" },
      hour: { stem: "壬", branch: "子" },
    });
    const input = pack(pillars);
    expect(input.summary.directionCandidate).toBeNull();
    expect(input.summary.sourceBreakdown.resource.rootedVisible).toBe(true);
    expect(input.summary.sourceBreakdown.peer).toEqual({
      rootedVisible: false,
      unrootedVisible: false,
    });
    expect(deriveR2Bottleneck(input)).toBe("POSSIBLE");
  });

  it("5. leaning-strong + peer gap → NOT", () => {
    const pillars = chart({
      year: { stem: "甲", branch: "申" },
      month: { stem: "丁", branch: "丑" },
      day: { stem: "戊", branch: "午" },
      hour: { stem: "丁", branch: "巳" },
    });
    const input = pack(pillars);
    expect(input.summary.directionCandidate).toBe("leaning-strong");
    expect(input.summary.sourceBreakdown.peer).toEqual({
      rootedVisible: false,
      unrootedVisible: false,
    });
    expect(deriveR2Bottleneck(input)).toBe("NOT");
  });

  it("6. R1≠C → NOT", () => {
    const pillars = chart({
      year: { stem: "己", branch: "丑" },
      month: { stem: "戊", branch: "午" },
      day: { stem: "甲", branch: "寅" },
      hour: "unknown",
    });
    const input = pack(pillars);
    expect(input.roleActivities.R1).not.toBe("C");
    expect(deriveR2Bottleneck(input)).toBe("NOT");
  });

  it("7. R2=C → NOT", () => {
    const pillars = chart({
      year: { stem: "甲", branch: "寅" },
      month: { stem: "己", branch: "未" },
      day: { stem: "甲", branch: "子" },
      hour: { stem: "己", branch: "巳" },
    });
    const input = pack(pillars);
    expect(input.roleActivities.R2).toBe("C");
    expect(deriveR2Bottleneck(input)).toBe("NOT");
  });

  it("8. hour unknown → CLEAR forbidden, max POSSIBLE", () => {
    const pillars = chart({
      year: { stem: "壬", branch: "子" },
      month: { stem: "癸", branch: "酉" },
      day: { stem: "甲", branch: "亥" },
      hour: "unknown",
    });
    const input = pack(pillars);
    expect(input.summary.directionCandidate).toBe("leaning-weak");
    expect(input.evidence.hourUnknown).toBe(true);
    expect(input.summary.omittedSlots).toContain("hour");
    expect(deriveR2Bottleneck(input)).toBe("POSSIBLE");
    expect(deriveR2Bottleneck(input)).not.toBe("CLEAR");
  });
});
