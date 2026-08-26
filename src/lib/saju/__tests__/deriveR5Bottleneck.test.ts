import { describe, expect, it } from "vitest";
import { deriveR5Bottleneck } from "@/lib/saju/final/deriveR5Bottleneck";
import { deriveRoleActivities } from "@/lib/saju/final/deriveRoleActivities";
import type { RoleActivityMap } from "@/lib/saju/final/types";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import type { StrengthObservations } from "@/lib/saju/observation/types";
import { stemElement } from "@/lib/saju/constants/elements";
import type { FourPillars, HourPillar, Pillar, StrengthEvidence } from "@/lib/saju/types";

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
    evidenceMut?: (evidence: StrengthEvidence) => StrengthEvidence;
    observationsMut?: (observations: StrengthObservations) => StrengthObservations;
  },
) {
  let evidence = collectStrengthEvidence(pillars);
  if (options?.evidenceMut) evidence = options.evidenceMut(evidence);
  let observations = buildStrengthObservations(pillars, evidence);
  if (options?.observationsMut) observations = options.observationsMut(observations);
  const roleActivities = {
    ...deriveRoleActivities({ pillars, evidence, observations }),
    ...options?.roleOverride,
  };
  return {
    pillars,
    evidence,
    observations,
    roleActivities,
    level: deriveR5Bottleneck({ pillars, evidence, observations, roleActivities }),
  };
}

function stripWaterPressure(evidence: StrengthEvidence): StrengthEvidence {
  return {
    ...evidence,
    pressureEvidence: {
      items: evidence.pressureEvidence.items.filter(
        (item) => stemElement(item.stem) !== "水",
      ),
    },
  };
}

function stripWaterPressureRelations(
  observations: StrengthObservations,
): StrengthObservations {
  return {
    ...observations,
    structureObservation: {
      ...observations.structureObservation,
      pressureRelations: observations.structureObservation.pressureRelations.filter(
        (relation) => relation.element !== "水",
      ),
    },
  };
}

/** Inject weak 水→木 and 木→火 legs without adding a 木 cluster surface (mid stays absent). */
function withCorridorSpecificLegs(
  observations: StrengthObservations,
): StrengthObservations {
  return {
    ...observations,
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
      {
        relation: "element-generates",
        from: {
          slot: "month",
          layer: "hiddenStem",
          stem: "甲",
          element: "木",
          presence: "hidden-only",
          shiShen: "편관",
        },
        to: {
          slot: "hour",
          layer: "stem",
          stem: "丙",
          element: "火",
          presence: "rooted-visible",
          shiShen: "편관",
        },
      },
    ],
  };
}

/** Non-day Q base chart 水 / 火 present, 木 absent. */
function corridorBasePillars(hour: HourPillar = { stem: "丙", branch: "午" }): FourPillars {
  return chart({
    year: { stem: "壬", branch: "子" },
    month: { stem: "癸", branch: "子" },
    day: { stem: "庚", branch: "申" },
    hour,
  });
}

/** Unrelated actives only (no corridor-specific P→M / M→Q legs). */
function unrelatedActivePack(hour: HourPillar = { stem: "丙", branch: "午" }) {
  return pack(corridorBasePillars(hour), {
    evidenceMut: stripWaterPressure,
    observationsMut: stripWaterPressureRelations,
  });
}

/** Corridor-specific front/back legs + mid absent + no alternate → CLEAR path. */
function corridorClearPack(
  hour: HourPillar = { stem: "丙", branch: "午" },
  roleOverride?: Partial<RoleActivityMap>,
) {
  return pack(corridorBasePillars(hour), {
    roleOverride,
    evidenceMut: stripWaterPressure,
    observationsMut: (observations) =>
      withCorridorSpecificLegs(stripWaterPressureRelations(observations)),
  });
}

