import type { Element } from "@/lib/saju/types";
import type { MusicCatalogRecord } from "@/lib/saju/speakable/music/catalogTypes";

/**
 * Runtime music-recommendation gate state.
 * Derived view only — not an engine Need status and not a catalog field.
 */
export type MusicRecommendationState = "DIRECT" | "PROVISIONAL" | "CONTEXTUAL" | "HOLD";

/**
 * How element bags may be used by a future matcher.
 * - supported-soft: supportedElements may soft-match (never sole winner)
 * - context-soft: contextualElements only; never a required match key
 * - off: no element-based matching
 */
export type MusicRecommendationElementMode = "supported-soft" | "context-soft" | "off";

/**
 * Gate output for music recommendation v1.
 * `reasons` are internal diagnostics — never show verbatim to end users.
 */
export type MusicRecommendationGate = {
  state: MusicRecommendationState;
  elementMode: MusicRecommendationElementMode;
  supportedElements: Element[];
  contextualElements: Element[];
  reasons: string[];
};

/**
 * Internal match metadata for a catalog row.
 * Never expose matchedElements as “필요한 오행”.
 */
export type MusicRecommendationMatchMeta = {
  matchedMoodTags: string[];
  matchedSituationTags: string[];
  matchedEnergyTags: string[];
  matchedLyricKeywords: string[];
  matchedElements: Element[];
  elementMatchMode: MusicRecommendationElementMode;
  messageMatched: boolean;
  provisional: boolean;
};

export type MusicRecommendationCandidate = {
  record: MusicCatalogRecord;
  match: MusicRecommendationMatchMeta;
};

/**
 * User-facing explanation for a selected music candidate.
 * Never states needed element / 용신 / winner.
 */
export type MusicRecommendationReasonView = {
  title: string;
  message: string;
  reason: string;
  badges: string[];
};
