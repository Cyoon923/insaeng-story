import { branchElement, stemElement } from "@/lib/saju/constants/elements";
import { hiddenStemsOf } from "@/lib/saju/data/hiddenStems";
import type { ElementMaterialItem, ElementMaterials, FourPillars, Pillar, PillarSlot } from "@/lib/saju/types";

function itemsFromPillar(slot: PillarSlot, pillar: Pillar): ElementMaterialItem[] {
  return [
    {
      slot,
      layer: "stem",
      stem: pillar.stem,
      element: stemElement(pillar.stem),
    },
    {
      slot,
      layer: "branch",
      branch: pillar.branch,
      element: branchElement(pillar.branch),
    },
    ...hiddenStemsOf(pillar.branch).map((part) => ({
      slot,
      layer: "hiddenStem" as const,
      branch: pillar.branch,
      stem: part.stem,
      role: part.role,
      element: stemElement(part.stem),
    })),
  ];
}

export function collectElementMaterials(pillars: FourPillars): ElementMaterials {
  const items = [
    ...itemsFromPillar("year", pillars.year),
    ...itemsFromPillar("month", pillars.month),
    ...itemsFromPillar("day", pillars.day),
  ];

  if (pillars.hour !== "unknown") {
    items.push(...itemsFromPillar("hour", pillars.hour));
  }

  return {
    hourUnknown: pillars.hour === "unknown",
    dayStem: pillars.day.stem,
    items,
  };
}
