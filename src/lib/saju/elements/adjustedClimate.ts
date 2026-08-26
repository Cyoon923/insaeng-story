import { collectClimateEvidence } from "@/lib/saju/elements/climate";
import type {
  AdjustedClimateSummary,
  AdjustedMoistureAxis,
  AdjustedTemperatureAxis,
  ClimateElement,
  ClimateElementQuality,
  ClimateFactor,
  ClimateMitigationOutcome,
  ClimateMoisture,
  ClimateTemperature,
  FourPillars,
} from "@/lib/saju/types";

const FIRE_STEMS = new Set(["丙", "丁"]);
const WATER_STEMS = new Set(["壬", "癸"]);
const FIRE_BRANCHES = new Set(["巳", "午"]);
const WATER_BRANCHES = new Set(["亥", "子"]);

function isWeakQuality(quality: ClimateElementQuality): boolean {
  return quality === "absent" || quality === "hidden" || quality === "shallow" || quality === "branch-only";
}

function isSubstantial(quality: ClimateElementQuality): boolean {
  return quality === "substantial";
}

function isClear(quality: ClimateElementQuality): boolean {
  return quality === "clear";
}

function isStrong(quality: ClimateElementQuality): boolean {
  return quality === "clear" || quality === "substantial";
}

function qualityOf(element: ClimateElement, factors: ClimateFactor[]): ClimateElementQuality {
  const items = factors.filter((factor) => factor.element === element);
  if (items.length === 0) return "absent";

  const stems = element === "火" ? FIRE_STEMS : WATER_STEMS;
  const branches = element === "火" ? FIRE_BRANCHES : WATER_BRANCHES;
  const visibleStem = items.some((factor) => factor.layer === "stem" && factor.sourceStem && stems.has(factor.sourceStem));
  const representativeBranch = items.some(
    (factor) => factor.layer === "branch" && factor.sourceBranch && branches.has(factor.sourceBranch),
  );
  const hiddenRoot = items.some((factor) => factor.layer === "hiddenStem");
  const rooted = items.some((factor) => factor.presence === "rooted-visible" || factor.presence === "hidden-only");

  if (visibleStem && representativeBranch) return "clear";
  if (visibleStem && (hiddenRoot || rooted)) return "substantial";
  if (visibleStem) return "shallow";
  if (hiddenRoot) return "hidden";
  if (representativeBranch || items.some((factor) => factor.layer === "branch")) return "branch-only";
  return "hidden";
}

type PolarValue = "cold" | "warm" | "dry" | "moist";

type AdjustPolarResult = {
  status: "resolved" | "unresolved";
  value: PolarValue | "balanced" | null;
  outcome: ClimateMitigationOutcome;
  reasons: string[];
  conflicts: string[];
};

function adjustPolar(input: {
  base: PolarValue;
  mitigationQuality: ClimateElementQuality;
  reinforcementQuality: ClimateElementQuality;
  mitigationElement: ClimateElement;
}): AdjustPolarResult {
  const { base, mitigationQuality, reinforcementQuality, mitigationElement } = input;

  // CLI-030: mitigation + reinforcement both strong
  if (isStrong(mitigationQuality) && isStrong(reinforcementQuality)) {
    return {
      status: "unresolved",
      value: null,
      outcome: "mitigation-reinforcement-conflict",
      reasons: ["substantial-mitigation-and-reinforcement"],
      conflicts: ["substantial-mitigation-and-reinforcement"],
    };
  }

  // CLI-031: substantial mitigation, reinforcement not strong — residual base polarity
  if (isSubstantial(mitigationQuality)) {
    const reason =
      mitigationElement === "火" ? "substantial-fire-mitigation-needs-review" : "substantial-water-mitigation-needs-review";
    return {
      status: "unresolved",
      value: base,
      outcome: "partially-mitigated",
      reasons: [reason],
      conflicts: [],
    };
  }

  // CLI-032: clear mitigation → one step to balanced
  if (isClear(mitigationQuality)) {
    return { status: "resolved", value: "balanced", outcome: "balanced", reasons: [], conflicts: [] };
  }

  // CLI-033: weak mitigation → keep base
  if (isWeakQuality(mitigationQuality)) {
    return { status: "resolved", value: base, outcome: "unchanged", reasons: [], conflicts: [] };
  }

  return { status: "unresolved", value: null, outcome: "unresolved", reasons: [], conflicts: [] };
}

