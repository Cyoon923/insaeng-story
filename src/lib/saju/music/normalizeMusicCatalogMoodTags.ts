/**
 * Catalog-standard mood vocabulary for MusicCatalogRecord.moodTags.
 * Speakable may emit different phrases; normalize before catalog matching.
 */
export const MUSIC_CATALOG_STANDARD_MOODS = [
  "평온",
  "위로",
  "희망",
  "활력",
  "자신감",
  "성찰",
  "따뜻함",
  "감성",
  "고양감",
  "회복",
] as const;

export type MusicCatalogStandardMood = (typeof MUSIC_CATALOG_STANDARD_MOODS)[number];

/** Speakable (or other) non-standard mood → standard mood bag. Order is declaration order. */
export const SPEAKABLE_MOOD_TO_CATALOG: Readonly<Record<string, readonly MusicCatalogStandardMood[]>> =
  {
    촉촉한: ["평온", "감성", "회복"],
    감싸는: ["위로", "따뜻함"],
    잔잔한: ["평온", "성찰"],
    따뜻한: ["따뜻함", "위로"],
    녹이는: ["따뜻함", "감성"],
    기대는: ["위로", "회복"],
    채워지는: ["회복", "따뜻함"],
    힘있는: ["활력", "자신감"],
    펼치는: ["활력", "고양감"],
    희망적인: ["희망", "고양감"],
  };

const STANDARD_MOOD_SET = new Set<string>(MUSIC_CATALOG_STANDARD_MOODS);

export type NormalizeMusicCatalogMoodTagsResult = {
  /** Deduped standard moods for catalog query. Input / mapping order preserved. */
  moodTags: MusicCatalogStandardMood[];
  /** Input phrases that were neither standard nor mapped. */
  unknownMoodTags: string[];
};

/**
 * Expand Speakable (or mixed) mood phrases into catalog-standard moodTags.
 * Does not mutate the input array. No scores / priority weights.
 */
export function normalizeMusicCatalogMoodTags(
  inputMoodTags: readonly string[],
): NormalizeMusicCatalogMoodTagsResult {
  const moodTags: MusicCatalogStandardMood[] = [];
  const seen = new Set<string>();
  const unknownMoodTags: string[] = [];
  const unknownSeen = new Set<string>();

  const pushStandard = (mood: MusicCatalogStandardMood) => {
    if (seen.has(mood)) return;
    seen.add(mood);
    moodTags.push(mood);
  };

  for (const raw of inputMoodTags) {
    const tag = raw.trim();
    if (!tag) continue;

    if (STANDARD_MOOD_SET.has(tag)) {
      pushStandard(tag as MusicCatalogStandardMood);
      continue;
    }

    const mapped = SPEAKABLE_MOOD_TO_CATALOG[tag];
    if (mapped) {
      for (const mood of mapped) {
        pushStandard(mood);
      }
      continue;
    }

    if (!unknownSeen.has(tag)) {
      unknownSeen.add(tag);
      unknownMoodTags.push(tag);
    }
  }

  return { moodTags, unknownMoodTags };
}
