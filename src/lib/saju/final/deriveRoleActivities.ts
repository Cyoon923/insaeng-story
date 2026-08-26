/**
 * Assembles R1–R6 Role Activity helpers into one RoleActivityMap.
 * No new A/B/C rules, bottlenecks, priority, or Final selection.
 */

import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { deriveR1RoleActivity } from "@/lib/saju/final/deriveR1RoleActivity";
import { deriveR2RoleActivity } from "@/lib/saju/final/deriveR2RoleActivity";
import { deriveR3RoleActivity } from "@/lib/saju/final/deriveR3RoleActivity";
import { deriveR4RoleActivity } from "@/lib/saju/final/deriveR4RoleActivity";
import { deriveR5RoleActivity } from "@/lib/saju/final/deriveR5RoleActivity";
import { deriveR6RoleActivity } from "@/lib/saju/final/deriveR6RoleActivity";
import type { RoleActivityMap } from "@/lib/saju/final/types";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import type { StrengthObservations } from "@/lib/saju/observation/types";
import type {
  AdjustedClimateSummary,
  FourPillars,
  StrengthEvidence,
} from "@/lib/saju/types";

export type DeriveRoleActivitiesInput = {
  pillars: FourPillars;
  /** Reuse when already computed; otherwise collected once. */
  evidence?: StrengthEvidence;
  /** Reuse when already computed; otherwise built once from pillars + evidence. */
  observations?: StrengthObservations;
  /** Reuse when already computed; otherwise built once from pillars. */
  climate?: AdjustedClimateSummary;
};

/**
 * Derives the full RoleActivityMap by calling R1–R6 helpers with shared inputs.
 */
export function deriveRoleActivities(input: DeriveRoleActivitiesInput): RoleActivityMap {
  const evidence = input.evidence ?? collectStrengthEvidence(input.pillars);
  const observations =
    input.observations ?? buildStrengthObservations(input.pillars, evidence);
  const climate = input.climate ?? buildAdjustedClimateSummary(input.pillars);

  const shared = { pillars: input.pillars, evidence, observations };

  return {
    R1: deriveR1RoleActivity(shared),
    R2: deriveR2RoleActivity(shared),
    R3: deriveR3RoleActivity(shared),
    R4: deriveR4RoleActivity(shared),
    R5: deriveR5RoleActivity(shared),
    R6: deriveR6RoleActivity({ pillars: input.pillars, climate }),
  };
}
