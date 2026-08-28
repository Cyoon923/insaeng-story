/**
 * Derive per-element remedy Safety from protected goals/states and evidence.
 * No scores, no 剋-only conflicting, no climate continuity for structural.
 */

import type { CoreScopedCorridor } from "@/lib/saju/final/buildCoreScopedCorridors";
import type { CoreElementState } from "@/lib/saju/final/buildCoreElementState";
import {
  elementGenerates,
  generatedElement,
} from "@/lib/saju/observation/elementGenerates";
import type {
  AnnualCandidateSafety,
  AnnualCandidateSafetyRecord,
  AnnualGoalSatisfactionInput,
  AnnualImbalance,
  AnnualLuckEvidence,
  AnnualResidualGoal,
  AnnualSafetyCandidateInput,
  AnnualSignal,
} from "@/lib/saju/luck/annual/types";
import type {
  AdjustedClimateSummary,
  AdjustedMoistureAxis,
  AdjustedTemperatureAxis,
  ClimateElement,
  ClimateFactor,
  Element,
} from "@/lib/saju/types";
import { ELEMENTS } from "@/lib/saju/types";

export type DeriveAnnualCandidateSafetiesInput = {
  candidates?: AnnualSafetyCandidateInput[];
  openGoals: AnnualResidualGoal[];
  imbalances: AnnualImbalance[];
  /** Secured / partial goal states beyond openGoals. */
  goalSatisfactions?: AnnualGoalSatisfactionInput[];
  natalCoreState: Pick<CoreElementState, "core" | "presence">;
  natalClimate: AdjustedClimateSummary;
  evidence: AnnualLuckEvidence;
  corridors: CoreScopedCorridor[];
};

const BLOCKED_CLIMATE_OUTCOMES = new Set([
  "partially-mitigated",
  "mitigation-reinforcement-conflict",
  "unresolved",
]);

const SECURED_SATISFACTION = new Set(["met", "partially-met"]);

function uniqueGoals(goals: AnnualResidualGoal[]): AnnualResidualGoal[] {
  const seen = new Set<AnnualResidualGoal>();
  const out: AnnualResidualGoal[] = [];
  for (const goal of goals) {
    if (seen.has(goal)) continue;
    seen.add(goal);
    out.push(goal);
  }
  return out;
}

function isClimateElement(element: Element): element is ClimateElement {
  return element === "火" || element === "水";
}

