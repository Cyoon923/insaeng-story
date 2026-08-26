/**
 * R5 Bottleneck Level — grades whether a P→M→Q generation-corridor gap
 * is a structural bottleneck. Shared analysis lives in analyzeR5Corridors.
 */

import { analyzeR5Corridors } from "@/lib/saju/final/analyzeR5Corridors";
import type { BottleneckLevel, RoleActivityMap } from "@/lib/saju/final/types";
import type { StrengthObservations } from "@/lib/saju/observation/types";
import type { StrengthEvidence } from "@/lib/saju/types";

export type DeriveR5BottleneckInput = {
  evidence: StrengthEvidence;
  observations: StrengthObservations;
  roleActivities: RoleActivityMap;
};

/**
 * Grades whether a P→M→Q generation-corridor gap is an R5 structural bottleneck.
 * Role Activity C for the same connection must not be treated as a bottleneck.
 */
export function deriveR5Bottleneck(input: DeriveR5BottleneckInput): BottleneckLevel {
  return analyzeR5Corridors(input).bottleneck;
}
