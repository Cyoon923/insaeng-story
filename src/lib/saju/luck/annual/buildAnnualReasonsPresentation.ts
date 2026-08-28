/**
 * User-facing “왜 이 기운일까요?” reasons from Annual v2 flow evidence.
 * No re-judgment, no winner/policy changes — projection only.
 */

import type { AnnualCandidatePolicy } from "@/lib/saju/luck/annual/deriveAnnualCandidatePolicyStates";
import type { AnnualPresentationGate } from "@/lib/saju/luck/annual/deriveAnnualPresentationGate";
import type {
  AnnualSupplementFlowV2Resolution,
  AnnualSupplementFlowV2WinnerInput,
} from "@/lib/saju/luck/annual/resolveAnnualSupplementFlowV2";
import type {
  AnnualCandidateSafetyRecord,
  AnnualGoalSatisfaction,
  AnnualImbalance,
  AnnualLuckEvidence,
  NatalDeficitGoal,
} from "@/lib/saju/luck/annual/types";
import type { Element } from "@/lib/saju/types";

export type AnnualReasonCategory =
  | "ANNUAL_ARRIVAL"
  | "CORE_ANNUAL_RELATION"
  | "BASELINE_SUPPORT"
  | "STRUCTURAL_CONNECTION"
  | "SUPPLEMENT_ANNUAL_OFFSET"
  | "CLIMATE_NOTICE";

export type AnnualReasonItem = {
  category: AnnualReasonCategory;
  text: string;
};

export type AnnualReasonsPresentation = {
  title: string;
  items: AnnualReasonItem[];
};

export type BuildAnnualReasonsPresentationInput = {
  year: number;
  evidence: AnnualLuckEvidence | null;
  natalGoals: NatalDeficitGoal[];
  goalSatisfactions: AnnualGoalSatisfaction[];
  imbalances: AnnualImbalance[];
  candidatePolicies: AnnualCandidatePolicy[];
  safeties: AnnualCandidateSafetyRecord[];
  winnerInput: AnnualSupplementFlowV2WinnerInput | null;
  resolution: AnnualSupplementFlowV2Resolution;
  presentationGate: AnnualPresentationGate;
};

const REASON_TITLE = "왜 이 기운일까요?";

const ELEMENT_NAME: Record<Element, string> = {
  木: "나무",
  火: "불",
  土: "흙",
  金: "금",
  水: "물",
};

/** Topic particle 은/는 for a Hangul common noun (presentation only). */
function topicParticle(word: string): "은" | "는" {
  const last = word[word.length - 1];
  if (!last) return "는";
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return "는";
  return (code - 0xac00) % 28 === 0 ? "는" : "은";
}

function withTopicParticle(word: string): string {
  return `${word}${topicParticle(word)}`;
}

const SELECTION_ORDER: AnnualReasonCategory[] = [
  "ANNUAL_ARRIVAL",
  "STRUCTURAL_CONNECTION",
  "CORE_ANNUAL_RELATION",
  "BASELINE_SUPPORT",
  "CLIMATE_NOTICE",
  "SUPPLEMENT_ANNUAL_OFFSET",
];

function elementLabel(element: Element): string {
  return `${ELEMENT_NAME[element]}(${element})`;
}

function uniqueArrivalElements(evidence: AnnualLuckEvidence): Element[] {
  const seen = new Set<Element>();
  const out: Element[] = [];
  for (const signal of evidence.signals) {
    if (seen.has(signal.element)) continue;
    seen.add(signal.element);
    out.push(signal.element);
  }
  return out;
}

function primaryArrivalElement(evidence: AnnualLuckEvidence): Element {
  return evidence.signals[0]?.element ?? uniqueArrivalElements(evidence)[0]!;
}

function joinArrivalLabels(elements: Element[]): string {
  const labels = elements.map(elementLabel);
  if (labels.length === 1) return labels[0]!;
  if (labels.length === 2) return `${labels[0]}과 ${labels[1]}`;
  const head = labels.slice(0, -1).join(", ");
  return `${head}, ${labels[labels.length - 1]}`;
}

