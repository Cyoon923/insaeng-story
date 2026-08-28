/**
 * Classify 木火土金水 annual supplement candidates as ACTIVE / CAUTION / INACTIVE.
 * No winner / tie-break / scores. Does not mutate natal or FourPillars.
 */

import type { AnnualLuckEvidence, AnnualSignal } from "@/lib/saju/luck/annual/types";
import { elementGenerates } from "@/lib/saju/observation/elementGenerates";
import type {
  AdjustedClimateSummary,
  AdjustedMoistureAxis,
  AdjustedTemperatureAxis,
  Element,
} from "@/lib/saju/types";
import { ELEMENTS } from "@/lib/saju/types";

export type AnnualFunction =
  | "A1_CORE_SUPPORT"
  | "A2_SUPPLEMENT_REINFORCEMENT"
  | "A3_SUPPLEMENT_OFFSET"
  | "A4_CLIMATE_MITIGATION"
  | "A5_CLIMATE_REINFORCEMENT";

export type AnnualCandidateState = "ACTIVE" | "CAUTION" | "INACTIVE";

export type AnnualCandidatePolicy = {
  element: Element;
  state: AnnualCandidateState;
  positiveFunctions: AnnualFunction[];
  cautionFunctions: AnnualFunction[];
  traceFunctions: AnnualFunction[];
  reasons: string[];
};

export type DeriveAnnualCandidatePolicyStatesInput = {
  evidence: AnnualLuckEvidence;
  natalCoreElement: Element;
  natalSupplementElement: Element | null;
  natalClimate: AdjustedClimateSummary;
};

type ClimateAxis = AdjustedTemperatureAxis | AdjustedMoistureAxis;

const BLOCKED_CLIMATE_OUTCOMES = new Set([
  "partially-mitigated",
  "mitigation-reinforcement-conflict",
  "unresolved",
]);

function axisUsable(axis: ClimateAxis): boolean {
  if (axis.status !== "resolved") return false;
  if (BLOCKED_CLIMATE_OUTCOMES.has(axis.outcome)) return false;
  return true;
}

function natalClimateUsable(climate: AdjustedClimateSummary): boolean {
  return axisUsable(climate.temperature) && axisUsable(climate.moisture);
}

function hasWarmOrDry(climate: AdjustedClimateSummary): boolean {
  return climate.temperature.value === "warm" || climate.moisture.value === "dry";
}

function hasColdOrMoist(climate: AdjustedClimateSummary): boolean {
  return climate.temperature.value === "cold" || climate.moisture.value === "moist";
}

