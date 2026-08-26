import { describe, expect, it } from "vitest";
import { deriveRoleElementCandidates } from "@/lib/saju/final/deriveRoleElementCandidates";
import { deriveRoleActivities } from "@/lib/saju/final/deriveRoleActivities";
import { deriveR2Bottleneck } from "@/lib/saju/final/deriveR2Bottleneck";
import { deriveR5Bottleneck } from "@/lib/saju/final/deriveR5Bottleneck";
import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { buildStrengthSummary } from "@/lib/saju/elements/strengthSummary";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import { stemElement } from "@/lib/saju/constants/elements";
import type { BottleneckLevel, RoleActivityMap } from "@/lib/saju/final/types";
import type {
  AdjustedClimateSummary,
  FourPillars,
  HourPillar,
  Pillar,
  StrengthEvidence,
  StrengthObservations,
} from "@/lib/saju/types";

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

function pack(
  pillars: FourPillars,
  options?: {
    roleOverride?: Partial<RoleActivityMap>;
    r2Bottleneck?: BottleneckLevel;
    r5Bottleneck?: BottleneckLevel;
    climateOverride?: Partial<AdjustedClimateSummary>;
  },
) {
  const evidence: StrengthEvidence = collectStrengthEvidence(pillars);
  const observations: StrengthObservations = buildStrengthObservations(pillars, evidence);
  const summary = buildStrengthSummary(pillars);
  const climate = {
    ...buildAdjustedClimateSummary(pillars),
    ...options?.climateOverride,
  };
  const roleActivities = {
    ...deriveRoleActivities({ pillars, evidence, observations, climate }),
    ...options?.roleOverride,
  };
  const r2Bottleneck =
    options?.r2Bottleneck ??
    deriveR2Bottleneck({ pillars, summary, evidence, observations, roleActivities });
  const r5Bottleneck =
    options?.r5Bottleneck ??
    deriveR5Bottleneck({ pillars, evidence, observations, roleActivities });
  const candidates = deriveRoleElementCandidates({
    pillars,
    roleActivities,
    r2Bottleneck,
    r5Bottleneck,
    evidence,
    observations,
    climate,
  });
  return { pillars, evidence, observations, climate, roleActivities, r2Bottleneck, r5Bottleneck, candidates };
}

