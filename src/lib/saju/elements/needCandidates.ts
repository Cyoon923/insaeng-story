import { stemElement } from "@/lib/saju/constants/elements";
import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { analyzeElementPresence } from "@/lib/saju/elements/presence";
import { seasonPhaseOf } from "@/lib/saju/elements/season";
import { buildStrengthSummary } from "@/lib/saju/elements/strengthSummary";
import type {
  ClimateNeedStatus,
  Element,
  ElementPresenceKind,
  FourPillars,
  NeedCandidate,
  NeedCandidateSet,
  NeedDirection,
  SeasonPhase,
} from "@/lib/saju/types";

const RESOURCE: Record<Element, Element> = { 木: "水", 火: "木", 土: "火", 金: "土", 水: "金" };
const OUTPUT: Record<Element, Element> = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };
const WEALTH: Record<Element, Element> = { 木: "土", 火: "金", 土: "水", 金: "木", 水: "火" };
const OFFICIAL: Record<Element, Element> = { 木: "金", 火: "水", 土: "木", 金: "火", 水: "土" };

export function suppressedForLeaningStrong(presence: ElementPresenceKind, phase: SeasonPhase): boolean {
  return presence === "rooted-visible" && (phase === "왕" || phase === "상");
}

function climateStatus(temperatureUnresolved: boolean, moistureUnresolved: boolean): ClimateNeedStatus {
  if (temperatureUnresolved && moistureUnresolved) return "unresolved";
  if (temperatureUnresolved || moistureUnresolved) return "axis-unresolved";
  return "ready";
}

function makeCandidate(input: {
  element: Element;
  source: NeedCandidate["source"];
  reasons: string[];
  direction: NeedDirection;
  presence: ElementPresenceKind;
  certainty: NeedCandidate["certainty"];
  status: NeedCandidate["status"];
  evidenceRefs: string[];
}): NeedCandidate {
  return {
    element: input.element,
    source: input.source,
    reasons: input.reasons,
    direction: input.direction,
    existingPresence: input.presence,
    alreadyPresent: input.presence !== "absent",
    certainty: input.certainty,
    status: input.status,
    evidenceRefs: input.evidenceRefs,
  };
}

function strengthRelationCandidate(input: {
  pillars: FourPillars;
  element: Element;
  direction: NeedDirection;
  reason: string;
  relation: string;
  dayElement: Element;
  directionCandidate: string;
  certainty: NeedCandidate["certainty"];
  suppressible: boolean;
}): NeedCandidate {
  const presence = analyzeElementPresence(input.pillars, input.element).presence;
  const phase = seasonPhaseOf(input.element, input.pillars.month.branch);
  const suppressed = input.suppressible && suppressedForLeaningStrong(presence, phase);
  return makeCandidate({
    element: input.element,
    source: "strength",
    reasons: suppressed ? [input.reason, "already-established-relation"] : [input.reason],
    direction: input.direction,
    presence,
    certainty: input.certainty,
    status: suppressed ? "suppressed" : "candidate",
    evidenceRefs: [
      `strength.directionCandidate=${input.directionCandidate}`,
      `dayElement=${input.dayElement}`,
      `relation=${input.relation}`,
    ],
  });
}

export function buildNeedCandidateSet(pillars: FourPillars): NeedCandidateSet {
  const strength = buildStrengthSummary(pillars);
  const climate = buildAdjustedClimateSummary(pillars);
  const dayElement = stemElement(pillars.day.stem);

  let strengthNeedCandidates: NeedCandidate[] = [];
  let strengthNeedStatus: NeedCandidateSet["strengthNeedStatus"] = "unresolved";

  if (strength.directionCandidate === "leaning-weak") {
    strengthNeedStatus = "ready";
    strengthNeedCandidates = [
      strengthRelationCandidate({
        pillars,
        element: dayElement,
        direction: "peer",
        reason: "strengthen-day-master-peer",
        relation: "peer",
        dayElement,
        directionCandidate: "leaning-weak",
        certainty: strength.certainty,
        suppressible: false,
      }),
      strengthRelationCandidate({
        pillars,
        element: RESOURCE[dayElement],
        direction: "resource",
        reason: "strengthen-day-master-resource",
        relation: "resource",
        dayElement,
        directionCandidate: "leaning-weak",
        certainty: strength.certainty,
        suppressible: false,
      }),
    ];
  } else if (strength.directionCandidate === "leaning-strong") {
    strengthNeedStatus = "ready";
    strengthNeedCandidates = [
      strengthRelationCandidate({
        pillars,
        element: OUTPUT[dayElement],
        direction: "output",
        reason: "drain-day-master-output",
        relation: "output",
        dayElement,
        directionCandidate: "leaning-strong",
        certainty: strength.certainty,
        suppressible: true,
      }),
      strengthRelationCandidate({
        pillars,
        element: WEALTH[dayElement],
        direction: "wealth",
        reason: "use-day-master-wealth",
        relation: "wealth",
        dayElement,
        directionCandidate: "leaning-strong",
        certainty: strength.certainty,
        suppressible: true,
      }),
      strengthRelationCandidate({
        pillars,
        element: OFFICIAL[dayElement],
        direction: "official",
        reason: "control-day-master-official",
        relation: "official",
        dayElement,
        directionCandidate: "leaning-strong",
        certainty: strength.certainty,
        suppressible: true,
      }),
    ];
  }

  const climateNeedCandidates: NeedCandidate[] = [];
  const climateByElement = new Map<Element, NeedCandidate>();

  function addClimate(element: Element, reason: string, ref: string) {
    const existing = climateByElement.get(element);
    if (existing) {
      existing.reasons.push(reason);
      existing.evidenceRefs.push(ref);
      return;
    }
    const presence = analyzeElementPresence(pillars, element).presence;
    const candidate = makeCandidate({
      element,
      source: "climate",
      reasons: [reason],
      direction: "climate",
      presence,
      certainty: climate.certainty,
      status: "candidate",
      evidenceRefs: [ref],
    });
    climateByElement.set(element, candidate);
    climateNeedCandidates.push(candidate);
  }

  if (climate.temperature.status === "resolved" && climate.temperature.value === "cold") {
    addClimate("火", "climate-temperature-cold", "climate.temperature=cold");
  }
  if (climate.temperature.status === "resolved" && climate.temperature.value === "warm") {
    addClimate("水", "climate-temperature-warm", "climate.temperature=warm");
  }
  if (climate.moisture.status === "resolved" && climate.moisture.value === "dry") {
    addClimate("水", "climate-moisture-dry", "climate.moisture=dry");
  }

  return {
    strengthNeedCandidates,
    climateNeedCandidates,
    strengthNeedStatus,
    climateNeedStatus: climateStatus(
      climate.temperature.status === "unresolved",
      climate.moisture.status === "unresolved",
    ),
  };
}
