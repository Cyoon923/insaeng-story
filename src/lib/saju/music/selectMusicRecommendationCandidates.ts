import type { MusicCatalogRecord } from "@/lib/saju/speakable/music/catalogTypes";
import type { MusicRecommendationHints } from "@/lib/saju/speakable/types";
import { normalizeMusicCatalogMoodTags } from "@/lib/saju/music/normalizeMusicCatalogMoodTags";
import type {
  MusicRecommendationCandidate,
  MusicRecommendationElementMode,
  MusicRecommendationGate,
  MusicRecommendationMatchMeta,
} from "@/lib/saju/music/types";
import type { Element } from "@/lib/saju/types";

/** Safe HOLD fallback among catalog-standard moods. */
const SAFE_FALLBACK_MOODS = ["평온", "따뜻함", "위로"] as const;

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

function textViolatesForbidden(text: string, forbidden: string[]): boolean {
  if (!text) return false;
  return forbidden.some((rule) => rule.length > 0 && text.includes(rule));
}

function recordViolatesForbidden(record: MusicCatalogRecord, forbidden: string[]): boolean {
  const blobs = [
    record.title,
    record.message,
    ...record.moodTags,
    ...record.situationTags,
    ...record.energyTags,
    ...record.lyricKeywords,
  ].join("\n");
  return textViolatesForbidden(blobs, forbidden);
}

function intersectTags(wanted: string[], available: string[]): string[] {
  if (wanted.length === 0 || available.length === 0) return [];
  const set = new Set(wanted);
  return available.filter((tag) => set.has(tag));
}

function tagsMentionedInHints(tags: string[], lyricHints: string[], moodTags: string[]): string[] {
  if (tags.length === 0) return [];
  const blob = [...lyricHints, ...moodTags].join("\n");
  return tags.filter((tag) => tag.length > 0 && blob.includes(tag));
}

function messageMatchesHints(message: string, lyricHints: string[], moodTags: string[]): boolean {
  if (!message.trim()) return false;
  if (moodTags.some((mood) => mood.length > 0 && message.includes(mood))) return true;
  return lyricHints.some((hint) => {
    const compact = hint.replace(/\s+/g, "");
    if (compact.length < 4) return false;
    // Loose phrase overlap: any 4+ char slice of hint appearing in message, or vice versa.
    return message.includes(hint.slice(0, Math.min(8, hint.length))) || hint.includes(message.slice(0, Math.min(8, message.length)));
  });
}

function recordElements(record: MusicCatalogRecord): Element[] {
  return uniquePreserveOrder([record.primaryElement, ...record.secondaryElements]);
}

function softElementBag(gate: MusicRecommendationGate): Element[] {
  if (gate.elementMode === "off") return [];
  if (gate.elementMode === "supported-soft") return [...gate.supportedElements];
  return [...gate.contextualElements];
}

function intersectElements(bag: Element[], entryElements: Element[]): Element[] {
  if (bag.length === 0 || entryElements.length === 0) return [];
  const bagSet = new Set(bag);
  return uniquePreserveOrder(entryElements.filter((element) => bagSet.has(element)));
}

function buildMatchMeta(input: {
  record: MusicCatalogRecord;
  /** Hints used for catalog matching (moodTags already catalog-standardized). */
  queryHints: MusicRecommendationHints;
  gate: MusicRecommendationGate;
  elementBag: Element[];
}): MusicRecommendationMatchMeta {
  const { record, queryHints, gate, elementBag } = input;
  const matchedMoodTags = intersectTags(queryHints.moodTags, record.moodTags);
  const matchedSituationTags = tagsMentionedInHints(
    record.situationTags,
    queryHints.lyricHints,
    queryHints.moodTags,
  );
  const matchedEnergyTags = tagsMentionedInHints(
    record.energyTags,
    queryHints.lyricHints,
    queryHints.moodTags,
  );
  const matchedLyricKeywords = tagsMentionedInHints(
    record.lyricKeywords,
    queryHints.lyricHints,
    queryHints.moodTags,
  );
  const messageMatched = messageMatchesHints(
    record.message,
    queryHints.lyricHints,
    queryHints.moodTags,
  );
  const matchedElements =
    gate.elementMode === "off" ? [] : intersectElements(elementBag, recordElements(record));

  return {
    matchedMoodTags,
    matchedSituationTags,
    matchedEnergyTags,
    matchedLyricKeywords,
    matchedElements,
    elementMatchMode: gate.elementMode,
    messageMatched,
    provisional: gate.state !== "DIRECT",
  };
}

function hasMoodAgreement(
  record: MusicCatalogRecord,
  queryMoodTags: string[],
  matchedMoodTags: string[],
): boolean {
  if (queryMoodTags.length === 0) return true;
  if (record.moodTags.length === 0) return true;
  return matchedMoodTags.length > 0;
}

function hasExtraAgreement(match: MusicRecommendationMatchMeta): boolean {
  return (
    match.matchedSituationTags.length > 0 ||
    match.matchedEnergyTags.length > 0 ||
    match.matchedLyricKeywords.length > 0 ||
    match.messageMatched
  );
}