describe("deriveR5Bottleneck", () => {
  it("1. Q=day + M=resource alias → NOT (LW-gapyu)", () => {
    const input = pack(
      chart({
        year: { stem: "甲", branch: "酉" },
        month: { stem: "庚", branch: "酉" },
        day: { stem: "甲", branch: "酉" },
        hour: "unknown",
      }),
    );
    expect(stemElement(input.pillars.day.stem)).toBe("木");
    expect(input.level).toBe("NOT");
  });

  it("2. pressure-only P → NOT (LS-birth 土 pressure; no CLEAR)", () => {
    const input = pack(
      chart({
        year: { stem: "己", branch: "卯" },
        month: { stem: "丙", branch: "子" },
        day: { stem: "癸", branch: "卯" },
        hour: { stem: "壬", branch: "子" },
      }),
    );
    expect(
      input.evidence.pressureEvidence.items.some((item) => stemElement(item.stem) === "土"),
    ).toBe(true);
    expect(input.level).not.toBe("CLEAR");
  });

  it("3. alternate path to Q → NOT", () => {
    const base = corridorClearPack();
    expect(base.level).toBe("CLEAR");

    const withAlternate = pack(base.pillars, {
      evidenceMut: stripWaterPressure,
      observationsMut: (observations) => {
        const linked = withCorridorSpecificLegs(stripWaterPressureRelations(observations));
        return {
          ...linked,
          generationChains: [
            ...linked.generationChains,
            {
              relation: "element-generates",
              from: {
                slot: "year",
                layer: "stem",
                stem: "戊",
                element: "土",
                presence: "rooted-visible",
                shiShen: "편재",
              },
              to: {
                slot: "hour",
                layer: "stem",
                stem: "丙",
                element: "火",
                presence: "rooted-visible",
                shiShen: "편관",
              },
            },
          ],
        };
      },
    });

    expect(withAlternate.level).toBe("NOT");
  });

  it("4. corridor-specific front/back + mid absent + no alternate → CLEAR", () => {
    const input = corridorClearPack();
    expect(input.roleActivities.R5).not.toBe("C");
    expect(input.observations.elementClusters.some((cluster) => cluster.element === "木")).toBe(
      false,
    );
    expect(input.level).toBe("CLEAR");
  });

  it("5. only one side RELATION → POSSIBLE", () => {
    const input = pack(
      chart({
        year: { stem: "壬", branch: "子" },
        month: { stem: "丙", branch: "午" },
        day: { stem: "庚", branch: "辰" },
        hour: { stem: "丁", branch: "未" },
      }),
    );
    expect(input.level).toBe("POSSIBLE");
  });

  it("6. 2-step discontinuity → NOT or at least not CLEAR", () => {
    const input = pack(
      chart({
        year: { stem: "甲", branch: "寅" },
        month: { stem: "甲", branch: "寅" },
        day: { stem: "庚", branch: "申" },
        hour: "unknown",
      }),
    );
    expect(input.level).not.toBe("CLEAR");
  });

  it("7. R5 Activity=C repeat → NOT", () => {
    const input = pack(
      chart({
        year: { stem: "壬", branch: "子" },
        month: { stem: "甲", branch: "寅" },
        day: { stem: "庚", branch: "申" },
        hour: { stem: "丙", branch: "午" },
      }),
    );
    expect(input.roleActivities.R5).toBe("C");
    expect(input.level).toBe("NOT");
  });

  it("8. hour unknown unique slot dependence → CLEAR forbidden", () => {
    const confirmed = corridorClearPack({ stem: "丙", branch: "午" });
    expect(confirmed.level).toBe("CLEAR");

    const hourUnknown = corridorClearPack("unknown");
    expect(hourUnknown.evidence.hourUnknown).toBe(true);
    expect(hourUnknown.level).not.toBe("CLEAR");
  });

  it("A. both relation-active but unrelated relations → CLEAR forbidden, max POSSIBLE", () => {
    const input = unrelatedActivePack();
    expect(input.roleActivities.R5).not.toBe("C");
    expect(input.level).not.toBe("CLEAR");
    expect(input.level).toBe("POSSIBLE");
  });

  it("B. corridor-specific front/back + M gap + no alternate → CLEAR", () => {
    expect(corridorClearPack().level).toBe("CLEAR");
  });

  it("R1=C does not globally NOT a non-day independent CLEAR corridor", () => {
    const input = corridorClearPack({ stem: "丙", branch: "午" }, { R1: "C" });
    expect(input.roleActivities.R1).toBe("C");
    expect(stemElement(input.pillars.day.stem)).toBe("金");
    expect(input.level).toBe("CLEAR");
  });

  it("R2=C does not globally NOT a non-day independent CLEAR corridor", () => {
    const input = corridorClearPack({ stem: "丙", branch: "午" }, { R2: "C" });
    expect(input.roleActivities.R2).toBe("C");
    expect(stemElement(input.pillars.day.stem)).toBe("金");
    expect(input.level).toBe("CLEAR");
  });

  it("representative: LS-birth is not CLEAR", () => {
    expect(
      pack(
        chart({
          year: { stem: "己", branch: "卯" },
          month: { stem: "丙", branch: "子" },
          day: { stem: "癸", branch: "卯" },
          hour: { stem: "壬", branch: "子" },
        }),
      ).level,
    ).not.toBe("CLEAR");
  });

  it("representative: LW-gapyu → NOT", () => {
    expect(
      pack(
        chart({
          year: { stem: "甲", branch: "酉" },
          month: { stem: "庚", branch: "酉" },
          day: { stem: "甲", branch: "酉" },
          hour: "unknown",
        }),
      ).level,
    ).toBe("NOT");
  });

  it("representative: MX-gimo is not CLEAR", () => {
    const input = pack(
      chart({
        year: { stem: "己", branch: "卯" },
        month: { stem: "丙", branch: "子" },
        day: { stem: "戊", branch: "午" },
        hour: { stem: "戊", branch: "午" },
      }),
    );
    expect(input.level).not.toBe("CLEAR");
  });
});
