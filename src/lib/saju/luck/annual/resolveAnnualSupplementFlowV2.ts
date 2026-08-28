/**
 * Orchestrate Annual Supplement v2 pipeline end-to-end.
 * Wires existing frozen helpers only — no new policy, no v1 mutation.
 */

import { buildAnnualLuckEvidence } from "@/lib/saju/luck/annual/buildAnnualLuckEvidence";
import { buildAnnualTarget } from "@/lib/saju/luck/annual/buildAnnualTarget";
import {
  buildAnnualWinnerResolverInput,
  buildOpenGoals,
} from "@/lib/saju/luck/annual/buildAnnualWinnerResolverInput";
import {
  deriveAnnualCandidateSafeties,
  safetiesForWinnerInput,
} from "@/lib/saju/luck/annual/deriveAnnualCandidateSafeties";
import {
  deriveAnnualCandidatePolicyStates,
  type AnnualCandidatePolicy,
} from "@/lib/saju/luck/annual/deriveAnnualCandidatePolicyStates";
import { deriveAnnualGoalSatisfaction } from "@/lib/saju/luck/annual/deriveAnnualGoalSatisfaction";
import { deriveAnnualImbalances } from "@/lib/saju/luck/annual/deriveAnnualImbalances";
import { deriveNatalDeficitGoals } from "@/lib/saju/luck/annual/deriveNatalDeficitGoals";
import { resolveAnnualSupplementWinnerV2 } from "@/lib/saju/luck/annual/resolveAnnualSupplementWinnerV2";
import type { CoreScopedCorridor } from "@/lib/saju/final/buildCoreScopedCorridors";
import type { CoreElementState } from "@/lib/saju/final/buildCoreElementState";
import type { SupplementCandidatePolicy } from "@/lib/saju/final/deriveSupplementCandidatePolicyStates";
import type { Certainty } from "@/lib/saju/final/types";
import type {
  AnnualCandidateSafetyRecord,
  AnnualGoalSatisfaction,
  AnnualGoalSatisfactionInput,
  AnnualImbalance,
  AnnualImbalanceId,
  AnnualLuckEvidence,
  AnnualResidualGoal,
  AnnualTarget,
  AnnualUnresolvedImbalanceInput,
  AnnualWinnerCandidate,
  AnnualWinnerResolverInput,
  NatalDeficitGoal,
} from "@/lib/saju/luck/annual/types";
import type { AdjustedClimateSummary, Element, NeedResolution } from "@/lib/saju/types";

export type ResolveAnnualSupplementFlowV2Input = {
  year: number;
  natalCoreElement: Element | null;
  natalCoreCertainty: Certainty;
  natalSupplementElement: Element | null;
  natalSupplementStatus: "resolved" | "unresolved";
  natalPolicies: SupplementCandidatePolicy[];
  natalCorridors: CoreScopedCorridor[];
  natalCoreState: CoreElementState | null;
  natalClimate: AdjustedClimateSummary;
  needResolution?: NeedResolution;
};

export type AnnualSupplementFlowV2WinnerInput = Pick<
  AnnualWinnerResolverInput,
  "candidates" | "openGoals" | "openImbalances"
>;

export type AnnualSupplementFlowV2Resolution = {
  year: number;
  annualStemBranch: string | null;
  annualSupplementElement: Element | null;
  status: "resolved" | "partial" | "unresolved";
  unresolvedGoals: AnnualResidualGoal[];
  unresolvedImbalances: AnnualImbalanceId[];
  reasons: string[];
};

export type AnnualSupplementFlowV2 = {
  target: AnnualTarget | null;
  evidence: AnnualLuckEvidence | null;
  natalGoals: NatalDeficitGoal[];
  goalSatisfactions: AnnualGoalSatisfaction[];
  imbalances: AnnualImbalance[];
  candidatePolicies: AnnualCandidatePolicy[];
  safeties: AnnualCandidateSafetyRecord[];
  winnerInput: AnnualSupplementFlowV2WinnerInput | null;
  resolution: AnnualSupplementFlowV2Resolution;
};

function coreBlocksAnnual(input: ResolveAnnualSupplementFlowV2Input): boolean {
  return (
    input.natalCoreElement === null ||
    input.natalCoreState === null ||
    input.natalCoreCertainty === "unresolved"
  );
}

function skippedFlow(input: ResolveAnnualSupplementFlowV2Input): AnnualSupplementFlowV2 {
  const skipReason =
    input.natalCoreCertainty === "unresolved"
      ? "flow:skip:natal-core-certainty-unresolved"
      : input.natalCoreState === null
        ? "flow:skip:natal-core-state-null"
        : "flow:skip:natal-core-element-null";

  const reasons = [
    "annual-scope:year-luck-only",
    skipReason,
    "flow:natal-core-unresolved-skips-annual-pipeline-v2",
  ];

  if (input.needResolution?.decisionBlockedBy.includes("climate-need-contested-inherited")) {
    reasons.push("trace:need:climate-need-contested-inherited");
  }

  return {
    target: null,
    evidence: null,
    natalGoals: [],
    goalSatisfactions: [],
    imbalances: [],
    candidatePolicies: [],
    safeties: [],
    winnerInput: null,
    resolution: {
      year: input.year,
      annualStemBranch: null,
      annualSupplementElement: null,
      status: "unresolved",
      unresolvedGoals: [],
      unresolvedImbalances: [],
      reasons,
    },
  };
}

