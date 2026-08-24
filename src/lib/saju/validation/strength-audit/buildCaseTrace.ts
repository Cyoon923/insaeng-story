import { readFileSync } from "node:fs";
import path from "node:path";
import { buildStrengthSummary } from "@/lib/saju/elements/strengthSummary";
import type { FourPillars, HourPillar, Pillar, StrengthSummary } from "@/lib/saju/types";

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

function inferTriggeredRules(summary: StrengthSummary): string[] {
  const ids = new Set<string>(["STR-001", "STR-002", "STR-003", "STR-004", "STR-005", "STR-006", "STR-010", "STR-011"]);
  if (summary.omittedSlots.includes("hour")) ids.add("STR-007");
  else ids.add("STR-008");
  ids.add("STR-012");
  ids.add("STR-020");
  ids.add("STR-021");

  if (summary.seasonalPhase === "왕") {
    ids.add("STR-022");
    ids.add("STR-023");
  } else if (summary.seasonalPhase === "상") {
    ids.add("STR-026");
  } else if (summary.seasonalPhase === "휴") {
    ids.add("STR-027");
  } else if (summary.seasonalPhase === "수" || summary.seasonalPhase === "사") {
    ids.add("STR-024");
    ids.add("STR-025");
  }

  if (summary.rootQuality === "clear") ids.add("STR-030-clear");
  if (summary.rootQuality === "present") ids.add("STR-030-present");
  if (summary.rootQuality === "shallow") ids.add("STR-030-shallow");
  if (summary.rootQuality === "absent") ids.add("STR-032");
  else ids.add("STR-031");
  if (summary.rootQuality === "clear" || summary.rootQuality === "present" || summary.rootQuality === "shallow") {
    ids.add("STR-033");
  }

  const rvSupport = summary.strongSideEvidence.some(
    (item) => item.kind === "visible-support" && item.quality === "rooted-visible",
  );
  const uvSupport = summary.strongSideEvidence.some(
    (item) => item.kind === "visible-support" && item.quality === "unrooted-visible",
  );
  const rvPressure = summary.weakSideEvidence.some(
    (item) => item.kind === "visible-pressure" && item.quality === "rooted-visible",
  );
  const uvPressure = summary.weakSideEvidence.some(
    (item) => item.kind === "visible-pressure" && item.quality === "unrooted-visible",
  );
  if (rvSupport) ids.add("STR-040");
  if (rvPressure) ids.add("STR-041");
  if (uvSupport || uvPressure) ids.add("STR-042");
  ids.add("STR-043");
  if (summary.hiddenSupportNotes.length > 0) ids.add("STR-044");
  if (summary.hiddenPressureNotes.length > 0) ids.add("STR-045");

  if (summary.directionCandidate === "leaning-strong") ids.add("STR-050");
  if (summary.directionCandidate === "leaning-weak") ids.add("STR-051");
  if (summary.directionCandidate === "mixed") {
    ids.add("STR-055");
    ids.add("STR-060");
    ids.add("STR-062");
    if (summary.mixedPattern === "strong-base-with-pressure") ids.add("STR-061a");
    if (summary.mixedPattern === "weak-season-with-support") ids.add("STR-061b");
    if (summary.mixedPattern === "weak-season-root-under-pressure") ids.add("STR-061c");
    if (summary.mixedPattern === "shallow-root-under-pressure") ids.add("STR-061d");
    if (summary.mixedPattern === "help-season-absent-root") ids.add("STR-061e");
    if (summary.mixedPattern === "neutral-season-conflict") ids.add("STR-061f");
    if (summary.mixedPattern === "other-mixed") ids.add("STR-061g");
  }
  if (summary.directionCandidate === null) {
    ids.add("STR-056");
    ids.add("STR-064");
    for (const reason of summary.unresolvedStrengthReasons) {
      if (reason === "seasonal-phase-insufficient") ids.add("STR-064a");
      if (reason === "only-unrooted-visible-evidence") ids.add("STR-064b");
      if (reason === "hidden-relations-conflict") ids.add("STR-064c");
      if (reason === "insufficient-visible-direction") ids.add("STR-064d");
      if (reason === "hour-unknown-sensitive") ids.add("STR-066");
    }
  }
  ids.add("STR-067");
  ids.add("STR-068");
  if (summary.directionCandidate === "mixed" || summary.directionCandidate === null) ids.add("STR-071");
  if (summary.directionCandidate === "leaning-strong" || summary.directionCandidate === "leaning-weak") ids.add("STR-070");
  return [...ids].sort();
}

