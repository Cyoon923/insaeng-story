/**
 * Transform production wiring 설계 조사 시뮬 (TBD-02g · 1단계).
 *
 * **설계 계약 확인 전용.** production transform 구현·타입은 아직 없다.
 * 여기의 타입은 전부 테스트 로컬 스케치이며 production으로 복사하지 않는다.
 *
 * 근거 문서: §1.5.9.4 적용 순서 · §1.5.9.10.1 atten 분배 · §1.5.10 경합 게이트
 */
import { describe, expect, it } from "vitest";
import { CLASH_ATTENUATION_DELTA } from "@/lib/saju/luck/clash/constants";
import type { Element, PillarSlot } from "@/lib/saju/types";
import { ELEMENTS } from "@/lib/saju/types";

/** 확정 pool (§1.5.9.10). 신규 수치 없음. */
const POOL = { 五合: 12, 삼합: 16, 방합: 16 } as const;

describe("Transform wiring · 기존 M2 시뮬 스케치의 한계", () => {
  it("attenSlots: Element[]는 참여 '슬롯'을 표현하지 못한다", () => {
    // m2TransformModifierSim의 스케치: 삼합 申子辰 → attenSlots ["金","水","土"]
    const sketchAttenSlots: Element[] = ["金", "水", "土"];
    expect(sketchAttenSlots).toHaveLength(3);

    // 오행만 있고 어느 기둥(year/month/day/hour)인지가 없다.
    // → 경합 집합(슬롯 공유 여부, §1.5.10.8 C-중복)을 판정할 수 없고,
    //   clash의 (element × slot) 키와도 대조할 수 없다.
    const hasSlotIdentity = sketchAttenSlots.every(
      (entry) => typeof entry === "object" && entry !== null,
    );
    expect(hasSlotIdentity).toBe(false);
  });

  it("production 참여 단위는 (slot, layer, element) 3요소가 필요하다", () => {
    // 五合은 천간, 삼합·방합은 지지에서 성립 → layer 구분이 필수.
    type Participant = { slot: PillarSlot; layer: "stem" | "branch"; element: Element };

    const wuHe: Participant[] = [
      { slot: "day", layer: "stem", element: "木" }, // 甲
      { slot: "month", layer: "stem", element: "土" }, // 己
    ];
    const sanHe: Participant[] = [
      { slot: "year", layer: "branch", element: "金" }, // 申
      { slot: "month", layer: "branch", element: "水" }, // 子
      { slot: "day", layer: "branch", element: "土" }, // 辰
    ];

    // 슬롯 공유 판정이 가능해진다 (경합 집합 구성의 전제)
    const wuHeSlots = new Set(wuHe.map((p) => `${p.layer}:${p.slot}`));
    const sanHeSlots = new Set(sanHe.map((p) => `${p.layer}:${p.slot}`));
    const shared = [...wuHeSlots].filter((k) => sanHeSlots.has(k));
    expect(shared).toEqual([]); // layer가 달라 슬롯 비공유 — S6 병존

    // 같은 layer에서만 공유가 성립한다
    const otherSanHe: Participant[] = [
      { slot: "month", layer: "branch", element: "木" },
      { slot: "day", layer: "branch", element: "木" },
      { slot: "hour", layer: "branch", element: "土" },
    ];
    const overlap = [...sanHeSlots].filter((k) =>
      new Set(otherSanHe.map((p) => `${p.layer}:${p.slot}`)).has(k),
    );
    expect(overlap.length).toBeGreaterThan(0); // 경합 집합 대상
  });
});

