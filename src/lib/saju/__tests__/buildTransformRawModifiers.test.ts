/**
 * TBD-02g L3 — transform-ok 후보 → raw modifier.
 * 경합 승자 · modifierActive · contentionStatus · Effective 합성은 범위 밖이다.
 */
import { describe, expect, it } from "vitest";
import { buildTransformRawModifiers } from "@/lib/saju/transform/buildTransformRawModifiers";
import { TRANSFORM_POOL_BY_KIND, transformPoolOf } from "@/lib/saju/transform/constants";
import { detectTransformRelations } from "@/lib/saju/transform/detectTransformRelations";
import { evaluateTransformCandidates } from "@/lib/saju/transform/evaluateTransformCandidates";
import type {
  TransformCandidate,
  TransformCandidateStatus,
  TransformCombineKind,
  TransformParticipant,
  TransformRelation,
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

/** L2 evaluator를 우회한 단위 계약용 fixture (특히 五合은 현재 transform-ok 도달 불가). */
function candidate(
  combineId: string,
  kind: TransformCombineKind,
  participants: TransformParticipant[],
  targetElement: Element,
  status: TransformCandidateStatus = "transform-ok",
): TransformCandidate {
  const relation: TransformRelation = { combineId, kind, participants };
  return { relation, status, targetElement, conditions: [] };
}

const WU_HE = candidate(
  "五合-甲己",
  "五合",
  [
    { origin: "natal", slot: "year", layer: "stem", element: "木" },
    { origin: "natal", slot: "month", layer: "stem", element: "土" },
  ],
  "土",
);

const SAN_HE = candidate(
  "삼합-申子辰",
  "삼합",
  [
    { origin: "natal", slot: "year", layer: "branch", element: "金" },
    { origin: "natal", slot: "month", layer: "branch", element: "水" },
    { origin: "natal", slot: "day", layer: "branch", element: "土" },
  ],
  "水",
);

const FANG_HE = candidate(
  "방합-寅卯辰",
  "방합",
  [
    { origin: "natal", slot: "year", layer: "branch", element: "木" },
    { origin: "natal", slot: "month", layer: "branch", element: "木" },
    { origin: "natal", slot: "day", layer: "branch", element: "土" },
  ],
  "木",
);

describe("pool 상수", () => {
  it("production 수치는 五合 12 · 삼합 16 · 방합 16 뿐이다", () => {
    expect(TRANSFORM_POOL_BY_KIND).toEqual({ 五合: 12, 삼합: 16, 방합: 16 });
    expect(Object.keys(TRANSFORM_POOL_BY_KIND)).toHaveLength(3);
  });

  it("기각된 후보 수치(8/12/20)는 존재하지 않는다", () => {
    const values = Object.values(TRANSFORM_POOL_BY_KIND);
    for (const rejected of [8, 20]) expect(values).not.toContain(rejected);
  });

  it("kind→pool 매핑은 단일 소스다", () => {
    for (const kind of ["五合", "삼합", "방합"] as TransformCombineKind[]) {
      expect(transformPoolOf(kind)).toBe(TRANSFORM_POOL_BY_KIND[kind]);
    }
  });
});

describe("modifier 생성 규칙", () => {
  it("五合: pool 12, participant 2개 각 6, boost 12", () => {
    const [modifier] = buildTransformRawModifiers([WU_HE]);
    expect(modifier!.attenuations.map((a) => a.attenuation)).toEqual([6, 6]);
    expect(modifier!.boost).toBe(12);
    expect(modifier!.targetElement).toBe("土");
    expect(modifier!.kind).toBe("五合");
  });

  it("삼합: pool 16, participant 3개 각 16/3, boost = 합", () => {
    const [modifier] = buildTransformRawModifiers([SAN_HE]);
    const per = 16 / 3;
    expect(modifier!.attenuations.map((a) => a.attenuation)).toEqual([per, per, per]);
    for (const row of modifier!.attenuations) expect(row.attenuation).toBeCloseTo(5.3333, 4);
    // boost는 실제 합에서 유도 — 반올림하지 않는다
    expect(modifier!.boost).toBe(per + per + per);
    expect(modifier!.boost).toBeCloseTo(16, 10);
  });

  it("방합: 삼합과 동일 pool 16", () => {
    const [modifier] = buildTransformRawModifiers([FANG_HE]);
    const per = 16 / 3;
    expect(modifier!.attenuations.map((a) => a.attenuation)).toEqual([per, per, per]);
    expect(modifier!.boost).toBe(per + per + per);
  });

  it("총량 보존: Σ attenuation === boost (부동소수점 정확 일치)", () => {
    for (const c of [WU_HE, SAN_HE, FANG_HE]) {
      const [modifier] = buildTransformRawModifiers([c]);
      const sum = modifier!.attenuations.reduce((t, a) => t + a.attenuation, 0);
      expect(modifier!.boost).toBe(sum);
    }
  });

  it("동일 오행 participant를 합치지 않는다 (寅卯辰 木 2행 유지)", () => {
    const [modifier] = buildTransformRawModifiers([FANG_HE]);
    const woodRows = modifier!.attenuations.filter((a) => a.element === "木");
    expect(woodRows).toHaveLength(2);
    expect(woodRows.map((a) => a.slot)).toEqual(["year", "month"]);
  });

  it("participant identity(slot/layer/element)를 보존한다", () => {
    const [modifier] = buildTransformRawModifiers([SAN_HE]);
    expect(
      modifier!.attenuations.map(({ origin, slot, layer, element }) => ({
        origin,
        slot,
        layer,
        element,
      })),
    ).toEqual(SAN_HE.relation.participants);
  });

  it("targetElement는 candidate 값을 그대로 전달한다", () => {
    // 표를 다시 조회하지 않음을 보이기 위해 표와 다른 값을 넣어도 그대로 나온다
    const odd = candidate("삼합-申子辰", "삼합", SAN_HE.relation.participants, "火");
    const [modifier] = buildTransformRawModifiers([odd]);
    expect(modifier!.targetElement).toBe("火");
  });
});

describe("생성 대상 필터", () => {
  it("hit-no-transform은 modifier를 만들지 않는다", () => {
    const blocked = candidate("삼합-申子辰", "삼합", SAN_HE.relation.participants, "水", "hit-no-transform");
    expect(buildTransformRawModifiers([blocked])).toEqual([]);
  });

  it("mixed 입력에서 transform-ok만 생성된다", () => {
    const blocked = candidate("방합-寅卯辰", "방합", FANG_HE.relation.participants, "木", "hit-no-transform");
    const modifiers = buildTransformRawModifiers([blocked, SAN_HE, WU_HE]);
    expect(modifiers.map((m) => m.combineId)).toEqual(["삼합-申子辰", "五合-甲己"]);
  });

  it("빈 입력 → 빈 출력", () => {
    expect(buildTransformRawModifiers([])).toEqual([]);
  });
});

describe("raw 계층 경계 · 불변성 · 결정론", () => {
  it("raw modifier에 경합 관련 필드가 없다 (게이트 출력은 L4)", () => {
    const modifiers = buildTransformRawModifiers([SAN_HE, WU_HE]);
    expect(modifiers.length).toBeGreaterThan(0);
    for (const modifier of modifiers) {
      expect(Object.keys(modifier).sort()).toEqual([
        "attenuations",
        "boost",
        "combineId",
        "kind",
        "targetElement",
      ]);
      for (const forbidden of ["modifierActive", "contentionStatus", "won", "status"]) {
        expect(modifier).not.toHaveProperty(forbidden);
      }
      for (const row of modifier.attenuations) {
        expect(Object.keys(row).sort()).toEqual(["attenuation", "element", "layer", "origin", "slot"]);
      }
    }
  });

  it("입력 candidate와 relation을 변경하지 않는다", () => {
    const input = [SAN_HE, FANG_HE];
    const before = JSON.parse(JSON.stringify(input));
    buildTransformRawModifiers(input);
    expect(JSON.parse(JSON.stringify(input))).toEqual(before);
  });

  it("결정론적이며 입력 순서를 보존한다", () => {
    const input = [SAN_HE, FANG_HE, WU_HE];
    const a = buildTransformRawModifiers(input);
    expect(a).toEqual(buildTransformRawModifiers(input));
    expect(a.map((m) => m.combineId)).toEqual(["삼합-申子辰", "방합-寅卯辰", "五合-甲己"]);
  });
});

describe("통합 — L1 → L2 → L3", () => {
  it("실제 production 경로로 삼합 modifier가 생성된다", () => {
    // 申子辰 → 水. month 子 참여 · 壬 투출 · 참여 지지 충 없음
    const pillars = chart("甲申", "丙子", "戊辰", "壬亥");

    const relations = detectTransformRelations(pillars);
    const candidates = evaluateTransformCandidates(pillars, relations);
    const modifiers = buildTransformRawModifiers(candidates);

    const ok = candidates.filter((c) => c.status === "transform-ok");
    expect(ok).toHaveLength(1);
    expect(modifiers).toHaveLength(1);

    const modifier = modifiers[0]!;
    expect(modifier.combineId).toBe("삼합-申子辰");
    expect(modifier.kind).toBe("삼합");
    expect(modifier.targetElement).toBe("水");
    expect(modifier.attenuations).toHaveLength(3);
    expect(modifier.attenuations.map((a) => a.element)).toEqual(["金", "水", "土"]);
    expect(modifier.attenuations.map((a) => a.slot)).toEqual(["year", "month", "day"]);
    expect(modifier.boost).toBe(modifier.attenuations.reduce((t, a) => t + a.attenuation, 0));

    // Natal은 변하지 않는다
    const after = detectTransformRelations(pillars);
    expect(after).toEqual(relations);
  });

  it("transform-ok가 없는 원국은 modifier 0", () => {
    // 五合만 있는 원국 — 현재 L2에서 transform-ok 도달 불가
    const pillars = chart("甲子", "己丑", "戊寅", "庚辰");
    const candidates = evaluateTransformCandidates(pillars, detectTransformRelations(pillars));
    expect(candidates.every((c) => c.status === "hit-no-transform")).toBe(true);
    expect(buildTransformRawModifiers(candidates)).toEqual([]);
  });
});
