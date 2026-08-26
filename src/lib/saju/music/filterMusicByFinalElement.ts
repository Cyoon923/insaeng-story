import type { MusicCatalogRecord } from "@/lib/saju/speakable/music/catalogTypes";
import type { Element } from "@/lib/saju/types";

export type FilterMusicByFinalElementInput = {
  finalElement: Element | null;
  catalog: MusicCatalogRecord[];
};

export type FilterMusicByFinalElementResult = {
  primaryMatches: MusicCatalogRecord[];
  secondaryMatches: MusicCatalogRecord[];
  /** primaryMatches first, then secondaryMatches. No cross-element fallback. */
  candidates: MusicCatalogRecord[];
};

/**
 * Hard-gate music catalog rows by FER `finalElement`.
 * Mood / situation / energy are out of scope — element match only.
 * Does not read Need, climate bags, or the soft music selector.
 */
export function filterMusicByFinalElement(
  input: FilterMusicByFinalElementInput,
): FilterMusicByFinalElementResult {
  const { finalElement, catalog } = input;

  if (finalElement === null) {
    return { primaryMatches: [], secondaryMatches: [], candidates: [] };
  }

  const primaryMatches: MusicCatalogRecord[] = [];
  const secondaryMatches: MusicCatalogRecord[] = [];

  for (const record of catalog) {
    if (record.primaryElement === finalElement) {
      primaryMatches.push(record);
      continue;
    }
    if (record.secondaryElements.includes(finalElement)) {
      secondaryMatches.push(record);
    }
  }

  return {
    primaryMatches,
    secondaryMatches,
    candidates: [...primaryMatches, ...secondaryMatches],
  };
}
