/**
 * TBD-01c-wiring · W3 6단계 — Display clamp + Effective Level 재판정.
 * Natal Level 변경 · Need/Core/Supplement · Transform/Opening 합성은 범위 밖이다.
 */
import { describe, expect, it } from "vitest";
import { buildElementStrengthProfiles } from "@/lib/saju/elements/buildElementStrengthProfiles";
import { buildNeedResolution } from "@/lib/saju/elements/needResolution";
import {
  STRENGTH_DISPLAY_BANDS,
  toElementStrengthDisplayProfiles,
} from "@/lib/saju/elements/toElementStrengthDisplayProfiles";
import { buildClashAttenuationModifiers } from "@/lib/saju/luck/clash/buildClashAttenuationModifiers";
import { buildClashEffectiveProfiles } from "@/lib/saju/luck/clash/buildClashEffectiveProfiles";
import { buildClashEffectiveScores } from "@/lib/saju/luck/clash/buildClashEffectiveScores";
import { buildNatalClashSnapshot } from "@/lib/saju/luck/clash/buildNatalClashSnapshot";
import { collapseClashAttenuationKeys } from "@/lib/saju/luck/clash/collapseClashAttenuationKeys";
import { detectLuckClashRelations } from "@/lib/saju/luck/clash/detectLuckClashRelations";
import {
  clampToDisplayRange,
  resolveNearestStrengthLevel,
} from "@/lib/saju/luck/clash/resolveEffectiveStrengthLevel";
import type {
  ClashEffectiveScore,
  LuckClashTarget,
  NatalElementScore,
} from "@/lib/saju/luck/clash/types";
import type { Branch, Element, FourPillars, HourPillar, Pillar, Stem } from "@/lib/saju/types";
import { ELEMENTS } from "@/lib/saju/types";

const W = {
  start: new Date("2026-02-04T00:00:00Z"),
  end: new Date("2027-02-04T00:00:00Z"),
};

