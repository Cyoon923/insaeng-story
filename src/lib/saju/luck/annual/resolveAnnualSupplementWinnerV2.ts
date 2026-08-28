/**
 * Annual Supplement v2 winner resolution.
 * Selection among clean ACTIVE only; completeness tracked separately (partial).
 * No scores, no CAUTION promotion, no element/array-order tie-break,
 * no fixed climate≻structural (or reverse) goal precedence.
 */

import type {
  AnnualEvidenceQuality,
  AnnualImbalanceId,
  AnnualResidualGoal,
  AnnualSupplementWinnerResolution,
  AnnualWinnerCandidate,
} from "@/lib/saju/luck/annual/types";

export type ResolveAnnualSupplementWinnerV2Input = {
  year: number;
  candidates: AnnualWinnerCandidate[];
  /** Blocking open residual goals. */
  openGoals: AnnualResidualGoal[];
  /** Open imbalances (completeness). */
  openImbalances: AnnualImbalanceId[];
};

const EVIDENCE_RANK: Record<AnnualEvidenceQuality, number> = {
  direct: 0,
  generative: 1,
  "structural-mediation": 2,
  "climate-mitigation": 3,
};

const IMBALANCE_TO_GOAL: Record<AnnualImbalanceId, AnnualResidualGoal> = {
  RESIDUAL_CORE_SUPPORT: "CORE_SUPPORT",
  RESIDUAL_INCOMING_MEDIATION: "INCOMING_MEDIATION",
  RESIDUAL_CLIMATE_MITIGATION: "CLIMATE_MITIGATION",
  NEW_CLIMATE_IMBALANCE: "CLIMATE_MITIGATION",
};

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

function coverageOf(
  candidate: AnnualWinnerCandidate,
  openGoals: AnnualResidualGoal[],
): Set<AnnualResidualGoal> {
  const open = new Set(openGoals);
  const covered = new Set<AnnualResidualGoal>();
  for (const goal of uniqueGoals(candidate.residualGoalsAddressed)) {
    if (open.has(goal)) covered.add(goal);
  }
  return covered;
}

function isStrictSuperset(
  a: Set<AnnualResidualGoal>,
  b: Set<AnnualResidualGoal>,
): boolean {
  if (a.size <= b.size) return false;
  for (const item of b) {
    if (!a.has(item)) return false;
  }
  return true;
}

/** Keep candidates whose coverage is not a strict subset of another pool member. */
function narrowByStrictSupersetCoverage(
  pool: AnnualWinnerCandidate[],
  openGoals: AnnualResidualGoal[],
): AnnualWinnerCandidate[] {
  return pool.filter((candidate) => {
    const cov = coverageOf(candidate, openGoals);
    return !pool.some((other) => {
      if (other === candidate) return false;
      return isStrictSuperset(coverageOf(other, openGoals), cov);
    });
  });
}

/**
 * Same-goal quality: only when every remaining pair shares exactly one comparable
 * open goal and qualities are totally ordered on that goal; if mixed goals, no op.
 */
function narrowBySameGoalEvidenceQuality(
  pool: AnnualWinnerCandidate[],
  openGoals: AnnualResidualGoal[],
): AnnualWinnerCandidate[] {
  if (pool.length <= 1) return pool;

  const coverages = pool.map((c) => coverageOf(c, openGoals));

  // Require a single shared open goal that every candidate covers,
  // and no candidate covers any other open goal (same-goal comparison only).
  const sharedOpen = openGoals.filter((goal) =>
    coverages.every((cov) => cov.has(goal)),
  );
  if (sharedOpen.length !== 1) return pool;

  const onlyGoal = sharedOpen[0]!;
  const allSingleGoal = coverages.every(
    (cov) => cov.size === 1 && cov.has(onlyGoal),
  );
  if (!allSingleGoal) return pool;

  let bestRank = Number.POSITIVE_INFINITY;
  for (const candidate of pool) {
    bestRank = Math.min(bestRank, EVIDENCE_RANK[candidate.evidenceQuality]);
  }
  return pool.filter((c) => EVIDENCE_RANK[c.evidenceQuality] === bestRank);
}

/**
 * Prefer non-mediation when comparing same-goal direct/generative vs mediation.
 * Already encoded in EVIDENCE_RANK; step ④ is the same-goal rank filter above.
 * Extra pass: if pool still mixed qualities after failed same-goal gate, leave as-is.
 */
function preferDirectOverMediationSameGoal(
  pool: AnnualWinnerCandidate[],
  openGoals: AnnualResidualGoal[],
): AnnualWinnerCandidate[] {
  // Re-apply same-goal quality if step ③ left multiples that share one goal
  // but also had extra coverage noise cleared by superset — already handled.
  return narrowBySameGoalEvidenceQuality(pool, openGoals);
}