function buildAnnualArrival(
  year: number,
  evidence: AnnualLuckEvidence,
): AnnualReasonItem | null {
  const elements = uniqueArrivalElements(evidence);
  if (elements.length === 0) return null;
  const joined = joinArrivalLabels(elements);
  return {
    category: "ANNUAL_ARRIVAL",
    text: `${year}년에는 ${joined}의 기운이 들어와요.`,
  };
}

function buildCoreAnnualRelation(
  evidence: AnnualLuckEvidence,
  goalSatisfactions: AnnualGoalSatisfaction[],
): AnnualReasonItem | null {
  const coreSupport = goalSatisfactions.find((row) => row.goal === "CORE_SUPPORT");
  if (!coreSupport || coreSupport.status !== "partially-met") return null;

  const supportsCore = evidence.signals.some(
    (signal) =>
      signal.relationToNatalCore === "same" ||
      signal.relationToNatalCore === "generates",
  );
  if (!supportsCore) return null;

  const arrivalName = ELEMENT_NAME[primaryArrivalElement(evidence)];
  return {
    category: "CORE_ANNUAL_RELATION",
    text: `올해 들어온 ${arrivalName}의 기운이 기본 흐름을 일부 보태고 있어요.`,
  };
}

function hasStructuralConnection(
  winner: Element,
  natalGoals: NatalDeficitGoal[],
  winnerInput: AnnualSupplementFlowV2WinnerInput | null,
): boolean {
  const incomingGoal = natalGoals.find(
    (goal) =>
      goal.kind === "INCOMING_MEDIATION" && goal.sourceElement === winner,
  );
  if (!incomingGoal || !winnerInput) return false;

  const candidate = winnerInput.candidates.find((row) => row.element === winner);
  return Boolean(
    candidate?.residualGoalsAddressed.includes("INCOMING_MEDIATION"),
  );
}

function buildStructuralConnection(
  winner: Element,
  natalGoals: NatalDeficitGoal[],
  winnerInput: AnnualSupplementFlowV2WinnerInput | null,
): AnnualReasonItem | null {
  if (!hasStructuralConnection(winner, natalGoals, winnerInput)) return null;
  const winnerName = ELEMENT_NAME[winner];
  return {
    category: "STRUCTURAL_CONNECTION",
    text: `${withTopicParticle(winnerName)} 기본 흐름에서 기운을 이어주는 연결 역할을 해요.`,
  };
}

function buildBaselineSupport(
  winner: Element,
  natalGoals: NatalDeficitGoal[],
): AnnualReasonItem | null {
  const coreGoal = natalGoals.find(
    (goal) => goal.kind === "CORE_SUPPORT" && goal.sourceElement === winner,
  );
  if (!coreGoal) return null;

  const hasCoreBaseline = coreGoal.sourceFunctions.some(
    (fn) => fn === "F1_DIRECT" || fn === "F2_GENERATIVE",
  );
  if (!hasCoreBaseline) return null;

  const winnerName = ELEMENT_NAME[winner];
  return {
    category: "BASELINE_SUPPORT",
    text: `${withTopicParticle(winnerName)} 원래의 균형을 받쳐주는 기본 방향이기도 해요.`,
  };
}

function buildSupplementAnnualOffset(
  winner: Element,
  candidatePolicies: AnnualCandidatePolicy[],
  imbalances: AnnualImbalance[],
): AnnualReasonItem | null {
  const policy = candidatePolicies.find((row) => row.element === winner);
  const hasA3 = policy?.positiveFunctions.includes("A3_SUPPLEMENT_OFFSET") ?? false;
  const hasDrain = imbalances.some((row) => row.kind === "SUPPLEMENT_DRAIN_SHIFT");
  if (!hasA3 && !hasDrain) return null;

  return {
    category: "SUPPLEMENT_ANNUAL_OFFSET",
    text: "올해의 기운이 평소 균형과 맞물리면서, 보강 방향도 함께 살펴볼 필요가 있어요.",
  };
}

