/**
 * TBD-01c-wiring · W3 2단계 — Luck↔Natal 육충 relation 탐지.
 * collapse · δ · modifier · severity · Opening 효과는 본 단계 범위 밖이다.
 */
import { describe, expect, it } from "vitest";
import {
  BRANCH_CLASH_PAIRS,
  clashPartnerOf,
  resolveBranchClashPairId,
} from "@/lib/saju/luck/clash/branchClashPairs";
import { detectLuckClashRelations } from "@/lib/saju/luck/clash/detectLuckClashRelations";
import type {
  LuckClashKind,
  LuckClashTarget,
  NatalClashSnapshot,
} from "@/lib/saju/luck/clash/types";
import type { Branch, Element, PillarSlot } from "@/lib/saju/types";
import { BRANCHES } from "@/lib/saju/types";

const W = {
  start: new Date("2026-02-04T00:00:00Z"),
  end: new Date("2027-02-04T00:00:00Z"),
};

function target(
  branch: Branch,
  luckKind: LuckClashKind = "annual-year",
  window = W,
): LuckClashTarget {
  return { luckKind, branch, window };
}

function slot(s: PillarSlot, branch: Branch, rootElements: Element[] = []) {
  return { slot: s, branch, rootElements };
}

function snap(...slots: Array<ReturnType<typeof slot>>): NatalClashSnapshot {
  return { slots };
}

describe("branchClashPairs · 6쌍 표", () => {
  it("6쌍이 12지지를 정확히 분할한다 (완전 매칭)", () => {
    expect(BRANCH_CLASH_PAIRS).toHaveLength(6);
    const all = BRANCH_CLASH_PAIRS.flatMap((p) => [...p.pair]);
    expect(all).toHaveLength(12);
    expect(new Set(all).size).toBe(12);
    for (const b of BRANCHES) expect(all).toContain(b);
  });

  it("모든 지지의 충 상대는 유일하고 상호적이다", () => {
    for (const b of BRANCHES) {
      const partner = clashPartnerOf(b);
      expect(clashPartnerOf(partner)).toBe(b);
      expect(partner).not.toBe(b);
    }
  });

  it("역방향 순서에서도 같은 pairId를 낸다", () => {
    for (const { id, pair } of BRANCH_CLASH_PAIRS) {
      expect(resolveBranchClashPairId(pair[0], pair[1])).toBe(id);
      expect(resolveBranchClashPairId(pair[1], pair[0])).toBe(id);
    }
  });

  it("비충 관계는 null", () => {
    expect(resolveBranchClashPairId("子", "丑")).toBeNull();
    expect(resolveBranchClashPairId("子", "子")).toBeNull();
    expect(resolveBranchClashPairId("寅", "午")).toBeNull();
  });
});

describe("detectLuckClashRelations · 기본 탐지", () => {
  it("6개 육충 pair를 전부 탐지한다", () => {
    for (const { id, pair } of BRANCH_CLASH_PAIRS) {
      const relations = detectLuckClashRelations(snap(slot("day", pair[0])), [target(pair[1])]);
      expect(relations).toHaveLength(1);
      expect(relations[0]!.clashPairId).toBe(id);
      expect(relations[0]!.natalBranch).toBe(pair[0]);
      expect(relations[0]!.otherBranch).toBe(pair[1]);
    }
  });

  it("역방향(natal이 쌍의 뒤쪽)에서도 같은 pairId", () => {
    for (const { id, pair } of BRANCH_CLASH_PAIRS) {
      const relations = detectLuckClashRelations(snap(slot("day", pair[1])), [target(pair[0])]);
      expect(relations).toHaveLength(1);
      expect(relations[0]!.clashPairId).toBe(id);
    }
  });

  it("비충 관계는 relation을 만들지 않는다", () => {
    expect(detectLuckClashRelations(snap(slot("day", "子")), [target("丑")])).toEqual([]);
    expect(detectLuckClashRelations(snap(slot("day", "子")), [target("子")])).toEqual([]);
    expect(detectLuckClashRelations(snap(slot("day", "寅")), [])).toEqual([]);
  });

  it("window를 target 값 그대로 보존한다", () => {
    const w = { start: new Date("2030-02-04T00:00:00Z"), end: new Date("2031-02-04T00:00:00Z") };
    const relations = detectLuckClashRelations(snap(slot("day", "午")), [
      target("子", "annual-year", w),
    ]);
    expect(relations[0]!.window).toEqual(w);
    expect(relations[0]!.window!.start.getTime()).toBe(w.start.getTime());
    expect(relations[0]!.window!.end.getTime()).toBe(w.end.getTime());
  });
});

