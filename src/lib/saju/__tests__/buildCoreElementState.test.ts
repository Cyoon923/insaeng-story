import { describe, expect, it } from "vitest";
import {
  buildCoreElementState,
  coreChildElement,
  coreControllerElement,
  coreParentElement,
} from "@/lib/saju/final/buildCoreElementState";
import { resolveFinalElement } from "@/lib/saju/final/resolveFinalElement";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { buildStrengthSummary } from "@/lib/saju/elements/strengthSummary";
import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { buildNeedResolution } from "@/lib/saju/elements/needResolution";
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
    slot: partial.slot,
    layer: partial.layer,
    stem: partial.stem,
    element: partial.element,
    presence: partial.presence,
    shiShen: "비견" as ShiShen,
  };
}

function generatesChain(
  from: StrengthObservationNodeRef,
  to: StrengthObservationNodeRef,
): GenerationChain {
  return {
    relation: "element-generates",
    from,
    to,
  };
}

function observationsWithChains(chains: GenerationChain[]): StrengthObservations {
  return {
    dayStem: "甲",
    generationChains: chains,
    elementClusters: [],
    structureObservation: EMPTY_STRUCTURE,
  };
}

/** Minimal pillars: vary stems/branches only for presence of chosen elements. */
function pillarsOf(partial: Partial<FourPillars> & Pick<FourPillars, "day">): FourPillars {
  return {
    year: partial.year ?? { stem: "甲", branch: "子" },
    month: partial.month ?? { stem: "甲", branch: "子" },
    day: partial.day,
    hour: partial.hour ?? { stem: "甲", branch: "子" },
    hourCertainty: partial.hourCertainty ?? "confirmed",
    warnings: partial.warnings ?? [],
  };
}

describe("core relation helpers", () => {
  it("maps parent / child / controller via ELEMENT_GENERATES", () => {
    expect(coreParentElement("火")).toBe("木");
    expect(coreChildElement("火")).toBe("土");
    expect(coreControllerElement("火")).toBe("水");
    expect(coreParentElement("木")).toBe("水");
    expect(coreControllerElement("木")).toBe("金");
  });
});

describe("buildCoreElementState — regression 辛酉/乙未/丙申/戊戌", () => {
  const pillars: FourPillars = {
    year: { stem: "辛", branch: "酉" },
    month: { stem: "乙", branch: "未" },
    day: { stem: "丙", branch: "申" },
    hour: { stem: "戊", branch: "戌" },
    hourCertainty: "confirmed",
    warnings: [],
  };

  it("FER Core=火 then state matches presence/links/control bands", () => {
    const evidence = collectStrengthEvidence(pillars);
    const summary = buildStrengthSummary(pillars);
    const climate = buildAdjustedClimateSummary(pillars);
    const needResolution = buildNeedResolution(pillars);
    const observations = buildStrengthObservations(pillars, evidence);
    const fer = resolveFinalElement({
      pillars,
      summary,
      evidence,
      observations,
      climate,
      needResolution,
    });

    expect(fer.finalElement).toBe("火");

    const state = buildCoreElementState({
      pillars,
      core: fer.finalElement!,
      observations,
    });

    expect(state).toEqual({
      core: "火",
      presence: "rooted-visible",
      parent: "木",
      child: "土",
      controller: "水",
      incomingGeneration: "surface",
      controlPresence: "controller-hidden",
      outgoingDrainage: "surface",
    });
  });
});

