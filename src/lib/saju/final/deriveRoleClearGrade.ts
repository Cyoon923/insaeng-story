/**
 * Shared role CLEAR-grade evidence predicates for FER certainty / hour stability.
 * Policy mirror only — no Final selection, no certainty assignment.
 */

import type { BottleneckLevel, FinalRole } from "@/lib/saju/final/types";
import type {
  PillarSlot,
  StrengthEvidence,
  StrengthSummary,
} from "@/lib/saju/types";

function isEligibleSlot(slot: PillarSlot, hourUnknown: boolean): boolean {
  if (hourUnknown && slot === "hour") return false;
  return true;
}

function isVisiblePresence(presence: string | undefined): boolean {
  return presence === "rooted-visible" || presence === "unrooted-visible";
}

function isResourceShiShen(shiShen: string): boolean {
  return shiShen === "정인" || shiShen === "편인";
}

function isOutputShiShen(shiShen: string): boolean {
  return shiShen === "식신" || shiShen === "상관";
}

function isControlShiShen(shiShen: string): boolean {
  return shiShen === "정재" || shiShen === "편재" || shiShen === "정관" || shiShen === "편관";
}

/** R1 CLEAR-grade: resource RV + visible 인성 support. */
export function r1HasClearEvidence(
  summary: StrengthSummary,
  evidence: StrengthEvidence | undefined,
): boolean {
  if (!summary.sourceBreakdown.resource.rootedVisible) return false;
  if (!evidence) return false;
  return evidence.supportEvidence.items.some(
    (item) =>
      isResourceShiShen(item.shiShen) &&
      isVisiblePresence(item.presence) &&
      isEligibleSlot(item.slot, evidence.hourUnknown),
  );
}

/** R3 CLEAR-grade: output RV or rooted-visible 식상 pressure. */
export function r3HasClearEvidence(
  summary: StrengthSummary,
  evidence: StrengthEvidence | undefined,
): boolean {
  if (summary.sourceBreakdown.output.rootedVisible) return true;
  if (!evidence) return false;
  return evidence.pressureEvidence.items.some(
    (item) =>
      isOutputShiShen(item.shiShen) &&
      item.presence === "rooted-visible" &&
      isEligibleSlot(item.slot, evidence.hourUnknown),
  );
}

/** R4 CLEAR-grade: wealth/officer RV or rooted-visible 재관 pressure. */
export function r4HasClearEvidence(
  summary: StrengthSummary,
  evidence: StrengthEvidence | undefined,
): boolean {
  const { wealth, officer } = summary.sourceBreakdown;
  if (wealth.rootedVisible || officer.rootedVisible) return true;
  if (!evidence) return false;
  return evidence.pressureEvidence.items.some(
    (item) =>
      isControlShiShen(item.shiShen) &&
      item.presence === "rooted-visible" &&
      isEligibleSlot(item.slot, evidence.hourUnknown),
  );
}

/** R2/R5 bottleneck CLEAR gate (shared boolean). */
export function bottleneckIsClear(level: BottleneckLevel): boolean {
  return level === "CLEAR";
}

/**
 * Structural R1/R3/R4 CLEAR-grade evidence only (no activity-C gate).
 * Callers that require activity ≠ C must check RoleActivity themselves.
 */
export function structuralRoleHasClearEvidence(
  role: Extract<FinalRole, "R1" | "R3" | "R4">,
  summary: StrengthSummary,
  evidence: StrengthEvidence | undefined,
): boolean {
  switch (role) {
    case "R1":
      return r1HasClearEvidence(summary, evidence);
    case "R3":
      return r3HasClearEvidence(summary, evidence);
    case "R4":
      return r4HasClearEvidence(summary, evidence);
    default:
      return false;
  }
}
