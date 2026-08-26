/**
 * R4 (control / 재관) Role Activity only.
 * Does not select Final elements, compare R3 vs R4, or judge whether R4 is needed.
 */

import { stemElement } from "@/lib/saju/constants/elements";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import type { RoleActivity } from "@/lib/saju/final/types";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import type { StrengthObservations } from "@/lib/saju/observation/types";
import type { Element, FourPillars, PillarSlot, StrengthEvidence } from "@/lib/saju/types";

export type DeriveR4RoleActivityInput = {
  pillars: FourPillars;
  /** Reuse when already computed; otherwise collected once. */
  evidence?: StrengthEvidence;
  /** Reuse when already computed; otherwise built from pillars + evidence. */
  observations?: StrengthObservations;
};

function isControlShiShen(shiShen: string): boolean {
  return shiShen === "정재" || shiShen === "편재" || shiShen === "정관" || shiShen === "편관";
}

/** Hour is omitted when unknown. */
function isEligibleSlot(slot: PillarSlot, hourUnknown: boolean): boolean {
  if (hourUnknown && slot === "hour") return false;
  return true;
}

/** Wealth/officer elements present in pressure or branch evidence (never 식상). */
function collectControlElements(evidence: StrengthEvidence): Set<Element> {
  const elements = new Set<Element>();

  for (const item of evidence.pressureEvidence.items) {
    if (
      isControlShiShen(item.shiShen) &&
      isEligibleSlot(item.slot, evidence.hourUnknown)
    ) {
      elements.add(stemElement(item.stem));
    }
  }

  for (const item of evidence.branchRelationEvidence.items) {
    if (
      item.relationSide === "pressure" &&
      isControlShiShen(item.shiShen) &&
      isEligibleSlot(item.slot, evidence.hourUnknown)
    ) {
      elements.add(item.element);
    }
  }

  return elements;
}

function hasRootedVisibleControlPressure(evidence: StrengthEvidence): boolean {
  return evidence.pressureEvidence.items.some(
    (item) =>
      isControlShiShen(item.shiShen) &&
      isEligibleSlot(item.slot, evidence.hourUnknown) &&
      item.presence === "rooted-visible",
  );
}

/**
 * Surface confirmation for wealth/officer control:
 * - rooted-visible 재성/관성 pressureEvidence, or
 * - pressure-branch-anchor on a control element, or
 * - pressure-visible-stem on a control element backed by rooted-visible control stems
 *   (visible-stem alone + unrooted ≠ C).
 */
function hasControlRoleSurfaceC(
  evidence: StrengthEvidence,
  observations: StrengthObservations,
): boolean {
  if (hasRootedVisibleControlPressure(evidence)) {
    return true;
  }

  const controlElements = collectControlElements(evidence);
  if (controlElements.size === 0) return false;

  for (const relation of observations.structureObservation.pressureRelations) {
    if (!controlElements.has(relation.element)) continue;

    const eligibleSlots = relation.slots.filter((slot) =>
      isEligibleSlot(slot, evidence.hourUnknown),
    );
    if (eligibleSlots.length === 0) continue;

    if (relation.kind === "pressure-branch-anchor") {
      return true;
    }

    if (relation.kind === "pressure-visible-stem") {
      const hasRootedVisibleStem = relation.evidenceRefs.some((ref) => {
        if (!ref.stem || !ref.shiShen || !isControlShiShen(ref.shiShen)) return false;
        if (ref.slot !== undefined && !isEligibleSlot(ref.slot, evidence.hourUnknown)) {
          return false;
        }
        const pressureItem = evidence.pressureEvidence.items.find(
          (item) =>
            item.stem === ref.stem &&
            isControlShiShen(item.shiShen) &&
            isEligibleSlot(item.slot, evidence.hourUnknown) &&
            (ref.slot === undefined || item.slot === ref.slot),
        );
        return pressureItem?.presence === "rooted-visible";
      });
      if (hasRootedVisibleStem) return true;
    }
  }

  return false;
}

function hasAnyControlRoleTrace(
  evidence: StrengthEvidence,
  observations: StrengthObservations,
): boolean {
  if (
    evidence.pressureEvidence.items.some(
      (item) =>
        isControlShiShen(item.shiShen) && isEligibleSlot(item.slot, evidence.hourUnknown),
    )
  ) {
    return true;
  }

  if (
    evidence.branchRelationEvidence.items.some(
      (item) =>
        item.relationSide === "pressure" &&
        isControlShiShen(item.shiShen) &&
        isEligibleSlot(item.slot, evidence.hourUnknown),
    )
  ) {
    return true;
  }

  const controlElements = collectControlElements(evidence);
  if (controlElements.size === 0) return false;

  return observations.structureObservation.pressureRelations.some((relation) => {
    if (!controlElements.has(relation.element)) return false;
    return relation.slots.some((slot) => isEligibleSlot(slot, evidence.hourUnknown));
  });
}

/**
 * Derives R4 Role Activity (A/B/C) from existing strength / observation evidence.
 * 식상 (output) evidence and generationChains alone do not yield R4 activity.
 */
export function deriveR4RoleActivity(input: DeriveR4RoleActivityInput): RoleActivity {
  const evidence = input.evidence ?? collectStrengthEvidence(input.pillars);
  const observations =
    input.observations ?? buildStrengthObservations(input.pillars, evidence);

  if (hasControlRoleSurfaceC(evidence, observations)) {
    return "C";
  }

  if (hasAnyControlRoleTrace(evidence, observations)) {
    return "B";
  }

  return "A";
}
