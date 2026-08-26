/**
 * FER public API — Final Element Resolver entry surface only.
 * Internal helpers (role activities, bottlenecks, priority, structural steps) stay private.
 */

export { resolveFinalElement } from "@/lib/saju/final/resolveFinalElement";
export type { ResolveFinalElementInput } from "@/lib/saju/final/resolveFinalElement";

export type {
  FinalResolution,
  FinalRole,
  RoleActivity,
  BottleneckLevel,
  HourStability,
  Certainty,
} from "@/lib/saju/final/types";
