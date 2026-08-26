/**
 * Music recommendation hard-gated by Supplement Element.
 * Mood / situation / energy only rank within that element set.
 * No cross-element fallback. Need element bags are not winners.
 */

import { filterMusicByFinalElement } from "@/lib/saju/music/filterMusicByFinalElement";
import { selectMusicRecommendationCandidates } from "@/lib/saju/music/selectMusicRecommendationCandidates";
import type {
  MusicRecommendationCandidate,
  MusicRecommendationGate,
} from "@/lib/saju/music/types";
import type { MusicCatalogRecord } from "@/lib/saju/speakable/music/catalogTypes";
import type { MusicRecommendationHints } from "@/lib/saju/speakable/types";
import type { Element } from "@/lib/saju/types";

export type SelectMusicBySupplementElementInput = {
  /** Supplement Element; null / unresolved → no candidates. */
  supplementElement: Element | null;
  gate: MusicRecommendationGate;
  hints: MusicRecommendationHints;
  catalog: MusicCatalogRecord[];
};

/**
 * Force elementMode off so Need/Speakable bags cannot act as soft winners
 * after the Supplement hard gate.
 */
function moodOnlyGate(gate: MusicRecommendationGate): MusicRecommendationGate {
  return {
    ...gate,
    elementMode: "off",
    supportedElements: [],
    contextualElements: [],
  };
}

function selectWithinPool(input: {
  gate: MusicRecommendationGate;
  hints: MusicRecommendationHints;
  catalog: MusicCatalogRecord[];
}): MusicRecommendationCandidate[] {
  if (input.catalog.length === 0) return [];
  return selectMusicRecommendationCandidates({
    gate: moodOnlyGate(input.gate),
    hints: input.hints,
    catalog: input.catalog,
  });
}

function dedupeByRecordId(
  items: MusicRecommendationCandidate[],
): MusicRecommendationCandidate[] {
  const seen = new Set<string>();
  const out: MusicRecommendationCandidate[] = [];
  for (const item of items) {
    if (seen.has(item.record.id)) continue;
    seen.add(item.record.id);
    out.push(item);
  }
  return out;
}

/**
 * 1) Hard-gate catalog to Supplement primary then secondary.
 * 2) Apply existing mood/situation/energy selector inside each pool.
 * 3) Concatenate primary results then secondary — never other elements.
 */
export function selectMusicBySupplementElement(
  input: SelectMusicBySupplementElementInput,
): MusicRecommendationCandidate[] {
  const { supplementElement, gate, hints, catalog } = input;

  if (supplementElement === null) return [];

  const { primaryMatches, secondaryMatches } = filterMusicByFinalElement({
    finalElement: supplementElement,
    catalog,
  });

  if (primaryMatches.length === 0 && secondaryMatches.length === 0) {
    return [];
  }

  const primarySelected = selectWithinPool({
    gate,
    hints,
    catalog: primaryMatches,
  });
  const secondarySelected = selectWithinPool({
    gate,
    hints,
    catalog: secondaryMatches,
  });

  return dedupeByRecordId([...primarySelected, ...secondarySelected]);
}
