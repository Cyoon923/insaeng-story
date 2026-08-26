import { describe, expect, it } from "vitest";
import { buildSupplementPresentation } from "@/lib/saju/final/buildSupplementPresentation";
import type { CoreAndSupplementResolution } from "@/lib/saju/final/types";

function combined(
  partial: Pick<
    CoreAndSupplementResolution,
    "coreElement" | "supplementElement" | "supplementStatus" | "coreCertainty"
  > &
    Partial<CoreAndSupplementResolution>,
): CoreAndSupplementResolution {
  return {
    coreRole: partial.coreElement ? "R2" : null,
    reasons: ["core:internal", "supplement:F2_GENERATIVE", "supplement:F6"],
    ...partial,
  };
}

function leaked(text: string): void {
  expect(text).not.toMatch(/R[1-6]/);
  expect(text).not.toMatch(/F[1-8]/);
  expect(text).not.toMatch(/bottleneck|용신|희신|목생화|decisionTrace/i);
}

describe("buildSupplementPresentation", () => {
  it("1. Core 火 / Supplement 木 → 화면 木", () => {
    const view = buildSupplementPresentation(
      combined({
        coreElement: "火",
        coreCertainty: "provisional",
        supplementElement: "木",
        supplementStatus: "resolved",
      }),
    );
    expect(view).toMatchObject({
      element: "木",
      symbol: "🌱",
      name: "나무",
      keyword: "성장하고, 시작하고, 방향을 만드는 힘",
      headline: "지금은 나무의 성질을 보강하는 방향이 잘 맞아요.",
      reasonTitle: "왜 나무일까요?",
      coreElement: "火",
      supplementStatus: "resolved",
    });
    expect(view.reasonFlow).toEqual(["나무", "불을 도움", "균형"]);
    leaked(JSON.stringify(view));
  });

  it("2. Core 火 / Supplement 火 → 화면 火", () => {
    const view = buildSupplementPresentation(
      combined({
        coreElement: "火",
        coreCertainty: "confirmed",
        supplementElement: "火",
        supplementStatus: "resolved",
      }),
    );
    expect(view).toMatchObject({
      element: "火",
      symbol: "🔥",
      name: "불",
      headline: "지금은 불의 성질을 보강하는 방향이 잘 맞아요.",
      reasonTitle: "왜 불일까요?",
      reasonFlow: ["직접 보강", "불", "균형"],
      coreElement: "火",
    });
  });

  it("3. Core 水 / Supplement 金 → 화면 金", () => {
    const view = buildSupplementPresentation(
      combined({
        coreElement: "水",
        coreCertainty: "provisional",
        supplementElement: "金",
        supplementStatus: "resolved",
      }),
    );
    expect(view).toMatchObject({
      element: "金",
      symbol: "✨",
      name: "금",
      headline: "지금은 금의 성질을 보강하는 방향이 잘 맞아요.",
      reasonTitle: "왜 금일까요?",
      reasonFlow: ["금", "물을 도움", "균형"],
      coreElement: "水",
    });
  });

  it("4. Supplement unresolved → 특정 오행 없음", () => {
    const view = buildSupplementPresentation(
      combined({
        coreElement: "火",
        coreCertainty: "provisional",
        supplementElement: null,
        supplementStatus: "unresolved",
      }),
    );
    expect(view).toMatchObject({
      element: null,
      symbol: null,
      name: null,
      keyword: null,
      reasonTitle: null,
      reasonFlow: [],
      headline: "지금 정보만으로는 보강할 기운을 하나로 정하기 어려워요.",
      coreElement: "火",
      supplementStatus: "unresolved",
    });
  });

  it("5. Core unresolved → 특정 오행 없음", () => {
    const view = buildSupplementPresentation(
      combined({
        coreElement: null,
        coreCertainty: "unresolved",
        supplementElement: null,
        supplementStatus: "unresolved",
      }),
    );
    expect(view.element).toBeNull();
    expect(view.symbol).toBeNull();
    expect(view.name).toBeNull();
    expect(view.headline).toBe(
      "지금 정보만으로는 보강할 기운을 하나로 정하기 어려워요.",
    );
    expect(view.supplementStatus).toBe("unresolved");
  });

  it("6. 내부 R1/F2/F6 문자열 노출 없음", () => {
    const view = buildSupplementPresentation(
      combined({
        coreElement: "火",
        coreCertainty: "provisional",
        supplementElement: "木",
        supplementStatus: "resolved",
        reasons: ["core:R2", "supplement:F2_GENERATIVE", "supplement:F6_INCOMING_MEDIATION"],
      }),
    );
    leaked(JSON.stringify(view));
    expect(view.headline + view.reasonTitle + view.reasonFlow.join("")).not.toMatch(
      /R2|F2|F6|목생화/,
    );
  });
});
