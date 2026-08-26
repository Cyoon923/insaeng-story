import type { FreeDirectionItem, FreeInterpretation } from "@/lib/saju/interpretation/types";
import type {
  ObservationActingItem,
  ObservationCoexistenceItem,
  ObservationHelpingItem,
  ObservationHiddenContextItem,
  ObservationInterpretation,
} from "@/lib/saju/observation/interpretation/types";

const HELPING_KIND_PRIORITY: Record<ObservationHelpingItem["kind"], number> = {
  "generation-support": 0,
  "peer-support": 1,
  "resource-support": 2,
};

const ACTING_KIND_PRIORITY: Record<ObservationActingItem["kind"], number> = {
  "pressure-branch-anchor": 0,
  "pressure-visible-stem": 1,
};

export type CompactObservationView = {
  basicHelping: ObservationHelpingItem[];
  basicActing: ObservationActingItem[];
  basicCoexistence: ObservationCoexistenceItem | null;
  basicClimateNote: FreeDirectionItem | null;
  detailHelping: ObservationHelpingItem[];
  detailActing: ObservationActingItem[];
  detailCoexistence: ObservationCoexistenceItem | null;
  detailExplanation: string | null;
  detailUncertaintyNotes: string[];
  detailHiddenContext: ObservationHiddenContextItem[];
  detailSupportItems: FreeDirectionItem[];
  detailCautionItems: FreeDirectionItem[];
  detailClimateNotes: FreeDirectionItem[];
};

export function isMixedNullStyleHeadline(headline: string): boolean {
  return (
    headline.includes("단정하기 어려") ||
    headline.includes("여러 가능성을 가볍게") ||
    headline.includes("한쪽 흐름만으로 설명하기 어려") ||
    headline.includes("어느 한쪽 흐름이라고 정하기 어려") ||
    headline.includes("서로 다른 힘이 함께 작용")
  );
}

function helpingPrimaryElement(item: ObservationHelpingItem): string {
  return item.elements[0] ?? "";
}

function sortHelping(items: ObservationHelpingItem[]): ObservationHelpingItem[] {
  return [...items].sort((a, b) => {
    const kindDiff = HELPING_KIND_PRIORITY[a.kind] - HELPING_KIND_PRIORITY[b.kind];
    if (kindDiff !== 0) return kindDiff;
    return a.order - b.order;
  });
}

function dedupeHelpingByElement(items: ObservationHelpingItem[]): {
  kept: ObservationHelpingItem[];
  dropped: ObservationHelpingItem[];
} {
  const sorted = sortHelping(items);
  const kept: ObservationHelpingItem[] = [];
  const dropped: ObservationHelpingItem[] = [];
  const seenElements = new Set<string>();

  for (const item of sorted) {
    const primary = helpingPrimaryElement(item);
    if (primary && seenElements.has(primary)) {
      dropped.push(item);
      continue;
    }
    if (primary) seenElements.add(primary);
    kept.push(item);
  }

  return { kept, dropped };
}

function selectActing(
  items: ObservationActingItem[],
): { basic: ObservationActingItem[]; detail: ObservationActingItem[] } {
  const byElement = new Map<string, ObservationActingItem[]>();
  for (const item of items) {
    const list = byElement.get(item.element) ?? [];
    list.push(item);
    byElement.set(item.element, list);
  }

  const basicCandidates: ObservationActingItem[] = [];
  const detail: ObservationActingItem[] = [];

  for (const group of byElement.values()) {
    const sorted = [...group].sort(
      (a, b) => ACTING_KIND_PRIORITY[a.kind] - ACTING_KIND_PRIORITY[b.kind] || a.order - b.order,
    );
    basicCandidates.push(sorted[0]!);
    detail.push(...sorted.slice(1));
  }

  basicCandidates.sort(
    (a, b) => ACTING_KIND_PRIORITY[a.kind] - ACTING_KIND_PRIORITY[b.kind] || a.order - b.order,
  );

  return {
    basic: basicCandidates.slice(0, 1),
    detail: [...basicCandidates.slice(1), ...detail],
  };
}

export function selectCompactObservation(input: {
  headline: string;
  interpretation: FreeInterpretation;
  observation: ObservationInterpretation;
}): CompactObservationView {
  const { headline, interpretation, observation } = input;

  const { kept: dedupedHelping, dropped: duplicateHelping } = dedupeHelpingByElement(
    observation.helpingRelations,
  );
  const basicHelping = dedupedHelping.slice(0, 2);
  const overflowHelping = dedupedHelping.slice(2);

  const { basic: basicActing, detail: overflowActing } = selectActing(observation.actingStructures);

  const hideCoexistenceOnBasic = isMixedNullStyleHeadline(headline);
  const basicCoexistence = hideCoexistenceOnBasic ? null : observation.coexistence;
  const detailCoexistence = hideCoexistenceOnBasic ? observation.coexistence : null;

  const [basicClimateNote, ...extraClimateNotes] = interpretation.climateNotes;

  const hourUnknownNote = "태어난 시간을 알면 해석이 달라질 수 있어요.";
  const detailUncertaintyNotes = interpretation.uncertaintyNotes.filter(
    (note) => note !== hourUnknownNote,
  );

  return {
    basicHelping,
    basicActing,
    basicCoexistence,
    basicClimateNote: basicClimateNote ?? null,
    detailHelping: [...overflowHelping, ...duplicateHelping],
    detailActing: overflowActing,
    detailCoexistence: hideCoexistenceOnBasic ? detailCoexistence : null,
    detailExplanation: interpretation.explanation,
    detailUncertaintyNotes,
    detailHiddenContext: observation.hiddenContextDetail,
    detailSupportItems: interpretation.supportItems,
    detailCautionItems: interpretation.cautionItems,
    detailClimateNotes: extraClimateNotes,
  };
}

export const HOUR_UNKNOWN_NOTE = "태어난 시간을 알면 해석이 달라질 수 있어요.";
