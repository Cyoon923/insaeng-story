/**
 * Build AnnualWinnerCandidate + openGoals/openImbalances for v2 winner resolver.
 * Does not select a winner. Does not re-implement resolveAnnualSupplementWinnerV2.
 */

import type { AnnualCandidatePolicy } from "@/lib/saju/luck/annual/deriveAnnualCandidatePolicyStates";
import type { CoreScopedCorridor } from "@/lib/saju/final/buildCoreScopedCorridors";
import { elementGenerates } from "@/lib/saju/observation/elementGenerates";
import type {
  AnnualCandidateSafety,
  AnnualElementSafetyInput,
  AnnualEvidenceQuality,
  AnnualGoalSatisfactionInput,
  AnnualImbalanceId,
  AnnualResidualGoal,
  AnnualUnresolvedImbalanceInput,
  AnnualWinnerCandidate,
  AnnualWinnerCandidateState,
  AnnualWinnerResolverInput,
} from "@/lib/saju/luck/annual/types";
import type { Element } from "@/lib/saju/types";
import { ELEMENTS } from "@/lib/saju/types";

export type BuildAnnualWinnerResolverInputArgs = {
  year: number;
  natalCoreElement: Element;
  /** Precomputed goal satisfaction rows (F1∪F2 already collapsed to CORE_SUPPORT). */
  goalSatisfactions: AnnualGoalSatisfactionInput[];
  /** Unresolved imbalances only. */
  unresolvedImbalances: AnnualUnresolvedImbalanceInput[];
  /** Annual A1–A5 policy rows (typically all five elements). */
  policies: AnnualCandidatePolicy[];
  /** Natal Core-scoped corridors (incoming/outgoing). */
  corridors: CoreScopedCorridor[];
  /** Per-element remedy safety. Missing → unknown. Never upgraded to clean. */
  safeties: AnnualElementSafetyInput[];
  /**
   * Elements with explicit protected-state harm evidence.
   * Blocks STRUCTURAL_MEDIATION; does not invent clean safety.
   */
  protectedHarmElements?: Element[];
};

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

const OPEN_SATISFACTION = new Set([
  "partially-met",
  "not-met",
  "unknown",
]);

/**
 * Open blocking goals from satisfaction: met excluded; partial/not-met/unknown kept.
 */
export function buildOpenGoals(
  goalSatisfactions: AnnualGoalSatisfactionInput[],
): AnnualResidualGoal[] {
  const open: AnnualResidualGoal[] = [];
  for (const row of goalSatisfactions) {
    if (!OPEN_SATISFACTION.has(row.status)) continue;
    open.push(row.goal);
  }
  return uniquePreserveOrder(open);
}

function mapImbalanceKind(
  kind: AnnualUnresolvedImbalanceInput["kind"],
): AnnualImbalanceId | null {
  if (kind === "CLIMATE_REINFORCEMENT_RISK") return "NEW_CLIMATE_IMBALANCE";
  if (
    kind === "RESIDUAL_CORE_SUPPORT" ||
    kind === "RESIDUAL_INCOMING_MEDIATION" ||
    kind === "RESIDUAL_CLIMATE_MITIGATION" ||
    kind === "NEW_CLIMATE_IMBALANCE"
  ) {
    return kind;
  }
  return null;
}

/** Map unresolved imbalance inputs onto winner-completeness ids. */
export function buildOpenImbalances(
  unresolvedImbalances: AnnualUnresolvedImbalanceInput[],
): AnnualImbalanceId[] {
  const out: AnnualImbalanceId[] = [];
  for (const row of unresolvedImbalances) {
    const mapped = mapImbalanceKind(row.kind);
    if (mapped === null) continue;
    out.push(mapped);
  }
  return uniquePreserveOrder(out);
}

function safetyMap(
  safeties: AnnualElementSafetyInput[],
): Map<Element, AnnualCandidateSafety> {
  const map = new Map<Element, AnnualCandidateSafety>();
  for (const row of safeties) {
    map.set(row.element, row.safety);
  }
  return map;
}

