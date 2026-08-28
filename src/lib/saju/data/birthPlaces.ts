/**
 * Minimal birth-place longitude seed for hour-pillar **LMT** (not true solar / EOT).
 *
 * Not a full region DB. Expand later with more ids / catalog.
 * Values are east longitude in degrees.
 */
export const BIRTH_PLACE_LONGITUDE_EAST: Readonly<Record<string, number>> = {
  /** Seoul City Hall area — approximate; not date-specific. */
  seoul: 126.978,
};

export function longitudeEastForPlaceId(id: string): number | null {
  const value = BIRTH_PLACE_LONGITUDE_EAST[id];
  return typeof value === "number" ? value : null;
}
