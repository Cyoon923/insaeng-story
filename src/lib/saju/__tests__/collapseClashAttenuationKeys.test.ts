/**
 * TBD-01c-wiring · W3 3단계 — 감쇠 단위 collapse (L1-S).
 * δ 적용 · modifier · Effective 반영 · severity · Opening 효과는 범위 밖이다.
 */
import { describe, expect, it } from "vitest";
import { buildNatalClashSnapshot } from "@/lib/saju/luck/clash/buildNatalClashSnapshot";
import { collapseClashAttenuationKeys } from "@/lib/saju/luck/clash/collapseClashAttenuationKeys";
import { detectLuckClashRelations } from "@/lib/saju/luck/clash/detectLuckClashRelations";
import type {
  ClashRelation,
  ClashSource,
  LuckClashKind,
  LuckClashTarget,
  NatalClashSnapshot,
} from "@/lib/saju/luck/clash/types";
import type { Branch, Element, FourPillars, HourPillar, Pillar, PillarSlot, Stem } from "@/lib/saju/types";
import { ELEMENTS } from "@/lib/saju/types";

const W = {
  start: new Date("2026-02-04T00:00:00Z"),
  end: new Date("2027-02-04T00:00:00Z"),
};

function slot(s: PillarSlot, branch: Branch, rootElements: Element[]) {
  return { slot: s, branch, rootElements };
}

function snap(...slots: Array<ReturnType<typeof slot>>): NatalClashSnapshot {
  return { slots };
}

