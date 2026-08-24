import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ELEMENTS } from "@/lib/saju/types";
import type { BirthInput, FourPillars, HourPillar, Pillar } from "@/lib/saju/types";
import {
  VALIDATION_KIND_SCOPES,
  buildSajuValidationReport,
  buildSajuValidationReportFromPillars,
  emptyExpertReview,
  emptyValidationComparison,
} from "@/lib/saju/validation";
import type { SajuValidationReport } from "@/lib/saju/validation";

type FixturePillars = {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  hour: HourPillar;
};

type NamedChart = {
  id: string;
  pillars: FixturePillars;
};

const axisSamples = JSON.parse(
  readFileSync(path.join(__dirname, "axisReview.fixtures.json"), "utf8"),
).samples as NamedChart[];

const conflictFixtures = JSON.parse(
  readFileSync(path.join(__dirname, "conflictType.fixtures.json"), "utf8"),
) as { typeC: NamedChart[]; typeI: NamedChart[] };

const blindCases = JSON.parse(
  readFileSync(path.join(__dirname, "../validation/blind.cases.json"), "utf8"),
) as { cases: unknown[]; caseTemplate: { expertReview: Record<string, unknown> } };

const calculationCases = JSON.parse(
  readFileSync(path.join(__dirname, "../validation/calculation/cases.json"), "utf8"),
) as { set: string; cases: unknown[] };

const ruleTableCases = JSON.parse(
  readFileSync(path.join(__dirname, "../validation/rule-table/cases.json"), "utf8"),
) as { set: string; cases: unknown[]; tableFiles: string[] };

const interpretiveCases = JSON.parse(
  readFileSync(path.join(__dirname, "../validation/interpretive/cases.json"), "utf8"),
) as { set: string; cases: unknown[]; caseTemplate: { expertReview: Record<string, unknown> } };

const coverageCriteria = JSON.parse(
  readFileSync(path.join(__dirname, "../validation/coverage.criteria.json"), "utf8"),
) as { interpretiveTargetSize: number; notIncluded: string[] };

const FORBIDDEN_KEYS = [
  "neededElement",
  "finalElement",
  "winner",
  "score",
  "rank",
  "priority",
  "yongsin",
  "heesin",
];

const DISJOINT_CHARTS: NamedChart[] = [
  {
    id: "disjoint-eulchuk",
    pillars: {
      year: { stem: "庚", branch: "申" },
      month: { stem: "己", branch: "丑" },
      day: { stem: "乙", branch: "丑" },
      hour: "unknown",
    },
  },
  {
    id: "disjoint-jeongyu",
    pillars: {
      year: { stem: "庚", branch: "申" },
      month: { stem: "辛", branch: "酉" },
      day: { stem: "丁", branch: "酉" },
      hour: "unknown",
    },
  },
];

function chart(partial: FixturePillars): FourPillars {
  return {
    ...partial,
    hourCertainty: partial.hour === "unknown" ? "unknown" : "confirmed",
    warnings: [],
  };
}

function solarInput(
  year: number,
  month: number,
  day: number,
  time: BirthInput["time"],
  extra: Partial<BirthInput> = {},
): BirthInput {
  return {
    calendar: "solar",
    year,
    month,
    day,
    isLeapMonth: false,
    time,
    ...extra,
  };
}

function collectKeys(value: unknown, acc = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, acc);
    return acc;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      acc.add(key);
      collectKeys(nested, acc);
    }
  }
  return acc;
}

