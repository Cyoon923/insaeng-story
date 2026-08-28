/**
 * Select one annualSupplementElement (or unresolved) from ACTIVE policies.
 * No scores, no A1 tie-break, no CAUTION promotion, no natal/Core auto-pick.
 */

import type {
  AnnualCandidatePolicy,
  AnnualFunction,
} from "@/lib/saju/luck/annual/deriveAnnualCandidatePolicyStates";
import type { Element } from "@/lib/saju/types";

export type ResolveAnnualSupplementElementInput = {
  year: number;
  policies: AnnualCandidatePolicy[];
};

export type ResolveAnnualSupplementElementResult = {
  annualSupplementElement: Element | null;
  status: "resolved" | "unresolved";
  reasons: string[];
};

function hasA3(policy: AnnualCandidatePolicy): boolean {
  return policy.positiveFunctions.includes("A3_SUPPLEMENT_OFFSET");
}

function hasA4(policy: AnnualCandidatePolicy): boolean {
  return policy.positiveFunctions.includes("A4_CLIMATE_MITIGATION");
}

/** Composite hierarchy band: A3∧A4 beats A3-only / A4-only. Not a count score. */
function isA3AndA4(policy: AnnualCandidatePolicy): boolean {
  return hasA3(policy) && hasA4(policy);
}

function isA3OnlyOrA4Only(policy: AnnualCandidatePolicy): boolean {
  const a3 = hasA3(policy);
  const a4 = hasA4(policy);
  return (a3 && !a4) || (!a3 && a4);
}

function positiveLabel(fns: AnnualFunction[]): string {
  return fns.join("+") || "none";
}

/**
 * Resolve annual supplement winner from frozen ACTIVE hierarchy.
 */
export function resolveAnnualSupplementElement(
  input: ResolveAnnualSupplementElementInput,
): ResolveAnnualSupplementElementResult {
  const reasons: string[] = [`year=${input.year}`];

  const active = input.policies.filter((row) => row.state === "ACTIVE");
  const caution = input.policies.filter((row) => row.state === "CAUTION");
  const inactive = input.policies.filter((row) => row.state === "INACTIVE");

  reasons.push(`active-count=${active.length}`);
  reasons.push(`caution-count=${caution.length}`);
  reasons.push(`inactive-count=${inactive.length}`);
  reasons.push(
    `active=${active.map((row) => `${row.element}:{${positiveLabel(row.positiveFunctions)}}`).join(",") || "none"}`,
  );

  if (active.length === 1) {
    const winner = active[0]!;
    reasons.push(`resolved:single-active=${winner.element}`);
    return {
      annualSupplementElement: winner.element,
      status: "resolved",
      reasons,
    };
  }

  if (active.length === 0) {
    reasons.push("unresolved:no-active");
    if (caution.length > 0) {
      reasons.push("caution-not-promoted-to-winner");
    }
    return {
      annualSupplementElement: null,
      status: "unresolved",
      reasons,
    };
  }

  // active.length >= 2 — qualitative hierarchy only (no A1, no array order).
  const composite = active.filter(isA3AndA4);
  const singles = active.filter(isA3OnlyOrA4Only);

  reasons.push(
    `hierarchy:composite=${composite.map((row) => row.element).join(",") || "none"}`,
  );
  reasons.push(
    `hierarchy:a3-or-a4-only=${singles.map((row) => row.element).join(",") || "none"}`,
  );

  if (
    composite.length === 1 &&
    singles.length === active.length - 1 &&
    active.every((row) => isA3AndA4(row) || isA3OnlyOrA4Only(row))
  ) {
    const winner = composite[0]!;
    reasons.push(`resolved:tie-break-a3-and-a4=${winner.element}`);
    reasons.push(
      `tie-break-others=${singles.map((row) => row.element).join(",")}`,
    );
    return {
      annualSupplementElement: winner.element,
      status: "resolved",
      reasons,
    };
  }

  if (composite.length >= 2) {
    reasons.push(
      `unresolved:multiple-a3-and-a4=${composite.map((row) => row.element).join(",")}`,
    );
    return {
      annualSupplementElement: null,
      status: "unresolved",
      reasons,
    };
  }

  // A3-only vs A4-only (and any other non-hierarchy ACTIVE mix) → unresolved
  reasons.push(
    `unresolved:multiple-active=${active.map((row) => row.element).join(",")}`,
  );
  if (singles.length === active.length && active.length >= 2) {
    reasons.push("unresolved:a3-only-vs-a4-only-peer");
  }

  return {
    annualSupplementElement: null,
    status: "unresolved",
    reasons,
  };
}