describe("deriveRoleElementCandidates", () => {
  it("1. R1 candidate is the resource element that generates the day master", () => {
    const input = pack(
      chart({
        year: { stem: "己", branch: "丑" },
        month: { stem: "戊", branch: "午" },
        day: { stem: "甲", branch: "寅" },
        hour: "unknown",
      }),
      { roleOverride: { R1: "A" } },
    );
    expect(stemElement(input.pillars.day.stem)).toBe("木");
    expect(input.candidates.R1).toEqual(["水"]);
  });

  it("2. R2 candidate is always dayElement when bottleneck allows", () => {
    const input = pack(
      chart({
        year: { stem: "辛", branch: "酉" },
        month: { stem: "乙", branch: "未" },
        day: { stem: "丙", branch: "申" },
        hour: { stem: "戊", branch: "戌" },
      }),
    );
    expect(stemElement(input.pillars.day.stem)).toBe("火");
    expect(input.r2Bottleneck === "POSSIBLE" || input.r2Bottleneck === "CLEAR").toBe(true);
    expect(input.roleActivities.R2).not.toBe("C");
    expect(input.candidates.R2).toEqual(["火"]);
  });

  it("3. R3 candidate is the output element the day master generates", () => {
    const input = pack(
      chart({
        year: { stem: "甲", branch: "子" },
        month: { stem: "甲", branch: "子" },
        day: { stem: "甲", branch: "子" },
        hour: "unknown",
      }),
      { roleOverride: { R3: "A" } },
    );
    expect(stemElement(input.pillars.day.stem)).toBe("木");
    expect(input.candidates.R3).toEqual(["火"]);
  });

  it("4. R4 candidates match wealth/officer maps for the day master", () => {
    const input = pack(
      chart({
        year: { stem: "甲", branch: "子" },
        month: { stem: "甲", branch: "子" },
        day: { stem: "甲", branch: "子" },
        hour: "unknown",
      }),
      { roleOverride: { R4: "A" } },
    );
    expect(stemElement(input.pillars.day.stem)).toBe("木");
    expect(input.candidates.R4).toEqual(["土", "金"]);
  });

  it("5. R5 returns the same CLEAR corridor mid as the bottleneck", () => {
    // Synthetic: one-sided 水→木 leg, 木 mid absent, 火 Q relation-active → CLEAR + mid 木
    let evidence = collectStrengthEvidence(
      chart({
        year: { stem: "壬", branch: "子" },
        month: { stem: "癸", branch: "子" },
        day: { stem: "庚", branch: "申" },
        hour: { stem: "丙", branch: "午" },
      }),
    );
    evidence = {
      ...evidence,
      pressureEvidence: {
        items: evidence.pressureEvidence.items.filter(
          (item) => stemElement(item.stem) !== "水",
        ),
      },
    };
    let observations = buildStrengthObservations(
      chart({
        year: { stem: "壬", branch: "子" },
        month: { stem: "癸", branch: "子" },
        day: { stem: "庚", branch: "申" },
        hour: { stem: "丙", branch: "午" },
      }),
      evidence,
    );
    observations = {
      ...observations,
      structureObservation: {
        ...observations.structureObservation,
        pressureRelations: observations.structureObservation.pressureRelations.filter(
          (relation) => relation.element !== "水",
        ),
      },
      generationChains: [
        ...observations.generationChains,
        {
          relation: "element-generates",
          from: {
            slot: "year",
            layer: "stem",
            stem: "壬",
            element: "水",
            presence: "unrooted-visible",
            shiShen: "식신",
          },
          to: {
            slot: "month",
            layer: "hiddenStem",
            stem: "甲",
            element: "木",
            presence: "hidden-only",
            shiShen: "편관",
          },
        },
      ],
    };
    const pillars = chart({
      year: { stem: "壬", branch: "子" },
      month: { stem: "癸", branch: "子" },
      day: { stem: "庚", branch: "申" },
      hour: { stem: "丙", branch: "午" },
    });
    const summary = buildStrengthSummary(pillars);
    const climate = buildAdjustedClimateSummary(pillars);
    const roleActivities = deriveRoleActivities({ pillars, evidence, observations, climate });
    const r2Bottleneck = deriveR2Bottleneck({
      pillars,
      summary,
      evidence,
      observations,
      roleActivities,
    });
    const r5Bottleneck = deriveR5Bottleneck({ evidence, observations, roleActivities });
    const candidates = deriveRoleElementCandidates({
      pillars,
      roleActivities,
      r2Bottleneck,
      r5Bottleneck,
      evidence,
      observations,
      climate,
    });
    expect(r5Bottleneck).toBe("CLEAR");
    expect(candidates.R5).toEqual(["木"]);
  });

  it("6. R5 NOT → empty candidates", () => {
    const input = pack(
      chart({
        year: { stem: "壬", branch: "子" },
        month: { stem: "甲", branch: "寅" },
        day: { stem: "庚", branch: "申" },
        hour: { stem: "丙", branch: "午" },
      }),
    );
    expect(input.r5Bottleneck).toBe("NOT");
    expect(input.candidates.R5).toEqual([]);
  });

  it("7. R6 contested/dry gap stays candidate-only (not a forced winner)", () => {
    const input = pack(
      chart({
        year: { stem: "辛", branch: "酉" },
        month: { stem: "乙", branch: "未" },
        day: { stem: "丙", branch: "申" },
        hour: { stem: "戊", branch: "戌" },
      }),
    );
    // Warm/dry resolved gaps → 水 may appear; helper never picks a single winner.
    expect(input.climate.moisture.value).toBe("dry");
    expect(input.candidates.R6).toContain("水");
    expect(Array.isArray(input.candidates.R6)).toBe(true);
  });

  it("8. Role Activity C repeats are excluded", () => {
    const pillars = chart({
      year: { stem: "辛", branch: "酉" },
      month: { stem: "乙", branch: "未" },
      day: { stem: "丙", branch: "申" },
      hour: { stem: "戊", branch: "戌" },
    });
    const input = pack(pillars, {
      roleOverride: { R1: "C", R3: "C", R4: "C", R5: "C", R6: "C" },
      r2Bottleneck: "POSSIBLE",
      r5Bottleneck: "CLEAR",
    });
    expect(input.candidates.R1).toEqual([]);
    expect(input.candidates.R3).toEqual([]);
    expect(input.candidates.R4).toEqual([]);
    expect(input.candidates.R5).toEqual([]);
    expect(input.candidates.R6).toEqual([]);
  });

  it("R2 bottleneck NOT disables R2 candidates", () => {
    const input = pack(
      chart({
        year: { stem: "甲", branch: "申" },
        month: { stem: "丁", branch: "丑" },
        day: { stem: "戊", branch: "午" },
        hour: { stem: "丁", branch: "巳" },
      }),
      { roleOverride: { R2: "A" }, r2Bottleneck: "NOT" },
    );
    expect(input.candidates.R2).toEqual([]);
  });

  it("representative: MX-1981 exposes R2 candidate 火", () => {
    const input = pack(
      chart({
        year: { stem: "辛", branch: "酉" },
        month: { stem: "乙", branch: "未" },
        day: { stem: "丙", branch: "申" },
        hour: { stem: "戊", branch: "戌" },
      }),
    );
    expect(input.candidates.R2).toEqual(["火"]);
    expect(input.r5Bottleneck).toBe("NOT");
    expect(input.candidates.R5).toEqual([]);
  });

  it("representative: LS-birth → R5 NOT / empty candidates", () => {
    const input = pack(
      chart({
        year: { stem: "己", branch: "卯" },
        month: { stem: "丙", branch: "子" },
        day: { stem: "癸", branch: "卯" },
        hour: { stem: "壬", branch: "子" },
      }),
    );
    expect(input.r5Bottleneck).toBe("NOT");
    expect(input.candidates.R5).toEqual([]);
  });

  it("representative: LW-gapyu → R5 NOT / empty candidates", () => {
    const input = pack(
      chart({
        year: { stem: "甲", branch: "酉" },
        month: { stem: "庚", branch: "酉" },
        day: { stem: "甲", branch: "酉" },
        hour: "unknown",
      }),
    );
    expect(input.r5Bottleneck).toBe("NOT");
    expect(input.candidates.R5).toEqual([]);
  });
});
