/**
 * Describe each 木火土金水 candidate’s relation/link bands to FER Core.
 * No Supplement winner, suitability, scores, climate, Need, RoleActivity, or DM shiShen.
 */

import type { CoreElementState } from "@/lib/saju/final/buildCoreElementState";
import {
  coreLinkBandBetween,
  type CoreLinkBand,
} from "@/lib/saju/final/coreGenerationLinkBand";
import { analyzeElementPresence } from "@/lib/saju/elements/presence";
import { elementGenerates, generatedElement } from "@/lib/saju/observation/elementGenerates";
import type { StrengthObservations } from "@/lib/saju/observation/types";
import type { Element, ElementPresenceKind, FourPillars } from "@/lib/saju/types";
import { ELEMENTS } from "@/lib/saju/types";

export type CoreRelationKind =
  | "direct"
  | "generates-core"
  | "generated-by-core"
  | "controls-core"
  | "controlled-by-core";

export type SupplementCandidateState = {
  element: Element;
  relationToCore: CoreRelationKind;
  presence: ElementPresenceKind;
  generationToCore: CoreLinkBand;
  generationFromCore: CoreLinkBand;
  isParent: boolean;
  isChild: boolean;
  isController: boolean;
  /**
   * Whether E is a Core-related one-step R5 corridor mid.
   * `null` when that judgment cannot be made without RoleActivity / unsafe inference
   * (analyzeR5Corridors requires RoleActivityMap and returns no corridors when R5=C).
   * Prefer buildCoreScopedCorridors for generic F6 legs.
   */
  corridorMidForCore: boolean | null;
};

export type BuildSupplementCandidateStatesInput = {
  pillars: FourPillars;
  coreState: CoreElementState;
  observations: StrengthObservations;
};

function relationToCore(element: Element, core: Element): CoreRelationKind {
  if (element === core) return "direct";
  if (elementGenerates(element, core)) return "generates-core";
  if (elementGenerates(core, element)) return "generated-by-core";
  if (generatedElement(generatedElement(element)) === core) return "controls-core";
  if (generatedElement(generatedElement(core)) === element) return "controlled-by-core";
  throw new Error(`No CoreRelationKind for ${element} vs core ${core}`);
}

/**
 * Build the same-shape state row for every Element vs Core.
 * Does not select or rank Supplement candidates.
 */
export function buildSupplementCandidateStates(
  input: BuildSupplementCandidateStatesInput,
): SupplementCandidateState[] {
  const { pillars, coreState, observations } = input;
  const core = coreState.core;
  const chains = observations.generationChains;

  return ELEMENTS.map((element) => {
    const relation = relationToCore(element, core);
    const generationToCore =
      relation === "generates-core" ? coreLinkBandBetween(chains, element, core) : "none";
    const generationFromCore =
      relation === "generated-by-core" ? coreLinkBandBetween(chains, core, element) : "none";

    return {
      element,
      relationToCore: relation,
      presence: analyzeElementPresence(pillars, element).presence,
      generationToCore,
      generationFromCore,
      isParent: element === coreState.parent,
      isChild: element === coreState.child,
      isController: element === coreState.controller,
      corridorMidForCore: null,
    };
  });
}
