import { stemElement } from "@/lib/saju/constants/elements";
import { hiddenStemsOf } from "@/lib/saju/data/hiddenStems";
import { shiShenOf } from "@/lib/saju/data/shiShen";
import { analyzeElementPresence } from "@/lib/saju/elements/presence";
import { analyzeStemRoots } from "@/lib/saju/elements/roots";
import { confirmedSlots } from "@/lib/saju/elements/slots";
import { labelStemSeasonPhase, seasonPhaseOf } from "@/lib/saju/elements/season";
import type {
  Branch,
  BranchRelationItem,
  FourPillars,
  HiddenStemRole,
  PillarSlot,
  PressureEvidence,
  PressureShiShen,
  Stem,
  StrengthEvidence,
  StrengthRelationItem,
  StrengthStemSlot,
  SupportEvidence,
  SupportShiShen,
} from "@/lib/saju/types";

export function hiddenStemSourceKey(
  slot: PillarSlot,
  branch: Branch,
  hiddenStem: Stem,
  hiddenRole: HiddenStemRole,
): string {
  return `${slot}:${branch}:${hiddenStem}:${hiddenRole}`;
}

const SUPPORT_SHI_SHEN: ReadonlySet<SupportShiShen> = new Set(["비견", "겁재", "편인", "정인"]);
const PRESSURE_SHI_SHEN: ReadonlySet<PressureShiShen> = new Set([
  "식신",
  "상관",
  "편재",
  "정재",
  "편관",
  "정관",
]);

function isSupportShiShen(value: string): value is SupportShiShen {
  return SUPPORT_SHI_SHEN.has(value as SupportShiShen);
}

function isPressureShiShen(value: string): value is PressureShiShen {
  return PRESSURE_SHI_SHEN.has(value as PressureShiShen);
}

export function collectStrengthEvidence(pillars: FourPillars): StrengthEvidence {
  const dayStem = pillars.day.stem;
  const monthBranch = pillars.month.branch;
  const hourUnknown = pillars.hour === "unknown";
  const roots = analyzeStemRoots(pillars, dayStem);
  const hits = hourUnknown ? roots.hits.filter((hit) => hit.slot !== "hour") : roots.hits;

  const supportItems: SupportEvidence["items"] = [];
  const pressureItems: PressureEvidence["items"] = [];

  function addStem(slot: StrengthStemSlot, stem: Stem) {
    const shiShen = shiShenOf(dayStem, stem);
    const presence = analyzeElementPresence(pillars, stemElement(stem)).presence;
    const item: StrengthRelationItem = {
      slot,
      layer: "stem",
      stem,
      shiShen,
      elementPhase: seasonPhaseOf(stemElement(stem), monthBranch),
      presence,
    };

    if (isSupportShiShen(shiShen)) {
      supportItems.push({ ...item, shiShen });
    } else if (isPressureShiShen(shiShen)) {
      pressureItems.push({ ...item, shiShen });
    }
  }

  addStem("year", pillars.year.stem);
  addStem("month", pillars.month.stem);
  if (pillars.hour !== "unknown") {
    addStem("hour", pillars.hour.stem);
  }

  const confirmed = confirmedSlots(pillars);
  const branchItems: BranchRelationItem[] = [];
  for (const { slot, pillar } of confirmed) {
    for (const part of hiddenStemsOf(pillar.branch)) {
      const shiShen = shiShenOf(dayStem, part.stem);
      const element = stemElement(part.stem);
      const exactStemVisibleAt = confirmed
        .filter(({ pillar: visiblePillar }) => visiblePillar.stem === part.stem)
        .map(({ slot: visibleSlot }) => visibleSlot);
      branchItems.push({
        slot,
        branch: pillar.branch,
        hiddenStem: part.stem,
        hiddenRole: part.role,
        sourceKey: hiddenStemSourceKey(slot, pillar.branch, part.stem, part.role),
        shiShen,
        relationSide: isSupportShiShen(shiShen) ? "support" : "pressure",
        element,
        elementPhase: seasonPhaseOf(element, monthBranch),
        presence: analyzeElementPresence(pillars, element).presence,
        exactStemVisible: exactStemVisibleAt.length > 0,
        exactStemVisibleAt,
      });
    }
  }

  return {
    dayStem,
    hourUnknown,
    includedSlots: hourUnknown ? ["year", "month", "day"] : ["year", "month", "day", "hour"],
    omittedSlots: hourUnknown ? ["hour"] : [],
    seasonalEvidence: labelStemSeasonPhase(dayStem, monthBranch),
    rootEvidence: {
      hits,
      hasRoot: hits.length > 0,
    },
    supportEvidence: { items: supportItems },
    pressureEvidence: { items: pressureItems },
    branchRelationEvidence: { items: branchItems },
  };
}
