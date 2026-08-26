/**
 * Describe FER Core Element state in element terms only.
 * No Supplement, sufficiency, DM shiShen support/pressure, climate, Need, or RoleActivity.
 */

import {
  coreLinkBandBetween,
  type CoreLinkBand,
} from "@/lib/saju/final/coreGenerationLinkBand";
import { analyzeElementPresence } from "@/lib/saju/elements/presence";
import { generatedElement } from "@/lib/saju/observation/elementGenerates";
import type { StrengthObservations } from "@/lib/saju/observation/types";
import type { Element, ElementPresenceKind, FourPillars } from "@/lib/saju/types";
import { ELEMENTS } from "@/lib/saju/types";

export type { CoreLinkBand } from "@/lib/saju/final/coreGenerationLinkBand";

export type CoreControlPresence =
  | "controller-absent"
  | "controller-hidden"
  | "controller-visible";

export type CoreElementState = {
  core: Element;
  presence: ElementPresenceKind;
  parent: Element;
  child: Element;
  controller: Element;
  incomingGeneration: CoreLinkBand;
  controlPresence: CoreControlPresence;
  outgoingDrainage: CoreLinkBand;
};

export type BuildCoreElementStateInput = {
  pillars: FourPillars;
  core: Element;
  observations: StrengthObservations;
};

/** parent = 生 core */
export function coreParentElement(core: Element): Element {
  const parent = ELEMENTS.find((element) => generatedElement(element) === core);
  if (!parent) throw new Error(`No parent element for ${core}`);
  return parent;
}

/** child = core 生 */
export function coreChildElement(core: Element): Element {
  return generatedElement(core);
}

/** controller = 剋 core (E such that E生生 → core) */
export function coreControllerElement(core: Element): Element {
  const controller = ELEMENTS.find(
    (element) => generatedElement(generatedElement(element)) === core,
  );
  if (!controller) throw new Error(`No controller element for ${core}`);
  return controller;
}

function controlPresenceOf(presence: ElementPresenceKind): CoreControlPresence {
  if (presence === "absent") return "controller-absent";
  if (presence === "hidden-only") return "controller-hidden";
  return "controller-visible";
}

/**
 * Build qualitative Core element state from presence + generationChains.
 * Does not judge Supplement, enough/excess, or DM pressure.
 */
export function buildCoreElementState(input: BuildCoreElementStateInput): CoreElementState {
  const { pillars, core, observations } = input;
  const parent = coreParentElement(core);
  const child = coreChildElement(core);
  const controller = coreControllerElement(core);
  const chains = observations.generationChains;

  const presence = analyzeElementPresence(pillars, core).presence;
  const controllerPresence = analyzeElementPresence(pillars, controller).presence;

  return {
    core,
    presence,
    parent,
    child,
    controller,
    incomingGeneration: coreLinkBandBetween(chains, parent, core),
    controlPresence: controlPresenceOf(controllerPresence),
    outgoingDrainage: coreLinkBandBetween(chains, core, child),
  };
}