function toGoalSatisfactionInput(
  rows: AnnualGoalSatisfaction[],
): AnnualGoalSatisfactionInput[] {
  return rows.map((row) => ({ goal: row.goal, status: row.status }));
}

function toUnresolvedImbalanceInput(
  rows: AnnualImbalance[],
): AnnualUnresolvedImbalanceInput[] {
  return rows.map((row) => ({
    kind: row.kind as AnnualUnresolvedImbalanceInput["kind"],
  }));
}

/**
 * Run frozen Annual Supplement v2 pipeline after natal Core/Supplement baseline.
 */
export function resolveAnnualSupplementFlowV2(
  input: ResolveAnnualSupplementFlowV2Input,
): AnnualSupplementFlowV2 {
  if (coreBlocksAnnual(input)) {
    return skippedFlow(input);
  }

  const natalCoreElement = input.natalCoreElement!;
  const natalCoreState = input.natalCoreState!;

  const target = buildAnnualTarget(input.year);
  const evidence = buildAnnualLuckEvidence({
    target,
    natalCoreElement,
    natalSupplementElement: input.natalSupplementElement,
  });

  const natalGoals = deriveNatalDeficitGoals({
    natalCoreElement,
    natalSupplementElement: input.natalSupplementElement,
    natalSupplementStatus: input.natalSupplementStatus,
    natalPolicies: input.natalPolicies,
    natalCorridors: input.natalCorridors,
    natalClimate: input.natalClimate,
  });

  const goalSatisfactions = deriveAnnualGoalSatisfaction({
    goals: natalGoals,
    evidence,
    natalCoreState,
    natalClimate: input.natalClimate,
    corridors: input.natalCorridors,
  });

  const imbalances = deriveAnnualImbalances({
    goalSatisfaction: goalSatisfactions,
    evidence,
    natalCoreState,
    natalClimate: input.natalClimate,
    natalSupplementElement: input.natalSupplementElement,
  });

  const candidatePolicies = deriveAnnualCandidatePolicyStates({
    evidence,
    natalCoreElement,
    natalSupplementElement: input.natalSupplementElement,
    natalClimate: input.natalClimate,
  });

  const goalSatisfactionInput = toGoalSatisfactionInput(goalSatisfactions);
  const openGoals = buildOpenGoals(goalSatisfactionInput);

  const safeties = deriveAnnualCandidateSafeties({
    openGoals,
    imbalances,
    goalSatisfactions: goalSatisfactionInput,
    natalCoreState,
    natalClimate: input.natalClimate,
    evidence,
    corridors: input.natalCorridors,
  });

  const { safeties: safetyRows, protectedHarmElements } =
    safetiesForWinnerInput(safeties);

  const winnerInputBuilt = buildAnnualWinnerResolverInput({
    year: input.year,
    natalCoreElement,
    goalSatisfactions: goalSatisfactionInput,
    unresolvedImbalances: toUnresolvedImbalanceInput(imbalances),
    policies: candidatePolicies,
    corridors: input.natalCorridors,
    safeties: safetyRows,
    protectedHarmElements,
  });

  const winner = resolveAnnualSupplementWinnerV2({
    year: input.year,
    candidates: winnerInputBuilt.candidates,
    openGoals: winnerInputBuilt.openGoals,
    openImbalances: winnerInputBuilt.openImbalances,
  });

  const reasons: string[] = ["annual-scope:year-luck-only"];

  reasons.push(...evidence.reasons.map((line) => `evidence:${line}`));

  for (const goal of natalGoals) {
    reasons.push(
      `natal-goal:${goal.kind}:source=${goal.sourceElement}:functions=${goal.sourceFunctions.join("+")}`,
    );
  }

  for (const row of goalSatisfactions) {
    reasons.push(`satisfaction:${row.goal}:${row.status}`);
  }

  for (const row of imbalances) {
    reasons.push(`imbalance:${row.kind}:origin=${row.origin}`);
  }

  for (const row of candidatePolicies) {
    for (const line of row.reasons) {
      reasons.push(`policy:${row.element}:${line}`);
    }
    reasons.push(
      `policy:${row.element}:state=${row.state}:positive=${row.positiveFunctions.join("+") || "none"}`,
    );
  }

  for (const row of safeties) {
    reasons.push(`safety:${row.element}:${row.safety}`);
  }

  reasons.push(...winnerInputBuilt.reasons.map((line) => `winner-input:${line}`));
  reasons.push(...winner.reasons.map((line) => `winner:${line}`));

  if (input.needResolution?.decisionBlockedBy.includes("climate-need-contested-inherited")) {
    reasons.push("trace:need:climate-need-contested-inherited");
  }

  const winnerInput: AnnualSupplementFlowV2WinnerInput = {
    candidates: winnerInputBuilt.candidates,
    openGoals: winnerInputBuilt.openGoals,
    openImbalances: winnerInputBuilt.openImbalances,
  };

  return {
    target,
    evidence,
    natalGoals,
    goalSatisfactions,
    imbalances,
    candidatePolicies,
    safeties,
    winnerInput,
    resolution: {
      year: input.year,
      annualStemBranch: `${target.stem}${target.branch}`,
      annualSupplementElement: winner.annualSupplementElement,
      status: winner.status,
      unresolvedGoals: winner.unresolvedGoals,
      unresolvedImbalances: winner.unresolvedImbalances,
      reasons,
    },
  };
}
