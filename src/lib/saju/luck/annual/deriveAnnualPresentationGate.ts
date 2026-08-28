/**
 * Presentation gate for free annual UX — display eligibility only.
 * Does not re-judge winner, fallback to natal, or generate user copy.
 */

import type { AnnualSupplementFlowV2Resolution } from "@/lib/saju/luck/annual/resolveAnnualSupplementFlowV2";
import type {
  AnnualCandidateSafety,
  AnnualImbalanceId,
  AnnualResidualGoal,
} from "@/lib/saju/luck/annual/types";
import type { Element } from "@/lib/saju/types";

export type AnnualSelectionDisplayStatus =
  | "displayable"
  | "displayable-partial"
  | "blocked";

export type AnnualPresentationGate = {
  showAnnualElement: boolean;
  showAnnualMusic: boolean;
  presentationElement: Element | null;
  state: "resolved" | "partial" | "unresolved";
  selectionDisplayStatus: AnnualSelectionDisplayStatus;
  reasons: string[];
};

export type DeriveAnnualPresentationGateContext = {
  /** Precomputed safety for resolution.annualSupplementElement (winner). */
  selectedWinnerSafety?: AnnualCandidateSafety;
  /** Explicit protected-goal conflicts on the selected winner. */
  selectedConflictingGoals?: AnnualResidualGoal[];
};

/**
 * Completeness-only imbalances — incomplete ≠ unsafe for display gate.
 * NEW_CLIMATE_IMBALANCE means the selection does not solve climate; not that it harms.
 */
const DISPLAY_NEUTRAL_IMBALANCES = new Set<AnnualImbalanceId>([
  "NEW_CLIMATE_IMBALANCE",
]);

function blockedGate(
  state: AnnualPresentationGate["state"],
  reasons: string[],
): AnnualPresentationGate {
  return {
    showAnnualElement: false,
    showAnnualMusic: false,
    presentationElement: null,
    state,
    selectionDisplayStatus: "blocked",
    reasons,
  };
}

function showGate(input: {
  element: Element;
  state: "resolved" | "partial";
  selectionDisplayStatus: "displayable" | "displayable-partial";
  reasons: string[];
}): AnnualPresentationGate {
  return {
    showAnnualElement: true,
    showAnnualMusic: true,
    presentationElement: input.element,
    state: input.state,
    selectionDisplayStatus: input.selectionDisplayStatus,
    reasons: input.reasons,
  };
}

function hasExplicitDisplayBlockingImbalance(
  unresolvedImbalances: AnnualImbalanceId[],
): boolean {
  return unresolvedImbalances.some((id) => !DISPLAY_NEUTRAL_IMBALANCES.has(id));
}

function isDisplayablePartial(
  resolution: AnnualSupplementFlowV2Resolution,
  context: DeriveAnnualPresentationGateContext | undefined,
): boolean {
  if (resolution.status !== "partial") return false;
  if (resolution.annualSupplementElement === null) return false;
  if (resolution.unresolvedGoals.length > 0) return false;

  if (context?.selectedWinnerSafety !== "clean") return false;

  const conflictingGoals = context?.selectedConflictingGoals ?? [];
  if (conflictingGoals.length > 0) return false;

  if (hasExplicitDisplayBlockingImbalance(resolution.unresolvedImbalances)) {
    return false;
  }

  return true;
}

/**
 * Map v2 resolution (+ optional winner safety context) to free-screen display gate.
 */
export function deriveAnnualPresentationGate(
  resolution: AnnualSupplementFlowV2Resolution,
  context?: DeriveAnnualPresentationGateContext,
): AnnualPresentationGate {
  const reasons: string[] = [`gate:input-status=${resolution.status}`];

  if (
    resolution.status === "resolved" &&
    resolution.annualSupplementElement !== null
  ) {
    reasons.push("gate:resolved-show");
    reasons.push("gate:selection-display=displayable");
    return showGate({
      element: resolution.annualSupplementElement,
      state: "resolved",
      selectionDisplayStatus: "displayable",
      reasons,
    });
  }

  if (
    resolution.status === "resolved" &&
    resolution.annualSupplementElement === null
  ) {
    reasons.push("gate:abnormal-resolved-null-element");
    return blockedGate("unresolved", reasons);
  }

  if (resolution.status === "partial") {
    if (isDisplayablePartial(resolution, context)) {
      reasons.push("gate:partial-displayable-partial-show");
      reasons.push("gate:selection-display=displayable-partial");
      if (resolution.unresolvedImbalances.length > 0) {
        reasons.push(
          `gate:partial-completeness-only=${resolution.unresolvedImbalances.join("+")}`,
        );
      }
      return showGate({
        element: resolution.annualSupplementElement!,
        state: "partial",
        selectionDisplayStatus: "displayable-partial",
        reasons,
      });
    }

    reasons.push("gate:partial-blocked");
    if (resolution.unresolvedGoals.length > 0) {
      reasons.push(
        `gate:partial-unresolved-goals=${resolution.unresolvedGoals.join("+")}`,
      );
    }
    if (resolution.unresolvedImbalances.length > 0) {
      reasons.push(
        `gate:partial-unresolved-issues=${resolution.unresolvedImbalances.join("+")}`,
      );
    }
    if (context?.selectedWinnerSafety !== undefined) {
      reasons.push(`gate:partial-winner-safety=${context.selectedWinnerSafety}`);
    }
    if ((context?.selectedConflictingGoals?.length ?? 0) > 0) {
      reasons.push(
        `gate:partial-conflicting-goals=${context!.selectedConflictingGoals!.join("+")}`,
      );
    }
    if (
      resolution.unresolvedImbalances.length > 0 &&
      hasExplicitDisplayBlockingImbalance(resolution.unresolvedImbalances)
    ) {
      reasons.push("gate:partial-explicit-imbalance-conflict");
    }
    if (
      resolution.annualSupplementElement !== null &&
      context?.selectedWinnerSafety === undefined
    ) {
      reasons.push("gate:partial-missing-winner-safety-context");
    }
    return blockedGate("partial", reasons);
  }

  reasons.push("gate:unresolved-hide");
  return blockedGate("unresolved", reasons);
}
