import { collectStrengthEvidence, hiddenStemSourceKey } from "@/lib/saju/elements/strength";
import type {
  FourPillars,
  HiddenRelationNote,
  MixedConflictLevel,
  MixedStrengthPattern,
  PressureShiShen,
  RootHit,
  RootQuality,
  StrengthDirectionCandidate,
  StrengthDirectionSensitivity,
  StrengthEvidence,
  StrengthResolution,
  StrengthSideEvidenceItem,
  StrengthSourceBreakdown,
  StrengthSourcePresence,
  StrengthSummary,
  SupportShiShen,
  UnresolvedStrengthReason,
} from "@/lib/saju/types";

function emptySourcePresence(): StrengthSourcePresence {
  return { rootedVisible: false, unrootedVisible: false };
}

function emptySourceBreakdown(): StrengthSourceBreakdown {
  return {
    peer: emptySourcePresence(),
    resource: emptySourcePresence(),
    output: emptySourcePresence(),
    wealth: emptySourcePresence(),
    officer: emptySourcePresence(),
  };
}

function markPresence(target: StrengthSourcePresence, presence: string): void {
  if (presence === "rooted-visible") target.rootedVisible = true;
  if (presence === "unrooted-visible") target.unrootedVisible = true;
}

function supportSourceKind(shiShen: SupportShiShen): "peer" | "resource" {
  return shiShen === "비견" || shiShen === "겁재" ? "peer" : "resource";
}

function pressureSourceKind(shiShen: PressureShiShen): "output" | "wealth" | "officer" {
  if (shiShen === "식신" || shiShen === "상관") return "output";
  if (shiShen === "편재" || shiShen === "정재") return "wealth";
  return "officer";
}

/** Diagnostic aggregation only — never passed into decideDirection. */
function buildSourceBreakdown(
  supportItems: StrengthEvidence["supportEvidence"]["items"],
  pressureItems: StrengthEvidence["pressureEvidence"]["items"],
): StrengthSourceBreakdown {
  const breakdown = emptySourceBreakdown();
  for (const item of supportItems) {
    markPresence(breakdown[supportSourceKind(item.shiShen)], item.presence);
  }
  for (const item of pressureItems) {
    markPresence(breakdown[pressureSourceKind(item.shiShen)], item.presence);
  }
  return breakdown;
}

function rootQualityOf(hits: RootHit[]): RootQuality {
  if (hits.some((hit) => hit.role === "정기")) return "clear";
  if (hits.some((hit) => hit.role === "중기")) return "present";
  if (hits.some((hit) => hit.role === "여기")) return "shallow";
  return "absent";
}

function hiddenNote(item: StrengthEvidence["branchRelationEvidence"]["items"][number]): HiddenRelationNote {
  return {
    slot: item.slot,
    branch: item.branch,
    hiddenStem: item.hiddenStem,
    hiddenRole: item.hiddenRole,
    shiShen: item.shiShen,
    elementPhase: item.elementPhase,
    elementPresence: item.presence,
    exactStemVisible: item.exactStemVisible,
    exactStemVisibleAt: item.exactStemVisibleAt,
    sourceKey: item.sourceKey,
  };
}

function hasRooted(items: Array<{ presence: string }>, value: "rooted-visible" | "unrooted-visible"): boolean {
  return items.some((item) => item.presence === value);
}

function mixedPatternOf(input: {
  direction: StrengthDirectionCandidate;
  phase: StrengthEvidence["seasonalEvidence"]["phase"];
  rootQuality: RootQuality;
  rootedSupport: boolean;
  rootedPressure: boolean;
}): MixedStrengthPattern | null {
  if (input.direction !== "mixed") return null;

  const { phase, rootQuality, rootedSupport, rootedPressure } = input;
  const weakSeason = phase === "수" || phase === "사";
  const substantialRoot = rootQuality === "clear" || rootQuality === "present";

  if (weakSeason && rootQuality === "shallow" && rootedPressure) return "shallow-root-under-pressure";
  if (phase === "상" && rootQuality === "absent" && rootedSupport) return "help-season-absent-root";
  if (phase === "휴" && rootQuality !== "absent" && (rootedSupport || rootedPressure)) return "neutral-season-conflict";
  if (phase === "왕" && substantialRoot && rootedPressure) return "strong-base-with-pressure";
  if (weakSeason && substantialRoot && !rootedSupport && rootedPressure) return "weak-season-root-under-pressure";
  if (weakSeason && rootedSupport) return "weak-season-with-support";
  return "other-mixed";
}

