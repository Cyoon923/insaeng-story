import { describe, expect, it } from "vitest";
import { selectMusicBySupplementElement } from "@/lib/saju/music/selectMusicBySupplementElement";
import type { MusicRecommendationGate } from "@/lib/saju/music/types";
import type { MusicCatalogRecord } from "@/lib/saju/speakable/music/catalogTypes";
import type { MusicRecommendationHints } from "@/lib/saju/speakable/types";
import type { Element } from "@/lib/saju/types";
import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { buildNeedResolution } from "@/lib/saju/elements/needResolution";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { buildStrengthSummary } from "@/lib/saju/elements/strengthSummary";
import { resolveFinalElement } from "@/lib/saju/final/resolveFinalElement";
import { resolveSupplementFlow } from "@/lib/saju/final/resolveSupplementFlow";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import type { FourPillars } from "@/lib/saju/types";

function hints(partial: Partial<MusicRecommendationHints> = {}): MusicRecommendationHints {
  return {
    moodTags: ["따뜻한"],
    lyricHints: ["따뜻한 이야기"],
    elementThemeBag: ["水"],
    forbidden: [],
    provenance: [],
    ...partial,
  };
}

function gate(partial: Partial<MusicRecommendationGate> = {}): MusicRecommendationGate {
  return {
    state: "DIRECT",
    elementMode: "supported-soft",
    supportedElements: ["水"],
    contextualElements: [],
    reasons: [],
    ...partial,
  };
}

function record(
  partial: Partial<MusicCatalogRecord> &
    Pick<MusicCatalogRecord, "id" | "title" | "primaryElement">,
): MusicCatalogRecord {
  return {
    youtubeUrl: `https://www.youtube.com/watch?v=${partial.id}`,
    secondaryElements: [],
    moodTags: ["따뜻함"],
    situationTags: [],
    energyTags: [],
    message: "따뜻한 이야기",
    lyricKeywords: [],
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function ids(candidates: { record: MusicCatalogRecord }[]): string[] {
  return candidates.map((item) => item.record.id);
}

function assertOnlyElement(candidates: { record: MusicCatalogRecord }[], element: Element) {
  for (const item of candidates) {
    const ok =
      item.record.primaryElement === element ||
      item.record.secondaryElements.includes(element);
    expect(ok).toBe(true);
  }
}

describe("selectMusicBySupplementElement", () => {
  it("A. 木 — primary/secondary 포함, 非木 mood 일치 제외", () => {
    const catalog = [
      record({ id: "wood-primary", title: "목1", primaryElement: "木", createdAt: "2026-02-01T00:00:00.000Z" }),
      record({
        id: "wood-secondary",
        title: "목2",
        primaryElement: "火",
        secondaryElements: ["木"],
        createdAt: "2026-03-01T00:00:00.000Z",
      }),
      record({ id: "fire-mood", title: "불", primaryElement: "火", createdAt: "2026-01-01T00:00:00.000Z" }),
    ];
    const selected = selectMusicBySupplementElement({
      supplementElement: "木",
      gate: gate(),
      hints: hints(),
      catalog,
    });
    expect(ids(selected)).toEqual(["wood-primary", "wood-secondary"]);
    assertOnlyElement(selected, "木");
    expect(ids(selected)).not.toContain("fire-mood");
  });

  it.each(["火", "土", "金", "水"] as const)("B–E. %s only candidates", (element) => {
    const catalog = [
      record({ id: `${element}-hit`, title: "hit", primaryElement: element }),
      record({
        id: `${element}-sec`,
        title: "sec",
        primaryElement: "木",
        secondaryElements: [element],
      }),
      record({ id: "other", title: "other", primaryElement: "木", moodTags: ["따뜻함"] }),
    ];
    const selected = selectMusicBySupplementElement({
      supplementElement: element,
      gate: gate({ supportedElements: ["木"] }),
      hints: hints(),
      catalog,
    });
    expect(ids(selected).sort()).toEqual([`${element}-hit`, `${element}-sec`].sort());
    assertOnlyElement(selected, element);
  });

  it("F. primary 일치가 secondary-only보다 먼저", () => {
    const catalog = [
      record({
        id: "sec",
        title: "보조",
        primaryElement: "火",
        secondaryElements: ["木"],
        moodTags: ["따뜻함"],
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
      record({
        id: "pri",
        title: "대표",
        primaryElement: "木",
        moodTags: ["따뜻함"],
        createdAt: "2026-06-01T00:00:00.000Z",
      }),
    ];
    const selected = selectMusicBySupplementElement({
      supplementElement: "木",
      gate: gate(),
      hints: hints(),
      catalog,
    });
    expect(ids(selected)).toEqual(["pri", "sec"]);
  });

  it("G. Supplement unresolved/null → []", () => {
    const catalog = [record({ id: "wood", title: "목", primaryElement: "木" })];
    expect(
      selectMusicBySupplementElement({
        supplementElement: null,
        gate: gate(),
        hints: hints(),
        catalog,
      }),
    ).toEqual([]);
  });

  it("H. 해당 오행 0개 → [] (다른 오행 fallback 없음)", () => {
    const catalog = [
      record({ id: "fire", title: "불", primaryElement: "火", moodTags: ["따뜻함", "평온"] }),
      record({ id: "safe", title: "안전", primaryElement: "土", moodTags: ["평온"] }),
    ];
    const selected = selectMusicBySupplementElement({
      supplementElement: "木",
      gate: gate({ state: "HOLD", elementMode: "off", supportedElements: [] }),
      hints: hints({ moodTags: [] }),
      catalog,
    });
    expect(selected).toEqual([]);
  });

  it("dedupes same id if listed once", () => {
    const catalog = [
      record({
        id: "both",
        title: "중복방지",
        primaryElement: "木",
        secondaryElements: ["木"],
      }),
    ];
    const selected = selectMusicBySupplementElement({
      supplementElement: "木",
      gate: gate(),
      hints: hints(),
      catalog,
    });
    expect(ids(selected)).toEqual(["both"]);
  });

  it("I. 대표 명식 Supplement=木 → 木 태그만", () => {
    const pillars: FourPillars = {
      year: { stem: "辛", branch: "酉" },
      month: { stem: "乙", branch: "未" },
      day: { stem: "丙", branch: "申" },
      hour: { stem: "戊", branch: "戌" },
      hourCertainty: "confirmed",
      warnings: [],
    };
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);
    const climate = buildAdjustedClimateSummary(pillars);
    const needResolution = buildNeedResolution(pillars);
    const fer = resolveFinalElement({
      pillars,
      summary: buildStrengthSummary(pillars),
      evidence,
      observations,
      climate,
      needResolution,
    });
    const flow = resolveSupplementFlow({
      pillars,
      finalResolution: fer,
      observations,
      climate,
      needResolution,
    });
    expect(flow.resolution.coreElement).toBe("火");
    expect(flow.resolution.supplementElement).toBe("木");

    const catalog = [
      record({ id: "wood", title: "목", primaryElement: "木" }),
      record({ id: "fire", title: "불", primaryElement: "火", moodTags: ["따뜻함"] }),
      record({
        id: "water-need-bag",
        title: "물",
        primaryElement: "水",
        moodTags: ["따뜻함"],
      }),
    ];
    const selected = selectMusicBySupplementElement({
      supplementElement: flow.resolution.supplementElement,
      gate: gate({ supportedElements: ["水", "火"] }),
      hints: hints({ elementThemeBag: ["水", "火"] }),
      catalog,
    });
    expect(ids(selected)).toEqual(["wood"]);
    assertOnlyElement(selected, "木");
  });
});
