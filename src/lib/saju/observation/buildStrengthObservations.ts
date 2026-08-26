import { stemElement } from "@/lib/saju/constants/elements";
import { shiShenOf } from "@/lib/saju/data/shiShen";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { analyzeElementPresence } from "@/lib/saju/elements/presence";
import { buildElementClusters } from "@/lib/saju/observation/buildElementClusters";
import { buildStructureObservations } from "@/lib/saju/observation/buildStructureObservations";
import { elementGenerates } from "@/lib/saju/observation/elementGenerates";
import type {
  GenerationChain,
  GenerationChainRelation,
  ObservationLayer,
  StrengthObservationDayMasterRef,
  StrengthObservationEvidenceRef,
  StrengthObservationNodeRef,
  StrengthObservationTargetRef,
  StrengthObservations,
} from "@/lib/saju/observation/types";
import type {
  ElementPresenceKind,
  FourPillars,
  PillarSlot,
  Stem,
  StrengthEvidence,
} from "@/lib/saju/types";

type ObservationNode = StrengthObservationNodeRef & {
  nodeKey: string;
  /** canonical FROM 선택용. 낮을수록 우선(stem > visible-hidden > other-hidden). */
  fromPriority: number;
};

const SLOT_FROM_PRIORITY: Record<PillarSlot, number> = {
  month: 0,
  hour: 1,
  day: 2,
  year: 3,
};

function isResource(dayStem: Stem, fromStem: Stem): boolean {
  const shiShen = shiShenOf(dayStem, fromStem);
  return shiShen === "정인" || shiShen === "편인";
}

function nodeKey(slot: PillarSlot, layer: ObservationLayer, stem: Stem): string {
  return `${slot}:${layer}:${stem}`;
}

function targetKey(to: StrengthObservationTargetRef): string {
  if ("target" in to && to.target === "day-master") {
    return "day-master";
  }
  return nodeKey(to.slot, to.layer, to.stem);
}

function chainDedupeKey(relation: GenerationChainRelation, fromStem: Stem, to: StrengthObservationTargetRef): string {
  return `${relation}:${fromStem}:${targetKey(to)}`;
}

function fromPriority(layer: ObservationLayer, exactStemVisible: boolean, slot: PillarSlot): number {
  if (layer === "stem") return SLOT_FROM_PRIORITY[slot];
  if (exactStemVisible) return 10 + SLOT_FROM_PRIORITY[slot];
  return 20 + SLOT_FROM_PRIORITY[slot];
}

function dayMasterRef(pillars: FourPillars): StrengthObservationDayMasterRef {
  const stem = pillars.day.stem;
  const element = stemElement(stem);
  return {
    target: "day-master",
    slot: "day",
    layer: "stem",
    stem,
    element,
    presence: analyzeElementPresence(pillars, element).presence,
  };
}

function evidenceSideForStem(
  evidence: StrengthEvidence,
  slot: PillarSlot,
  stem: Stem,
): StrengthObservationEvidenceRef["evidenceSide"] | undefined {
  if (evidence.supportEvidence.items.some((item) => item.slot === slot && item.stem === stem)) {
    return "support";
  }
  if (evidence.pressureEvidence.items.some((item) => item.slot === slot && item.stem === stem)) {
    return "pressure";
  }
  return undefined;
}

function collectObservationNodes(
  evidence: StrengthEvidence,
  pillars: FourPillars,
  dayStem: Stem,
): ObservationNode[] {
  const nodes: ObservationNode[] = [];
  const seen = new Set<string>();

  function addNode(input: {
    slot: PillarSlot;
    layer: ObservationLayer;
    stem: Stem;
    presence: ElementPresenceKind;
    sourceKey?: string;
    exactStemVisible?: boolean;
  }): void {
    const key = nodeKey(input.slot, input.layer, input.stem);
    if (seen.has(key)) return;
    seen.add(key);
    nodes.push({
      nodeKey: key,
      slot: input.slot,
      layer: input.layer,
      stem: input.stem,
      element: stemElement(input.stem),
      presence: input.presence,
      shiShen: shiShenOf(dayStem, input.stem),
      sourceKey: input.sourceKey,
      fromPriority: fromPriority(input.layer, input.exactStemVisible ?? false, input.slot),
    });
  }

  const dayElement = stemElement(pillars.day.stem);
  addNode({
    slot: "day",
    layer: "stem",
    stem: pillars.day.stem,
    presence: analyzeElementPresence(pillars, dayElement).presence,
  });

  for (const item of evidence.supportEvidence.items) {
    addNode({
      slot: item.slot,
      layer: "stem",
      stem: item.stem,
      presence: item.presence,
    });
  }
  for (const item of evidence.pressureEvidence.items) {
    addNode({
      slot: item.slot,
      layer: "stem",
      stem: item.stem,
      presence: item.presence,
    });
  }

  for (const item of evidence.branchRelationEvidence.items) {
    addNode({
      slot: item.slot,
      layer: "hiddenStem",
      stem: item.hiddenStem,
      presence: item.presence,
      sourceKey: item.sourceKey,
      exactStemVisible: item.exactStemVisible,
    });
  }

  return nodes;
}

