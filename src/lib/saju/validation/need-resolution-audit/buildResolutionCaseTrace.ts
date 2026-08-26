import { buildNeedResolution, resolveNeedCandidates } from "@/lib/saju/elements/needResolution";
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

type SamplePillars = {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  hour: HourPillar;
};

function chart(partial: SamplePillars): FourPillars {
  return {
    ...partial,
    hourCertainty: partial.hour === "unknown" ? "unknown" : "confirmed",
    warnings: [],
  };
}

function candidateRows(candidates: NeedCandidate[]) {
  return candidates.map((item) => ({
    element: item.element,
    source: item.source,
    direction: item.direction,
    reasons: item.reasons,
    status: item.status,
    existingPresence: item.existingPresence,
    alreadyPresent: item.alreadyPresent,
  }));
}

function supportedRows(resolution: NeedResolution) {
  return resolution.supportedElements.map((item) => ({
    element: item.element,
    supportSources: item.supports.map((support) => support.source),
    supportReasons: item.supports.map((support) => support.reasons),
  }));
}

function inferTriggeredRules(resolution: NeedResolution): string[] {
  const ids = new Set<string>(["RES-001", "RES-002", "RES-003", "RES-004", "RES-005", "RES-046", "RES-047"]);

  const patternRule: Record<NeedResolution["relationPattern"], string> = {
    "no-candidates": "RES-006",
    "strength-only": "RES-007",
    "climate-only": "RES-008",
    "exact-overlap": "RES-009",
    "partial-overlap": "RES-010",
    disjoint: "RES-011",
  };
  ids.add(patternRule[resolution.relationPattern]);

  const statusRule: Record<NeedResolution["status"], string> = {
    indeterminate: "RES-012",
    "single-axis": "RES-013",
    convergent: "RES-014",
    competing: "RES-015",
  };
  ids.add(statusRule[resolution.status]);
  ids.add("RES-016");

  if (resolution.supportedElements.length > 0) {
    ids.add("RES-017");
    ids.add("RES-018");
    ids.add("RES-019");
  } else {
    ids.add("RES-020");
  }

  if (resolution.relationPattern === "partial-overlap") ids.add("RES-021");
  if (resolution.deferredElements.length > 0) ids.add("RES-022");
  if (resolution.relationPattern === "strength-only" || resolution.relationPattern === "climate-only") {
    ids.add("RES-023");
  }
  if (resolution.status === "competing") ids.add("RES-024");
  if (resolution.suppressedSharedElements.length > 0) {
    ids.add("RES-025");
    ids.add("RES-026");
    ids.add("RES-027");
  }
  if (resolution.counterSignals.length > 0) ids.add("RES-028");
  ids.add("RES-029");
  ids.add("RES-030");
  ids.add("RES-031");

  for (const blocker of resolution.decisionBlockedBy) {
    const blockerRule: Record<string, string> = {
      "strength-axis-unresolved": "RES-032",
      "climate-axis-unresolved": "RES-033",
      "no-active-climate-need": "RES-034",
      "deferred-strength-only-element": "RES-035",
      "competing-axes": "RES-036",
      "strength-three-way-unranked": "RES-037",
    };
    if (blockerRule[blocker]) ids.add(blockerRule[blocker]);
  }

  ids.add("RES-038");
  ids.add("RES-039");
  ids.add("RES-040");
  ids.add("RES-041");
  ids.add("RES-042");
  ids.add("RES-043");
  ids.add("RES-044");
  ids.add("RES-045");
  if (resolution.certainty.strength === "partial" || resolution.certainty.climate === "partial") ids.add("RES-048");
  if (resolution.climateOnlyElements.length === 0 && resolution.relationPattern === "climate-only") ids.add("RES-049");
  return [...ids].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export type ResolutionCaseTrace = {
  caseId: string;
  group: string;
  covers: string[];
  note: string;
  source: "existing-chart" | "injected-needSet";
  pillars?: SamplePillars;
  strengthCandidates: ReturnType<typeof candidateRows>;
  climateCandidates: ReturnType<typeof candidateRows>;
  relationPattern: NeedResolution["relationPattern"];
  status: NeedResolution["status"];
  supportedElements: ReturnType<typeof supportedRows>;
  singleAxisElements: ReturnType<typeof candidateRows>;
  deferredElements: ReturnType<typeof candidateRows>;
  competingElementsByAxis: {
    strength: ReturnType<typeof candidateRows>;
    climate: ReturnType<typeof candidateRows>;
  };
  suppressedSharedElements: NeedResolution["suppressedSharedElements"];
  axisStatus: {
    strength: NeedResolution["strengthAxisStatus"];
    climate: NeedResolution["climateAxisStatus"];
  };
  certainty: NeedResolution["certainty"];
  policyGaps: NeedResolution["policyGaps"];
  decisionBlockedBy: NeedResolution["decisionBlockedBy"];
  counterSignals: NeedResolution["counterSignals"];
  elementStates: NeedResolution["elementStates"];
  originalCandidateCounts: {
    strength: number;
    climate: number;
  };
  triggeredRules: string[];
  notes: string;
};

function fromResolution(
  input: Omit<ResolutionCaseTrace, keyof ReturnType<typeof packResolution> | "triggeredRules">,
  resolution: NeedResolution,
): ResolutionCaseTrace {
  const packed = packResolution(resolution);
  return {
    ...input,
    ...packed,
    triggeredRules: inferTriggeredRules(resolution),
    notes: input.note,
  };
}

function packResolution(resolution: NeedResolution) {
  return {
    strengthCandidates: candidateRows(resolution.originalStrengthCandidates),
    climateCandidates: candidateRows(resolution.originalClimateCandidates),
    relationPattern: resolution.relationPattern,
    status: resolution.status,
    supportedElements: supportedRows(resolution),
    singleAxisElements: candidateRows(resolution.singleAxisElements),
    deferredElements: candidateRows(resolution.deferredElements),
    competingElementsByAxis: {
      strength: candidateRows(resolution.competingElementsByAxis.strength),
      climate: candidateRows(resolution.competingElementsByAxis.climate),
    },
    suppressedSharedElements: resolution.suppressedSharedElements,
    axisStatus: {
      strength: resolution.strengthAxisStatus,
      climate: resolution.climateAxisStatus,
    },
    certainty: resolution.certainty,
    policyGaps: resolution.policyGaps,
    decisionBlockedBy: resolution.decisionBlockedBy,
    counterSignals: resolution.counterSignals,
    elementStates: resolution.elementStates,
    originalCandidateCounts: {
      strength: resolution.originalStrengthCandidates.length,
      climate: resolution.originalClimateCandidates.length,
    },
  };
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
    boundary: null,
    ...partial,
  };
}

