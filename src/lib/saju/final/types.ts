/**
 * Final Element Resolver — type / output contract only.
 * No resolution logic. Does not alter Strength / Need / Climate / Observation.
 */

import type { Element } from "@/lib/saju/types";

export type { Element };

export type FinalRole = "R1" | "R2" | "R3" | "R4" | "R5" | "R6";

/** Role Activity layer (distinct from Element Presence and from Priority CLEAR). */
export type RoleActivity = "A" | "B" | "C";

/** Bottleneck grade for R2 / R5 priority elevation. */
export type BottleneckLevel = "NOT" | "POSSIBLE" | "CLEAR";

/** Hour-unknown Final stability class. Absent when hour is confirmed. */
export type HourStability = "A" | "B" | "C";

export type Certainty = "confirmed" | "provisional" | "unresolved";

export type RoleActivityMap = {
  R1: RoleActivity;
  R2: RoleActivity;
  R3: RoleActivity;
  R4: RoleActivity;
  R5: RoleActivity;
  R6: RoleActivity;
};

/**
 * Resolver output contract.
 * `finalElement` / `finalRole` are null when certainty is unresolved
 * (or when no Final is selected).
 * `reasons` / `decisionTrace` are internal diagnostics — not user copy.
 */
export type FinalResolution = {
  finalElement: Element | null;
  finalRole: FinalRole | null;
  certainty: Certainty;
  roleActivities: RoleActivityMap;
  /** null when R2 bottleneck is not applicable (e.g. R2 Role Activity = C). */
  r2Bottleneck: BottleneckLevel | null;
  /** null when R5 bottleneck is not applicable. */
  r5Bottleneck: BottleneckLevel | null;
  /** null when birth hour is confirmed (stability check not run). */
  hourStability: HourStability | null;
  reasons: string[];
  decisionTrace: string[];
};

export type SupplementResolutionStatus = "resolved" | "unresolved";

/**
 * Combined Core (FER) + Supplement presentation contract.
 * `reasons` are internal diagnostics — not user copy.
 */
export type CoreAndSupplementResolution = {
  coreElement: Element | null;
  coreRole: FinalRole | null;
  coreCertainty: Certainty;
  supplementElement: Element | null;
  supplementStatus: SupplementResolutionStatus;
  reasons: string[];
};
