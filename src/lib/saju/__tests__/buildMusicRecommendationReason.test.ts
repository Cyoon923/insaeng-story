import { describe, expect, it } from "vitest";
import {
  assertMusicRecommendationReasonCopySafe,
  buildMusicRecommendationReason,
} from "@/lib/saju/music/buildMusicRecommendationReason";
import type {
  MusicRecommendationCandidate,
  MusicRecommendationGate,
} from "@/lib/saju/music/types";
import type { FreeInterpretation } from "@/lib/saju/interpretation/types";
import type { ObservationInterpretation } from "@/lib/saju/observation/interpretation/types";
import type { MusicCatalogRecord } from "@/lib/saju/speakable/music/catalogTypes";
import type { MusicRecommendationHints } from "@/lib/saju/speakable/types";

function hints(partial: Partial<MusicRecommendationHints> = {}): MusicRecommendationHints {
  return {
    moodTags: ["촉촉한", "감싸는"],
    lyricHints: ["기운이 다소 따뜻한 쪽으로 보여요."],
    elementThemeBag: ["水"],
    forbidden: ["용신 확정"],
    provenance: [],
    ...partial,
  };
}

function gate(partial: Partial<MusicRecommendationGate> = {}): MusicRecommendationGate {
  return {
    state: "CONTEXTUAL",
    elementMode: "context-soft",
    supportedElements: [],
    contextualElements: ["水"],
    reasons: ["climate-or-context-signal"],
    ...partial,
  };
}

