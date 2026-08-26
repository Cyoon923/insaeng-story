/**
 * Orchestrate Core → Supplement pipeline. No re-judgment or fallbacks.
 */

import {
  buildCoreElementState,
  type CoreElementState,
} from "@/lib/saju/final/buildCoreElementState";
import {
  buildCoreScopedCorridors,
  type CoreScopedCorridor,
} from "@/lib/saju/final/buildCoreScopedCorridors";
import {
  buildSupplementCandidateStates,
  type SupplementCandidateState,
} from "@/lib/saju/final/buildSupplementCandidateStates";
import {
  deriveSupplementCandidatePolicyStates,
  type SupplementCandidatePolicy,
} from "@/lib/saju/final/deriveSupplementCandidatePolicyStates";
import { resolveCoreAndSupplement } from "@/lib/saju/final/resolveCoreAndSupplement";
import { resolveSupplementElement } from "@/lib/saju/final/resolveSupplementElement";
import type {
  CoreAndSupplementResolution,
  FinalResolution,
} from "@/lib/saju/final/types";
import type { StrengthObservations } from "@/lib/saju/observation/types";
import type {
  AdjustedClimateSummary,
  FourPillars,
  NeedResolution,
} from "@/lib/saju/types";

export type ResolveSupplementFlowInput = {
  pillars: FourPillars;
  finalResolution: FinalResolution;
  observations: StrengthObservations;
  climate: AdjustedClimateSummary;
  needResolution?: NeedResolution;
};

export type ResolveSupplementFlowResult = {
  resolution: CoreAndSupplementResolution;
  coreState: CoreElementState | null;
  candidateStates: SupplementCandidateState[];
  corridors: CoreScopedCorridor[];
  policies: SupplementCandidatePolicy[];
};

/**
 * Run the frozen Supplement pipeline after FER FinalResolution.
 * Orchestration only — delegates all judgments to existing helpers.
 */
export function resolveSupplementFlow(
  input: ResolveSupplementFlowInput,
): ResolveSupplementFlowResult {
  const { pillars, finalResolution, observations, climate, needResolution } = input;

  const coreUnresolved =
    finalResolution.certainty === "unresolved" || finalResolution.finalElement === null;

  if (coreUnresolved) {
    const resolution = resolveCoreAndSupplement({
      finalResolution,
      supplementResolution: {
        supplementElement: null,
        status: "unresolved",
        reasons: ["flow:core-unresolved-skips-supplement-pipeline"],
      },
    });

    return {
      resolution,
      coreState: null,
      candidateStates: [],
      corridors: [],
      policies: [],
    };
  }

  const core = finalResolution.finalElement;

  const coreState = buildCoreElementState({
    pillars,
    core,
    observations,
  });

  const candidateStates = buildSupplementCandidateStates({
    pillars,
    coreState,
    observations,
  });

  const corridors = buildCoreScopedCorridors({
    core,
    observations,
  });

  const policies = deriveSupplementCandidatePolicyStates({
    coreState,
    candidateStates,
    corridors,
    climate,
    needResolution,
  });

  const supplementResolution = resolveSupplementElement({
    core,
    policies,
  });

  const resolution = resolveCoreAndSupplement({
    finalResolution,
    supplementResolution,
  });

  return {
    resolution,
    coreState,
    candidateStates,
    corridors,
    policies,
  };
}
