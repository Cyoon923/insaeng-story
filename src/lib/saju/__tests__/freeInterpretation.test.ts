import { describe, expect, it } from "vitest";
import {
  buildAdjustedClimateSummary,
  buildFreeInterpretation,
  buildNeedCandidateSet,
  buildNeedResolution,
  buildStrengthSummary,
} from "@/lib/saju";
import { buildSpeakableOutput } from "@/lib/saju/speakable/buildSpeakableOutput";
import type { FreeInterpretation } from "@/lib/saju/interpretation/types";
import type { FourPillars, HourPillar, Pillar } from "@/lib/saju/types";

function chart(partial: { year: Pillar; month: Pillar; day: Pillar; hour: HourPillar }): FourPillars {
  return {
    ...partial,
    hourCertainty: partial.hour === "unknown" ? "unknown" : "confirmed",
    warnings: [],
  };
}

function interpret(pillars: FourPillars) {
  const strength = buildStrengthSummary(pillars);
  const climate = buildAdjustedClimateSummary(pillars);
  const needCandidates = buildNeedCandidateSet(pillars);
  const needResolution = buildNeedResolution(pillars);
  const speakable = buildSpeakableOutput({
    strength,
    climate,
    needCandidates,
    needResolution,
    hourUnknown: pillars.hour === "unknown",
  });
  const free = buildFreeInterpretation({
    speakable,
    strength,
    climate,
    needCandidates,
    needResolution,
  });
  return { strength, climate, needCandidates, needResolution, speakable, free };
}

const FORBIDDEN = [
  "contested-inherited",
  "partial-overlap",
  "convergent",
  "decisionBlockedBy",
  "leaning-weak",
  "leaning-strong",
  "용신",
  "희신",
  "신강",
  "신약",
  "조후",
  "떠올릴",
  "완화",
  "잔여",
  "상충",
  "CLI-",
  "NEED-",
  "FB-",
];

function allText(free: FreeInterpretation): string {
  return [
    free.headline,
    free.explanation ?? "",
    ...free.supportItems.map((item) => item.text),
    ...free.cautionItems.map((item) => item.text),
    ...free.climateNotes.map((item) => item.text),
    ...free.uncertaintyNotes,
  ].join("\n");
}

function assertNoForbidden(free: FreeInterpretation) {
  const text = allText(free);
  for (const term of FORBIDDEN) {
    expect(text, `must not contain ${term}`).not.toContain(term);
  }
}

