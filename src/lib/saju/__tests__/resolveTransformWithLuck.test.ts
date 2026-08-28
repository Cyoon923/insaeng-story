/**
 * Luck Transform — 운 간지가 원국과 함께 합에 참여.
 * Opening · 六合/반합 · 월운/일운 · 五合 TBD는 범위 밖이다.
 */
import { describe, expect, it } from "vitest";
import {
  detectLuckTransformRelations,
  type LuckTransformSource,
} from "@/lib/saju/transform/detectLuckTransformRelations";
import { detectTransformRelations } from "@/lib/saju/transform/detectTransformRelations";
import { participantKey, involvesLuck } from "@/lib/saju/transform/participantIdentity";
import { resolveTransformWithLuck } from "@/lib/saju/transform/resolveTransformWithLuck";
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
const annual = (stem: Stem, branch: Branch): LuckTransformSource => ({
  origin: "annual-year",
  stem,
  branch,
});
const decade = (stem: Stem, branch: Branch): LuckTransformSource => ({
  origin: "decade",
  stem,
  branch,
});

describe("participant identity", () => {
  it("운 참여자는 궁위가 없고 origin으로 식별된다", () => {
    // 원국 申子 + 세운 辰 → 삼합 申子辰
    const relations = detectLuckTransformRelations(chart("甲申", "丙子", "戊卯", "乙巳"), [
      annual("壬", "辰"),
    ]);
    const relation = relations.find((r) => r.combineId === "삼합-申子辰")!;
    const luck = relation.participants.find((p) => p.origin === "annual-year")!;

    expect(luck).not.toHaveProperty("slot");
    expect(participantKey(luck)).toBe("annual-year:branch");
    expect(participantKey(relation.participants[0]!)).toBe("natal:branch:year");
  });

  it("natal month와 luck month kind가 충돌하지 않는다", () => {
    const natalMonth = { origin: "natal" as const, slot: "month" as const, layer: "branch" as const, element: "水" as const };
    const luckDecade = { origin: "decade" as const, layer: "branch" as const, element: "水" as const };
    expect(participantKey(natalMonth)).not.toBe(participantKey(luckDecade));
  });
});

describe("운 참여 합 탐지", () => {
  it("원국 2자 + 운 1자로 삼합이 성립한다", () => {
    const relations = detectLuckTransformRelations(chart("甲申", "丙子", "戊卯", "乙巳"), [
      annual("壬", "辰"),
    ]);
    const found = relations.filter((r) => r.combineId === "삼합-申子辰");
    expect(found).toHaveLength(1);
    expect(found[0]!.participants.map((p) => p.origin)).toEqual([
      "natal",
      "natal",
      "annual-year",
    ]);
  });

  it("대운도 동일하게 참여한다", () => {
    const relations = detectLuckTransformRelations(chart("甲申", "丙子", "戊卯", "乙巳"), [
      decade("壬", "辰"),
    ]);
    expect(relations.filter((r) => r.combineId === "삼합-申子辰")).toHaveLength(1);
  });

  it("대운+세운이 각각 참여하면 조합마다 relation이 보존된다", () => {
    const relations = detectLuckTransformRelations(chart("甲申", "丙子", "戊卯", "乙巳"), [
      annual("壬", "辰"),
      decade("癸", "辰"),
    ]);
    expect(relations.filter((r) => r.combineId === "삼합-申子辰")).toHaveLength(2);
  });

  it("원국끼리만 이루는 합은 제외된다 (Natal L1의 몫)", () => {
    const pillars = chart("甲申", "丙子", "戊辰", "壬亥");
    expect(detectTransformRelations(pillars).length).toBeGreaterThan(0);
    expect(detectLuckTransformRelations(pillars, [])).toEqual([]);
  });

  it("운끼리만 이루는 합도 제외된다", () => {
    // 원국에 申子辰 없음. 운 둘만으로는 3자가 안 되고, 되더라도 제외 대상
    const relations = detectLuckTransformRelations(chart("甲寅", "丙卯", "戊巳", "乙未"), [
      annual("壬", "申"),
      decade("癸", "子"),
    ]);
    for (const relation of relations) {
      expect(relation.participants.some((p) => p.origin === "natal")).toBe(true);
    }
  });

  it("五合도 운 천간이 참여할 수 있다", () => {
    const relations = detectLuckTransformRelations(chart("甲寅", "丙卯", "戊巳", "乙未"), [
      annual("己", "酉"),
    ]);
    const found = relations.filter((r) => r.combineId === "五合-甲己");
    expect(found).toHaveLength(1);
    expect(found[0]!.participants.map((p) => p.layer)).toEqual(["stem", "stem"]);
  });

  it("hour unknown이면 시주가 참여하지 않는다", () => {
    // 寅(year) + 午(hour) + 세운 戌 → 삼합 寅午戌. 시주가 실제로 참여한다.
    const withHour = detectLuckTransformRelations(chart("甲寅", "乙卯", "戊巳", "丙午"), [
      annual("庚", "戌"),
    ]);
    const unknownHour = detectLuckTransformRelations(chart("甲寅", "乙卯", "戊巳", "unknown"), [
      annual("庚", "戌"),
    ]);
    expect(withHour.some((r) => r.participants.some((p) => p.slot === "hour"))).toBe(true);
    expect(unknownHour.some((r) => r.participants.some((p) => p.slot === "hour"))).toBe(false);
  });
});

