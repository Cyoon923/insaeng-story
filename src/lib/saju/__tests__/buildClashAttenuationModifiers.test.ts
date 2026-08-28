/**
 * TBD-01c-wiring · W3 4단계 — 감쇠 modifier 수치 적용.
 * Natal 합성 · Effective · clamp · Level 재판정 · Opening은 범위 밖이다.
 */
import { describe, expect, it } from "vitest";
import { buildNatalClashSnapshot } from "@/lib/saju/luck/clash/buildNatalClashSnapshot";
import {
  buildClashAttenuationModifiers,
  sumClashAttenuationByElement,
} from "@/lib/saju/luck/clash/buildClashAttenuationModifiers";
import { collapseClashAttenuationKeys } from "@/lib/saju/luck/clash/collapseClashAttenuationKeys";
import { CLASH_ATTENUATION_DELTA } from "@/lib/saju/luck/clash/constants";
import { detectLuckClashRelations } from "@/lib/saju/luck/clash/detectLuckClashRelations";
import type {
  ClashAttenuationKey,
  LuckClashKind,
  LuckClashTarget,
} from "@/lib/saju/luck/clash/types";
import type { Branch, Element, FourPillars, HourPillar, Pillar, PillarSlot, Stem } from "@/lib/saju/types";

const W = {
  start: new Date("2026-02-04T00:00:00Z"),
  end: new Date("2027-02-04T00:00:00Z"),
};

