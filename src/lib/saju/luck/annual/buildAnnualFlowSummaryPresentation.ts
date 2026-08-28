/**
 * User-facing factual “2026 전체 흐름” summary from Annual v2 evidence.
 * Projects relations / satisfaction / imbalance only — no winner, no narrative archetypes.
 */

import type { AnnualSupplementFlowV2Resolution } from "@/lib/saju/luck/annual/resolveAnnualSupplementFlowV2";
import type {
  AnnualGoalSatisfaction,
  AnnualImbalance,
  AnnualLuckEvidence,
  AnnualRelationKind,
  AnnualResidualGoal,
  AnnualSignal,
} from "@/lib/saju/luck/annual/types";

export type AnnualFlowSummaryPresentation = {
  year: number;
  title: string;
  sentences: string[];
};

export type BuildAnnualFlowSummaryPresentationInput = {
  year: number;
  evidence: AnnualLuckEvidence | null;
  goalSatisfactions: AnnualGoalSatisfaction[];
  imbalances: AnnualImbalance[];
  resolution: AnnualSupplementFlowV2Resolution;
};

const MAX_SENTENCES = 4;

function titleForYear(year: number): string {
  return `${year}년 전체 흐름`;
}

function unifiedRelation(
  signals: AnnualSignal[],
  target: "core" | "supplement",
): AnnualRelationKind | "mixed" | null {
  const relations = signals
    .map((signal) =>
      target === "core"
        ? signal.relationToNatalCore
        : signal.relationToNatalSupplement,
    )
    .filter((relation): relation is AnnualRelationKind => relation !== null);

  if (relations.length === 0) return null;

  const unique = new Set(relations);
  if (unique.size === 1) return relations[0]!;
  return "mixed";
}

function coreRelationSentence(relation: AnnualRelationKind | "mixed"): string | null {
  switch (relation) {
    case "same":
      return "올해 들어오는 기운이 나의 중심 흐름과 같은 방향으로 만나요.";
    case "generates":
      return "올해 들어오는 기운이 나의 중심 흐름을 이어주는 방향으로 작용할 수 있어요.";
    case "generated-by":
      return "올해 들어오는 기운이 나의 중심 흐름에서 이어 받는 쪽으로 작용할 수 있어요.";
    case "controls":
      return "올해 들어오는 기운이 나의 중심 흐름과 맞서는 쪽으로 작용할 수 있어요.";
    case "controlled-by":
      return "올해 들어오는 기운이 나의 중심 흐름과 거리를 두는 쪽으로 작용할 수 있어요.";
    case "mixed":
      return "올해 들어오는 기운이 나의 중심 흐름과 만나는 방식이 한쪽으로만 읽히지 않아요.";
    default:
      return null;
  }
}

function supplementRelationSentence(
  relation: AnnualRelationKind | "mixed",
): string | null {
  switch (relation) {
    case "same":
      return "올해 들어오는 기운이 평소 보강 방향과 같은 쪽으로 만나요.";
    case "generates":
      return "올해 들어오는 기운이 평소 보강 방향을 이어주는 쪽으로 작용할 수 있어요.";
    case "generated-by":
      return "올해 들어오는 기운이 평소 보강 방향과 이어지는 관계로 작용할 수 있어요.";
    case "controls":
      return "올해 들어오는 기운이 평소 보강 방향과 맞서는 쪽으로 작용할 수 있어요.";
    case "controlled-by":
      return "올해 들어오는 기운이 평소 보강 방향과 거리를 두는 쪽으로 작용할 수 있어요.";
    case "mixed":
      return "올해 들어오는 기운이 평소 보강 방향과 만나는 방식이 한쪽으로만 읽히지 않아요.";
    default:
      return null;
  }
}

function satisfactionByGoal(
  rows: AnnualGoalSatisfaction[],
): Map<AnnualResidualGoal, AnnualGoalSatisfaction> {
  const map = new Map<AnnualResidualGoal, AnnualGoalSatisfaction>();
  for (const row of rows) {
    map.set(row.goal, row);
  }
  return map;
}