function relation(
  natalSlot: PillarSlot,
  natalBranch: Branch,
  otherBranch: Branch,
  source: ClashSource = "annual-year",
): ClashRelation {
  return {
    natalSlot,
    natalBranch,
    otherBranch,
    source,
    clashPairId: "clash-zi-wu",
    window: source === "natal" ? null : { start: W.start, end: W.end },
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

describe("collapseClashAttenuationKeys · 기본 확장", () => {
  it("relation 1건 + rootElements 1개 → key 1개", () => {
    const keys = collapseClashAttenuationKeys(snap(slot("day", "子", ["水"])), [
      relation("day", "子", "午"),
    ]);
    expect(keys).toEqual([{ element: "水", natalSlot: "day" }]);
  });

  it("relation 1건 + rootElements 여러 개 → 오행별 key 생성", () => {
    // natal month 午 rootElements=[火,土], annual 子가 clash → key 2개
    const keys = collapseClashAttenuationKeys(snap(slot("month", "午", ["火", "土"])), [
      relation("month", "午", "子"),
    ]);
    expect(keys).toEqual([
      { element: "火", natalSlot: "month" },
      { element: "土", natalSlot: "month" },
    ]);
  });

  it("relation이 없으면 key도 없다", () => {
    expect(collapseClashAttenuationKeys(snap(slot("day", "午", ["火", "土"])), [])).toEqual([]);
  });
});

describe("collapseClashAttenuationKeys · L1-S collapse", () => {
  it("같은 slot에 여러 Luck source relation이 있어도 key는 중복되지 않는다", () => {
    const kinds: LuckClashKind[] = ["decade", "annual-year", "month", "day"];
    const keys = collapseClashAttenuationKeys(
      snap(slot("month", "午", ["火", "土"])),
      kinds.map((k) => relation("month", "午", "子", k)),
    );
    // relation 4건 → key는 여전히 2개
    expect(keys).toEqual([
      { element: "火", natalSlot: "month" },
      { element: "土", natalSlot: "month" },
    ]);
  });

  it("natal source + Luck source가 같은 slot을 충해도 key는 1회", () => {
    const keys = collapseClashAttenuationKeys(snap(slot("day", "午", ["火", "土"])), [
      relation("day", "午", "子", "natal"),
      relation("day", "午", "子", "annual-year"),
    ]);
    expect(keys).toHaveLength(2);
    expect(keys.filter((k) => k.element === "火")).toHaveLength(1);
  });

  it("서로 다른 natal slot 충은 각각 별도 key", () => {
    const keys = collapseClashAttenuationKeys(
      snap(slot("month", "午", ["火", "土"]), slot("day", "午", ["火", "土"])),
      [relation("month", "午", "子"), relation("day", "午", "子")],
    );
    expect(keys).toEqual([
      { element: "火", natalSlot: "month" },
      { element: "火", natalSlot: "day" },
      { element: "土", natalSlot: "month" },
      { element: "土", natalSlot: "day" },
    ]);
  });

  it("4 natal 슬롯 모두 충 → 오행별 key 상한이 4다", () => {
    const slots: PillarSlot[] = ["year", "month", "day", "hour"];
    const kinds: LuckClashKind[] = ["decade", "annual-year", "month", "day"];
    const relations = slots.flatMap((s) => kinds.map((k) => relation(s, "午", "子", k)));
    expect(relations).toHaveLength(16); // relation은 16건

    const keys = collapseClashAttenuationKeys(
      snap(...slots.map((s) => slot(s, "午", ["火", "土"]))),
      relations,
    );

    // 오행별 최대 4 (= natal 슬롯 수)
    for (const element of ["火", "土"] as Element[]) {
      expect(keys.filter((k) => k.element === element)).toHaveLength(4);
    }
    expect(keys).toHaveLength(8); // 2오행 × 4슬롯
  });

  it("hour unknown 스냅샷에서는 hour key가 없다", () => {
    const keys = collapseClashAttenuationKeys(
      snap(slot("year", "午", ["火", "土"]), slot("month", "午", ["火", "土"]), slot("day", "午", ["火", "土"])),
      [relation("year", "午", "子"), relation("month", "午", "子"), relation("day", "午", "子")],
    );
    expect(keys.some((k) => k.natalSlot === "hour")).toBe(false);
    for (const element of ["火", "土"] as Element[]) {
      expect(keys.filter((k) => k.element === element)).toHaveLength(3);
    }
  });

  it("丑未 · 辰戌 relation도 generic key를 정상 생성한다", () => {
    const snapshot = snap(slot("year", "丑", ["水", "金", "土"]), slot("day", "辰", ["木", "水", "土"]));
    const keys = collapseClashAttenuationKeys(snapshot, [
      { ...relation("year", "丑", "未"), clashPairId: "clash-chou-wei" },
      { ...relation("day", "辰", "戌"), clashPairId: "clash-chen-xu" },
    ]);
    expect(keys).toHaveLength(6); // 丑 3오행 + 辰 3오행
    // 개고 관련 흔적 없음 — 효과는 별도 경로
    for (const k of keys) {
      expect(k).not.toHaveProperty("opening");
      expect(k).not.toHaveProperty("clashPairId");
    }
  });
});

describe("collapseClashAttenuationKeys · RootHit polarity 무관", () => {
  it("실제 파이프라인에서 甲寅 4기둥이어도 오행당 슬롯 1키다", () => {
    // 甲寅 4기둥: 木 RootHit은 슬롯당 2건(비견/겁재)이지만 snapshot 기준이라 무관.
    const snapshot = buildNatalClashSnapshot(chart("甲寅", "甲寅", "甲寅", "甲寅"));
    const targets: LuckClashTarget[] = [
      { luckKind: "annual-year", branch: "申", window: W },
      { luckKind: "decade", branch: "申", window: W },
    ];
    const relations = detectLuckClashRelations(snapshot, targets);
    expect(relations).toHaveLength(8); // 4슬롯 × 2 source

    const keys = collapseClashAttenuationKeys(snapshot, relations);
    // 寅 = 木火土 → 3오행 × 4슬롯 = 12
    expect(keys).toHaveLength(12);
    for (const element of ["木", "火", "土"] as Element[]) {
      expect(keys.filter((k) => k.element === element)).toHaveLength(4);
    }
    // 슬롯당 오행 중복 없음
    expect(new Set(keys.map((k) => `${k.element}:${k.natalSlot}`)).size).toBe(keys.length);
  });
});

describe("collapseClashAttenuationKeys · 방어 계약", () => {
  it("snapshot에 없는 slot을 참조하면 throw한다", () => {
    expect(() =>
      collapseClashAttenuationKeys(snap(slot("day", "午", ["火"])), [relation("hour", "午", "子")]),
    ).toThrow(/slot hour not present in snapshot/);
  });

  it("natalBranch가 snapshot branch와 불일치하면 throw한다", () => {
    expect(() =>
      collapseClashAttenuationKeys(snap(slot("day", "午", ["火"])), [relation("day", "子", "午")]),
    ).toThrow(/does not match snapshot day branch 午/);
  });
});

describe("collapseClashAttenuationKeys · 결정론·불변성·필드 범위", () => {
  const snapshot = snap(
    slot("year", "午", ["火", "土"]),
    slot("month", "子", ["水"]),
    slot("day", "午", ["火", "土"]),
  );
  const relations: ClashRelation[] = [
    relation("day", "午", "子", "month"),
    relation("year", "午", "子", "decade"),
    relation("month", "子", "午", "annual-year"),
  ];

  it("relation 순서가 바뀌어도 동일한 결과", () => {
    const a = collapseClashAttenuationKeys(snapshot, relations);
    const b = collapseClashAttenuationKeys(snapshot, [...relations].reverse());
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it("정렬은 오행(ELEMENTS 순) → 슬롯(year→hour)", () => {
    const keys = collapseClashAttenuationKeys(snapshot, relations);
    expect(keys).toEqual([
      { element: "火", natalSlot: "year" },
      { element: "火", natalSlot: "day" },
      { element: "土", natalSlot: "year" },
      { element: "土", natalSlot: "day" },
      { element: "水", natalSlot: "month" },
    ]);
    // ELEMENTS 순서를 실제로 따르는지 확인
    const order = keys.map((k) => ELEMENTS.indexOf(k.element));
    expect(order).toEqual([...order].sort((x, y) => x - y));
  });

  it("입력 snapshot과 relations를 변경하지 않는다", () => {
    const snapBefore = JSON.parse(JSON.stringify(snapshot));
    const relBefore = JSON.parse(JSON.stringify(relations));
    collapseClashAttenuationKeys(snapshot, relations);
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapBefore);
    expect(JSON.parse(JSON.stringify(relations))).toEqual(relBefore);
  });

  it("key에 source/window/pairId/delta/severity 필드가 없다", () => {
    const keys = collapseClashAttenuationKeys(snapshot, relations);
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) {
      expect(Object.keys(k).sort()).toEqual(["element", "natalSlot"]);
      for (const forbidden of [
        "source",
        "window",
        "clashPairId",
        "delta",
        "severity",
        "natalBranch",
        "otherBranch",
      ]) {
        expect(k).not.toHaveProperty(forbidden);
      }
    }
  });
});
