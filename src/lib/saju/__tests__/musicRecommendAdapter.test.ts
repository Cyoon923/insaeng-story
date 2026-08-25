import { describe, expect, it } from "vitest";
import {
  buildMusicRecommendQuery,
  filterMusicCatalogByQuery,
} from "@/lib/saju/speakable/music/adaptMusicRecommendQuery";
import type { MusicCatalogEntry } from "@/lib/saju/speakable/music/types";
import type { MusicRecommendationHints } from "@/lib/saju/speakable/types";

function hints(partial: Partial<MusicRecommendationHints> = {}): MusicRecommendationHints {
  return {
    moodTags: ["기대는", "채워지는", "따뜻한"],
    lyricHints: ["지금은 기대어 쉬어가는 쪽으로 읽힐 수 있어요."],
    elementThemeBag: ["木", "水"],
    forbidden: ["용신 확정", "신강입니다", "convergent=정답"],
    provenance: [
      { layer: "strength", evidenceRef: "music.mood=leaning-weak" },
      { layer: "need-strength", evidenceRef: "music.bag.strength=木" },
      { layer: "need-climate", evidenceRef: "need.climate.boundary=contested-inherited" },
    ],
    ...partial,
  };
}

function assertNoRankingFields(value: unknown) {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toMatch(/"winner"/);
  expect(serialized).not.toMatch(/"score"/);
  expect(serialized).not.toMatch(/"rank"/);
  expect(serialized).not.toMatch(/"priority"/);
  expect(serialized).not.toMatch(/"yongsin"/);
  expect(serialized).not.toMatch(/"heesin"/);
  expect(serialized).not.toMatch(/"neededElement"/);
}

const CATALOG: MusicCatalogEntry[] = [
  {
    id: "a",
    title: "기대는 하루",
    moodTags: ["기대는", "잔잔한"],
    elementTags: ["木", "火"],
  },
  {
    id: "b",
    title: "따뜻한 편지",
    moodTags: ["따뜻한", "희망적인"],
    elementTags: ["水"],
  },
  {
    id: "c",
    title: "용신 확정 가이드",
    moodTags: ["따뜻한"],
    elementTags: ["水"],
    copy: "용신 확정으로 추천합니다",
  },
  {
    id: "d",
    title: "힘있는 행진",
    moodTags: ["힘있는", "펼치는"],
    elementTags: ["金"],
  },
];

describe("buildMusicRecommendQuery / filterMusicCatalogByQuery", () => {
  it("keeps elementThemeBag as a multi-candidate unordered bag", () => {
    const query = buildMusicRecommendQuery(
      hints({ elementThemeBag: ["水", "木", "水", "火"] }),
    );

    expect(query.elementThemeBag).toEqual(["水", "木", "火"]);
    expect(query.elementThemeBag).not.toHaveLength(1);
    expect(query).not.toHaveProperty("element");
    expect(query).not.toHaveProperty("winner");
    assertNoRankingFields(query);
  });

  it("matches catalog entries by moodTags intersection", () => {
    const query = buildMusicRecommendQuery(hints());
    const matches = filterMusicCatalogByQuery(CATALOG, query);

    expect(matches.map((item) => item.id)).toEqual(["a", "b"]);
    expect(matches.find((item) => item.id === "a")?.matchedMoodTags).toEqual(["기대는"]);
    expect(matches.find((item) => item.id === "b")?.matchedMoodTags).toEqual(["따뜻한"]);
    expect(matches.find((item) => item.id === "d")).toBeUndefined();
  });

  it("excludes catalog entries that violate forbidden rules", () => {
    const query = buildMusicRecommendQuery(hints());
    const matches = filterMusicCatalogByQuery(CATALOG, query);

    expect(matches.every((item) => item.id !== "c")).toBe(true);
    expect(matches.every((item) => !item.title.includes("용신 확정"))).toBe(true);
  });

  it("preserves provisional and contested provenance", () => {
    const query = buildMusicRecommendQuery(hints());
    expect(query.provisional).toBe(true);
    expect(query.contestedInherited).toBe(true);
    expect(query.provenance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidenceRef: "need.climate.boundary=contested-inherited",
        }),
      ]),
    );

    const matches = filterMusicCatalogByQuery(CATALOG, query);
    expect(matches.length).toBeGreaterThan(0);
    for (const match of matches) {
      expect(match.provisional).toBe(true);
      expect(match.contestedInherited).toBe(true);
      expect(match.provenance).toEqual(query.provenance);
    }
  });

  it("does not create winner / score / rank on matches; bag intersection only", () => {
    const query = buildMusicRecommendQuery(hints());
    const matches = filterMusicCatalogByQuery(CATALOG, query);
    const a = matches.find((item) => item.id === "a");
    const b = matches.find((item) => item.id === "b");

    expect(a?.matchedElements).toEqual(["木"]);
    expect(b?.matchedElements).toEqual(["水"]);
    assertNoRankingFields(query);
    assertNoRankingFields(matches);
    for (const match of matches) {
      expect(match).not.toHaveProperty("score");
      expect(match).not.toHaveProperty("rank");
      expect(match).not.toHaveProperty("winner");
      expect(match).not.toHaveProperty("priority");
      expect(match).not.toHaveProperty("yongsin");
      expect(match).not.toHaveProperty("neededElement");
    }
  });
});
