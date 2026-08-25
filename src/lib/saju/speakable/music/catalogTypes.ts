import type { Element } from "@/lib/saju/types";

/**
 * Persistent music catalog row (AppData.musicCatalog).
 * primaryElement is admin metadata only — never a recommendation winner.
 */
export type MusicCatalogRecord = {
  id: string;
  title: string;
  youtubeUrl: string;
  thumbnailUrl?: string;
  /** Admin primary 오행 meta. Not a recommend winner / 용신. */
  primaryElement: Element;
  /** Secondary 오행 bag. Unordered, unscored. */
  secondaryElements: Element[];
  moodTags: string[];
  situationTags: string[];
  energyTags: string[];
  message: string;
  lyricKeywords: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
};
