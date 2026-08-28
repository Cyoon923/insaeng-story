import { describe, expect, it } from "vitest";
import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { buildNeedResolution } from "@/lib/saju/elements/needResolution";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { buildStrengthSummary } from "@/lib/saju/elements/strengthSummary";
import { resolveFinalElement } from "@/lib/saju/final/resolveFinalElement";
import { resolveSupplementFlow } from "@/lib/saju/final/resolveSupplementFlow";
import { buildAnnualFlowSummaryPresentation } from "@/lib/saju/luck/annual/buildAnnualFlowSummaryPresentation";
import { resolveAnnualSupplementFlowV2 } from "@/lib/saju/luck/annual/resolveAnnualSupplementFlowV2";
import { buildFreeSajuPillars } from "@/lib/saju/free/buildFreeSajuPillars";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import type { FourPillars } from "@/lib/saju/types";

const REP_PILLARS: FourPillars = {
  year: { stem: "辛", branch: "酉" },
  month: { stem: "乙", branch: "未" },
  day: { stem: "丙", branch: "申" },
  hour: { stem: "戊", branch: "戌" },
  hourCertainty: "confirmed",
  warnings: [],
};

const UNSUPPORTED_NARRATIVE = [
  "변화가 커지는 해",
  "확장의 해",
  "도전의 해",
  "좋은 해",
  "나쁜 해",
  "기회가 많아져요",
  "결실을 맺어요",
  "건강을",
  "상반기",
  "하반기",
  "1월",
  "7월",
  "나무가",
  "물을 보강",
  "불의 기운이 들어와요",
];

const INTENSITY_PHRASES = ["강하게", "약하게", "매우", "크게"];

function assertCleanCopy(text: string): void {
  for (const phrase of UNSUPPORTED_NARRATIVE) {
    expect(text).not.toContain(phrase);
  }
  for (const phrase of INTENSITY_PHRASES) {
    expect(text).not.toContain(phrase);
  }
  expect(text).not.toMatch(/A[1-5]|F[1-8]/);
  expect(text).not.toMatch(
    /NEW_CLIMATE|RESIDUAL|ACTIVE|CAUTION|INACTIVE|CORE_SUPPORT|INCOMING_MEDIATION/i,
  );
  expect(text).not.toMatch(/\bpartial\b|\bresolved\b|\bunresolved\b/i);
}

function annualFlowFromPillars(pillars: FourPillars) {
  const evidence = collectStrengthEvidence(pillars);
  const observations = buildStrengthObservations(pillars, evidence);
  const climate = buildAdjustedClimateSummary(pillars);
  const needResolution = buildNeedResolution(pillars);
  const fer = resolveFinalElement({
    pillars,
    summary: buildStrengthSummary(pillars),
    evidence,
    observations,
    climate,
    needResolution,
  });
  const natal = resolveSupplementFlow({
    pillars,
    finalResolution: fer,
    observations,
    climate,
    needResolution,
  });
  return resolveAnnualSupplementFlowV2({
    year: 2026,
    natalCoreElement: natal.resolution.coreElement,
    natalCoreCertainty: natal.resolution.coreCertainty,
    natalSupplementElement: natal.resolution.supplementElement,
    natalSupplementStatus: natal.resolution.supplementStatus,
    natalPolicies: natal.policies,
    natalCorridors: natal.corridors,
    natalCoreState: natal.coreState,
    natalClimate: climate,
    needResolution,
  });
}

function summaryFromPillars(pillars: FourPillars) {
  const flow = annualFlowFromPillars(pillars);
  return buildAnnualFlowSummaryPresentation({
    year: 2026,
    evidence: flow.evidence,
    goalSatisfactions: flow.goalSatisfactions,
    imbalances: flow.imbalances,
    resolution: flow.resolution,
  });
}

function summaryFromBirth(birth: Parameters<typeof buildFreeSajuPillars>[0]) {
  return summaryFromPillars(buildFreeSajuPillars(birth));
}

