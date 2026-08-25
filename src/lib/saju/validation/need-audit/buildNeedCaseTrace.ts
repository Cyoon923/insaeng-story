import { readFileSync } from "node:fs";
import path from "node:path";
import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { buildNeedCandidateSet, collectLeaningStrongNeedCandidates } from "@/lib/saju/elements/needCandidates";
import { buildStrengthSummary } from "@/lib/saju/elements/strengthSummary";
import type {
  AdjustedClimateSummary,
  FourPillars,
  HourPillar,
  NeedCandidate,
  NeedCandidateSet,
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
    certainty: item.certainty,
    evidenceRefs: item.evidenceRefs,
  }));
}

function inferTriggeredRules(input: {
  strength: StrengthSummary;
  climate: AdjustedClimateSummary;
  need: NeedCandidateSet;
  independentLeaningStrong?: NeedCandidate[];
}): string[] {
  const ids = new Set<string>([
    "NEED-001",
    "NEED-002",
    "NEED-003",
    "NEED-004",
    "NEED-005",
    "NEED-007",
    "NEED-041",
  ]);

  if (input.strength.mixedPattern != null || input.strength.unresolvedStrengthReasons.length > 0) {
    ids.add("NEED-006");
  }

  ids.add("NEED-008");

  if (input.need.strengthNeedCandidates.length > 0) ids.add("NEED-009");
  if (input.strength.directionCandidate === "leaning-strong") ids.add("NEED-010");
  if (input.strength.directionCandidate === "leaning-weak") ids.add("NEED-011");
  if (input.strength.directionCandidate === "mixed") {
    ids.add("NEED-012");
    ids.add("NEED-014");
  }
  if (input.strength.directionCandidate === null) ids.add("NEED-013");

  if (input.need.strengthNeedCandidates.some((item) => item.status === "suppressed")) {
    ids.add("NEED-015");
    ids.add("NEED-016");
  }
  if (input.strength.directionCandidate === "leaning-weak") ids.add("NEED-017");
  if (input.independentLeaningStrong?.some((item) => item.status === "suppressed")) {
    ids.add("NEED-015");
    ids.add("NEED-016");
    ids.add("NEED-018");
  }

  ids.add("NEED-019");

  for (const candidate of input.need.climateNeedCandidates) {
    if (candidate.reasons.includes("climate-temperature-cold")) ids.add("NEED-020");
    if (candidate.reasons.includes("climate-temperature-warm")) ids.add("NEED-021");
    if (candidate.reasons.includes("climate-moisture-dry")) ids.add("NEED-022");
    if (candidate.reasons.length > 1) ids.add("NEED-026");
    if (candidate.status === "candidate") ids.add("NEED-028");
    if (candidate.direction === "climate") ids.add("NEED-045");
  }

  if (input.climate.moisture.status === "resolved" && input.climate.moisture.value === "moist") ids.add("NEED-023");
  if (input.climate.temperature.status === "resolved" && input.climate.temperature.value === "balanced") ids.add("NEED-024");
  if (input.climate.moisture.status === "resolved" && input.climate.moisture.value === "balanced") ids.add("NEED-024");
  if (input.need.climateNeedStatus === "unresolved" || input.need.climateNeedStatus === "axis-unresolved") {
    ids.add("NEED-025");
  }

  ids.add("NEED-027");
  ids.add("NEED-042");
  ids.add("NEED-054");

  if (input.need.climateNeedCandidates.length > 0) {
    ids.add("NEED-029");
    ids.add("NEED-044");
  }
  if (input.need.strengthNeedCandidates.length > 0) {
    ids.add("NEED-030");
    ids.add("NEED-032");
    ids.add("NEED-033");
    ids.add("NEED-043");
    ids.add("NEED-048");
  }
  if (input.strength.certainty === "partial" || input.climate.certainty === "partial") ids.add("NEED-031");
  if (input.need.strengthNeedCandidates.some((item) => item.certainty === "partial")) ids.add("NEED-053");
  if (input.need.climateNeedCandidates.some((item) => item.certainty === "partial")) ids.add("NEED-053");

  if (input.need.climateNeedCandidates.length === 0 && input.need.climateNeedStatus === "ready") ids.add("NEED-034");
  if (input.need.strengthNeedCandidates.length === 0) ids.add("NEED-037");
  if (input.need.strengthNeedCandidates.length === 0 && input.need.climateNeedCandidates.length === 0) ids.add("NEED-038");

  const strengthElements = new Set(input.need.strengthNeedCandidates.map((item) => item.element));
  const climateElements = new Set(input.need.climateNeedCandidates.map((item) => item.element));
  const shared = [...strengthElements].filter((element) => climateElements.has(element));
  if (shared.length > 0) ids.add("NEED-035");
  if (strengthElements.size > 0 && climateElements.size > 0 && [...strengthElements].some((element) => !climateElements.has(element))) {
    ids.add("NEED-036");
  }

  ids.add("NEED-039");
  ids.add("NEED-040");
  ids.add("NEED-046");
  ids.add("NEED-047");
  ids.add("NEED-049");
  ids.add("NEED-050");
  ids.add("NEED-051");
  ids.add("NEED-052");

  return [...ids].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export type NeedCaseTrace = {
  caseId: string;
  group: string;
  covers: string[];
  note: string;
  pillars: SamplePillars;
  inputSummary: {
    hour: "unknown" | "confirmed";
    dayStem: Pillar["stem"];
    monthBranch: Pillar["branch"];
  };
  strengthState: {
    directionCandidate: StrengthSummary["directionCandidate"];
    resolution: StrengthSummary["resolution"];
    mixedPattern: StrengthSummary["mixedPattern"];
    unresolvedStrengthReasons: StrengthSummary["unresolvedStrengthReasons"];
    certainty: StrengthSummary["certainty"];
  };
  climateState: {
    temperature: AdjustedClimateSummary["temperature"];
    moisture: AdjustedClimateSummary["moisture"];
    certainty: AdjustedClimateSummary["certainty"];
    climateNeedStatus: NeedCandidateSet["climateNeedStatus"];
  };
  strengthCandidates: ReturnType<typeof candidateRows>;
  climateCandidates: ReturnType<typeof candidateRows>;
  candidateOutput: {
    strengthNeedStatus: NeedCandidateSet["strengthNeedStatus"];
    climateNeedStatus: NeedCandidateSet["climateNeedStatus"];
    climateCounterSignals: NeedCandidateSet["climateCounterSignals"];
    strengthCount: number;
    climateCount: number;
  };
  independentLeaningStrong?: ReturnType<typeof candidateRows>;
  certainty: {
    strength: StrengthSummary["certainty"];
    climate: AdjustedClimateSummary["certainty"];
  };
  triggeredRules: string[];
  notes: string;
};

function traceOne(input: {
  caseId: string;
  group: string;
  covers: string[];
  note: string;
  pillars: SamplePillars;
  includeIndependentLeaningStrong?: boolean;
}): NeedCaseTrace {
  const four = chart(input.pillars);
  const strength = buildStrengthSummary(four);
  const climate = buildAdjustedClimateSummary(four);
  const need = buildNeedCandidateSet(four);
  const independentLeaningStrong = input.includeIndependentLeaningStrong
    ? collectLeaningStrongNeedCandidates(four, strength.certainty)
    : undefined;

  return {
    caseId: input.caseId,
    group: input.group,
    covers: input.covers,
    note: input.note,
    pillars: input.pillars,
    inputSummary: {
      hour: four.hourCertainty === "unknown" ? "unknown" : "confirmed",
      dayStem: four.day.stem,
      monthBranch: four.month.branch,
    },
    strengthState: {
      directionCandidate: strength.directionCandidate,
      resolution: strength.resolution,
      mixedPattern: strength.mixedPattern,
      unresolvedStrengthReasons: strength.unresolvedStrengthReasons,
      certainty: strength.certainty,
    },
    climateState: {
      temperature: climate.temperature,
      moisture: climate.moisture,
      certainty: climate.certainty,
      climateNeedStatus: need.climateNeedStatus,
    },
    strengthCandidates: candidateRows(need.strengthNeedCandidates),
    climateCandidates: candidateRows(need.climateNeedCandidates),
    candidateOutput: {
      strengthNeedStatus: need.strengthNeedStatus,
      climateNeedStatus: need.climateNeedStatus,
      climateCounterSignals: need.climateCounterSignals,
      strengthCount: need.strengthNeedCandidates.length,
      climateCount: need.climateNeedCandidates.length,
    },
    ...(independentLeaningStrong ? { independentLeaningStrong: candidateRows(independentLeaningStrong) } : {}),
    certainty: {
      strength: strength.certainty,
      climate: climate.certainty,
    },
    triggeredRules: inferTriggeredRules({
      strength,
      climate,
      need,
      independentLeaningStrong,
    }),
    notes: input.note,
  };
}

export function collectNeedCaseTraces(): NeedCaseTrace[] {
  const suppression = JSON.parse(
    readFileSync(path.join(__dirname, "../../__tests__/needSuppression.fixtures.json"), "utf8"),
  ).suppression as { pillars: SamplePillars };

  const required: Array<{
    id: string;
    group: string;
    covers: string[];
    note: string;
    pillars: SamplePillars;
    includeIndependentLeaningStrong?: boolean;
  }> = [
    {
      id: "need-case-1-mixed-climate-empty",
      group: "needCandidates-test",
      covers: ["mixed", "climate-empty", "both-empty", "hour-confirmed"],
      note: "己卯 丙子 戊午 戊午. mixed Strength. adjusted Climate balanced. 후보 둘 다 없음. hour confirmed.",
      pillars: {
        year: { stem: "己", branch: "卯" },
        month: { stem: "丙", branch: "子" },
        day: { stem: "戊", branch: "午" },
        hour: { stem: "戊", branch: "午" },
      },
    },
    {
      id: "need-case-2-leaning-strong-climate-empty",
      group: "needCandidates-test",
      covers: ["leaning-strong", "climate-empty", "hour-unknown", "partial"],
      note: "甲寅 甲寅 甲子 unknown. leaning-strong 木 → 火/土/金. Climate Need 없음. certainty partial.",
      pillars: {
        year: { stem: "甲", branch: "寅" },
        month: { stem: "甲", branch: "寅" },
        day: { stem: "甲", branch: "子" },
        hour: "unknown",
      },
    },
    {
      id: "need-case-3-leaning-weak-climate-dry",
      group: "needCandidates-test",
      covers: ["leaning-weak", "climate-dry", "same-element-水", "hour-unknown"],
      note: "甲酉 庚酉 甲酉 unknown. Strength 木/水, Climate 水. 같은 水를 두 배열에 별도 유지.",
      pillars: {
        year: { stem: "甲", branch: "酉" },
        month: { stem: "庚", branch: "酉" },
        day: { stem: "甲", branch: "酉" },
        hour: "unknown",
      },
    },
    {
      id: "need-case-4-mixed-warm-dry-merged-water",
      group: "needCandidates-test",
      covers: ["mixed", "climate-warm", "climate-dry", "hour-unknown"],
      note: "庚子 己未 辛卯 unknown. mixed. Climate 水 1건에 warm+dry reason 2개.",
      pillars: {
        year: { stem: "庚", branch: "子" },
        month: { stem: "己", branch: "未" },
        day: { stem: "辛", branch: "卯" },
        hour: "unknown",
      },
    },
    {
      id: "need-case-5-leaning-weak-different-and-same",
      group: "needCandidates-test",
      covers: ["leaning-weak", "climate-dry", "different-element", "same-element-水", "hour-unknown"],
      note: "丙午 戊戌 甲申 unknown. Strength 木/水, Climate 水. 木은 Strength만, 水는 축마다 별도.",
      pillars: {
        year: { stem: "丙", branch: "午" },
        month: { stem: "戊", branch: "戌" },
        day: { stem: "甲", branch: "申" },
        hour: "unknown",
      },
    },
    {
      id: "need-case-6-strength-unresolved-climate-cold",
      group: "needCandidates-test",
      covers: ["null-unresolved", "climate-cold", "hour-unknown"],
      note: "甲寅 辛亥 庚子 unknown. Strength directionCandidate=null. Climate 火 from cold. moist로 火/土를 추가하지 않음.",
      pillars: {
        year: { stem: "甲", branch: "寅" },
        month: { stem: "辛", branch: "亥" },
        day: { stem: "庚", branch: "子" },
        hour: "unknown",
      },
    },
    {
      id: "need-case-7-explicit-mixed",
      group: "strengthSummary-test",
      covers: ["mixed", "hour-unknown"],
      note: "甲寅 庚申 甲子 unknown. Strength CASE 3 mixed. mixedPattern으로 후보를 만들지 않음.",
      pillars: {
        year: { stem: "甲", branch: "寅" },
        month: { stem: "庚", branch: "申" },
        day: { stem: "甲", branch: "子" },
        hour: "unknown",
      },
    },
    {
      id: "need-case-8-strength-null",
      group: "strengthSummary-test",
      covers: ["null-unresolved", "hour-unknown"],
      note: "丙子 丁酉 甲子 unknown. Strength directionCandidate=null. Strength 후보 [].",
      pillars: {
        year: { stem: "丙", branch: "子" },
        month: { stem: "丁", branch: "酉" },
        day: { stem: "甲", branch: "子" },
        hour: "unknown",
      },
    },
    {
      id: "need-case-9-mixed-hour-confirmed-climate-water",
      group: "strengthSummary-test",
      covers: ["mixed", "climate-warm", "climate-dry", "hour-confirmed"],
      note: "甲辰 丙午 丁酉 庚申. Strength mixed + hour confirmed. Climate 水.",
      pillars: {
        year: { stem: "甲", branch: "辰" },
        month: { stem: "丙", branch: "午" },
        day: { stem: "丁", branch: "酉" },
        hour: { stem: "庚", branch: "申" },
      },
    },
    {
      id: "need-case-10-climate-unresolved",
      group: "climate-audit-required",
      covers: ["climate-unresolved", "both-empty-or-climate-empty", "hour-unknown"],
      note: "壬寅 己亥 丙子 unknown. Climate T/M unresolved. Climate 후보 없음. climateNeedStatus=unresolved.",
      pillars: {
        year: { stem: "壬", branch: "寅" },
        month: { stem: "己", branch: "亥" },
        day: { stem: "丙", branch: "子" },
        hour: "unknown",
      },
    },
    {
      id: "need-case-11-suppression-fixture-mixed-gate",
      group: "needSuppression-fixture",
      covers: ["mixed", "suppression-independent-call", "hour-unknown"],
      note: "丙寅 甲寅 甲子 unknown. buildNeedCandidateSet는 mixed라 Strength []. collectLeaningStrongNeedCandidates만 호출하면 火 suppressed.",
      pillars: suppression.pillars,
      includeIndependentLeaningStrong: true,
    },
  ];

  return required.map((item) =>
    traceOne({
      caseId: item.id,
      group: item.group,
      covers: item.covers,
      note: item.note,
      pillars: item.pillars,
      includeIndependentLeaningStrong: item.includeIndependentLeaningStrong,
    }),
  );
}
