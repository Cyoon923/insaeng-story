import { describe, expect, it } from "vitest";
import {
  normalizeMusicCatalogMoodTags,
  SPEAKABLE_MOOD_TO_CATALOG,
} from "@/lib/saju/music/normalizeMusicCatalogMoodTags";

describe("normalizeMusicCatalogMoodTags", () => {
  it("expands 촉촉한 + 감싸는 to five standard moods in mapping order", () => {
    const result = normalizeMusicCatalogMoodTags(["촉촉한", "감싸는"]);
    expect(result.moodTags).toEqual(["평온", "감성", "회복", "위로", "따뜻함"]);
    expect(result.unknownMoodTags).toEqual([]);
  });

  it("keeps already-standard 평온 as-is", () => {
    const result = normalizeMusicCatalogMoodTags(["평온"]);
    expect(result.moodTags).toEqual(["평온"]);
    expect(result.unknownMoodTags).toEqual([]);
  });

  it("dedupes 따뜻한 + 위로 to 따뜻함, 위로", () => {
    const result = normalizeMusicCatalogMoodTags(["따뜻한", "위로"]);
    expect(result.moodTags).toEqual(["따뜻함", "위로"]);
    expect(result.unknownMoodTags).toEqual([]);
  });

  it("does not invent mappings for unknown phrases", () => {
    const result = normalizeMusicCatalogMoodTags(["알수없는분위기", "평온"]);
    expect(result.moodTags).toEqual(["평온"]);
    expect(result.unknownMoodTags).toEqual(["알수없는분위기"]);
  });

  it("preserves input order and each mapping declaration order", () => {
    const result = normalizeMusicCatalogMoodTags(["희망적인", "힘있는"]);
    expect(result.moodTags).toEqual(["희망", "고양감", "활력", "자신감"]);
    expect(SPEAKABLE_MOOD_TO_CATALOG["희망적인"]).toEqual(["희망", "고양감"]);
    expect(SPEAKABLE_MOOD_TO_CATALOG["힘있는"]).toEqual(["활력", "자신감"]);
  });

  it("does not mutate the input array", () => {
    const input = ["촉촉한", "감싸는"];
    const snapshot = [...input];
    normalizeMusicCatalogMoodTags(input);
    expect(input).toEqual(snapshot);
  });
});
