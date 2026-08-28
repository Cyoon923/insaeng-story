/**
 * TBD-01c-wiring · W3 1단계 — Natal clash snapshot builder.
 * 관계 탐지 · collapse · δ modifier는 본 단계 범위 밖이다.
 */
import { describe, expect, it } from "vitest";
import { analyzeStemRoots } from "@/lib/saju/elements/roots";
import { buildNatalClashSnapshot } from "@/lib/saju/luck/clash/buildNatalClashSnapshot";
import type { LuckClashTarget } from "@/lib/saju/luck/clash/types";
import { stemElement } from "@/lib/saju/constants/elements";
import type { Branch, Element, FourPillars, HourPillar, Pillar, Stem } from "@/lib/saju/types";
import { ELEMENTS, STEMS } from "@/lib/saju/types";

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

describe("buildNatalClashSnapshot · 슬롯 구성", () => {
  it("일반 사주는 year/month/day/hour 4슬롯을 만든다", () => {
    const snapshot = buildNatalClashSnapshot(chart("辛酉", "乙未", "丙申", "戊戌"));

    expect(snapshot.slots).toHaveLength(4);
    expect(snapshot.slots.map((s) => s.slot)).toEqual(["year", "month", "day", "hour"]);
    expect(snapshot.slots.map((s) => s.branch)).toEqual(["酉", "未", "申", "戌"]);
  });

  it("hour unknown이면 hour 슬롯이 빠진다 (별도 플래그 없음)", () => {
    const snapshot = buildNatalClashSnapshot(chart("辛酉", "乙未", "丙申", "unknown"));

    expect(snapshot.slots).toHaveLength(3);
    expect(snapshot.slots.map((s) => s.slot)).toEqual(["year", "month", "day"]);
    expect(snapshot.slots.some((s) => s.slot === "hour")).toBe(false);
    // 부재 자체가 표현이다 — hourUnknown 플래그를 두지 않는다.
    expect(snapshot).not.toHaveProperty("hourUnknown");
  });
});

describe("buildNatalClashSnapshot · rootElements 계약", () => {
  it("각 슬롯의 rootElements에 오행 중복이 없다", () => {
    const snapshot = buildNatalClashSnapshot(chart("辛酉", "乙未", "丙申", "戊戌"));

    for (const slot of snapshot.slots) {
      expect(new Set(slot.rootElements).size).toBe(slot.rootElements.length);
    }
  });

  it("지장간과 일치한다 — 酉는 金만, 未는 火木土", () => {
    const snapshot = buildNatalClashSnapshot(chart("辛酉", "乙未", "丙申", "戊戌"));
    const bySlot = new Map(snapshot.slots.map((s) => [s.slot, s]));

    expect(bySlot.get("year")!.rootElements).toEqual(["金"]); // 酉: 辛 정기
    expect(bySlot.get("month")!.rootElements).toEqual(["木", "火", "土"]); // 未: 乙丁己
    expect(bySlot.get("day")!.rootElements).toEqual(["土", "金", "水"]); // 申: 戊壬庚
    expect(bySlot.get("hour")!.rootElements).toEqual(["火", "土", "金"]); // 戌: 辛丁戊
  });

  it("polarity로 RootHit이 2배가 되는 상황에서도 오행당 1개만 남는다", () => {
    // 네 기둥 모두 甲寅 — 木 RootHit은 슬롯당 비견/겁재 2건이 된다.
    const pillars = chart("甲寅", "甲寅", "甲寅", "甲寅");
    const snapshot = buildNatalClashSnapshot(pillars);

    // 엔진의 RootHit 실측: 木은 슬롯당 2건 (총 8건)
    const woodStems = STEMS.filter((s) => stemElement(s) === "木");
    const rawHits = woodStems.flatMap((s) => analyzeStemRoots(pillars, s).hits);
    const dedupedByRootHitKey = new Set(
      rawHits.map((h) => `${h.slot}:${h.branch}:${h.hiddenStem}:${h.role}:${h.polarity}`),
    );
    expect(dedupedByRootHitKey.size).toBe(8); // 4슬롯 × 2 (비견/겁재)

    // snapshot은 슬롯당 木 1개 → 총 4
    const woodSlots = snapshot.slots.filter((s) => s.rootElements.includes("木"));
    expect(woodSlots).toHaveLength(4);
    for (const slot of woodSlots) {
      expect(slot.rootElements.filter((e) => e === "木")).toHaveLength(1);
    }

    // 寅 = 戊(여기)/丙(중기)/甲(정기) → 木火土
    for (const slot of snapshot.slots) {
      expect(slot.rootElements).toEqual(["木", "火", "土"]);
    }
  });

  it("rootElements는 ELEMENTS 순서를 따른다 (결정론적)", () => {
    const snapshot = buildNatalClashSnapshot(chart("甲寅", "甲寅", "甲寅", "甲寅"));

    for (const slot of snapshot.slots) {
      const ordered = ELEMENTS.filter((e: Element) => slot.rootElements.includes(e));
      expect(slot.rootElements).toEqual(ordered);
    }
  });

  it("root가 없는 오행은 포함되지 않는다", () => {
    // 子 = 癸 정기만 → 水
    const snapshot = buildNatalClashSnapshot(chart("甲子", "甲子", "甲子", "甲子"));

    for (const slot of snapshot.slots) {
      expect(slot.rootElements).toEqual(["水"]);
    }
  });
});