export function buildAdjustedClimateSummary(pillars: FourPillars): AdjustedClimateSummary {
  const evidence = collectClimateEvidence(pillars);
  const fireQuality = qualityOf("火", evidence.factors);
  const waterQuality = qualityOf("水", evidence.factors);
  const { temperature: baseTemperature, moisture: baseMoisture } = evidence.baseClimate;

  const unresolvedReasons: string[] = [];
  const conflicts: string[] = [];

  let temperature: AdjustedTemperatureAxis;
  if (baseTemperature === "balanced") {
    // CLI-028: base balanced temperature is not moved by Fire/Water
    temperature = { status: "resolved", value: "balanced", outcome: "unchanged" };
    if (isStrong(fireQuality) && isStrong(waterQuality)) {
      conflicts.push("both-fire-and-water-clear-or-substantial");
    }
  } else if (baseTemperature === "cold") {
    const adjusted = adjustPolar({
      base: "cold",
      mitigationQuality: fireQuality,
      reinforcementQuality: waterQuality,
      mitigationElement: "火",
    });
    temperature = {
      status: adjusted.status,
      value: adjusted.value as ClimateTemperature | null,
      outcome: adjusted.outcome,
    };
    unresolvedReasons.push(...adjusted.reasons);
    conflicts.push(...adjusted.conflicts);
  } else {
    const adjusted = adjustPolar({
      base: "warm",
      mitigationQuality: waterQuality,
      reinforcementQuality: fireQuality,
      mitigationElement: "水",
    });
    temperature = {
      status: adjusted.status,
      value: adjusted.value as ClimateTemperature | null,
      outcome: adjusted.outcome,
    };
    unresolvedReasons.push(...adjusted.reasons);
    conflicts.push(...adjusted.conflicts);
  }

  let moisture: AdjustedMoistureAxis;
  if (baseMoisture === "balanced") {
    moisture = { status: "resolved", value: "balanced", outcome: "unchanged" };
  } else if (baseMoisture === "moist") {
    const adjusted = adjustPolar({
      base: "moist",
      mitigationQuality: fireQuality,
      reinforcementQuality: waterQuality,
      mitigationElement: "火",
    });
    moisture = {
      status: adjusted.status,
      value: adjusted.value as ClimateMoisture | null,
      outcome: adjusted.outcome,
    };
    for (const reason of adjusted.reasons) {
      if (!unresolvedReasons.includes(reason)) unresolvedReasons.push(reason);
    }
    for (const conflict of adjusted.conflicts) {
      if (!conflicts.includes(conflict)) conflicts.push(conflict);
    }
  } else {
    const adjusted = adjustPolar({
      base: "dry",
      mitigationQuality: waterQuality,
      reinforcementQuality: fireQuality,
      mitigationElement: "水",
    });
    moisture = {
      status: adjusted.status,
      value: adjusted.value as ClimateMoisture | null,
      outcome: adjusted.outcome,
    };
    for (const reason of adjusted.reasons) {
      if (!unresolvedReasons.includes(reason)) unresolvedReasons.push(reason);
    }
    for (const conflict of adjusted.conflicts) {
      if (!conflicts.includes(conflict)) conflicts.push(conflict);
    }
  }

  if (evidence.hourUnknown && (isSubstantial(fireQuality) || isSubstantial(waterQuality))) {
    unresolvedReasons.push("hour-unknown-may-change-climate-factors");
  }

  return {
    certainty: evidence.hourUnknown ? "partial" : "complete",
    baseClimate: evidence.baseClimate,
    temperature,
    moisture,
    fireQuality,
    waterQuality,
    mitigationFactors: evidence.factors.filter(
      (factor) => factor.temperatureRole === "mitigation" || factor.moistureRole === "mitigation",
    ),
    reinforcementFactors: evidence.factors.filter(
      (factor) => factor.temperatureRole === "reinforcement" || factor.moistureRole === "reinforcement",
    ),
    conflicts,
    unresolvedReasons,
    omittedSlots: evidence.omittedSlots,
  };
}
