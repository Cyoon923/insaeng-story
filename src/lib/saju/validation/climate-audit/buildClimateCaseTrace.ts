import { readFileSync } from "node:fs";
import path from "node:path";
import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { buildNeedCandidateSet } from "@/lib/saju/elements/needCandidates";
import { collectClimateEvidence } from "@/lib/saju/elements/climate";
import type {
  AdjustedClimateSummary,
  ClimateElementQuality,
  FourPillars,
  HourPillar,
  NeedCandidate,
  Pillar,
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
    reasons: item.reasons,
    status: item.status,
    existingPresence: item.existingPresence,
    evidenceRefs: item.evidenceRefs,
  }));
}

function inferTriggeredRules(
  summary: AdjustedClimateSummary,
  climateNeed: ReturnType<typeof buildNeedCandidateSet>,
): string[] {
  const ids = new Set<string>(["CLI-001", "CLI-002", "CLI-009", "CLI-010", "CLI-013", "CLI-014", "CLI-027", "CLI-051", "CLI-056"]);
  const month = summary.baseClimate;
  if (month.temperature === "balanced" && month.moisture === "moist") ids.add("CLI-003a");
  if (month.temperature === "warm" && month.moisture === "dry") ids.add("CLI-003b");
  if (month.temperature === "balanced" && month.moisture === "dry") ids.add("CLI-003c");
  if (month.temperature === "cold" && month.moisture === "moist") ids.add("CLI-003d");

  if (summary.omittedSlots.includes("hour")) {
    ids.add("CLI-015");
    ids.add("CLI-016");
    ids.add("CLI-040");
  } else {
    ids.add("CLI-040");
  }

  const qualityRule: Record<ClimateElementQuality, string> = {
    absent: "CLI-020",
    clear: "CLI-021",
    substantial: "CLI-022",
    shallow: "CLI-023",
    hidden: "CLI-024",
    "branch-only": "CLI-025",
  };
  ids.add(qualityRule[summary.fireQuality]);
  ids.add(qualityRule[summary.waterQuality]);

  if (summary.baseClimate.temperature === "balanced") ids.add("CLI-028");
  else ids.add("CLI-018");
  if (summary.baseClimate.moisture === "balanced") ids.add("CLI-035");
  else ids.add("CLI-019");

  if (summary.conflicts.includes("both-fire-and-water-clear-or-substantial")) ids.add("CLI-029");
  if (summary.conflicts.includes("substantial-mitigation-and-reinforcement")) ids.add("CLI-030");
  if (summary.unresolvedReasons.includes("substantial-fire-mitigation-needs-review")) ids.add("CLI-031");
  if (summary.unresolvedReasons.includes("substantial-water-mitigation-needs-review")) ids.add("CLI-031");
  if (summary.temperature.status === "resolved" && summary.temperature.value === "balanced" && summary.baseClimate.temperature !== "balanced") {
    ids.add("CLI-032");
  }
  if (summary.moisture.status === "resolved" && summary.moisture.value === "balanced" && summary.baseClimate.moisture !== "balanced") {
    ids.add("CLI-032");
  }
  if (summary.temperature.status === "resolved" && summary.temperature.value === summary.baseClimate.temperature) {
    ids.add("CLI-033");
  }
  if (summary.moisture.status === "resolved" && summary.moisture.value === summary.baseClimate.moisture) {
    ids.add("CLI-033");
  }
  if (summary.unresolvedReasons.includes("hour-unknown-may-change-climate-factors")) ids.add("CLI-039");

  if (summary.baseClimate.temperature === "cold" && summary.baseClimate.moisture === "moist") ids.add("CLI-054");
  if (summary.baseClimate.temperature === "warm" && summary.baseClimate.moisture === "dry") ids.add("CLI-038");

  for (const candidate of climateNeed.climateNeedCandidates) {
    if (candidate.reasons.includes("climate-temperature-cold")) ids.add("CLI-041");
    if (candidate.reasons.includes("climate-temperature-warm")) ids.add("CLI-042");
    if (candidate.reasons.includes("climate-moisture-dry")) ids.add("CLI-043");
    if (candidate.reasons.length > 1) ids.add("CLI-047");
  }
  if (summary.moisture.status === "resolved" && summary.moisture.value === "moist") ids.add("CLI-044");
  if (summary.moisture.status === "resolved" && summary.moisture.value === "balanced" && climateNeed.climateNeedCandidates.every((item) => !item.reasons.includes("climate-moisture-moist"))) {
    ids.add("CLI-044");
  }
  if (climateNeed.climateNeedCandidates.length === 0 && climateNeed.climateNeedStatus === "ready") ids.add("CLI-045");
  if (climateNeed.climateNeedStatus === "unresolved" || climateNeed.climateNeedStatus === "axis-unresolved") ids.add("CLI-046");
  ids.add("CLI-048");
  ids.add("CLI-049");
  ids.add("CLI-050");
  return [...ids].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export type ClimateCaseTrace = {
  caseId: string;
  group: string;
  note: string;
  pillars: SamplePillars;
  monthBranch: FourPillars["month"]["branch"];
  baseClimate: AdjustedClimateSummary["baseClimate"];
  fireQuality: ClimateElementQuality;
  waterQuality: ClimateElementQuality;
  temperature: AdjustedClimateSummary["temperature"];
  moisture: AdjustedClimateSummary["moisture"];
  certainty: AdjustedClimateSummary["certainty"];
  conflicts: string[];
  unresolvedReasons: string[];
  omittedSlots: AdjustedClimateSummary["omittedSlots"];
  climateNeedCandidates: ReturnType<typeof candidateRows>;
  counterSignals: ReturnType<typeof buildNeedCandidateSet>["climateCounterSignals"];
  climateNeedStatus: ReturnType<typeof buildNeedCandidateSet>["climateNeedStatus"];
  triggeredRules: string[];
};

function traceOne(caseId: string, group: string, note: string, pillars: SamplePillars): ClimateCaseTrace {
  const four = chart(pillars);
  const evidence = collectClimateEvidence(four);
  const summary = buildAdjustedClimateSummary(four);
  const need = buildNeedCandidateSet(four);
  return {
    caseId,
    group,
    note,
    pillars,
    monthBranch: evidence.monthBranch,
    baseClimate: summary.baseClimate,
    fireQuality: summary.fireQuality,
    waterQuality: summary.waterQuality,
    temperature: summary.temperature,
    moisture: summary.moisture,
    certainty: summary.certainty,
    conflicts: summary.conflicts,
    unresolvedReasons: summary.unresolvedReasons,
    omittedSlots: summary.omittedSlots,
    climateNeedCandidates: candidateRows(need.climateNeedCandidates),
    counterSignals: need.climateCounterSignals,
    climateNeedStatus: need.climateNeedStatus,
    triggeredRules: inferTriggeredRules(summary, need),
  };
}

export function collectClimateCaseTraces(): ClimateCaseTrace[] {
  const axis = JSON.parse(
    readFileSync(path.join(__dirname, "../../__tests__/axisReview.fixtures.json"), "utf8"),
  ).samples as Array<{ id: string; name: string; pillars: SamplePillars }>;

  const required: Array<{ id: string; group: string; note: string; pillars: SamplePillars }> = [
    {
      id: "cli-case-1-gimo-bingja-muo",
      group: "required-audit",
      note: "cold+moist → Fire clear → adjusted balanced. Climate Need 없음.",
      pillars: {
        year: { stem: "己", branch: "卯" },
        month: { stem: "丙", branch: "子" },
        day: { stem: "戊", branch: "午" },
        hour: { stem: "戊", branch: "午" },
      },
    },
    {
      id: "cli-case-2-gapjin-bingo",
      group: "required-audit",
      note: "warm+dry. Fire substantial reinforcement, Water hidden. Need 水.",
      pillars: {
        year: { stem: "甲", branch: "辰" },
        month: { stem: "丙", branch: "午" },
        day: { stem: "丁", branch: "酉" },
        hour: { stem: "庚", branch: "申" },
      },
    },
    {
      id: "cli-case-3-imin-gihae",
      group: "required-audit",
      note: "Fire substantial + Water clear conflict. 시간 미상.",
      pillars: {
        year: { stem: "壬", branch: "寅" },
        month: { stem: "己", branch: "亥" },
        day: { stem: "丙", branch: "子" },
        hour: "unknown",
      },
    },
    {
      id: "cli-case-4-gyeongja-gimi",
      group: "required-audit",
      note: "warm+dry + Water hidden. 시간 미상.",
      pillars: {
        year: { stem: "庚", branch: "子" },
        month: { stem: "己", branch: "未" },
        day: { stem: "辛", branch: "卯" },
        hour: "unknown",
      },
    },
    {
      id: "cli-case-5-gapyu-empty",
      group: "required-audit",
      note: "balanced+dry, Fire/Water factor 없음.",
      pillars: {
        year: { stem: "甲", branch: "酉" },
        month: { stem: "庚", branch: "酉" },
        day: { stem: "甲", branch: "酉" },
        hour: "unknown",
      },
    },
    {
      id: "cli-case-6-chuk-cold-moist",
      group: "required-audit",
      note: "丑월 cold+moist.",
      pillars: {
        year: { stem: "庚", branch: "申" },
        month: { stem: "己", branch: "丑" },
        day: { stem: "乙", branch: "丑" },
        hour: "unknown",
      },
    },
    {
      id: "cli-case-7-jin-month",
      group: "earth-branch",
      note: "辰월 balanced+moist. 기존 fixture s7.",
      pillars: {
        year: { stem: "庚", branch: "申" },
        month: { stem: "戊", branch: "辰" },
        day: { stem: "甲", branch: "子" },
        hour: "unknown",
      },
    },
    {
      id: "cli-case-8-sul-month",
      group: "earth-branch",
      note: "戌월 balanced+dry. 기존 fixture s9.",
      pillars: {
        year: { stem: "丙", branch: "午" },
        month: { stem: "戊", branch: "戌" },
        day: { stem: "甲", branch: "申" },
        hour: "unknown",
      },
    },
    {
      id: "cli-case-9-wei-month",
      group: "earth-branch",
      note: "未월 warm+dry. 기존 fixture s8.",
      pillars: {
        year: { stem: "庚", branch: "子" },
        month: { stem: "己", branch: "未" },
        day: { stem: "辛", branch: "卯" },
        hour: "unknown",
      },
    },
    {
      id: "cli-case-10-balanced-moist-in",
      group: "moist-need-policy",
      note: "寅월 balanced+moist. Climate Need 없음.",
      pillars: {
        year: { stem: "甲", branch: "寅" },
        month: { stem: "甲", branch: "寅" },
        day: { stem: "甲", branch: "子" },
        hour: "unknown",
      },
    },
    {
      id: "cli-case-11-cold-moist-fire-need",
      group: "moist-need-policy",
      note: "亥월 cold+moist. Fire Need from temperature only.",
      pillars: {
        year: { stem: "甲", branch: "寅" },
        month: { stem: "辛", branch: "亥" },
        day: { stem: "庚", branch: "子" },
        hour: "unknown",
      },
    },
  ];

  const seen = new Set(required.map((item) => item.id));
  const axisTraces = axis
    .filter((item) => ["s7-gap-jin-yogi", "s8-sin-mi-sang", "s9-gap-sul-mugun", "s10-byeong-chuk-hyu", "s12-mu-jin-wang-multi"].includes(item.id))
    .map((item) => traceOne(item.id, "axis-review-earth-month", item.name, item.pillars));

  return [
    ...required.map((item) => traceOne(item.id, item.group, item.note, item.pillars)),
    ...axisTraces.filter((item) => !seen.has(item.caseId)),
  ];
}
