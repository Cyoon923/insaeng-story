import { describe, expect, it } from "vitest";
import { collectStrengthEvidence, hiddenStemSourceKey, shiShenOf } from "@/lib/saju";
import { HIDDEN_STEMS } from "@/lib/saju/data/hiddenStems";
import type { FourPillars, HourPillar, Pillar } from "@/lib/saju/types";

function chart(partial: { year: Pillar; month: Pillar; day: Pillar; hour: HourPillar }): FourPillars {
  return {
    ...partial,
    hourCertainty: partial.hour === "unknown" ? "unknown" : "confirmed",
    warnings: [],
  };
}

describe("branchRelationEvidence", () => {
  it("CASE 甲酉 庚酉 甲酉 unknown — 酉辛 정관과 월간 庚 편관을 섞지 않는다", () => {
    const evidence = collectStrengthEvidence(
      chart({
        year: { stem: "甲", branch: "酉" },
        month: { stem: "庚", branch: "酉" },
        day: { stem: "甲", branch: "酉" },
        hour: "unknown",
      }),
    );

    expect(evidence.pressureEvidence.items).toEqual([
      expect.objectContaining({ slot: "month", stem: "庚", shiShen: "편관", layer: "stem" }),
    ]);
    expect(evidence.branchRelationEvidence.items).toEqual([
      expect.objectContaining({
        slot: "year",
        branch: "酉",
        hiddenStem: "辛",
        hiddenRole: "정기",
        shiShen: "정관",
        relationSide: "pressure",
        element: "金",
        elementPhase: "왕",
        sourceKey: "year:酉:辛:정기",
      }),
      expect.objectContaining({
        slot: "month",
        branch: "酉",
        hiddenStem: "辛",
        hiddenRole: "정기",
        shiShen: "정관",
        sourceKey: "month:酉:辛:정기",
      }),
      expect.objectContaining({
        slot: "day",
        branch: "酉",
        hiddenStem: "辛",
        hiddenRole: "정기",
        shiShen: "정관",
        sourceKey: "day:酉:辛:정기",
      }),
    ]);
    expect(evidence.branchRelationEvidence.items.every((item) => item.slot !== "hour")).toBe(true);
    expect(evidence.supportEvidence.items.every((item) => item.layer === "stem")).toBe(true);
    expect(evidence.pressureEvidence.items.every((item) => item.layer === "stem")).toBe(true);
  });

  it("CASE 甲寅 甲寅 甲子 unknown — 寅·子 지장간과 root source를 같이 식별한다", () => {
    const evidence = collectStrengthEvidence(
      chart({
        year: { stem: "甲", branch: "寅" },
        month: { stem: "甲", branch: "寅" },
        day: { stem: "甲", branch: "子" },
        hour: "unknown",
      }),
    );

    expect(evidence.branchRelationEvidence.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slot: "year", branch: "寅", hiddenStem: "戊", hiddenRole: "여기", shiShen: "편재" }),
        expect.objectContaining({ slot: "year", branch: "寅", hiddenStem: "丙", hiddenRole: "중기", shiShen: "식신" }),
        expect.objectContaining({ slot: "year", branch: "寅", hiddenStem: "甲", hiddenRole: "정기", shiShen: "비견" }),
        expect.objectContaining({ slot: "month", branch: "寅", hiddenStem: "甲", hiddenRole: "정기", shiShen: "비견" }),
        expect.objectContaining({ slot: "day", branch: "子", hiddenStem: "癸", hiddenRole: "정기", shiShen: "정인" }),
      ]),
    );

    for (const hit of evidence.rootEvidence.hits) {
      const key = hiddenStemSourceKey(hit.slot, hit.branch, hit.hiddenStem, hit.role);
      const related = evidence.branchRelationEvidence.items.find((item) => item.sourceKey === key);
      expect(related, key).toMatchObject({
        slot: hit.slot,
        branch: hit.branch,
        hiddenStem: hit.hiddenStem,
        hiddenRole: hit.role,
        shiShen: hit.polarity === "비견" ? "비견" : "겁재",
        relationSide: "support",
      });
    }
  });

  it("CASE 甲子 丙寅 己卯 unknown — 己 기준 지장간 십신이 표와 같다", () => {
    const evidence = collectStrengthEvidence(
      chart({
        year: { stem: "甲", branch: "子" },
        month: { stem: "丙", branch: "寅" },
        day: { stem: "己", branch: "卯" },
        hour: "unknown",
      }),
    );

    expect(shiShenOf("己", "戊")).toBe("겁재");
    expect(shiShenOf("己", "丙")).toBe("정인");
    expect(shiShenOf("己", "甲")).toBe("정관");
    expect(shiShenOf("己", "乙")).toBe("편관");
    expect(shiShenOf("己", "癸")).toBe("편재");
    expect(evidence.branchRelationEvidence.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slot: "year", hiddenStem: "癸", shiShen: "편재" }),
        expect.objectContaining({ slot: "month", hiddenStem: "戊", shiShen: "겁재" }),
        expect.objectContaining({ slot: "month", hiddenStem: "丙", shiShen: "정인" }),
        expect.objectContaining({ slot: "month", hiddenStem: "甲", shiShen: "정관" }),
        expect.objectContaining({ slot: "day", hiddenStem: "乙", shiShen: "편관" }),
      ]),
    );
  });

  it("CASE 甲辰 丙午 丁酉 庚申 — 확정 시지 申을 포함한다", () => {
    const evidence = collectStrengthEvidence(
      chart({
        year: { stem: "甲", branch: "辰" },
        month: { stem: "丙", branch: "午" },
        day: { stem: "丁", branch: "酉" },
        hour: { stem: "庚", branch: "申" },
      }),
    );

    expect(evidence.hourUnknown).toBe(false);
    expect(evidence.branchRelationEvidence.items.some((item) => item.slot === "hour" && item.branch === "申")).toBe(
      true,
    );
    expect(evidence.branchRelationEvidence.items.filter((item) => item.slot === "year").map((item) => item.hiddenStem)).toEqual(
      ["乙", "癸", "戊"],
    );
    expect(evidence.branchRelationEvidence.items.filter((item) => item.slot === "month").map((item) => item.hiddenStem)).toEqual(
      ["己", "丁"],
    );
    expect(evidence.branchRelationEvidence.items.filter((item) => item.slot === "day").map((item) => item.hiddenStem)).toEqual(
      ["辛"],
    );
    expect(evidence.branchRelationEvidence.items.filter((item) => item.slot === "hour").map((item) => item.hiddenStem)).toEqual(
      ["戊", "壬", "庚"],
    );
    expect(evidence.branchRelationEvidence.items.every((item) => item.shiShen === shiShenOf("丁", item.hiddenStem))).toBe(
      true,
    );
  });

  it("辰未戌丑 지장간을 대표 土 하나로 접지 않는다", () => {
    const evidence = collectStrengthEvidence(
      chart({
        year: { stem: "甲", branch: "辰" },
        month: { stem: "甲", branch: "未" },
        day: { stem: "甲", branch: "戌" },
        hour: { stem: "甲", branch: "丑" },
      }),
    );

    const byBranch = {
      辰: evidence.branchRelationEvidence.items.filter((item) => item.branch === "辰"),
      未: evidence.branchRelationEvidence.items.filter((item) => item.branch === "未"),
      戌: evidence.branchRelationEvidence.items.filter((item) => item.branch === "戌"),
      丑: evidence.branchRelationEvidence.items.filter((item) => item.branch === "丑"),
    };

    expect(byBranch.辰.map((item) => [item.hiddenStem, item.hiddenRole, item.shiShen])).toEqual([
      ["乙", "여기", "겁재"],
      ["癸", "중기", "정인"],
      ["戊", "정기", "편재"],
    ]);
    expect(byBranch.未.map((item) => [item.hiddenStem, item.hiddenRole, item.shiShen])).toEqual([
      ["丁", "여기", "상관"],
      ["乙", "중기", "겁재"],
      ["己", "정기", "정재"],
    ]);
    expect(byBranch.戌.map((item) => [item.hiddenStem, item.hiddenRole, item.shiShen])).toEqual([
      ["辛", "여기", "정관"],
      ["丁", "중기", "상관"],
      ["戊", "정기", "편재"],
    ]);
    expect(byBranch.丑.map((item) => [item.hiddenStem, item.hiddenRole, item.shiShen])).toEqual([
      ["癸", "여기", "정인"],
      ["辛", "중기", "정관"],
      ["己", "정기", "정재"],
    ]);

    for (const branch of ["辰", "未", "戌", "丑"] as const) {
      expect(byBranch[branch].map((item) => item.hiddenStem)).toEqual(HIDDEN_STEMS[branch].map((part) => part.stem));
    }
  });

  it("assigns shiShen to every hidden stem and never uses hour when unknown", () => {
    const evidence = collectStrengthEvidence(
      chart({
        year: { stem: "壬", branch: "寅" },
        month: { stem: "己", branch: "亥" },
        day: { stem: "丙", branch: "子" },
        hour: "unknown",
      }),
    );

    expect(evidence.omittedSlots).toEqual(["hour"]);
    expect(evidence.branchRelationEvidence.items.every((item) => item.slot !== "hour")).toBe(true);
    expect(evidence.branchRelationEvidence.items.length).toBeGreaterThan(0);
    expect(evidence.branchRelationEvidence.items.every((item) => item.shiShen)).toBe(true);
    expect(evidence.branchRelationEvidence.items.every((item) => item.hiddenRole)).toBe(true);
    expect(evidence.branchRelationEvidence.items.every((item) => item.elementPhase)).toBe(true);
    expect(evidence).not.toHaveProperty("score");
  });
});
