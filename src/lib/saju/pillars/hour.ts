import { BRANCHES } from "@/lib/saju/types";
import { ZI_HOUR_STEM_BY_DAY_STEM, stemByIndex, stemIndex } from "@/lib/saju/constants/ganzhi";
import type { Pillar, Stem } from "@/lib/saju/types";

export function hourBranchIndex(hour: number): number {
  return Math.floor(((hour + 1) % 24) / 2);
}

export function hourPillar(dayStem: Stem, hour: number): Pillar {
  const branchIndex = hourBranchIndex(hour);
  const ziStem = ZI_HOUR_STEM_BY_DAY_STEM[dayStem];
  return {
    stem: stemByIndex(stemIndex(ziStem) + branchIndex),
    branch: BRANCHES[branchIndex],
  };
}

export function listHourCandidates(dayStem: Stem): Pillar[] {
  return Array.from({ length: 12 }, (_, index) => ({
    stem: stemByIndex(stemIndex(ZI_HOUR_STEM_BY_DAY_STEM[dayStem]) + index),
    branch: BRANCHES[index],
  }));
}