function score(
  element: Element,
  natalScore: number,
  attenuation: number,
): ClashEffectiveScore {
  return {
    element,
    natalScore,
    attenuation,
    internalEffectiveScore: natalScore - attenuation,
  };
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

describe("clampToDisplayRange · 표시 구간", () => {
  it("Internal 6 → Display 8", () => {
    expect(clampToDisplayRange(6)).toBe(8);
  });

  it("Internal -6 → Display 8", () => {
    expect(clampToDisplayRange(-6)).toBe(8);
  });

  it("Internal 100 → Display 96", () => {
    expect(clampToDisplayRange(100)).toBe(96);
  });

  it("구간 안의 값은 그대로 통과한다", () => {
    for (const v of [8, 22, 52, 80, 96]) expect(clampToDisplayRange(v)).toBe(v);
  });

  it("경계값은 기존 band 표에서 온다 (복제 아님)", () => {
    expect(clampToDisplayRange(-999)).toBe(STRENGTH_DISPLAY_BANDS["very-weak"].lo);
    expect(clampToDisplayRange(999)).toBe(STRENGTH_DISPLAY_BANDS["very-strong"].hi);
  });
});

describe("resolveNearestStrengthLevel · band 판정", () => {
  it("band 내부 값은 해당 Level", () => {
    for (const level of Object.keys(STRENGTH_DISPLAY_BANDS) as Array<
      keyof typeof STRENGTH_DISPLAY_BANDS
    >) {
      const { lo, hi } = STRENGTH_DISPLAY_BANDS[level];
      expect(resolveNearestStrengthLevel(lo)).toBe(level);
      expect(resolveNearestStrengthLevel(hi)).toBe(level);
      expect(resolveNearestStrengthLevel(Math.floor((lo + hi) / 2))).toBe(level);
    }
  });

  it("gap에서는 nearest band를 고른다", () => {
    // gap (20,24): 21 → very-weak, 23 → weak
    expect(resolveNearestStrengthLevel(21)).toBe("very-weak");
    expect(resolveNearestStrengthLevel(23)).toBe("weak");
    // gap (40,44): 41 → weak, 43 → balanced
    expect(resolveNearestStrengthLevel(41)).toBe("weak");
    expect(resolveNearestStrengthLevel(43)).toBe("balanced");
  });

  it("정확한 midpoint는 upper Level", () => {
    expect(resolveNearestStrengthLevel(22)).toBe("weak"); // (20,24) 중점
    expect(resolveNearestStrengthLevel(42)).toBe("balanced"); // (40,44)
    expect(resolveNearestStrengthLevel(62)).toBe("strong"); // (60,64)
    expect(resolveNearestStrengthLevel(82)).toBe("very-strong"); // (80,84)
  });

  it("소수 midpoint도 upper (연속 갭)", () => {
    expect(resolveNearestStrengthLevel(41.9)).toBe("weak");
    expect(resolveNearestStrengthLevel(42.0)).toBe("balanced");
    expect(resolveNearestStrengthLevel(42.1)).toBe("balanced");
  });
});

describe("buildClashEffectiveProfiles · 합성", () => {
  it("Internal은 clamp되지 않고 그대로 보존된다", () => {
    const profiles = buildClashEffectiveProfiles([score("水", 10, 4), score("木", 10, 16)]);
    expect(profiles[0]!.internalEffectiveScore).toBe(6);
    expect(profiles[0]!.displayEffectiveScore).toBe(8);
    expect(profiles[1]!.internalEffectiveScore).toBe(-6); // 음수 유지
    expect(profiles[1]!.displayEffectiveScore).toBe(8);
  });

  it("clamp된 Display 기준으로 Level을 판정한다", () => {
    const profiles = buildClashEffectiveProfiles([score("水", 10, 16)]);
    expect(profiles[0]!.effectiveStrengthLevel).toBe("very-weak");
  });

  it("attenuation 0이면 Natal 좌표의 Level을 유지한다", () => {
    // Natal 52(balanced band 안)에 피격 없음
    const profiles = buildClashEffectiveProfiles([score("火", 52, 0)]);
    expect(profiles[0]!.displayEffectiveScore).toBe(52);
    expect(profiles[0]!.effectiveStrengthLevel).toBe("balanced");
    expect(profiles[0]!.internalEffectiveScore).toBe(52);
  });

  it("감쇠로 Level이 내려갈 수 있다 (파생값)", () => {
    // 44(balanced lo) − 4 = 40 → weak band hi
    const profiles = buildClashEffectiveProfiles([score("火", 44, 4)]);
    expect(profiles[0]!.displayEffectiveScore).toBe(40);
    expect(profiles[0]!.effectiveStrengthLevel).toBe("weak");
  });

  it("입력을 변경하지 않는다", () => {
    const scores = [score("火", 52, 4), score("土", 44, 8)];
    const before = JSON.parse(JSON.stringify(scores));
    buildClashEffectiveProfiles(scores);
    expect(JSON.parse(JSON.stringify(scores))).toEqual(before);
  });

  it("결과는 결정론적이고 입력 순서를 보존한다", () => {
    const scores = [score("火", 52, 4), score("土", 44, 8), score("水", 30, 0)];
    const a = buildClashEffectiveProfiles(scores);
    const b = buildClashEffectiveProfiles(scores);
    expect(a).toEqual(b);
    expect(a.map((p) => p.element)).toEqual(["火", "土", "水"]);
  });

  it("행에 Need/Core/Supplement/certainty 필드가 없다", () => {
    const profiles = buildClashEffectiveProfiles([score("火", 52, 4)]);
    for (const p of profiles) {
      expect(Object.keys(p).sort()).toEqual([
        "attenuation",
        "displayEffectiveScore",
        "effectiveStrengthLevel",
        "element",
        "internalEffectiveScore",
        "natalScore",
      ]);
      for (const forbidden of ["need", "core", "supplement", "certainty", "strengthLevel"]) {
        expect(p).not.toHaveProperty(forbidden);
      }
    }
  });
});

describe("buildClashEffectiveProfiles · 전체 파이프라인", () => {
  it("snapshot → detect → collapse → modifier → Internal → Display → Level", () => {
    const pillars = chart("甲子", "丙午", "戊午", "乙卯");

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
    const scores = buildClashEffectiveScores(natalScores, modifiers);
    const profiles = buildClashEffectiveProfiles(scores);

    expect(profiles.map((p) => p.element)).toEqual([...ELEMENTS]);

    // 午(month·day) 피격 → 火/土 각각 8
    const byElement = new Map(profiles.map((p) => [p.element, p]));
    expect(byElement.get("火")!.attenuation).toBe(8);
    expect(byElement.get("土")!.attenuation).toBe(8);

    for (const p of profiles) {
      // 공식
      expect(p.internalEffectiveScore).toBe(p.natalScore - p.attenuation);
      // Display는 clamp된 값
      expect(p.displayEffectiveScore).toBe(clampToDisplayRange(p.internalEffectiveScore));
      // Level은 Display 기준
      expect(p.effectiveStrengthLevel).toBe(
        resolveNearestStrengthLevel(p.displayEffectiveScore),
      );
    }

    // 비피격 오행은 Natal Level 그대로
    const metal = byElement.get("金")!;
    expect(metal.attenuation).toBe(0);
    expect(metal.effectiveStrengthLevel).toBe(
      displaySet.profiles.find((p) => p.element === "金")!.strengthLevel,
    );

    // Natal Strength는 변하지 않는다 — Effective는 별도 파생
    const after = toElementStrengthDisplayProfiles(buildElementStrengthProfiles(pillars));
    expect(after).toEqual(displaySet);
  });

  it("파이프라인이 Need를 바꾸지 않는다 (Strength ≠ Need 축 분리)", () => {
    const pillars = chart("甲子", "丙午", "戊午", "乙卯");
    const needBefore = buildNeedResolution(pillars);

    const displaySet = toElementStrengthDisplayProfiles(buildElementStrengthProfiles(pillars));
    const natalScores: NatalElementScore[] = displaySet.profiles.map((p) => ({
      element: p.element,
      natalScore: p.displayScore,
    }));
    const snapshot = buildNatalClashSnapshot(pillars);
    const relations = detectLuckClashRelations(snapshot, [
      { luckKind: "annual-year", branch: "子", window: W },
    ]);
    const profiles = buildClashEffectiveProfiles(
      buildClashEffectiveScores(
        natalScores,
        buildClashAttenuationModifiers(collapseClashAttenuationKeys(snapshot, relations)),
      ),
    );
    expect(profiles.some((p) => p.attenuation > 0)).toBe(true); // 실제로 감쇠가 일어남

    // 그럼에도 Need는 그대로다 — clash 모듈은 Need를 import조차 하지 않는다.
    expect(buildNeedResolution(pillars)).toEqual(needBefore);
  });
});
