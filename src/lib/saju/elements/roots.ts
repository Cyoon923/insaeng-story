import { stemElement } from "@/lib/saju/constants/elements";
import { hiddenStemsOf } from "@/lib/saju/data/hiddenStems";
import { confirmedSlots } from "@/lib/saju/elements/slots";
import type { FourPillars, RootHit, Stem, StemRootAnalysis } from "@/lib/saju/types";

export function analyzeStemRoots(pillars: FourPillars, stem: Stem): StemRootAnalysis {
  const element = stemElement(stem);
  const hits: RootHit[] = [];

  for (const { slot, pillar } of confirmedSlots(pillars)) {
    for (const part of hiddenStemsOf(pillar.branch)) {
      if (stemElement(part.stem) !== element) continue;
      hits.push({
        slot,
        branch: pillar.branch,
        hiddenStem: part.stem,
        role: part.role,
        polarity: part.stem === stem ? "비견" : "겁재",
      });
    }
  }

  return {
    stem,
    element,
    hourUnknown: pillars.hour === "unknown",
    hits,
  };
}
