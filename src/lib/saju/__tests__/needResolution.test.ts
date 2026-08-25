import { describe, expect, it } from "vitest";
import { buildNeedResolution } from "@/lib/saju";
import { resolveNeedCandidates } from "@/lib/saju/elements/needResolution";
import type {
  AdjustedClimateSummary,
  FourPillars,
  HourPillar,
  NeedCandidate,
  NeedCandidateSet,
  NeedResolution,
  Pillar,
  StrengthSummary,
} from "@/lib/saju/types";

function chart(partial: { year: Pillar; month: Pillar; day: Pillar; hour: HourPillar }): FourPillars {
  return {
    ...partial,
    hourCertainty: partial.hour === "unknown" ? "unknown" : "confirmed",
    warnings: [],
  };
}

function forbidden(resolution: NeedResolution) {
  expect(resolution).not.toHaveProperty("score");
  expect(resolution).not.toHaveProperty("rank");
  expect(resolution).not.toHaveProperty("priority");
  expect(resolution).not.toHaveProperty("winner");
  expect(resolution).not.toHaveProperty("neededElement");
  expect(resolution).not.toHaveProperty("finalElement");
  expect(resolution).not.toHaveProperty("yongsin");
  expect(resolution).not.toHaveProperty("heesin");
}

function candidate(partial: Partial<NeedCandidate> & Pick<NeedCandidate, "element" | "source">): NeedCandidate {
  return {
    reasons: [],
    direction: partial.source === "climate" ? "climate" : "peer",
    existingPresence: "absent",
    alreadyPresent: false,
    certainty: "partial",
    status: "candidate",
    evidenceRefs: [],
    ...partial,
  };
}

function stubStrength(directionCandidate: StrengthSummary["directionCandidate"]): StrengthSummary {
  return { certainty: "partial", directionCandidate } as StrengthSummary;
}

function stubClimate(moisture: AdjustedClimateSummary["moisture"]): AdjustedClimateSummary {
  return { certainty: "partial", moisture } as AdjustedClimateSummary;
}

