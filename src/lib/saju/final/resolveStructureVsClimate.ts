/**
 * Compare structural Final candidate vs R6 climate candidate (A–E).
 * Does not assign certainty, compute hour stability, or build FinalResolution.
 */

import type { RoleElementCandidateMap } from "@/lib/saju/final/deriveRoleElementCandidates";
import type { StructuralElementResult } from "@/lib/saju/final/resolveStructuralElement";
import type { FinalRole, RoleActivityMap } from "@/lib/saju/final/types";
import type {
  AdjustedClimateSummary,
  AdjustedMoistureAxis,
  AdjustedTemperatureAxis,
  Element,
  NeedResolution,
} from "@/lib/saju/types";

export type StructureVsClimateSource = "structure" | "climate" | "aligned" | null;

export type StructureVsClimateResult = {
  role: FinalRole | null;
  element: Element | null;
  status: "resolved" | "unresolved";
  source: StructureVsClimateSource;
  reasons: string[];
};

export type ResolveStructureVsClimateInput = {
  structuralResolution: StructuralElementResult;
  roleElementCandidates: RoleElementCandidateMap;
  roleActivities: RoleActivityMap;
  climate: AdjustedClimateSummary;
  /** Optional — contested-inherited / provenance for R6 clearness. */
  needResolution?: NeedResolution;
};

type ClimateAxis = AdjustedTemperatureAxis | AdjustedMoistureAxis;

/** 오행 상극(克). 생이 아닌 “직접 해침”만 반대 작용으로 본다. */
const ELEMENT_CONTROLS: Readonly<Record<Element, Element>> = {
  木: "土",
  土: "水",
  水: "火",
  火: "金",
  金: "木",
};

function axisBlocksClearR6(axis: ClimateAxis): boolean {
  if (axis.status === "unresolved") return true;
  return (
    axis.outcome === "partially-mitigated" ||
    axis.outcome === "mitigation-reinforcement-conflict" ||
    axis.outcome === "unresolved"
  );
}

function climateAxesAllowClearR6(climate: AdjustedClimateSummary): boolean {
  if (climate.conflicts.length > 0) return false;
  return !axisBlocksClearR6(climate.temperature) && !axisBlocksClearR6(climate.moisture);
}

function hasContestedInheritedProvenance(
  needResolution: NeedResolution | undefined,
  r6Elements: Element[],
): boolean {
  if (!needResolution) return false;
  if (needResolution.decisionBlockedBy.includes("climate-need-contested-inherited")) {
    return true;
  }
  const contestedElements = new Set<Element>();
  for (const candidate of [
    ...needResolution.originalClimateCandidates,
    ...needResolution.climateOnlyElements,
  ]) {
    if (candidate.boundary === "contested-inherited") {
      contestedElements.add(candidate.element);
    }
  }
  return r6Elements.some((element) => contestedElements.has(element));
}

/**
 * R6 is clear/non-contested only when climate axes allow and Need provenance
 * does not mark the climate path contested-inherited.
 */
function isR6ClearNonContested(
  climate: AdjustedClimateSummary,
  r6Elements: Element[],
  needResolution: NeedResolution | undefined,
): boolean {
  if (r6Elements.length === 0) return false;
  if (!climateAxesAllowClearR6(climate)) return false;
  if (hasContestedInheritedProvenance(needResolution, r6Elements)) return false;
  return true;
}

/** 생극 중 克만 — 한쪽이 다른 쪽을 직접 극하면 반대 작용. */
function elementsOppose(a: Element, b: Element): boolean {
  return ELEMENT_CONTROLS[a] === b || ELEMENT_CONTROLS[b] === a;
}

function unresolved(
  reasons: string[],
  source: StructureVsClimateSource = null,
): StructureVsClimateResult {
  return { role: null, element: null, status: "unresolved", source, reasons };
}

/**
 * Narrows structural vs R6 climate candidates per frozen A–E policy.
 * Certainty is intentionally not assigned.
 */