function assertCoreSections(report: SajuValidationReport) {
  expect(report.pillars.year.ganzhi).toBe(`${report.pillars.year.stem}${report.pillars.year.branch}`);
  expect(report.pillars.year.ganzhiKo).toEqual(expect.any(String));
  expect(report.pillars.month.ganzhi).toBe(`${report.pillars.month.stem}${report.pillars.month.branch}`);
  expect(report.pillars.day.ganzhi).toBe(`${report.pillars.day.stem}${report.pillars.day.branch}`);
  expect(report.elementMaterials.items.length).toBeGreaterThan(0);
  expect(report.seasonEvidence.dayStem).toBe(report.pillars.day.stem);
  expect(report.seasonEvidence.monthBranch).toBe(report.pillars.month.branch);
  expect(["왕", "상", "휴", "수", "사"]).toContain(report.seasonEvidence.phase);
  expect(["clear", "present", "shallow", "absent"]).toContain(report.rootEvidence.rootQuality);
  for (const element of ELEMENTS) {
    expect(["rooted-visible", "unrooted-visible", "hidden-only", "absent"]).toContain(
      report.presence[element].presence,
    );
  }
  expect(Array.isArray(report.visibleRelations.support)).toBe(true);
  expect(Array.isArray(report.visibleRelations.pressure)).toBe(true);
  expect(Array.isArray(report.hiddenRelations)).toBe(true);
  expect(report.strengthSummary).toEqual(
    expect.objectContaining({
      certainty: expect.any(String),
      resolution: expect.any(String),
      seasonalPhase: expect.any(String),
      rootQuality: expect.any(String),
      mixedPattern: report.strengthSummary.mixedPattern,
      mixedConflictLevel: report.strengthSummary.mixedConflictLevel,
      unresolvedStrengthReasons: expect.any(Array),
      strongSideEvidence: expect.any(Array),
      weakSideEvidence: expect.any(Array),
      hiddenSupportNotes: expect.any(Array),
      hiddenPressureNotes: expect.any(Array),
      conflicts: expect.any(Array),
      unresolvedReasons: expect.any(Array),
      omittedSlots: expect.any(Array),
    }),
  );
  expect(report.climateEvidence).toEqual(
    expect.objectContaining({
      monthBranch: report.pillars.month.branch,
      baseClimate: expect.objectContaining({
        temperature: expect.any(String),
        moisture: expect.any(String),
      }),
      factors: expect.any(Array),
      fireQualityMaterials: expect.any(Array),
      waterQualityMaterials: expect.any(Array),
      hourUnknown: expect.any(Boolean),
      includedSlots: expect.any(Array),
      omittedSlots: expect.any(Array),
    }),
  );
  expect(report.adjustedClimate).toEqual(
    expect.objectContaining({
      certainty: expect.any(String),
      baseClimate: report.climateEvidence.baseClimate,
      fireQuality: expect.any(String),
      waterQuality: expect.any(String),
      temperature: expect.any(Object),
      moisture: expect.any(Object),
      mitigationFactors: expect.any(Array),
      reinforcementFactors: expect.any(Array),
      conflicts: expect.any(Array),
      unresolvedReasons: expect.any(Array),
    }),
  );
  expect(report.needCandidates).toEqual(
    expect.objectContaining({
      strengthNeedCandidates: expect.any(Array),
      climateNeedCandidates: expect.any(Array),
      climateCounterSignals: expect.any(Array),
    }),
  );
  expect(report.needResolution).toEqual(
    expect.objectContaining({
      relationPattern: expect.any(String),
      status: expect.any(String),
      supportedElements: expect.any(Array),
      singleAxisElements: expect.any(Array),
      strengthOnlyElements: expect.any(Array),
      climateOnlyElements: expect.any(Array),
      deferredElements: expect.any(Array),
      competingElementsByAxis: expect.any(Object),
      suppressedSharedElements: expect.any(Array),
      counterSignals: expect.any(Array),
      elementStates: expect.any(Array),
      strengthAxisStatus: expect.any(String),
      climateAxisStatus: expect.any(String),
      certainty: expect.any(Object),
      policyGaps: expect.any(Array),
      decisionBlockedBy: expect.any(Array),
      reasons: expect.any(Array),
    }),
  );
  expect(report.validationStatus.fourPillarsComputed).toBe(true);
  expect(report.validationStatus.relationPattern).toBe(report.needResolution.relationPattern);
  expect(report.validationStatus.finalDecisionBlocked).toBe(report.needResolution.decisionBlockedBy.length > 0);
  expect(report).not.toHaveProperty("validationLevel");
  expect(JSON.parse(JSON.stringify(report))).toEqual(JSON.parse(JSON.stringify(report)));
  const keys = collectKeys(report);
  for (const key of FORBIDDEN_KEYS) {
    expect(keys.has(key)).toBe(false);
  }
}

