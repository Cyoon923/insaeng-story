import { analyzeElementPresence } from "@/lib/saju/elements/presence";
import { collectElementMaterials } from "@/lib/saju/elements/materials";
import { baseClimateOf } from "@/lib/saju/data/baseClimate";
import type {
  BaseClimate,
  Branch,
  ClimateElement,
  ClimateEvidence,
  ClimateFactor,
  ClimateFactorRole,
  ClimateMoisture,
  ClimateTemperature,
  ElementLayer,
  FourPillars,
  Stem,
} from "@/lib/saju/types";

const FIRE_STEMS = new Set<Stem>(["丙", "丁"]);
const WATER_STEMS = new Set<Stem>(["壬", "癸"]);
const FIRE_BRANCHES = new Set<Branch>(["巳", "午"]);
const WATER_BRANCHES = new Set<Branch>(["亥", "子"]);

function climateElementOfStem(stem: Stem): ClimateElement | null {
  if (FIRE_STEMS.has(stem)) return "火";
  if (WATER_STEMS.has(stem)) return "水";
  return null;
}

function climateElementOfBranch(branch: Branch): ClimateElement | null {
  if (FIRE_BRANCHES.has(branch)) return "火";
  if (WATER_BRANCHES.has(branch)) return "水";
  return null;
}

function temperatureRole(temperature: ClimateTemperature, element: ClimateElement): ClimateFactorRole {
  if (temperature === "cold") return element === "火" ? "mitigation" : "reinforcement";
  if (temperature === "warm") return element === "火" ? "reinforcement" : "mitigation";
  return "contextual";
}

function moistureRole(moisture: ClimateMoisture, element: ClimateElement): ClimateFactorRole {
  if (moisture === "dry") return element === "水" ? "mitigation" : "reinforcement";
  if (moisture === "moist") return element === "火" ? "mitigation" : "reinforcement";
  return "contextual";
}

function layerFlags(layer: ElementLayer): { visible: boolean; hidden: boolean } {
  if (layer === "hiddenStem") return { visible: false, hidden: true };
  return { visible: true, hidden: false };
}

export function collectClimateEvidence(pillars: FourPillars): ClimateEvidence {
  const monthBranch = pillars.month.branch;
  const baseClimate: BaseClimate = baseClimateOf(monthBranch);
  const hourUnknown = pillars.hour === "unknown";
  const materials = collectElementMaterials(pillars);
  const firePresence = analyzeElementPresence(pillars, "火").presence;
  const waterPresence = analyzeElementPresence(pillars, "水").presence;
  const factors: ClimateFactor[] = [];

  for (const item of materials.items) {
    if (item.slot === "month" && item.layer !== "stem") continue;

    let element: ClimateElement | null = null;
    if (item.layer === "branch" && item.branch) {
      element = climateElementOfBranch(item.branch);
    } else if (item.stem) {
      element = climateElementOfStem(item.stem);
    }
    if (!element) continue;

    const flags = layerFlags(item.layer);
    factors.push({
      element,
      slot: item.slot,
      layer: item.layer,
      ...(item.stem ? { sourceStem: item.stem } : {}),
      ...(item.branch ? { sourceBranch: item.branch } : {}),
      ...(item.role ? { role: item.role } : {}),
      presence: element === "火" ? firePresence : waterPresence,
      visible: flags.visible,
      hidden: flags.hidden,
      temperatureRole: temperatureRole(baseClimate.temperature, element),
      moistureRole: moistureRole(baseClimate.moisture, element),
    });
  }

  return {
    monthBranch,
    baseClimate,
    factors,
    hourUnknown,
    includedSlots: hourUnknown ? ["year", "month", "day"] : ["year", "month", "day", "hour"],
    omittedSlots: hourUnknown ? ["hour"] : [],
  };
}
