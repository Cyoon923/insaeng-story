/**
 * Classify Supplement candidates as ACTIVE / CAUTION / INACTIVE under frozen v1 policy.
 * Does not select a Supplement winner. No scores. No F3/F4/F5/outgoing-F6 positives.
 */

import type { CoreElementState } from "@/lib/saju/final/buildCoreElementState";
import type { CoreScopedCorridor } from "@/lib/saju/final/buildCoreScopedCorridors";
import type { SupplementCandidateState } from "@/lib/saju/final/buildSupplementCandidateStates";
import type {
  AdjustedClimateSummary,
  ClimateElement,
  ClimateFactor,
  Element,
  NeedResolution,
} from "@/lib/saju/types";

export type SupplementFunction =
  | "F1_DIRECT"
  | "F2_GENERATIVE"
  | "F6_INCOMING_MEDIATION"
  | "F7_CLIMATE_MITIGATION"
  | "F8_CLIMATE_REINFORCEMENT";

export type SupplementCandidatePolicyState = "ACTIVE" | "CAUTION" | "INACTIVE";

export type SupplementCandidatePolicy = {
  element: Element;
  state: SupplementCandidatePolicyState;
  positiveFunctions: SupplementFunction[];
  cautionFunctions: SupplementFunction[];
  reasons: string[];
};

export type DeriveSupplementCandidatePolicyStatesInput = {
  coreState: CoreElementState;
  candidateStates: SupplementCandidateState[];
  corridors: CoreScopedCorridor[];
  climate: AdjustedClimateSummary;
  needResolution?: NeedResolution;
};

function isClimateElement(element: Element): element is ClimateElement {
  return element === "火" || element === "水";
}

function factorsFor(
  factors: ClimateFactor[],
  element: ClimateElement,
): ClimateFactor[] {
  return factors.filter((factor) => factor.element === element);
}

function needContestedForElement(
  need: NeedResolution | undefined,
  element: Element,
): boolean {
  if (!need) return false;
  if (need.decisionBlockedBy.includes("climate-need-contested-inherited")) {
    return (
      need.climateOnlyElements.some((item) => item.element === element) ||
      need.supportedElements.some((item) => item.element === element) ||
      need.singleAxisElements.some((item) => item.element === element)
    );
  }
  const pools = [
    ...need.climateOnlyElements,
    ...need.singleAxisElements,
    ...need.deferredElements,
  ];
  return pools.some(
    (item) => item.element === element && item.boundary === "contested-inherited",
  );
}

function axisBlocksMitigationPositive(outcome: string, status: string): boolean {
  if (status !== "resolved") return true;
  return (
    outcome === "mitigation-reinforcement-conflict" ||
    outcome === "partially-mitigated" ||
    outcome === "unresolved"
  );
}

/** F7: narrow mitigation positive for 火/水 only. */
function evaluateF7(input: {
  element: Element;
  climate: AdjustedClimateSummary;
  needResolution?: NeedResolution;
}): { positive: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!isClimateElement(input.element)) {
    return { positive: false, reasons: ["f7:wood-earth-metal-unknown"] };
  }

  const mitigation = factorsFor(input.climate.mitigationFactors, input.element);
  if (mitigation.length === 0) {
    return { positive: false, reasons: ["f7:no-mitigation-factor"] };
  }
  reasons.push("f7:mitigation-factor-present");

  if (needContestedForElement(input.needResolution, input.element)) {
    reasons.push("f7:need-contested-blocks-positive");
    return { positive: false, reasons };
  }

  if (input.climate.certainty === "partial") {
    reasons.push("f7:climate-certainty-partial-blocks-positive");
    return { positive: false, reasons };
  }

  const { temperature, moisture } = input.climate;
  let matchesBias = false;

  const tempMitigator = mitigation.some((f) => f.temperatureRole === "mitigation");
  const moistMitigator = mitigation.some((f) => f.moistureRole === "mitigation");

  if (tempMitigator) {
    if (axisBlocksMitigationPositive(temperature.outcome, temperature.status)) {
      reasons.push("f7:temperature-axis-blocks-positive");
    } else if (input.element === "水" && temperature.value === "warm") {
      matchesBias = true;
      reasons.push("f7:water-matches-warm");
    } else if (input.element === "火" && temperature.value === "cold") {
      matchesBias = true;
      reasons.push("f7:fire-matches-cold");
    }
  }

  if (moistMitigator) {
    if (axisBlocksMitigationPositive(moisture.outcome, moisture.status)) {
      reasons.push("f7:moisture-axis-blocks-positive");
    } else if (input.element === "水" && moisture.value === "dry") {
      matchesBias = true;
      reasons.push("f7:water-matches-dry");
    } else if (input.element === "火" && moisture.value === "moist") {
      matchesBias = true;
      reasons.push("f7:fire-matches-moist");
    }
  }

  if (!matchesBias) {
    reasons.push("f7:bias-direction-not-matched-or-blocked");
    return { positive: false, reasons };
  }

  return { positive: true, reasons };
}

