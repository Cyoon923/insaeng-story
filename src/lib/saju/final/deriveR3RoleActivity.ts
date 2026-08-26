/**
 * R3 (output / 설기·식상) Role Activity only.
 * Does not select Final elements, compare R3 vs R4, or judge whether R3 is needed.
 */

import { stemElement } from "@/lib/saju/constants/elements";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import type { RoleActivity } from "@/lib/saju/final/types";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import { generatedElement } from "@/lib/saju/observation/elementGenerates";
import type { StrengthObservations } from "@/lib/saju/observation/types";
import type { Element, FourPillars, PillarSlot, StrengthEvidence } from "@/lib/saju/types";

export type DeriveR3RoleActivityInput = {
  pillars: FourPillars;
  /** Reuse when already computed; otherwise collected once. */
  evidence?: StrengthEvidence;
  /** Reuse when already computed; otherwise built from pillars + evidence. */
  observations?: StrengthObservations;
};

function isOutputShiShen(shiShen: string): boolean {
  return shiShen === "식신" || shiShen === "상관";
}

/** Hour is omitted when unknown; day branch/stem pressure may still count for R3. */
function isEligibleSlot(slot: PillarSlot, hourUnknown: boolean): boolean {
  if (hourUnknown && slot === "hour") return false;
  return true;
}

function dayOutputElement(dayStem: StrengthEvidence["dayStem"]): Element {
  return generatedElement(stemElement(dayStem));
}

function hasRootedVisibleOutputPressure(evidence: StrengthEvidence): boolean {
  return evidence.pressureEvidence.items.some(
    (item) =>
      isOutputShiShen(item.shiShen) &&
      isEligibleSlot(item.slot, evidence.hourUnknown) &&
      item.presence === "rooted-visible",
  );
}

/**
 * Surface confirmation for day → output:
 * - rooted-visible 식신/상관 pressureEvidence, or
 * - pressure-branch-anchor / pressure-visible-stem on the day output element
 *   when backed by rooted-visible output stems (visible-stem alone + unrooted ≠ C).
 */
function hasOutputRoleSurfaceC(
  evidence: StrengthEvidence,
  observations: StrengthObservations,
): boolean {
  if (hasRootedVisibleOutputPressure(evidence)) {
    return true;
  }

  const outputElement = dayOutputElement(evidence.dayStem);

  for (const relation of observations.structureObservation.pressureRelations) {
    if (relation.element !== outputElement) continue;

    const eligibleSlots = relation.slots.filter((slot) =>
      isEligibleSlot(slot, evidence.hourUnknown),
    );
    if (eligibleSlots.length === 0) continue;

    if (relation.kind === "pressure-branch-anchor") {
      return true;
    }

    if (relation.kind === "pressure-visible-stem") {
      // Visible-stem surface counts as C only with rooted-visible 식상 stems.
      const hasRootedVisibleStem = relation.evidenceRefs.some((ref) => {
        if (!ref.stem || !ref.shiShen || !isOutputShiShen(ref.shiShen)) return false;
        if (ref.slot !== undefined && !isEligibleSlot(ref.slot, evidence.hourUnknown)) {
          return false;
        }
        const pressureItem = evidence.pressureEvidence.items.find(
          (item) =>
            item.stem === ref.stem &&
            isOutputShiShen(item.shiShen) &&
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

function generationTouchesOutputElement(
  observations: StrengthObservations,
  outputElement: Element,
): boolean {
  return observations.generationChains.some((chain) => {
    if (chain.from.element === outputElement) return true;
    if ("target" in chain.to) return false;
    return chain.to.element === outputElement;
  });
}

function hasAnyOutputRoleTrace(
  evidence: StrengthEvidence,
  observations: StrengthObservations,
): boolean {
  if (
    evidence.pressureEvidence.items.some(
      (item) =>
        isOutputShiShen(item.shiShen) && isEligibleSlot(item.slot, evidence.hourUnknown),
    )
  ) {
    return true;
  }

  if (
    evidence.branchRelationEvidence.items.some(
      (item) =>
        item.relationSide === "pressure" &&
        isOutputShiShen(item.shiShen) &&
        isEligibleSlot(item.slot, evidence.hourUnknown),
    )
  ) {
    return true;
  }

  const outputElement = dayOutputElement(evidence.dayStem);

  if (
    observations.structureObservation.pressureRelations.some((relation) => {
      if (relation.element !== outputElement) return false;
      return relation.slots.some((slot) => isEligibleSlot(slot, evidence.hourUnknown));
    })
  ) {
    return true;
  }

  return generationTouchesOutputElement(observations, outputElement);
}

/**
 * Derives R3 Role Activity (A/B/C) from existing strength / observation evidence.
 * Bare element-generates / output presence alone do not yield C.
 */
export function deriveR3RoleActivity(input: DeriveR3RoleActivityInput): RoleActivity {
  const evidence = input.evidence ?? collectStrengthEvidence(input.pillars);
  const observations =
    input.observations ?? buildStrengthObservations(input.pillars, evidence);

  if (hasOutputRoleSurfaceC(evidence, observations)) {
    return "C";
  }

  if (hasAnyOutputRoleTrace(evidence, observations)) {
    return "B";
  }

  return "A";
}
