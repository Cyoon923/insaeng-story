import { collectStrengthEvidence, hiddenStemSourceKey } from "@/lib/saju/elements/strength";
import type {
  FourPillars,
  HiddenRelationNote,
  RootHit,
  RootQuality,
  StrengthDirectionCandidate,
  StrengthEvidence,
  StrengthResolution,
  StrengthSideEvidenceItem,
  StrengthSummary,
} from "@/lib/saju/types";

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

  return {
    certainty: evidence.hourUnknown ? "partial" : "complete",
    resolution: resolutionOf(directionCandidate),
    directionCandidate,
    seasonalPhase: phase,
    rootQuality,
    strongSideEvidence,
    weakSideEvidence,
    hiddenSupportNotes,
    hiddenPressureNotes,
    conflicts: conflictsOf({
      phase,
      rootQuality,
      direction: directionCandidate,
      rootedSupport: hasRooted(evidence.supportEvidence.items, "rooted-visible"),
      rootedPressure: hasRooted(evidence.pressureEvidence.items, "rooted-visible"),
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
    omittedSlots: evidence.omittedSlots,
  };
}