describe("buildFreeInterpretation meaning-preserving structure", () => {
  it("RC-01 — preserves 火/土/金 as separate cautionItems", () => {
    const { free } = interpret(
      chart({
        year: { stem: "甲", branch: "寅" },
        month: { stem: "甲", branch: "寅" },
        day: { stem: "甲", branch: "子" },
        hour: { stem: "甲", branch: "子" },
      }),
    );

    expect(free.supportItems).toEqual([]);
    expect(free.climateNotes).toEqual([]);
    expect(free.cautionItems).toHaveLength(3);
    expect(free.cautionItems.map((item) => item.element).sort()).toEqual(["火", "土", "金"].sort());
    expect(free.cautionItems.every((item) => item.origin === "strength-caution")).toBe(true);
    expect(free.cautionItems.every((item) => item.stance === "open-candidate")).toBe(true);
    expect(free.explanation).toBeNull();
    assertNoForbidden(free);
  });

  it("RC-02 — 水 open-candidate, 木 held-aside, Climate 水 tentative separated", () => {
    const { needResolution, free } = interpret(
      chart({
        year: { stem: "丙", branch: "午" },
        month: { stem: "戊", branch: "戌" },
        day: { stem: "甲", branch: "申" },
        hour: { stem: "甲", branch: "子" },
      }),
    );

    expect(needResolution.supportedElements.map((item) => item.element)).toContain("水");
    expect(needResolution.deferredElements.map((item) => item.element)).toContain("木");

    const waterSupport = free.supportItems.find((item) => item.element === "水");
    const woodSupport = free.supportItems.find((item) => item.element === "木");
    expect(waterSupport?.stance).toBe("open-candidate");
    expect(woodSupport?.stance).toBe("held-aside");
    expect(free.supportItems.every((item) => item.origin === "strength-support")).toBe(true);

    const climateWater = free.climateNotes.find((item) => item.element === "水");
    expect(climateWater?.stance).toBe("tentative");
    expect(climateWater?.origin).toBe("climate-context");
    expect(climateWater?.text).toContain("꼭 필요한 기운으로 정한 것은 아니에요");

    expect(free.supportItems.some((item) => item.origin === "climate-context")).toBe(false);
    assertNoForbidden(free);
  });

  it("RC-04 — no supportItems; Climate 水 tentative with context meaning", () => {
    const { free, needCandidates } = interpret(
      chart({
        year: { stem: "甲", branch: "辰" },
        month: { stem: "丙", branch: "午" },
        day: { stem: "丁", branch: "酉" },
        hour: { stem: "庚", branch: "申" },
      }),
    );

    expect(free.supportItems).toEqual([]);
    expect(needCandidates.strengthNeedStatus).toBe("unresolved");
    expect(free.climateNotes).toHaveLength(1);
    expect(free.climateNotes[0]?.element).toBe("水");
    expect(free.climateNotes[0]?.stance).toBe("tentative");
    expect(free.climateNotes[0]?.text).toContain("꼭 필요한 기운으로 정한 것은 아니에요");
    expect(free.explanation).toBe("따뜻하고 메마른 성향이 함께 보일 수 있어요.");
    assertNoForbidden(free);
  });

  it("RC-05 — hour unknown + contested Climate", () => {
    const { free, speakable } = interpret(
      chart({
        year: { stem: "甲", branch: "酉" },
        month: { stem: "庚", branch: "酉" },
        day: { stem: "甲", branch: "酉" },
        hour: "unknown",
      }),
    );

    expect(speakable.hourUnknown).toBe(true);
    expect(free.uncertaintyNotes.some((note) => note.includes("태어난 시간"))).toBe(true);
    expect(free.climateNotes.some((item) => item.element === "水" && item.stance === "tentative")).toBe(
      true,
    );
    expect(free.supportItems).toEqual([]);
    assertNoForbidden(free);
  });

  it("RC-06 — direction null still gets hour-unknown uncertainty", () => {
    const { strength, free } = interpret(
      chart({
        year: { stem: "甲", branch: "寅" },
        month: { stem: "辛", branch: "亥" },
        day: { stem: "庚", branch: "子" },
        hour: "unknown",
      }),
    );

    expect(strength.directionCandidate).toBeNull();
    expect(free.uncertaintyNotes.some((note) => note.includes("태어난 시간"))).toBe(true);
    expect(free.climateNotes.some((item) => item.element === "火" && item.stance === "context-only")).toBe(
      true,
    );
    assertNoForbidden(free);
  });

  it("explanation is null when there is no extra observation", () => {
    const { free } = interpret(
      chart({
        year: { stem: "甲", branch: "寅" },
        month: { stem: "甲", branch: "寅" },
        day: { stem: "甲", branch: "子" },
        hour: { stem: "甲", branch: "子" },
      }),
    );
    expect(free.explanation).toBeNull();
  });

  it("mixed with empty themes — empty support/caution/climate, no filler explanation", () => {
    const { free } = interpret(
      chart({
        year: { stem: "己", branch: "卯" },
        month: { stem: "丙", branch: "子" },
        day: { stem: "戊", branch: "午" },
        hour: { stem: "戊", branch: "午" },
      }),
    );
    expect(free.supportItems).toEqual([]);
    expect(free.cautionItems).toEqual([]);
    expect(free.climateNotes).toEqual([]);
    expect(free.explanation).toBeNull();
    expect(free.headline).toBe(
      "힘이 덜한 계절감 속에서도 돕는 기운이 함께 보여 한쪽 흐름만으로 설명하기 어려워요.",
    );
    expect(free.uncertaintyNotes.some((note) => note.includes("강한 부분과 약한 부분"))).toBe(false);
    expect(free.uncertaintyNotes.some((note) => note.includes("여러 가능성"))).toBe(true);
    assertNoForbidden(free);
  });

  it("NX-07 — partial climate uses mitigation uncertainty, not conflict copy", () => {
    const { climate, free, needCandidates } = interpret(
      chart({
        year: { stem: "庚", branch: "午" },
        month: { stem: "壬", branch: "午" },
        day: { stem: "甲", branch: "寅" },
        hour: { stem: "戊", branch: "辰" },
      }),
    );

    expect(climate.temperature.outcome).toBe("partially-mitigated");
    expect(climate.moisture.outcome).toBe("partially-mitigated");
    expect(needCandidates.strengthNeedCandidates).toEqual([]);
    expect(needCandidates.climateNeedCandidates).toEqual([]);
    expect(free.explanation).toBe(
      "한쪽이 강하게 보이지만, 이를 부드럽게 만드는 기운도 함께 보여요.",
    );
    expect(free.uncertaintyNotes).toContain(
      "누그러뜨리는 흐름은 있지만 아직 어느 정도인지는 단정하기 어려워요.",
    );
    expect(free.uncertaintyNotes.some((note) => note.includes("서로 다른 기운"))).toBe(false);
    expect(free.supportItems).toEqual([]);
    expect(free.climateNotes).toEqual([]);
    assertNoForbidden(free);
  });

  it("NX-08 — conflict meaning stays in explanation; uncertainty does not repeat it", () => {
    const conflictPhrase = "서로 다른 기운이 함께 보여 한쪽으로 단정하기 어려워요.";
    const { climate, free, needCandidates } = interpret(
      chart({
        year: { stem: "甲", branch: "辰" },
        month: { stem: "丙", branch: "子" },
        day: { stem: "戊", branch: "寅" },
        hour: { stem: "壬", branch: "子" },
      }),
    );

    expect(climate.temperature.outcome).toBe("mitigation-reinforcement-conflict");
    expect(climate.moisture.outcome).toBe("mitigation-reinforcement-conflict");
    expect(needCandidates.strengthNeedCandidates).toEqual([]);
    expect(needCandidates.climateNeedCandidates).toEqual([]);
    expect(free.explanation).toBe(conflictPhrase);
    expect(free.uncertaintyNotes).not.toContain(conflictPhrase);
    expect(free.uncertaintyNotes.some((note) => note.includes("누그러뜨리는"))).toBe(false);
    expect(free.supportItems).toEqual([]);
    expect(free.climateNotes).toEqual([]);
    assertNoForbidden(free);
  });
});

