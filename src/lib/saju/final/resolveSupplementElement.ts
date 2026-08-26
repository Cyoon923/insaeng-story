/**
 * Select one Supplement Element (or unresolved) from v1 policy states.
 * Does not re-read climate / Need / corridors / Core evidence.
 */

import type { SupplementCandidatePolicy } from "@/lib/saju/final/deriveSupplementCandidatePolicyStates";
import type { Element } from "@/lib/saju/types";

export type ResolveSupplementElementInput = {
  core: Element;
  policies: SupplementCandidatePolicy[];
};

export type ResolveSupplementElementResult = {
  supplementElement: Element | null;
  status: "resolved" | "unresolved";
  reasons: string[];
};

function hasMediatedGenerative(policy: SupplementCandidatePolicy): boolean {
  return (
    policy.positiveFunctions.includes("F2_GENERATIVE") &&
    policy.positiveFunctions.includes("F6_INCOMING_MEDIATION")
  );
}

function isSinglePositive(policy: SupplementCandidatePolicy): boolean {
  return policy.positiveFunctions.length === 1;
}

/**
 * Resolve Supplement from ACTIVE / CAUTION / INACTIVE policies only.
 * Core/parent auto-pick, scores, and CAUTION fallback are forbidden.
 */
export function resolveSupplementElement(
  input: ResolveSupplementElementInput,
): ResolveSupplementElementResult {
  const reasons: string[] = [`core=${input.core}`];
  const active = input.policies.filter((row) => row.state === "ACTIVE");
  const caution = input.policies.filter((row) => row.state === "CAUTION");
  const inactive = input.policies.filter((row) => row.state === "INACTIVE");

  reasons.push(`active-count=${active.length}`);
  reasons.push(`caution-count=${caution.length}`);
  reasons.push(`inactive-count=${inactive.length}`);

  if (active.length === 1) {
    const winner = active[0]!;
    reasons.push(`resolved:single-active=${winner.element}`);
    return {
      supplementElement: winner.element,
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
      supplementElement: null,
      status: "unresolved",
      reasons,
    };
  }

  // active.length >= 2
  const mediated = active.filter(hasMediatedGenerative);
  const singles = active.filter(isSinglePositive);

  if (
    mediated.length === 1 &&
    singles.length === active.length - 1 &&
    active.every((row) => hasMediatedGenerative(row) || isSinglePositive(row))
  ) {
    const winner = mediated[0]!;
    reasons.push(
      `resolved:tie-break-mediated-generative=${winner.element}`,
    );
    reasons.push(
      `tie-break-others=${singles.map((row) => row.element).join(",")}`,
    );
    return {
      supplementElement: winner.element,
      status: "resolved",
      reasons,
    };
  }

  reasons.push(
    `unresolved:multiple-active=${active.map((row) => row.element).join(",")}`,
  );
  return {
    supplementElement: null,
    status: "unresolved",
    reasons,
  };
}