function uniquePreserveOrder<T>(items: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

function resolveState(input: {
  positiveFunctions: AnnualFunction[];
  cautionFunctions: AnnualFunction[];
}): AnnualCandidateState {
  const hasPositive = input.positiveFunctions.length > 0;
  const hasCaution = input.cautionFunctions.length > 0;
  if (hasPositive && !hasCaution) return "ACTIVE";
  if (hasCaution) return "CAUTION";
  return "INACTIVE";
}

function evaluateA2A3(input: {
  element: Element;
  natalSupplement: Element | null;
  signals: AnnualSignal[];
  reasons: string[];
}): { positive: AnnualFunction[]; caution: AnnualFunction[] } {
  const { element, natalSupplement, signals, reasons } = input;
  const positive: AnnualFunction[] = [];
  const caution: AnnualFunction[] = [];

  if (natalSupplement === null) {
    reasons.push("a2a3:skip:natal-supplement-null");
    return { positive, caution };
  }
  if (element !== natalSupplement) {
    return { positive, caution };
  }

  let a2Same = false;
  let a2Generates = false;
  let a3Controls = false;
  let a3GeneratedBy = false;

  for (const signal of signals) {
    const rel = signal.relationToNatalSupplement;
    if (rel === null) continue;

    if (rel === "same") {
      a2Same = true;
      reasons.push(`a2:same:via-${signal.source}`);
    }
    if (rel === "generates") {
      a2Generates = true;
      reasons.push(`a2:generates:via-${signal.source}`);
    }
    if (rel === "controls") {
      a3Controls = true;
      reasons.push(`a3:controls:via-${signal.source}`);
    }
    if (rel === "generated-by") {
      a3GeneratedBy = true;
      reasons.push(`a3:s-generates-annual:via-${signal.source}`);
    }
    if (rel === "controlled-by") {
      reasons.push(`a3:not:s-controls-annual:via-${signal.source}`);
    }
  }

  if (a2Same || a2Generates) {
    caution.push("A2_SUPPLEMENT_REINFORCEMENT");
  }
  if (a3Controls || a3GeneratedBy) {
    positive.push("A3_SUPPLEMENT_OFFSET");
  }

  return { positive, caution };
}

function evaluateA4A5(input: {
  element: Element;
  climate: AdjustedClimateSummary;
  reasons: string[];
}): { positive: AnnualFunction[]; caution: AnnualFunction[] } {
  const { element, climate, reasons } = input;
  const positive: AnnualFunction[] = [];
  const caution: AnnualFunction[] = [];

  if (element !== "火" && element !== "水") {
    return { positive, caution };
  }

  if (!natalClimateUsable(climate)) {
    reasons.push("a4a5:blocked:natal-climate-unusable");
    return { positive, caution };
  }

  const warmDry = hasWarmOrDry(climate);
  const coldMoist = hasColdOrMoist(climate);

  if (element === "水") {
    if (warmDry) {
      positive.push("A4_CLIMATE_MITIGATION");
      reasons.push("a4:water:warm-or-dry");
    }
    if (coldMoist) {
      caution.push("A5_CLIMATE_REINFORCEMENT");
      reasons.push("a5:water:cold-or-moist");
    }
  }

  if (element === "火") {
    if (coldMoist) {
      positive.push("A4_CLIMATE_MITIGATION");
      reasons.push("a4:fire:cold-or-moist");
    }
    if (warmDry) {
      caution.push("A5_CLIMATE_REINFORCEMENT");
      reasons.push("a5:fire:warm-or-dry");
    }
  }

  return { positive, caution };
}

/**
 * Derive policy states for all five elements. No winner selection.
 */
export function deriveAnnualCandidatePolicyStates(
  input: DeriveAnnualCandidatePolicyStatesInput,
): AnnualCandidatePolicy[] {
  const {
    evidence,
    natalCoreElement,
    natalSupplementElement,
    natalClimate,
  } = input;

  return ELEMENTS.map((element) => {
    const reasons: string[] = [`candidate=${element}`];

    const traceFunctions: AnnualFunction[] = [];
    if (element === natalCoreElement) {
      reasons.push("a1:trace:same-core");
      traceFunctions.push("A1_CORE_SUPPORT");
    } else if (elementGenerates(element, natalCoreElement)) {
      reasons.push("a1:trace:generates-core");
      traceFunctions.push("A1_CORE_SUPPORT");
    }

    const a2a3 = evaluateA2A3({
      element,
      natalSupplement: natalSupplementElement,
      signals: evidence.signals,
      reasons,
    });

    const a4a5 = evaluateA4A5({
      element,
      climate: natalClimate,
      reasons,
    });

    const positiveFunctions = uniquePreserveOrder([
      ...a2a3.positive,
      ...a4a5.positive,
    ]);
    const cautionFunctions = uniquePreserveOrder([
      ...a2a3.caution,
      ...a4a5.caution,
    ]);

    const state = resolveState({ positiveFunctions, cautionFunctions });
    reasons.push(`state=${state}`);

    return {
      element,
      state,
      positiveFunctions,
      cautionFunctions,
      traceFunctions: uniquePreserveOrder(traceFunctions),
      reasons,
    };
  });
}
