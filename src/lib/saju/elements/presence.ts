import { stemElement } from "@/lib/saju/constants/elements";
import { hiddenStemsOf } from "@/lib/saju/data/hiddenStems";
import { confirmedSlots } from "@/lib/saju/elements/slots";
import type { Element, ElementPresenceAnalysis, ElementPresenceKind, FourPillars, PillarSlot } from "@/lib/saju/types";

function uniqueSlots(slots: PillarSlot[]): PillarSlot[] {
  return [...new Set(slots)];
}

function presenceKind(visible: boolean, rooted: boolean): ElementPresenceKind {
  if (visible && rooted) return "rooted-visible";
  if (visible) return "unrooted-visible";
  if (rooted) return "hidden-only";
  return "absent";
}

export function analyzeElementPresence(pillars: FourPillars, element: Element): ElementPresenceAnalysis {
  const slots = confirmedSlots(pillars);
  const visibleSlots = uniqueSlots(
    slots.filter(({ pillar }) => stemElement(pillar.stem) === element).map(({ slot }) => slot),
  );
  const rootedSlots = uniqueSlots(
    slots
      .filter(({ pillar }) => hiddenStemsOf(pillar.branch).some((part) => stemElement(part.stem) === element))
      .map(({ slot }) => slot),
  );

  const monthHidden = hiddenStemsOf(pillars.month.branch);
  const monthOutletSlots = uniqueSlots(
    slots
      .filter(({ pillar }) => monthHidden.some((part) => part.stem === pillar.stem))
      .filter(({ pillar }) => stemElement(pillar.stem) === element)
      .map(({ slot }) => slot),
  );

  return {
    element,
    hourUnknown: pillars.hour === "unknown",
    presence: presenceKind(visibleSlots.length > 0, rootedSlots.length > 0),
    visibleSlots,
    rootedSlots,
    monthOutletSlots,
  };
}