const reviewCharts: NamedChart[] = [
  ...axisSamples,
  ...conflictFixtures.typeC,
  ...conflictFixtures.typeI,
  ...DISJOINT_CHARTS,
];

describe("SajuValidationReport 기존 검토 명식", () => {
  it("covers 16 + C1/C2 + I1/I2 + disjoint 2 = 22 charts", () => {
    expect(axisSamples).toHaveLength(16);
    expect(conflictFixtures.typeC).toHaveLength(2);
    expect(conflictFixtures.typeI).toHaveLength(2);
    expect(DISJOINT_CHARTS).toHaveLength(2);
    expect(reviewCharts).toHaveLength(22);
  });

  it.each(reviewCharts)("$id generates a complete validation report", (sample) => {
    const report = buildSajuValidationReportFromPillars(chart(sample.pillars));
    assertCoreSections(report);
    expect(report.input).toBeNull();
    expect(report.normalizedInput).toBeNull();
    expect(report.solarTermContext).toBeNull();
    expect(report.dayPillarContext).toBeNull();
  });
});

describe("시간 확정 / 시간 미상", () => {
  it("confirmed hour keeps hour evidence and does not auto-pick candidates", () => {
    const sample = axisSamples.find((item) => item.id === "s1-gimo-bingja-muo");
    if (!sample) throw new Error("s1 missing");
    const report = buildSajuValidationReportFromPillars(chart(sample.pillars));
    expect(report.pillars.hour).toEqual(expect.objectContaining({ known: true, stem: "戊", branch: "午" }));
    expect(report.pillars.hourCertainty).toBe("confirmed");
    expect(report.hourPillarContext).toEqual(
      expect.objectContaining({
        known: true,
        appliedHour: null,
        hourBranch: "午",
        dayStem: "戊",
        method: "오자시법",
      }),
    );
    expect(report.strengthSummary.omittedSlots).toEqual([]);
    expect(report.climateEvidence.omittedSlots).toEqual([]);
    expect(report.climateEvidence.includedSlots).toContain("hour");
    expect(report.elementMaterials.hourUnknown).toBe(false);
    expect(report.strengthSummary.certainty).toBe("complete");
  });

  it("unknown hour stays unknown and does not invent a candidate hour", () => {
    const sample = axisSamples.find((item) => item.id === "s2-gap-in-unknown-hour");
    if (!sample) throw new Error("s2 missing");
    const report = buildSajuValidationReportFromPillars(chart(sample.pillars));
    expect(report.pillars.hour).toEqual({ known: false, hour: "unknown" });
    expect(report.pillars.hourCertainty).toBe("unknown");
    expect(report.hourPillarContext).toEqual({
      known: false,
      hour: "unknown",
      hourCandidatesAutoSelected: false,
    });
    expect(report.rootEvidence.hits.every((hit) => hit.slot !== "hour")).toBe(true);
    expect(report.hiddenRelations.every((item) => item.slot !== "hour")).toBe(true);
    expect(report.visibleRelations.support.every((item) => item.slot !== "hour")).toBe(true);
    expect(report.visibleRelations.pressure.every((item) => item.slot !== "hour")).toBe(true);
    expect(report.strengthSummary.omittedSlots).toEqual(["hour"]);
    expect(report.climateEvidence.omittedSlots).toEqual(["hour"]);
    expect(report.strengthSummary.certainty).toBe("partial");
    expect(report.adjustedClimate.certainty).toBe("partial");
    expect(report.elementMaterials.hourUnknown).toBe(true);
    expect(report.warnings).toContain("시간 미상: 시주를 후보로 채우지 않음");
  });
});