describe("NeedResolution CASE", () => {
  it("CASE 1 己卯 丙子 戊午 戊午 — no-candidates, Strength unresolved, Climate ready", () => {
    const resolution = buildNeedResolution(
      chart({
        year: { stem: "己", branch: "卯" },
        month: { stem: "丙", branch: "子" },
        day: { stem: "戊", branch: "午" },
        hour: { stem: "戊", branch: "午" },
      }),
    );
    expect(resolution.relationPattern).toBe("no-candidates");
    expect(resolution.status).toBe("indeterminate");
    expect(resolution.strengthAxisStatus).toBe("unresolved");
    expect(resolution.climateAxisStatus).toBe("ready");
    expect(resolution.policyGaps).toEqual([]);
    expect(resolution.decisionBlockedBy).toEqual(["strength-axis-unresolved", "no-active-climate-need"]);
    expect(resolution.supportedElements).toEqual([]);
    expect(resolution.singleAxisElements).toEqual([]);
    forbidden(resolution);
  });

  it("CASE 2 壬寅 己亥 丙子 unknown — no-candidates, both axes unresolved", () => {
    const resolution = buildNeedResolution(
      chart({
        year: { stem: "壬", branch: "寅" },
        month: { stem: "己", branch: "亥" },
        day: { stem: "丙", branch: "子" },
        hour: "unknown",
      }),
    );
    expect(resolution.relationPattern).toBe("no-candidates");
    expect(resolution.status).toBe("indeterminate");
    expect(resolution.policyGaps).toEqual([]);
    expect(resolution.decisionBlockedBy).toEqual(["strength-axis-unresolved", "climate-axis-unresolved"]);
    expect(resolution.strengthAxisStatus).toBe("unresolved");
    expect(resolution.climateAxisStatus).toBe("unresolved");
    forbidden(resolution);
  });

  it("CASE 3 甲寅 甲寅 甲子 unknown — strength-only, moist policy complete", () => {
    const resolution = buildNeedResolution(
      chart({
        year: { stem: "甲", branch: "寅" },
        month: { stem: "甲", branch: "寅" },
        day: { stem: "甲", branch: "子" },
        hour: "unknown",
      }),
    );
    expect(resolution.relationPattern).toBe("strength-only");
    expect(resolution.status).toBe("single-axis");
    expect(resolution.singleAxisElements.map((item) => item.element)).toEqual(["火", "土", "金"]);
    expect(resolution.supportedElements).toEqual([]);
    expect(resolution.policyGaps).toEqual([]);
    expect(resolution.decisionBlockedBy).toEqual(["no-active-climate-need", "strength-three-way-unranked"]);
    forbidden(resolution);
  });

  it("CASE 4 庚子 己未 辛卯 unknown — climate-only, Strength unresolved", () => {
    const resolution = buildNeedResolution(
      chart({
        year: { stem: "庚", branch: "子" },
        month: { stem: "己", branch: "未" },
        day: { stem: "辛", branch: "卯" },
        hour: "unknown",
      }),
    );
    expect(resolution.relationPattern).toBe("climate-only");
    expect(resolution.status).toBe("single-axis");
    expect(resolution.singleAxisElements.map((item) => item.element)).toEqual(["水"]);
    expect(resolution.supportedElements).toEqual([]);
    expect(resolution.strengthAxisStatus).toBe("unresolved");
    expect(resolution.policyGaps).toEqual([]);
    expect(resolution.decisionBlockedBy).toEqual(["strength-axis-unresolved"]);
    forbidden(resolution);
  });

  it("CASE 5 甲酉 庚酉 甲酉 unknown — partial-overlap, Water supported, Wood deferred", () => {
    const resolution = buildNeedResolution(
      chart({
        year: { stem: "甲", branch: "酉" },
        month: { stem: "庚", branch: "酉" },
        day: { stem: "甲", branch: "酉" },
        hour: "unknown",
      }),
    );
    expect(resolution.relationPattern).toBe("partial-overlap");
    expect(resolution.status).toBe("convergent");
    expect(resolution.supportedElements.map((item) => item.element)).toEqual(["水"]);
    expect(resolution.supportedElements[0]?.supports.map((item) => [item.source, item.reasons])).toEqual([
      ["strength", ["strengthen-day-master-resource"]],
      ["climate", ["climate-moisture-dry"]],
    ]);
    expect(resolution.strengthOnlyElements.map((item) => item.element)).toEqual(["木"]);
    expect(resolution.deferredElements.map((item) => item.element)).toEqual(["木"]);
    expect(resolution.singleAxisElements).toEqual([]);
    expect(resolution.decisionBlockedBy).toEqual(["deferred-strength-only-element"]);
    expect(resolution.elementStates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ element: "木", existingPresence: "unrooted-visible" }),
        expect.objectContaining({ element: "水", existingPresence: "absent" }),
      ]),
    );
    forbidden(resolution);
  });

  it("CASE 6 庚申 己丑 乙丑 unknown — disjoint competing, moist policy complete", () => {
    const resolution = buildNeedResolution(
      chart({
        year: { stem: "庚", branch: "申" },
        month: { stem: "己", branch: "丑" },
        day: { stem: "乙", branch: "丑" },
        hour: "unknown",
      }),
    );
    expect(resolution.relationPattern).toBe("disjoint");
    expect(resolution.status).toBe("competing");
    expect(resolution.supportedElements).toEqual([]);
    expect(resolution.competingElementsByAxis.strength.map((item) => item.element)).toEqual(["木", "水"]);
    expect(resolution.competingElementsByAxis.climate.map((item) => item.element)).toEqual(["火"]);
    expect(resolution.policyGaps).toEqual([]);
    expect(resolution.decisionBlockedBy).toEqual(["competing-axes"]);
    forbidden(resolution);
  });

  it("CASE 7 甲辰 丙午 丁酉 庚申 — climate-only with confirmed hour still blocked", () => {
    const resolution = buildNeedResolution(
      chart({
        year: { stem: "甲", branch: "辰" },
        month: { stem: "丙", branch: "午" },
        day: { stem: "丁", branch: "酉" },
        hour: { stem: "庚", branch: "申" },
      }),
    );
    expect(resolution.relationPattern).toBe("climate-only");
    expect(resolution.status).toBe("single-axis");
    expect(resolution.singleAxisElements.map((item) => item.element)).toEqual(["水"]);
    expect(resolution.certainty).toEqual({ strength: "complete", climate: "complete" });
    expect(resolution.decisionBlockedBy).toEqual(["strength-axis-unresolved"]);
    expect(resolution.policyGaps).toEqual([]);
    forbidden(resolution);
  });
});

