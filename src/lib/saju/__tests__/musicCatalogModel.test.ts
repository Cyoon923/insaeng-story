import { describe, expect, it } from "vitest";
import type { AppData } from "@/lib/types/app";
import type { MusicCatalogRecord } from "@/lib/saju/speakable/music/catalogTypes";
import { toMusicCatalogEntry } from "@/lib/saju/speakable/music/toMusicCatalogEntry";

const EMPTY_SLICE: Pick<AppData, "musicCatalog"> = {
  musicCatalog: [],
};

function sampleRecord(partial: Partial<MusicCatalogRecord> = {}): MusicCatalogRecord {
  return {
    id: "track-1",
    title: "기대는 하루",
    youtubeUrl: "https://www.youtube.com/watch?v=example",
    primaryElement: "木",
    secondaryElements: ["水", "火"],
    moodTags: ["기대는", "따뜻한"],
    situationTags: ["응원"],
    energyTags: ["잔잔한"],
    message: "서로 기대며 가는 이야기",
    lyricKeywords: ["기대", "하루"],
    active: true,
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:00.000Z",
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
  expect(serialized).not.toMatch(/"neededElement"/);
}

describe("music catalog data model", () => {
  it("defaults musicCatalog to an empty array", () => {
    expect(EMPTY_SLICE.musicCatalog).toEqual([]);
    expect(Array.isArray(EMPTY_SLICE.musicCatalog)).toBe(true);
  });

  it("converts MusicCatalogRecord → MusicCatalogEntry", () => {
    const record = sampleRecord({ thumbnailUrl: "https://example.com/thumb.jpg" });
    const entry = toMusicCatalogEntry(record);

    expect(entry).toEqual({
      id: "track-1",
      title: "기대는 하루",
      moodTags: ["기대는", "따뜻한"],
      themeTags: ["응원", "잔잔한", "기대", "하루"],
      elementTags: ["木", "水", "火"],
      copy: "서로 기대며 가는 이야기",
    });
    expect(entry).not.toHaveProperty("youtubeUrl");
    expect(entry).not.toHaveProperty("primaryElement");
    assertNoRankingFields(entry);
  });

  it("keeps multiple secondaryElements in the element bag", () => {
    const entry = toMusicCatalogEntry(
      sampleRecord({
        primaryElement: "土",
        secondaryElements: ["金", "水", "木"],
      }),
    );

    expect(entry.elementTags).toEqual(["土", "金", "水", "木"]);
    expect(entry.elementTags).toHaveLength(4);
    expect(entry).not.toHaveProperty("winner");
  });

  it("preserves inactive on the record and still converts without filtering", () => {
    const record = sampleRecord({ active: false });
    const entry = toMusicCatalogEntry(record);

    expect(record.active).toBe(false);
    expect(entry.id).toBe(record.id);
    expect(entry.title).toBe(record.title);
    expect(entry).not.toHaveProperty("active");
  });

  it("does not create winner / score / rank on conversion", () => {
    const entry = toMusicCatalogEntry(sampleRecord());
    assertNoRankingFields(entry);
    expect(entry).not.toHaveProperty("score");
    expect(entry).not.toHaveProperty("rank");
    expect(entry).not.toHaveProperty("winner");
    expect(entry).not.toHaveProperty("priority");
  });
});
