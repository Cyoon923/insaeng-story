import { describe, expect, it } from "vitest";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { buildCoreScopedCorridors } from "@/lib/saju/final/buildCoreScopedCorridors";
import { resolveFinalElement } from "@/lib/saju/final/resolveFinalElement";
import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { buildNeedResolution } from "@/lib/saju/elements/needResolution";
import { buildStrengthSummary } from "@/lib/saju/elements/strengthSummary";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import type {
  GenerationChain,
  StrengthObservationNodeRef,
  StrengthObservations,
} from "@/lib/saju/observation/types";
import type { Element, ElementPresenceKind, FourPillars, ShiShen } from "@/lib/saju/types";

const EMPTY_STRUCTURE: StrengthObservations["structureObservation"] = {
  supportRelations: [],
  pressureRelations: [],
  coexistenceNotes: [],
};

function node(partial: {
  slot: StrengthObservationNodeRef["slot"];
  layer: StrengthObservationNodeRef["layer"];
  stem: StrengthObservationNodeRef["stem"];
  element: Element;
  presence: ElementPresenceKind;
}): StrengthObservationNodeRef {
  return {
    ...partial,
    shiShen: "비견" as ShiShen,
  };
}

function generates(
  from: StrengthObservationNodeRef,
  to: StrengthObservationNodeRef,
): GenerationChain {
  return { relation: "element-generates", from, to };
}

function observationsWith(chains: GenerationChain[]): StrengthObservations {
  return {
    dayStem: "丙",
    generationChains: chains,
    elementClusters: [],
    structureObservation: EMPTY_STRUCTURE,
  };
}

describe("buildCoreScopedCorridors — regression 辛酉/乙未/丙申/戊戌", () => {
  const pillars: FourPillars = {
    year: { stem: "辛", branch: "酉" },
    month: { stem: "乙", branch: "未" },
    day: { stem: "丙", branch: "申" },
    hour: { stem: "戊", branch: "戌" },
    hourCertainty: "confirmed",
    warnings: [],
  };

  it("Core=火 → incoming 水→木→火 and outgoing 火→土→金 only", () => {
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);
    const fer = resolveFinalElement({
      pillars,
      summary: buildStrengthSummary(pillars),
      evidence,
      observations,
      climate: buildAdjustedClimateSummary(pillars),
      needResolution: buildNeedResolution(pillars),
    });
    expect(fer.finalElement).toBe("火");

    const corridors = buildCoreScopedCorridors({
      core: fer.finalElement!,
      observations,
    });

    expect(corridors).toEqual([
      {
        kind: "incoming-mid",
        mid: "木",
        from: "水",
        to: "火",
        firstLeg: "surface",
        secondLeg: "surface",
      },
      {
        kind: "outgoing-mid",
        mid: "土",
        from: "火",
        to: "金",
        firstLeg: "surface",
        secondLeg: "surface",
      },
    ]);

    // F2 (木→火 alone) is not returned as its own corridor row — only 2-leg F6.
    expect(corridors.every((row) => row.kind === "incoming-mid" || row.kind === "outgoing-mid")).toBe(
      true,
    );
    expect(corridors.some((row) => row.from === "土" && row.to === "水")).toBe(false);
    expect(corridors.some((row) => row.from === "金" && row.to === "木")).toBe(false);
  });
});