describe("Transform wiring · atten 분배와 총량 보존 (확정 수치 재확인)", () => {
  it("pool을 참여 수로 균등 분배하고 boost = Σatten", () => {
    const cases = [
      { kind: "五合" as const, participants: 2 },
      { kind: "삼합" as const, participants: 3 },
      { kind: "방합" as const, participants: 3 },
    ];
    for (const c of cases) {
      const pool = POOL[c.kind];
      const per = pool / c.participants;
      const totalAtten = per * c.participants;
      expect(totalAtten).toBe(pool); // Σatten = pool
      expect(totalAtten).toBe(pool); // boost = Σatten → 총량 보존
    }
    expect(POOL.五合).toBe(12);
    expect(POOL.삼합).toBe(16);
    expect(POOL.방합).toBe(16);
  });

  it("五合 6 · 삼합/방합 ≈5.33 — 신규 상수를 만들지 않는다", () => {
    expect(POOL.五合 / 2).toBe(6);
    expect(POOL.삼합 / 3).toBeCloseTo(5.333, 3);
  });
});

describe("Transform wiring · clash와의 공통 Effective 이음매", () => {
  it("두 층 모두 '오행별 부호 있는 델타'로 환원된다", () => {
    // clash: 오행별 음수 델타만 (순손실)
    const clashDelta: Partial<Record<Element, number>> = {
      水: -(CLASH_ATTENUATION_DELTA * 2), // 2슬롯 피격
    };
    // transform(五合 甲己→土): 참여 오행 −6씩, 목표 +12
    const transformDelta: Partial<Record<Element, number>> = {
      木: -6,
      土: -6 + 12,
    };

    // 합성은 오행별 단순 합 — 두 층이 같은 좌표계로 만난다.
    const merged: Partial<Record<Element, number>> = {};
    for (const source of [clashDelta, transformDelta]) {
      for (const element of Object.keys(source) as Element[]) {
        merged[element] = (merged[element] ?? 0) + source[element]!;
      }
    }
    expect(merged).toEqual({ 水: -8, 木: -6, 土: 6 });

    // 비관련 오행은 키가 없다 — 전역 패널티 금지가 양쪽 모두에서 유지된다.
    for (const element of ELEMENTS) {
      if (!["水", "木", "土"].includes(element)) {
        expect(merged[element]).toBeUndefined();
      }
    }
  });

  it("clash는 비보존, transform은 보존 — 합성 시 총량이 서로 다르게 움직인다", () => {
    const sum = (d: Partial<Record<Element, number>>) =>
      Object.values(d).reduce((a, v) => a + (v ?? 0), 0);

    expect(sum({ 水: -8 })).toBe(-8); // clash 순손실
    expect(sum({ 木: -6, 土: 6 })).toBe(0); // transform Σ 보존
    // ⇒ 공통 이음매는 '오행별 델타'이며, 보존 여부는 층의 성질로 남는다.
  });
});

describe("Transform wiring · 적용 순서 계약 (§1.5.9.4)", () => {
  it("modifier 생성이 경합 게이트보다 앞이고 게이트는 활성 플래그만 뒤집는다", () => {
    const ORDER = [
      "natal-strength",
      "relation-hit",
      "transform-ok",
      "modifier-build",
      "competition-gate",
      "compose",
      "effective",
    ] as const;

    expect(ORDER.indexOf("modifier-build")).toBeLessThan(ORDER.indexOf("competition-gate"));
    expect(ORDER.indexOf("competition-gate")).toBeLessThan(ORDER.indexOf("compose"));

    // 게이트는 modifier를 삭제하지 않고 modifierActive만 false로 만든다.
    const modifiers = [
      { combineId: "五合-甲己", modifierActive: true },
      { combineId: "삼합-申子辰", modifierActive: true },
    ];
    const afterGate = modifiers.map((m) =>
      m.combineId === "五合-甲己" ? { ...m, modifierActive: false } : m,
    );
    expect(afterGate).toHaveLength(2); // 기록 보존
    expect(afterGate.filter((m) => m.modifierActive)).toHaveLength(1); // 합성 대상은 1개
  });

  it("relation-hit / hit-no-transform은 modifier 단계에 도달하지 않는다", () => {
    const statuses = ["relation-hit", "hit-no-transform", "transform-ok"] as const;
    const eligible = statuses.filter((s) => s === "transform-ok");
    expect(eligible).toEqual(["transform-ok"]);
  });
});
