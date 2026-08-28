/**
 * TBD-02g L1 — 원국 합 relation-hit 탐지.
 * transform-ok · 목표 오행 · pool · modifier · 경합은 범위 밖이다.
 */
import { describe, expect, it } from "vitest";
import { branchElement, stemElement } from "@/lib/saju/constants/elements";
import { HIDDEN_STEMS } from "@/lib/saju/data/hiddenStems";
import {
  BRANCH_FANG_HE_COMBINATIONS,
  BRANCH_SAN_HE_COMBINATIONS,
  STEM_HE_COMBINATIONS,
} from "@/lib/saju/transform/combinationTables";
import { detectTransformRelations } from "@/lib/saju/transform/detectTransformRelations";
import type { Branch, FourPillars, HourPillar, Pillar, Stem } from "@/lib/saju/types";
import { BRANCHES, STEMS } from "@/lib/saju/types";

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

const idsOf = (relations: ReturnType<typeof detectTransformRelations>) =>
  relations.map((r) => r.combineId);

describe("detectTransformRelations · 五合", () => {
  it("5쌍을 전부 탐지한다", () => {
    for (const combination of STEM_HE_COMBINATIONS) {
      const [a, b] = combination.stems;
      // filler 천간이 쌍과 겹쳐 multiplicity를 만들지 않도록 a·b 이외를 고르고 시주는 비운다
      const filler = STEMS.find((stem) => stem !== a && stem !== b)!;
      const relations = detectTransformRelations(
        chart(`${a}子`, `${b}丑`, `${filler}寅`, "unknown"),
      );
      const found = relations.filter((r) => r.combineId === combination.id);
      expect(found).toHaveLength(1);
      expect(found[0]!.kind).toBe("五合");
    }
  });

  it("비합 천간 조합은 탐지하지 않는다", () => {
    // 甲과 乙은 五合 쌍이 아니다
    const relations = detectTransformRelations(chart("甲子", "乙丑", "甲寅", "乙巳"));
    expect(relations.filter((r) => r.kind === "五合")).toEqual([]);
  });

  it("자리 순서가 뒤바뀌어도 동일 combineId", () => {
    const forward = detectTransformRelations(chart("甲子", "己丑", "戊寅", "庚辰"));
    const reversed = detectTransformRelations(chart("己子", "甲丑", "戊寅", "庚辰"));
    const forwardIds = idsOf(forward).filter((id) => id.startsWith("五合"));
    const reversedIds = idsOf(reversed).filter((id) => id.startsWith("五合"));
    expect(forwardIds).toEqual(["五合-甲己"]);
    expect(reversedIds).toEqual(["五合-甲己"]);
  });

  it("동일 천간이 반복되면 자리 조합마다 relation을 보존한다", () => {
    // year 甲 · month 甲 · day 己 → year甲-day己, month甲-day己 두 건
    const relations = detectTransformRelations(chart("甲子", "甲丑", "己寅", "庚辰")).filter(
      (r) => r.combineId === "五合-甲己",
    );
    expect(relations).toHaveLength(2);
    expect(relations.map((r) => r.participants.map((p) => p.slot))).toEqual([
      ["year", "day"],
      ["month", "day"],
    ]);
  });

  it("양쪽이 각각 2자리면 2×2 = 4건", () => {
    const relations = detectTransformRelations(chart("甲子", "甲丑", "己寅", "己辰")).filter(
      (r) => r.combineId === "五合-甲己",
    );
    expect(relations).toHaveLength(4);
  });

  it("participant는 stem layer이고 element는 천간 오행이다", () => {
    const relation = detectTransformRelations(chart("甲子", "己丑", "戊寅", "庚辰")).find(
      (r) => r.combineId === "五合-甲己",
    )!;
    expect(relation.participants).toEqual([
      { slot: "year", layer: "stem", element: stemElement("甲") },
      { slot: "month", layer: "stem", element: stemElement("己") },
    ]);
    expect(relation.participants.every((p) => p.layer === "stem")).toBe(true);
  });
});

