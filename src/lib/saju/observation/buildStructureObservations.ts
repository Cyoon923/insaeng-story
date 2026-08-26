import { stemElement } from "@/lib/saju/constants/elements";
import type {
  ElementCluster,
  ElementClusterAnchor,
  GenerationChain,
  PressureStructureRelation,
  PressureStructureRelationKind,
  StructureCoexistence,
  StructureEvidenceRef,
  StructureObservation,
  SupportStructureRelation,
} from "@/lib/saju/observation/types";
import type {
  Element,
  PillarSlot,
  StrengthEvidence,
  SupportShiShen,
} from "@/lib/saju/types";
import { ELEMENTS } from "@/lib/saju/types";

const SLOT_ORDER: Record<PillarSlot, number> = {
  year: 0,
  month: 1,
  day: 2,
  hour: 3,
};

const SUPPORT_KIND_ORDER: SupportStructureRelation["kind"][] = [
  "generation-support",
  "resource-support",
  "peer-support",
];

const PRESSURE_KIND_ORDER: PressureStructureRelationKind[] = [
  "pressure-visible-stem",
  "pressure-branch-anchor",
  "pressure-hidden-context",
];

function uniqueSortedSlots(slots: PillarSlot[]): PillarSlot[] {
  return [...new Set(slots)].sort((a, b) => SLOT_ORDER[a] - SLOT_ORDER[b]);
}

function isPeerSupport(shiShen: SupportShiShen): boolean {
  return shiShen === "비견" || shiShen === "겁재";
}

function isResourceSupport(shiShen: SupportShiShen): boolean {
  return shiShen === "정인" || shiShen === "편인";
}

function collectPressureElements(evidence: StrengthEvidence): Set<Element> {
  const elements = new Set<Element>();
  for (const item of evidence.pressureEvidence.items) {
    elements.add(stemElement(item.stem));
  }
  for (const item of evidence.branchRelationEvidence.items) {
    if (item.relationSide === "pressure") {
      elements.add(item.element);
    }
  }
  return elements;
}

function pressureRefDedupeKey(element: Element, kind: PressureStructureRelationKind, ref: StructureEvidenceRef): string {
  if (ref.sourceKey) {
    return `${element}:${kind}:${ref.sourceKey}`;
  }
  if (ref.layer === "branch" && ref.branch) {
    return `${element}:${kind}:${ref.slot}:branch:${ref.branch}`;
  }
  if (ref.layer === "stem" && ref.stem) {
    return `${element}:${kind}:${ref.slot}:stem:${ref.stem}`;
  }
  if (ref.layer === "hiddenStem" && ref.stem) {
    return `${element}:${kind}:${ref.slot}:hiddenStem:${ref.branch}:${ref.stem}`;
  }
  return `${element}:${kind}:${ref.slot}:${ref.layer ?? ""}`;
}

function sortEvidenceRefs(refs: StructureEvidenceRef[]): StructureEvidenceRef[] {
  return [...refs].sort((a, b) => {
    const slotDiff = SLOT_ORDER[a.slot ?? "year"] - SLOT_ORDER[b.slot ?? "year"];
    if (slotDiff !== 0) return slotDiff;
    return (a.layer ?? "").localeCompare(b.layer ?? "");
  });
}

function branchAnchorRef(anchor: ElementClusterAnchor): StructureEvidenceRef {
  return {
    evidenceSide: "pressure",
    slot: anchor.slot,
    layer: "branch",
    branch: anchor.branch,
  };
}