describe("buildFreeInterpretation headline — mixed/null COPY-COLLAPSE fix", () => {
  const STRONG = "스스로 밀고 나가는 힘이 비교적 강하게 보일 수 있어요.";
  const WEAK = "혼자 밀어붙이기보다 도움을 받으며 힘을 채우는 쪽이 더 편할 수 있어요.";
  const NULL_HEADLINE =
    "지금 확인되는 관계만으로는 어느 한쪽 흐름이라고 정하기 어려워요.";

  it("keeps leaning-strong headline unchanged", () => {
    const { strength, free } = interpret(
      chart({
        year: { stem: "甲", branch: "寅" },
        month: { stem: "甲", branch: "寅" },
        day: { stem: "甲", branch: "子" },
        hour: { stem: "甲", branch: "子" },
      }),
    );
    expect(strength.directionCandidate).toBe("leaning-strong");
    expect(free.headline).toBe(STRONG);
  });

  it("keeps leaning-weak headline unchanged", () => {
    const { strength, free } = interpret(
      chart({
        year: { stem: "乙", branch: "亥" },
        month: { stem: "乙", branch: "酉" },
        day: { stem: "甲", branch: "寅" },
        hour: { stem: "甲", branch: "子" },
      }),
    );
    expect(strength.directionCandidate).toBe("leaning-weak");
    expect(free.headline).toBe(WEAK);
  });

  it("uses null-only headline (not mixed coexistence copy)", () => {
    const { strength, free } = interpret(
      chart({
        year: { stem: "甲", branch: "寅" },
        month: { stem: "辛", branch: "亥" },
        day: { stem: "庚", branch: "子" },
        hour: "unknown",
      }),
    );
    expect(strength.directionCandidate).toBeNull();
    expect(free.headline).toBe(NULL_HEADLINE);
    expect(free.headline).not.toContain("서로 다른 힘이 함께");
    expect(free.headline).not.toContain("강한 부분과 약한 부분");
  });

  it("mixed headlines differ from null and follow mixedPattern deterministically", () => {
    const cases: Array<{
      pillars: FourPillars;
      pattern: NonNullable<ReturnType<typeof buildStrengthSummary>["mixedPattern"]>;
      headline: string;
    }> = [
      {
        pillars: chart({
          year: { stem: "己", branch: "卯" },
          month: { stem: "丙", branch: "子" },
          day: { stem: "戊", branch: "午" },
          hour: { stem: "戊", branch: "午" },
        }),
        pattern: "weak-season-with-support",
        headline:
          "힘이 덜한 계절감 속에서도 돕는 기운이 함께 보여 한쪽 흐름만으로 설명하기 어려워요.",
      },
      {
        pillars: chart({
          year: { stem: "辛", branch: "酉" },
          month: { stem: "乙", branch: "未" },
          day: { stem: "丙", branch: "申" },
          hour: { stem: "戊", branch: "戌" },
        }),
        pattern: "neutral-season-conflict",
        headline: "계절감이 한쪽으로 기울지 않은 가운데 서로 다른 힘이 함께 작용해요.",
      },
    ];

    for (const item of cases) {
      const a = interpret(item.pillars);
      const b = interpret(item.pillars);
      expect(a.strength.directionCandidate).toBe("mixed");
      expect(a.strength.mixedPattern).toBe(item.pattern);
      expect(a.free.headline).toBe(item.headline);
      expect(a.free.headline).not.toBe(NULL_HEADLINE);
      expect(a.free.headline).toBe(b.free.headline);
      expect(a.strength.directionCandidate).toBe(b.strength.directionCandidate);
      expect(a.strength.mixedPattern).toBe(b.strength.mixedPattern);
    }
  });
});