describe("buildCoreElementState — synthetic bands", () => {
  it("1. Core absent", () => {
    // 寅/卯/午/子 — no 金 in stems or hidden stems (avoid 巳申酉戌丑)
    const pillars = pillarsOf({
      year: { stem: "丙", branch: "午" },
      month: { stem: "甲", branch: "寅" },
      day: { stem: "丁", branch: "卯" },
      hour: { stem: "丙", branch: "子" },
      hourCertainty: "confirmed",
      warnings: [],
    });
    const state = buildCoreElementState({
      pillars,
      core: "金",
      observations: observationsWithChains([]),
    });
    expect(state.presence).toBe("absent");
    expect(state.incomingGeneration).toBe("none");
    expect(state.outgoingDrainage).toBe("none");
  });

  it("2. parent→Core chain 없음 → incoming none", () => {
    const pillars = pillarsOf({ day: { stem: "丙", branch: "午" } });
    const state = buildCoreElementState({
      pillars,
      core: "火",
      observations: observationsWithChains([]),
    });
    expect(state.incomingGeneration).toBe("none");
  });

  it("3. hidden-only generation → hidden-context", () => {
    const pillars = pillarsOf({ day: { stem: "丙", branch: "午" } });
    const from = node({
      slot: "day",
      layer: "hiddenStem",
      stem: "乙",
      element: "木",
      presence: "hidden-only",
    });
    const to = node({
      slot: "hour",
      layer: "hiddenStem",
      stem: "丁",
      element: "火",
      presence: "hidden-only",
    });
    const state = buildCoreElementState({
      pillars,
      core: "火",
      observations: observationsWithChains([generatesChain(from, to)]),
    });
    expect(state.incomingGeneration).toBe("hidden-context");
  });

  it("4. visible generation → surface", () => {
    const pillars = pillarsOf({ day: { stem: "丙", branch: "午" } });
    const from = node({
      slot: "month",
      layer: "stem",
      stem: "乙",
      element: "木",
      presence: "rooted-visible",
    });
    const to = node({
      slot: "hour",
      layer: "hiddenStem",
      stem: "丁",
      element: "火",
      presence: "hidden-only",
    });
    const state = buildCoreElementState({
      pillars,
      core: "火",
      observations: observationsWithChains([generatesChain(from, to)]),
    });
    expect(state.incomingGeneration).toBe("surface");
  });

  it("5a. controller absent", () => {
    const pillars = pillarsOf({
      year: { stem: "丙", branch: "午" },
      month: { stem: "丁", branch: "巳" },
      day: { stem: "丙", branch: "午" },
      hour: { stem: "丁", branch: "巳" },
      hourCertainty: "confirmed",
      warnings: [],
    });
    // controller of 火 is 水 — absent on fire-heavy chart
    const state = buildCoreElementState({
      pillars,
      core: "火",
      observations: observationsWithChains([]),
    });
    expect(state.controller).toBe("水");
    expect(state.controlPresence).toBe("controller-absent");
  });

  it("5b. controller hidden", () => {
    // 丙申: 申 hidden has 壬水 → 水 hidden-only if no visible 水 stem
    const pillars: FourPillars = {
      year: { stem: "丙", branch: "午" },
      month: { stem: "丁", branch: "巳" },
      day: { stem: "丙", branch: "申" },
      hour: { stem: "丁", branch: "巳" },
      hourCertainty: "confirmed",
      warnings: [],
    };
    const state = buildCoreElementState({
      pillars,
      core: "火",
      observations: observationsWithChains([]),
    });
    expect(state.controlPresence).toBe("controller-hidden");
  });

  it("5c. controller visible", () => {
    const pillars: FourPillars = {
      year: { stem: "壬", branch: "子" },
      month: { stem: "丁", branch: "巳" },
      day: { stem: "丙", branch: "午" },
      hour: { stem: "丁", branch: "巳" },
      hourCertainty: "confirmed",
      warnings: [],
    };
    const state = buildCoreElementState({
      pillars,
      core: "火",
      observations: observationsWithChains([]),
    });
    expect(state.controlPresence).toBe("controller-visible");
  });

  it("6a. outgoing none", () => {
    const pillars = pillarsOf({ day: { stem: "丙", branch: "午" } });
    const state = buildCoreElementState({
      pillars,
      core: "火",
      observations: observationsWithChains([]),
    });
    expect(state.outgoingDrainage).toBe("none");
  });

  it("6b. outgoing hidden-context", () => {
    const pillars = pillarsOf({ day: { stem: "丙", branch: "午" } });
    const from = node({
      slot: "day",
      layer: "hiddenStem",
      stem: "丁",
      element: "火",
      presence: "hidden-only",
    });
    const to = node({
      slot: "hour",
      layer: "hiddenStem",
      stem: "己",
      element: "土",
      presence: "hidden-only",
    });
    const state = buildCoreElementState({
      pillars,
      core: "火",
      observations: observationsWithChains([generatesChain(from, to)]),
    });
    expect(state.outgoingDrainage).toBe("hidden-context");
  });

  it("6c. outgoing surface via visible presence on to", () => {
    const pillars = pillarsOf({ day: { stem: "丙", branch: "午" } });
    const from = node({
      slot: "day",
      layer: "hiddenStem",
      stem: "丁",
      element: "火",
      presence: "hidden-only",
    });
    const to = node({
      slot: "hour",
      layer: "hiddenStem",
      stem: "戊",
      element: "土",
      presence: "rooted-visible",
    });
    const state = buildCoreElementState({
      pillars,
      core: "火",
      observations: observationsWithChains([generatesChain(from, to)]),
    });
    expect(state.outgoingDrainage).toBe("surface");
  });

  it("ignores resource-to-day-master and non parent/child element-generates", () => {
    const pillars = pillarsOf({ day: { stem: "丙", branch: "午" } });
    const wood = node({
      slot: "month",
      layer: "stem",
      stem: "乙",
      element: "木",
      presence: "rooted-visible",
    });
    const earth = node({
      slot: "hour",
      layer: "stem",
      stem: "戊",
      element: "土",
      presence: "rooted-visible",
    });
    const state = buildCoreElementState({
      pillars,
      core: "火",
      observations: observationsWithChains([
        {
          relation: "resource-to-day-master",
          from: wood,
          to: {
            target: "day-master",
            slot: "day",
            layer: "stem",
            stem: "丙",
            element: "火",
            presence: "rooted-visible",
          },
        },
        generatesChain(wood, earth), // 木→土 not parent→core or core→child
      ]),
    });
    expect(state.incomingGeneration).toBe("none");
    expect(state.outgoingDrainage).toBe("none");
  });
});
