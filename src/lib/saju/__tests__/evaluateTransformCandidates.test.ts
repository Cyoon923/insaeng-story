/**
 * TBD-02g L2 — C-* 조건 평가 및 transform-ok / hit-no-transform 판정.
 * pool · modifier · 경합 승자 · Effective 합성은 범위 밖이다.
 */
import { describe, expect, it } from "vitest";
import {
  BRANCH_FANG_HE_COMBINATIONS,
  BRANCH_SAN_HE_COMBINATIONS,
  STEM_HE_COMBINATIONS,
} from "@/lib/saju/transform/combinationTables";
import { TRANSFORM_CONDITION_ORDER } from "@/lib/saju/transform/conditionRoles";
import { detectTransformRelations } from "@/lib/saju/transform/detectTransformRelations";
import { evaluateTransformCandidates } from "@/lib/saju/transform/evaluateTransformCandidates";
import { transformTargetOf } from "@/lib/saju/transform/transformTargetTables";
import type { TransformCandidate, TransformRelation } from "@/lib/saju/transform/types";
import type { Branch, FourPillars, HourPillar, Pillar, Stem } from "@/lib/saju/types";

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

function run(pillars: FourPillars): TransformCandidate[] {
  return evaluateTransformCandidates(pillars, detectTransformRelations(pillars));
}

const conditionOf = (candidate: TransformCandidate, key: string) =>
  candidate.conditions.find((c) => c.key === key)!;

/** 申子辰 → 水. month 子 참여 · 壬 투출 · 참여 지지 충 없음 → transform-ok */
const SAN_HE_OK = chart("甲申", "丙子", "戊辰", "壬亥");
/** 寅卯辰 → 木. month 卯 참여 · 乙 투출 · 충 없음 → transform-ok */
const FANG_HE_OK = chart("甲寅", "丙卯", "戊辰", "乙亥");

describe("targetElement 표", () => {
  it("五合 5종 목표가 정확하다", () => {
    const expected = { "五合-甲己": "土", "五合-乙庚": "金", "五合-丙辛": "水", "五合-丁壬": "木", "五合-戊癸": "火" };
    for (const combination of STEM_HE_COMBINATIONS) {
      expect(transformTargetOf(combination.id)).toBe(expected[combination.id as keyof typeof expected]);
    }
  });

  it("삼합 4종 목표가 정확하다", () => {
    const expected = { "삼합-申子辰": "水", "삼합-亥卯未": "木", "삼합-寅午戌": "火", "삼합-巳酉丑": "金" };
    for (const combination of BRANCH_SAN_HE_COMBINATIONS) {
      expect(transformTargetOf(combination.id)).toBe(expected[combination.id as keyof typeof expected]);
    }
  });

  it("방합 4종 목표가 정확하다", () => {
    const expected = { "방합-寅卯辰": "木", "방합-巳午未": "火", "방합-申酉戌": "金", "방합-亥子丑": "水" };
    for (const combination of BRANCH_FANG_HE_COMBINATIONS) {
      expect(transformTargetOf(combination.id)).toBe(expected[combination.id as keyof typeof expected]);
    }
  });

  it("targetElement는 L2에서 부여되고 L1 relation에는 없다", () => {
    const relations = detectTransformRelations(SAN_HE_OK);
    for (const relation of relations) expect(relation).not.toHaveProperty("targetElement");

    const candidates = evaluateTransformCandidates(SAN_HE_OK, relations);
    expect(candidates[0]!.targetElement).toBe("水");
  });
});

describe("판정 계약 (§1.5.4.1)", () => {
  it("required fail → hit-no-transform (투간 없음)", () => {
    // 申子辰이지만 천간에 水(壬/癸)가 없다
    const candidate = run(chart("甲申", "丙子", "戊辰", "乙亥")).find(
      (c) => c.relation.combineId === "삼합-申子辰",
    )!;
    expect(conditionOf(candidate, "stemExposure").state).toBe("failed");
    expect(candidate.status).toBe("hit-no-transform");
  });

  it("required fail → hit-no-transform (월령 실패)", () => {
    // 申子辰인데 month가 구성원이 아니고 水가 得時도 아닌 달(午월 = 水 사)
    const candidate = run(chart("甲申", "丙午", "戊辰", "壬子")).find(
      (c) => c.relation.combineId === "삼합-申子辰",
    );
    if (candidate) {
      expect(conditionOf(candidate, "monthCommand").state).toBe("failed");
      expect(candidate.status).toBe("hit-no-transform");
    }
  });

  it("blocking satisfied → hit-no-transform (참여 지지 충)", () => {
    // 申子辰 + hour 午 → 子午충으로 참여 지지가 깨진다
    const candidate = run(chart("甲申", "丙子", "戊辰", "壬午")).find(
      (c) => c.relation.combineId === "삼합-申子辰",
    )!;
    expect(conditionOf(candidate, "obstruction").state).toBe("satisfied");
    expect(candidate.status).toBe("hit-no-transform");
  });

  it("blocking unknown → hit-no-transform (五合의 천간충 범위 밖)", () => {
    const candidate = run(chart("甲子", "己丑", "戊寅", "庚辰")).find(
      (c) => c.relation.combineId === "五合-甲己",
    )!;
    expect(conditionOf(candidate, "obstruction").state).toBe("unknown");
    expect(candidate.status).toBe("hit-no-transform");
  });

  it("required unknown → hit-no-transform (五合 C-통근)", () => {
    const candidate = run(chart("甲子", "己丑", "戊寅", "庚辰")).find(
      (c) => c.relation.combineId === "五合-甲己",
    )!;
    expect(conditionOf(candidate, "root").role).toBe("required");
    expect(conditionOf(candidate, "root").state).toBe("unknown");
    expect(candidate.status).toBe("hit-no-transform");
  });

  it("supporting unknown은 단독으로 transform을 막지 않는다", () => {
    const candidate = run(SAN_HE_OK).find((c) => c.relation.combineId === "삼합-申子辰")!;
    // 세력·통근·경쟁이 전부 unknown인데도 transform-ok
    for (const key of ["force", "root", "competition"]) {
      expect(conditionOf(candidate, key).role).toBe("supporting");
      expect(conditionOf(candidate, key).state).toBe("unknown");
    }
    expect(candidate.status).toBe("transform-ok");
  });

  it("not-applicable 조건은 판정에 영향이 없다 (삼합·방합의 C-거리)", () => {
    const candidate = run(SAN_HE_OK).find((c) => c.relation.combineId === "삼합-申子辰")!;
    expect(conditionOf(candidate, "distance").role).toBe("not-applicable");
    expect(conditionOf(candidate, "distance").state).toBe("not-applicable");
    expect(candidate.status).toBe("transform-ok");
  });

  it("C-중복은 게이트로만 남고 임의 boolean이 되지 않는다", () => {
    for (const candidate of run(SAN_HE_OK)) {
      const duplicate = conditionOf(candidate, "duplicate");
      expect(duplicate.role).toBe("gate");
      expect(duplicate.state).toBe("not-applicable");
      expect(duplicate.reason).toContain("게이트");
      // 게이트는 satisfied/failed로 판정되지 않는다
      expect(["satisfied", "failed"]).not.toContain(duplicate.state);
    }
    // gate가 transform-ok를 막지 않았다
    expect(run(SAN_HE_OK).some((c) => c.status === "transform-ok")).toBe(true);
  });
});