function stubStrength(directionCandidate: StrengthSummary["directionCandidate"]): StrengthSummary {
  return { certainty: "partial", directionCandidate } as StrengthSummary;
}

function stubClimate(moisture: AdjustedClimateSummary["moisture"]): AdjustedClimateSummary {
  return { certainty: "partial", moisture } as AdjustedClimateSummary;
}

export function collectResolutionCaseTraces(): ResolutionCaseTrace[] {
  const charts: Array<{
    id: string;
    group: string;
    covers: string[];
    note: string;
    pillars: SamplePillars;
  }> = [
    {
      id: "res-case-1-no-candidates",
      group: "needResolution-test",
      covers: ["no-candidates", "hour-confirmed"],
      note: "己卯 丙子 戊午 戊午. no-candidates. Strength unresolved, Climate ready empty.",
      pillars: {
        year: { stem: "己", branch: "卯" },
        month: { stem: "丙", branch: "子" },
        day: { stem: "戊", branch: "午" },
        hour: { stem: "戊", branch: "午" },
      },
    },
    {
      id: "res-case-2-both-unresolved",
      group: "needResolution-test",
      covers: ["no-candidates", "both-unresolved", "hour-unknown"],
      note: "壬寅 己亥 丙子 unknown. 양쪽 unresolved + no-candidates.",
      pillars: {
        year: { stem: "壬", branch: "寅" },
        month: { stem: "己", branch: "亥" },
        day: { stem: "丙", branch: "子" },
        hour: "unknown",
      },
    },
    {
      id: "res-case-3-strength-only",
      group: "needResolution-test",
      covers: ["strength-only", "hour-unknown"],
      note: "甲寅 甲寅 甲子 unknown. strength-only 火土金. three-way unranked.",
      pillars: {
        year: { stem: "甲", branch: "寅" },
        month: { stem: "甲", branch: "寅" },
        day: { stem: "甲", branch: "子" },
        hour: "unknown",
      },
    },
    {
      id: "res-case-4-climate-only",
      group: "needResolution-test",
      covers: ["climate-only", "strength-unresolved-plus-climate", "hour-unknown"],
      note: "庚子 己未 辛卯 unknown. climate-only 水. Strength unresolved.",
      pillars: {
        year: { stem: "庚", branch: "子" },
        month: { stem: "己", branch: "未" },
        day: { stem: "辛", branch: "卯" },
        hour: "unknown",
      },
    },
    {
      id: "res-case-5-partial-overlap",
      group: "needResolution-test",
      covers: ["partial-overlap", "hour-unknown"],
      note: "甲酉 庚酉 甲酉 unknown. supported 水, deferred 木.",
      pillars: {
        year: { stem: "甲", branch: "酉" },
        month: { stem: "庚", branch: "酉" },
        day: { stem: "甲", branch: "酉" },
        hour: "unknown",
      },
    },
    {
      id: "res-case-6-disjoint",
      group: "needResolution-test",
      covers: ["disjoint", "hour-unknown"],
      note: "庚申 己丑 乙丑 unknown. Strength 木水 vs Climate 火.",
      pillars: {
        year: { stem: "庚", branch: "申" },
        month: { stem: "己", branch: "丑" },
        day: { stem: "乙", branch: "丑" },
        hour: "unknown",
      },
    },
    {
      id: "res-case-7-hour-confirmed-climate-only",
      group: "needResolution-test",
      covers: ["climate-only", "hour-confirmed", "strength-unresolved-plus-climate"],
      note: "甲辰 丙午 丁酉 庚申. hour confirmed. climate-only still blocked.",
      pillars: {
        year: { stem: "甲", branch: "辰" },
        month: { stem: "丙", branch: "午" },
        day: { stem: "丁", branch: "酉" },
        hour: { stem: "庚", branch: "申" },
      },
    },
    {
      id: "res-case-8-strength-unresolved-climate-cold",
      group: "needResolution-regression",
      covers: ["climate-only", "strength-unresolved-plus-climate", "hour-unknown"],
      note: "甲寅 辛亥 庚子 unknown. Strength null + Climate 火.",
      pillars: {
        year: { stem: "甲", branch: "寅" },
        month: { stem: "辛", branch: "亥" },
        day: { stem: "庚", branch: "子" },
        hour: "unknown",
      },
    },
    {
      id: "res-case-9-climate-axis-unresolved",
      group: "needResolution-regression",
      covers: ["climate-axis-unresolved", "no-candidates", "hour-confirmed"],
      note: "戊辰 辛酉 庚申 壬午. Climate axis-unresolved. hour confirmed.",
      pillars: {
        year: { stem: "戊", branch: "辰" },
        month: { stem: "辛", branch: "酉" },
        day: { stem: "庚", branch: "申" },
        hour: { stem: "壬", branch: "午" },
      },
    },
  ];

  const chartTraces = charts.map((item) => {
    const four = chart(item.pillars);
    const resolution = buildNeedResolution(four);
    return fromResolution(
      {
        caseId: item.id,
        group: item.group,
        covers: item.covers,
        note: item.note,
        source: "existing-chart",
        pillars: item.pillars,
      },
      resolution,
    );
  });

  const exactSet: NeedCandidateSet = {
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

  const suppressedSet: NeedCandidateSet = {
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

  const injected = [
    fromResolution(
      {
        caseId: "res-case-10-exact-overlap-injected",
        group: "needResolution-injected",
        covers: ["exact-overlap"],
        note: "주입 단위 테스트. 기존 만세력 fixture 없음. exact-overlap 水. winner 없음.",
        source: "injected-needSet",
      },
      resolveNeedCandidates(exactSet, stubStrength("leaning-weak"), stubClimate({ status: "resolved", value: "dry", outcome: "unchanged" })),
    ),
    fromResolution(
      {
        caseId: "res-case-11-suppressed-shared-injected",
        group: "needResolution-injected",
        covers: ["suppressedShared"],
        note: "주입 단위 테스트. 기존 만세력 fixture 없음. Strength suppressed 火 ∩ Climate 火.",
        source: "injected-needSet",
      },
      resolveNeedCandidates(
        suppressedSet,
        stubStrength("leaning-strong"),
        stubClimate({ status: "resolved", value: "balanced", outcome: "unchanged" }),
      ),
    ),
  ];

  return [...chartTraces, ...injected];
}
