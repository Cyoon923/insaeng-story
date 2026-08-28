/**
 * Derive annual imbalances from goal satisfaction + annual evidence.
 * No winner, no scores, no GENERATION_FLOW_SHIFT (v2 excluded).
 */

import type { CoreElementState } from "@/lib/saju/final/buildCoreElementState";
import type {
  AnnualGoalSatisfaction,
  AnnualImbalance,
  AnnualLuckEvidence,
  AnnualResidualGoal,
} from "@/lib/saju/luck/annual/types";
import type {
  AdjustedClimateSummary,
  AdjustedMoistureAxis,
  AdjustedTemperatureAxis,
  Element,
} from "@/lib/saju/types";

export type DeriveAnnualImbalancesInput = {
  goalSatisfaction: AnnualGoalSatisfaction[];
  evidence: AnnualLuckEvidence;
  natalCoreState: Pick<CoreElementState, "core" | "presence">;
  natalClimate: AdjustedClimateSummary;
  natalSupplementElement: Element | null;
};

const BLOCKED_CLIMATE_OUTCOMES = new Set([
  "partially-mitigated",
  "mitigation-reinforcement-conflict",
  "unresolved",
]);

function axisUsable(axis: AdjustedTemperatureAxis | AdjustedMoistureAxis): boolean {
  if (axis.status !== "resolved") return false;
  if (BLOCKED_CLIMATE_OUTCOMES.has(axis.outcome)) return false;
  return true;
}

function natalClimateUsable(climate: AdjustedClimateSummary): boolean {
  return axisUsable(climate.temperature) && axisUsable(climate.moisture);
}

function satisfactionByGoal(
  rows: AnnualGoalSatisfaction[],
): Map<AnnualResidualGoal, AnnualGoalSatisfaction> {
  const map = new Map<AnnualResidualGoal, AnnualGoalSatisfaction>();
  for (const row of rows) {
    map.set(row.goal, row);
  }
  return map;
}

function pushResidual(
  out: AnnualImbalance[],
  row: AnnualGoalSatisfaction | undefined,
  kind: AnnualImbalance["kind"],
  goal: AnnualResidualGoal,
): void {
  if (!row) return;
  if (row.status === "met") return;
  if (row.status === "unknown") {
    out.push({
      kind: "UNKNOWN",
      origin: "unknown",
      relatedGoalKind: goal,
      evidence: [`residual:${kind}:from-unknown-satisfaction`, ...row.reasons],
    });
    return;
  }
  // not-met | partially-met
  out.push({
    kind,
    origin: "residual-natal-goal",
    relatedGoalKind: goal,
    evidence: [`residual:${kind}:status=${row.status}`, ...row.reasons],
  });
}

function hasSameToCore(evidence: AnnualLuckEvidence): boolean {
  return evidence.signals.some((s) => s.relationToNatalCore === "same");
}

function climateReinforcementRisk(
  evidence: AnnualLuckEvidence,
  climate: AdjustedClimateSummary,
): AnnualImbalance | null {
  if (!natalClimateUsable(climate)) return null;

  const warmDry =
    climate.temperature.value === "warm" || climate.moisture.value === "dry";
  const coldMoist =
    climate.temperature.value === "cold" || climate.moisture.value === "moist";

  const hasFire = evidence.climateSignals.includes("fire-signal");
  const hasWater = evidence.climateSignals.includes("water-signal");

  // Require usable bias + matching annual 火/水 signal (A5-aligned).
  if (warmDry && hasFire) {
    return {
      kind: "CLIMATE_REINFORCEMENT_RISK",
      origin: "new-annual",
      relatedGoalKind: "CLIMATE_MITIGATION",
      evidence: [
        "climate-risk:warm-or-dry",
        "climate-risk:annual-fire-signal",
        `climate-risk:temp=${climate.temperature.value}`,
        `climate-risk:moist=${climate.moisture.value}`,
      ],
    };
  }
  if (coldMoist && hasWater) {
    return {
      kind: "CLIMATE_REINFORCEMENT_RISK",
      origin: "new-annual",
      relatedGoalKind: "CLIMATE_MITIGATION",
      evidence: [
        "climate-risk:cold-or-moist",
        "climate-risk:annual-water-signal",
        `climate-risk:temp=${climate.temperature.value}`,
        `climate-risk:moist=${climate.moisture.value}`,
      ],
    };
  }
  return null;
}