function mixedConflictLevelOf(input: {
  direction: StrengthDirectionCandidate;
  phase: StrengthEvidence["seasonalEvidence"]["phase"];
  rootQuality: RootQuality;
  rootedSupport: boolean;
  rootedPressure: boolean;
}): MixedConflictLevel | null {
  if (input.direction !== "mixed") return null;

  const { phase, rootQuality, rootedSupport, rootedPressure } = input;
  const weakSeason = phase === "수" || phase === "사";
  const rootPresent = rootQuality !== "absent";

  if (weakSeason && rootPresent && rootedSupport && rootedPressure) return "multi-axis";
  if (rootedSupport && rootedPressure) return "visible-visible";
  if (weakSeason && rootedSupport && !rootedPressure) return "seasonal-visible";
  if (weakSeason && !rootedSupport && rootedPressure) {
    return rootQuality === "shallow" ? "root-visible" : "seasonal-visible";
  }
  if (phase === "상" && rootQuality === "absent") return "root-visible";
  if (phase === "왕" && rootedPressure && !rootedSupport) return "seasonal-visible";
  return "multi-axis";
}

function unresolvedStrengthReasonsOf(input: {
  direction: StrengthDirectionCandidate;
  phase: StrengthEvidence["seasonalEvidence"]["phase"];
  hourUnknown: boolean;
  visibleSupport: StrengthEvidence["supportEvidence"]["items"];
  visiblePressure: StrengthEvidence["pressureEvidence"]["items"];
  hiddenSupportNotes: HiddenRelationNote[];
  hiddenPressureNotes: HiddenRelationNote[];
}): UnresolvedStrengthReason[] {
  if (input.direction !== null) return [];

  const reasons: UnresolvedStrengthReason[] = [];
  const allSupportUnrooted =
    input.visibleSupport.length > 0 && input.visibleSupport.every((item) => item.presence === "unrooted-visible");
  const allPressureUnrooted =
    input.visiblePressure.length > 0 && input.visiblePressure.every((item) => item.presence === "unrooted-visible");
  const hiddenConflict = input.hiddenSupportNotes.length > 0 && input.hiddenPressureNotes.length > 0;
  const helpOrRest = input.phase === "상" || input.phase === "휴";

  if (helpOrRest) reasons.push("seasonal-phase-insufficient");
  if (allSupportUnrooted || allPressureUnrooted) reasons.push("only-unrooted-visible-evidence");
  reasons.push("insufficient-visible-direction");
  if (hiddenConflict && !helpOrRest) reasons.push("hidden-relations-conflict");
  if (input.hourUnknown) reasons.push("hour-unknown-sensitive");
  return reasons;
}

function decideDirection(input: {
  phase: StrengthEvidence["seasonalEvidence"]["phase"];
  rootQuality: RootQuality;
  visibleSupport: StrengthEvidence["supportEvidence"]["items"];
  visiblePressure: StrengthEvidence["pressureEvidence"]["items"];
}): StrengthDirectionCandidate {
  const { phase, rootQuality, visibleSupport, visiblePressure } = input;
  const rootedSupport = hasRooted(visibleSupport, "rooted-visible");
  const rootedPressure = hasRooted(visiblePressure, "rooted-visible");
  const rootedRoot = rootQuality === "clear" || rootQuality === "present" || rootQuality === "shallow";

  if (phase === "왕" && rootQuality === "clear" && rootedSupport && !rootedPressure) {
    return "leaning-strong";
  }

  if ((phase === "사" || phase === "수") && rootQuality === "absent" && rootedPressure && !rootedSupport) {
    return "leaning-weak";
  }

  const substantialStrong = phase === "왕" || rootedRoot || rootedSupport;
  const substantialWeak = phase === "수" || phase === "사" || rootQuality === "absent" || rootedPressure;

  if (phase === "왕" && rootQuality === "clear" && rootedPressure) return "mixed";
  if (phase === "사" && rootedRoot && rootedSupport) return "mixed";
  if (phase === "수" && rootedRoot && (rootedSupport || rootedPressure)) return "mixed";
  if (substantialStrong && substantialWeak) return "mixed";

  return null;
}

