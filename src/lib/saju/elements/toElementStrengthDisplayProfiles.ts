/**
 * Strength Display Score — presentation normalization only.
 *
 * Policy: conversation-confirmed Display Score design
 * (exclusive bands + lexicographic ordinal within level).
 *
 * NOT a mingli judgment engine:
 * - Does not recompute / promote / demote strengthLevel
 * - Does not use Need / Supplement / Core / climate / pillars
 * - displayScore is a visualization coordinate (0–100 band), not a user-facing “points” label
 */

import {
  resolveElementRootStatus,
  type ElementStrengthLevel,
  type ElementStrengthProfile,
  type ElementStrengthProfileSet,
  type ElementStrengthRootStatus,
} from "@/lib/saju/elements/buildElementStrengthProfiles";
import type { Element, ElementPresenceKind, SeasonPhase } from "@/lib/saju/types";
import { ELEMENTS } from "@/lib/saju/types";

export type ElementStrengthDisplayCertainty = "resolved" | "partial";

export type ElementStrengthDisplayProfile = {
  element: Element;
  strengthLevel: ElementStrengthLevel;
  /** Visualization coordinate only — not a mingli score / UI “N점” label. */
  displayScore: number;
  certainty: ElementStrengthDisplayCertainty;
};

export type ElementStrengthDisplaySet = {
  profiles: ElementStrengthDisplayProfile[];
  certainty: ElementStrengthDisplayCertainty;
};

export type StrengthDisplayBand = {
  lo: number;
  hi: number;
};

/** Exclusive presentation bands — must not overlap across levels. */
export const STRENGTH_DISPLAY_BANDS: Record<ElementStrengthLevel, StrengthDisplayBand> = {
  "very-weak": { lo: 8, hi: 20 },
  weak: { lo: 24, hi: 40 },
  balanced: { lo: 44, hi: 60 },
  strong: { lo: 64, hi: 80 },
  "very-strong": { lo: 84, hi: 96 },
};

const LEVEL_ORDER: ElementStrengthLevel[] = [
  "very-weak",
  "weak",
  "balanced",
  "strong",
  "very-strong",
];

/** Higher = stronger within-band (lexicographic first component). */
const SEASON_RANK: Record<SeasonPhase, number> = {
  왕: 4,
  상: 3,
  휴: 2,
  수: 1,
  사: 0,
};

const PRESENCE_RANK: Record<ElementPresenceKind, number> = {
  "rooted-visible": 3,
  "unrooted-visible": 2,
  "hidden-only": 1,
  absent: 0,
};

const ROOT_RANK: Record<ElementStrengthRootStatus, number> = {
  "root-clear": 3,
  "root-present": 2,
  "root-shallow": 1,
  "root-absent": 0,
};

/**
 * Lexicographic ordinal tuple (higher = more outward within the same level).
 * Components are never additively summed into a score.
 */
export type StrengthDisplayOrdinalTuple = readonly [
  seasonRank: number,
  presenceRank: number,
  rootRank: number,
  hasBranchMain: 0 | 1,
  exactStemVisible: 0 | 1,
  hasMonthOutlet: 0 | 1,
  hasVisibleStem: 0 | 1,
];

export function bandMidpoint(level: ElementStrengthLevel): number {
  const { lo, hi } = STRENGTH_DISPLAY_BANDS[level];
  return Math.round((lo + hi) / 2);
}

export function buildStrengthDisplayOrdinalTuple(
  profile: ElementStrengthProfile,
): StrengthDisplayOrdinalTuple {
  const { rawEvidence } = profile;
  const rootStatus = resolveElementRootStatus(rawEvidence.rootHits);
  const hasBranchMain = rawEvidence.clusterAnchors.some((anchor) => anchor.layer === "branch");
  const hasMonthOutlet = rawEvidence.monthOutletSlots.length > 0;
  const hasVisibleStem = rawEvidence.visibleSlots.length > 0;

  return [
    SEASON_RANK[rawEvidence.seasonPhase],
    PRESENCE_RANK[rawEvidence.presence],
    ROOT_RANK[rootStatus],
    hasBranchMain ? 1 : 0,
    rawEvidence.exactStemVisible ? 1 : 0,
    hasMonthOutlet ? 1 : 0,
    hasVisibleStem ? 1 : 0,
  ];
}

