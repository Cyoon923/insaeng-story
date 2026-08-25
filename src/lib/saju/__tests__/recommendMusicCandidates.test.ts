import { describe, expect, it } from "vitest";
import type { MusicCatalogRecord } from "@/lib/saju/speakable/music/catalogTypes";
import { matchMusicCatalogFromSpeakable } from "@/lib/saju/speakable/music/recommendMusicCandidates";
import type { MusicRecommendationHints } from "@/lib/saju/speakable/types";

function hints(partial: Partial<MusicRecommendationHints> = {}): MusicRecommendationHints {
  return {
    moodTags: ["기대는", "따뜻한"],
    lyricHints: ["지금은 기대어 쉬어가는 쪽으로 읽힐 수 있어요."],
    elementThemeBag: ["木", "水"],
    forbidden: ["용신 확정", "신강입니다"],
    provenance: [
      { layer: "strength", evidenceRef: "music.mood=leaning-weak" },
      { layer: "need-climate", evidenceRef: "need.climate.boundary=contested-inherited" },
    ],
    ...partial,
  };
}

function record(partial: Partial<MusicCatalogRecord> & Pick<MusicCatalogRecord, "id" | "title">): MusicCatalogRecord {
  return {
    youtubeUrl: `https://www.youtube.com/watch?v=${partial.id}`,
    primaryElement: "木",
    secondaryElements: [],
    moodTags: ["기대는"],
    situationTags: [],
    energyTags: [],
    message: "서로 기대며 가는 이야기",
    lyricKeywords: [],
    active: true,
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:00.000Z",
    ...partial,
  };
}

function assertNoRanking(value: unknown) {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toMatch(/"winner"/);
  expect(serialized).not.toMatch(/"score"/);
  expect(serialized).not.toMatch(/"rank"/);
  expect(serialized).not.toMatch(/"priority"/);
  expect(serialized).not.toMatch(/"yongsin"/);
  expect(serialized).not.toMatch(/"neededElement"/);
}

describe("matchMusicCatalogFromSpeakable", () => {
  it("1. returns only active catalog rows", () => {
    const catalog = [
      record({ id: "a", title: "활성 곡", moodTags: ["기대는"] }),
      record({ id: "b", title: "비활성 곡", moodTags: ["기대는"], active: false }),
    ];
    const matches = matchMusicCatalogFromSpeakable(hints(), catalog);
    expect(matches.map((item) => item.id)).toEqual(["a"]);
  });

  it("2. matches by moodTags intersection", () => {
    const catalog = [
      record({ id: "a", title: "기대는 곡", moodTags: ["기대는", "잔잔한"] }),
      record({ id: "b", title: "힘있는 곡", moodTags: ["힘있는"], primaryElement: "金" }),
    ];
    const matches = matchMusicCatalogFromSpeakable(hints(), catalog);
    expect(matches.map((item) => item.id)).toEqual(["a"]);
    expect(matches[0]?.matchedMoodTags).toEqual(["기대는"]);
  });

  it("3. keeps multi-element bag matches without picking a winner", () => {
    const catalog = [
      record({
        id: "a",
        title: "목수 곡",
        moodTags: ["따뜻한"],
        primaryElement: "木",
        secondaryElements: ["水", "火"],
      }),
    ];
    const matches = matchMusicCatalogFromSpeakable(
      hints({ elementThemeBag: ["水", "木", "火"] }),
      catalog,
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]?.matchedElements).toEqual(["木", "水", "火"]);
    expect(matches[0]).not.toHaveProperty("winner");
    expect(matches[0]?.matchedElements).not.toHaveLength(1);
  });

  it("4. excludes candidates that violate forbidden rules", () => {
    const catalog = [
      record({
        id: "bad",
        title: "용신 확정 가이드",
        moodTags: ["따뜻한"],
        message: "용신 확정으로 추천합니다",
      }),
      record({ id: "ok", title: "안전한 곡", moodTags: ["따뜻한"] }),
    ];
    const matches = matchMusicCatalogFromSpeakable(hints(), catalog);
    expect(matches.map((item) => item.id)).toEqual(["ok"]);
  });

  it("5. preserves provisional and contested provenance", () => {
    const catalog = [record({ id: "a", title: "잠정 곡", moodTags: ["기대는"] })];
    const matches = matchMusicCatalogFromSpeakable(hints(), catalog);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.provisional).toBe(true);
    expect(matches[0]?.contestedInherited).toBe(true);
    expect(matches[0]?.provenance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidenceRef: "need.climate.boundary=contested-inherited",
        }),
      ]),
    );
  });

  it("6. returns [] for an empty catalog", () => {
    expect(matchMusicCatalogFromSpeakable(hints(), [])).toEqual([]);
  });

  it("7. does not create ranking / winner fields; may attach media urls", () => {
    const catalog = [
      record({
        id: "a",
        title: "미디어 곡",
        moodTags: ["기대는"],
        thumbnailUrl: "https://example.com/a.jpg",
      }),
    ];
    const matches = matchMusicCatalogFromSpeakable(hints(), catalog);
    expect(matches[0]).toMatchObject({
      id: "a",
      title: "미디어 곡",
      youtubeUrl: "https://www.youtube.com/watch?v=a",
      thumbnailUrl: "https://example.com/a.jpg",
      provisional: true,
    });
    assertNoRanking(matches);
    for (const match of matches) {
      expect(match).not.toHaveProperty("score");
      expect(match).not.toHaveProperty("rank");
      expect(match).not.toHaveProperty("winner");
      expect(match).not.toHaveProperty("priority");
    }
  });
});
