/**
 * Shared CoreLinkBand grading for element-generates legs.
 * No DM shiShen, RoleActivity, climate, or Need.
 */

import type {
  GenerationChain,
  StrengthObservationNodeRef,
  StrengthObservationTargetRef,
} from "@/lib/saju/observation/types";
import type { Element, ElementPresenceKind } from "@/lib/saju/types";

export type CoreLinkBand = "none" | "hidden-context" | "surface";

export function isElementGenerateTarget(
  to: StrengthObservationTargetRef,
): to is StrengthObservationNodeRef {
  return !("target" in to);
}

function isSurfaceMaterial(node: {
  layer: "stem" | "hiddenStem";
  presence: ElementPresenceKind;
}): boolean {
  if (node.layer === "stem") return true;
  return node.presence === "rooted-visible" || node.presence === "unrooted-visible";
}

export function chainHasSurfaceEvidence(chain: GenerationChain): boolean {
  if (!isElementGenerateTarget(chain.to)) return false;
  return isSurfaceMaterial(chain.from) || isSurfaceMaterial(chain.to);
}

/** Grade a set of element-generates chains between the same endpoints. */
export function coreLinkBandFromChains(chains: GenerationChain[]): CoreLinkBand {
  if (chains.length === 0) return "none";
  if (chains.some(chainHasSurfaceEvidence)) return "surface";
  return "hidden-context";
}

/** Collect element-generates chains from → to (excludes resource-to-day-master / day-master targets). */
export function elementGenerateChainsBetween(
  chains: GenerationChain[],
  fromElement: Element,
  toElement: Element,
): GenerationChain[] {
  return chains.filter(
    (chain) =>
      chain.relation === "element-generates" &&
      chain.from.element === fromElement &&
      isElementGenerateTarget(chain.to) &&
      chain.to.element === toElement,
  );
}

export function coreLinkBandBetween(
  chains: GenerationChain[],
  fromElement: Element,
  toElement: Element,
): CoreLinkBand {
  return coreLinkBandFromChains(elementGenerateChainsBetween(chains, fromElement, toElement));
}
