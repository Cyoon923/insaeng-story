/**
 * TBD-01c-wiring · W3 7단계 — 세운(annual-year) production 연결 통합 테스트.
 * Transform · Opening · 대운/월운/일운 · source severity는 범위 밖이다.
 */
import { describe, expect, it } from "vitest";
import { buildElementStrengthProfiles } from "@/lib/saju/elements/buildElementStrengthProfiles";
import { buildNeedResolution } from "@/lib/saju/elements/needResolution";
import { toElementStrengthDisplayProfiles } from "@/lib/saju/elements/toElementStrengthDisplayProfiles";
import { buildAnnualTarget } from "@/lib/saju/luck/annual/buildAnnualTarget";
import {
  resolveAnnualClashEffective,
  toLuckClashTarget,
} from "@/lib/saju/luck/annual/resolveAnnualClashEffective";
import type { Branch, Element, FourPillars, HourPillar, Pillar, Stem } from "@/lib/saju/types";
import { ELEMENTS } from "@/lib/saju/types";

/** 2026 세운 = 丙午 → 지지 午. 충 상대는 子. */
const YEAR = 2026;

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

function attenuationOf(
  profiles: ReturnType<typeof resolveAnnualClashEffective>["profiles"],
  element: Element,
): number {
  return profiles.find((p) => p.element === element)!.attenuation;
}

describe("toLuckClashTarget · AnnualTarget → generic", () => {
  it("luckKind/branch/window만 넘긴다", () => {
    const annual = buildAnnualTarget(YEAR);
    const generic = toLuckClashTarget(annual);

    expect(Object.keys(generic).sort()).toEqual(["branch", "luckKind", "window"]);
    expect(generic.luckKind).toBe("annual-year");
    expect(generic.branch).toBe(annual.branch);
    for (const forbidden of ["year", "boundaryBasis", "stem", "stemElement", "branchMainElement"]) {
      expect(generic).not.toHaveProperty(forbidden);
    }
  });

  it("window 값을 보존하되 Date를 복사한다 (원본 mutation 차단)", () => {
    const annual = buildAnnualTarget(YEAR);
    const startBefore = annual.windowStart.getTime();
    const endBefore = annual.windowEnd.getTime();
    const generic = toLuckClashTarget(annual);

    expect(generic.window.start.getTime()).toBe(startBefore);
    expect(generic.window.end.getTime()).toBe(endBefore);

    generic.window.start.setFullYear(1999);
    expect(annual.windowStart.getTime()).toBe(startBefore);
    expect(annual.windowEnd.getTime()).toBe(endBefore);
  });
});

describe("resolveAnnualClashEffective · 충 발생 여부", () => {
  it("세운 지지가 원국과 충하지 않으면 attenuation 0", () => {
    // 2026 午 ↔ 충 상대는 子. 원국에 子 없음.
    const result = resolveAnnualClashEffective({
      pillars: chart("甲寅", "乙卯", "丙辰", "丁巳"),
      year: YEAR,
    });

    expect(result.relations).toEqual([]);
    for (const profile of result.profiles) {
      expect(profile.attenuation).toBe(0);
      expect(profile.internalEffectiveScore).toBe(profile.natalScore);
      expect(profile.displayEffectiveScore).toBe(profile.natalScore);
    }
  });

  it("원국 1슬롯과 충하면 그 슬롯 rootElements만 δ=4", () => {
    // day 子 하나만 충. 子 = 癸 정기 → 水만.
    const pillars = chart("甲寅", "乙卯", "丙子", "丁巳");
    const result = resolveAnnualClashEffective({ pillars, year: YEAR });

    expect(result.relations).toHaveLength(1);
    expect(result.relations[0]!.natalSlot).toBe("day");
    expect(result.relations[0]!.clashPairId).toBe("clash-zi-wu");

    expect(attenuationOf(result.profiles, "水")).toBe(4);
    for (const element of ELEMENTS) {
      if (element !== "水") expect(attenuationOf(result.profiles, element)).toBe(0);
    }
  });

  it("같은 지지가 원국 여러 슬롯과 충하면 슬롯별 key가 생긴다", () => {
    // year·day 모두 子 → relation 2건, 水 감쇠 8
    const pillars = chart("甲子", "乙卯", "丙子", "丁巳");
    const result = resolveAnnualClashEffective({ pillars, year: YEAR });

    expect(result.relations).toHaveLength(2);
    expect(result.relations.map((r) => r.natalSlot)).toEqual(["year", "day"]);
    expect(attenuationOf(result.profiles, "水")).toBe(8);
  });

  it("피격되지 않은 오행은 Natal을 그대로 유지한다", () => {
    const pillars = chart("甲子", "乙卯", "丙午", "丁巳");
    const result = resolveAnnualClashEffective({ pillars, year: YEAR });

    const displaySet = toElementStrengthDisplayProfiles(buildElementStrengthProfiles(pillars));
    for (const profile of result.profiles) {
      if (profile.attenuation !== 0) continue;
      const natal = displaySet.profiles.find((p) => p.element === profile.element)!;
      expect(profile.natalScore).toBe(natal.displayScore);
      expect(profile.internalEffectiveScore).toBe(natal.displayScore);
      expect(profile.effectiveStrengthLevel).toBe(natal.strengthLevel);
    }
  });
});

