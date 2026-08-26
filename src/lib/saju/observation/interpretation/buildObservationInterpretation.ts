import type {
  ObservationActingItem,
  ObservationCoexistenceItem,
  ObservationHelpingItem,
  ObservationHiddenContextItem,
  ObservationInterpretation,
} from "@/lib/saju/observation/interpretation/types";
import type {
  StructureObservation,
  SupportStructureRelation,
} from "@/lib/saju/observation/types";
import type { Element, Stem } from "@/lib/saju/types";

const ELEMENT_SOFT: Record<Element, string> = {
  木: "나무",
  火: "불",
  土: "흙",
  金: "쇠",
  水: "물",
};

const COEXISTENCE_TEXT = "나를 돕는 관계와 다른 성질이 함께 나타나는 모습이 보여요.";

const FORBIDDEN_USER_PHRASES = [
  "용신",
  "희신",
  "필요하",
  "보충",
  "강하",
  "과다",
  "나쁘",
  "재성",
  "정인",
  "겁재",
  "식신",
  "편재",
  "정재",
  "generation-support",
  "resource-support",
  "peer-support",
  "pressure-visible-stem",
  "pressure-branch-anchor",
  "pressure-hidden-context",
];

function soft(element: Element): string {
  return ELEMENT_SOFT[element];
}

/** Korean 와/과 after a Hangul noun. */
function waGwa(word: string): string {
  const last = word.at(-1);
  if (!last) return "와";
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return "와";
  return (code - 0xac00) % 28 === 0 ? "와" : "과";
}

function generationSupportText(relation: SupportStructureRelation): string {
  const from = soft(relation.elements[0]!);
  const to = soft(relation.elements[1]!);
  return `${from}${waGwa(from)} ${to}의 성질이 서로 이어지는 관계가 보여요.`;
}

function resourceSupportText(element: Element): string {
  return `${soft(element)}의 성질이 나와 이어지는 관계도 보여요.`;
}

function peerSupportText(element: Element): string {
  return `같은 ${soft(element)}의 성질이 함께 자리하는 모습이 보여요.`;
}

function visibleStemPressureText(element: Element): string {
  return `${soft(element)}의 성질이 겉으로 드러난 자리에서도 보여요.`;
}

function branchAnchorPressureText(element: Element): string {
  return `${soft(element)}의 성질이 여러 자리에서 함께 나타나요.`;
}

function hiddenContextText(element: Element): string {
  return `${soft(element)}의 성질이 안쪽 흐름에도 보이는 자리가 있어요.`;
}

function helpingRelationsFrom(structure: StructureObservation): ObservationHelpingItem[] {
  const items: ObservationHelpingItem[] = [];
  let order = 0;

  for (const relation of structure.supportRelations) {
    if (relation.kind === "generation-support") {
      items.push({
        kind: "generation-support",
        text: generationSupportText(relation),
        elements: [...relation.elements],
        order: order++,
      });
    } else if (relation.kind === "resource-support") {
      const element = relation.elements[0]!;
      items.push({
        kind: "resource-support",
        text: resourceSupportText(element),
        elements: [element],
        order: order++,
      });
    } else if (relation.kind === "peer-support") {
      const element = relation.elements[0]!;
      items.push({
        kind: "peer-support",
        text: peerSupportText(element),
        elements: [element],
        order: order++,
      });
    }
  }

  return items;
}

function actingStructuresFrom(structure: StructureObservation): ObservationActingItem[] {
  const items: ObservationActingItem[] = [];
  let order = 0;

  for (const relation of structure.pressureRelations) {
    if (relation.kind === "pressure-visible-stem") {
      items.push({
        kind: "pressure-visible-stem",
        element: relation.element,
        text: visibleStemPressureText(relation.element),
        order: order++,
      });
    }
    if (relation.kind === "pressure-branch-anchor" && relation.slots.length >= 2) {
      items.push({
        kind: "pressure-branch-anchor",
        element: relation.element,
        text: branchAnchorPressureText(relation.element),
        order: order++,
      });
    }
  }

  return items;
}

function hiddenContextDetailFrom(structure: StructureObservation): ObservationHiddenContextItem[] {
  return structure.pressureRelations
    .filter((relation) => relation.kind === "pressure-hidden-context")
    .map((relation) => ({
      element: relation.element,
      text: hiddenContextText(relation.element),
      detailOnly: true as const,
    }));
}

function coexistenceFrom(structure: StructureObservation): ObservationCoexistenceItem | null {
  if (structure.coexistenceNotes.length === 0) {
    return null;
  }
  return {
    kind: "support-and-pressure-coexist",
    text: COEXISTENCE_TEXT,
  };
}

export function buildObservationInterpretation(input: {
  dayStem: Stem;
  structureObservation: StructureObservation;
}): ObservationInterpretation {
  const { structureObservation } = input;

  return {
    dayStem: input.dayStem,
    helpingRelations: helpingRelationsFrom(structureObservation),
    actingStructures: actingStructuresFrom(structureObservation),
    coexistence: coexistenceFrom(structureObservation),
    hiddenContextDetail: hiddenContextDetailFrom(structureObservation),
  };
}

export function buildObservationInterpretationFromDayStem(
  dayStem: Stem,
  structureObservation: StructureObservation,
): ObservationInterpretation {
  return buildObservationInterpretation({ dayStem, structureObservation });
}

/** Test helper: ensure user-facing copy stays plain Korean. */
export function assertObservationInterpretationCopySafe(interpretation: ObservationInterpretation): void {
  const texts = [
    ...interpretation.helpingRelations.map((item) => item.text),
    ...interpretation.actingStructures.map((item) => item.text),
    ...(interpretation.coexistence ? [interpretation.coexistence.text] : []),
    ...interpretation.hiddenContextDetail.map((item) => item.text),
  ].join("\n");

  for (const phrase of FORBIDDEN_USER_PHRASES) {
    if (texts.includes(phrase)) {
      throw new Error(`Forbidden phrase in observation interpretation copy: ${phrase}`);
    }
  }
}

export { ELEMENT_SOFT, soft };