function visibleStemPressureRelations(evidence: StrengthEvidence, pressureElements: Set<Element>): PressureStructureRelation[] {
  const grouped = new Map<Element, StructureEvidenceRef[]>();

  for (const item of evidence.pressureEvidence.items) {
    const element = stemElement(item.stem);
    if (!pressureElements.has(element)) continue;
    const refs = grouped.get(element) ?? [];
    refs.push({
      evidenceSide: "pressure",
      slot: item.slot,
      layer: "stem",
      stem: item.stem,
      shiShen: item.shiShen,
    });
    grouped.set(element, refs);
  }

  return [...grouped.entries()].map(([element, evidenceRefs]) => ({
    kind: "pressure-visible-stem" as const,
    element,
    evidenceRefs: sortEvidenceRefs(evidenceRefs),
    slots: uniqueSortedSlots(evidenceRefs.map((ref) => ref.slot!)),
  }));
}

function branchAnchorPressureRelations(
  elementClusters: ElementCluster[],
  pressureElements: Set<Element>,
): PressureStructureRelation[] {
  const relations: PressureStructureRelation[] = [];

  for (const cluster of elementClusters) {
    if (!pressureElements.has(cluster.element)) continue;

    const branchAnchors = cluster.anchors.filter((anchor) => anchor.layer === "branch");
    if (branchAnchors.length === 0) continue;

    const evidenceRefs = sortEvidenceRefs(branchAnchors.map(branchAnchorRef));
    relations.push({
      kind: "pressure-branch-anchor",
      element: cluster.element,
      evidenceRefs,
      slots: uniqueSortedSlots(branchAnchors.map((anchor) => anchor.slot)),
    });
  }

  return relations;
}

function hiddenContextPressureRelations(evidence: StrengthEvidence, pressureElements: Set<Element>): PressureStructureRelation[] {
  const grouped = new Map<Element, StructureEvidenceRef[]>();

  for (const item of evidence.branchRelationEvidence.items) {
    if (item.relationSide !== "pressure" || !pressureElements.has(item.element)) continue;
    const refs = grouped.get(item.element) ?? [];
    refs.push({
      evidenceSide: "pressure",
      slot: item.slot,
      layer: "hiddenStem",
      stem: item.hiddenStem,
      branch: item.branch,
      sourceKey: item.sourceKey,
      shiShen: item.shiShen,
    });
    grouped.set(item.element, refs);
  }

  return [...grouped.entries()].map(([element, evidenceRefs]) => ({
    kind: "pressure-hidden-context" as const,
    element,
    evidenceRefs: sortEvidenceRefs(evidenceRefs),
    slots: uniqueSortedSlots(evidenceRefs.map((ref) => ref.slot!)),
  }));
}

function layerPressureRelations(
  evidence: StrengthEvidence,
  elementClusters: ElementCluster[],
): PressureStructureRelation[] {
  const pressureElements = collectPressureElements(evidence);
  const relations = [
    ...visibleStemPressureRelations(evidence, pressureElements),
    ...branchAnchorPressureRelations(elementClusters, pressureElements),
    ...hiddenContextPressureRelations(evidence, pressureElements),
  ];

  return relations.sort((a, b) => {
    const elementDiff = ELEMENTS.indexOf(a.element) - ELEMENTS.indexOf(b.element);
    if (elementDiff !== 0) return elementDiff;
    return PRESSURE_KIND_ORDER.indexOf(a.kind) - PRESSURE_KIND_ORDER.indexOf(b.kind);
  });
}

function generationSupportRelations(generationChains: GenerationChain[]): SupportStructureRelation[] {
  return generationChains
    .filter((chain) => chain.relation === "resource-to-day-master")
    .map((chain) => ({
      kind: "generation-support" as const,
      elements: [chain.from.element, chain.to.element],
      slots: uniqueSortedSlots([chain.from.slot, chain.to.slot]),
      evidenceRefs: [
        {
          evidenceSide: "support" as const,
          slot: chain.from.slot,
          layer: chain.from.layer,
          stem: chain.from.stem,
          shiShen: chain.from.shiShen,
          sourceKey: chain.evidenceRef?.sourceKey,
        },
        {
          slot: chain.to.slot,
          layer: chain.to.layer,
          stem: chain.to.stem,
        },
      ],
    }));
}

