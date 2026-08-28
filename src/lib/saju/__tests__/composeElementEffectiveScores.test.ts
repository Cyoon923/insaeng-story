/**
 * Clash + Transform 공통 Effective 합성.
 * Opening · Luck 합 · UI · Natal/Need 변경은 범위 밖이다.
 */
import { describe, expect, it } from "vitest";
import {
  buildElementEffectiveProfiles,
  composeElementEffectiveScores,
  sumElementDeltas,
} from "@/lib/saju/effective/composeElementEffectiveScores";
import {
  clampToDisplayRange,
  resolveNearestStrengthLevel,
} from "@/lib/saju/effective/resolveEffectiveStrengthLevel";
import type { ElementEffectiveDelta, NatalElementScore } from "@/lib/saju/effective/types";
import { buildElementStrengthProfiles } from "@/lib/saju/elements/buildElementStrengthProfiles";
import { buildNeedResolution } from "@/lib/saju/elements/needResolution";
import { toElementStrengthDisplayProfiles } from "@/lib/saju/elements/toElementStrengthDisplayProfiles";
import { buildClashAttenuationModifiers } from "@/lib/saju/luck/clash/buildClashAttenuationModifiers";
import { buildClashElementDeltas } from "@/lib/saju/luck/clash/buildClashElementDeltas";
import { buildNatalClashSnapshot } from "@/lib/saju/luck/clash/buildNatalClashSnapshot";
import { collapseClashAttenuationKeys } from "@/lib/saju/luck/clash/collapseClashAttenuationKeys";
import { detectLuckClashRelations } from "@/lib/saju/luck/clash/detectLuckClashRelations";
import type { ClashAttenuationModifier, LuckClashTarget } from "@/lib/saju/luck/clash/types";
import { buildTransformElementDeltas } from "@/lib/saju/transform/buildTransformElementDeltas";
import { buildTransformRawModifiers } from "@/lib/saju/transform/buildTransformRawModifiers";
import { detectTransformRelations } from "@/lib/saju/transform/detectTransformRelations";
import { evaluateTransformCandidates } from "@/lib/saju/transform/evaluateTransformCandidates";
import { resolveTransformCompetition } from "@/lib/saju/transform/resolveTransformCompetition";
import type { TransformResolvedModifier } from "@/lib/saju/transform/types";
import type { Branch, Element, FourPillars, HourPillar, Pillar, Stem } from "@/lib/saju/types";
import { ELEMENTS } from "@/lib/saju/types";

const W = { start: new Date("2026-02-04T00:00:00Z"), end: new Date("2027-02-04T00:00:00Z") };

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
function natal(overrides: Partial<Record<Element, number>> = {}): NatalElementScore[] {
  return ELEMENTS.map((element) => ({ element, natalScore: overrides[element] ?? 52 }));
}
const clashMod = (element: Element, natalSlot: "year" | "month" | "day" | "hour"): ClashAttenuationModifier => ({
  element,
  natalSlot,
  attenuation: 4,
});
function resolvedModifier(
  active: boolean,
  contentionStatus: TransformResolvedModifier["contentionStatus"],
): TransformResolvedModifier {
  return {
    combineId: "삼합-申子辰",
    kind: "삼합",
    attenuations: [
      { origin: "natal", slot: "year", layer: "branch", element: "金", attenuation: 16 / 3 },
      { origin: "natal", slot: "month", layer: "branch", element: "水", attenuation: 16 / 3 },
      { origin: "natal", slot: "day", layer: "branch", element: "土", attenuation: 16 / 3 },
    ],
    targetElement: "水",
    boost: 16 / 3 + 16 / 3 + 16 / 3,
    modifierActive: active,
    contentionStatus,
  };
}