function record(partial: Partial<MusicCatalogRecord> & Pick<MusicCatalogRecord, "id" | "title">): MusicCatalogRecord {
  return {
    youtubeUrl: `https://www.youtube.com/watch?v=${partial.id}`,
    primaryElement: "木",
    secondaryElements: [],
    moodTags: ["촉촉한", "감싸는"],
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

function candidate(
  partial: Partial<MusicRecommendationCandidate> & { record: MusicCatalogRecord },
): MusicRecommendationCandidate {
  return {
    match: {
      matchedMoodTags: ["촉촉한", "감싸는"],
      matchedSituationTags: [],
      matchedEnergyTags: [],
      matchedLyricKeywords: [],
      matchedElements: [],
      elementMatchMode: "context-soft",
      messageMatched: true,
      provisional: true,
    },
    ...partial,
  };
}

function freeAB(): FreeInterpretation {
  return {
    headline: "강한 부분과 약한 부분이 함께 보여 한쪽으로 단정하기 어려워요.",
    explanation: "따뜻하고 메마른 성향이 함께 보일 수 있어요.",
    supportItems: [],
    cautionItems: [],
    climateNotes: [
      {
        text: "따뜻한 성향을 볼 때 물(水)의 차분하고 식혀 주는 성질을 참고해 볼 수 있어요. 꼭 필요한 기운으로 정한 것은 아니에요.",
        element: "水",
        stance: "tentative",
        origin: "climate-context",
      },
    ],
    uncertaintyNotes: [],
  };
}

function observationB(): ObservationInterpretation {
  return {
    dayStem: "丙",
    helpingRelations: [
      {
        kind: "generation-support",
        text: "나무와 불의 성질이 서로 이어지는 관계가 보여요.",
        elements: ["木", "火"],
        order: 0,
      },
    ],
    actingStructures: [
      {
        kind: "pressure-branch-anchor",
        element: "金",
        text: "쇠의 성질이 여러 자리에서 함께 나타나요.",
        order: 0,
      },
    ],
    coexistence: {
      kind: "support-and-pressure-coexist",
      text: "나를 돕는 관계와 다른 성질이 함께 나타나는 모습이 보여요.",
    },
    hiddenContextDetail: [],
  };
}

describe("buildMusicRecommendationReason — CONTEXTUAL A/B", () => {
  it("centers mood/climate for both 水 and non-水 matches", () => {
    const baseGate = gate();
    const free = freeAB();
    const water = candidate({
      record: record({ id: "water", title: "물결 노래", primaryElement: "水" }),
      match: {
        matchedMoodTags: ["촉촉한", "감싸는"],
        matchedSituationTags: [],
        matchedEnergyTags: [],
        matchedLyricKeywords: [],
        matchedElements: ["水"],
        elementMatchMode: "context-soft",
        messageMatched: true,
        provisional: true,
      },
    });
    const nonWater = candidate({
      record: record({ id: "wood", title: "나무결 노래", primaryElement: "木" }),
      match: {
        matchedMoodTags: ["촉촉한", "감싸는"],
        matchedSituationTags: [],
        matchedEnergyTags: [],
        matchedLyricKeywords: [],
        matchedElements: [],
        elementMatchMode: "context-soft",
        messageMatched: true,
        provisional: true,
      },
    });

    const waterView = buildMusicRecommendationReason({
      gate: baseGate,
      candidate: water,
      hints: hints(),
      freeInterpretation: free,
      observationInterpretation: observationB(),
    });
    const woodView = buildMusicRecommendationReason({
      gate: baseGate,
      candidate: nonWater,
      hints: hints(),
      freeInterpretation: free,
      observationInterpretation: observationB(),
    });

    expect(waterView.reason).toBe(
      "따뜻하고 메마른 성향을 참고해, 차분하고 감싸는 분위기의 곡을 골랐어요.",
    );
    expect(woodView.reason).toBe(waterView.reason);
    expect(waterView.reason).not.toMatch(/필요|용신|부족/);
    expect(woodView.reason).not.toMatch(/물 기운이 필요/);
    expect(waterView.badges).toEqual(expect.arrayContaining(["환경 참고", "분위기 추천"]));
    assertMusicRecommendationReasonCopySafe(waterView);
    assertMusicRecommendationReasonCopySafe(woodView);
  });
});

describe("buildMusicRecommendationReason — DIRECT / HOLD / Observation", () => {
  it("DIRECT allows soft direction wording without confirmation", () => {
    const view = buildMusicRecommendationReason({
      gate: gate({
        state: "DIRECT",
        elementMode: "supported-soft",
        supportedElements: ["木"],
        contextualElements: [],
      }),
      candidate: candidate({
        record: record({ id: "d", title: "직접 후보", primaryElement: "木" }),
        match: {
          matchedMoodTags: ["따뜻한"],
          matchedSituationTags: [],
          matchedEnergyTags: [],
          matchedLyricKeywords: [],
          matchedElements: ["木"],
          elementMatchMode: "supported-soft",
          messageMatched: false,
          provisional: false,
        },
      }),
      hints: hints({ moodTags: ["따뜻한"], elementThemeBag: ["木"] }),
      freeInterpretation: freeAB(),
    });

    expect(view.reason).toBe("지금 살펴본 보완 방향과 이 곡의 분위기가 잘 맞아요.");
    expect(view.reason).not.toMatch(/필요한 木|확정/);
    expect(view.badges).toContain("분위기 추천");
  });

  it("HOLD never mentions elements", () => {
    const view = buildMusicRecommendationReason({
      gate: gate({
        state: "HOLD",
        elementMode: "off",
        supportedElements: [],
        contextualElements: [],
      }),
      candidate: candidate({
        record: record({ id: "h", title: "홀드 곡", primaryElement: "水" }),
        match: {
          matchedMoodTags: ["잔잔한"],
          matchedSituationTags: [],
          matchedEnergyTags: [],
          matchedLyricKeywords: [],
          matchedElements: [],
          elementMatchMode: "off",
          messageMatched: false,
          provisional: true,
        },
      }),
      hints: hints({ moodTags: ["잔잔한"] }),
    });

    expect(view.reason).toBe(
      "지금은 한쪽 기운을 정하기보다 편안하게 들을 수 있는 분위기를 중심으로 골랐어요.",
    );
    expect(view.reason).not.toMatch(/[木火土金水]/);
    expect(view.badges).toEqual(["편안하게 듣기"]);
  });

  it("Observation changes reason only, not the selected candidate identity", () => {
    const selected = candidate({
      record: record({ id: "same", title: "동일 후보", primaryElement: "火" }),
    });
    const withoutObs = buildMusicRecommendationReason({
      gate: gate({ state: "CONTEXTUAL", contextualElements: [] }),
      candidate: selected,
      hints: hints(),
      freeInterpretation: {
        ...freeAB(),
        explanation: null,
        climateNotes: [],
      },
    });
    const withObs = buildMusicRecommendationReason({
      gate: gate({ state: "CONTEXTUAL", contextualElements: [] }),
      candidate: selected,
      hints: hints(),
      freeInterpretation: {
        ...freeAB(),
        explanation: null,
        climateNotes: [],
      },
      observationInterpretation: observationB(),
    });

    expect(withoutObs.title).toBe(withObs.title);
    expect(withoutObs.message).toBe(withObs.message);
    expect(withoutObs.reason).not.toBe(withObs.reason);
    expect(withObs.reason).toContain("여러 성질이 함께 보이는");
    expect(withObs.reason).not.toContain("generation-support");
    expect(withObs.reason).not.toContain("金이");
  });

  it("does not leak internal enums or codes", () => {
    const view = buildMusicRecommendationReason({
      gate: gate(),
      candidate: candidate({
        record: record({ id: "x", title: "카피 검사", primaryElement: "水" }),
        match: {
          matchedMoodTags: ["감싸는"],
          matchedSituationTags: [],
          matchedEnergyTags: [],
          matchedLyricKeywords: [],
          matchedElements: ["水"],
          elementMatchMode: "context-soft",
          messageMatched: true,
          provisional: true,
        },
      }),
      hints: hints(),
      freeInterpretation: freeAB(),
      observationInterpretation: observationB(),
    });

    const blob = JSON.stringify(view);
    expect(blob).not.toContain("CONTEXTUAL");
    expect(blob).not.toContain("context-soft");
    expect(blob).not.toContain("matchedElements");
    expect(blob).not.toContain("climate-or-context-signal");
  });
});
