/**
 * Hour-unknown stability A/B/C by re-running the FER pipeline on all 12 hour candidates.
 * Compares Final element + role + role certainty band (not bottleneck pair alone).
 * Does not assign Final certainty or build FinalResolution.
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
import type { StructureVsClimateSource } from "@/lib/saju/final/resolveStructureVsClimate";
import { resolveStructureVsClimate } from "@/lib/saju/final/resolveStructureVsClimate";
import type {
  BottleneckLevel,
  FinalRole,
  HourStability,
  RoleActivityMap,
} from "@/lib/saju/final/types";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import { listHourCandidates } from "@/lib/saju/pillars/hour";
import type {
  AdjustedClimateSummary,
  AdjustedMoistureAxis,
  AdjustedTemperatureAxis,
  Element,
  NeedResolution,
  PillarSlot,
  StrengthEvidence,
  StrengthSummary,
  FourPillars,
  Pillar,
} from "@/lib/saju/types";

/** Role-scoped certainty band for hour-stability comparison only. */
export type HourRoleBand = "CLEAR" | "POSSIBLE" | "UNRESOLVED";

/** Per-hour FER outcome used only for A/B/C comparison (no Final certainty). */
export type HourFerSnapshot = {
  element: Element | null;
  role: FinalRole | null;
  status: "resolved" | "unresolved";
  roleBand: HourRoleBand;
};

export type DeriveHourStabilityInput = {
  /** Must be hour-unknown. Year/month/day are fixed; hour is replaced by each candidate. */
  pillars: FourPillars;
};

type ClimateAxis = AdjustedTemperatureAxis | AdjustedMoistureAxis;

function withConfirmedHour(base: FourPillars, hour: Pillar): FourPillars {
  return {
    ...base,
    hour,
    hourCertainty: "confirmed",
  };
}

function isEligibleSlot(slot: PillarSlot, hourUnknown: boolean): boolean {
  if (hourUnknown && slot === "hour") return false;
  return true;
}

function isVisiblePresence(presence: string | undefined): boolean {
  return presence === "rooted-visible" || presence === "unrooted-visible";
}

function isResourceShiShen(shiShen: string): boolean {
  return shiShen === "정인" || shiShen === "편인";
}

function isOutputShiShen(shiShen: string): boolean {
  return shiShen === "식신" || shiShen === "상관";
}

function isControlShiShen(shiShen: string): boolean {
  return shiShen === "정재" || shiShen === "편재" || shiShen === "정관" || shiShen === "편관";
}

/**
 * R1 CLEAR-grade — same criteria as deriveFinalCertainty.r1HasClearEvidence.
 */
function r1HasClearEvidence(
  summary: StrengthSummary,
  evidence: StrengthEvidence | undefined,
): boolean {
  if (!summary.sourceBreakdown.resource.rootedVisible) return false;
  if (!evidence) return false;
  return evidence.supportEvidence.items.some(
    (item) =>
      isResourceShiShen(item.shiShen) &&
      isVisiblePresence(item.presence) &&
      isEligibleSlot(item.slot, evidence.hourUnknown),
  );
}

/**
 * R3 CLEAR-grade — same criteria as deriveFinalCertainty.r3HasClearEvidence.
 */
function r3HasClearEvidence(
  summary: StrengthSummary,
  evidence: StrengthEvidence | undefined,
): boolean {
  if (summary.sourceBreakdown.output.rootedVisible) return true;
  if (!evidence) return false;
  return evidence.pressureEvidence.items.some(
    (item) =>
      isOutputShiShen(item.shiShen) &&
      item.presence === "rooted-visible" &&
      isEligibleSlot(item.slot, evidence.hourUnknown),
  );
}

/**
 * R4 CLEAR-grade — same criteria as deriveFinalCertainty.r4HasClearEvidence.
 */
function r4HasClearEvidence(
  summary: StrengthSummary,
  evidence: StrengthEvidence | undefined,
): boolean {
  const { wealth, officer } = summary.sourceBreakdown;
  if (wealth.rootedVisible || officer.rootedVisible) return true;
  if (!evidence) return false;
  return evidence.pressureEvidence.items.some(
    (item) =>
      isControlShiShen(item.shiShen) &&
      item.presence === "rooted-visible" &&
      isEligibleSlot(item.slot, evidence.hourUnknown),
  );
}

function axisIncomplete(axis: ClimateAxis): boolean {
  if (axis.status === "unresolved") return true;
  return (
    axis.outcome === "partially-mitigated" ||
    axis.outcome === "mitigation-reinforcement-conflict" ||
    axis.outcome === "unresolved"
  );
}