describe("detectLuckClashRelations · multiplicity 보존", () => {
  it("하나의 Luck 지지가 여러 natal 슬롯을 동시에 충한다", () => {
    const snapshot = snap(
      slot("year", "子"),
      slot("month", "午"),
      slot("day", "午"),
      slot("hour", "卯"),
    );
    const relations = detectLuckClashRelations(snapshot, [target("子")]);

    // 세운 子 → natal 午(month·day) 2건. natal 子(year)는 상대가 午이므로 무관.
    expect(relations).toHaveLength(2);
    expect(relations.map((r) => r.natalSlot)).toEqual(["month", "day"]);
    expect(relations.every((r) => r.clashPairId === "clash-zi-wu")).toBe(true);
  });

  it("동일 natal 슬롯에 여러 source가 충하면 relation을 전부 보존한다", () => {
    const kinds: LuckClashKind[] = ["decade", "annual-year", "month", "day"];
    const relations = detectLuckClashRelations(
      snap(slot("day", "午")),
      kinds.map((k) => target("子", k)),
    );

    // 붕괴하지 않는다 — 수치 collapse는 다음 단계의 몫.
    expect(relations).toHaveLength(4);
    expect(relations.map((r) => r.source)).toEqual(["decade", "annual-year", "month", "day"]);
    expect(new Set(relations.map((r) => r.natalSlot))).toEqual(new Set(["day"]));
  });

  it("4슬롯 × 4source 최대 구성에서 relation 16건", () => {
    const snapshot = snap(
      slot("year", "午"),
      slot("month", "午"),
      slot("day", "午"),
      slot("hour", "午"),
    );
    const kinds: LuckClashKind[] = ["decade", "annual-year", "month", "day"];
    const relations = detectLuckClashRelations(
      snapshot,
      kinds.map((k) => target("子", k)),
    );
    expect(relations).toHaveLength(16);
  });

  it("hour unknown 스냅샷에서는 hour relation이 생기지 않는다", () => {
    // buildNatalClashSnapshot이 hour를 제외한 형태
    const snapshot = snap(slot("year", "子"), slot("month", "卯"), slot("day", "午"));
    const relations = detectLuckClashRelations(snapshot, [target("子"), target("酉", "month")]);

    expect(relations.some((r) => r.natalSlot === "hour")).toBe(false);
    expect(relations.map((r) => r.natalSlot).sort()).toEqual(["day", "month"]);
  });
});

describe("detectLuckClashRelations · Opening 쌍도 generic으로 탐지", () => {
  it("丑未 · 辰戌이 일반 relation으로 나오고 효과는 계산하지 않는다", () => {
    const snapshot = snap(slot("year", "丑"), slot("day", "辰"));
    const relations = detectLuckClashRelations(snapshot, [
      target("未"),
      target("戌", "decade"),
    ]);

    expect(relations).toHaveLength(2);
    expect(relations.map((r) => r.clashPairId).sort()).toEqual([
      "clash-chen-xu",
      "clash-chou-wei",
    ]);
    // 개고 관련 필드는 어디에도 없다 — pairId만으로 나중에 분기한다.
    for (const r of relations) {
      expect(r).not.toHaveProperty("opening");
      expect(r).not.toHaveProperty("opened");
      expect(r).not.toHaveProperty("openingCandidate");
    }
  });
});

describe("detectLuckClashRelations · 결정론·불변성·필드 범위", () => {
  const snapshot = snap(
    slot("year", "午"),
    slot("month", "卯"),
    slot("day", "午"),
    slot("hour", "丑"),
  );
  const targets: LuckClashTarget[] = [
    target("酉", "month"),
    target("子", "decade"),
    target("未", "day"),
    target("子", "annual-year"),
  ];

  it("targets 순서가 바뀌어도 동일한 결과를 낸다", () => {
    const a = detectLuckClashRelations(snapshot, targets);
    const b = detectLuckClashRelations(snapshot, [...targets].reverse());
    const c = detectLuckClashRelations(snapshot, [targets[2]!, targets[0]!, targets[3]!, targets[1]!]);

    expect(a).toEqual(b);
    expect(a).toEqual(c);
    expect(a.length).toBeGreaterThan(0);
  });

  it("정렬은 슬롯 → 운 종류 순이다", () => {
    const relations = detectLuckClashRelations(snapshot, targets);
    const keys = relations.map((r) => `${r.natalSlot}:${r.source}`);
    expect(keys).toEqual([
      "year:decade",
      "year:annual-year",
      "month:month",
      "day:decade",
      "day:annual-year",
      "hour:day",
    ]);
  });

  it("입력 snapshot과 targets를 변경하지 않는다", () => {
    const snapBefore = JSON.parse(JSON.stringify(snapshot));
    const targetsBefore = JSON.parse(JSON.stringify(targets));

    detectLuckClashRelations(snapshot, targets);

    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapBefore);
    expect(JSON.parse(JSON.stringify(targets))).toEqual(targetsBefore);
  });

  it("relation window를 변형해도 target window가 오염되지 않는다", () => {
    const t = target("子");
    const relations = detectLuckClashRelations(snap(slot("day", "午")), [t]);
    relations[0]!.window!.start = new Date("1999-01-01T00:00:00Z");
    expect(t.window.start.getTime()).toBe(W.start.getTime());
  });

  it("relation에 element / delta / severity 필드가 없다", () => {
    const relations = detectLuckClashRelations(snapshot, targets);
    expect(relations.length).toBeGreaterThan(0);

    for (const r of relations) {
      expect(Object.keys(r).sort()).toEqual([
        "clashPairId",
        "natalBranch",
        "natalSlot",
        "otherBranch",
        "source",
        "window",
      ]);
      for (const forbidden of [
        "element",
        "rootElements",
        "delta",
        "severity",
        "attenuation",
        "weight",
      ]) {
        expect(r).not.toHaveProperty(forbidden);
      }
    }
  });

  it("source는 decade/annual-year/month/day를 모두 표현한다", () => {
    const kinds: LuckClashKind[] = ["decade", "annual-year", "month", "day"];
    const relations = detectLuckClashRelations(
      snap(slot("day", "午")),
      kinds.map((k) => target("子", k)),
    );
    expect(new Set(relations.map((r) => r.source))).toEqual(new Set(kinds));
  });
});