function climateNoticeText(imbalances: AnnualImbalance[]): string {
  const climateRisk = imbalances.find((row) => row.kind === "CLIMATE_REINFORCEMENT_RISK");
  if (climateRisk?.evidence.some((line) => line.includes("warm-or-dry"))) {
    return "올해는 열과 건조의 흐름도 함께 살펴볼 필요가 있어요.";
  }
  if (climateRisk?.evidence.some((line) => line.includes("cold-or-moist"))) {
    return "올해는 한기와 습기의 흐름도 함께 살펴볼 필요가 있어요.";
  }
  return "올해는 기후 흐름도 함께 살펴볼 필요가 있어요.";
}

function buildClimateNotice(
  presentationGate: AnnualPresentationGate,
  resolution: AnnualSupplementFlowV2Resolution,
  imbalances: AnnualImbalance[],
): AnnualReasonItem | null {
  if (presentationGate.selectionDisplayStatus !== "displayable-partial") {
    return null;
  }

  const hasClimateImbalance =
    resolution.unresolvedImbalances.includes("NEW_CLIMATE_IMBALANCE") ||
    imbalances.some((row) => row.kind === "CLIMATE_REINFORCEMENT_RISK");
  if (!hasClimateImbalance) return null;

  return {
    category: "CLIMATE_NOTICE",
    text: climateNoticeText(imbalances),
  };
}

function collectCandidates(
  input: BuildAnnualReasonsPresentationInput,
  winner: Element,
): Map<AnnualReasonCategory, AnnualReasonItem> {
  const map = new Map<AnnualReasonCategory, AnnualReasonItem>();

  if (input.evidence) {
    const arrival = buildAnnualArrival(input.year, input.evidence);
    if (arrival) map.set(arrival.category, arrival);

    const coreRelation = buildCoreAnnualRelation(
      input.evidence,
      input.goalSatisfactions,
    );
    if (coreRelation) map.set(coreRelation.category, coreRelation);
  }

  const structural = buildStructuralConnection(
    winner,
    input.natalGoals,
    input.winnerInput,
  );
  if (structural) map.set(structural.category, structural);

  const baseline = buildBaselineSupport(winner, input.natalGoals);
  if (baseline) map.set(baseline.category, baseline);

  const offset = buildSupplementAnnualOffset(
    winner,
    input.candidatePolicies,
    input.imbalances,
  );
  if (offset) map.set(offset.category, offset);

  const climate = buildClimateNotice(
    input.presentationGate,
    input.resolution,
    input.imbalances,
  );
  if (climate) map.set(climate.category, climate);

  return map;
}

function selectReasonItems(
  candidates: Map<AnnualReasonCategory, AnnualReasonItem>,
  isPartial: boolean,
): AnnualReasonItem[] {
  const maxItems = isPartial ? 3 : 2;
  const hasStructural = candidates.has("STRUCTURAL_CONNECTION");
  const selected: AnnualReasonItem[] = [];

  for (const category of SELECTION_ORDER) {
    if (selected.length >= maxItems) break;

    if (
      hasStructural &&
      (category === "CORE_ANNUAL_RELATION" || category === "BASELINE_SUPPORT")
    ) {
      continue;
    }

    if (category === "CLIMATE_NOTICE" && !isPartial) continue;

    const item = candidates.get(category);
    if (item) selected.push(item);
  }

  return selected;
}

function isReasonSectionHidden(gate: AnnualPresentationGate): boolean {
  return (
    gate.selectionDisplayStatus === "blocked" ||
    gate.presentationElement === null ||
    !gate.showAnnualElement
  );
}

/**
 * Build up to 2 (resolved) or 3 (displayable-partial) user-facing annual reasons.
 */
export function buildAnnualReasonsPresentation(
  input: BuildAnnualReasonsPresentationInput,
): AnnualReasonsPresentation {
  if (isReasonSectionHidden(input.presentationGate)) {
    return { title: REASON_TITLE, items: [] };
  }

  const winner = input.presentationGate.presentationElement;
  if (winner === null) {
    return { title: REASON_TITLE, items: [] };
  }

  const candidates = collectCandidates(input, winner);
  const isPartial =
    input.presentationGate.selectionDisplayStatus === "displayable-partial";

  return {
    title: REASON_TITLE,
    items: selectReasonItems(candidates, isPartial),
  };
}
