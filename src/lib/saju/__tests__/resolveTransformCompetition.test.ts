/**
 * TBD-02g L4 — 경합 게이트.
 * clash 합성 · Natal score · Effective · clamp · Level은 범위 밖이다.
 */
import { describe, expect, it } from "vitest";
import { buildTransformRawModifiers } from "@/lib/saju/transform/buildTransformRawModifiers";
import { detectTransformRelations } from "@/lib/saju/transform/detectTransformRelations";
import { evaluateTransformCandidates } from "@/lib/saju/transform/evaluateTransformCandidates";
import { resolveTransformCompetition } from "@/lib/saju/transform/resolveTransformCompetition";
import type {
  TransformCandidate,
  TransformCombineKind,
  TransformParticipant,
} from "@/lib/saju/transform/types";
import type { Branch, Element, FourPillars, HourPillar, Pillar, Stem } from "@/lib/saju/types";

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

function candidateFor(
  combineId: string,
  kind: TransformCombineKind,
  participants: TransformParticipant[],
  targetElement: Element,
  rootState: "satisfied" | "unknown" = "unknown",
): TransformCandidate {
  return {
    relation: { combineId, kind, participants },
    status: "transform-ok",
    targetElement,
    conditions: [{ key: "root", role: "supporting", state: rootState, reason: "fixture" }],
  };
}

function pack(...candidates: TransformCandidate[]) {
  const raw = buildTransformRawModifiers(candidates);
  return { raw, candidates };
}

const branchP = (slot: TransformParticipant["slot"], element: Element): TransformParticipant => ({
  origin: "natal",
  slot,
  layer: "branch",
  element,
});
const stemP = (slot: TransformParticipant["slot"], element: Element): TransformParticipant => ({
  origin: "natal",
  slot,
  layer: "stem",
  element,
});

describe("경합 없음", () => {
  it("modifier 1개 → uncontested / active", () => {
    const { raw, candidates } = pack(
      candidateFor("삼합-申子辰", "삼합", [branchP("year", "金"), branchP("month", "水"), branchP("day", "土")], "水"),
    );
    const [resolved] = resolveTransformCompetition(raw, candidates);
    expect(resolved!.contentionStatus).toBe("uncontested");
    expect(resolved!.modifierActive).toBe(true);
  });

  it("자리를 전혀 공유하지 않으면 둘 다 uncontested / active", () => {
    const { raw, candidates } = pack(
      candidateFor("삼합-申子辰", "삼합", [branchP("year", "金"), branchP("month", "水"), branchP("day", "土")], "水"),
      candidateFor("五合-甲己", "五合", [stemP("hour", "木"), stemP("hour", "土")], "土"),
    );
    // hour stem 두 자리는 서로 같은 modifier 내부이고, 삼합과는 layer가 다르다
    const resolved = resolveTransformCompetition(raw, candidates);
    expect(resolved.map((r) => r.contentionStatus)).toEqual(["uncontested", "uncontested"]);
    expect(resolved.every((r) => r.modifierActive)).toBe(true);
  });

  it("같은 slot이라도 stem vs branch는 경쟁하지 않는다 (S6 병존)", () => {
    const { raw, candidates } = pack(
      candidateFor("삼합-申子辰", "삼합", [branchP("year", "金"), branchP("month", "水"), branchP("day", "土")], "水"),
      candidateFor("五合-甲己", "五合", [stemP("year", "木"), stemP("month", "土")], "土"),
    );
    const resolved = resolveTransformCompetition(raw, candidates);
    expect(resolved.map((r) => r.contentionStatus)).toEqual(["uncontested", "uncontested"]);
  });
});