describe("detectTransformRelations · 삼합 / 방합", () => {
  it("삼합 4종을 전부 탐지한다", () => {
    for (const combination of BRANCH_SAN_HE_COMBINATIONS) {
      const [x, y, z] = combination.branches;
      // filler 지지가 조합과 겹쳐 multiplicity를 만들지 않도록 시주를 비운다
      const relations = detectTransformRelations(chart(`甲${x}`, `乙${y}`, `丙${z}`, "unknown"));
      const found = relations.filter((r) => r.combineId === combination.id);
      expect(found).toHaveLength(1);
      expect(found[0]!.kind).toBe("삼합");
    }
  });

  it("방합 4종을 전부 탐지한다", () => {
    for (const combination of BRANCH_FANG_HE_COMBINATIONS) {
      const [x, y, z] = combination.branches;
      const relations = detectTransformRelations(chart(`甲${x}`, `乙${y}`, `丙${z}`, "unknown"));
      const found = relations.filter((r) => r.combineId === combination.id);
      expect(found).toHaveLength(1);
      expect(found[0]!.kind).toBe("방합");
    }
  });

  it("한 글자가 빠지면 탐지하지 않는다 (완성형만)", () => {
    // 申子 만 있고 辰 없음
    const relations = detectTransformRelations(chart("甲申", "乙子", "丙寅", "戊巳"));
    expect(relations.filter((r) => r.combineId === "삼합-申子辰")).toEqual([]);
    // 寅卯 만 있고 辰 없음
    expect(relations.filter((r) => r.combineId === "방합-寅卯辰")).toEqual([]);
  });

  it("자리 순서가 뒤바뀌어도 동일 combineId", () => {
    const a = detectTransformRelations(chart("甲申", "乙子", "丙辰", "戊午"));
    const b = detectTransformRelations(chart("甲辰", "乙申", "丙子", "戊午"));
    expect(idsOf(a).filter((id) => id.startsWith("삼합"))).toEqual(["삼합-申子辰"]);
    expect(idsOf(b).filter((id) => id.startsWith("삼합"))).toEqual(["삼합-申子辰"]);
  });

  it("동일 지지가 반복되면 자리 조합마다 relation을 보존한다", () => {
    // 申 2자리 × 子 1 × 辰 1 → 2건
    const relations = detectTransformRelations(chart("甲申", "乙申", "丙子", "戊辰")).filter(
      (r) => r.combineId === "삼합-申子辰",
    );
    expect(relations).toHaveLength(2);
    expect(relations.map((r) => r.participants.map((p) => p.slot))).toEqual([
      ["year", "day", "hour"],
      ["month", "day", "hour"],
    ]);
  });

  it("participant는 branch layer이고 element는 지지 본기 오행이다", () => {
    const relation = detectTransformRelations(chart("甲申", "乙子", "丙辰", "戊午")).find(
      (r) => r.combineId === "삼합-申子辰",
    )!;
    expect(relation.participants).toEqual([
      { slot: "year", layer: "branch", element: branchElement("申") },
      { slot: "month", layer: "branch", element: branchElement("子") },
      { slot: "day", layer: "branch", element: branchElement("辰") },
    ]);
    expect(relation.participants.every((p) => p.layer === "branch")).toBe(true);
  });

  it("branchElement는 12지지 전부에서 본기(정기) 오행과 일치한다", () => {
    // §1.5.9.10.1의 "세 지지 본기"와 branchElement()가 같은 값임을 잠근다.
    for (const branch of BRANCHES) {
      const main = HIDDEN_STEMS[branch].find((part) => part.role === "정기")!;
      expect(branchElement(branch)).toBe(stemElement(main.stem));
    }
  });

  it("방합 寅卯辰 참여 오행은 [木, 木, 土]다", () => {
    const relation = detectTransformRelations(chart("甲寅", "乙卯", "丙辰", "戊午")).find(
      (r) => r.combineId === "방합-寅卯辰",
    )!;
    expect(relation.participants.map((p) => p.element)).toEqual(["木", "木", "土"]);
  });
});

describe("detectTransformRelations · hour unknown", () => {
  it("시주가 unknown이면 참여하지 않아 relation이 생기지 않는다", () => {
    const withHour = detectTransformRelations(chart("甲申", "乙子", "丙寅", "戊辰"));
    expect(withHour.filter((r) => r.combineId === "삼합-申子辰")).toHaveLength(1);

    const unknownHour = detectTransformRelations(chart("甲申", "乙子", "丙寅", "unknown"));
    expect(unknownHour.filter((r) => r.combineId === "삼합-申子辰")).toEqual([]);
    expect(unknownHour.every((r) => r.participants.every((p) => p.slot !== "hour"))).toBe(true);
  });

  it("五合도 시주 unknown이면 제외된다", () => {
    const withHour = detectTransformRelations(chart("乙子", "丙丑", "丁寅", "己巳"));
    expect(withHour.filter((r) => r.combineId === "五合-甲己")).toEqual([]);

    const present = detectTransformRelations(chart("甲子", "丙丑", "丁寅", "己巳"));
    expect(present.filter((r) => r.combineId === "五合-甲己")).toHaveLength(1);

    const unknownHour = detectTransformRelations(chart("甲子", "丙丑", "丁寅", "unknown"));
    expect(unknownHour.filter((r) => r.combineId === "五合-甲己")).toEqual([]);
  });
});

describe("detectTransformRelations · 필드 범위·불변성·결정론", () => {
  const pillars = chart("甲申", "己子", "丙辰", "戊午");

  it("relation에 판정·수치 필드가 없다", () => {
    const relations = detectTransformRelations(pillars);
    expect(relations.length).toBeGreaterThan(0);
    for (const relation of relations) {
      expect(Object.keys(relation).sort()).toEqual(["combineId", "kind", "participants"]);
      for (const forbidden of [
        "targetElement",
        "status",
        "transformOk",
        "modifier",
        "modifierActive",
        "pool",
        "attenuation",
        "boost",
        "contentionStatus",
      ]) {
        expect(relation).not.toHaveProperty(forbidden);
      }
      for (const participant of relation.participants) {
        expect(Object.keys(participant).sort()).toEqual(["element", "layer", "slot"]);
      }
    }
  });

  it("입력 FourPillars를 변경하지 않는다", () => {
    const before = JSON.parse(JSON.stringify(pillars));
    detectTransformRelations(pillars);
    expect(JSON.parse(JSON.stringify(pillars))).toEqual(before);
  });

  it("결과가 결정론적이다", () => {
    expect(detectTransformRelations(pillars)).toEqual(detectTransformRelations(pillars));
  });

  it("순서는 표 순서 → 자리 순서다 (五合 먼저, 그다음 삼합·방합)", () => {
    const relations = detectTransformRelations(chart("甲申", "己子", "丙辰", "戊午"));
    const kinds = relations.map((r) => r.kind);
    const firstBranchIndex = kinds.findIndex((k) => k !== "五合");
    if (firstBranchIndex !== -1) {
      expect(kinds.slice(0, firstBranchIndex).every((k) => k === "五合")).toBe(true);
    }
    expect(relations.filter((r) => r.combineId === "五合-甲己")).toHaveLength(1);
    expect(relations.filter((r) => r.combineId === "삼합-申子辰")).toHaveLength(1);
  });

  it("합이 전혀 없는 원국은 빈 배열", () => {
    expect(detectTransformRelations(chart("甲子", "甲子", "甲子", "甲子"))).toEqual([]);
  });
});
