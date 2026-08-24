import type { FourPillars, Pillar, PillarSlot } from "@/lib/saju/types";

export function confirmedSlots(pillars: FourPillars): Array<{ slot: PillarSlot; pillar: Pillar }> {
  const slots: Array<{ slot: PillarSlot; pillar: Pillar }> = [
    { slot: "year", pillar: pillars.year },
    { slot: "month", pillar: pillars.month },
    { slot: "day", pillar: pillars.day },
  ];

  if (pillars.hour !== "unknown") {
    slots.push({ slot: "hour", pillar: pillars.hour });
  }

  return slots;
}