describe("경합 집합과 승자 판정", () => {
  it("같은 layer+slot을 공유하면 경합 집합이 생긴다", () => {
    // 둘 다 month/branch 공유. 삼합에만 월지 포함 → P2에서 갈림
    const { raw, candidates } = pack(
      candidateFor("삼합-申子辰", "삼합", [branchP("year", "金"), branchP("month", "水"), branchP("day", "土")], "水"),
      candidateFor("방합-亥子丑", "방합", [branchP("hour", "水"), branchP("month", "水"), branchP("day", "土")], "水"),
    );
    const resolved = resolveTransformCompetition(raw, candidates);
    expect(resolved.filter((r) => r.contentionStatus === "uncontested")).toHaveLength(0);
    expect(resolved.some((r) => r.contentionStatus === "won")).toBe(true);
    expect(resolved.some((r) => r.contentionStatus === "lost")).toBe(true);
  });

  it("P2 — 월령 자리를 포함한 쪽이 이긴다", () => {
    const { raw, candidates } = pack(
      candidateFor("삼합-申子辰", "삼합", [branchP("year", "金"), branchP("month", "水"), branchP("day", "土")], "水"),
      candidateFor("삼합-寅午戌", "삼합", [branchP("year", "木"), branchP("day", "火"), branchP("hour", "土")], "火"),
    );
    const resolved = resolveTransformCompetition(raw, candidates);
    expect(resolved[0]!.contentionStatus).toBe("won");
    expect(resolved[0]!.modifierActive).toBe(true);
    expect(resolved[1]!.contentionStatus).toBe("lost");
    expect(resolved[1]!.modifierActive).toBe(false);
  });

  it("P6 — 월령 동률이면 삼합 ≻ 방합", () => {
    // 둘 다 month 포함 · day 공유 → P1/P2 동률 → P4 unknown → P6에서 삼합 승
    const { raw, candidates } = pack(
      candidateFor("방합-亥子丑", "방합", [branchP("month", "水"), branchP("day", "土"), branchP("hour", "水")], "水"),
      candidateFor("삼합-申子辰", "삼합", [branchP("month", "水"), branchP("day", "土"), branchP("year", "金")], "水"),
    );
    const resolved = resolveTransformCompetition(raw, candidates);
    expect(resolved[1]!.kind).toBe("삼합");
    expect(resolved[1]!.contentionStatus).toBe("won");
    expect(resolved[0]!.contentionStatus).toBe("lost");
  });

  it("P4 — C-통근 satisfied가 있으면 그 쪽이 이긴다", () => {
    const withRoot = candidateFor(
      "삼합-申子辰",
      "삼합",
      [branchP("month", "水"), branchP("day", "土"), branchP("year", "金")],
      "水",
      "satisfied",
    );
    const withoutRoot = candidateFor(
      "삼합-寅午戌",
      "삼합",
      [branchP("month", "火"), branchP("day", "土"), branchP("hour", "木")],
      "火",
      "unknown",
    );
    const { raw, candidates } = pack(withoutRoot, withRoot);
    const resolved = resolveTransformCompetition(raw, candidates);
    expect(resolved[1]!.combineId).toBe("삼합-申子辰");
    expect(resolved[1]!.contentionStatus).toBe("won");
    expect(resolved[0]!.contentionStatus).toBe("lost");
  });
});

describe("unresolved", () => {
  it("모든 키가 동률이면 집합 전원 competition-unresolved / inactive", () => {
    // 같은 kind · 둘 다 month 포함 · root unknown → P1~P6 전부 동률
    const { raw, candidates } = pack(
      candidateFor("삼합-申子辰", "삼합", [branchP("month", "水"), branchP("day", "土"), branchP("year", "金")], "水"),
      candidateFor("삼합-寅午戌", "삼합", [branchP("month", "火"), branchP("day", "土"), branchP("hour", "木")], "火"),
    );
    const resolved = resolveTransformCompetition(raw, candidates);
    expect(resolved.map((r) => r.contentionStatus)).toEqual([
      "competition-unresolved",
      "competition-unresolved",
    ]);
    expect(resolved.every((r) => r.modifierActive === false)).toBe(true);
  });

  it("unresolved에서도 모든 modifier row가 보존된다", () => {
    const { raw, candidates } = pack(
      candidateFor("삼합-申子辰", "삼합", [branchP("month", "水"), branchP("day", "土"), branchP("year", "金")], "水"),
      candidateFor("삼합-寅午戌", "삼합", [branchP("month", "火"), branchP("day", "土"), branchP("hour", "木")], "火"),
    );
    const resolved = resolveTransformCompetition(raw, candidates);
    expect(resolved).toHaveLength(raw.length);
    expect(resolved.filter((r) => r.modifierActive)).toHaveLength(0);
  });
});

describe("연결 요소 (connected component)", () => {
  it("A-B 공유, B-C 공유면 A·B·C가 한 집합으로 처리된다", () => {
    // A: year+month, B: month+day, C: day+hour → 연결
    const { raw, candidates } = pack(
      candidateFor("삼합-申子辰", "삼합", [branchP("year", "金"), branchP("month", "水"), branchP("day", "土")], "水"),
      candidateFor("삼합-寅午戌", "삼합", [branchP("month", "木"), branchP("day", "火"), branchP("hour", "土")], "火"),
      candidateFor("방합-亥子丑", "방합", [branchP("day", "水"), branchP("hour", "土"), branchP("year", "金")], "水"),
    );
    const resolved = resolveTransformCompetition(raw, candidates);
    // 한 집합이므로 uncontested가 하나도 없어야 한다
    expect(resolved.filter((r) => r.contentionStatus === "uncontested")).toHaveLength(0);
    // 활성은 최대 1개
    expect(resolved.filter((r) => r.modifierActive).length).toBeLessThanOrEqual(1);
  });

  it("한 modifier가 여러 경쟁자와 공유해도 resolved row가 중복되지 않는다", () => {
    const { raw, candidates } = pack(
      candidateFor("삼합-申子辰", "삼합", [branchP("month", "水"), branchP("day", "土"), branchP("year", "金")], "水"),
      candidateFor("삼합-寅午戌", "삼합", [branchP("month", "木"), branchP("day", "火"), branchP("hour", "土")], "火"),
      candidateFor("방합-亥子丑", "방합", [branchP("month", "水"), branchP("day", "土"), branchP("hour", "水")], "水"),
    );
    const resolved = resolveTransformCompetition(raw, candidates);
    expect(resolved).toHaveLength(3);
    expect(new Set(resolved.map((r) => `${r.combineId}|${r.attenuations.map((a) => a.slot).join()}`)).size).toBe(3);
  });
});