function climateAxesAllowClearR6(climate: AdjustedClimateSummary): boolean {
  if (climate.conflicts.length > 0) return false;
  return !axisIncomplete(climate.temperature) && !axisIncomplete(climate.moisture);
}

function hasContestedInheritedProvenance(
  needResolution: NeedResolution | undefined,
  element: Element | null,
): boolean {
  if (!needResolution || !element) return false;
  if (needResolution.decisionBlockedBy.includes("climate-need-contested-inherited")) {
    return true;
  }
  return [...needResolution.originalClimateCandidates, ...needResolution.climateOnlyElements].some(
    (candidate) =>
      candidate.element === element && candidate.boundary === "contested-inherited",
  );
}

function bottleneckToBand(level: BottleneckLevel): HourRoleBand {
  if (level === "CLEAR") return "CLEAR";
  if (level === "POSSIBLE") return "POSSIBLE";
  return "UNRESOLVED";
}

export type DeriveHourRoleBandInput = {
  role: FinalRole | null;
  status: "resolved" | "unresolved";
  source: StructureVsClimateSource;
  r2Bottleneck: BottleneckLevel;
  r5Bottleneck: BottleneckLevel;
  summary: StrengthSummary;
  evidence: StrengthEvidence;
  roleActivities: RoleActivityMap;
  climate: AdjustedClimateSummary;
  needResolution?: NeedResolution;
  element: Element | null;
};

/**
 * Grades the Final candidate role's certainty band for hour-stability comparison.
 * Reuses existing bottleneck / CLEAR-grade evidence / climate clear policies — no new Final rules.
 */
export function deriveHourRoleBand(input: DeriveHourRoleBandInput): HourRoleBand {
  const { role, status, r2Bottleneck, r5Bottleneck, summary, evidence, roleActivities } =
    input;
  void input.source;

  if (status === "unresolved" || role === null || input.element === null) {
    return "UNRESOLVED";
  }

  switch (role) {
    case "R2":
      return bottleneckToBand(r2Bottleneck);
    case "R5":
      return bottleneckToBand(r5Bottleneck);
    case "R1": {
      if (roleActivities.R1 === "C") return "UNRESOLVED";
      return r1HasClearEvidence(summary, evidence) ? "CLEAR" : "POSSIBLE";
    }
    case "R3": {
      if (roleActivities.R3 === "C") return "UNRESOLVED";
      return r3HasClearEvidence(summary, evidence) ? "CLEAR" : "POSSIBLE";
    }
    case "R4": {
      if (roleActivities.R4 === "C") return "UNRESOLVED";
      return r4HasClearEvidence(summary, evidence) ? "CLEAR" : "POSSIBLE";
    }
    case "R6": {
      const clear =
        climateAxesAllowClearR6(input.climate) &&
        !hasContestedInheritedProvenance(input.needResolution, input.element);
      if (clear) return "CLEAR";
      // Resolved but partial/contested climate path — POSSIBLE; incomplete axes also POSSIBLE.
      return "POSSIBLE";
    }
    default:
      return "UNRESOLVED";
  }
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

  const roleBand = deriveHourRoleBand({
    role: final.role,
    status: final.status,
    source: final.source,
    r2Bottleneck,
    r5Bottleneck,
    summary,
    evidence,
    roleActivities,
    climate,
    needResolution,
    element: final.element,
  });

  return {
    element: final.element,
    role: final.role,
    status: final.status,
    roleBand,
  };
}

function elementKey(snapshot: HourFerSnapshot): string {
  if (snapshot.status === "unresolved" || snapshot.element === null) return "∅";
  return snapshot.element;
}

function roleKey(snapshot: HourFerSnapshot): string {
  if (snapshot.status === "unresolved" || snapshot.role === null) return "∅";
  return snapshot.role;
}

function bandKey(snapshot: HourFerSnapshot): string {
  return snapshot.roleBand;
}

/**
 * Pure A/B/C classifier over 12 (or more) hour snapshots.
 * A/B require a single concrete Final element; all-null/unresolved is C.
 */
export function classifyHourStability(snapshots: HourFerSnapshot[]): HourStability {
  if (snapshots.length === 0) return "C";

  const elements = new Set(snapshots.map(elementKey));
  const roles = new Set(snapshots.map(roleKey));
  const bands = new Set(snapshots.map(bandKey));

  const hasNull = elements.has("∅");
  const concreteElements = [...elements].filter((key) => key !== "∅");

  // C: no concrete Final element (all unresolved/null), multiple elements, or mix
  if (concreteElements.length === 0) return "C";
  if (concreteElements.length > 1) return "C";
  if (hasNull) return "C";

  // Single concrete element across all hours — role/band variance → B, else A
  if (roles.size > 1 || bands.size > 1) return "B";
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