function policyMap(
  policies: AnnualCandidatePolicy[],
): Map<Element, AnnualCandidatePolicy> {
  const map = new Map<Element, AnnualCandidatePolicy>();
  for (const row of policies) {
    map.set(row.element, row);
  }
  return map;
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

/** Structural open residuals eligible for STRUCTURAL_MEDIATION (climate excluded). */
function hasOpenStructuralResidual(openGoals: AnnualResidualGoal[]): boolean {
  return openGoals.includes("INCOMING_MEDIATION");
}

const QUALITY_RANK: Record<AnnualEvidenceQuality, number> = {
  direct: 0,
  generative: 1,
  "structural-mediation": 2,
  "climate-mitigation": 3,
};

function bestQuality(
  qualities: AnnualEvidenceQuality[],
): AnnualEvidenceQuality {
  let best: AnnualEvidenceQuality = qualities[0] ?? "direct";
  for (const q of qualities) {
    if (QUALITY_RANK[q] < QUALITY_RANK[best]) best = q;
  }
  return best;
}

function resolveStateFromParts(input: {
  policy: AnnualCandidatePolicy | undefined;
  hasStructuralMediation: boolean;
  safety: AnnualCandidateSafety;
}): AnnualWinnerCandidateState {
  const hasCautionFunctions =
    (input.policy?.cautionFunctions.length ?? 0) > 0;
  const hasPolicyPositive =
    (input.policy?.positiveFunctions.length ?? 0) > 0;
  const hasPositive =
    hasPolicyPositive || input.hasStructuralMediation;
  const safetyAllowsActive = input.safety === "clean";

  // Never promote conditional/conflicting/unknown to clean ACTIVE.
  if (hasPositive && !hasCautionFunctions && safetyAllowsActive) {
    return "ACTIVE";
  }
  if (hasPositive || hasCautionFunctions || input.policy?.state === "CAUTION") {
    return "CAUTION";
  }
  return "INACTIVE";
}

/**
 * Assemble one winner candidate. STRUCTURAL_MEDIATION is additive evidence only.
 */
function buildOneCandidate(input: {
  element: Element;
  natalCoreElement: Element;
  openGoals: AnnualResidualGoal[];
  policy: AnnualCandidatePolicy | undefined;
  corridors: CoreScopedCorridor[];
  safety: AnnualCandidateSafety;
  protectedHarm: Set<Element>;
  reasons: string[];
}): AnnualWinnerCandidate {
  const { element, natalCoreElement, openGoals, policy, corridors, safety } =
    input;
  const goals: AnnualResidualGoal[] = [];
  const qualities: AnnualEvidenceQuality[] = [];
  let hasStructuralMediation = false;

  // CORE_SUPPORT: direct / generative (not natal-Supplement identity).
  if (openGoals.includes("CORE_SUPPORT")) {
    if (element === natalCoreElement) {
      goals.push("CORE_SUPPORT");
      qualities.push("direct");
      input.reasons.push(`${element}:core-support:direct`);
    } else if (elementGenerates(element, natalCoreElement)) {
      goals.push("CORE_SUPPORT");
      qualities.push("generative");
      input.reasons.push(`${element}:core-support:generative`);
    }
  }

  // CLIMATE from A4 positive only — never mark 木土金 as climate remedy.
  if (
    openGoals.includes("CLIMATE_MITIGATION") &&
    policy?.positiveFunctions.includes("A4_CLIMATE_MITIGATION")
  ) {
    goals.push("CLIMATE_MITIGATION");
    qualities.push("climate-mitigation");
    input.reasons.push(`${element}:climate-mitigation:a4`);
  }

  // STRUCTURAL_MEDIATION → INCOMING_MEDIATION only.
  if (hasOpenStructuralResidual(openGoals)) {
    const corridor = incomingSurfaceCorridorForMid(corridors, element);
    if (!corridor) {
      input.reasons.push(`${element}:structural:skip:no-surface-incoming`);
    } else if (input.protectedHarm.has(element)) {
      input.reasons.push(`${element}:structural:skip:protected-harm`);
    } else {
      hasStructuralMediation = true;
      goals.push("INCOMING_MEDIATION");
      qualities.push("structural-mediation");
      input.reasons.push(
        `${element}:structural-mediation:incoming-surface-surface`,
      );
    }
  } else if (openGoals.includes("CLIMATE_MITIGATION") && !openGoals.includes("INCOMING_MEDIATION")) {
    input.reasons.push(`${element}:structural:skip:climate-only-open`);
  }

  const residualGoalsAddressed = uniquePreserveOrder(goals);
  const state = resolveStateFromParts({
    policy,
    hasStructuralMediation,
    safety,
  });

  // Climate-only open must not attach structural goal; already gated.
  // Non-fire/water never get climate from A4 (policy won't have A4).

  return {
    element,
    state,
    safety,
    residualGoalsAddressed,
    evidenceQuality: bestQuality(qualities),
  };
}

/**
 * Build winner-resolver input from satisfaction, imbalances, policies, corridors.
 */
export function buildAnnualWinnerResolverInput(
  args: BuildAnnualWinnerResolverInputArgs,
): AnnualWinnerResolverInput {
  const reasons: string[] = [`year=${args.year}`, "builder:annual-winner-input-v2"];
  const openGoals = buildOpenGoals(args.goalSatisfactions);
  const openImbalances = buildOpenImbalances(args.unresolvedImbalances);
  reasons.push(`open-goals=${openGoals.join("+") || "none"}`);
  reasons.push(`open-imbalances=${openImbalances.join("+") || "none"}`);

  const safeties = safetyMap(args.safeties);
  const policies = policyMap(args.policies);
  const protectedHarm = new Set(args.protectedHarmElements ?? []);

  const candidates: AnnualWinnerCandidate[] = ELEMENTS.map((element) => {
    const safety = safeties.get(element) ?? "unknown";
    if (!safeties.has(element)) {
      reasons.push(`${element}:safety:default-unknown`);
    }
    return buildOneCandidate({
      element,
      natalCoreElement: args.natalCoreElement,
      openGoals,
      policy: policies.get(element),
      corridors: args.corridors,
      safety,
      protectedHarm,
      reasons,
    });
  });

  for (const row of candidates) {
    reasons.push(
      `candidate=${row.element}:state=${row.state}:safety=${row.safety}:goals=${row.residualGoalsAddressed.join("+") || "none"}:quality=${row.evidenceQuality}`,
    );
  }

  return { candidates, openGoals, openImbalances, reasons };
}