describe("buildNatalClashSnapshot · 불변성과 필드 범위", () => {
  it("입력 FourPillars를 변경하지 않는다", () => {
    const pillars = chart("辛酉", "乙未", "丙申", "戊戌");
    const before = JSON.parse(JSON.stringify(pillars));

    buildNatalClashSnapshot(pillars);

    expect(JSON.parse(JSON.stringify(pillars))).toEqual(before);
  });

  it("호출할 때마다 새 배열을 돌려준다 (스냅샷 간 공유 없음)", () => {
    const pillars = chart("辛酉", "乙未", "丙申", "戊戌");
    const a = buildNatalClashSnapshot(pillars);
    const b = buildNatalClashSnapshot(pillars);

    expect(a).toEqual(b);
    expect(a.slots).not.toBe(b.slots);
    a.slots[0]!.rootElements.push("水");
    expect(b.slots[0]!.rootElements).not.toContain("水");
  });

  it("슬롯에 slot/branch/rootElements 외의 필드가 없다", () => {
    const snapshot = buildNatalClashSnapshot(chart("辛酉", "乙未", "丙申", "戊戌"));

    for (const slot of snapshot.slots) {
      expect(Object.keys(slot).sort()).toEqual(["branch", "rootElements", "slot"]);
      // 의도적으로 제외한 것들
      for (const forbidden of [
        "stem",
        "role",
        "hiddenStem",
        "polarity",
        "warnings",
        "hourCertainty",
        "dayBoundaryNote",
        "rootHits",
      ]) {
        expect(slot).not.toHaveProperty(forbidden);
      }
    }
    expect(Object.keys(snapshot)).toEqual(["slots"]);
  });
});

describe("LuckClashTarget · 공통 계약", () => {
  it("annual 전용 필드 없이 luckKind/branch/window만으로 구성된다", () => {
    const target: LuckClashTarget = {
      luckKind: "annual-year",
      branch: "子",
      window: {
        start: new Date("2026-02-04T00:00:00Z"),
        end: new Date("2027-02-04T00:00:00Z"),
      },
    };

    expect(Object.keys(target).sort()).toEqual(["branch", "luckKind", "window"]);
    for (const forbidden of ["year", "boundaryBasis", "stem", "stemElement", "branchMainElement"]) {
      expect(target).not.toHaveProperty(forbidden);
    }
  });

  it("대운/월운/일운도 같은 형태로 표현된다 (kind만 다름)", () => {
    const kinds: Array<LuckClashTarget["luckKind"]> = [
      "decade",
      "annual-year",
      "month",
      "day",
    ];
    const targets: LuckClashTarget[] = kinds.map((luckKind) => ({
      luckKind,
      branch: "午",
      window: { start: new Date(0), end: new Date(1) },
    }));

    expect(targets).toHaveLength(4);
    for (const t of targets) expect(Object.keys(t).sort()).toEqual(["branch", "luckKind", "window"]);
  });
});