describe("BirthInput 경로 만세력 근거", () => {
  it("records input separately from normalized values for 2000-01-01 12:00", () => {
    const report = buildSajuValidationReport(solarInput(2000, 1, 1, { hour: 12, minute: 0 }));
    assertCoreSections(report);
    expect(report.input).toEqual({
      calendarType: "solar",
      year: 2000,
      month: 1,
      day: 1,
      hour: 12,
      minute: 0,
      timeUnknown: false,
      dayBoundary: null,
      timezone: null,
      leapMonth: false,
    });
    expect(report.normalizedInput).toEqual({
      solarDate: { year: 2000, month: 1, day: 1 },
      effectiveHour: { hour: 12, minute: 0 },
      hourKnown: true,
      appliedDayBoundary: "night_ja",
      appliedTimezone: "Asia/Seoul",
    });
    expect(report.pillars.day).toEqual(expect.objectContaining({ stem: "戊", branch: "午", ganzhi: "戊午" }));
    expect(report.pillars.hour).toEqual(expect.objectContaining({ known: true, stem: "戊", branch: "午" }));
    expect(report.solarTermContext).toEqual(
      expect.objectContaining({
        lichun: expect.any(Object),
        lichunRelation: "before",
        currentJie: expect.objectContaining({ name: expect.any(String), monthBranch: "子" }),
        previousJie: expect.objectContaining({ name: expect.any(String) }),
        nextJie: expect.objectContaining({ name: expect.any(String) }),
        monthBranchBasis: expect.stringContaining("절입"),
        monthStemBasis: expect.stringContaining("인월간"),
      }),
    );
    expect(report.dayPillarContext).toEqual(
      expect.objectContaining({
        epochDate: { year: 2000, month: 1, day: 1 },
        epochGanzhi: "戊午",
        epochGanzhiIndex: 54,
        civilDayOffset: 0,
        dayBoundary: "night_ja",
        inputCivilDate: { year: 2000, month: 1, day: 1 },
        dateUsedForDayPillar: { year: 2000, month: 1, day: 1 },
        inputDateDiffersFromDayPillarDate: false,
      }),
    );
    expect(report.hourPillarContext).toEqual(
      expect.objectContaining({
        known: true,
        appliedHour: 12,
        hourBranch: "午",
        dayStem: "戊",
        method: "오자시법",
      }),
    );
    expect(report.warnings.some((item) => item.includes("진태양시는 반영하지 않음"))).toBe(true);
  });

  it("23:00 night_ja uses the next civil day for the day pillar", () => {
    const report = buildSajuValidationReport(solarInput(2000, 1, 1, { hour: 23, minute: 0 }));
    expect(report.input?.hour).toBe(23);
    expect(report.normalizedInput?.effectiveHour).toEqual({ hour: 23, minute: 0 });
    expect(report.dayPillarContext?.inputCivilDate).toEqual({ year: 2000, month: 1, day: 1 });
    expect(report.dayPillarContext?.dateUsedForDayPillar).toEqual({ year: 2000, month: 1, day: 2 });
    expect(report.dayPillarContext?.inputDateDiffersFromDayPillarDate).toBe(true);
    expect(report.dayPillarContext?.civilDayOffset).toBe(1);
    expect(report.pillars.day.ganzhi).not.toBe("戊午");
  });

  it("unknown birth time keeps hour unknown and does not roll the day pillar", () => {
    const report = buildSajuValidationReport(solarInput(2000, 1, 1, "unknown"));
    assertCoreSections(report);
    expect(report.input?.timeUnknown).toBe(true);
    expect(report.input?.hour).toBeNull();
    expect(report.normalizedInput?.effectiveHour).toBeNull();
    expect(report.normalizedInput?.hourKnown).toBe(false);
    expect(report.pillars.hour).toEqual({ known: false, hour: "unknown" });
    expect(report.hourPillarContext).toEqual({
      known: false,
      hour: "unknown",
      hourCandidatesAutoSelected: false,
    });
    expect(report.dayPillarContext?.inputDateDiffersFromDayPillarDate).toBe(false);
    expect(report.strengthSummary.omittedSlots).toEqual(["hour"]);
    expect(report.strengthSummary.certainty).toBe("partial");
    expect(report.warnings).toEqual(
      expect.arrayContaining([
        "시간 미상: 시주를 후보로 채우지 않음",
        "23시 이후 출생이면 일주가 달라질 수 있습니다.",
      ]),
    );
  });

  it("collects an existing DST-year warning without claiming true solar time", () => {
    const report = buildSajuValidationReport(solarInput(1988, 9, 17, { hour: 12, minute: 0 }));
    expect(report.warnings).toEqual(
      expect.arrayContaining(["이 해는 한국 서머타임이 있어, 벽시계와 표준시가 다를 수 있습니다."]),
    );
    expect(report.warnings.every((item) => !item.includes("진태양시를 반영함"))).toBe(true);
  });
});

