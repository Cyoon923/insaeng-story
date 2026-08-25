import { describe, expect, it } from "vitest";
import {
  buildFreeResultViewModel,
  type FreeResultViewModel,
} from "@/lib/saju/speakable/buildFreeResultViewModel";
import type { SpeakableOutput, SpeakableTheme } from "@/lib/saju/speakable/types";
import type { Element, ElementPresenceAnalysis, ElementPresenceKind } from "@/lib/saju/types";
import { ELEMENTS } from "@/lib/saju/types";

function theme(
  partial: Partial<SpeakableTheme> & Pick<SpeakableTheme, "id" | "kind" | "phrase">,
): SpeakableTheme {
  return {
    provenance: [{ layer: "strength", evidenceRef: "test" }],
    ...partial,
  };
}

function presenceAll(
  kinds: Partial<Record<Element, ElementPresenceKind>> = {},
): ElementPresenceAnalysis[] {
  return ELEMENTS.map((element) => ({
    element,
    hourUnknown: false,
    presence: kinds[element] ?? "absent",
    visibleSlots: [],
    rootedSlots: [],
    monthOutletSlots: [],
  }));
}

function speakable(partial: Partial<SpeakableOutput> = {}): SpeakableOutput {
  return {
    speakableStatus: "ready-provisional",
    confidence: "provisional",
    provisional: true,
    hourUnknown: false,
    hourUnknownProvisional: false,
    observationThemes: [
      theme({
        id: "obs",
        kind: "strength-observation",
        phrase: "지금은 기대어 쉬어가는 쪽으로 읽힐 수 있어요.",
      }),
    ],
    supportThemes: [],
    cautionThemes: [],
    climateThemes: [],
    musicRecommendationHints: {
      moodTags: ["용신이면_안됨"],
      lyricHints: [],
      elementThemeBag: ["金"],
      forbidden: [],
      provenance: [],
    },
    internal: {
      strengthDirection: "leaning-weak",
      strengthNeedStatus: "ready",
      climateNeedStatus: "ready",
      relationPattern: "partial-overlap",
      resolutionStatus: "convergent",
      decisionBlockedBy: [],
    },
    fallbackApplied: [],
    ...partial,
  };
}

function assertNoForbidden(vm: FreeResultViewModel) {
  const serialized = JSON.stringify(vm);
  expect(serialized).not.toMatch(/"winner"/);
  expect(serialized).not.toMatch(/"score"/);
  expect(serialized).not.toMatch(/"rank"/);
  expect(serialized).not.toMatch(/"priority"/);
  expect(serialized).not.toMatch(/"yongsin"/);
  expect(serialized).not.toMatch(/"neededElement"/);
  expect(serialized).not.toMatch(/"%"/);
  expect(vm).not.toHaveProperty("musicRecommendationHints");
}

