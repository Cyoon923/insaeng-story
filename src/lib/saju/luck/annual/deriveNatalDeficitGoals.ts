/**
 * Restore natal deficit goals from resolved Supplement v1 winner evidence.
 * Does not discover all chart problems — only why Supplement was chosen.
 */

import type { CoreScopedCorridor } from "@/lib/saju/final/buildCoreScopedCorridors";
import type { SupplementCandidatePolicy } from "@/lib/saju/final/deriveSupplementCandidatePolicyStates";
import type {
  NatalDeficitGoal,
  NatalDeficitMethod,
  NatalDeficitSourceFunction,
} from "@/lib/saju/luck/annual/types";
import type {
  AdjustedClimateSummary,
  AdjustedMoistureAxis,
  AdjustedTemperatureAxis,
  ClimateElement,
  ClimateFactor,
  Element,
} from "@/lib/saju/types";

export type DeriveNatalDeficitGoalsInput = {
  natalCoreElement: Element;
  natalSupplementElement: Element | null;
  natalSupplementStatus: "resolved" | "unresolved";
  natalPolicies: SupplementCandidatePolicy[];
  natalCorridors: CoreScopedCorridor[];
  natalClimate: AdjustedClimateSummary;
};

const GOAL_POSITIVE_FUNCTIONS = new Set<NatalDeficitSourceFunction>([
  "F1_DIRECT",
  "F2_GENERATIVE",
  "F6_INCOMING_MEDIATION",
  "F7_CLIMATE_MITIGATION",
]);

const BLOCKED_CLIMATE_OUTCOMES = new Set([
  "partially-mitigated",
  "mitigation-reinforcement-conflict",
  "unresolved",
]);

function isClimateElement(element: Element): element is ClimateElement {
  return element === "火" || element === "水";
}

function isGoalSourceFunction(fn: string): fn is NatalDeficitSourceFunction {
  return GOAL_POSITIVE_FUNCTIONS.has(fn as NatalDeficitSourceFunction);
}

function axisUsable(axis: AdjustedTemperatureAxis | AdjustedMoistureAxis): boolean {
  if (axis.status !== "resolved") return false;
  if (BLOCKED_CLIMATE_OUTCOMES.has(axis.outcome)) return false;
  return true;
}

function factorsFor(
  factors: ClimateFactor[],
  element: ClimateElement,
): ClimateFactor[] {
  return factors.filter((factor) => factor.element === element);
}

function axisBlocksMitigationPositive(outcome: string, status: string): boolean {
  if (status !== "resolved") return true;
  return (
    outcome === "mitigation-reinforcement-conflict" ||
    outcome === "partially-mitigated" ||
    outcome === "unresolved"
  );
}

/** Mirrors F7 positive gate — policy string alone is insufficient. */
function climateMitigationEvidenceValid(input: {
  element: Element;
  climate: AdjustedClimateSummary;
}): { valid: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!isClimateElement(input.element)) {
    return { valid: false, reasons: ["f7:wood-earth-metal-unknown"] };
  }

  const mitigation = factorsFor(input.climate.mitigationFactors, input.element);
  if (mitigation.length === 0) {
    return { valid: false, reasons: ["f7:no-mitigation-factor"] };
  }
  reasons.push("f7:mitigation-factor-present");

  if (input.climate.certainty === "partial") {
    reasons.push("f7:climate-certainty-partial-blocks-positive");
    return { valid: false, reasons };
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
    return { valid: false, reasons };
  }

  if (!axisUsable(temperature) || !axisUsable(moisture)) {
    reasons.push("f7:climate-axis-unusable");
    return { valid: false, reasons };
  }

  return { valid: true, reasons };
}

function incomingCorridorForMid(
  corridors: CoreScopedCorridor[],
  mid: Element,
): CoreScopedCorridor | undefined {
  return corridors.find((row) => row.kind === "incoming-mid" && row.mid === mid);
}