function uncoveredGoals(
  selected: AnnualWinnerCandidate | null,
  openGoals: AnnualResidualGoal[],
): AnnualResidualGoal[] {
  if (!selected) return [...openGoals];
  const covered = coverageOf(selected, openGoals);
  return openGoals.filter((goal) => !covered.has(goal));
}

function uncoveredImbalances(
  selected: AnnualWinnerCandidate | null,
  openImbalances: AnnualImbalanceId[],
): AnnualImbalanceId[] {
  if (!selected) return [...openImbalances];
  const coveredGoals = new Set(uniqueGoals(selected.residualGoalsAddressed));
  return openImbalances.filter((imbalance) => {
    const goal = IMBALANCE_TO_GOAL[imbalance];
    return !coveredGoals.has(goal);
  });
}

function isSelectionPoolMember(candidate: AnnualWinnerCandidate): boolean {
  return candidate.state === "ACTIVE" && candidate.safety === "clean";
}

/**
 * Resolve Annual Supplement v2 winner from pre-built candidates + open issues.
 */
export function resolveAnnualSupplementWinnerV2(
  input: ResolveAnnualSupplementWinnerV2Input,
): AnnualSupplementWinnerResolution {
  const reasons: string[] = [`year=${input.year}`];
  const openGoals = uniqueGoals(input.openGoals);
  const openImbalances = [...input.openImbalances];

  const cautionCount = input.candidates.filter((c) => c.state === "CAUTION").length;
  reasons.push(`candidate-count=${input.candidates.length}`);
  reasons.push(`caution-count=${cautionCount}`);
  reasons.push(`open-goals=${openGoals.join("+") || "none"}`);
  reasons.push(`open-imbalances=${openImbalances.join("+") || "none"}`);

  let pool = input.candidates.filter(isSelectionPoolMember);
  reasons.push(
    `pool-clean-active=${pool.map((c) => c.element).join(",") || "none"}`,
  );

  if (pool.length === 0) {
    reasons.push("unresolved:no-clean-active");
    if (cautionCount > 0) {
      reasons.push("caution-not-promoted-to-winner");
    }
    return {
      annualSupplementElement: null,
      status: "unresolved",
      unresolvedGoals: openGoals,
      unresolvedImbalances: openImbalances,
      reasons,
    };
  }

  if (pool.length > 1) {
    const afterCoverage = narrowByStrictSupersetCoverage(pool, openGoals);
    if (afterCoverage.length < pool.length) {
      reasons.push(
        `narrow:strict-superset→${afterCoverage.map((c) => c.element).join(",")}`,
      );
    }
    pool = afterCoverage;
  }

  if (pool.length > 1) {
    const afterQuality = narrowBySameGoalEvidenceQuality(pool, openGoals);
    if (afterQuality.length < pool.length) {
      reasons.push(
        `narrow:same-goal-quality→${afterQuality.map((c) => c.element).join(",")}`,
      );
    }
    pool = afterQuality;
  }

  if (pool.length > 1) {
    const afterMediation = preferDirectOverMediationSameGoal(pool, openGoals);
    if (afterMediation.length < pool.length) {
      reasons.push(
        `narrow:direct-over-mediation→${afterMediation.map((c) => c.element).join(",")}`,
      );
    }
    pool = afterMediation;
  }

  if (pool.length > 1) {
    reasons.push(
      `unresolved:multiple-clean-active=${pool.map((c) => c.element).join(",")}`,
    );
    return {
      annualSupplementElement: null,
      status: "unresolved",
      unresolvedGoals: openGoals,
      unresolvedImbalances: openImbalances,
      reasons,
    };
  }

  const selected = pool[0]!;
  const unresolvedGoals = uncoveredGoals(selected, openGoals);
  const unresolvedImbalances = uncoveredImbalances(selected, openImbalances);

  reasons.push(`selection=${selected.element}`);
  reasons.push(
    `selection-coverage=${[...coverageOf(selected, openGoals)].join("+") || "none"}`,
  );

  if (unresolvedGoals.length === 0 && unresolvedImbalances.length === 0) {
    reasons.push("status:resolved");
    return {
      annualSupplementElement: selected.element,
      status: "resolved",
      unresolvedGoals: [],
      unresolvedImbalances: [],
      reasons,
    };
  }

  reasons.push(
    `status:partial;unresolved-goals=${unresolvedGoals.join("+") || "none"}`,
  );
  reasons.push(
    `unresolved-imbalances=${unresolvedImbalances.join("+") || "none"}`,
  );
  return {
    annualSupplementElement: selected.element,
    status: "partial",
    unresolvedGoals,
    unresolvedImbalances,
    reasons,
  };
}
