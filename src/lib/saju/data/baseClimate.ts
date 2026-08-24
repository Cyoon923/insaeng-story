import type { BaseClimate, Branch } from "@/lib/saju/types";

export const BASE_CLIMATE: Record<Branch, BaseClimate> = {
  寅: { temperature: "balanced", moisture: "moist" },
  卯: { temperature: "balanced", moisture: "moist" },
  辰: { temperature: "balanced", moisture: "moist" },
  巳: { temperature: "warm", moisture: "dry" },
  午: { temperature: "warm", moisture: "dry" },
  未: { temperature: "warm", moisture: "dry" },
  申: { temperature: "balanced", moisture: "dry" },
  酉: { temperature: "balanced", moisture: "dry" },
  戌: { temperature: "balanced", moisture: "dry" },
  亥: { temperature: "cold", moisture: "moist" },
  子: { temperature: "cold", moisture: "moist" },
  丑: { temperature: "cold", moisture: "moist" },
};

export function baseClimateOf(monthBranch: Branch): BaseClimate {
  return BASE_CLIMATE[monthBranch];
}
