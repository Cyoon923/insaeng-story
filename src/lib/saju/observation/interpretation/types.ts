import type { Element, Stem } from "@/lib/saju/types";

export type ObservationHelpingKind = "generation-support" | "resource-support" | "peer-support";

export type ObservationActingKind = "pressure-visible-stem" | "pressure-branch-anchor";

export type ObservationHelpingItem = {
  kind: ObservationHelpingKind;
  text: string;
  elements: Element[];
  order: number;
};

export type ObservationActingItem = {
  kind: ObservationActingKind;
  element: Element;
  text: string;
  order: number;
};

export type ObservationCoexistenceItem = {
  kind: "support-and-pressure-coexist";
  text: string;
};

export type ObservationHiddenContextItem = {
  element: Element;
  text: string;
  detailOnly: true;
};

export type ObservationInterpretation = {
  dayStem: Stem;
  helpingRelations: ObservationHelpingItem[];
  actingStructures: ObservationActingItem[];
  coexistence: ObservationCoexistenceItem | null;
  hiddenContextDetail: ObservationHiddenContextItem[];
};