function methodsFromSourceFunctions(
  fns: NatalDeficitSourceFunction[],
): NatalDeficitMethod[] {
  const methods: NatalDeficitMethod[] = [];
  if (fns.includes("F1_DIRECT")) methods.push("direct");
  if (fns.includes("F2_GENERATIVE")) methods.push("generative");
  if (fns.includes("F6_INCOMING_MEDIATION")) methods.push("corridor-mid");
  if (fns.includes("F7_CLIMATE_MITIGATION")) methods.push("climate-fire-water");
  return methods;
}

function winnerPolicy(
  input: DeriveNatalDeficitGoalsInput,
): SupplementCandidatePolicy | undefined {
  if (input.natalSupplementElement === null) return undefined;
  return input.natalPolicies.find(
    (row) => row.element === input.natalSupplementElement,
  );
}

/**
 * Extract natal deficit goals from resolved Supplement winner policy only.
 */
export function deriveNatalDeficitGoals(
  input: DeriveNatalDeficitGoalsInput,
): NatalDeficitGoal[] {
  const reasons: string[] = [];

  if (
    input.natalSupplementStatus === "unresolved" ||
    input.natalSupplementElement === null
  ) {
    reasons.push("skip:supplement-unresolved-or-null");
    return [];
  }

  const policy = winnerPolicy(input);
  if (!policy) {
    reasons.push(`skip:no-policy-for-winner=${input.natalSupplementElement}`);
    return [];
  }

  reasons.push(`winner=${policy.element}`);
  reasons.push(`winner-state=${policy.state}`);

  const positives = policy.positiveFunctions.filter(isGoalSourceFunction);
  if (positives.length === 0) {
    reasons.push("skip:winner-no-goal-positive-functions");
    return [];
  }

  const winner = policy.element;
  const goals: NatalDeficitGoal[] = [];

  const coreSources: NatalDeficitSourceFunction[] = [];
  const coreReasons: string[] = [];

  if (positives.includes("F1_DIRECT")) {
    coreSources.push("F1_DIRECT");
    coreReasons.push("map:F1→CORE_SUPPORT:direct");
  }
  if (positives.includes("F2_GENERATIVE")) {
    coreSources.push("F2_GENERATIVE");
    coreReasons.push("map:F2→CORE_SUPPORT:generative");
  }
  if (coreSources.length > 0) {
    goals.push({
      kind: "CORE_SUPPORT",
      targetElement: input.natalCoreElement,
      sourceFunctions: coreSources,
      sourceElement: winner,
      methods: methodsFromSourceFunctions(coreSources),
      reasons: [...coreReasons, `target=core:${input.natalCoreElement}`],
    });
  }

  if (positives.includes("F6_INCOMING_MEDIATION")) {
    const corridor = incomingCorridorForMid(input.natalCorridors, winner);
    if (!corridor) {
      reasons.push("skip:F6-no-natal-incoming-corridor-for-winner-mid");
    } else {
      goals.push({
        kind: "INCOMING_MEDIATION",
        targetElement: input.natalCoreElement,
        sourceFunctions: ["F6_INCOMING_MEDIATION"],
        sourceElement: winner,
        methods: ["corridor-mid"],
        reasons: [
          "map:F6→INCOMING_MEDIATION",
          `corridor:incoming-mid:${corridor.from}→${corridor.mid}→${corridor.to}`,
          `target=core:${input.natalCoreElement}`,
        ],
      });
    }
  }

  if (positives.includes("F7_CLIMATE_MITIGATION")) {
    const f7 = climateMitigationEvidenceValid({
      element: winner,
      climate: input.natalClimate,
    });
    if (!f7.valid) {
      reasons.push("skip:F7-climate-evidence-mismatch", ...f7.reasons);
    } else {
      goals.push({
        kind: "CLIMATE_MITIGATION",
        targetElement: winner,
        sourceFunctions: ["F7_CLIMATE_MITIGATION"],
        sourceElement: winner,
        methods: ["climate-fire-water"],
        reasons: [
          "map:F7→CLIMATE_MITIGATION",
          `target=climate-element:${winner}`,
          ...f7.reasons,
        ],
      });
    }
  }

  return goals;
}
