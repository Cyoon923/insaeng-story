/**
 * Hour-unknown stability A/B/C by re-running the FER pipeline on all 12 hour candidates.
 * Does not assign certainty or build FinalResolution.
 */

import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { buildNeedResolution } from "@/lib/saju/elements/needResolution";
import { buildStrengthSummary } from "@/lib/saju/elements/strengthSummary";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { derivePriorityRoles } from "@/lib/saju/final/derivePriorityRoles";
import { deriveR2Bottleneck } from "@/lib/saju/final/deriveR2Bottleneck";
import { deriveR5Bottleneck } from "@/lib/saju/final/deriveR5Bottleneck";
import { deriveRoleActivities } from "@/lib/saju/final/deriveRoleActivities";
import { deriveRoleElementCandidates } from "@/lib/saju/final/deriveRoleElementCandidates";
import { resolveStructuralElement } from "@/lib/saju/final/resolveStructuralElement";
import { resolveStructureVsClimate } from "@/lib/saju/final/resolveStructureVsClimate";
import type {
  BottleneckLevel,
  FinalRole,
  HourStability,
} from "@/lib/saju/final/types";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import { listHourCandidates } from "@/lib/saju/pillars/hour";
import type { Element, FourPillars, Pillar } from "@/lib/saju/types";

/** Per-hour FER outcome used only for A/B/C comparison (no certainty). */
export type HourFerSnapshot = {
  element: Element | null;
  role: FinalRole | null;
  status: "resolved" | "unresolved";
  r2Bottleneck: BottleneckLevel;
  r5Bottleneck: BottleneckLevel;
};

export type DeriveHourStabilityInput = {
  /** Must be hour-unknown. Year/month/day are fixed; hour is replaced by each candidate. */
  pillars: FourPillars;
};

function withConfirmedHour(base: FourPillars, hour: Pillar): FourPillars {
  return {
    ...base,
    hour,
    hourCertainty: "confirmed",
  };
}

/**
 * Runs the current FER pipeline for one confirmed-hour chart.
 * hourStability is omitted (confirmed hour — provisional gate uses hour-confirmed path).
 */
export function runHourFerSnapshot(pillars: FourPillars): HourFerSnapshot {
  const evidence = collectStrengthEvidence(pillars);
  const observations = buildStrengthObservations(pillars, evidence);
  const summary = buildStrengthSummary(pillars);
  const climate = buildAdjustedClimateSummary(pillars);
  const needResolution = buildNeedResolution(pillars);
  const roleActivities = deriveRoleActivities({
    pillars,
    evidence,
    observations,
    climate,
  });
  const r2Bottleneck = deriveR2Bottleneck({
    pillars,
    summary,
    evidence,
    observations,
    roleActivities,
  });
  const r5Bottleneck = deriveR5Bottleneck({
    evidence,
    observations,
    roleActivities,
  });
  const roleElementCandidates = deriveRoleElementCandidates({
    pillars,
    roleActivities,
    r2Bottleneck,
    r5Bottleneck,
    evidence,
    observations,
    climate,
  });
  const { primaryRoles } = derivePriorityRoles({
    pillars,
    summary,
    roleActivities,
    roleElementCandidates,
    r2Bottleneck,
    r5Bottleneck,
    evidence,
    observations,
    climate,
  });
  const structural = resolveStructuralElement({
    primaryRoles,
    roleElementCandidates,
    roleActivities,
    r2Bottleneck,
    r5Bottleneck,
    summary,
    evidence,
    observations,
  });
  const final = resolveStructureVsClimate({
    structuralResolution: structural,
    roleElementCandidates,
    roleActivities,
    climate,
    needResolution,
  });

  return {
    element: final.element,
    role: final.role,
    status: final.status,
    r2Bottleneck,
    r5Bottleneck,
  };
}

function bandKey(snapshot: HourFerSnapshot): string {
  return `${snapshot.r2Bottleneck}|${snapshot.r5Bottleneck}`;
}

function elementKey(snapshot: HourFerSnapshot): string {
  if (snapshot.status === "unresolved" || snapshot.element === null) return "∅";
  return snapshot.element;
}

function roleKey(snapshot: HourFerSnapshot): string {
  if (snapshot.status === "unresolved" || snapshot.role === null) return "∅";
  return snapshot.role;
}

/**
 * Pure A/B/C classifier over 12 (or more) hour snapshots.
 * No voting/averaging — set cardinality of element / role / band only.
 */
export function classifyHourStability(snapshots: HourFerSnapshot[]): HourStability {
  if (snapshots.length === 0) return "C";

  const elements = new Set(snapshots.map(elementKey));
  const roles = new Set(snapshots.map(roleKey));
  const bands = new Set(snapshots.map(bandKey));

  const hasNull = elements.has("∅");
  const concreteElements = [...elements].filter((key) => key !== "∅");

  // C: multiple concrete elements, or concrete mixed with unresolved/null
  if (concreteElements.length > 1) return "C";
  if (hasNull && concreteElements.length === 1) return "C";

  // Single stable element key (all ∅ or one concrete element)
  const roleVaries = roles.size > 1;
  const bandVaries = bands.size > 1;
  if (roleVaries || bandVaries) return "B";
  return "A";
}

/**
 * Hour-unknown stability: re-apply FER on listHourCandidates(dayStem) (12 hours).
 * Confirmed-hour charts must not call this helper.
 */
export function deriveHourStability(input: DeriveHourStabilityInput): HourStability {
  const { pillars } = input;
  if (pillars.hour !== "unknown") {
    throw new Error("deriveHourStability is only for hour-unknown charts");
  }

  const dayStem = pillars.day.stem;
  const hours = listHourCandidates(dayStem);
  const snapshots = hours.map((hour) =>
    runHourFerSnapshot(withConfirmedHour(pillars, hour)),
  );
  return classifyHourStability(snapshots);
}
