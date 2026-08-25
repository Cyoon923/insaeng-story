import type { Element } from "@/lib/saju/types";
import type { SpeakableProvenance } from "@/lib/saju/speakable/types";

/**
 * Future music catalog row. No song DB exists yet — this is the match surface only.
 * Do not treat any field as 용신 / neededElement / winner.
 */
export type MusicCatalogEntry = {
  id: string;
  title: string;
  /** Apply-flow style moods (따뜻한, 잔잔한, …) or speakable moodTags */
  moodTags?: string[];
  /** Free theme labels for lyric/style matching — not ranked */
  themeTags?: string[];
  /** Optional 오행 bag membership — never a single winner */
  elementTags?: Element[];
  /** Title/desc/copy scanned against Speakable forbidden list */
  copy?: string;
};

/**
 * Safe input contract for a future music recommender.
 * Built only from MusicRecommendationHints — no score/rank/winner.
 */
export type MusicRecommendQuery = {
  moodTags: string[];
  lyricHints: string[];
  /** Unordered 오행 candidate set (appearance order preserved, non-ranked) */
  elementThemeBag: Element[];
  forbidden: string[];
  provenance: SpeakableProvenance[];
  provisional: true;
  /** True when any provenance marks contested climate/need inheritance */
  contestedInherited: boolean;
};

/**
 * Filtered catalog hit. Matching only — no score, rank, priority, or winner.
 */
export type MusicRecommendMatch = {
  id: string;
  title: string;
  matchedMoodTags: string[];
  /** Intersection with elementThemeBag — unordered, non-ranked */
  matchedElements: Element[];
  provisional: true;
  contestedInherited: boolean;
  provenance: SpeakableProvenance[];
};
