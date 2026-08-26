import { describe, expect, it } from "vitest";
import { buildFinalPresentation } from "@/lib/saju/final/buildFinalPresentation";
import type { FinalResolution } from "@/lib/saju/final/types";
import type { Element } from "@/lib/saju/types";

const EMPTY_ROLES: FinalResolution["roleActivities"] = {
  R1: "C",
  R2: "C",
  R3: "C",
  R4: "C",
  R5: "C",
  R6: "C",
};

function resolution(
  partial: Pick<FinalResolution, "finalElement" | "finalRole" | "certainty"> &
    Partial<FinalResolution>,
): FinalResolution {
  return {
    roleActivities: EMPTY_ROLES,
    r2Bottleneck: "NOT",
    r5Bottleneck: "NOT",
    hourStability: null,
    reasons: ["internal:r2-possible-dominant", "g2:r1-open-priority"],
    decisionTrace: ["derivePriorityRoles:g2:r2-possible-dominant", "R3:keep"],
    ...partial,
  };
}

function assertNoInternalLeak(text: string): void {
  expect(text).not.toMatch(/R[1-6]/);
  expect(text).not.toMatch(/bottleneck|decisionTrace|mixed/i);
  expect(text).not.toContain("잠정");
}

describe("buildFinalPresentation", () => {
  const resolvedCases: Array<{
    element: Element;
    symbol: string;
    name: string;
    keyword: string;
  }> = [
    {
      element: "水",
      symbol: "💧",
      name: "물",
      keyword: "흐르고, 식히고, 여유를 만드는 힘",
    },
    {
      element: "火",
      symbol: "🔥",
      name: "불",
      keyword: "표현하고, 움직이고, 활력을 만드는 힘",
    },
    {
      element: "木",
      symbol: "🌱",
      name: "나무",
      keyword: "성장하고, 시작하고, 방향을 만드는 힘",
    },
    {
      element: "金",
      symbol: "✨",
      name: "금",
      keyword: "정리하고, 기준을 세우고, 결단하는 힘",
    },
    {
      element: "土",
      symbol: "🪨",
      name: "흙",
      keyword: "중심을 잡고, 안정시키고, 받쳐 주는 힘",
    },
  ];

  for (const fixture of resolvedCases) {
    it(`${fixture.element} resolved → ${fixture.symbol}/${fixture.name}/keyword/headline`, () => {
      const view = buildFinalPresentation(
        resolution({
          finalElement: fixture.element,
          finalRole: "R1",
          certainty: "provisional",
        }),
      );
      expect(view.element).toBe(fixture.element);
      expect(view.symbol).toBe(fixture.symbol);
      expect(view.name).toBe(fixture.name);
      expect(view.keyword).toBe(fixture.keyword);
      expect(view.headline).toBe(
        `지금은 ${fixture.name}의 성질을 보완하는 방향이 가장 잘 맞아요.`,
      );
      expect(view.reasonTitle).toBe(`왜 ${fixture.name}일까요?`);
      expect(view.reasonFlow).toHaveLength(3);
      expect(view.certainty).toBe("provisional");
      assertNoInternalLeak(
        [view.symbol, view.name, view.keyword, view.headline, view.reasonTitle, ...view.reasonFlow].join(
          "|",
        ),
      );
    });
  }

  it("unresolved → 특정 오행 카피 없음", () => {
    const view = buildFinalPresentation(
      resolution({
        finalElement: null,
        finalRole: null,
        certainty: "unresolved",
      }),
    );
    expect(view.element).toBeNull();
    expect(view.symbol).toBe("");
    expect(view.name).toBe("");
    expect(view.keyword).toBe("");
    expect(view.headline).toBe("지금 정보만으로는 한 가지 방향을 정하기 어려워요.");
    expect(view.reasonTitle).toBe("");
    expect(view.reasonFlow).toEqual([]);
    expect(view.certainty).toBe("unresolved");
  });

  it("내부 R1~R6 문자열이 사용자 출력에 포함되지 않음", () => {
    const view = buildFinalPresentation(
      resolution({
        finalElement: "火",
        finalRole: "R2",
        certainty: "confirmed",
        reasons: ["R2", "R5 CLEAR", "provisional:r2-possible-dominant"],
        decisionTrace: ["R1", "R3", "R4", "R6"],
      }),
    );
    const userFacing = [
      view.symbol,
      view.name,
      view.keyword,
      view.headline,
      view.reasonTitle,
      ...view.reasonFlow,
    ].join("|");
    assertNoInternalLeak(userFacing);
    for (const role of ["R1", "R2", "R3", "R4", "R5", "R6"] as const) {
      expect(userFacing).not.toContain(role);
    }
  });
});