function relationForChain(dayStem: Stem, from: ObservationNode, to: StrengthObservationTargetRef): GenerationChainRelation | null {
  if ("target" in to && to.target === "day-master") {
    if (!isResource(dayStem, from.stem)) return null;
    return "resource-to-day-master";
  }
  return "element-generates";
}

function evidenceRefForFrom(evidence: StrengthEvidence, from: ObservationNode): StrengthObservationEvidenceRef | undefined {
  if (from.layer === "hiddenStem") {
    return { sourceKey: from.sourceKey };
  }
  const side = evidenceSideForStem(evidence, from.slot, from.stem);
  return side ? { evidenceSide: side } : undefined;
}

function buildGenerationChains(evidence: StrengthEvidence, pillars: FourPillars): GenerationChain[] {
  const dayStem = evidence.dayStem;
  const dayMaster = dayMasterRef(pillars);
  const nodes = collectObservationNodes(evidence, pillars, dayStem);
  const candidates: Array<{ chain: GenerationChain; fromPriority: number }> = [];

  const targetNodes: StrengthObservationNodeRef[] = nodes
    .filter((node) => !(node.slot === "day" && node.layer === "stem"))
    .map(({ nodeKey: _nodeKey, fromPriority: _fromPriority, ...nodeRef }) => nodeRef);

  const targets: StrengthObservationTargetRef[] = [dayMaster, ...targetNodes];

  for (const from of nodes) {
    for (const to of targets) {
      if (!("target" in to) && from.nodeKey === nodeKey(to.slot, to.layer, to.stem)) {
        continue;
      }

      if (!elementGenerates(from.element, to.element)) {
        continue;
      }

      const relation = relationForChain(dayStem, from, to);
      if (!relation) {
        continue;
      }

      if ("target" in to && to.target === "day-master" && relation !== "resource-to-day-master") {
        continue;
      }

      const { nodeKey: _nk, fromPriority: priority, ...fromRef } = from;
      candidates.push({
        fromPriority: priority,
        chain: {
          relation,
          from: fromRef,
          to,
          evidenceRef: evidenceRefForFrom(evidence, from),
        },
      });
    }
  }

  const bestByKey = new Map<string, { chain: GenerationChain; fromPriority: number }>();
  for (const candidate of candidates) {
    const key = chainDedupeKey(candidate.chain.relation, candidate.chain.from.stem, candidate.chain.to);
    const existing = bestByKey.get(key);
    if (!existing || candidate.fromPriority < existing.fromPriority) {
      bestByKey.set(key, candidate);
    }
  }

  return [...bestByKey.values()]
    .map((entry) => entry.chain)
    .sort((a, b) => chainDedupeKey(a.relation, a.from.stem, a.to).localeCompare(chainDedupeKey(b.relation, b.from.stem, b.to)));
}

export function buildStrengthObservations(
  pillars: FourPillars,
  evidence: StrengthEvidence = collectStrengthEvidence(pillars),
): StrengthObservations {
  const generationChains = buildGenerationChains(evidence, pillars);
  const elementClusters = buildElementClusters(pillars, evidence);

  return {
    dayStem: evidence.dayStem,
    generationChains,
    elementClusters,
    structureObservation: buildStructureObservations(evidence, { generationChains, elementClusters }),
  };
}

export { buildGenerationChains, chainDedupeKey, collectObservationNodes, targetKey };