describe("불변성 · 결정론 · 필드 보존", () => {
  const build = () =>
    pack(
      candidateFor("삼합-申子辰", "삼합", [branchP("year", "金"), branchP("month", "水"), branchP("day", "土")], "水"),
      candidateFor("삼합-寅午戌", "삼합", [branchP("year", "木"), branchP("day", "火"), branchP("hour", "土")], "火"),
    );

  it("raw modifier와 candidate를 변경하지 않는다", () => {
    const { raw, candidates } = build();
    const rawBefore = JSON.parse(JSON.stringify(raw));
    const candidatesBefore = JSON.parse(JSON.stringify(candidates));
    resolveTransformCompetition(raw, candidates);
    expect(JSON.parse(JSON.stringify(raw))).toEqual(rawBefore);
    expect(JSON.parse(JSON.stringify(candidates))).toEqual(candidatesBefore);
  });

  it("attenuations/boost/targetElement가 그대로 보존된다", () => {
    const { raw, candidates } = build();
    const resolved = resolveTransformCompetition(raw, candidates);
    for (const [index, row] of resolved.entries()) {
      expect(row.attenuations).toEqual(raw[index]!.attenuations);
      expect(row.boost).toBe(raw[index]!.boost);
      expect(row.targetElement).toBe(raw[index]!.targetElement);
      expect(row.combineId).toBe(raw[index]!.combineId);
      expect(row.kind).toBe(raw[index]!.kind);
    }
  });

  it("resolved는 raw + 게이트 출력 2개만 갖는다", () => {
    const { raw, candidates } = build();
    for (const row of resolveTransformCompetition(raw, candidates)) {
      expect(Object.keys(row).sort()).toEqual([
        "attenuations",
        "boost",
        "combineId",
        "contentionStatus",
        "kind",
        "modifierActive",
        "targetElement",
      ]);
      for (const forbidden of ["pending", "tied", "disabled", "score", "competitionGroupId"]) {
        expect(row).not.toHaveProperty(forbidden);
      }
    }
  });

  it("입력 순서가 달라도 논리 결과가 같다 (반환은 입력 순서 보존)", () => {
    const a = build();
    const forward = resolveTransformCompetition(a.raw, a.candidates);
    const backward = resolveTransformCompetition([...a.raw].reverse(), a.candidates);
    const norm = (rows: typeof forward) =>
      [...rows]
        .map((r) => `${r.combineId}:${r.contentionStatus}:${r.modifierActive}`)
        .sort();
    expect(norm(forward)).toEqual(norm(backward));
    expect(forward.map((r) => r.combineId)).toEqual(a.raw.map((r) => r.combineId));
  });

  it("결정론적이며 빈 입력은 빈 출력", () => {
    const { raw, candidates } = build();
    expect(resolveTransformCompetition(raw, candidates)).toEqual(
      resolveTransformCompetition(raw, candidates),
    );
    expect(resolveTransformCompetition([], [])).toEqual([]);
  });
});

describe("통합 — L1 → L2 → L3 → L4", () => {
  it("실제 production 경로에서 uncontested modifier가 활성화된다", () => {
    const pillars = chart("甲申", "丙子", "戊辰", "壬亥");
    const candidates = evaluateTransformCandidates(pillars, detectTransformRelations(pillars));
    const raw = buildTransformRawModifiers(candidates);
    const resolved = resolveTransformCompetition(raw, candidates);

    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.combineId).toBe("삼합-申子辰");
    expect(resolved[0]!.contentionStatus).toBe("uncontested");
    expect(resolved[0]!.modifierActive).toBe(true);
    expect(resolved[0]!.boost).toBe(
      resolved[0]!.attenuations.reduce((t, a) => t + a.attenuation, 0),
    );
  });
});
