import type { BirthPlaceRef } from "@/lib/saju/types";

/**
 * Map user-facing region labels → BirthPlaceRef for the LMT helper.
 * Not used by Unyul v1 `buildFourPillars` (nationwide −30 / 반시).
 * Minimal: Seoul only. Unknown / empty → undefined.
 */
const REGION_LABEL_TO_PLACE_ID: Readonly<Record<string, string>> = {
  서울: "seoul",
  서울시: "seoul",
  서울특별시: "seoul",
};

export function normalizeRegionLabel(region: string | undefined | null): string | undefined {
  const trimmed = region?.trim();
  return trimmed ? trimmed : undefined;
}

/** Returns birthPlace for LMT helper / tests, or undefined when unmapped. */
export function mapRegionToBirthPlace(
  region: string | undefined | null,
): BirthPlaceRef | undefined {
  const label = normalizeRegionLabel(region);
  if (!label) return undefined;
  const id = REGION_LABEL_TO_PLACE_ID[label];
  if (!id) return undefined;
  return { id };
}