describe("resolveAnnualClashEffective · hour unknown", () => {
  it("hour unknown이면 hour relation도 hour attenuation도 생기지 않는다", () => {
    // hour가 있었다면 子로 충했을 구성을 unknown으로 바꾼다.
    const withHour = resolveAnnualClashEffective({
      pillars: chart("甲寅", "乙卯", "丙辰", "戊子"),
      year: YEAR,
    });
    expect(withHour.relations.map((r) => r.natalSlot)).toEqual(["hour"]);
    expect(attenuationOf(withHour.profiles, "水")).toBe(4);

    const unknownHour = resolveAnnualClashEffective({
      pillars: chart("甲寅", "乙卯", "丙辰", "unknown"),
      year: YEAR,
    });
    expect(unknownHour.relations).toEqual([]);
    expect(unknownHour.relations.some((r) => r.natalSlot === "hour")).toBe(false);
    for (const element of ELEMENTS) {
      expect(attenuationOf(unknownHour.profiles, element)).toBe(0);
    }
  });
});

describe("resolveAnnualClashEffective · 축 분리와 불변성", () => {
  const pillars = chart("甲子", "乙卯", "丙子", "丁巳");

  it("Natal Strength profile이 전후로 동일하다", () => {
    const before = toElementStrengthDisplayProfiles(buildElementStrengthProfiles(pillars));
    const result = resolveAnnualClashEffective({ pillars, year: YEAR });
    expect(result.profiles.some((p) => p.attenuation > 0)).toBe(true);

    const after = toElementStrengthDisplayProfiles(buildElementStrengthProfiles(pillars));
    expect(after).toEqual(before);
  });

  it("Need가 전후로 동일하다", () => {
    const before = buildNeedResolution(pillars);
    resolveAnnualClashEffective({ pillars, year: YEAR });
    expect(buildNeedResolution(pillars)).toEqual(before);
  });

  it("FourPillars를 변경하지 않는다", () => {
    const snapshot = JSON.parse(JSON.stringify(pillars));
    resolveAnnualClashEffective({ pillars, year: YEAR });
    expect(JSON.parse(JSON.stringify(pillars))).toEqual(snapshot);
  });

  it("AnnualTarget window가 오염되지 않는다", () => {
    const annual = buildAnnualTarget(YEAR);
    const start = annual.windowStart.getTime();
    const end = annual.windowEnd.getTime();

    const result = resolveAnnualClashEffective({ pillars, year: YEAR });
    result.target.window.start.setFullYear(1999);
    result.target.window.end.setFullYear(1999);

    const again = buildAnnualTarget(YEAR);
    expect(again.windowStart.getTime()).toBe(start);
    expect(again.windowEnd.getTime()).toBe(end);
  });

  it("Annual window가 결과에 보존된다 (시작 포함 · 끝 배타)", () => {
    const annual = buildAnnualTarget(YEAR);
    const result = resolveAnnualClashEffective({ pillars, year: YEAR });

    expect(result.target.window.start.getTime()).toBe(annual.windowStart.getTime());
    expect(result.target.window.end.getTime()).toBe(annual.windowEnd.getTime());
    expect(result.target.window.start.getTime()).toBeLessThan(
      result.target.window.end.getTime(),
    );
    // 다음 해 시작 = 올해 끝 (배타 경계)
    expect(buildAnnualTarget(YEAR + 1).windowStart.getTime()).toBe(
      annual.windowEnd.getTime(),
    );
  });

  it("결과가 결정론적이다", () => {
    const a = resolveAnnualClashEffective({ pillars, year: YEAR });
    const b = resolveAnnualClashEffective({ pillars, year: YEAR });
    expect(a).toEqual(b);
    expect(a.profiles.map((p) => p.element)).toEqual([...ELEMENTS]);
  });

  it("Effective Level은 별도 파생값이며 Natal Level과 구분된다", () => {
    // 水가 8 감쇠되어 Level이 내려갈 수 있는 구성
    const result = resolveAnnualClashEffective({ pillars, year: YEAR });
    const displaySet = toElementStrengthDisplayProfiles(buildElementStrengthProfiles(pillars));

    for (const profile of result.profiles) {
      const natal = displaySet.profiles.find((p) => p.element === profile.element)!;
      // Natal 좌표는 그대로 보존되어 결과에 실린다
      expect(profile.natalScore).toBe(natal.displayScore);
      // Effective는 파생 — Natal Level 필드를 덮어쓰지 않는다
      expect(natal.strengthLevel).toBeDefined();
      expect(profile).not.toHaveProperty("strengthLevel");
    }
  });
});
