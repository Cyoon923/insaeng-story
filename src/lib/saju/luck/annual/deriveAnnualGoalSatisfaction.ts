/**
 * Derive annual satisfaction of natal deficit goals.
 * No scores, no winner, no imbalance emission.
 */

import type { CoreScopedCorridor } from "@/lib/saju/final/buildCoreScopedCorridors";
import type { CoreElementState } from "@/lib/saju/final/buildCoreElementState";
import type {
  AnnualGoalSatisfaction,
  AnnualLuckEvidence,
  AnnualSatisfyingMethod,
  AnnualSignal,
  AnnualSignalCoherence,
  NatalDeficitGoal,
} from "@/lib/saju/luck/annual/types";
import type {
  AdjustedClimateSummary,
  AdjustedMoistureAxis,
  AdjustedTemperatureAxis,
} from "@/lib/saju/types";

export type DeriveAnnualGoalSatisfactionInput = {
  goals: NatalDeficitGoal[];
  evidence: AnnualLuckEvidence;
  natalCoreState: Pick<CoreElementState, "core" | "presence">;
  natalClimate: AdjustedClimateSummary;
  /** Natal-established corridors; required for INCOMING_MEDIATION contribution. */
  corridors?: CoreScopedCorridor[];
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

function classifySupportCoherence(
  sameSources: AnnualSignal["source"][],
  generateSources: AnnualSignal["source"][],
  harmSources: AnnualSignal["source"][],
): AnnualSignalCoherence {
  if (harmSources.length > 0 && (sameSources.length > 0 || generateSources.length > 0)) {
    return "conflicting";
  }
  const support = [...new Set([...sameSources, ...generateSources])];
  if (support.length === 0) return "none";
  if (support.length === 1) {
    return support[0] === "stem" ? "stem-only" : "branch-main-only";
  }
  return "coherent";
}

function evaluateCoreSupport(input: {
  goal: NatalDeficitGoal;
  signals: AnnualSignal[];
  natalCoreState: Pick<CoreElementState, "core" | "presence">;
}): AnnualGoalSatisfaction {
  const reasons: string[] = ["goal:CORE_SUPPORT"];
  const sameSources: AnnualSignal["source"][] = [];
  const generateSources: AnnualSignal["source"][] = [];
  const harmSources: AnnualSignal["source"][] = [];
  const methods: AnnualSatisfyingMethod[] = [];

  for (const signal of input.signals) {
    if (signal.relationToNatalCore === "same") {
      sameSources.push(signal.source);
      if (!methods.includes("same-to-core")) methods.push("same-to-core");
      reasons.push(`core-support:same:${signal.source}`);
    } else if (signal.relationToNatalCore === "generates") {
      generateSources.push(signal.source);
      if (!methods.includes("generates-core")) methods.push("generates-core");
      reasons.push(`core-support:generates:${signal.source}`);
    } else if (signal.relationToNatalCore === "controls") {
      harmSources.push(signal.source);
      reasons.push(`core-support:controls:${signal.source}`);
    }
  }

  const coherence = classifySupportCoherence(sameSources, generateSources, harmSources);
  reasons.push(`core-support:coherence=${coherence}`);

  if (coherence === "none") {
    reasons.push("core-support:status=not-met");
    return {
      goal: "CORE_SUPPORT",
      status: "not-met",
      satisfyingMethods: [],
      signalCoherence: coherence,
      reasons,
    };
  }

  if (coherence === "conflicting") {
    reasons.push("core-support:status=unknown");
    return {
      goal: "CORE_SUPPORT",
      status: "unknown",
      satisfyingMethods: methods,
      signalCoherence: coherence,
      reasons,
    };
  }

  const natalGenerative = input.goal.methods.includes("generative");
  const rootedVisible = input.natalCoreState.presence === "rooted-visible";
  const onlySame = methods.includes("same-to-core") && !methods.includes("generates-core");

  // Freeze: generative natal + rooted-visible Core + annual same-only → never met.
  if (onlySame && natalGenerative && rootedVisible) {
    reasons.push("core-support:cap=partially-met:generative-natal+rooted-visible+same-only");
    return {
      goal: "CORE_SUPPORT",
      status: "partially-met",
      satisfyingMethods: methods,
      signalCoherence: coherence,
      reasons,
    };
  }

  if (coherence === "stem-only" || coherence === "branch-main-only") {
    reasons.push(`core-support:status=partially-met:${coherence}`);
    return {
      goal: "CORE_SUPPORT",
      status: "partially-met",
      satisfyingMethods: methods,
      signalCoherence: coherence,
      reasons,
    };
  }

  // coherent supportive substitute without the same-only cap.
  reasons.push("core-support:status=met:coherent");
  return {
    goal: "CORE_SUPPORT",
    status: "met",
    satisfyingMethods: methods,
    signalCoherence: coherence,
    reasons,
  };
}

function evaluateIncomingMediation(input: {
  signals: AnnualSignal[];
  corridors: CoreScopedCorridor[];
}): AnnualGoalSatisfaction {
  const reasons: string[] = ["goal:INCOMING_MEDIATION"];

  for (const signal of input.signals) {
    if (signal.relationToNatalCore === "same") {
      reasons.push(`incoming:same-to-core-not-sufficient:${signal.source}`);
    }
  }

  const incoming = input.corridors.filter((row) => row.kind === "incoming-mid");
  if (incoming.length === 0) {
    reasons.push("incoming:no-natal-incoming-corridor");
    reasons.push("incoming:status=not-met");
    return {
      goal: "INCOMING_MEDIATION",
      status: "not-met",
      satisfyingMethods: [],
      signalCoherence: "none",
      reasons,
    };
  }

  const surfaceMids = incoming.filter(
    (row) => row.firstLeg === "surface" && row.secondLeg === "surface",
  );
  if (surfaceMids.length === 0) {
    reasons.push("incoming:no-surface-surface-corridor");
    reasons.push("incoming:status=not-met");
    return {
      goal: "INCOMING_MEDIATION",
      status: "not-met",
      satisfyingMethods: [],
      signalCoherence: "none",
      reasons,
    };
  }

  const midHits: AnnualSignal["source"][] = [];
  for (const corridor of surfaceMids) {
    for (const signal of input.signals) {
      if (signal.element === corridor.mid) {
        midHits.push(signal.source);
        reasons.push(
          `incoming:annual-mid:${signal.source}:${signal.element}`,
        );
      }
    }
  }

  if (midHits.length === 0) {
    reasons.push("incoming:no-annual-mid-evidence");
    reasons.push("incoming:theoretical-relation-forbidden");
    reasons.push("incoming:status=not-met");
    return {
      goal: "INCOMING_MEDIATION",
      status: "not-met",
      satisfyingMethods: [],
      signalCoherence: "none",
      reasons,
    };
  }

  const uniqueSources = [...new Set(midHits)];
  const coherence: AnnualSignalCoherence =
    uniqueSources.length >= 2
      ? "coherent"
      : uniqueSources[0] === "stem"
        ? "stem-only"
        : "branch-main-only";

  if (coherence === "coherent") {
    reasons.push("incoming:status=met");
    return {
      goal: "INCOMING_MEDIATION",
      status: "met",
      satisfyingMethods: ["corridor-mid"],
      signalCoherence: coherence,
      reasons,
    };
  }

  reasons.push(`incoming:status=partially-met:${coherence}`);
  return {
    goal: "INCOMING_MEDIATION",
    status: "partially-met",
    satisfyingMethods: ["corridor-mid"],
    signalCoherence: coherence,
    reasons,
  };
}

function evaluateClimateMitigation(input: {
  evidence: AnnualLuckEvidence;
  natalClimate: AdjustedClimateSummary;
}): AnnualGoalSatisfaction {
  const reasons: string[] = ["goal:CLIMATE_MITIGATION"];
  const { natalClimate, evidence } = input;

  if (!natalClimateUsable(natalClimate)) {
    reasons.push("climate:natal-unusable");
    reasons.push("climate:status=unknown");
    return {
      goal: "CLIMATE_MITIGATION",
      status: "unknown",
      satisfyingMethods: [],
      signalCoherence: "none",
      reasons,
    };
  }

  const warmDry =
    natalClimate.temperature.value === "warm" ||
    natalClimate.moisture.value === "dry";
  const coldMoist =
    natalClimate.temperature.value === "cold" ||
    natalClimate.moisture.value === "moist";

  if (!warmDry && !coldMoist) {
    reasons.push("climate:no-bias");
    reasons.push("climate:status=not-met");
    return {
      goal: "CLIMATE_MITIGATION",
      status: "not-met",
      satisfyingMethods: [],
      signalCoherence: "none",
      reasons,
    };
  }

  const waterSources: AnnualSignal["source"][] = [];
  const fireSources: AnnualSignal["source"][] = [];
  evidence.signals.forEach((signal, index) => {
    const tag = evidence.climateSignals[index];
    if (tag === "water-signal") {
      waterSources.push(signal.source);
      reasons.push(`climate:water-signal:${signal.source}`);
    }
    if (tag === "fire-signal") {
      fireSources.push(signal.source);
      reasons.push(`climate:fire-signal:${signal.source}`);
    }
  });

  const mitigatesWarmDry = warmDry && waterSources.length > 0;
  const mitigatesColdMoist = coldMoist && fireSources.length > 0;
  const reinforcesWarmDry = warmDry && fireSources.length > 0;
  const reinforcesColdMoist = coldMoist && waterSources.length > 0;

  if ((mitigatesWarmDry && reinforcesWarmDry) || (mitigatesColdMoist && reinforcesColdMoist)) {
    reasons.push("climate:mitigation-reinforcement-conflict");
    reasons.push("climate:status=unknown");
    return {
      goal: "CLIMATE_MITIGATION",
      status: "unknown",
      satisfyingMethods: ["climate-fire-water"],
      signalCoherence: "conflicting",
      reasons,
    };
  }

  if (!mitigatesWarmDry && !mitigatesColdMoist) {
    reasons.push("climate:no-mitigating-火水-signal");
    reasons.push("climate:status=not-met");
    return {
      goal: "CLIMATE_MITIGATION",
      status: "not-met",
      satisfyingMethods: [],
      signalCoherence: "none",
      reasons,
    };
  }

  const sources = mitigatesWarmDry ? waterSources : fireSources;
  const unique = [...new Set(sources)];
  const coherence: AnnualSignalCoherence =
    unique.length >= 2
      ? "coherent"
      : unique[0] === "stem"
        ? "stem-only"
        : "branch-main-only";

  if (coherence === "coherent") {
    reasons.push("climate:status=met");
    return {
      goal: "CLIMATE_MITIGATION",
      status: "met",
      satisfyingMethods: ["climate-fire-water"],
      signalCoherence: coherence,
      reasons,
    };
  }

  reasons.push(`climate:status=partially-met:${coherence}`);
  return {
    goal: "CLIMATE_MITIGATION",
    status: "partially-met",
    satisfyingMethods: ["climate-fire-water"],
    signalCoherence: coherence,
    reasons,
  };
}

/**
 * Per natal deficit goal, judge annual substitute satisfaction.
 */
export function deriveAnnualGoalSatisfaction(
  input: DeriveAnnualGoalSatisfactionInput,
): AnnualGoalSatisfaction[] {
  const corridors = input.corridors ?? [];
  const out: AnnualGoalSatisfaction[] = [];

  for (const goal of input.goals) {
    if (goal.kind === "CORE_SUPPORT") {
      out.push(
        evaluateCoreSupport({
          goal,
          signals: input.evidence.signals,
          natalCoreState: input.natalCoreState,
        }),
      );
      continue;
    }
    if (goal.kind === "INCOMING_MEDIATION") {
      out.push(
        evaluateIncomingMediation({
          signals: input.evidence.signals,
          corridors,
        }),
      );
      continue;
    }
    if (goal.kind === "CLIMATE_MITIGATION") {
      out.push(
        evaluateClimateMitigation({
          evidence: input.evidence,
          natalClimate: input.natalClimate,
        }),
      );
    }
  }

  return out;
}
