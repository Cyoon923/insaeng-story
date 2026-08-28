/**
 * Orchestrate AnnualTarget → LuckEvidence → policies → winner.
 * No re-judgment of A1–A5, no natal/FourPillars mutation, no fallbacks.
 */

import { buildAnnualLuckEvidence } from "@/lib/saju/luck/annual/buildAnnualLuckEvidence";
import { buildAnnualTarget } from "@/lib/saju/luck/annual/buildAnnualTarget";
import {
  deriveAnnualCandidatePolicyStates,
  type AnnualCandidatePolicy,
} from "@/lib/saju/luck/annual/deriveAnnualCandidatePolicyStates";
import { resolveAnnualSupplementElement } from "@/lib/saju/luck/annual/resolveAnnualSupplementElement";
import type {
  AnnualLuckEvidence,
  AnnualTarget,
} from "@/lib/saju/luck/annual/types";
import type { Certainty } from "@/lib/saju/final/types";
import type { AdjustedClimateSummary, Element } from "@/lib/saju/types";

export type ResolveAnnualSupplementFlowInput = {
  year: number;
  natalCoreElement: Element | null;
  natalCoreCertainty: Certainty;
  natalSupplementElement: Element | null;
  natalClimate: AdjustedClimateSummary;
};

export type AnnualSupplementResolution = {
  year: number;
  annualStemBranch: string;
  annualSupplementElement: Element | null;
  status: "resolved" | "unresolved";
  natalCoreElement: Element | null;
  natalSupplementElement: Element | null;
  reasons: string[];
};

export type AnnualSupplementFlow = {
  target: AnnualTarget | null;
  evidence: AnnualLuckEvidence | null;
  policies: AnnualCandidatePolicy[];
  resolution: AnnualSupplementResolution;
};

function coreBlocksAnnual(
  natalCoreElement: Element | null,
  natalCoreCertainty: Certainty,
): boolean {
  return natalCoreCertainty === "unresolved" || natalCoreElement === null;
}

function skippedFlow(input: ResolveAnnualSupplementFlowInput, skipReason: string): AnnualSupplementFlow {
  const reasons = [
    "annual-scope:year-luck-only",
    skipReason,
    "flow:natal-core-unresolved-skips-annual-pipeline",
  ];
  return {
    target: null,
    evidence: null,
    policies: [],
    resolution: {
      year: input.year,
      annualStemBranch: "",
      annualSupplementElement: null,
      status: "unresolved",
      natalCoreElement: input.natalCoreElement,
      natalSupplementElement: input.natalSupplementElement,
      reasons,
    },
  };
}

/**
 * Run frozen annual supplement pipeline after natal Core/Supplement baseline.
 */
export function resolveAnnualSupplementFlow(
  input: ResolveAnnualSupplementFlowInput,
): AnnualSupplementFlow {
  const {
    year,
    natalCoreElement,
    natalCoreCertainty,
    natalSupplementElement,
    natalClimate,
  } = input;

  if (coreBlocksAnnual(natalCoreElement, natalCoreCertainty)) {
    const skipReason =
      natalCoreCertainty === "unresolved"
        ? "flow:skip:natal-core-certainty-unresolved"
        : "flow:skip:natal-core-element-null";
    return skippedFlow(input, skipReason);
  }

  // coreBlocksAnnual 가드가 null을 이미 걸러냈다 (V2 흐름과 동일한 non-null 계약).
  const resolvedNatalCore = natalCoreElement!;

  const target = buildAnnualTarget(year);
  const evidence = buildAnnualLuckEvidence({
    target,
    natalCoreElement: resolvedNatalCore,
    natalSupplementElement,
  });
  const policies = deriveAnnualCandidatePolicyStates({
    evidence,
    natalCoreElement: resolvedNatalCore,
    natalSupplementElement,
    natalClimate,
  });
  const winner = resolveAnnualSupplementElement({ year, policies });

  const reasons = [
    "annual-scope:year-luck-only",
    ...evidence.reasons,
    ...policies.flatMap((row) =>
      row.reasons.map((line) => `policy:${row.element}:${line}`),
    ),
    ...winner.reasons.map((line) => `winner:${line}`),
  ];

  return {
    target,
    evidence,
    policies,
    resolution: {
      year,
      annualStemBranch: `${target.stem}${target.branch}`,
      annualSupplementElement: winner.annualSupplementElement,
      status: winner.status,
      natalCoreElement,
      natalSupplementElement,
      reasons,
    },
  };
}
