/**
 * TBD-01c-wiring · W3 5단계 — Internal Effective Score 합성.
 * clamp · Level 재판정 · Transform/Opening 합성 · Need/Core/Supplement는 범위 밖이다.
 */
import { describe, expect, it } from "vitest";
import { buildElementStrengthProfiles } from "@/lib/saju/elements/buildElementStrengthProfiles";
import { toElementStrengthDisplayProfiles } from "@/lib/saju/elements/toElementStrengthDisplayProfiles";
import { buildClashAttenuationModifiers } from "@/lib/saju/luck/clash/buildClashAttenuationModifiers";
import { buildClashEffectiveScores } from "@/lib/saju/luck/clash/buildClashEffectiveScores";
import { buildNatalClashSnapshot } from "@/lib/saju/luck/clash/buildNatalClashSnapshot";
import { collapseClashAttenuationKeys } from "@/lib/saju/luck/clash/collapseClashAttenuationKeys";
import { detectLuckClashRelations } from "@/lib/saju/luck/clash/detectLuckClashRelations";
import type {
  ClashAttenuationModifier,
  LuckClashTarget,
  NatalElementScore,
} from "@/lib/saju/luck/clash/types";
import type { Branch, Element, FourPillars, HourPillar, Pillar, PillarSlot, Stem } from "@/lib/saju/types";
import { ELEMENTS } from "@/lib/saju/types";

const W = {
  start: new Date("2026-02-04T00:00:00Z"),
  end: new Date("2027-02-04T00:00:00Z"),
};

function natal(scores: Partial<Record<Element, number>>): NatalElementScore[] {
  return ELEMENTS.map((element) => ({ element, natalScore: scores[element] ?? 52 }));
}

function mod(element: Element, natalSlot: PillarSlot): ClashAttenuationModifier {
  return { element, natalSlot, attenuation: 4 };
}

function parsePillar(s: string): Pillar {
  return { stem: s[0] as Stem, branch: s[1] as Branch };
}

function chart(y: string, m: string, d: string, h: string | "unknown"): FourPillars {
  const hour: HourPillar = h === "unknown" ? "unknown" : parsePillar(h);
  return {
    year: parsePillar(y),
    month: parsePillar(m),
    day: parsePillar(d),
    hour,
    hourCertainty: h === "unknown" ? "unknown" : "confirmed",
    warnings: [],
  };
}

describe("buildClashEffectiveScores · 기본 공식", () => {
  it("attenuation이 없으면 Effective = Natal", () => {
    const rows = buildClashEffectiveScores(natal({ 火: 52 }), []);
    for (const row of rows) {
      expect(row.attenuation).toBe(0);
      expect(row.internalEffectiveScore).toBe(row.natalScore);
    }
  });

  it("1 slot 피격 → Natal − 4", () => {
    const rows = buildClashEffectiveScores(natal({ 火: 52 }), [mod("火", "month")]);
    const fire = rows.find((r) => r.element === "火")!;
    expect(fire.attenuation).toBe(4);
    expect(fire.internalEffectiveScore).toBe(48);
  });

  it("2/3/4 slot → −8 / −12 / −16", () => {
    const slots: PillarSlot[] = ["year", "month", "day", "hour"];
    const expected = [4, 8, 12, 16];
    for (let n = 1; n <= 4; n += 1) {
      const rows = buildClashEffectiveScores(
        natal({ 火: 52 }),
        slots.slice(0, n).map((s) => mod("火", s)),
      );
      const fire = rows.find((r) => r.element === "火")!;
      expect(fire.attenuation).toBe(expected[n - 1]);
      expect(fire.internalEffectiveScore).toBe(52 - expected[n - 1]!);
    }
  });

  it("여러 오행이 독립적으로 계산된다", () => {
    const rows = buildClashEffectiveScores(natal({ 火: 60, 土: 44, 水: 30 }), [
      mod("火", "month"),
      mod("火", "day"),
      mod("土", "month"),
    ]);
    const byElement = new Map(rows.map((r) => [r.element, r]));
    expect(byElement.get("火")).toMatchObject({ attenuation: 8, internalEffectiveScore: 52 });
    expect(byElement.get("土")).toMatchObject({ attenuation: 4, internalEffectiveScore: 40 });
    expect(byElement.get("水")).toMatchObject({ attenuation: 0, internalEffectiveScore: 30 });
  });

  it("피격되지 않은 오행은 Natal 그대로다 (전역 패널티 없음)", () => {
    const rows = buildClashEffectiveScores(natal({ 木: 72, 火: 52 }), [mod("火", "month")]);
    const wood = rows.find((r) => r.element === "木")!;
    expect(wood.attenuation).toBe(0);
    expect(wood.internalEffectiveScore).toBe(72);
  });
});

