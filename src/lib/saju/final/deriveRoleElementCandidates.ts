/**
 * Role-scoped Final element candidates only.
 * Does not rank roles (G1–G5), select Final, or assign certainty.
 * R5 mids come from the same analyzeR5Corridors pass as the bottleneck grade.
 */

import { stemElement } from "@/lib/saju/constants/elements";
import { analyzeR5Corridors } from "@/lib/saju/final/analyzeR5Corridors";
import type {
  BottleneckLevel,
  RoleActivity,
  RoleActivityMap,
} from "@/lib/saju/final/types";
import type { StrengthObservations } from "@/lib/saju/observation/types";
import type {
  AdjustedClimateSummary,
  Element,
  FourPillars,
  NeedResolution,
  StrengthEvidence,
} from "@/lib/saju/types";

/** Day-master 생극 / 십신 axis maps (same as NeedCandidate strength relations). */
const RESOURCE_OF: Record<Element, Element> = {
  木: "水",
  火: "木",
  土: "火",
  金: "土",
  水: "金",
};
const OUTPUT_OF: Record<Element, Element> = {
  木: "火",
  火: "土",
  土: "金",
  金: "水",
  水: "木",
};
const WEALTH_OF: Record<Element, Element> = {
  木: "土",
  火: "金",
  土: "水",
  金: "木",
  水: "火",
};
const OFFICIAL_OF: Record<Element, Element> = {
  木: "金",
  火: "水",
  土: "木",
  金: "火",
  水: "土",
};

export type RoleElementCandidateMap = {
  R1: Element[];
  R2: Element[];
  R3: Element[];
  R4: Element[];
  R5: Element[];
  R6: Element[];
};

export type DeriveRoleElementCandidatesInput = {
  pillars: FourPillars;
  roleActivities: RoleActivityMap;
  r2Bottleneck: BottleneckLevel;
  r5Bottleneck: BottleneckLevel;
  evidence: StrengthEvidence;
  observations: StrengthObservations;
  climate: AdjustedClimateSummary;
  /** Optional hint only — never copied as a winner list. */
  needResolution?: NeedResolution;
};

function listR6ClimateGapElements(
  climate: AdjustedClimateSummary,
  roleActivity: RoleActivity,
): Element[] {
  if (roleActivity === "C") return [];

  const elements: Element[] = [];
  const push = (element: Element) => {
    if (!elements.includes(element)) elements.push(element);
  };

  // Resolved polar gaps only — unresolved axes do not mint candidates.
  // Contested dry paths may still appear as candidates (not winners).
  if (climate.temperature.status === "resolved" && climate.temperature.value === "cold") {
    if (climate.temperature.outcome === "unchanged" || climate.temperature.outcome === "partially-mitigated") {
      push("火");
    }
  }
  if (climate.temperature.status === "resolved" && climate.temperature.value === "warm") {
    if (climate.temperature.outcome === "unchanged" || climate.temperature.outcome === "partially-mitigated") {
      push("水");
    }
  }
  if (climate.moisture.status === "resolved" && climate.moisture.value === "dry") {
    if (climate.moisture.outcome === "unchanged" || climate.moisture.outcome === "partially-mitigated") {
      push("水");
    }
  }
  if (climate.moisture.status === "resolved" && climate.moisture.value === "moist") {
    if (climate.moisture.outcome === "unchanged" || climate.moisture.outcome === "partially-mitigated") {
      push("火");
    }
  }

  return elements;
}

/**
 * Builds per-role element candidate lists from Role Activity + bottlenecks + maps.
 * NeedResolution is accepted only as an unused optional hint slot (never copied).
 * R5 uses analyzeR5Corridors mids (same POSSIBLE/CLEAR corridors as the bottleneck).
 */
export function deriveRoleElementCandidates(
  input: DeriveRoleElementCandidatesInput,
): RoleElementCandidateMap {
  void input.needResolution;
  void input.pillars;

  const dayElement = stemElement(input.evidence.dayStem);
  const { roleActivities, r2Bottleneck, r5Bottleneck, evidence, observations, climate } =
    input;

  const R1 =
    roleActivities.R1 === "C" ? [] : ([RESOURCE_OF[dayElement]] as Element[]);

  const R2 =
    roleActivities.R2 === "C" || r2Bottleneck === "NOT"
      ? []
      : ([dayElement] as Element[]);

  const R3 =
    roleActivities.R3 === "C" ? [] : ([OUTPUT_OF[dayElement]] as Element[]);

  const R4 =
    roleActivities.R4 === "C"
      ? []
      : ([WEALTH_OF[dayElement], OFFICIAL_OF[dayElement]] as Element[]);

  // Shared corridor analysis — do not re-scan from BottleneckLevel alone.
  const r5Analysis = analyzeR5Corridors({
    evidence,
    observations,
    roleActivities,
  });
  const R5 =
    r5Bottleneck === "NOT" || roleActivities.R5 === "C"
      ? []
      : r5Analysis.candidateMids;

  const R6 = listR6ClimateGapElements(climate, roleActivities.R6);

  return { R1, R2, R3, R4, R5, R6 };
}