export function resolveStructureVsClimate(
  input: ResolveStructureVsClimateInput,
): StructureVsClimateResult {
  const {
    structuralResolution: structural,
    roleElementCandidates,
    climate,
    needResolution,
  } = input;
  void input.roleActivities;
  const reasons: string[] = [...structural.reasons.map((r) => `structural:${r}`)];
  const r6Candidates = roleElementCandidates.R6;

  const structureResolved =
    structural.status === "resolved" &&
    structural.element !== null &&
    structural.role !== null;

  const r6Clear = isR6ClearNonContested(climate, r6Candidates, needResolution);
  const r6ContestedOrIncomplete =
    r6Candidates.length > 0 && !r6Clear;

  if (r6Candidates.length === 0) {
    reasons.push("r6:no-candidates");
    if (structureResolved) {
      reasons.push("case-b-or-e:structure-only");
      return {
        role: structural.role,
        element: structural.element,
        status: "resolved",
        source: "structure",
        reasons,
      };
    }
    reasons.push("both-empty");
    return unresolved(reasons);
  }

  if (r6Candidates.length > 1) {
    reasons.push("r6:multiple-candidates-no-winner");
    if (structureResolved) {
      reasons.push("keep-structure-over-multi-r6");
      return {
        role: structural.role,
        element: structural.element,
        status: "resolved",
        source: "structure",
        reasons,
      };
    }
    return unresolved(reasons);
  }

  const climateElement = r6Candidates[0];
  if (!climateElement) {
    reasons.push("r6:empty-slot");
    return structureResolved
      ? {
          role: structural.role,
          element: structural.element,
          status: "resolved",
          source: "structure",
          reasons,
        }
      : unresolved(reasons);
  }

  // ——— A: same element ———
  if (structureResolved && structural.element === climateElement) {
    reasons.push("case-a:aligned-same-element");
    reasons.push("aligned-not-auto-confirmed");
    return {
      role: structural.role,
      element: structural.element,
      status: "resolved",
      source: "aligned",
      reasons,
    };
  }

  // ——— E / rule 3: structure resolved + contested/partial R6 → keep structure ———
  if (structureResolved && r6ContestedOrIncomplete) {
    reasons.push("case-e:structure-over-contested-or-incomplete-r6");
    reasons.push("climate-reference-only");
    return {
      role: structural.role,
      element: structural.element,
      status: "resolved",
      source: "structure",
      reasons,
    };
  }

  // ——— D: structure unresolved + clear R6 single ———
  if (!structureResolved && r6Clear) {
    reasons.push("case-d:climate-only-clear-r6");
    return {
      role: "R6",
      element: climateElement,
      status: "resolved",
      source: "climate",
      reasons,
    };
  }

  // ——— rule 6: structure unresolved + contested R6 ———
  if (!structureResolved && r6ContestedOrIncomplete) {
    reasons.push("structure-unresolved-and-r6-contested");
    return unresolved(reasons);
  }

  // ——— C / B: structure resolved + clear R6 + different element ———
  if (structureResolved && r6Clear && structural.element !== climateElement) {
    // structureResolved 가드가 element !== null을 이미 보장한다.
    if (elementsOppose(structural.element!, climateElement)) {
      reasons.push("case-c:opposite-action-conflict");
      return unresolved(reasons, null);
    }
    reasons.push("case-b:different-non-opposite-keep-structure");
    reasons.push("climate-reference-only");
    return {
      role: structural.role,
      element: structural.element,
      status: "resolved",
      source: "structure",
      reasons,
    };
  }

  // Structure unresolved, no usable R6 path
  if (!structureResolved) {
    reasons.push("no-resolvable-structure-or-climate");
    return unresolved(reasons);
  }

  reasons.push("fallback-keep-structure");
  return {
    role: structural.role,
    element: structural.element,
    status: "resolved",
    source: "structure",
    reasons,
  };
}