function isSafeFallbackMood(record: MusicCatalogRecord): boolean {
  if (record.moodTags.length === 0) return true;
  return record.moodTags.some((mood) =>
    (SAFE_FALLBACK_MOODS as readonly string[]).includes(mood),
  );
}

/**
 * Qualitative group key for deterministic ordering — not a numeric score.
 * Lower tuple sorts first.
 * CONTEXTUAL/HOLD: element soft never affects order (metadata only).
 */
function qualitativeOrderKey(
  match: MusicRecommendationMatchMeta,
  elementMode: MusicRecommendationElementMode,
): [number, number, number] {
  const moodTier = match.matchedMoodTags.length > 0 ? 0 : 1;
  const extraTier = hasExtraAgreement(match) ? 0 : 1;
  const elementTier =
    elementMode === "supported-soft" && match.matchedElements.length > 0 ? 0 : 1;
  return [moodTier, extraTier, elementTier];
}

function compareCandidates(a: MusicRecommendationCandidate, b: MusicRecommendationCandidate): number {
  const mode = a.match.elementMatchMode;
  const ka = qualitativeOrderKey(a.match, mode);
  const kb = qualitativeOrderKey(b.match, mode);
  for (let i = 0; i < 3; i++) {
    if (ka[i]! !== kb[i]!) return ka[i]! - kb[i]!;
  }
  const byCreated = a.record.createdAt.localeCompare(b.record.createdAt);
  if (byCreated !== 0) return byCreated;
  return a.record.id.localeCompare(b.record.id);
}

function passesPrimaryFilter(
  record: MusicCatalogRecord,
  queryHints: MusicRecommendationHints,
  match: MusicRecommendationMatchMeta,
  gate: MusicRecommendationGate,
): boolean {
  if (!record.active) return false;
  if (recordViolatesForbidden(record, queryHints.forbidden)) return false;

  // Mood is the main axis for DIRECT / PROVISIONAL / CONTEXTUAL when moods are present.
  if (gate.state === "HOLD") {
    // HOLD: allow mood agreement OR extra agreement; pure element never required.
    if (
      queryHints.moodTags.length > 0 &&
      record.moodTags.length > 0 &&
      match.matchedMoodTags.length === 0
    ) {
      return hasExtraAgreement(match);
    }
    return true;
  }

  return hasMoodAgreement(record, queryHints.moodTags, match.matchedMoodTags);
}

/**
 * Select catalog candidates for music recommendation v1.
 * Uses MusicRecommendationGate + Speakable hints. No Observation. No scores/ranks/winners.
 * Original `hints` object is not mutated; moodTags are standardized for catalog matching only.
 */
export function selectMusicRecommendationCandidates(input: {
  gate: MusicRecommendationGate;
  hints: MusicRecommendationHints;
  catalog: MusicCatalogRecord[];
}): MusicRecommendationCandidate[] {
  const { gate, hints, catalog } = input;
  const { moodTags: catalogMoodTags } = normalizeMusicCatalogMoodTags(hints.moodTags);
  const queryHints: MusicRecommendationHints = {
    ...hints,
    moodTags: [...catalogMoodTags],
  };

  const elementBag = softElementBag(gate);
  const elementMatchMode: MusicRecommendationElementMode = gate.elementMode;

  const built: MusicRecommendationCandidate[] = [];
  for (const record of catalog) {
    if (!record.active) continue;
    if (recordViolatesForbidden(record, queryHints.forbidden)) continue;

    const match = buildMatchMeta({ record, queryHints, gate, elementBag });
    // Ensure mode stamped even when bag empty
    match.elementMatchMode = elementMatchMode;
    if (gate.elementMode === "off") {
      match.matchedElements = [];
    }

    if (!passesPrimaryFilter(record, queryHints, match, gate)) continue;
    built.push({ record, match });
  }

  if (built.length > 0) {
    return [...built].sort(compareCandidates);
  }

  // HOLD (or empty mood grounds): safe fallback among active non-forbidden.
  if (gate.state === "HOLD" || queryHints.moodTags.length === 0) {
    const fallback: MusicRecommendationCandidate[] = [];
    for (const record of catalog) {
      if (!record.active) continue;
      if (recordViolatesForbidden(record, queryHints.forbidden)) continue;
      if (!isSafeFallbackMood(record)) continue;
      const match = buildMatchMeta({ record, queryHints, gate, elementBag: [] });
      match.matchedElements = [];
      match.elementMatchMode = "off";
      fallback.push({ record, match });
    }
    return fallback.sort((a, b) => {
      const byCreated = a.record.createdAt.localeCompare(b.record.createdAt);
      if (byCreated !== 0) return byCreated;
      return a.record.id.localeCompare(b.record.id);
    });
  }

  return [];
}

/** Convenience: catalog records only, same order as candidates. */
export function selectMusicRecommendationRecords(input: {
  gate: MusicRecommendationGate;
  hints: MusicRecommendationHints;
  catalog: MusicCatalogRecord[];
}): MusicCatalogRecord[] {
  return selectMusicRecommendationCandidates(input).map((item) => item.record);
}