describe("transform-ok 실제 도달 가능성", () => {
  it("삼합은 현재 확정 규칙만으로 transform-ok 도달 가능하다", () => {
    const candidate = run(SAN_HE_OK).find((c) => c.relation.combineId === "삼합-申子辰")!;
    expect(candidate.status).toBe("transform-ok");
    expect(candidate.targetElement).toBe("水");
    expect(conditionOf(candidate, "monthCommand").state).toBe("satisfied");
    expect(conditionOf(candidate, "stemExposure").state).toBe("satisfied");
    expect(conditionOf(candidate, "obstruction").state).toBe("failed");
  });

  it("방합도 transform-ok 도달 가능하다", () => {
    const candidate = run(FANG_HE_OK).find((c) => c.relation.combineId === "방합-寅卯辰")!;
    expect(candidate.status).toBe("transform-ok");
    expect(candidate.targetElement).toBe("木");
  });

  it("五合은 현재 확정 규칙으로는 transform-ok가 닫혀 있다", () => {
    // C-통근(required)과 C-방해(blocking)가 모두 unknown → 어떤 원국에서도 승격 불가
    const charts = [
      chart("甲子", "己丑", "戊寅", "庚辰"),
      chart("乙酉", "庚戌", "丙子", "戊寅"),
      chart("丁卯", "壬辰", "甲午", "丙申"),
    ];
    for (const pillars of charts) {
      for (const candidate of run(pillars).filter((c) => c.relation.kind === "五合")) {
        expect(candidate.status).toBe("hit-no-transform");
        expect(conditionOf(candidate, "root").state).toBe("unknown");
        expect(conditionOf(candidate, "obstruction").state).toBe("unknown");
      }
    }
  });
});

describe("evidence 보존·불변성·결정론", () => {
  it("조건 evidence가 8개 전부 고정 순서로 보존된다", () => {
    for (const candidate of run(SAN_HE_OK)) {
      expect(candidate.conditions).toHaveLength(TRANSFORM_CONDITION_ORDER.length);
      expect(candidate.conditions.map((c) => c.key)).toEqual([...TRANSFORM_CONDITION_ORDER]);
      for (const condition of candidate.conditions) {
        expect(Object.keys(condition).sort()).toEqual(["key", "reason", "role", "state"]);
        expect(condition.reason.length).toBeGreaterThan(0);
      }
    }
  });

  it("candidate에 modifier/pool 관련 필드가 없다", () => {
    for (const candidate of run(SAN_HE_OK)) {
      expect(Object.keys(candidate).sort()).toEqual([
        "conditions",
        "relation",
        "status",
        "targetElement",
      ]);
      for (const forbidden of [
        "pool",
        "attenuation",
        "boost",
        "modifier",
        "modifierActive",
        "contentionStatus",
      ]) {
        expect(candidate).not.toHaveProperty(forbidden);
      }
    }
  });

  it("입력 FourPillars와 relation을 변경하지 않는다", () => {
    const pillars = chart("甲申", "丙子", "戊辰", "壬亥");
    const relations = detectTransformRelations(pillars);
    const pillarsBefore = JSON.parse(JSON.stringify(pillars));
    const relationsBefore = JSON.parse(JSON.stringify(relations));

    evaluateTransformCandidates(pillars, relations);

    expect(JSON.parse(JSON.stringify(pillars))).toEqual(pillarsBefore);
    expect(JSON.parse(JSON.stringify(relations))).toEqual(relationsBefore);
  });

  it("relation을 그대로 참조로 싣는다 (복제·변형 없음)", () => {
    const pillars = SAN_HE_OK;
    const relations: TransformRelation[] = detectTransformRelations(pillars);
    const candidates = evaluateTransformCandidates(pillars, relations);
    expect(candidates[0]!.relation).toBe(relations[0]);
  });

  it("결정론적이다", () => {
    expect(run(SAN_HE_OK)).toEqual(run(SAN_HE_OK));
  });

  it("relation이 없으면 candidate도 없다", () => {
    expect(run(chart("甲子", "甲子", "甲子", "甲子"))).toEqual([]);
  });
});
