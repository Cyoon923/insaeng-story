import type {
  Branch,
  Element,
  ElementPresenceKind,
  HiddenStemRole,
  PillarSlot,
  ShiShen,
  Stem,
} from "@/lib/saju/types";

export type ObservationLayer = "stem" | "hiddenStem";

export type ElementClusterLayer = "branch" | "stem" | "hiddenStem";

export type ElementClusterAnchor = {
  slot: PillarSlot;
  layer: ElementClusterLayer;
  branch?: Branch;
  stem?: Stem;
  hiddenRole?: HiddenStemRole;
  presence?: ElementPresenceKind;
  /** hiddenStem일 때 branchRelation sourceKey */
  sourceKey?: string;
};

export type ElementCluster = {
  element: Element;
  anchors: ElementClusterAnchor[];
};

export type GenerationChainRelation = "resource-to-day-master" | "element-generates";

export type StrengthObservationNodeRef = {
  slot: PillarSlot;
  layer: ObservationLayer;
  stem: Stem;
  element: Element;
  presence: ElementPresenceKind;
  shiShen: ShiShen;
  /** hiddenStem일 때 branchRelation sourceKey. visible stem은 없음. */
  sourceKey?: string;
};

export type StrengthObservationDayMasterRef = {
  target: "day-master";
  slot: "day";
  layer: "stem";
  stem: Stem;
  element: Element;
  presence: ElementPresenceKind;
};

export type StrengthObservationTargetRef = StrengthObservationNodeRef | StrengthObservationDayMasterRef;

export type StrengthObservationEvidenceRef = {
  /** collectStrengthEvidence branchRelation sourceKey */
  sourceKey?: string;
  /** visible stem이 support/pressure evidence에 있으면 표시 */
  evidenceSide?: "support" | "pressure";
};

export type GenerationChain = {
  relation: GenerationChainRelation;
  from: StrengthObservationNodeRef;
  to: StrengthObservationTargetRef;
  evidenceRef?: StrengthObservationEvidenceRef;
};

export type StrengthObservations = {
  dayStem: Stem;
  generationChains: GenerationChain[];
  elementClusters: ElementCluster[];
  structureObservation: StructureObservation;
};

export type SupportStructureRelationKind =
  | "generation-support"
  | "peer-support"
  | "resource-support";

export type PressureStructureRelationKind =
  | "pressure-visible-stem"
  | "pressure-branch-anchor"
  | "pressure-hidden-context";

/** @deprecated Use SupportStructureRelationKind or PressureStructureRelationKind */
export type StructureRelationKind = SupportStructureRelationKind | PressureStructureRelationKind;

export type StructureEvidenceRef = {
  evidenceSide?: "support" | "pressure";
  slot?: PillarSlot;
  layer?: ElementClusterLayer | ObservationLayer;
  stem?: Stem;
  branch?: Branch;
  sourceKey?: string;
  shiShen?: ShiShen;
};

export type SupportStructureRelation = {
  kind: SupportStructureRelationKind;
  elements: Element[];
  evidenceRefs: StructureEvidenceRef[];
  slots: PillarSlot[];
};

export type PressureStructureRelation = {
  kind: PressureStructureRelationKind;
  element: Element;
  evidenceRefs: StructureEvidenceRef[];
  slots: PillarSlot[];
};

export type StructureRelation = SupportStructureRelation | PressureStructureRelation;

export type StructureCoexistenceKind = "support-and-pressure-coexist";

export type StructureCoexistence = {
  kind: StructureCoexistenceKind;
  supportRefs: StructureEvidenceRef[];
  pressureRefs: StructureEvidenceRef[];
};

export type StructureObservation = {
  supportRelations: SupportStructureRelation[];
  pressureRelations: PressureStructureRelation[];
  coexistenceNotes: StructureCoexistence[];
};