function resolutionOf(direction: StrengthDirectionCandidate): StrengthResolution {
  if (direction === "leaning-strong" || direction === "leaning-weak") return "clear-direction";
  if (direction === "mixed") return "mixed";
  return "unresolved";
}

/** Diagnostic only — does not alter decideDirection, resolution, certainty, or Need. */
function directionSensitivityOf(
  hourUnknown: boolean,
  direction: StrengthDirectionCandidate,
): StrengthDirectionSensitivity {
  if (
    hourUnknown &&
    (direction === "leaning-strong" || direction === "leaning-weak")
  ) {
    return "hour-unknown-provisional";
  }
  return null;
}

function conflictsOf(input: {
  phase: StrengthEvidence["seasonalEvidence"]["phase"];
  rootQuality: RootQuality;
  direction: StrengthDirectionCandidate;
  rootedSupport: boolean;
  rootedPressure: boolean;
  unrootedSupport: boolean;
}): string[] {
  const conflicts: string[] = [];
  if (input.direction !== "mixed" && input.direction !== "leaning-weak" && input.direction !== "leaning-strong") {
    return conflicts;
  }
  if (input.phase === "왕" && input.rootedPressure) {
    conflicts.push("왕·clear root와 visible rooted pressure가 동시에 존재");
  }
  if (input.phase === "사" && (input.rootQuality === "clear" || input.rootQuality === "present" || input.rootQuality === "shallow") && input.rootedSupport) {
    conflicts.push("사와 clear/present/shallow root·visible rooted support가 동시에 존재");
  }
  if (input.unrootedSupport && input.rootedPressure) {
    conflicts.push("visible support는 unrooted-visible이고 visible pressure는 rooted-visible");
  }
  if (input.rootedSupport && input.rootedPressure) {
    conflicts.push("visible rooted support와 visible rooted pressure가 동시에 존재");
  }
  return conflicts;
}

function unresolvedReasonsOf(input: {
  direction: StrengthDirectionCandidate;
  phase: StrengthEvidence["seasonalEvidence"]["phase"];
  hourUnknown: boolean;
  visiblePressure: StrengthEvidence["pressureEvidence"]["items"];
  hiddenSupportNotes: HiddenRelationNote[];
  hiddenPressureNotes: HiddenRelationNote[];
}): string[] {
  if (input.direction !== null) return [];

  const reasons: string[] = [];
  const hasPressure = input.visiblePressure.length > 0;
  const allPressureUnrooted = hasPressure && input.visiblePressure.every((item) => item.presence === "unrooted-visible");
  if (allPressureUnrooted) {
    reasons.push("visible pressure가 모두 unrooted-visible");
  }
  if (input.hiddenSupportNotes.length > 0 && input.hiddenPressureNotes.length > 0) {
    reasons.push("hidden support와 hidden pressure가 동시에 존재");
  }
  if (input.phase === "상" || input.phase === "휴") {
    reasons.push(`계절이 ${input.phase}이므로 방향을 닫지 않음`);
  }
  if (input.hourUnknown) {
    reasons.push("시간 미상이며 방향 Evidence가 약함");
  }
  if (reasons.length === 0) {
    reasons.push("현재 규칙으로 leaning-strong / leaning-weak / mixed를 고르기 어려움");
  }
  return reasons;
}