export type StrengthCaseTrace = {
  caseId: string;
  group: string;
  pillars: SamplePillars;
  directionCandidate: StrengthSummary["directionCandidate"];
  triggeredRules: string[];
  mixedPattern: StrengthSummary["mixedPattern"];
  mixedConflictLevel: StrengthSummary["mixedConflictLevel"];
  unresolvedStrengthReasons: StrengthSummary["unresolvedStrengthReasons"];
  unresolvedReasons: string[];
  certainty: StrengthSummary["certainty"];
  resolution: StrengthSummary["resolution"];
  seasonalPhase: StrengthSummary["seasonalPhase"];
  rootQuality: StrengthSummary["rootQuality"];
};

function traceOne(caseId: string, group: string, pillars: SamplePillars): StrengthCaseTrace {
  const summary = buildStrengthSummary(chart(pillars));
  return {
    caseId,
    group,
    pillars,
    directionCandidate: summary.directionCandidate,
    triggeredRules: inferTriggeredRules(summary),
    mixedPattern: summary.mixedPattern,
    mixedConflictLevel: summary.mixedConflictLevel,
    unresolvedStrengthReasons: summary.unresolvedStrengthReasons,
    unresolvedReasons: summary.unresolvedReasons,
    certainty: summary.certainty,
    resolution: summary.resolution,
    seasonalPhase: summary.seasonalPhase,
    rootQuality: summary.rootQuality,
  };
}

export function collectStrengthCaseTraces(): StrengthCaseTrace[] {
  const axis = JSON.parse(
    readFileSync(path.join(__dirname, "../../__tests__/axisReview.fixtures.json"), "utf8"),
  ).samples as Array<{ id: string; pillars: SamplePillars }>;
  const conflict = JSON.parse(
    readFileSync(path.join(__dirname, "../../__tests__/conflictType.fixtures.json"), "utf8"),
  ) as {
    typeC: Array<{ id: string; pillars: SamplePillars }>;
    typeI: Array<{ id: string; pillars: SamplePillars }>;
  };

  const extra: Array<{ id: string; group: string; pillars: SamplePillars }> = [
    {
      id: "case-leaning-strong-gap-in",
      group: "leaning-strong",
      pillars: {
        year: { stem: "甲", branch: "寅" },
        month: { stem: "甲", branch: "寅" },
        day: { stem: "甲", branch: "子" },
        hour: "unknown",
      },
    },
    {
      id: "case-leaning-weak-gap-yu",
      group: "leaning-weak",
      pillars: {
        year: { stem: "甲", branch: "酉" },
        month: { stem: "庚", branch: "酉" },
        day: { stem: "甲", branch: "酉" },
        hour: "unknown",
      },
    },
    {
      id: "case-unresolved-sang",
      group: "unresolved",
      pillars: {
        year: { stem: "甲", branch: "寅" },
        month: { stem: "丙", branch: "寅" },
        day: { stem: "丁", branch: "酉" },
        hour: "unknown",
      },
    },
    {
      id: "case-unresolved-hyu",
      group: "unresolved",
      pillars: {
        year: { stem: "甲", branch: "寅" },
        month: { stem: "辛", branch: "亥" },
        day: { stem: "庚", branch: "子" },
        hour: "unknown",
      },
    },
    {
      id: "need-leaning-weak-gap-sul",
      group: "leaning-weak",
      pillars: {
        year: { stem: "丙", branch: "午" },
        month: { stem: "戊", branch: "戌" },
        day: { stem: "甲", branch: "申" },
        hour: "unknown",
      },
    },
  ];

  return [
    ...axis.map((item) => traceOne(item.id, "axis-review-16", item.pillars)),
    ...conflict.typeC.map((item) => traceOne(item.id, "type-c", item.pillars)),
    ...conflict.typeI.map((item) => traceOne(item.id, "type-i", item.pillars)),
    ...extra.map((item) => traceOne(item.id, item.group, item.pillars)),
  ];
}