describe("NeedResolution regression", () => {
  const cases: Array<{
    name: string;
    pillars: { year: Pillar; month: Pillar; day: Pillar; hour: HourPillar };
    relationPattern: NeedResolution["relationPattern"];
    status: NeedResolution["status"];
    strengthAxisStatus: NeedResolution["strengthAxisStatus"];
    climateAxisStatus: NeedResolution["climateAxisStatus"];
    policyGaps: NeedResolution["policyGaps"];
    decisionBlockedBy: NeedResolution["decisionBlockedBy"];
  }> = [
    {
      name: "己卯 丙子 戊午 戊午 — no-candidates Strength unresolved",
      pillars: {
        year: { stem: "己", branch: "卯" },
        month: { stem: "丙", branch: "子" },
        day: { stem: "戊", branch: "午" },
        hour: { stem: "戊", branch: "午" },
      },
      relationPattern: "no-candidates",
      status: "indeterminate",
      strengthAxisStatus: "unresolved",
      climateAxisStatus: "ready",
      policyGaps: [],
      decisionBlockedBy: ["strength-axis-unresolved", "no-active-climate-need"],
    },
    {
      name: "壬寅 己亥 丙子 — no-candidates both unresolved",
      pillars: {
        year: { stem: "壬", branch: "寅" },
        month: { stem: "己", branch: "亥" },
        day: { stem: "丙", branch: "子" },
        hour: "unknown",
      },
      relationPattern: "no-candidates",
      status: "indeterminate",
      strengthAxisStatus: "unresolved",
      climateAxisStatus: "unresolved",
      policyGaps: [],
      decisionBlockedBy: ["strength-axis-unresolved", "climate-axis-unresolved"],
    },
    {
      name: "甲寅 甲寅 甲子 — strength-only moist gap",
      pillars: {
        year: { stem: "甲", branch: "寅" },
        month: { stem: "甲", branch: "寅" },
        day: { stem: "甲", branch: "子" },
        hour: "unknown",
      },
      relationPattern: "strength-only",
      status: "single-axis",
      strengthAxisStatus: "ready",
      climateAxisStatus: "ready",
      policyGaps: [],
      decisionBlockedBy: ["no-active-climate-need", "strength-three-way-unranked"],
    },
    {
      name: "庚子 己未 辛卯 — climate-only",
      pillars: {
        year: { stem: "庚", branch: "子" },
        month: { stem: "己", branch: "未" },
        day: { stem: "辛", branch: "卯" },
        hour: "unknown",
      },
      relationPattern: "climate-only",
      status: "single-axis",
      strengthAxisStatus: "unresolved",
      climateAxisStatus: "ready",
      policyGaps: [],
      decisionBlockedBy: ["strength-axis-unresolved"],
    },
    {
      name: "甲酉 庚酉 甲酉 — partial-overlap",
      pillars: {
        year: { stem: "甲", branch: "酉" },
        month: { stem: "庚", branch: "酉" },
        day: { stem: "甲", branch: "酉" },
        hour: "unknown",
      },
      relationPattern: "partial-overlap",
      status: "convergent",
      strengthAxisStatus: "ready",
      climateAxisStatus: "ready",
      policyGaps: [],
      decisionBlockedBy: ["deferred-strength-only-element"],
    },
    {
      name: "丙午 戊戌 甲申 — partial-overlap unknown hour",
      pillars: {
        year: { stem: "丙", branch: "午" },
        month: { stem: "戊", branch: "戌" },
        day: { stem: "甲", branch: "申" },
        hour: "unknown",
      },
      relationPattern: "partial-overlap",
      status: "convergent",
      strengthAxisStatus: "ready",
      climateAxisStatus: "ready",
      policyGaps: [],
      decisionBlockedBy: ["deferred-strength-only-element"],
    },
    {
      name: "庚申 己丑 乙丑 — disjoint",
      pillars: {
        year: { stem: "庚", branch: "申" },
        month: { stem: "己", branch: "丑" },
        day: { stem: "乙", branch: "丑" },
        hour: "unknown",
      },
      relationPattern: "disjoint",
      status: "competing",
      strengthAxisStatus: "ready",
      climateAxisStatus: "ready",
      policyGaps: [],
      decisionBlockedBy: ["competing-axes"],
    },
    {
      name: "甲辰 丙午 丁酉 庚申 — climate-only confirmed hour",
      pillars: {
        year: { stem: "甲", branch: "辰" },
        month: { stem: "丙", branch: "午" },
        day: { stem: "丁", branch: "酉" },
        hour: { stem: "庚", branch: "申" },
      },
      relationPattern: "climate-only",
      status: "single-axis",
      strengthAxisStatus: "unresolved",
      climateAxisStatus: "ready",
      policyGaps: [],
      decisionBlockedBy: ["strength-axis-unresolved"],
    },
    {
      name: "甲寅 辛亥 庚子 — climate-only unresolved Strength plus moist gap",
      pillars: {
        year: { stem: "甲", branch: "寅" },
        month: { stem: "辛", branch: "亥" },
        day: { stem: "庚", branch: "子" },
        hour: "unknown",
      },
      relationPattern: "climate-only",
      status: "single-axis",
      strengthAxisStatus: "unresolved",
      climateAxisStatus: "ready",
      policyGaps: [],
      decisionBlockedBy: ["strength-axis-unresolved"],
    },
    {
      name: "戊辰 辛酉 庚申 壬午 — climate axis-unresolved confirmed hour",
      pillars: {
        year: { stem: "戊", branch: "辰" },
        month: { stem: "辛", branch: "酉" },
        day: { stem: "庚", branch: "申" },
        hour: { stem: "壬", branch: "午" },
      },
      relationPattern: "no-candidates",
      status: "indeterminate",
      strengthAxisStatus: "unresolved",
      climateAxisStatus: "axis-unresolved",
      policyGaps: [],
      decisionBlockedBy: ["strength-axis-unresolved", "climate-axis-unresolved"],
    },
    {
      name: "庚申 甲寅 乙卯 丙午 — no-candidates confirmed hour",
      pillars: {
        year: { stem: "庚", branch: "申" },
        month: { stem: "甲", branch: "寅" },
        day: { stem: "乙", branch: "卯" },
        hour: { stem: "丙", branch: "午" },
      },
      relationPattern: "no-candidates",
      status: "indeterminate",
      strengthAxisStatus: "unresolved",
      climateAxisStatus: "ready",
      policyGaps: [],
      decisionBlockedBy: ["strength-axis-unresolved", "no-active-climate-need"],
    },
    {
      name: "甲寅 丙寅 丁酉 — Strength null and climate axis-unresolved",
      pillars: {
        year: { stem: "甲", branch: "寅" },
        month: { stem: "丙", branch: "寅" },
        day: { stem: "丁", branch: "酉" },
        hour: "unknown",
      },
      relationPattern: "no-candidates",
      status: "indeterminate",
      strengthAxisStatus: "unresolved",
      climateAxisStatus: "axis-unresolved",
      policyGaps: [],
      decisionBlockedBy: ["strength-axis-unresolved", "climate-axis-unresolved"],
    },
    {
      name: "庚申 戊辰 甲子 — no-candidates moist gap unknown hour",
      pillars: {
        year: { stem: "庚", branch: "申" },
        month: { stem: "戊", branch: "辰" },
        day: { stem: "甲", branch: "子" },
        hour: "unknown",
      },
      relationPattern: "no-candidates",
      status: "indeterminate",
      strengthAxisStatus: "unresolved",
      climateAxisStatus: "ready",
      policyGaps: [],
      decisionBlockedBy: ["strength-axis-unresolved", "no-active-climate-need"],
    },
    {
      name: "庚申 辛酉 丁酉 — disjoint Fire/Wood vs Water",
      pillars: {
        year: { stem: "庚", branch: "申" },
        month: { stem: "辛", branch: "酉" },
        day: { stem: "丁", branch: "酉" },
        hour: "unknown",
      },
      relationPattern: "disjoint",
      status: "competing",
      strengthAxisStatus: "ready",
      climateAxisStatus: "ready",
      policyGaps: [],
      decisionBlockedBy: ["competing-axes"],
    },
  ];

  it("covers at least 14 existing charts", () => {
    expect(cases.length).toBeGreaterThanOrEqual(14);
  });

  it.each(cases)("$name", (item) => {
    const resolution = buildNeedResolution(chart(item.pillars));
    expect(resolution.relationPattern).toBe(item.relationPattern);
    expect(resolution.status).toBe(item.status);
    expect(resolution.strengthAxisStatus).toBe(item.strengthAxisStatus);
    expect(resolution.climateAxisStatus).toBe(item.climateAxisStatus);
    expect(resolution.policyGaps).toEqual(item.policyGaps);
    expect(resolution.decisionBlockedBy).toEqual(item.decisionBlockedBy);
    expect(resolution.policyGaps).not.toContain("moisture-excess-need-unresolved");
    expect(resolution.policyGaps).not.toContain("mixed-strength-resolution");
    expect(resolution.policyGaps).not.toContain("unresolved-strength-direction");
    expect(resolution.decisionBlockedBy).not.toContain("climate-policy-gap-moist");
    expect(resolution.certainty).toEqual(
      expect.objectContaining({
        strength: expect.stringMatching(/^(complete|partial)$/),
        climate: expect.stringMatching(/^(complete|partial)$/),
      }),
    );
    forbidden(resolution);
  });
});