export function buildStrengthSummary(pillars: FourPillars): StrengthSummary {
  const evidence = collectStrengthEvidence(pillars);
  const phase = evidence.seasonalEvidence.phase;
  const rootQuality = rootQualityOf(evidence.rootEvidence.hits);
  const rootKeys = new Set(
    evidence.rootEvidence.hits.map((hit) =>
      hiddenStemSourceKey(hit.slot, hit.branch, hit.hiddenStem, hit.role),
    ),
  );

  const strongSideEvidence: StrengthSideEvidenceItem[] = [];
  const weakSideEvidence: StrengthSideEvidenceItem[] = [];

  if (phase === "왕") {
    strongSideEvidence.push({ kind: "seasonal", quality: "왕" });
  } else if (phase === "상") {
    strongSideEvidence.push({ kind: "seasonal", quality: "상", help: true });
  } else if (phase === "수" || phase === "사") {
    weakSideEvidence.push({ kind: "seasonal", quality: phase });
  }

  if (rootQuality === "absent") {
    weakSideEvidence.push({ kind: "root", quality: "absent" });
  } else {
    strongSideEvidence.push({ kind: "root", quality: rootQuality });
  }

  for (const item of evidence.supportEvidence.items) {
    strongSideEvidence.push({
      kind: "visible-support",
      quality: item.presence === "rooted-visible" ? "rooted-visible" : "unrooted-visible",
      slot: item.slot,
      stem: item.stem,
      shiShen: item.shiShen,
      presence: item.presence,
    });
  }

  for (const item of evidence.pressureEvidence.items) {
    weakSideEvidence.push({
      kind: "visible-pressure",
      quality: item.presence === "rooted-visible" ? "rooted-visible" : "unrooted-visible",
      slot: item.slot,
      stem: item.stem,
      shiShen: item.shiShen,
      presence: item.presence,
    });
  }

  const hiddenSupportNotes = evidence.branchRelationEvidence.items
    .filter((item) => item.relationSide === "support" && !rootKeys.has(item.sourceKey))
    .map(hiddenNote);

  const hiddenPressureNotes = evidence.branchRelationEvidence.items
    .filter((item) => item.relationSide === "pressure")
    .map(hiddenNote);

  const directionCandidate = decideDirection({
    phase,
    rootQuality,
    visibleSupport: evidence.supportEvidence.items,
    visiblePressure: evidence.pressureEvidence.items,
  });
  const rootedSupport = hasRooted(evidence.supportEvidence.items, "rooted-visible");
  const rootedPressure = hasRooted(evidence.pressureEvidence.items, "rooted-visible");
  const mixedInput = {
    direction: directionCandidate,
    phase,
    rootQuality,
    rootedSupport,
    rootedPressure,
  };

  return {
    certainty: evidence.hourUnknown ? "partial" : "complete",
    resolution: resolutionOf(directionCandidate),
    directionCandidate,
    directionSensitivity: directionSensitivityOf(evidence.hourUnknown, directionCandidate),
    seasonalPhase: phase,
    rootQuality,
    strongSideEvidence,
    weakSideEvidence,
    hiddenSupportNotes,
    hiddenPressureNotes,
    sourceBreakdown: buildSourceBreakdown(
      evidence.supportEvidence.items,
      evidence.pressureEvidence.items,
    ),
    conflicts: conflictsOf({
      phase,
      rootQuality,
      direction: directionCandidate,
      rootedSupport,
      rootedPressure,
      unrootedSupport: hasRooted(evidence.supportEvidence.items, "unrooted-visible"),
    }),
    unresolvedReasons: unresolvedReasonsOf({
      direction: directionCandidate,
      phase,
      hourUnknown: evidence.hourUnknown,
      visiblePressure: evidence.pressureEvidence.items,
      hiddenSupportNotes,
      hiddenPressureNotes,
    }),
    mixedPattern: mixedPatternOf(mixedInput),
    mixedConflictLevel: mixedConflictLevelOf(mixedInput),
    unresolvedStrengthReasons: unresolvedStrengthReasonsOf({
      direction: directionCandidate,
      phase,
      hourUnknown: evidence.hourUnknown,
      visibleSupport: evidence.supportEvidence.items,
      visiblePressure: evidence.pressureEvidence.items,
      hiddenSupportNotes,
      hiddenPressureNotes,
    }),
    omittedSlots: evidence.omittedSlots,
  };
}