/** F8: caution when 火/水 reinforces current non-balanced bias. */
function evaluateF8(input: {
  element: Element;
  climate: AdjustedClimateSummary;
}): { caution: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!isClimateElement(input.element)) {
    return { caution: false, reasons: [] };
  }

  const reinforcement = factorsFor(input.climate.reinforcementFactors, input.element);
  if (reinforcement.length === 0) {
    return { caution: false, reasons: [] };
  }
  reasons.push("f8:reinforcement-factor-present");

  const { temperature, moisture } = input.climate;
  let cautionsBias = false;

  const tempReinforcer = reinforcement.some((f) => f.temperatureRole === "reinforcement");
  const moistReinforcer = reinforcement.some((f) => f.moistureRole === "reinforcement");

  if (tempReinforcer && temperature.value === "warm" && input.element === "火") {
    cautionsBias = true;
    reasons.push("f8:fire-reinforces-warm");
  }
  if (tempReinforcer && temperature.value === "cold" && input.element === "水") {
    cautionsBias = true;
    reasons.push("f8:water-reinforces-cold");
  }
  if (moistReinforcer && moisture.value === "dry" && input.element === "火") {
    cautionsBias = true;
    reasons.push("f8:fire-reinforces-dry");
  }
  if (moistReinforcer && moisture.value === "moist" && input.element === "水") {
    cautionsBias = true;
    reasons.push("f8:water-reinforces-moist");
  }

  if (!cautionsBias) {
    reasons.push("f8:no-nonbalanced-bias-match");
    return { caution: false, reasons };
  }

  return { caution: true, reasons };
}

function incomingCorridorForMid(
  corridors: CoreScopedCorridor[],
  mid: Element,
): CoreScopedCorridor | undefined {
  return corridors.find((row) => row.kind === "incoming-mid" && row.mid === mid);
}

function resolveState(input: {
  positiveFunctions: SupplementFunction[];
  cautionFunctions: SupplementFunction[];
  hasDirectPath: boolean;
}): SupplementCandidatePolicyState {
  const hasPositive = input.positiveFunctions.length > 0;
  const hasCaution = input.cautionFunctions.length > 0;

  if (hasPositive && !hasCaution) return "ACTIVE";
  if (hasPositive && hasCaution) return "CAUTION";
  // F8 caution with direct/path relation (even without positive)
  if (hasCaution && input.hasDirectPath) return "CAUTION";
  return "INACTIVE";
}

/**
 * Derive per-candidate ACTIVE / CAUTION / INACTIVE under Supplement v1 policy.
 * Does not pick a winner among ACTIVE candidates.
 */
export function deriveSupplementCandidatePolicyStates(
  input: DeriveSupplementCandidatePolicyStatesInput,
): SupplementCandidatePolicy[] {
  const { coreState, candidateStates, corridors, climate, needResolution } = input;

  return candidateStates.map((candidate) => {
    const positiveFunctions: SupplementFunction[] = [];
    const cautionFunctions: SupplementFunction[] = [];
    const reasons: string[] = [];

    // F1 DIRECT
    if (candidate.element === coreState.core) {
      reasons.push("f1:direct-path");
      if (
        coreState.presence === "absent" ||
        coreState.presence === "hidden-only"
      ) {
        positiveFunctions.push("F1_DIRECT");
        reasons.push(`f1:positive-core-presence=${coreState.presence}`);
      } else {
        reasons.push(`f1:not-positive-core-presence=${coreState.presence}`);
      }
    }

    // F2 GENERATIVE
    if (candidate.relationToCore === "generates-core") {
      if (candidate.generationToCore === "surface") {
        positiveFunctions.push("F2_GENERATIVE");
        reasons.push("f2:surface-generative");
      } else {
        reasons.push(`f2:not-positive-band=${candidate.generationToCore}`);
      }
    }

    // F6 INCOMING MEDIATION (surface+surface only for positive)
    const incoming = incomingCorridorForMid(corridors, candidate.element);
    if (incoming) {
      if (incoming.firstLeg === "surface" && incoming.secondLeg === "surface") {
        positiveFunctions.push("F6_INCOMING_MEDIATION");
        reasons.push("f6:incoming-surface-surface");
      } else {
        reasons.push(
          `f6:incoming-not-sole-positive:${incoming.firstLeg}+${incoming.secondLeg}`,
        );
      }
    }

    // F3 / F4 / F5 / outgoing-F6: never v1 positive (reasons only when relevant)
    if (candidate.relationToCore === "generated-by-core") {
      reasons.push("f3:drainage-path-not-v1-positive");
    }
    if (candidate.relationToCore === "controls-core") {
      reasons.push("f4:control-path-not-v1-positive");
    }
    if (candidate.relationToCore === "controlled-by-core") {
      reasons.push("f5:core-controls-target-not-v1-positive");
    }
    if (
      corridors.some(
        (row) => row.kind === "outgoing-mid" && row.mid === candidate.element,
      )
    ) {
      reasons.push("f6:outgoing-mid-not-v1-positive");
    }

    // F7
    const f7 = evaluateF7({
      element: candidate.element,
      climate,
      needResolution,
    });
    reasons.push(...f7.reasons);
    if (f7.positive) positiveFunctions.push("F7_CLIMATE_MITIGATION");

    // F8
    const f8 = evaluateF8({ element: candidate.element, climate });
    reasons.push(...f8.reasons);
    if (f8.caution) cautionFunctions.push("F8_CLIMATE_REINFORCEMENT");

    const hasDirectPath = candidate.relationToCore === "direct";
    const state = resolveState({
      positiveFunctions,
      cautionFunctions,
      hasDirectPath,
    });

    return {
      element: candidate.element,
      state,
      positiveFunctions,
      cautionFunctions,
      reasons,
    };
  });
}