describe("delta 없음 / 단일 층", () => {
  it("delta가 없으면 Natal 그대로", () => {
    for (const row of composeElementEffectiveScores(natal())) {
      expect(row.delta).toBe(0);
      expect(row.internalEffectiveScore).toBe(row.natalScore);
    }
  });

  it("clash만 — 오행별 음수 delta", () => {
    const deltas = buildClashElementDeltas([clashMod("木", "day")]);
    expect(deltas).toEqual([{ element: "木", delta: -4 }]);
    const rows = composeElementEffectiveScores(natal(), deltas);
    expect(rows.find((r) => r.element === "木")!.internalEffectiveScore).toBe(48);
  });

  it("transform active — attenuation 음수 + boost 양수", () => {
    const deltas = buildTransformElementDeltas([resolvedModifier(true, "uncontested")]);
    const byElement = new Map(deltas.map((d) => [d.element, d.delta]));
    expect(byElement.get("金")).toBeCloseTo(-16 / 3, 10);
    expect(byElement.get("土")).toBeCloseTo(-16 / 3, 10);
    // 水는 participant(-16/3)와 target(+16)이 합쳐진 net
    expect(byElement.get("水")).toBeCloseTo(16 - 16 / 3, 10);
    // transform은 총량 보존
    expect(deltas.reduce((t, d) => t + d.delta, 0)).toBeCloseTo(0, 10);
  });
});

describe("inactive modifier", () => {
  it("lost는 delta 0", () => {
    expect(buildTransformElementDeltas([resolvedModifier(false, "lost")])).toEqual([]);
  });

  it("competition-unresolved도 delta 0", () => {
    expect(buildTransformElementDeltas([resolvedModifier(false, "competition-unresolved")])).toEqual([]);
  });

  it("modifierActive를 최종 게이트로 쓴다 (status가 won이어도 false면 미적용)", () => {
    expect(buildTransformElementDeltas([resolvedModifier(false, "won")])).toEqual([]);
  });
});

describe("층 합성", () => {
  it("같은 오행이면 signed delta가 합산된다", () => {
    // 木: clash −4, transform participant −16/3
    const transform: TransformResolvedModifier = {
      ...resolvedModifier(true, "uncontested"),
      attenuations: [{ origin: "natal", slot: "year", layer: "branch", element: "木", attenuation: 16 / 3 }],
      targetElement: "火",
      boost: 16 / 3,
    };
    const rows = composeElementEffectiveScores(
      natal({ 木: 52 }),
      buildClashElementDeltas([clashMod("木", "day")]),
      buildTransformElementDeltas([transform]),
    );
    const wood = rows.find((r) => r.element === "木")!;
    expect(wood.delta).toBeCloseTo(-4 - 16 / 3, 10);
    expect(wood.internalEffectiveScore).toBeCloseTo(52 - 4 - 16 / 3, 10);
  });

  it("서로 다른 오행이면 독립 적용된다", () => {
    const transform: TransformResolvedModifier = {
      ...resolvedModifier(true, "uncontested"),
      attenuations: [{ origin: "natal", slot: "year", layer: "branch", element: "火", attenuation: 6 }],
      targetElement: "土",
      boost: 6,
    };
    const rows = composeElementEffectiveScores(
      natal(),
      buildClashElementDeltas([clashMod("水", "day")]),
      buildTransformElementDeltas([transform]),
    );
    const byElement = new Map(rows.map((r) => [r.element, r]));
    expect(byElement.get("水")!.delta).toBe(-4);
    expect(byElement.get("火")!.delta).toBe(-6);
    expect(byElement.get("土")!.delta).toBe(6);
    expect(byElement.get("金")!.delta).toBe(0);
  });

  it("동일 targetElement의 active transform 2개는 boost가 누적된다", () => {
    // 자리를 공유하지 않는 비경합 구성 (L4에서 둘 다 uncontested 가능한 형태)
    const a: TransformResolvedModifier = {
      ...resolvedModifier(true, "uncontested"),
      combineId: "삼합-申子辰",
      attenuations: [{ origin: "natal", slot: "year", layer: "branch", element: "金", attenuation: 6 }],
      targetElement: "水",
      boost: 6,
    };
    const b: TransformResolvedModifier = {
      ...resolvedModifier(true, "uncontested"),
      combineId: "방합-亥子丑",
      kind: "방합",
      attenuations: [{ origin: "natal", slot: "hour", layer: "branch", element: "土", attenuation: 6 }],
      targetElement: "水",
      boost: 6,
    };
    const deltas = buildTransformElementDeltas([a, b]);
    expect(deltas.find((d) => d.element === "水")!.delta).toBe(12);
  });

  it("동일 오행 participant 여러 행이 전부 합산된다", () => {
    // 방합 寅卯辰 = 木·木·土
    const fang: TransformResolvedModifier = {
      ...resolvedModifier(true, "uncontested"),
      combineId: "방합-寅卯辰",
      kind: "방합",
      attenuations: [
        { origin: "natal", slot: "year", layer: "branch", element: "木", attenuation: 16 / 3 },
        { origin: "natal", slot: "month", layer: "branch", element: "木", attenuation: 16 / 3 },
        { origin: "natal", slot: "day", layer: "branch", element: "土", attenuation: 16 / 3 },
      ],
      targetElement: "木",
      boost: 16,
    };
    const deltas = buildTransformElementDeltas([fang]);
    // 木: −16/3 −16/3 +16
    expect(deltas.find((d) => d.element === "木")!.delta).toBeCloseTo(16 - (32 / 3), 10);
  });

  it("전체 delta 합은 clash 손실만큼 음수다 (transform은 보존)", () => {
    const clash = buildClashElementDeltas([clashMod("木", "day"), clashMod("木", "month")]);
    const transform = buildTransformElementDeltas([resolvedModifier(true, "uncontested")]);
    const total = [...clash, ...transform].reduce((t, d) => t + d.delta, 0);
    expect(total).toBeCloseTo(-8, 10);
  });
});

