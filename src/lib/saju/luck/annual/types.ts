/**
 * Annual luck (세운) evidence contracts — natal FourPillars are never mutated.
 * No annualSupplement winner / A1–A5 / scores.
 */

import type { Branch, Element, Stem } from "@/lib/saju/types";

/** Contract aliases matching stem/branch vocabulary. */
export type HeavenlyStem = Stem;
export type EarthlyBranch = Branch;

export type AnnualBoundaryBasis = "lichun-kst";

export type AnnualLuckKind = "annual-year";

export type AnnualTarget = {
  luckKind: AnnualLuckKind;
  year: number;
  stem: HeavenlyStem;
  branch: EarthlyBranch;
  stemElement: Element;
  branchMainElement: Element;
  boundaryBasis: AnnualBoundaryBasis;
  /** Inclusive: lichun(year) as KST → UTC Date. */
  windowStart: Date;
  /** Exclusive end bound as Date of lichun(year+1) (equals next year's windowStart). */
  windowEnd: Date;
};

export type AnnualRelationKind =
  | "same"
  | "generates"
  | "generated-by"
  | "controls"
  | "controlled-by";

export type AnnualSignalSource = "stem" | "branch-main";

export type AnnualSignal = {
  source: AnnualSignalSource;
  element: Element;
  relationToNatalCore: AnnualRelationKind;
  relationToNatalSupplement: AnnualRelationKind | null;
};

/** Per-signal climate tag. Not mitigation/reinforcement judgment. */
export type AnnualClimateSignal = "fire-signal" | "water-signal" | "none";

export type AnnualLuckEvidence = {
  target: AnnualTarget;
  signals: AnnualSignal[];
  climateSignals: AnnualClimateSignal[];
  reasons: string[];
};

export type BuildAnnualLuckEvidenceInput = {
  target: AnnualTarget;
  natalCoreElement: Element;
  natalSupplementElement: Element | null;
};

/** Blocking residual / goal kinds for Annual Supplement v2 winner resolution. */
export type AnnualResidualGoal =
  | "CORE_SUPPORT"
  | "INCOMING_MEDIATION"
  | "CLIMATE_MITIGATION";

/** Imbalance identifiers tracked beside selection (completeness). */
export type AnnualImbalanceId =
  | "RESIDUAL_CORE_SUPPORT"
  | "RESIDUAL_INCOMING_MEDIATION"
  | "RESIDUAL_CLIMATE_MITIGATION"
  | "NEW_CLIMATE_IMBALANCE";

export type AnnualCandidateSafety =
  | "clean"
  | "conditional"
  | "conflicting"
  | "unknown";

/**
 * Same-goal evidence quality band. Cross-goal fixed precedence is forbidden.
 * Lower rank index = stronger within one shared goal.
 */
export type AnnualEvidenceQuality =
  | "direct"
  | "generative"
  | "structural-mediation"
  | "climate-mitigation";

export type AnnualWinnerCandidateState = "ACTIVE" | "CAUTION" | "INACTIVE";

/**
 * Pre-classified winner input row. Does not re-derive A1–A5 / corridors.
 * Coverage uses residualGoalsAddressed (not function counts).
 */
export type AnnualWinnerCandidate = {
  element: Element;
  state: AnnualWinnerCandidateState;
  safety: AnnualCandidateSafety;
  /** Distinct residual goals this candidate safely addresses. */
  residualGoalsAddressed: AnnualResidualGoal[];
  /** Quality band for same-goal narrowing only. */
  evidenceQuality: AnnualEvidenceQuality;
};

export type AnnualSupplementWinnerStatus =
  | "resolved"
  | "partial"
  | "unresolved";

export type AnnualSupplementWinnerResolution = {
  annualSupplementElement: Element | null;
  status: AnnualSupplementWinnerStatus;
  unresolvedGoals: AnnualResidualGoal[];
  unresolvedImbalances: AnnualImbalanceId[];
  reasons: string[];
};

/** Natal deficit goal satisfaction row (precomputed; builder does not re-score). */
export type AnnualGoalSatisfactionStatus =
  | "met"
  | "partially-met"
  | "not-met"
  | "unknown";