describe("resolveTransformWithLuck — L2~L4 재사용", () => {
  const pillars = chart("甲申", "丙子", "戊卯", "壬巳");

  it("natal / luck modifier를 구분해서 반환한다", () => {
    const result = resolveTransformWithLuck({ pillars, luckSources: [annual("壬", "辰")] });
    expect(Object.keys(result).sort()).toEqual(["luckModifiers", "natalModifiers"]);
    for (const modifier of result.luckModifiers) {
      expect(involvesLuck(modifier.attenuations)).toBe(true);
    }
    for (const modifier of result.natalModifiers) {
      expect(involvesLuck(modifier.attenuations)).toBe(false);
    }
  });

  it("운 참여 삼합이 transform-ok까지 도달한다", () => {
    // 申(year) 子(month) + 세운 辰 → 水. month 子 참여 · 壬 투출 · 참여 지지 충 없음
    const result = resolveTransformWithLuck({ pillars, luckSources: [annual("壬", "辰")] });
    const luck = result.luckModifiers.find((m) => m.combineId === "삼합-申子辰");
    expect(luck).toBeDefined();
    expect(luck!.targetElement).toBe("水");
    expect(luck!.attenuations).toHaveLength(3);
    expect(luck!.boost).toBe(luck!.attenuations.reduce((t, a) => t + a.attenuation, 0));
  });

  it("luckSources가 비면 기존 Natal 결과와 동일하다", () => {
    const natalOnly = resolveTransformWithLuck({ pillars });
    expect(natalOnly.luckModifiers).toEqual([]);
    expect(resolveTransformWithLuck({ pillars, luckSources: [] })).toEqual(natalOnly);
  });

  it("원국 자리를 공유하면 natal 합과 운 합이 같은 경합 집합에 들어간다", () => {
    // 원국 申子辰(완성) + 세운 辰 → 두 삼합이 year/month 자리를 공유
    const shared = chart("甲申", "丙子", "戊辰", "壬亥");
    const result = resolveTransformWithLuck({ pillars: shared, luckSources: [annual("壬", "辰")] });
    const all = [...result.natalModifiers, ...result.luckModifiers];
    const zi = all.filter((m) => m.combineId === "삼합-申子辰");
    expect(zi.length).toBeGreaterThan(1);
    // 경합했으므로 uncontested가 아니고, 활성은 최대 1개
    expect(zi.every((m) => m.contentionStatus !== "uncontested")).toBe(true);
    expect(zi.filter((m) => m.modifierActive).length).toBeLessThanOrEqual(1);
  });

  it("입력을 변경하지 않고 결정론적이다", () => {
    const sources = [annual("壬", "辰")];
    const before = JSON.parse(JSON.stringify({ pillars, sources }));
    const a = resolveTransformWithLuck({ pillars, luckSources: sources });
    expect(JSON.parse(JSON.stringify({ pillars, sources }))).toEqual(before);
    expect(a).toEqual(resolveTransformWithLuck({ pillars, luckSources: sources }));
  });
});
