import { describe, expect, it } from "vitest";
import { selectMusicRecommendationCandidates } from "@/lib/saju/music/selectMusicRecommendationCandidates";
import type { MusicRecommendationGate } from "@/lib/saju/music/types";
import type { MusicCatalogRecord } from "@/lib/saju/speakable/music/catalogTypes";
import type { MusicRecommendationHints } from "@/lib/saju/speakable/types";

function hints(partial: Partial<MusicRecommendationHints> = {}): MusicRecommendationHints {
  return {
    moodTags: ["촉촉한", "감싸는"],
    lyricHints: [
      "기운이 다소 따뜻한 쪽으로 보여요.",
      "식혀 주는 물 이미지가 후보일 수 있어요.",
    ],
    elementThemeBag: ["水"],
    forbidden: ["용신 확정", "필요한 오행 확정"],
    provenance: [
      { layer: "climate", evidenceRef: "climate.boundary=contested-inherited" },
      { layer: "need-climate", evidenceRef: "need.climate.element=水" },
    ],
    ...partial,
  };
}

function gate(partial: Partial<MusicRecommendationGate>): MusicRecommendationGate {
  return {
    state: "CONTEXTUAL",
    elementMode: "context-soft",
    supportedElements: [],
    contextualElements: [],
    reasons: [],
    ...partial,
  };
}

function record(
  partial: Partial<MusicCatalogRecord> & Pick<MusicCatalogRecord, "id" | "title">,
): MusicCatalogRecord {
  return {
    youtubeUrl: `https://www.youtube.com/watch?v=${partial.id}`,
    primaryElement: "木",
    secondaryElements: [],
    moodTags: ["평온"],
    situationTags: [],
    energyTags: [],
    message: "부드럽게 감싸 안는 이야기",
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
  expect(serialized).not.toMatch(/"neededElement"/);
}

describe("selectMusicRecommendationCandidates — CONTEXTUAL A/B + 水", () => {
  it("keeps both 水 and non-水 mood matches; 水 is not forced first", () => {
    const catalog = [
      record({
        id: "non-water",
        title: "평온한 나무결",
        primaryElement: "木",
        moodTags: ["평온", "감성", "회복", "위로", "따뜻함"],
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
      record({
        id: "water",
        title: "평온한 물결",
        primaryElement: "水",
        moodTags: ["평온", "감성", "회복", "위로", "따뜻함"],
        createdAt: "2026-06-01T00:00:00.000Z",
      }),
      record({
        id: "force-mood-miss",
        title: "활력 행진",
        primaryElement: "水",
        moodTags: ["활력", "자신감"],
      }),
    ];

    const contextualGate = gate({
      state: "CONTEXTUAL",
      elementMode: "context-soft",
      contextualElements: ["水"],
    });

    const sourceHints = hints();
    const candidates = selectMusicRecommendationCandidates({
      gate: contextualGate,
      hints: sourceHints,
      catalog,
    });

    // Original Speakable hints must stay unchanged.
    expect(sourceHints.moodTags).toEqual(["촉촉한", "감싸는"]);

    expect(candidates.map((item) => item.record.id)).toEqual(["non-water", "water"]);
    expect(candidates[0]?.record.primaryElement).not.toBe("水");
    expect(candidates.find((item) => item.record.id === "water")?.match.matchedElements).toEqual([
      "水",
    ]);
    expect(candidates.find((item) => item.record.id === "non-water")?.match.matchedElements).toEqual(
      [],
    );
    expect(candidates.every((item) => item.match.elementMatchMode === "context-soft")).toBe(true);
    assertNoRanking(candidates);
  });
});

describe("selectMusicRecommendationCandidates — DIRECT", () => {
  it("records 木 soft match but mood-fitting non-木 beats mood-missing 木", () => {
    const catalog = [
      record({
        id: "wood-wrong-mood",
        title: "목 행진",
        primaryElement: "木",
        moodTags: ["활력"],
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
      record({
        id: "fire-right-mood",
        title: "따뜻한 불빛",
        primaryElement: "火",
        moodTags: ["따뜻함"],
        createdAt: "2026-02-01T00:00:00.000Z",
      }),
      record({
        id: "wood-right-mood",
        title: "따뜻한 나무",
        primaryElement: "木",
        moodTags: ["따뜻함"],
        createdAt: "2026-03-01T00:00:00.000Z",
      }),
    ];

    const candidates = selectMusicRecommendationCandidates({
      gate: gate({
        state: "DIRECT",
        elementMode: "supported-soft",
        supportedElements: ["木"],
        contextualElements: [],
      }),
      hints: hints({ moodTags: ["따뜻한"], elementThemeBag: ["木"] }),
      catalog,
    });

    expect(candidates.map((item) => item.record.id)).toEqual([
      "wood-right-mood",
      "fire-right-mood",
    ]);
    // Same mood tier: element soft can order 木 before 非木, but mood-missing 木 never wins.
    expect(candidates.map((item) => item.record.id)).not.toContain("wood-wrong-mood");
    expect(candidates.find((item) => item.record.id === "wood-right-mood")?.match.matchedElements).toEqual(
      ["木"],
    );
    expect(candidates.find((item) => item.record.id === "fire-right-mood")?.match.matchedElements).toEqual(
      [],
    );
  });
});

describe("selectMusicRecommendationCandidates — HOLD / forbidden / inactive", () => {
  it("HOLD ignores element matches", () => {
    const candidates = selectMusicRecommendationCandidates({
      gate: gate({
        state: "HOLD",
        elementMode: "off",
        supportedElements: [],
        contextualElements: ["水"],
      }),
      hints: hints({ moodTags: ["촉촉한"], elementThemeBag: ["水"] }),
      catalog: [
        record({
          id: "water",
          title: "물 곡",
          primaryElement: "水",
          moodTags: ["평온"],
        }),
      ],
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.match.matchedElements).toEqual([]);
    expect(candidates[0]?.match.elementMatchMode).toBe("off");
  });

  it("always excludes forbidden and inactive rows", () => {
    const catalog = [
      record({
        id: "ok",
        title: "괜찮은 곡",
        moodTags: ["평온"],
      }),
      record({
        id: "forbidden",
        title: "용신 확정 가이드",
        moodTags: ["평온"],
        message: "용신 확정으로 추천",
      }),
      record({
        id: "inactive",
        title: "비활성",
        moodTags: ["평온"],
        active: false,
      }),
    ];

    const candidates = selectMusicRecommendationCandidates({
      gate: gate({
        state: "CONTEXTUAL",
        elementMode: "context-soft",
        contextualElements: ["水"],
      }),
      hints: hints(),
      catalog,
    });

    expect(candidates.map((item) => item.record.id)).toEqual(["ok"]);
  });

  it("PROVISIONAL still mood-filters like DIRECT (policy unchanged)", () => {
    const candidates = selectMusicRecommendationCandidates({
      gate: gate({
        state: "PROVISIONAL",
        elementMode: "supported-soft",
        supportedElements: ["木"],
      }),
      hints: hints({ moodTags: ["따뜻한"] }),
      catalog: [
        record({ id: "hit", title: "따뜻함 곡", moodTags: ["따뜻함"] }),
        record({ id: "miss", title: "활력 곡", moodTags: ["활력"] }),
      ],
    });

    expect(candidates.map((item) => item.record.id)).toEqual(["hit"]);
    expect(candidates[0]?.match.provisional).toBe(true);
  });
});
