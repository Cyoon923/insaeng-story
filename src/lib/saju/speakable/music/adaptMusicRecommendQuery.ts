import type { Element } from "@/lib/saju/types";
import type { MusicRecommendationHints, SpeakableProvenance } from "@/lib/saju/speakable/types";
import type {
  MusicCatalogEntry,
  MusicRecommendMatch,
  MusicRecommendQuery,
} from "@/lib/saju/speakable/music/types";

function uniquePreserveOrder<T>(items: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

function hasContestedInherited(provenance: SpeakableProvenance[]): boolean {
  return provenance.some((item) => item.evidenceRef.includes("contested-inherited"));
}

function textViolatesForbidden(text: string, forbidden: string[]): boolean {
  if (!text) return false;
  return forbidden.some((rule) => rule.length > 0 && text.includes(rule));
}

function entryViolatesForbidden(entry: MusicCatalogEntry, forbidden: string[]): boolean {
  const blobs = [entry.title, entry.copy ?? "", ...(entry.themeTags ?? [])].join("\n");
  return textViolatesForbidden(blobs, forbidden);
}

function intersectMoods(queryMoods: string[], entryMoods: string[] | undefined): string[] {
  if (!entryMoods || entryMoods.length === 0) return [];
  const wanted = new Set(queryMoods);
  return entryMoods.filter((mood) => wanted.has(mood));
}

function intersectElements(
  bag: Element[],
  entryElements: Element[] | undefined,
): Element[] {
  if (!entryElements || entryElements.length === 0) return [];
  const bagSet = new Set(bag);
  return uniquePreserveOrder(entryElements.filter((element) => bagSet.has(element)));
}

/**
 * Convert Speakable music hints into a music-layer query.
 * Does not invent winner / score / rank / yongsin / neededElement.
 */
export function buildMusicRecommendQuery(
  hints: MusicRecommendationHints,
): MusicRecommendQuery {
  const provenance = hints.provenance.map((item) => ({ ...item }));
  return {
    moodTags: [...hints.moodTags],
    lyricHints: [...hints.lyricHints],
    elementThemeBag: uniquePreserveOrder([...hints.elementThemeBag]),
    forbidden: [...hints.forbidden],
    provenance,
    provisional: true,
    contestedInherited: hasContestedInherited(provenance),
  };
}

/**
 * Filter a catalog by query. Pass-through contract for when a real DB appears.
 * - mood: keep if entry has no moodTags, or intersects query moodTags
 * - element: never picks a single winner; only records bag intersection
 * - forbidden: drop any entry whose title/copy/theme contains a forbidden string
 */
export function filterMusicCatalogByQuery(
  catalog: MusicCatalogEntry[],
  query: MusicRecommendQuery,
): MusicRecommendMatch[] {
  const matches: MusicRecommendMatch[] = [];

  for (const entry of catalog) {
    if (entryViolatesForbidden(entry, query.forbidden)) continue;

    const matchedMoodTags = intersectMoods(query.moodTags, entry.moodTags);
    const entryHasMoods = (entry.moodTags?.length ?? 0) > 0;
    if (entryHasMoods && query.moodTags.length > 0 && matchedMoodTags.length === 0) {
      continue;
    }

    const matchedElements = intersectElements(query.elementThemeBag, entry.elementTags);

    matches.push({
      id: entry.id,
      title: entry.title,
      matchedMoodTags,
      matchedElements,
      provisional: true,
      contestedInherited: query.contestedInherited,
      provenance: query.provenance.map((item) => ({ ...item })),
    });
  }

  return matches;
}