function key(element: Element, natalSlot: PillarSlot): ClashAttenuationKey {
  return { element, natalSlot };
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

describe("CLASH_ATTENUATION_DELTA · 단일 상수", () => {
  it("확정값 4이며 production에 한 번만 정의된다", () => {
    expect(CLASH_ATTENUATION_DELTA).toBe(4);
  });
});

describe("buildClashAttenuationModifiers · 기본 적용", () => {
  it("key 1개 → attenuation 4 modifier 1개", () => {
    expect(buildClashAttenuationModifiers([key("火", "month")])).toEqual([
      { element: "火", natalSlot: "month", attenuation: 4 },
    ]);
  });

  it("key 여러 개 → 각각 독립 modifier", () => {
    const modifiers = buildClashAttenuationModifiers([
      key("火", "month"),
      key("土", "month"),
    ]);
    expect(modifiers).toEqual([
      { element: "火", natalSlot: "month", attenuation: 4 },
      { element: "土", natalSlot: "month", attenuation: 4 },
    ]);
  });

  it("같은 오행의 서로 다른 natal slot도 각각 4", () => {
    const modifiers = buildClashAttenuationModifiers([
      key("火", "month"),
      key("火", "day"),
    ]);
    expect(modifiers.map((m) => m.attenuation)).toEqual([4, 4]);
    expect(modifiers.map((m) => m.natalSlot)).toEqual(["month", "day"]);
  });

  it("빈 입력 → 빈 결과", () => {
    expect(buildClashAttenuationModifiers([])).toEqual([]);
  });
});

describe("sumClashAttenuationByElement · 오행별 총 감쇠", () => {
  const slots: PillarSlot[] = ["year", "month", "day", "hour"];

  it("슬롯 수에 비례한다 — 1→4 · 2→8 · 3→12 · 4→16", () => {
    const expected = [4, 8, 12, 16];
    for (let n = 1; n <= 4; n += 1) {
      const keys = slots.slice(0, n).map((s) => key("火", s));
      const totals = sumClashAttenuationByElement(buildClashAttenuationModifiers(keys));
      expect(totals.火).toBe(expected[n - 1]);
    }
  });

  it("4 natal slot 상한에서 총 감쇠는 16이다", () => {
    const keys = slots.map((s) => key("火", s));
    const totals = sumClashAttenuationByElement(buildClashAttenuationModifiers(keys));
    expect(totals.火).toBe(16);
    // §1.6.8.1의 ±2 임계 21 미만
    expect(totals.火!).toBeLessThan(21);
  });

  it("피격되지 않은 오행은 키 자체가 없다 (전역 패널티 금지)", () => {
    const totals = sumClashAttenuationByElement(
      buildClashAttenuationModifiers([key("火", "month")]),
    );
    expect(Object.keys(totals)).toEqual(["火"]);
    expect(totals.水).toBeUndefined();
    expect(totals.木).toBeUndefined();
  });

  it("오행이 섞여도 각각 합산된다", () => {
    const totals = sumClashAttenuationByElement(
      buildClashAttenuationModifiers([
        key("火", "month"),
        key("火", "day"),
        key("土", "month"),
      ]),
    );
    expect(totals).toEqual({ 火: 8, 土: 4 });
  });
});

describe("buildClashAttenuationModifiers · relation/source 개수 무관", () => {
  it("같은 슬롯에 4 source가 충해도 오행별 총 감쇠는 1슬롯분이다", () => {
    const snapshot = buildNatalClashSnapshot(chart("甲子", "丙午", "甲子", "甲子"));
    const kinds: LuckClashKind[] = ["decade", "annual-year", "month", "day"];
    const targets: LuckClashTarget[] = kinds.map((luckKind) => ({
      luckKind,
      branch: "子",
      window: W,
    }));

    const relations = detectLuckClashRelations(snapshot, targets);
    expect(relations).toHaveLength(4); // month 午만 피격 × 4 source

    const modifiers = buildClashAttenuationModifiers(
      collapseClashAttenuationKeys(snapshot, relations),
    );
    const totals = sumClashAttenuationByElement(modifiers);

    // 午 = 土/火 2오행, 슬롯 1개 → 오행당 4
    expect(totals).toEqual({ 火: 4, 土: 4 });
    // relation 4건이어도 modifier는 오행당 1건
    expect(modifiers).toHaveLength(2);
  });

  it("source를 1개로 줄여도 결과가 동일하다", () => {
    const snapshot = buildNatalClashSnapshot(chart("甲子", "丙午", "甲子", "甲子"));
    const many = detectLuckClashRelations(
      snapshot,
      (["decade", "annual-year", "month", "day"] as LuckClashKind[]).map((luckKind) => ({
        luckKind,
        branch: "子" as Branch,
        window: W,
      })),
    );
    const one = detectLuckClashRelations(snapshot, [
      { luckKind: "annual-year", branch: "子", window: W },
    ]);

    const totalsMany = sumClashAttenuationByElement(
      buildClashAttenuationModifiers(collapseClashAttenuationKeys(snapshot, many)),
    );
    const totalsOne = sumClashAttenuationByElement(
      buildClashAttenuationModifiers(collapseClashAttenuationKeys(snapshot, one)),
    );
    expect(totalsMany).toEqual(totalsOne);
  });
});

describe("buildClashAttenuationModifiers · 불변성·필드 범위·결정론", () => {
  const keys: ClashAttenuationKey[] = [key("火", "year"), key("火", "day"), key("土", "year")];

  it("입력 key 배열과 원소를 변경하지 않는다", () => {
    const before = JSON.parse(JSON.stringify(keys));
    buildClashAttenuationModifiers(keys);
    expect(JSON.parse(JSON.stringify(keys))).toEqual(before);
  });

  it("modifier를 변형해도 입력 key가 오염되지 않는다", () => {
    const modifiers = buildClashAttenuationModifiers(keys);
    modifiers[0]!.attenuation = 999;
    expect(keys[0]).toEqual({ element: "火", natalSlot: "year" });
    expect(keys[0]).not.toHaveProperty("attenuation");
  });

  it("modifier에 source/window/pairId/severity/rootElements가 없다", () => {
    const modifiers = buildClashAttenuationModifiers(keys);
    expect(modifiers.length).toBeGreaterThan(0);
    for (const m of modifiers) {
      expect(Object.keys(m).sort()).toEqual(["attenuation", "element", "natalSlot"]);
      for (const forbidden of [
        "source",
        "window",
        "clashPairId",
        "severity",
        "rootElements",
        "natalBranch",
        "delta",
      ]) {
        expect(m).not.toHaveProperty(forbidden);
      }
    }
  });

  it("key 순서를 그대로 보존한다 (collapse가 이미 정렬해 내보낸다)", () => {
    const modifiers = buildClashAttenuationModifiers(keys);
    expect(modifiers.map((m) => `${m.element}:${m.natalSlot}`)).toEqual(
      keys.map((k) => `${k.element}:${k.natalSlot}`),
    );
  });

  it("전체 파이프라인이 결정론적이다 (target 순서 무관)", () => {
    const snapshot = buildNatalClashSnapshot(chart("甲子", "丙午", "戊午", "乙卯"));
    const targets: LuckClashTarget[] = [
      { luckKind: "annual-year", branch: "子", window: W },
      { luckKind: "decade", branch: "酉", window: W },
    ];
    const run = (ts: LuckClashTarget[]) =>
      buildClashAttenuationModifiers(
        collapseClashAttenuationKeys(snapshot, detectLuckClashRelations(snapshot, ts)),
      );

    expect(run(targets)).toEqual(run([...targets].reverse()));
    expect(run(targets).length).toBeGreaterThan(0);
  });
});