describe("buildClashEffectiveScores · unclamped", () => {
  it("Internal이 8 미만이어도 clamp하지 않는다", () => {
    const rows = buildClashEffectiveScores(natal({ 水: 10 }), [mod("水", "day")]);
    const water = rows.find((r) => r.element === "水")!;
    expect(water.internalEffectiveScore).toBe(6); // LO(8) 미만 그대로
  });

  it("Internal이 음수가 되어도 그대로 유지한다", () => {
    const slots: PillarSlot[] = ["year", "month", "day", "hour"];
    const rows = buildClashEffectiveScores(
      natal({ 水: 10 }),
      slots.map((s) => mod("水", s)),
    );
    const water = rows.find((r) => r.element === "水")!;
    expect(water.attenuation).toBe(16);
    expect(water.internalEffectiveScore).toBe(-6);
  });
});

describe("buildClashEffectiveScores · 방어 계약", () => {
  it("natal score가 중복되면 throw", () => {
    expect(() =>
      buildClashEffectiveScores(
        [
          { element: "火", natalScore: 52 },
          { element: "火", natalScore: 40 },
        ],
        [],
      ),
    ).toThrow(/duplicate natal score for element 火/);
  });

  it("natal에 없는 오행을 modifier가 참조하면 throw", () => {
    expect(() =>
      buildClashEffectiveScores([{ element: "火", natalScore: 52 }], [mod("水", "day")]),
    ).toThrow(/element 水 absent from natal scores/);
  });
});

describe("buildClashEffectiveScores · 불변성·필드 범위·결정론", () => {
  const scores = natal({ 火: 52, 土: 44 });
  const modifiers = [mod("火", "month"), mod("土", "day")];

  it("입력 natal score와 modifier를 변경하지 않는다", () => {
    const scoresBefore = JSON.parse(JSON.stringify(scores));
    const modsBefore = JSON.parse(JSON.stringify(modifiers));
    buildClashEffectiveScores(scores, modifiers);
    expect(JSON.parse(JSON.stringify(scores))).toEqual(scoresBefore);
    expect(JSON.parse(JSON.stringify(modifiers))).toEqual(modsBefore);
  });

  it("결과를 변형해도 입력이 오염되지 않는다", () => {
    const rows = buildClashEffectiveScores(scores, modifiers);
    rows[0]!.internalEffectiveScore = 999;
    expect(scores.find((s) => s.element === rows[0]!.element)!.natalScore).not.toBe(999);
  });

  it("결과는 ELEMENTS 순서로 결정론적이다", () => {
    const a = buildClashEffectiveScores(scores, modifiers);
    const b = buildClashEffectiveScores([...scores].reverse(), [...modifiers].reverse());
    expect(a.map((r) => r.element)).toEqual([...ELEMENTS]);
    expect(a).toEqual(b);
  });

  it("행에 Need/Core/Supplement/Level 관련 필드가 없다", () => {
    const rows = buildClashEffectiveScores(scores, modifiers);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual([
        "attenuation",
        "element",
        "internalEffectiveScore",
        "natalScore",
      ]);
      for (const forbidden of [
        "strengthLevel",
        "level",
        "certainty",
        "displayScore",
        "need",
        "core",
        "supplement",
        "clamped",
      ]) {
        expect(row).not.toHaveProperty(forbidden);
      }
    }
  });
});

describe("buildClashEffectiveScores · 전체 파이프라인", () => {
  it("snapshot → detect → collapse → modifier → Internal Effective", () => {
    // 丙午 일간대, month 午가 세운 子에게 충을 받는 구성
    const pillars = chart("甲子", "丙午", "戊午", "乙卯");

    // Natal Display Score 좌표를 경계에서 빌려온다 (presentation 타입은 넘기지 않는다)
    const displaySet = toElementStrengthDisplayProfiles(buildElementStrengthProfiles(pillars));
    const natalScores: NatalElementScore[] = displaySet.profiles.map((p) => ({
      element: p.element,
      natalScore: p.displayScore,
    }));

    const snapshot = buildNatalClashSnapshot(pillars);
    const targets: LuckClashTarget[] = [{ luckKind: "annual-year", branch: "子", window: W }];

    const relations = detectLuckClashRelations(snapshot, targets);
    const keys = collapseClashAttenuationKeys(snapshot, relations);
    const modifiers = buildClashAttenuationModifiers(keys);
    const rows = buildClashEffectiveScores(natalScores, modifiers);

    // 午는 month·day 두 슬롯 → 火/土가 각각 2슬롯 피격
    expect(relations.map((r) => r.natalSlot)).toEqual(["month", "day"]);
    const byElement = new Map(rows.map((r) => [r.element, r]));
    expect(byElement.get("火")!.attenuation).toBe(8);
    expect(byElement.get("土")!.attenuation).toBe(8);

    // 공식 검증 + 비피격 오행 불변
    for (const row of rows) {
      expect(row.internalEffectiveScore).toBe(row.natalScore - row.attenuation);
    }
    expect(byElement.get("金")!.attenuation).toBe(0);
    expect(byElement.get("金")!.internalEffectiveScore).toBe(byElement.get("金")!.natalScore);

    // Natal Strength profile은 그대로다 — Effective는 별도 파생 객체
    const after = toElementStrengthDisplayProfiles(buildElementStrengthProfiles(pillars));
    expect(after).toEqual(displaySet);
  });
});