function elementControls(from: Element, to: Element): boolean {
  return generatedElement(generatedElement(from)) === to;
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

function climateMitigationValid(input: {
  element: Element;
  climate: AdjustedClimateSummary;
}): boolean {
  if (!isClimateElement(input.element)) return false;
  if (input.climate.certainty === "partial") return false;
  if (!axisUsable(input.climate.temperature) || !axisUsable(input.climate.moisture)) {
    return false;
  }

  const mitigation = factorsFor(input.climate.mitigationFactors, input.element);
  if (mitigation.length === 0) return false;

  const { temperature, moisture } = input.climate;
  const tempMit = mitigation.some((f) => f.temperatureRole === "mitigation");
  const moistMit = mitigation.some((f) => f.moistureRole === "mitigation");

  if (input.element === "水") {
    if (tempMit && temperature.value === "warm") return true;
    if (moistMit && moisture.value === "dry") return true;
  }
  if (input.element === "火") {
    if (tempMit && temperature.value === "cold") return true;
    if (moistMit && moisture.value === "moist") return true;
  }
  return false;
}

function climateReinforcesBias(input: {
  element: Element;
  climate: AdjustedClimateSummary;
}): boolean {
  if (!isClimateElement(input.element)) return false;
  if (!axisUsable(input.climate.temperature) || !axisUsable(input.climate.moisture)) {
    return false;
  }

  const warmDry =
    input.climate.temperature.value === "warm" ||
    input.climate.moisture.value === "dry";
  const coldMoist =
    input.climate.temperature.value === "cold" ||
    input.climate.moisture.value === "moist";

  const reinforcement = factorsFor(
    input.climate.reinforcementFactors,
    input.element,
  );
  if (reinforcement.length === 0) return false;

  const tempRe = reinforcement.some((f) => f.temperatureRole === "reinforcement");
  const moistRe = reinforcement.some((f) => f.moistureRole === "reinforcement");

  if (input.element === "火" && warmDry && (tempRe || moistRe)) return true;
  if (input.element === "水" && coldMoist && (tempRe || moistRe)) return true;
  return false;
}

function incomingSurfaceCorridorForMid(
  corridors: CoreScopedCorridor[],
  mid: Element,
): CoreScopedCorridor | undefined {
  return corridors.find(
    (row) =>
      row.kind === "incoming-mid" &&
      row.mid === mid &&
      row.firstLeg === "surface" &&
      row.secondLeg === "surface",
  );
}

function incomingAnyCorridorForMid(
  corridors: CoreScopedCorridor[],
  mid: Element,
): CoreScopedCorridor | undefined {
  return corridors.find((row) => row.kind === "incoming-mid" && row.mid === mid);
}

function signalsForElement(
  evidence: AnnualLuckEvidence,
  element: Element,
): AnnualSignal[] {
  return evidence.signals.filter((signal) => signal.element === element);
}

function buildProtectedGoals(input: DeriveAnnualCandidateSafetiesInput): AnnualResidualGoal[] {
  const protectedGoals = [...input.openGoals];
  for (const row of input.goalSatisfactions ?? []) {
    if (SECURED_SATISFACTION.has(row.status)) {
      protectedGoals.push(row.goal);
    }
  }
  return uniqueGoals(protectedGoals);
}

function satisfactionStatus(
  input: DeriveAnnualCandidateSafetiesInput,
  goal: AnnualResidualGoal,
): AnnualGoalSatisfactionInput["status"] | null {
  const row = input.goalSatisfactions?.find((item) => item.goal === goal);
  return row?.status ?? null;
}

function climateGoalOpen(input: DeriveAnnualCandidateSafetiesInput): boolean {
  if (input.openGoals.includes("CLIMATE_MITIGATION")) return true;
  return input.imbalances.some(
    (row) =>
      row.kind === "RESIDUAL_CLIMATE_MITIGATION" ||
      row.kind === "CLIMATE_REINFORCEMENT_RISK",
  );
}

function deriveAddressedGoals(input: {
  element: Element;
  evidence: AnnualLuckEvidence;
  openGoals: AnnualResidualGoal[];
  corridors: CoreScopedCorridor[];
  natalCore: Element;
  natalClimate: AdjustedClimateSummary;
  climateOpen: boolean;
}): { goals: AnnualResidualGoal[]; reasons: string[] } {
  const reasons: string[] = [];
  const goals: AnnualResidualGoal[] = [];
  const signals = signalsForElement(input.evidence, input.element);

  if (input.openGoals.includes("CORE_SUPPORT")) {
    const supports = signals.some(
      (signal) =>
        signal.relationToNatalCore === "same" ||
        signal.relationToNatalCore === "generates",
    );
    if (supports) {
      goals.push("CORE_SUPPORT");
      reasons.push("remedy:core-support:annual-signal");
    }
  }

  if (input.openGoals.includes("INCOMING_MEDIATION")) {
    const corridor = incomingAnyCorridorForMid(input.corridors, input.element);
    if (corridor) {
      goals.push("INCOMING_MEDIATION");
      reasons.push(
        `remedy:incoming:corridor:${corridor.from}→${corridor.mid}→${corridor.to}`,
      );
    }
  }

  if (input.climateOpen && climateMitigationValid({ element: input.element, climate: input.natalClimate })) {
    goals.push("CLIMATE_MITIGATION");
    reasons.push("remedy:climate-mitigation:usable-factor");
  }

  return { goals: uniqueGoals(goals), reasons };
}

type HarmAssessment = {
  explicit: AnnualResidualGoal[];
  uncertain: AnnualResidualGoal[];
  reasons: string[];
};

function assessHarm(input: {
  element: Element;
  addressedGoals: AnnualResidualGoal[];
  evidence: AnnualLuckEvidence;
  protectedGoals: AnnualResidualGoal[];
  natalCoreState: Pick<CoreElementState, "core" | "presence">;
  natalClimate: AdjustedClimateSummary;
  imbalances: AnnualImbalance[];
  satisfaction: DeriveAnnualCandidateSafetiesInput;
}): HarmAssessment {
  const reasons: string[] = [];
  const explicit: AnnualResidualGoal[] = [];
  const uncertain: AnnualResidualGoal[] = [];
  const signals = signalsForElement(input.evidence, input.element);
  const core = input.natalCoreState.core;

  const hasSupportSignal = signals.some(
    (s) => s.relationToNatalCore === "same" || s.relationToNatalCore === "generates",
  );
  const hasControlSignal = signals.some((s) => s.relationToNatalCore === "controls");

  if (
    input.protectedGoals.includes("CORE_SUPPORT") &&
    hasSupportSignal &&
    hasControlSignal
  ) {
    explicit.push("CORE_SUPPORT");
    reasons.push("harm:explicit:core-support:support-and-control-signals");
  }

  const coreStatus = satisfactionStatus(input.satisfaction, "CORE_SUPPORT");
  const coreProtected =
    input.protectedGoals.includes("CORE_SUPPORT") &&
    (coreStatus === "partially-met" || coreStatus === "met");

  if (
    coreProtected &&
    input.addressedGoals.includes("CLIMATE_MITIGATION") &&
    elementControls(input.element, core) &&
    !explicit.includes("CORE_SUPPORT")
  ) {
    uncertain.push("CORE_SUPPORT");
    reasons.push(
      "harm:uncertain:climate-remedy-with-controller-relation-no-explicit-core-harm",
    );
  }

  if (
    coreProtected &&
    hasControlSignal &&
    !hasSupportSignal &&
    !explicit.includes("CORE_SUPPORT")
  ) {
    uncertain.push("CORE_SUPPORT");
    reasons.push("harm:uncertain:control-signal-without-explicit-degradation");
  }

  if (
    input.imbalances.some((row) => row.kind === "CORE_REINFORCEMENT_RISK") &&
    signals.some((s) => s.relationToNatalCore === "same") &&
    input.natalCoreState.presence === "rooted-visible"
  ) {
    uncertain.push("CORE_SUPPORT");
    reasons.push("harm:uncertain:core-reinforcement-risk-imbalance");
  }

  if (
    input.imbalances.some((row) => row.kind === "CLIMATE_REINFORCEMENT_RISK") &&
    input.element === "火" &&
    signals.some((s) => s.relationToNatalCore === "same") &&
    input.addressedGoals.includes("CORE_SUPPORT")
  ) {
    uncertain.push("CORE_SUPPORT");
    reasons.push("harm:uncertain:climate-reinforcement-with-core-same-signal");
  }

  if (input.addressedGoals.includes("CLIMATE_MITIGATION")) {
    if (climateReinforcesBias({ element: input.element, climate: input.natalClimate })) {
      if (input.protectedGoals.includes("CLIMATE_MITIGATION")) {
        explicit.push("CLIMATE_MITIGATION");
        reasons.push("harm:explicit:climate:reinforcement-while-mitigation-goal-open");
      }
    }
  }

  if (
    input.imbalances.some((row) => row.kind === "CLIMATE_REINFORCEMENT_RISK") &&
    isClimateElement(input.element) &&
    input.evidence.climateSignals.some(
      (tag, index) =>
        tag === "fire-signal" && input.evidence.signals[index]?.element === input.element,
    )
  ) {
    uncertain.push("CLIMATE_MITIGATION");
    reasons.push("harm:uncertain:climate-reinforcement-risk-with-fire-signal");
  }

  return {
    explicit: uniqueGoals(explicit),
    uncertain: uniqueGoals(uncertain.filter((g) => !explicit.includes(g))),
    reasons,
  };
}

function resolveSafety(input: {
  element: Element;
  addressedGoals: AnnualResidualGoal[];
  harm: HarmAssessment;
  corridors: CoreScopedCorridor[];
  structuralOnly: boolean;
  reasons: string[];
}): AnnualCandidateSafety {
  if (input.addressedGoals.length === 0) {
    input.reasons.push("safety:unknown:no-remedy-evidence");
    return "unknown";
  }

  if (!isClimateElement(input.element) && input.addressedGoals.every((g) => g === "CLIMATE_MITIGATION")) {
    input.reasons.push("safety:unknown:non-climate-element-climate-claim");
    return "unknown";
  }

  if (input.harm.explicit.length > 0) {
    input.reasons.push("safety:conflicting:explicit-protected-harm");
    return "conflicting";
  }

  const structuralIncoming = input.addressedGoals.includes("INCOMING_MEDIATION");
  const surfaceCorridor = incomingSurfaceCorridorForMid(
    input.corridors,
    input.element,
  );
  const hiddenOnlyStructural =
    structuralIncoming &&
    !surfaceCorridor &&
    incomingAnyCorridorForMid(input.corridors, input.element);

  if (hiddenOnlyStructural) {
    input.reasons.push("safety:conditional:structural-hidden-leg");
    return "conditional";
  }

  if (input.harm.uncertain.length > 0) {
    input.reasons.push("safety:conditional:protected-impact-uncertain");
    return "conditional";
  }

  if (input.structuralOnly && structuralIncoming && surfaceCorridor) {
    input.reasons.push("safety:clean:structural-surface-corridor-no-harm");
    return "clean";
  }

  if (input.addressedGoals.includes("CORE_SUPPORT")) {
    const signals = input.reasons.some((r) => r.includes("annual-signal"));
    if (signals) {
      input.reasons.push("safety:clean:core-support-signal-no-harm");
      return "clean";
    }
  }

  if (input.addressedGoals.includes("CLIMATE_MITIGATION") && isClimateElement(input.element)) {
    input.reasons.push("safety:clean:climate-mitigation-no-explicit-harm");
    return "clean";
  }

  if (structuralIncoming && surfaceCorridor) {
    input.reasons.push("safety:clean:structural-incoming");
    return "clean";
  }

  input.reasons.push("safety:unknown:insufficient-positive-evidence");
  return "unknown";
}

/**
 * Derive safety for all five elements (or provided candidates).
 */
export function deriveAnnualCandidateSafeties(
  input: DeriveAnnualCandidateSafetiesInput,
): AnnualCandidateSafetyRecord[] {
  const protectedGoals = buildProtectedGoals(input);
  const climateOpen = climateGoalOpen(input);
  const candidateRows: AnnualSafetyCandidateInput[] =
    input.candidates ?? ELEMENTS.map((element) => ({ element }));

  return candidateRows.map(({ element, addressedGoals: presetGoals }) => {
    const reasons: string[] = [`candidate=${element}`];
    reasons.push(`protected=${protectedGoals.join("+") || "none"}`);

    const derived = deriveAddressedGoals({
      element,
      evidence: input.evidence,
      openGoals: input.openGoals,
      corridors: input.corridors,
      natalCore: input.natalCoreState.core,
      natalClimate: input.natalClimate,
      climateOpen,
    });

    const addressedGoals =
      presetGoals !== undefined
        ? uniqueGoals(presetGoals)
        : derived.goals;
    reasons.push(...derived.reasons);
    if (presetGoals !== undefined) {
      reasons.push(`addressed=preset:${addressedGoals.join("+") || "none"}`);
    } else {
      reasons.push(`addressed=${addressedGoals.join("+") || "none"}`);
    }

    const harm = assessHarm({
      element,
      addressedGoals,
      evidence: input.evidence,
      protectedGoals,
      natalCoreState: input.natalCoreState,
      natalClimate: input.natalClimate,
      imbalances: input.imbalances,
      satisfaction: input,
    });
    reasons.push(...harm.reasons);

    const structuralOnly =
      addressedGoals.includes("INCOMING_MEDIATION") &&
      !addressedGoals.includes("CLIMATE_MITIGATION") &&
      !addressedGoals.includes("CORE_SUPPORT");

    const nonClimateClimateAsk =
      !isClimateElement(element) &&
      (input.openGoals.includes("CLIMATE_MITIGATION") || climateOpen);

    let safety: AnnualCandidateSafety;
    if (nonClimateClimateAsk && addressedGoals.length === 0) {
      reasons.push("safety:unknown:wood-earth-metal-climate-not-assessed");
      safety = "unknown";
    } else {
      safety = resolveSafety({
        element,
        addressedGoals,
        harm,
        corridors: input.corridors,
        structuralOnly,
        reasons,
      });
    }

    return {
      element,
      safety,
      protectedGoals,
      conflictingGoals: harm.explicit,
      reasons,
    };
  });
}

/** Map safety records to winner-input rows. Replaces manual protectedHarmElements. */
export function safetiesForWinnerInput(
  records: AnnualCandidateSafetyRecord[],
): { safeties: { element: Element; safety: AnnualCandidateSafety }[]; protectedHarmElements: Element[] } {
  return {
    safeties: records.map((row) => ({
      element: row.element,
      safety: row.safety,
    })),
    protectedHarmElements: records
      .filter((row) => row.safety === "conflicting")
      .map((row) => row.element),
  };
}
