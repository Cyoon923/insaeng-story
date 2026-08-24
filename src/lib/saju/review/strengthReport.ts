import { stemElement } from "@/lib/saju/constants/elements";
import { collectStrengthEvidence, hiddenStemSourceKey } from "@/lib/saju/elements/strength";
import type {
  BranchRelationItem,
  Element,
  FourPillars,
  HiddenStemRole,
  Pillar,
  StrengthEvidence,
} from "@/lib/saju/types";

export type StrengthReviewVisibleItem = {
  slot: string;
  stem: string;
  shiShen: string;
  element: Element;
  elementPhase: string;
  presence: string;
};

export type StrengthReviewRootHit = {
  slot: string;
  branch: string;
  hiddenStem: string;
  hiddenRole: HiddenStemRole;
  polarity: string;
  sourceKey: string;
};

export type StrengthReviewHiddenItem = BranchRelationItem & {
  elementPresence: BranchRelationItem["presence"];
};

export type StrengthReviewReport = {
  pillars: {
    year: Pillar;
    month: Pillar;
    day: Pillar;
    hour: FourPillars["hour"];
  };
  dayStem: string;
  dayElement: Element;
  monthBranch: string;
  hourUnknown: boolean;
  hourNote: string | null;
  includedSlots: string[];
  omittedSlots: string[];
  seasonalEvidence: StrengthEvidence["seasonalEvidence"];
  rootEvidence: {
    hits: StrengthReviewRootHit[];
    hasRoot: boolean;
    rolesSeen: HiddenStemRole[];
  };
  visibleRelations: {
    supportEvidence: StrengthReviewVisibleItem[];
    pressureEvidence: StrengthReviewVisibleItem[];
  };
  hiddenRelations: {
    branchRelationEvidence: StrengthReviewHiddenItem[];
  };
  sourceOverlap: {
    totalRootSources: number;
    totalBranchRelationSources: number;
    overlappingSourceKeys: string[];
  };
};

function visibleItem(
  item: StrengthEvidence["supportEvidence"]["items"][number] | StrengthEvidence["pressureEvidence"]["items"][number],
): StrengthReviewVisibleItem {
  return {
    slot: item.slot,
    stem: item.stem,
    shiShen: item.shiShen,
    element: stemElement(item.stem),
    elementPhase: item.elementPhase,
    presence: item.presence,
  };
}

export function buildStrengthReviewReport(pillars: FourPillars): StrengthReviewReport {
  const evidence = collectStrengthEvidence(pillars);
  const hits = evidence.rootEvidence.hits.map((hit) => ({
    slot: hit.slot,
    branch: hit.branch,
    hiddenStem: hit.hiddenStem,
    hiddenRole: hit.role,
    polarity: hit.polarity,
    sourceKey: hiddenStemSourceKey(hit.slot, hit.branch, hit.hiddenStem, hit.role),
  }));
  const rootKeys = new Set(hits.map((hit) => hit.sourceKey));
  const branchKeys = evidence.branchRelationEvidence.items.map((item) => item.sourceKey);
  const overlappingSourceKeys = branchKeys.filter((key) => rootKeys.has(key));
  const rolesSeen = [...new Set(hits.map((hit) => hit.hiddenRole))];

  return {
    pillars: {
      year: pillars.year,
      month: pillars.month,
      day: pillars.day,
      hour: pillars.hour,
    },
    dayStem: evidence.dayStem,
    dayElement: stemElement(evidence.dayStem),
    monthBranch: pillars.month.branch,
    hourUnknown: evidence.hourUnknown,
    hourNote: evidence.hourUnknown ? "시주가 없으므로 현재 Evidence는 3주 기준" : null,
    includedSlots: evidence.includedSlots,
    omittedSlots: evidence.omittedSlots,
    seasonalEvidence: evidence.seasonalEvidence,
    rootEvidence: {
      hits,
      hasRoot: evidence.rootEvidence.hasRoot,
      rolesSeen,
    },
    visibleRelations: {
      supportEvidence: evidence.supportEvidence.items.map(visibleItem),
      pressureEvidence: evidence.pressureEvidence.items.map(visibleItem),
    },
    hiddenRelations: {
      branchRelationEvidence: evidence.branchRelationEvidence.items.map((item) => ({
        ...item,
        elementPresence: item.presence,
      })),
    },
    sourceOverlap: {
      totalRootSources: rootKeys.size,
      totalBranchRelationSources: new Set(branchKeys).size,
      overlappingSourceKeys,
    },
  };
}