describe("buildFreeResultViewModel", () => {
  it("uses observationThemes[0] as headline", () => {
    const vm = buildFreeResultViewModel(speakable(), presenceAll());
    expect(vm.headline).toBe("지금은 기대어 쉬어가는 쪽으로 읽힐 수 있어요.");
    assertNoForbidden(vm);
  });

  it("falls back to a neutral headline when observation is empty", () => {
    const vm = buildFreeResultViewModel(
      speakable({ observationThemes: [] }),
      presenceAll(),
    );
    expect(vm.headline).toBe("지금은 한쪽으로 단정하지 않아요.");
  });

  it("maps presence to qualitative balance labels without scores", () => {
    const vm = buildFreeResultViewModel(
      speakable(),
      presenceAll({
        木: "rooted-visible",
        火: "unrooted-visible",
        土: "hidden-only",
        金: "absent",
        水: "rooted-visible",
      }),
    );
    expect(vm.balance).toHaveLength(5);
    expect(vm.balance.map((item) => item.element)).toEqual([...ELEMENTS]);
    expect(vm.balance.find((item) => item.element === "木")).toMatchObject({
      presence: "rooted-visible",
      label: "뚜렷",
    });
    expect(vm.balance.find((item) => item.element === "火")?.label).toBe("드러남·뿌리 약함");
    expect(vm.balance.find((item) => item.element === "土")?.label).toBe("숨음");
    expect(vm.balance.find((item) => item.element === "金")?.label).toBe("없음");
    expect(vm.balance.every((item) => !("percent" in item) && !("score" in item))).toBe(true);
  });

  it("builds unranked complement chips from support + climate need; phrases stay out of chips", () => {
    const vm = buildFreeResultViewModel(
      speakable({
        supportThemes: [
          theme({
            id: "s-water",
            kind: "need-strength-candidate",
            phrase: "채워주는 이미지가 후보예요.",
            elements: ["水"],
          }),
          theme({
            id: "s-wood",
            kind: "need-strength-candidate",
            phrase: "서로 기대는 이미지가 후보예요.",
            elements: ["木"],
          }),
        ],
        climateThemes: [
          theme({
            id: "c-obs",
            kind: "climate-observation",
            phrase: "조금 건조한 결이 보일 수 있어요(잠정).",
            elements: ["水"],
          }),
          theme({
            id: "c-need",
            kind: "need-climate-candidate",
            phrase: "촉촉하게 감싸는 이미지가 후보일 수 있어요(잠정).",
            elements: ["水"],
          }),
        ],
      }),
      presenceAll(),
    );

    expect(vm.complementChips.map((item) => item.element)).toEqual(["水", "木"]);
    expect(vm.complementChips.every((item) => item.provisional === true)).toBe(true);
    expect(vm.complementChips.find((item) => item.element === "水")?.source).toBe("strength-support");
    expect(vm.cautions).toEqual([]);
    assertNoForbidden(vm);
  });

  it("puts cautionThemes.phrase only in cautions; elements may feed chips separately", () => {
    const vm = buildFreeResultViewModel(
      speakable({
        cautionThemes: [
          theme({
            id: "cau-fire",
            kind: "need-strength-candidate",
            phrase: "내보내기·쓰임·다스림 쪽 이미지가 후보로 열려 있어요.",
            elements: ["火", "土"],
          }),
        ],
      }),
      presenceAll(),
    );

    expect(vm.cautions).toEqual([
      "내보내기·쓰임·다스림 쪽 이미지가 후보로 열려 있어요.",
    ]);
    expect(vm.complementChips.map((item) => item.element)).toEqual(["火", "土"]);
    expect(vm.complementChips.every((item) => item.source === "strength-caution")).toBe(true);
    expect(vm.cautions.join("")).not.toContain("火");
  });

  it("excludes Strength complement chips when hour is unknown / provisional", () => {
    const vm = buildFreeResultViewModel(
      speakable({
        hourUnknown: true,
        hourUnknownProvisional: true,
        supportThemes: [
          theme({
            id: "s",
            kind: "need-strength-candidate",
            phrase: "support",
            elements: ["木"],
          }),
        ],
        cautionThemes: [
          theme({
            id: "c",
            kind: "need-strength-candidate",
            phrase: "주의 문구",
            elements: ["火"],
          }),
        ],
        climateThemes: [
          theme({
            id: "cn",
            kind: "need-climate-candidate",
            phrase: "climate need",
            elements: ["水"],
          }),
        ],
      }),
      presenceAll(),
    );

    expect(vm.complementChips).toEqual([
      { element: "水", source: "climate", provisional: true },
    ]);
    expect(vm.cautions).toEqual(["주의 문구"]);
  });

  it("returns empty cautions when cautionThemes is empty", () => {
    const vm = buildFreeResultViewModel(speakable({ cautionThemes: [] }), presenceAll());
    expect(vm.cautions).toEqual([]);
  });

  it("does not use musicRecommendationHints for chips or headline", () => {
    const vm = buildFreeResultViewModel(
      speakable({
        observationThemes: [],
        supportThemes: [],
        climateThemes: [],
        musicRecommendationHints: {
          moodTags: ["잔잔한"],
          lyricHints: ["음악용"],
          elementThemeBag: ["金", "土"],
          forbidden: [],
          provenance: [],
        },
      }),
      presenceAll(),
    );
    expect(vm.headline).toBe("지금은 한쪽으로 단정하지 않아요.");
    expect(vm.complementChips).toEqual([]);
    expect(vm.complementChips.map((item) => item.element)).not.toContain("金");
  });

  it("dedupes complement chips and keeps appearance order without ranking fields", () => {
    const vm = buildFreeResultViewModel(
      speakable({
        supportThemes: [
          theme({
            id: "a",
            kind: "need-strength-candidate",
            phrase: "a",
            elements: ["水", "木"],
          }),
        ],
        climateThemes: [
          theme({
            id: "b",
            kind: "need-climate-candidate",
            phrase: "b",
            elements: ["水"],
          }),
        ],
      }),
      presenceAll(),
    );
    expect(vm.complementChips.map((item) => item.element)).toEqual(["水", "木"]);
    expect(vm.complementChips[0]).not.toHaveProperty("rank");
    expect(vm.complementChips[0]).not.toHaveProperty("score");
  });
});
