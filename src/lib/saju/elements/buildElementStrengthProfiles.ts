/**
 * Unyul Element Strength Profiles v1
 *
 * Policy source: docs/unyul-element-strength-rules-v1.md
 * - No score / normalize
 * - No Need / Supplement / Core / climate / DM leaning
 * - No 합·충·형·파·해 modifiers
 */

import { stemElement } from "@/lib/saju/constants/elements";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { analyzeElementPresence } from "@/lib/saju/elements/presence";
import { analyzeStemRoots } from "@/lib/saju/elements/roots";
import { seasonPhaseOf } from "@/lib/saju/elements/season";
import { buildElementClusters } from "@/lib/saju/observation/buildElementClusters";
import type { ElementClusterAnchor } from "@/lib/saju/observation/types";
import type {
  Element,
  ElementPresenceKind,
  FourPillars,
  PillarSlot,
  RootHit,
  SeasonPhase,
  Stem,
} from "@/lib/saju/types";
import { ELEMENTS, STEMS } from "@/lib/saju/types";

export type ElementStrengthLevel =
  | "very-weak"
  | "weak"
  | "balanced"
  | "strong"
  | "very-strong";

export type ElementStrengthRootStatus =
  | "root-absent"
  | "root-shallow"
  | "root-present"
  | "root-clear";

export type ElementStrengthRawEvidence = {
  seasonPhase: SeasonPhase;
  presence: ElementPresenceKind;
  visibleSlots: PillarSlot[];
  rootedSlots: PillarSlot[];
  monthOutletSlots: PillarSlot[];
  clusterAnchors: ElementClusterAnchor[];
  rootHits: RootHit[];
  exactStemVisible: boolean;
};

export type ElementStrengthProfile = {
  element: Element;
  rawEvidence: ElementStrengthRawEvidence;
  strengthLevel: ElementStrengthLevel;
  reasons: string[];
};

export type ElementStrengthProfileSet = {
  profiles: ElementStrengthProfile[];
  certainty: "complete" | "partial";
  omittedSlots: PillarSlot[];
};

function stemsOfElement(element: Element): Stem[] {
  return STEMS.filter((stem) => stemElement(stem) === element);
}

