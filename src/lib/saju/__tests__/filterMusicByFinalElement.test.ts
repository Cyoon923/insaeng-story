import { describe, expect, it } from "vitest";
import { filterMusicByFinalElement } from "@/lib/saju/music/filterMusicByFinalElement";
import type { MusicCatalogRecord } from "@/lib/saju/speakable/music/catalogTypes";
import type { Element } from "@/lib/saju/types";

function record(
  partial: Partial<MusicCatalogRecord> &
    Pick<MusicCatalogRecord, "id" | "title" | "primaryElement">,
): MusicCatalogRecord {
  return {
    youtubeUrl: `https://www.youtube.com/watch?v=${partial.id}`,
    secondaryElements: [],
    moodTags: ["평온"],
    situationTags: [],
    energyTags: [],
    message: "테스트 곡",
    lyricKeywords: [],
    active: true,
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:00.000Z",
    ...partial,
  };
}

describe("filterMusicByFinalElement", () => {
  it("1. finalElement=木 + primary 木 → 포함", () => {
    const wood = record({ id: "wood", title: "나무", primaryElement: "木" });
    const result = filterMusicByFinalElement({
      finalElement: "木",
      catalog: [wood],
    });
    expect(result.primaryMatches).toEqual([wood]);
    expect(result.candidates).toEqual([wood]);
  });

  it("2. finalElement=火 + primary 火 → 포함", () => {
    const fire = record({ id: "fire", title: "불", primaryElement: "火" });
    const result = filterMusicByFinalElement({
      finalElement: "火",
      catalog: [fire],
    });
    expect(result.primaryMatches).toEqual([fire]);
    expect(result.candidates).toEqual([fire]);
  });

  it("3. finalElement=土 → 정확히 土만", () => {
    const catalog = [
      record({ id: "earth", title: "흙", primaryElement: "土" }),
      record({ id: "wood", title: "나무", primaryElement: "木" }),
      record({ id: "earth-sec", title: "보조흙", primaryElement: "火", secondaryElements: ["土"] }),
      record({ id: "metal", title: "금", primaryElement: "金" }),
    ];
    const result = filterMusicByFinalElement({ finalElement: "土", catalog });
    expect(result.primaryMatches.map((row) => row.id)).toEqual(["earth"]);
    expect(result.secondaryMatches.map((row) => row.id)).toEqual(["earth-sec"]);
    expect(result.candidates.map((row) => row.id)).toEqual(["earth", "earth-sec"]);
    expect(result.candidates.every((row) => row.primaryElement === "土" || row.secondaryElements.includes("土"))).toBe(
      true,
    );
  });

  it("4. finalElement=金 → 정확히 金만", () => {
    const catalog = [
      record({ id: "metal", title: "금", primaryElement: "金" }),
      record({ id: "water", title: "물", primaryElement: "水" }),
      record({ id: "metal-sec", title: "보조금", primaryElement: "木", secondaryElements: ["金"] }),
    ];
    const result = filterMusicByFinalElement({ finalElement: "金", catalog });
    expect(result.candidates.map((row) => row.id)).toEqual(["metal", "metal-sec"]);
    expect(
      result.candidates.every(
        (row) => row.primaryElement === "金" || row.secondaryElements.includes("金"),
      ),
    ).toBe(true);
  });

  it("5. finalElement=水 → 정확히 水만", () => {
    const catalog = [
      record({ id: "water", title: "물", primaryElement: "水" }),
      record({ id: "fire", title: "불", primaryElement: "火" }),
      record({ id: "water-sec", title: "보조물", primaryElement: "土", secondaryElements: ["水"] }),
    ];
    const result = filterMusicByFinalElement({ finalElement: "水", catalog });
    expect(result.candidates.map((row) => row.id)).toEqual(["water", "water-sec"]);
  });

  it("6. primary 水 + secondary 水 중 primary가 먼저", () => {
    const primaryWater = record({
      id: "primary-water",
      title: "대표물",
      primaryElement: "水",
      createdAt: "2026-06-01T00:00:00.000Z",
    });
    const secondaryWater = record({
      id: "secondary-water",
      title: "보조물",
      primaryElement: "木",
      secondaryElements: ["水"],
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const result = filterMusicByFinalElement({
      finalElement: "水",
      catalog: [secondaryWater, primaryWater],
    });
    expect(result.primaryMatches.map((row) => row.id)).toEqual(["primary-water"]);
    expect(result.secondaryMatches.map((row) => row.id)).toEqual(["secondary-water"]);
    expect(result.candidates.map((row) => row.id)).toEqual(["primary-water", "secondary-water"]);
  });

  it("7. secondary만 水인 곡도 포함", () => {
    const onlySecondary = record({
      id: "sec-only",
      title: "보조만",
      primaryElement: "火",
      secondaryElements: ["金", "水"],
    });
    const result = filterMusicByFinalElement({
      finalElement: "水",
      catalog: [onlySecondary],
    });
    expect(result.primaryMatches).toEqual([]);
    expect(result.secondaryMatches).toEqual([onlySecondary]);
    expect(result.candidates).toEqual([onlySecondary]);
  });

  it("8. 水 불일치 + mood 일치 곡 → 제외", () => {
    const moodHitWrongElement = record({
      id: "mood-wood",
      title: "분위기만 맞음",
      primaryElement: "木",
      secondaryElements: ["火"],
      moodTags: ["평온", "따뜻함", "위로"],
    });
    const result = filterMusicByFinalElement({
      finalElement: "水",
      catalog: [moodHitWrongElement],
    });
    expect(result.primaryMatches).toEqual([]);
    expect(result.secondaryMatches).toEqual([]);
    expect(result.candidates).toEqual([]);
  });

  it("9. 해당 오행 곡 0개 → []", () => {
    const catalog = [
      record({ id: "wood", title: "나무", primaryElement: "木" }),
      record({ id: "fire", title: "불", primaryElement: "火", secondaryElements: ["土"] }),
    ];
    const result = filterMusicByFinalElement({ finalElement: "水", catalog });
    expect(result).toEqual({
      primaryMatches: [],
      secondaryMatches: [],
      candidates: [],
    });
  });

  it("10. finalElement=null → []", () => {
    const catalog = [
      record({ id: "water", title: "물", primaryElement: "水" }),
      record({ id: "wood", title: "나무", primaryElement: "木", secondaryElements: ["水"] }),
    ];
    const result = filterMusicByFinalElement({ finalElement: null, catalog });
    expect(result).toEqual({
      primaryMatches: [],
      secondaryMatches: [],
      candidates: [],
    });
  });

  it("primary 일치 곡은 secondary에 중복 포함하지 않음", () => {
    const both = record({
      id: "both",
      title: "대표+보조",
      primaryElement: "水",
      secondaryElements: ["水", "木"],
    });
    const result = filterMusicByFinalElement({ finalElement: "水", catalog: [both] });
    expect(result.primaryMatches).toEqual([both]);
    expect(result.secondaryMatches).toEqual([]);
    expect(result.candidates).toEqual([both]);
  });

  it.each(["木", "火", "土", "金", "水"] as const)(
    "5오행 %s: 불일치 primary/secondary는 candidates에 없음",
    (element: Element) => {
      const others = (["木", "火", "土", "金", "水"] as const).filter((item) => item !== element);
      const catalog = others.map((other) =>
        record({
          id: `only-${other}`,
          title: other,
          primaryElement: other,
          secondaryElements: others.filter((item) => item !== other),
        }),
      );
      const result = filterMusicByFinalElement({ finalElement: element, catalog });
      expect(result.candidates).toEqual([]);
    },
  );
});