function visibleSupportRelations(evidence: StrengthEvidence): SupportStructureRelation[] {
  const relations: SupportStructureRelation[] = [];

  for (const item of evidence.supportEvidence.items) {
    if (isPeerSupport(item.shiShen)) {
      relations.push({
        kind: "peer-support",
        elements: [stemElement(item.stem)],
        slots: [item.slot],
        evidenceRefs: [
          {
            evidenceSide: "support",
            slot: item.slot,
            layer: "stem",
            stem: item.stem,
            shiShen: item.shiShen,
          },
        ],
      });
    } else if (isResourceSupport(item.shiShen)) {
      relations.push({
        kind: "resource-support",
        elements: [stemElement(item.stem)],
        slots: [item.slot],
        evidenceRefs: [
          {
            evidenceSide: "support",
            slot: item.slot,
            layer: "stem",
            stem: item.stem,
            shiShen: item.shiShen,
          },
        ],
      });
    }
  }

  return relations;
}

function sortSupportRelations(relations: SupportStructureRelation[]): SupportStructureRelation[] {
  return [...relations].sort((a, b) => {
    const kindDiff = SUPPORT_KIND_ORDER.indexOf(a.kind) - SUPPORT_KIND_ORDER.indexOf(b.kind);
    if (kindDiff !== 0) return kindDiff;
    return SLOT_ORDER[a.slots[0] ?? "year"] - SLOT_ORDER[b.slots[0] ?? "year"];
  });
}

function isSalientPressure(relations: PressureStructureRelation[]): boolean {
  if (relations.some((relation) => relation.kind === "pressure-visible-stem")) {
    return true;
  }
  return relations.some(
    (relation) => relation.kind === "pressure-branch-anchor" && uniqueSortedSlots(relation.slots).length >= 2,
  );
}

function salientPressureRefs(relations: PressureStructureRelation[]): StructureEvidenceRef[] {
  const refs: StructureEvidenceRef[] = [];

  for (const relation of relations) {
    if (relation.kind === "pressure-visible-stem") {
      refs.push(...relation.evidenceRefs);
    }
    if (relation.kind === "pressure-branch-anchor" && uniqueSortedSlots(relation.slots).length >= 2) {
      refs.push(...relation.evidenceRefs);
    }
  }

  const seen = new Set<string>();
  return sortEvidenceRefs(refs.filter((ref) => {
    const key = ref.sourceKey ?? `${ref.slot}:${ref.layer}:${ref.stem ?? ref.branch ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }));
}

function coexistenceNotesOf(
  supportRelations: SupportStructureRelation[],
  pressureRelations: PressureStructureRelation[],
): StructureCoexistence[] {
  if (supportRelations.length === 0 || !isSalientPressure(pressureRelations)) {
    return [];
  }

  const salientRefs = salientPressureRefs(pressureRelations);
  if (salientRefs.length === 0) {
    return [];
  }

  return [
    {
      kind: "support-and-pressure-coexist",
      supportRefs: supportRelations.flatMap((relation) => relation.evidenceRefs),
      pressureRefs: salientRefs,
    },
  ];
}

export function buildStructureObservations(
  evidence: StrengthEvidence,
  input: {
    generationChains: GenerationChain[];
    elementClusters: ElementCluster[];
  },
): StructureObservation {
  const supportRelations = sortSupportRelations([
    ...generationSupportRelations(input.generationChains),
    ...visibleSupportRelations(evidence),
  ]);
  const pressureRelations = layerPressureRelations(evidence, input.elementClusters);

  return {
    supportRelations,
    pressureRelations,
    coexistenceNotes: coexistenceNotesOf(supportRelations, pressureRelations),
  };
}

export {
  branchAnchorPressureRelations,
  collectPressureElements,
  coexistenceNotesOf,
  generationSupportRelations,
  hiddenContextPressureRelations,
  isSalientPressure,
  layerPressureRelations,
  pressureRefDedupeKey,
  salientPressureRefs,
  visibleStemPressureRelations,
  visibleSupportRelations,
};