describe("hidden/root overlap is marked, not dropped", () => {
  it("keeps hidden items that share a root sourceKey", () => {
    const sample = axisSamples.find((item) => item.id === "s1-gimo-bingja-muo");
    if (!sample) throw new Error("s1 missing");
    const report = buildSajuValidationReportFromPillars(chart(sample.pillars));
    const overlapping = report.hiddenRelations.filter((item) => item.overlapsRoot);
    expect(overlapping.length).toBeGreaterThan(0);
    expect(report.hiddenRelations.length).toBeGreaterThanOrEqual(overlapping.length);
    for (const item of overlapping) {
      expect(report.rootEvidence.hits.some((hit) => hit.sourceKey === item.sourceKey)).toBe(true);
      expect(item.elementPresence).toBe(item.presence);
    }
  });
});

describe("블라인드 검증 구조", () => {
  it("keeps interpretive empty and rule-table expected in independent table files", () => {
    expect(axisSamples.length).toBe(16);
    expect(calculationCases.set).toBe("calculation");
    expect(ruleTableCases.set).toBe("rule-table");
    expect(interpretiveCases.set).toBe("interpretive");
    expect(calculationCases.cases.length).toBeGreaterThanOrEqual(30);
    expect(ruleTableCases.tableFiles.length).toBeGreaterThan(0);
    expect(ruleTableCases.cases).toEqual([]);
    expect(interpretiveCases.cases).toEqual([]);
    expect(blindCases.cases).toEqual([]);
  });

  it("keeps the expert review template empty of engine fields", () => {
    const template = blindCases.caseTemplate.expertReview;
    expect(template.reviewerId).toBeNull();
    expect(template.strengthAssessment).toBeNull();
    expect(template.climateAssessment).toBeNull();
    expect(template.candidateElements).toEqual([]);
    expect(template).not.toHaveProperty("strengthDirection");
    expect(template).not.toHaveProperty("neededElement");
    expect(template).not.toHaveProperty("yongsin");
    expect(interpretiveCases.caseTemplate.expertReview).not.toHaveProperty("mixedPattern");
  });

  it("does not copy engine output into expertReview", () => {
    const report = buildSajuValidationReport(solarInput(2000, 1, 1, { hour: 12, minute: 0 }));
    const expert = emptyExpertReview();
    expect(expert).toEqual({
      reviewerId: null,
      reviewDate: null,
      fourPillarsConfirmed: null,
      dayMaster: null,
      monthCommand: null,
      rootAssessment: null,
      strengthAssessment: null,
      climateAssessment: null,
      candidateElements: [],
      cannotDetermine: false,
      reasons: [],
      comments: "",
      reviewConfidence: null,
    });
    expect(expert.strengthAssessment).toBeNull();
    expect(expert.strengthAssessment).not.toBe(String(report.strengthSummary.directionCandidate));
    const comparison = emptyValidationComparison("case-001");
    expect(comparison.expert).toEqual(expert);
    expect(comparison.engine.strengthDirection).toBeNull();
    expect(comparison.items).toEqual([]);
    expect(comparison.matches).toEqual([]);
    expect(comparison.notes.some((note) => note.includes("엔진 결과를 expertReview에 복사하지 않음"))).toBe(true);
  });

  it("keeps calendar, rule-table, and interpretive validation kinds separate", () => {
    expect(Object.keys(VALIDATION_KIND_SCOPES)).toEqual([
      "astronomical-calendar",
      "rule-table",
      "interpretive",
    ]);
    expect(VALIDATION_KIND_SCOPES["astronomical-calendar"]).not.toEqual(VALIDATION_KIND_SCOPES.interpretive);
    expect(coverageCriteria.interpretiveTargetSize).toBe(30);
    expect(coverageCriteria.notIncluded).toEqual(
      expect.arrayContaining(["accuracyPercent", "neededElement", "engineCopiedExpected"]),
    );
  });
});