describe("buildCoreScopedCorridors — synthetic", () => {
  const water = node({
    slot: "day",
    layer: "hiddenStem",
    stem: "壬",
    element: "水",
    presence: "hidden-only",
  });
  const woodHidden = node({
    slot: "month",
    layer: "hiddenStem",
    stem: "乙",
    element: "木",
    presence: "hidden-only",
  });
  const woodStem = node({
    slot: "month",
    layer: "stem",
    stem: "乙",
    element: "木",
    presence: "rooted-visible",
  });
  const fireHidden = node({
    slot: "hour",
    layer: "hiddenStem",
    stem: "丁",
    element: "火",
    presence: "hidden-only",
  });
  const fireStem = node({
    slot: "day",
    layer: "stem",
    stem: "丙",
    element: "火",
    presence: "rooted-visible",
  });
  const earthHidden = node({
    slot: "hour",
    layer: "hiddenStem",
    stem: "己",
    element: "土",
    presence: "hidden-only",
  });
  const earthStem = node({
    slot: "hour",
    layer: "stem",
    stem: "戊",
    element: "土",
    presence: "rooted-visible",
  });
  const metalHidden = node({
    slot: "year",
    layer: "hiddenStem",
    stem: "辛",
    element: "金",
    presence: "hidden-only",
  });

  it("1. incoming both legs → return", () => {
    const corridors = buildCoreScopedCorridors({
      core: "火",
      observations: observationsWith([
        generates(water, woodStem),
        generates(woodStem, fireHidden),
      ]),
    });
    expect(corridors).toContainEqual({
      kind: "incoming-mid",
      mid: "木",
      from: "水",
      to: "火",
      firstLeg: "surface",
      secondLeg: "surface",
    });
  });

  it("2. incoming one leg only → omit", () => {
    const corridors = buildCoreScopedCorridors({
      core: "火",
      observations: observationsWith([generates(woodStem, fireHidden)]),
    });
    expect(corridors.find((row) => row.kind === "incoming-mid")).toBeUndefined();
  });

  it("3. outgoing both legs → return", () => {
    const corridors = buildCoreScopedCorridors({
      core: "火",
      observations: observationsWith([
        generates(fireStem, earthStem),
        generates(earthStem, metalHidden),
      ]),
    });
    expect(corridors).toContainEqual({
      kind: "outgoing-mid",
      mid: "土",
      from: "火",
      to: "金",
      firstLeg: "surface",
      secondLeg: "surface",
    });
  });

  it("4. outgoing one leg only → omit", () => {
    const corridors = buildCoreScopedCorridors({
      core: "火",
      observations: observationsWith([generates(fireStem, earthStem)]),
    });
    expect(corridors.find((row) => row.kind === "outgoing-mid")).toBeUndefined();
  });

  it("5. hidden+hidden → corridor with hidden-context bands", () => {
    const corridors = buildCoreScopedCorridors({
      core: "火",
      observations: observationsWith([
        generates(water, woodHidden),
        generates(woodHidden, fireHidden),
      ]),
    });
    expect(corridors).toEqual([
      {
        kind: "incoming-mid",
        mid: "木",
        from: "水",
        to: "火",
        firstLeg: "hidden-context",
        secondLeg: "hidden-context",
      },
    ]);
  });

  it("6. surface+hidden → preserve each band", () => {
    const corridors = buildCoreScopedCorridors({
      core: "火",
      observations: observationsWith([
        generates(water, woodStem),
        generates(woodHidden, fireHidden),
      ]),
    });
    expect(corridors).toEqual([
      {
        kind: "incoming-mid",
        mid: "木",
        from: "水",
        to: "火",
        firstLeg: "surface",
        secondLeg: "hidden-context",
      },
    ]);
  });

  it("7. Core-unrelated 2-leg (土→金→水) → not returned", () => {
    const corridors = buildCoreScopedCorridors({
      core: "火",
      observations: observationsWith([
        generates(earthStem, metalHidden),
        generates(
          metalHidden,
          node({
            slot: "day",
            layer: "hiddenStem",
            stem: "壬",
            element: "水",
            presence: "hidden-only",
          }),
        ),
      ]),
    });
    expect(corridors).toEqual([]);
  });

  it("ignores resource-to-day-master as a corridor leg", () => {
    const corridors = buildCoreScopedCorridors({
      core: "火",
      observations: observationsWith([
        {
          relation: "resource-to-day-master",
          from: woodStem,
          to: {
            target: "day-master",
            slot: "day",
            layer: "stem",
            stem: "丙",
            element: "火",
            presence: "rooted-visible",
          },
        },
        generates(woodStem, fireHidden),
      ]),
    });
    expect(corridors.find((row) => row.kind === "incoming-mid")).toBeUndefined();
  });
});