function dedupeRootHits(hits: RootHit[]): RootHit[] {
  const seen = new Set<string>();
  const out: RootHit[] = [];
  for (const hit of hits) {
    const key = `${hit.slot}:${hit.branch}:${hit.hiddenStem}:${hit.role}:${hit.polarity}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
  }
  return out;
}

export function resolveElementRootStatus(hits: RootHit[]): ElementStrengthRootStatus {
  if (hits.some((hit) => hit.role === "정기")) return "root-clear";
  if (hits.some((hit) => hit.role === "중기")) return "root-present";
  if (hits.some((hit) => hit.role === "여기")) return "root-shallow";
  return "root-absent";
}

function collectRootHitsForElement(pillars: FourPillars, element: Element): RootHit[] {
  const hits: RootHit[] = [];
  for (const stem of stemsOfElement(element)) {
    hits.push(...analyzeStemRoots(pillars, stem).hits);
  }
  return dedupeRootHits(hits);
}

function matchVeryStrong(input: {
  seasonPhase: SeasonPhase;
  presence: ElementPresenceKind;
  rootStatus: ElementStrengthRootStatus;
  hasBranchMain: boolean;
  exactStemVisible: boolean;
  hasMonthOutlet: boolean;
}): boolean {
  if (input.seasonPhase !== "왕") return false;
  if (input.presence !== "rooted-visible") return false;
  if (input.rootStatus !== "root-clear") return false;
  return input.hasBranchMain || input.exactStemVisible || input.hasMonthOutlet;
}

function matchStrong(input: {
  seasonPhase: SeasonPhase;
  presence: ElementPresenceKind;
  rootStatus: ElementStrengthRootStatus;
}): boolean {
  // S1 (covers S2 as well after very-strong miss)
  if (input.seasonPhase !== "왕" && input.seasonPhase !== "상") return false;
  if (input.presence !== "rooted-visible") return false;
  return input.rootStatus === "root-clear" || input.rootStatus === "root-present";
}

function matchBalanced(input: {
  seasonPhase: SeasonPhase;
  presence: ElementPresenceKind;
  rootStatus: ElementStrengthRootStatus;
}): boolean {
  const { seasonPhase, presence, rootStatus } = input;

  // B1
  if (
    (seasonPhase === "휴" || seasonPhase === "수") &&
    presence === "rooted-visible" &&
    (rootStatus === "root-clear" || rootStatus === "root-present" || rootStatus === "root-shallow")
  ) {
    return true;
  }

  // B2
  if (
    (seasonPhase === "왕" || seasonPhase === "상") &&
    (presence === "rooted-visible" || presence === "unrooted-visible") &&
    (rootStatus === "root-shallow" || rootStatus === "root-absent")
  ) {
    return true;
  }

  // B3
  if (
    (seasonPhase === "왕" || seasonPhase === "상" || seasonPhase === "휴") &&
    presence === "hidden-only" &&
    rootStatus === "root-clear"
  ) {
    return true;
  }

  // B4
  if (
    seasonPhase === "사" &&
    presence === "rooted-visible" &&
    (rootStatus === "root-clear" || rootStatus === "root-present")
  ) {
    return true;
  }

  return false;
}

function matchWeak(input: {
  seasonPhase: SeasonPhase;
  presence: ElementPresenceKind;
  rootStatus: ElementStrengthRootStatus;
}): boolean {
  const { seasonPhase, presence, rootStatus } = input;

  // W1 — 왕/상 + unrooted is already B2; remaining unrooted → weak
  if (presence === "unrooted-visible") return true;

  // W2
  if (
    presence === "hidden-only" &&
    (rootStatus === "root-present" || rootStatus === "root-shallow")
  ) {
    return true;
  }

  // W3
  if (
    presence === "hidden-only" &&
    rootStatus === "root-clear" &&
    (seasonPhase === "수" || seasonPhase === "사")
  ) {
    return true;
  }

  // W4
  if (
    (seasonPhase === "사" || seasonPhase === "수") &&
    presence === "rooted-visible" &&
    rootStatus === "root-shallow"
  ) {
    return true;
  }

  return false;
}

function matchVeryWeak(input: {
  seasonPhase: SeasonPhase;
  presence: ElementPresenceKind;
  rootStatus: ElementStrengthRootStatus;
}): boolean {
  if (input.presence === "absent") return true;
  if (input.presence === "hidden-only" && input.rootStatus === "root-absent") return true;
  if (
    input.presence === "hidden-only" &&
    input.rootStatus === "root-shallow" &&
    input.seasonPhase === "사"
  ) {
    return true;
  }
  return false;
}

function resolveStrengthLevel(input: {
  seasonPhase: SeasonPhase;
  presence: ElementPresenceKind;
  rootStatus: ElementStrengthRootStatus;
  hasBranchMain: boolean;
  exactStemVisible: boolean;
  hasMonthOutlet: boolean;
}): { level: ElementStrengthLevel; clause: string } {
  if (matchVeryStrong(input)) {
    return { level: "very-strong", clause: "level:very-strong" };
  }
  if (matchStrong(input)) {
    return { level: "strong", clause: "level:strong:S1" };
  }
  if (matchBalanced(input)) {
    if (
      (input.seasonPhase === "휴" || input.seasonPhase === "수") &&
      input.presence === "rooted-visible"
    ) {
      return { level: "balanced", clause: "level:balanced:B1" };
    }
    if (
      (input.seasonPhase === "왕" || input.seasonPhase === "상") &&
      (input.rootStatus === "root-shallow" || input.rootStatus === "root-absent")
    ) {
      return { level: "balanced", clause: "level:balanced:B2" };
    }
    if (input.presence === "hidden-only" && input.rootStatus === "root-clear") {
      return { level: "balanced", clause: "level:balanced:B3" };
    }
    if (input.seasonPhase === "사" && input.presence === "rooted-visible") {
      return { level: "balanced", clause: "level:balanced:B4" };
    }
    return { level: "balanced", clause: "level:balanced" };
  }
  if (matchWeak(input)) {
    if (input.presence === "unrooted-visible") {
      return { level: "weak", clause: "level:weak:W1" };
    }
    if (
      input.presence === "hidden-only" &&
      (input.rootStatus === "root-present" || input.rootStatus === "root-shallow")
    ) {
      return { level: "weak", clause: "level:weak:W2" };
    }
    if (
      input.presence === "hidden-only" &&
      input.rootStatus === "root-clear" &&
      (input.seasonPhase === "수" || input.seasonPhase === "사")
    ) {
      return { level: "weak", clause: "level:weak:W3" };
    }
    return { level: "weak", clause: "level:weak:W4" };
  }
  if (matchVeryWeak(input)) {
    if (input.presence === "absent") {
      return { level: "very-weak", clause: "level:very-weak:V1" };
    }
    if (input.presence === "hidden-only" && input.rootStatus === "root-absent") {
      return { level: "very-weak", clause: "level:very-weak:V2" };
    }
    return { level: "very-weak", clause: "level:very-weak:V3" };
  }
  return { level: "balanced", clause: "fallback-balanced" };
}

function buildProfileForElement(
  pillars: FourPillars,
  element: Element,
  clusterAnchors: ElementClusterAnchor[],
  evidenceExactStemVisible: boolean,
  hourUnknown: boolean,
): ElementStrengthProfile {
  const seasonPhase = seasonPhaseOf(element, pillars.month.branch);
  const presenceAnalysis = analyzeElementPresence(pillars, element);
  const rootHits = collectRootHitsForElement(pillars, element);
  const rootStatus = resolveElementRootStatus(rootHits);
  const hasBranchMain = clusterAnchors.some((anchor) => anchor.layer === "branch");
  const hasMonthOutlet = presenceAnalysis.monthOutletSlots.length > 0;

  const resolved = resolveStrengthLevel({
    seasonPhase,
    presence: presenceAnalysis.presence,
    rootStatus,
    hasBranchMain,
    exactStemVisible: evidenceExactStemVisible,
    hasMonthOutlet,
  });

  const reasons: string[] = [
    resolved.clause,
    `season:${seasonPhase}`,
    `presence:${presenceAnalysis.presence}`,
    `root:${rootStatus}`,
    hasBranchMain ? "branch-main:yes" : "branch-main:no",
    evidenceExactStemVisible ? "exact-stem-visible:yes" : "exact-stem-visible:no",
    hasMonthOutlet ? "month-outlet:yes" : "month-outlet:no",
    "guard:no-count",
    "guard:no-need-core-supplement-climate",
  ];

  if (hourUnknown) {
    reasons.push("hour-unknown-partial");
  }

  if (
    presenceAnalysis.presence === "hidden-only" &&
    rootStatus === "root-absent" &&
    presenceAnalysis.rootedSlots.length > 0
  ) {
    reasons.push("trace:rooted-slots-without-root-hits");
  }

  return {
    element,
    rawEvidence: {
      seasonPhase,
      presence: presenceAnalysis.presence,
      visibleSlots: [...presenceAnalysis.visibleSlots],
      rootedSlots: [...presenceAnalysis.rootedSlots],
      monthOutletSlots: [...presenceAnalysis.monthOutletSlots],
      clusterAnchors: [...clusterAnchors],
      rootHits,
      exactStemVisible: evidenceExactStemVisible,
    },
    strengthLevel: resolved.level,
    reasons,
  };
}

/**
 * Build 木火土金水 ElementStrengthProfile set from natal pillars.
 * Uses only v1 axes in docs/unyul-element-strength-rules-v1.md.
 */
export function buildElementStrengthProfiles(pillars: FourPillars): ElementStrengthProfileSet {
  const evidence = collectStrengthEvidence(pillars);
  const clusters = buildElementClusters(pillars, evidence);
  const clusterByElement = new Map(clusters.map((cluster) => [cluster.element, cluster.anchors]));
  const hourUnknown = pillars.hour === "unknown";

  const profiles = ELEMENTS.map((element) => {
    const exactStemVisible = evidence.branchRelationEvidence.items.some(
      (item) => item.element === element && item.exactStemVisible,
    );
    return buildProfileForElement(
      pillars,
      element,
      clusterByElement.get(element) ?? [],
      exactStemVisible,
      hourUnknown,
    );
  });

  return {
    profiles,
    certainty: hourUnknown ? "partial" : "complete",
    omittedSlots: hourUnknown ? [...evidence.omittedSlots] : [],
  };
}

export function profileOf(
  set: ElementStrengthProfileSet,
  element: Element,
): ElementStrengthProfile {
  const profile = set.profiles.find((row) => row.element === element);
  if (!profile) {
    throw new Error(`Missing ElementStrengthProfile for ${element}`);
  }
  return profile;
}