describe("Internal unclamped / Display clamp / Level", () => {
  it("Internal은 8 미만·음수·96 초과를 유지한다", () => {
    const low = composeElementEffectiveScores(natal({ 水: 10 }), [{ element: "水", delta: -16 }]);
    expect(low.find((r) => r.element === "水")!.internalEffectiveScore).toBe(-6);

    const high = composeElementEffectiveScores(natal({ 火: 92 }), [{ element: "火", delta: 16 }]);
    expect(high.find((r) => r.element === "火")!.internalEffectiveScore).toBe(108);
  });

  it("Display만 clamp된다", () => {
    const profiles = buildElementEffectiveProfiles(
      composeElementEffectiveScores(natal({ 水: 10, 火: 92 }), [
        { element: "水", delta: -16 },
        { element: "火", delta: 16 },
      ]),
    );
    const water = profiles.find((p) => p.element === "水")!;
    const fire = profiles.find((p) => p.element === "火")!;
    expect(water.internalEffectiveScore).toBe(-6);
    expect(water.displayEffectiveScore).toBe(8);
    expect(fire.internalEffectiveScore).toBe(108);
    expect(fire.displayEffectiveScore).toBe(96);
  });

  it("midpoint → upper 계약이 유지된다", () => {
    // 44 − 2 = 42 (gap 40–44의 중점) → upper = balanced
    const profiles = buildElementEffectiveProfiles(
      composeElementEffectiveScores(natal({ 木: 44 }), [{ element: "木", delta: -2 }]),
    );
    const wood = profiles.find((p) => p.element === "木")!;
    expect(wood.displayEffectiveScore).toBe(42);
    expect(wood.effectiveStrengthLevel).toBe("balanced");
    expect(wood.effectiveStrengthLevel).toBe(resolveNearestStrengthLevel(42));
  });

  it("Display는 기존 band clamp를 그대로 쓴다", () => {
    for (const value of [-100, 0, 8, 52, 96, 200]) {
      expect(clampToDisplayRange(value)).toBe(clampToDisplayRange(value));
    }
    expect(clampToDisplayRange(-100)).toBe(8);
    expect(clampToDisplayRange(200)).toBe(96);
  });
});