function goalSatisfactionSentence(row: AnnualGoalSatisfaction | undefined): string | null {
  if (!row) return null;

  if (row.goal === "CORE_SUPPORT") {
    if (row.status === "partially-met") {
      return "올해 흐름이 나의 중심 흐름을 일부 보태는 쪽으로 읽혀요.";
    }
    if (row.status === "not-met") {
      return "올해 흐름이 나의 중심 흐름을 보태는 쪽으로는 아직 충분히 맞지 않아요.";
    }
    return null;
  }

  if (row.goal === "INCOMING_MEDIATION") {
    if (row.status === "partially-met") {
      return "연결을 이어주는 흐름이 일부 보이는 쪽으로 읽혀요.";
    }
    if (row.status === "not-met") {
      return "연결을 이어주는 흐름은 아직 충분히 맞지 않아요.";
    }
    return null;
  }

  if (row.goal === "CLIMATE_MITIGATION") {
    if (row.status === "partially-met") {
      return "올해 흐름이 기후 균형을 일부 보완하는 쪽으로 읽혀요.";
    }
    if (row.status === "not-met") {
      return "올해 흐름이 기후 균형을 보완하는 쪽으로는 아직 충분히 맞지 않아요.";
    }
    return null;
  }

  return null;
}

function hasImbalance(
  imbalances: AnnualImbalance[],
  kind: AnnualImbalance["kind"],
): boolean {
  return imbalances.some((row) => row.kind === kind);
}

function climateRiskSentence(imbalances: AnnualImbalance[]): string | null {
  const risk = imbalances.find((row) => row.kind === "CLIMATE_REINFORCEMENT_RISK");
  if (!risk) return null;

  const warmDry = risk.evidence.some((line) => line.includes("warm-or-dry"));
  const coldMoist = risk.evidence.some((line) => line.includes("cold-or-moist"));
  if (!warmDry && !coldMoist) return null;

  return "올해는 한쪽 흐름이 겹쳐 나타날 수 있어요.";
}

function supplementDrainSentence(imbalances: AnnualImbalance[]): string | null {
  if (!hasImbalance(imbalances, "SUPPLEMENT_DRAIN_SHIFT")) return null;
  return "올해 흐름과 평소 보강 방향 사이의 관계가 평소와 달라질 수 있어요.";
}

function coreReinforcementSentence(imbalances: AnnualImbalance[]): string | null {
  if (!hasImbalance(imbalances, "CORE_REINFORCEMENT_RISK")) return null;
  return "중심 흐름과 같은 방향의 기운이 겹쳐 나타날 수 있어요.";
}

function pushUnique(out: string[], sentence: string | null): void {
  if (!sentence) return;
  if (out.includes(sentence)) return;
  if (out.length >= MAX_SENTENCES) return;
  out.push(sentence);
}

/**
 * Build up to four factual annual-flow summary sentences for section 03.
 */
export function buildAnnualFlowSummaryPresentation(
  input: BuildAnnualFlowSummaryPresentationInput,
): AnnualFlowSummaryPresentation {
  const { year, evidence, goalSatisfactions, imbalances } = input;
  const sentences: string[] = [];

  if (evidence && evidence.signals.length > 0) {
    const coreRelation = unifiedRelation(evidence.signals, "core");
    if (coreRelation) {
      pushUnique(sentences, coreRelationSentence(coreRelation));
    }

    const hasSupplement = evidence.signals.some(
      (signal) => signal.relationToNatalSupplement !== null,
    );
    const hasDrain = hasImbalance(imbalances, "SUPPLEMENT_DRAIN_SHIFT");

    if (hasSupplement && !hasDrain) {
      const supplementRelation = unifiedRelation(evidence.signals, "supplement");
      if (supplementRelation) {
        pushUnique(sentences, supplementRelationSentence(supplementRelation));
      }
    }
  }

  const byGoal = satisfactionByGoal(goalSatisfactions);
  pushUnique(sentences, goalSatisfactionSentence(byGoal.get("CORE_SUPPORT")));
  pushUnique(sentences, goalSatisfactionSentence(byGoal.get("INCOMING_MEDIATION")));
  pushUnique(sentences, goalSatisfactionSentence(byGoal.get("CLIMATE_MITIGATION")));

  pushUnique(sentences, climateRiskSentence(imbalances));
  pushUnique(sentences, supplementDrainSentence(imbalances));
  pushUnique(sentences, coreReinforcementSentence(imbalances));

  return {
    year,
    title: titleForYear(year),
    sentences: sentences.slice(0, MAX_SENTENCES),
  };
}
