/**
 * Generic Core-scoped P→mid→Q corridors for Supplement F6 description.
 * No winner, RoleActivity, R5 grade, DM shiShen, climate, or Need.
 */

import {
  coreChildElement,
  coreParentElement,
} from "@/lib/saju/final/buildCoreElementState";
import {
  coreLinkBandBetween,
  elementGenerateChainsBetween,
  type CoreLinkBand,
} from "@/lib/saju/final/coreGenerationLinkBand";
import type { StrengthObservations } from "@/lib/saju/observation/types";
import type { Element } from "@/lib/saju/types";

export type CoreScopedCorridorKind = "incoming-mid" | "outgoing-mid";

export type CoreScopedCorridor = {
  kind: CoreScopedCorridorKind;
  mid: Element;
  from: Element;
  to: Element;
  firstLeg: CoreLinkBand;
  secondLeg: CoreLinkBand;
};

export type BuildCoreScopedCorridorsInput = {
  core: Element;
  observations: StrengthObservations;
};

/**
 * Build at most two Core-scoped corridors (incoming-mid / outgoing-mid)
 * when both element-generates legs actually exist in generationChains.
 */
export function buildCoreScopedCorridors(
  input: BuildCoreScopedCorridorsInput,
): CoreScopedCorridor[] {
  const { core, observations } = input;
  const chains = observations.generationChains;
  const out: CoreScopedCorridor[] = [];

  // A: P → E → Core  (E = parent(Core), P = parent(E)); E !== Core by construction
  const incomingMid = coreParentElement(core);
  const incomingFrom = coreParentElement(incomingMid);
  const incomingFirst = elementGenerateChainsBetween(chains, incomingFrom, incomingMid);
  const incomingSecond = elementGenerateChainsBetween(chains, incomingMid, core);
  if (incomingFirst.length > 0 && incomingSecond.length > 0) {
    out.push({
      kind: "incoming-mid",
      mid: incomingMid,
      from: incomingFrom,
      to: core,
      firstLeg: coreLinkBandBetween(chains, incomingFrom, incomingMid),
      secondLeg: coreLinkBandBetween(chains, incomingMid, core),
    });
  }

  // B: Core → E → Q  (E = child(Core), Q = child(E))
  const outgoingMid = coreChildElement(core);
  const outgoingTo = coreChildElement(outgoingMid);
  const outgoingFirst = elementGenerateChainsBetween(chains, core, outgoingMid);
  const outgoingSecond = elementGenerateChainsBetween(chains, outgoingMid, outgoingTo);
  if (outgoingFirst.length > 0 && outgoingSecond.length > 0) {
    out.push({
      kind: "outgoing-mid",
      mid: outgoingMid,
      from: core,
      to: outgoingTo,
      firstLeg: coreLinkBandBetween(chains, core, outgoingMid),
      secondLeg: coreLinkBandBetween(chains, outgoingMid, outgoingTo),
    });
  }

  return out;
}