describe("불변성 · 결정론 · 방어", () => {
  it("clash·transform modifier 입력을 변경하지 않는다", () => {
    const clash = [clashMod("木", "day")];
    const transform = [resolvedModifier(true, "uncontested"), resolvedModifier(false, "lost")];
    const clashBefore = JSON.parse(JSON.stringify(clash));
    const transformBefore = JSON.parse(JSON.stringify(transform));

    composeElementEffectiveScores(
      natal(),
      buildClashElementDeltas(clash),
      buildTransformElementDeltas(transform),
    );

    expect(JSON.parse(JSON.stringify(clash))).toEqual(clashBefore);
    expect(JSON.parse(JSON.stringify(transform))).toEqual(transformBefore);
  });

  it("inactive modifier 객체도 그대로 보존된다", () => {
    const inactive = resolvedModifier(false, "competition-unresolved");
    const before = JSON.parse(JSON.stringify(inactive));
    buildTransformElementDeltas([inactive]);
    expect(JSON.parse(JSON.stringify(inactive))).toEqual(before);
  });

  it("결정론적이며 빈 입력은 Natal 그대로", () => {
    const a = composeElementEffectiveScores(natal(), [], []);
    expect(a).toEqual(composeElementEffectiveScores(natal(), [], []));
    expect(a.every((r) => r.delta === 0)).toBe(true);
    expect(buildElementEffectiveProfiles([])).toEqual([]);
  });

  it("natal에 없는 오행 delta는 throw", () => {
    expect(() =>
      composeElementEffectiveScores([{ element: "火", natalScore: 52 }], [
        { element: "水", delta: -4 },
      ] as ElementEffectiveDelta[]),
    ).toThrow(/element 水 absent from natal scores/);
  });

  it("sumElementDeltas는 여러 층을 합산한다", () => {
    expect(
      sumElementDeltas([{ element: "木", delta: -4 }], [{ element: "木", delta: 10 }]),
    ).toEqual({ 木: 6 });
  });
});

describe("통합 — Transform(L1~L4) + Clash 파이프라인 → 공통 Effective", () => {
  it("한 원국에서 Transform active와 Clash가 동시에 발생한다", () => {
    // 申子辰 삼합(→水, month 子 참여, 壬 투출) + 세운 午가 natal 子를 충
    const pillars = chart("甲申", "丙子", "戊辰", "壬亥");

    const displaySet = toElementStrengthDisplayProfiles(buildElementStrengthProfiles(pillars));
    const natalScores: NatalElementScore[] = displaySet.profiles.map((p) => ({
      element: p.element,
      natalScore: p.displayScore,
    }));
    const needBefore = buildNeedResolution(pillars);

    // Transform L1→L4
    const candidates = evaluateTransformCandidates(pillars, detectTransformRelations(pillars));
    const resolved = resolveTransformCompetition(
      buildTransformRawModifiers(candidates),
      candidates,
    );
    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.modifierActive).toBe(true);

    // Clash — 세운 午 ↔ natal 子(month)
    const snapshot = buildNatalClashSnapshot(pillars);
    const targets: LuckClashTarget[] = [{ luckKind: "annual-year", branch: "午", window: W }];
    const relations = detectLuckClashRelations(snapshot, targets);
    expect(relations).toHaveLength(1);
    expect(relations[0]!.natalSlot).toBe("month");

    const clashModifiers = buildClashAttenuationModifiers(
      collapseClashAttenuationKeys(snapshot, relations),
    );
    expect(clashModifiers.length).toBeGreaterThan(0);

    // 공통 합성
    const clashDeltas = buildClashElementDeltas(clashModifiers);
    const transformDeltas = buildTransformElementDeltas(resolved);
    const profiles = buildElementEffectiveProfiles(
      composeElementEffectiveScores(natalScores, clashDeltas, transformDeltas),
    );

    expect(profiles.map((p) => p.element)).toEqual([...ELEMENTS]);
    for (const profile of profiles) {
      expect(profile.internalEffectiveScore).toBe(profile.natalScore + profile.delta);
      expect(profile.displayEffectiveScore).toBe(clampToDisplayRange(profile.internalEffectiveScore));
      expect(profile.effectiveStrengthLevel).toBe(
        resolveNearestStrengthLevel(profile.displayEffectiveScore),
      );
    }

    // 두 층이 모두 실제로 기여했다
    expect(clashDeltas.some((d) => d.delta < 0)).toBe(true);
    expect(transformDeltas.some((d) => d.delta !== 0)).toBe(true);
    // 전체 합은 clash 손실만큼만 음수 (transform은 보존)
    const clashLoss = clashDeltas.reduce((t, d) => t + d.delta, 0);
    const totalDelta = profiles.reduce((t, p) => t + p.delta, 0);
    expect(totalDelta).toBeCloseTo(clashLoss, 10);

    // Natal Strength profile · Need 불변
    expect(toElementStrengthDisplayProfiles(buildElementStrengthProfiles(pillars))).toEqual(displaySet);
    expect(buildNeedResolution(pillars)).toEqual(needBefore);
  });
});
