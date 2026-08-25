import { readData } from "@/lib/server/store";
import type { MusicCatalogRecord } from "@/lib/saju/speakable/music/catalogTypes";
import {
  buildMusicRecommendQuery,
  filterMusicCatalogByQuery,
} from "@/lib/saju/speakable/music/adaptMusicRecommendQuery";
import { toMusicCatalogEntry } from "@/lib/saju/speakable/music/toMusicCatalogEntry";
import type { MusicRecommendMatch } from "@/lib/saju/speakable/music/types";
import type {
  MusicRecommendationHints,
  SpeakableOutput,
} from "@/lib/saju/speakable/types";

/**
 * Match surface plus optional media for later UI detail wiring.
 * No score / rank / winner / 용신 fields.
 */
export type MusicRecommendCandidateView = MusicRecommendMatch & {
  youtubeUrl?: string;
  thumbnailUrl?: string;
};

function isSpeakableOutput(
  source: SpeakableOutput | MusicRecommendationHints,
): source is SpeakableOutput {
  return "musicRecommendationHints" in source;
}

function resolveHints(
  source: SpeakableOutput | MusicRecommendationHints,
): MusicRecommendationHints {
  return isSpeakableOutput(source) ? source.musicRecommendationHints : source;
}

/**
 * Match Speakable music hints against a musicCatalog snapshot.
 * Uses active records only. Does not invent ranking or a single-element winner.
 */
export function matchMusicCatalogFromSpeakable(
  source: SpeakableOutput | MusicRecommendationHints,
  catalog: MusicCatalogRecord[],
): MusicRecommendCandidateView[] {
  const hints = resolveHints(source);
  const query = buildMusicRecommendQuery(hints);
  const activeRecords = catalog.filter((item) => item.active);
  const entries = activeRecords.map(toMusicCatalogEntry);
  const matches = filterMusicCatalogByQuery(entries, query);

  const byId = new Map(activeRecords.map((item) => [item.id, item]));
  return matches.map((match) => {
    const record = byId.get(match.id);
    return {
      ...match,
      ...(record?.youtubeUrl ? { youtubeUrl: record.youtubeUrl } : {}),
      ...(record?.thumbnailUrl ? { thumbnailUrl: record.thumbnailUrl } : {}),
    };
  });
}

/**
 * Read AppData.musicCatalog and return recommendation candidates.
 * Catalog order after filter is appearance order only — not 명리 priority.
 */
export async function recommendMusicCandidatesFromStore(
  source: SpeakableOutput | MusicRecommendationHints,
): Promise<MusicRecommendCandidateView[]> {
  const data = await readData();
  return matchMusicCatalogFromSpeakable(source, data.musicCatalog ?? []);
}