export type AnnualGoalSatisfactionInput = {
  goal: AnnualResidualGoal;
  status: AnnualGoalSatisfactionStatus;
};

/**
 * Unresolved imbalance kinds accepted by the winner-input builder.
 * CLIMATE_REINFORCEMENT_RISK maps to NEW_CLIMATE_IMBALANCE for completeness.
 */
export type AnnualUnresolvedImbalanceKind =
  | AnnualImbalanceId
  | "CLIMATE_REINFORCEMENT_RISK";

export type AnnualUnresolvedImbalanceInput = {
  kind: AnnualUnresolvedImbalanceKind;
};

export type AnnualElementSafetyInput = {
  element: Element;
  safety: AnnualCandidateSafety;
};

/** Per-element safety derived from remedy + protected-state evidence. */
export type AnnualCandidateSafetyRecord = {
  element: Element;
  safety: AnnualCandidateSafety;
  /** Goals/states currently protected (open or secured). */
  protectedGoals: AnnualResidualGoal[];
  /** Protected goals this candidate explicitly harms (not relation-only). */
  conflictingGoals: AnnualResidualGoal[];
  reasons: string[];
};

/** Optional pre-declared remedy goals; otherwise derived from evidence. */
export type AnnualSafetyCandidateInput = {
  element: Element;
  addressedGoals?: AnnualResidualGoal[];
};

/** Output of buildAnnualWinnerResolverInput — feed resolveAnnualSupplementWinnerV2. */
export type AnnualWinnerResolverInput = {
  candidates: AnnualWinnerCandidate[];
  openGoals: AnnualResidualGoal[];
  openImbalances: AnnualImbalanceId[];
  reasons: string[];
};

/** How natal Supplement addressed a deficit goal (F1∪F2 already collapsed). */
export type NatalDeficitMethod =
  | "direct"
  | "generative"
  | "corridor-mid"
  | "climate-fire-water";

/** Positive Supplement functions that may define a natal deficit goal. */
export type NatalDeficitSourceFunction =
  | "F1_DIRECT"
  | "F2_GENERATIVE"
  | "F6_INCOMING_MEDIATION"
  | "F7_CLIMATE_MITIGATION";

/**
 * Natal deficit goal restored from resolved Supplement winner evidence.
 * Not an exhaustive list of all chart problems.
 */
export type NatalDeficitGoal = {
  kind: AnnualResidualGoal;
  /** CORE/INCOMING → natal Core; CLIMATE → mitigating 火/水 element. */
  targetElement: Element;
  sourceFunctions: NatalDeficitSourceFunction[];
  /** Resolved natal Supplement winner element. */
  sourceElement: Element;
  /** Derived method tags for annual satisfaction (F1∪F2 → one CORE_SUPPORT). */
  methods: NatalDeficitMethod[];
  reasons: string[];
};

export type AnnualSatisfyingMethod =
  | "same-to-core"
  | "generates-core"
  | "corridor-mid"
  | "climate-fire-water";

export type AnnualSignalCoherence =
  | "stem-only"
  | "branch-main-only"
  | "coherent"
  | "conflicting"
  | "none";

export type AnnualGoalSatisfaction = {
  goal: AnnualResidualGoal;
  status: AnnualGoalSatisfactionStatus;
  satisfyingMethods: AnnualSatisfyingMethod[];
  signalCoherence: AnnualSignalCoherence;
  reasons: string[];
};

export type AnnualImbalanceKind =
  | "RESIDUAL_CORE_SUPPORT"
  | "RESIDUAL_INCOMING_MEDIATION"
  | "RESIDUAL_CLIMATE_MITIGATION"
  | "CLIMATE_REINFORCEMENT_RISK"
  | "CORE_REINFORCEMENT_RISK"
  | "SUPPLEMENT_DRAIN_SHIFT"
  | "UNKNOWN";

export type AnnualImbalanceOrigin =
  | "residual-natal-goal"
  | "new-annual"
  | "none"
  | "unknown";

export type AnnualImbalance = {
  kind: AnnualImbalanceKind;
  origin: AnnualImbalanceOrigin;
  relatedGoalKind?: AnnualResidualGoal;
  evidence: string[];
};
