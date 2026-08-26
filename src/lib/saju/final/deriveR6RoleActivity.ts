/**
 * R6 (조후 조절) Role Activity only.
 * Judges whether climate regulation is operating / already closed.
 * Does not select R6 candidates, Final elements, or compare structure vs climate.
 */

import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import type { RoleActivity } from "@/lib/saju/final/types";
import type {
  AdjustedClimateSummary,
  AdjustedMoistureAxis,
  AdjustedTemperatureAxis,
  ClimateMoisture,
  ClimateTemperature,
  FourPillars,
} from "@/lib/saju/types";

export type DeriveR6RoleActivityInput = {
  pillars: FourPillars;
  /** Reuse when already computed; otherwise built once from pillars. */
  climate?: AdjustedClimateSummary;
};

type ClimateAxis = AdjustedTemperatureAxis | AdjustedMoistureAxis;

function isPolarClimateValue(
  value: ClimateTemperature | ClimateMoisture | null,
): value is Exclude<ClimateTemperature | ClimateMoisture, "balanced"> {
  return value === "cold" || value === "warm" || value === "dry" || value === "moist";
}

/** Contested / partial mitigation / unresolved axis — cannot claim regulation complete. */
function axisIsIncomplete(axis: ClimateAxis): boolean {
  if (axis.status === "unresolved") return true;
  return (
    axis.outcome === "partially-mitigated" ||
    axis.outcome === "mitigation-reinforcement-conflict" ||
    axis.outcome === "unresolved"
  );
}

/** Clear mitigation closed the axis to balanced. */
function axisRegulationComplete(axis: ClimateAxis): boolean {
  return axis.status === "resolved" && axis.outcome === "balanced";
}

/** Resolved polar bias kept unchanged — complement/mitigation did not close it. */
function axisUnresolvedBiasUnchanged(axis: ClimateAxis): boolean {
  return (
    axis.status === "resolved" && isPolarClimateValue(axis.value) && axis.outcome === "unchanged"
  );
}

function hasClimateRegulationTrace(climate: AdjustedClimateSummary): boolean {
  if (climate.mitigationFactors.length > 0) return true;
  if (climate.reinforcementFactors.length > 0) return true;
  if (climate.fireQuality !== "absent") return true;
  if (climate.waterQuality !== "absent") return true;
  return false;
}

/**
 * Derives R6 Role Activity (A/B/C) from AdjustedClimateSummary.
 * Fire/water Element Presence alone and Climate Need candidates do not yield C.
 */
export function deriveR6RoleActivity(input: DeriveR6RoleActivityInput): RoleActivity {
  const climate = input.climate ?? buildAdjustedClimateSummary(input.pillars);
  const axes: ClimateAxis[] = [climate.temperature, climate.moisture];

  // Incomplete / contested regulation → max B (hour-unknown already encoded in climate).
  if (climate.conflicts.length > 0 || axes.some(axisIsIncomplete)) {
    return "B";
  }

  // At least one axis closed by mitigation/balance, none left incomplete.
  if (axes.some(axisRegulationComplete)) {
    return "C";
  }

  // Factor/quality traces exist but polar bias remains unchanged → regulation not complete.
  if (hasClimateRegulationTrace(climate) && axes.some(axisUnresolvedBiasUnchanged)) {
    return "B";
  }

  // No operating regulation role:
  // - never needed (balanced+unchanged), and/or
  // - resolved bias with empty complement (no fire/water regulation trace).
  return "A";
}