describe("NeedResolution set branches without invented charts", () => {
  it("exact-overlap keeps shared Water in supportedElements without a winner", () => {
    const needSet: NeedCandidateSet = {
      strengthNeedCandidates: [
        candidate({
          element: "水",
          source: "strength",
          direction: "resource",
          reasons: ["strengthen-day-master-resource"],
        }),
      ],
      climateNeedCandidates: [
        candidate({
          element: "水",
          source: "climate",
          reasons: ["climate-moisture-dry"],
        }),
      ],
      strengthNeedStatus: "ready",
      climateNeedStatus: "ready",
      climateCounterSignals: [],
    };
    const resolution = resolveNeedCandidates(
      needSet,
      stubStrength("leaning-weak"),
      stubClimate({ status: "resolved", value: "dry" }),
    );
    expect(resolution.relationPattern).toBe("exact-overlap");
    expect(resolution.status).toBe("convergent");
    expect(resolution.supportedElements.map((item) => item.element)).toEqual(["水"]);
    expect(resolution.deferredElements).toEqual([]);
    expect(resolution.singleAxisElements).toEqual([]);
    forbidden(resolution);
  });

  it("suppressed Strength Fire plus Climate Fire is not active convergence", () => {
    const needSet: NeedCandidateSet = {
      strengthNeedCandidates: [
        candidate({
          element: "火",
          source: "strength",
          direction: "output",
          reasons: ["drain-day-master-output", "already-established-relation"],
          existingPresence: "rooted-visible",
          alreadyPresent: true,
          status: "suppressed",
        }),
      ],
      climateNeedCandidates: [
        candidate({
          element: "火",
          source: "climate",
          reasons: ["climate-temperature-cold"],
          existingPresence: "rooted-visible",
          alreadyPresent: true,
        }),
      ],
      strengthNeedStatus: "ready",
      climateNeedStatus: "ready",
      climateCounterSignals: [],
    };
    const resolution = resolveNeedCandidates(
      needSet,
      stubStrength("leaning-strong"),
      stubClimate({ status: "resolved", value: "balanced" }),
    );
    expect(resolution.relationPattern).toBe("climate-only");
    expect(resolution.status).toBe("single-axis");
    expect(resolution.supportedElements).toEqual([]);
    expect(resolution.suppressedSharedElements).toEqual(["火"]);
    expect(resolution.climateOnlyElements).toEqual([]);
    expect(resolution.counterSignals).toEqual([
      { element: "火", source: "strength", reason: "already-established-relation" },
    ]);
    forbidden(resolution);
  });
});
