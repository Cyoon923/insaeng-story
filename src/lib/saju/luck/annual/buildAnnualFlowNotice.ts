/**
 * User-facing “2026 흐름 안내” for displayable-partial completeness notice.
 * Projects NEW_CLIMATE_IMBALANCE + climate reinforcement evidence only.
 */

import type { AnnualPresentationGate } from "@/lib/saju/luck/annual/deriveAnnualPresentationGate";
import type { AnnualSupplementFlowV2Resolution } from "@/lib/saju/luck/annual/resolveAnnualSupplementFlowV2";
import type { AnnualImbalance } from "@/lib/saju/luck/annual/types";
import type {
  AdjustedClimateSummary,
  AdjustedMoistureAxis,
  AdjustedTemperatureAxis,
} from "@/lib/saju/types";

export type AnnualFlowNotice = {
  title: string;
  description: string;
};

export type BuildAnnualFlowNoticeInput = {
  year: number;
  presentationGate: AnnualPresentationGate;
  resolution: AnnualSupplementFlowV2Resolution;
  imbalances: AnnualImbalance[];
  natalClimate: AdjustedClimateSummary;
};

const DESCRIPTION_SUFFIX =
  "한쪽으로 치우치지 않도록 균형 있게 살펴보는 것이 좋아요.";

const BLOCKED_CLIMATE_OUTCOMES = new Set([
  "partially-mitigated",
  "mitigation-reinforcement-conflict",
  "unresolved",
]);

type WarmDryProfile = "warm-dry" | "warm-only" | "dry-only";
type ColdMoistProfile = "cold-moist" | "cold-only" | "moist-only";
type ClimateFlowProfile = WarmDryProfile | ColdMoistProfile;

function axisUsable(axis: AdjustedTemperatureAxis | AdjustedMoistureAxis): boolean {
  if (axis.status !== "resolved") return false;
  if (BLOCKED_CLIMATE_OUTCOMES.has(axis.outcome)) return false;
  return true;
}

function climateRiskImbalance(
  imbalances: AnnualImbalance[],
): AnnualImbalance | undefined {
  return imbalances.find((row) => row.kind === "CLIMATE_REINFORCEMENT_RISK");
}

function evidenceFlag(evidence: string[], token: string): boolean {
  return evidence.some((line) => line.includes(token));
}

function temperatureBias(
  climate: AdjustedClimateSummary,
  evidence: string[],
): AdjustedTemperatureAxis["value"] | null {
  if (axisUsable(climate.temperature)) return climate.temperature.value;
  const raw = evidence.find((line) => line.startsWith("climate-risk:temp="));
  if (!raw) return null;
  const value = raw.slice("climate-risk:temp=".length);
  if (value === "warm" || value === "cold" || value === "balanced") return value;
  return null;
}

function moistureBias(
  climate: AdjustedClimateSummary,
  evidence: string[],
): AdjustedMoistureAxis["value"] | null {
  if (axisUsable(climate.moisture)) return climate.moisture.value;
  const raw = evidence.find((line) => line.startsWith("climate-risk:moist="));
  if (!raw) return null;
  const value = raw.slice("climate-risk:moist=".length);
  if (value === "dry" || value === "moist" || value === "balanced") return value;
  return null;
}

function warmDryProfile(
  temperature: AdjustedTemperatureAxis["value"] | null,
  moisture: AdjustedMoistureAxis["value"] | null,
): WarmDryProfile | null {
  const warm = temperature === "warm";
  const dry = moisture === "dry";
  if (warm && dry) return "warm-dry";
  if (warm && !dry) return "warm-only";
  if (dry && !warm) return "dry-only";
  return null;
}

function coldMoistProfile(
  temperature: AdjustedTemperatureAxis["value"] | null,
  moisture: AdjustedMoistureAxis["value"] | null,
): ColdMoistProfile | null {
  const cold = temperature === "cold";
  const moist = moisture === "moist";
  if (cold && moist) return "cold-moist";
  if (cold && !moist) return "cold-only";
  if (moist && !cold) return "moist-only";
  return null;
}

function detectClimateFlowProfile(
  risk: AnnualImbalance,
  climate: AdjustedClimateSummary,
): ClimateFlowProfile | null {
  const evidence = risk.evidence;
  const temperature = temperatureBias(climate, evidence);
  const moisture = moistureBias(climate, evidence);

  if (evidenceFlag(evidence, "warm-or-dry")) {
    return warmDryProfile(temperature, moisture);
  }

  if (evidenceFlag(evidence, "cold-or-moist")) {
    return coldMoistProfile(temperature, moisture);
  }

  return null;
}

function buildDescription(profile: ClimateFlowProfile): string {
  switch (profile) {
    case "warm-dry":
      return `올해는 열과 건조의 흐름이 함께 나타날 수 있어, ${DESCRIPTION_SUFFIX}`;
    case "warm-only":
      return `올해는 따뜻한 흐름이 함께 나타날 수 있어, ${DESCRIPTION_SUFFIX}`;
    case "dry-only":
      return `올해는 건조한 흐름이 함께 나타날 수 있어, ${DESCRIPTION_SUFFIX}`;
    case "cold-moist":
      return `올해는 한기와 습기의 흐름이 함께 나타날 수 있어, ${DESCRIPTION_SUFFIX}`;
    case "cold-only":
      return `올해는 한기의 흐름이 함께 나타날 수 있어, ${DESCRIPTION_SUFFIX}`;
    case "moist-only":
      return `올해는 습기의 흐름이 함께 나타날 수 있어, ${DESCRIPTION_SUFFIX}`;
  }
}

function buildTitle(year: number): string {
  return `${year}년에는 이런 흐름도 함께 보여요`;
}

/**
 * Build flow notice for displayable-partial + NEW_CLIMATE_IMBALANCE only.
 */
export function buildAnnualFlowNotice(
  input: BuildAnnualFlowNoticeInput,
): AnnualFlowNotice | null {
  if (input.presentationGate.selectionDisplayStatus !== "displayable-partial") {
    return null;
  }

  if (!input.resolution.unresolvedImbalances.includes("NEW_CLIMATE_IMBALANCE")) {
    return null;
  }

  const risk = climateRiskImbalance(input.imbalances);
  if (!risk) return null;

  const profile = detectClimateFlowProfile(risk, input.natalClimate);
  if (!profile) return null;

  return {
    title: buildTitle(input.year),
    description: buildDescription(profile),
  };
}
