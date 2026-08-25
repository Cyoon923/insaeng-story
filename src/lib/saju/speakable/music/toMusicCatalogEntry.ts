import type { Element } from "@/lib/saju/types";
import type { MusicCatalogRecord } from "@/lib/saju/speakable/music/catalogTypes";
import type { MusicCatalogEntry } from "@/lib/saju/speakable/music/types";

function uniquePreserveOrder(elements: Element[]): Element[] {
  const seen = new Set<Element>();
  const out: Element[] = [];
  for (const element of elements) {
    if (seen.has(element)) continue;
    seen.add(element);
    out.push(element);
  }
  return out;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

/**
 * Map a catalog record to the recommend-match surface.
 * Does not invent winner / score / rank / yongsin / neededElement.
 * Preserves `active` only via caller filtering — this mapper does not drop inactive rows.
 */
export function toMusicCatalogEntry(record: MusicCatalogRecord): MusicCatalogEntry {
  return {
    id: record.id,
    title: record.title,
    moodTags: [...record.moodTags],
    themeTags: uniqueStrings([
      ...record.situationTags,
      ...record.energyTags,
      ...record.lyricKeywords,
    ]),
    elementTags: uniquePreserveOrder([record.primaryElement, ...record.secondaryElements]),
    copy: record.message,
  };
}