describe("buildAnnualFlowSummaryPresentation — representative 辛酉/乙未/丙申/戊戌", () => {
  it("2026 丙午 + natal 火/木 relations and partial support", () => {
    const view = summaryFromPillars(REP_PILLARS);
    const joined = view.sentences.join("\n");

    expect(view).toMatchObject({
      year: 2026,
      title: "2026년 전체 흐름",
    });
    expect(view.sentences.length).toBeGreaterThanOrEqual(2);
    expect(view.sentences.length).toBeLessThanOrEqual(4);
    expect(joined).toContain("중심 흐름과 같은 방향");
    expect(joined).not.toContain("완전");
    expect(joined).not.toContain("충분히 맞아요");
    expect(joined).toMatch(/일부 보태|겹쳐 나타날|달라질 수 있어요/);
    assertCleanCopy(joined);
  });
});

describe("buildAnnualFlowSummaryPresentation — fixture diversity", () => {
  const cases = [
    {
      id: "MX-1981",
      birth: {
        calendar: "solar" as const,
        year: 1981,
        month: 7,
        day: 17,
        hour: 19,
        minute: 17,
      },
    },
    {
      id: "LW-bingo",
      pillars: {
        year: { stem: "丙", branch: "午" },
        month: { stem: "戊", branch: "戌" },
        day: { stem: "甲", branch: "申" },
        hour: { stem: "甲", branch: "子" },
        hourCertainty: "confirmed" as const,
        warnings: [],
      },
    },
    {
      id: "lean-strong",
      pillars: {
        year: { stem: "甲", branch: "寅" },
        month: { stem: "丙", branch: "寅" },
        day: { stem: "甲", branch: "寅" },
        hour: { stem: "甲", branch: "寅" },
        hourCertainty: "confirmed" as const,
        warnings: [],
      },
    },
    {
      id: "1984-sample",
      birth: {
        calendar: "solar" as const,
        year: 1984,
        month: 2,
        day: 15,
        hour: 10,
        minute: 0,
      },
    },
    {
      id: "2000-01-01",
      birth: {
        calendar: "solar" as const,
        year: 2000,
        month: 1,
        day: 1,
        hour: 12,
        minute: 0,
      },
    },
  ] as const;

  it("same 2026 丙午 but summaries differ by natal evidence", () => {
    const summaries = cases.map((fixture) => {
      const view =
        "birth" in fixture
          ? summaryFromBirth(fixture.birth)
          : summaryFromPillars(fixture.pillars);
      return { id: fixture.id, joined: view.sentences.join("|") };
    });

    const unique = new Set(summaries.map((row) => row.joined));
    expect(unique.size).toBeGreaterThan(1);

    for (const row of summaries) {
      expect(row.joined.length).toBeGreaterThan(0);
      assertCleanCopy(row.joined);
    }
  });

  it("LW-bingo emphasizes distance from core/supplement", () => {
    const bingo = cases.find((row) => row.id === "LW-bingo")!;
    const view = summaryFromPillars(bingo.pillars);
    const joined = view.sentences.join("\n");
    expect(joined).toMatch(/거리를 두|맞지 않아요/);
    assertCleanCopy(joined);
  });

  it("lean-strong unresolved winner still yields summary from evidence", () => {
    const lean = cases.find((row) => row.id === "lean-strong")!;
    const flow = annualFlowFromPillars(lean.pillars);
    expect(flow.resolution.annualSupplementElement).toBeNull();

    const view = buildAnnualFlowSummaryPresentation({
      year: 2026,
      evidence: flow.evidence,
      goalSatisfactions: flow.goalSatisfactions,
      imbalances: flow.imbalances,
      resolution: flow.resolution,
    });

    expect(view.sentences.length).toBeGreaterThan(0);
    expect(view.sentences.length).toBeLessThanOrEqual(4);
    assertCleanCopy(view.sentences.join("\n"));
  });
});

describe("buildAnnualFlowSummaryPresentation — guards", () => {
  it("returns empty sentences when evidence is null", () => {
    const view = buildAnnualFlowSummaryPresentation({
      year: 2026,
      evidence: null,
      goalSatisfactions: [],
      imbalances: [],
      resolution: {
        year: 2026,
        annualStemBranch: null,
        annualSupplementElement: null,
        status: "unresolved",
        unresolvedGoals: [],
        unresolvedImbalances: [],
        reasons: [],
      },
    });

    expect(view.title).toBe("2026년 전체 흐름");
    expect(view.sentences).toEqual([]);
  });

  it("never exceeds four sentences", () => {
    const view = summaryFromPillars(REP_PILLARS);
    expect(view.sentences.length).toBeLessThanOrEqual(4);
  });
});