function coreReinforcementRisk(input: {
  evidence: AnnualLuckEvidence;
  natalCoreState: Pick<CoreElementState, "core" | "presence">;
  coreSupport: AnnualGoalSatisfaction | undefined;
}): AnnualImbalance | null {
  // Same-to-Core alone is not enough.
  if (!hasSameToCore(input.evidence)) return null;
  if (input.natalCoreState.presence !== "rooted-visible") return null;
  if (!input.coreSupport) return null;
  if (
    input.coreSupport.status !== "met" &&
    input.coreSupport.status !== "partially-met"
  ) {
    return null;
  }

  return {
    kind: "CORE_REINFORCEMENT_RISK",
    origin: "new-annual",
    relatedGoalKind: "CORE_SUPPORT",
    evidence: [
      "core-risk:same-to-core",
      "core-risk:presence=rooted-visible",
      `core-risk:core-support=${input.coreSupport.status}`,
    ],
  };
}

function supplementDrainShift(input: {
  evidence: AnnualLuckEvidence;
  natalSupplementElement: Element | null;
}): AnnualImbalance | null {
  if (input.natalSupplementElement === null) return null;

  const hits: string[] = [];
  for (const signal of input.evidence.signals) {
    const rel = signal.relationToNatalSupplement;
    if (rel === null) continue;
    // S生 annual (annual generated-by S) or annual controls S
    if (rel === "generated-by") {
      hits.push(`drain:generated-by-supp:${signal.source}`);
    } else if (rel === "controls") {
      hits.push(`drain:controls-supp:${signal.source}`);
    }
  }

  if (hits.length === 0) return null;

  return {
    kind: "SUPPLEMENT_DRAIN_SHIFT",
    origin: "new-annual",
    evidence: [
      `drain:natal-supplement=${input.natalSupplementElement}`,
      ...hits,
    ],
  };
}

/**
 * Build unresolved / new annual imbalances from satisfaction + evidence.
 */
export function deriveAnnualImbalances(
  input: DeriveAnnualImbalancesInput,
): AnnualImbalance[] {
  const byGoal = satisfactionByGoal(input.goalSatisfaction);
  const out: AnnualImbalance[] = [];

  pushResidual(
    out,
    byGoal.get("CORE_SUPPORT"),
    "RESIDUAL_CORE_SUPPORT",
    "CORE_SUPPORT",
  );
  pushResidual(
    out,
    byGoal.get("INCOMING_MEDIATION"),
    "RESIDUAL_INCOMING_MEDIATION",
    "INCOMING_MEDIATION",
  );
  pushResidual(
    out,
    byGoal.get("CLIMATE_MITIGATION"),
    "RESIDUAL_CLIMATE_MITIGATION",
    "CLIMATE_MITIGATION",
  );

  const climateRisk = climateReinforcementRisk(
    input.evidence,
    input.natalClimate,
  );
  if (climateRisk) out.push(climateRisk);

  const coreRisk = coreReinforcementRisk({
    evidence: input.evidence,
    natalCoreState: input.natalCoreState,
    coreSupport: byGoal.get("CORE_SUPPORT"),
  });
  if (coreRisk) out.push(coreRisk);

  const drain = supplementDrainShift({
    evidence: input.evidence,
    natalSupplementElement: input.natalSupplementElement,
  });
  if (drain) out.push(drain);

  return out;
}