export function compareStrengthDisplayOrdinalTuples(
  a: StrengthDisplayOrdinalTuple,
  b: StrengthDisplayOrdinalTuple,
): number {
  for (let i = 0; i < a.length; i += 1) {
    const diff = a[i]! - b[i]!;
    if (diff !== 0) return diff;
  }
  return 0;
}

function tupleKey(tuple: StrengthDisplayOrdinalTuple): string {
  return tuple.join(",");
}

/**
 * Map distinct ordinal ranks (0 = lowest … n-1 = highest) onto [lo, hi].
 * Single distinct rank → midpoint.
 */
export function scoreFromBandRank(level: ElementStrengthLevel, rank: number, rankCount: number): number {
  const { lo, hi } = STRENGTH_DISPLAY_BANDS[level];
  if (rankCount <= 1) return bandMidpoint(level);
  const t = rank / (rankCount - 1);
  return Math.round(lo + (hi - lo) * t);
}

function mapCertainty(
  certainty: ElementStrengthProfileSet["certainty"],
): ElementStrengthDisplayCertainty {
  return certainty === "partial" ? "partial" : "resolved";
}

function assertProfilesCoverElements(profiles: ElementStrengthProfile[]): Map<Element, ElementStrengthProfile> {
  const byElement = new Map<Element, ElementStrengthProfile>();
  for (const profile of profiles) {
    byElement.set(profile.element, profile);
  }
  for (const element of ELEMENTS) {
    if (!byElement.has(element)) {
      throw new Error(`ElementStrengthProfileSet missing element: ${element}`);
    }
  }
  return byElement;
}

function assignResolvedScores(
  byElement: Map<Element, ElementStrengthProfile>,
): Map<Element, number> {
  const scores = new Map<Element, number>();

  for (const level of LEVEL_ORDER) {
    const members = ELEMENTS.map((element) => byElement.get(element)!).filter(
      (profile) => profile.strengthLevel === level,
    );
    if (members.length === 0) continue;

    const withTuples = members.map((profile) => ({
      element: profile.element,
      tuple: buildStrengthDisplayOrdinalTuple(profile),
    }));

    const uniqueSorted = [...withTuples]
      .map((row) => row.tuple)
      .filter((tuple, index, all) => all.findIndex((t) => tupleKey(t) === tupleKey(tuple)) === index)
      .sort(compareStrengthDisplayOrdinalTuples);

    const rankByKey = new Map<string, number>();
    uniqueSorted.forEach((tuple, rank) => {
      rankByKey.set(tupleKey(tuple), rank);
    });

    const rankCount = uniqueSorted.length;
    for (const row of withTuples) {
      const rank = rankByKey.get(tupleKey(row.tuple))!;
      scores.set(row.element, scoreFromBandRank(level, rank, rankCount));
    }
  }

  return scores;
}

/**
 * Convert Strength ProfileSet → DisplaySet for pentagon / radar coordinates only.
 */
export function toElementStrengthDisplayProfiles(
  profileSet: ElementStrengthProfileSet,
): ElementStrengthDisplaySet {
  const certainty = mapCertainty(profileSet.certainty);
  const byElement = assertProfilesCoverElements(profileSet.profiles);

  const scores =
    certainty === "partial"
      ? null
      : assignResolvedScores(byElement);

  const profiles: ElementStrengthDisplayProfile[] = ELEMENTS.map((element) => {
    const source = byElement.get(element)!;
    const displayScore =
      certainty === "partial"
        ? bandMidpoint(source.strengthLevel)
        : scores!.get(element)!;

    return {
      element,
      strengthLevel: source.strengthLevel,
      displayScore,
      certainty,
    };
  });

  return { profiles, certainty };
}

export function displayProfileOf(
  set: ElementStrengthDisplaySet,
  element: Element,
): ElementStrengthDisplayProfile {
  const profile = set.profiles.find((row) => row.element === element);
  if (!profile) {
    throw new Error(`Missing ElementStrengthDisplayProfile for ${element}`);
  }
  return profile;
}
