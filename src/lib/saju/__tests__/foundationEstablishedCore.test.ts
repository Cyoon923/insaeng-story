/**
 * foundation-established → Core candidate = dayElement
 * (resolveStructuralElement fallback; R2 bottleneck / direction unchanged)
 */
import { describe, expect, it } from "vitest";
import { stemElement } from "@/lib/saju/constants/elements";
import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { buildNeedResolution } from "@/lib/saju/elements/needResolution";
import { buildStrengthSummary } from "@/lib/saju/elements/strengthSummary";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { derivePriorityRoles } from "@/lib/saju/final/derivePriorityRoles";
import { deriveR2Bottleneck } from "@/lib/saju/final/deriveR2Bottleneck";
import { deriveR5Bottleneck } from "@/lib/saju/final/deriveR5Bottleneck";
import { deriveRoleActivities } from "@/lib/saju/final/deriveRoleActivities";
import { deriveRoleElementCandidates } from "@/lib/saju/final/deriveRoleElementCandidates";
import { resolveFinalElement } from "@/lib/saju/final/resolveFinalElement";
import { resolveStructuralElement } from "@/lib/saju/final/resolveStructuralElement";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import type { FourPillars, HourPillar, Pillar } from "@/lib/saju/types";

function chart(partial: {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  hour: HourPillar;
}): FourPillars {
  return {
    ...partial,
    hourCertainty: partial.hour === "unknown" ? "unknown" : "confirmed",
    warnings: [],
  };
}

function resolveAll(pillars: FourPillars) {
  const evidence = collectStrengthEvidence(pillars);
  const observations = buildStrengthObservations(pillars, evidence);
  const summary = buildStrengthSummary(pillars);
  const climate = buildAdjustedClimateSummary(pillars);
  const needResolution = buildNeedResolution(pillars);
  const roleActivities = deriveRoleActivities({
    pillars,
    evidence,
    observations,
    climate,
  });
  const r2Bottleneck = deriveR2Bottleneck({
    pillars,
    summary,
    evidence,
    observations,
    roleActivities,
  });
  const r5Bottleneck = deriveR5Bottleneck({
    evidence,
    observations,
    roleActivities,
  });
  const roleElementCandidates = deriveRoleElementCandidates({
    pillars,
    roleActivities,
    r2Bottleneck,
    r5Bottleneck,
    evidence,
    observations,
    climate,
    needResolution,
  });
  const priority = derivePriorityRoles({
    pillars,
    summary,
    roleActivities,
    roleElementCandidates,
    r2Bottleneck,
    r5Bottleneck,
    evidence,
    observations,
    climate,
    hourStability: null,
  });
  const structural = resolveStructuralElement({
    primaryRoles: priority.primaryRoles,
    roleElementCandidates,
    roleActivities,
    r2Bottleneck,
    r5Bottleneck,
    summary,
    evidence,
    observations,
  });
  const fer = resolveFinalElement({
    pillars,
    summary,
    evidence,
    observations,
    climate,
    needResolution,
  });
  return { summary, r2Bottleneck, r5Bottleneck, structural, fer, roleActivities };
}

/** 辛酉/乙未/丙申/丁酉 — resource+peer, root shallow, R2 NOT */
const DING_YOU = chart({
  year: { stem: "辛", branch: "酉" },
  month: { stem: "乙", branch: "未" },
  day: { stem: "丙", branch: "申" },
  hour: { stem: "丁", branch: "酉" },
});

/** Same YMD + 戊戌 — resource only, peer absent → existing R2 POSSIBLE path */
const XU = chart({
  year: { stem: "辛", branch: "酉" },
  month: { stem: "乙", branch: "未" },
  day: { stem: "丙", branch: "申" },
  hour: { stem: "戊", branch: "戌" },
});

describe("foundation-established — golden 丁酉", () => {
  it("direction null, R2 NOT, Core 火 provisional via foundation-established", () => {
    const { summary, r2Bottleneck, structural, fer } = resolveAll(DING_YOU);

    expect(summary.directionCandidate).toBeNull();
    expect(summary.rootQuality).not.toBe("absent");
    expect(r2Bottleneck).toBe("NOT");

    expect(structural.status).toBe("resolved");
    expect(structural.element).toBe("火");
    expect(structural.reasons).toContain("foundation-established:day-element");

    expect(fer.finalElement).toBe("火");
    expect(fer.finalRole).toBe("R2");
    expect(fer.certainty).toBe("provisional");
    expect(fer.r2Bottleneck).toBe("NOT");
    expect(summary.directionCandidate).toBeNull();
  });
});

describe("foundation-established — counterexamples", () => {
  it("resource only, peer absent → does not use foundation; existing structural wins", () => {
    const { summary, r2Bottleneck, structural, fer } = resolveAll(XU);

    expect(summary.sourceBreakdown.peer.rootedVisible).toBe(false);
    expect(summary.sourceBreakdown.resource.rootedVisible).toBe(true);
    expect(r2Bottleneck).toBe("POSSIBLE");

    expect(structural.reasons).not.toContain("foundation-established:day-element");
    expect(fer.finalElement).toBe("火");
    expect(fer.certainty).toBe("provisional");
    // Existing R2 POSSIBLE-dominant path, not foundation
    expect(fer.reasons.some((r) => r.includes("r2-possible") || r.includes("possible-only"))).toBe(
      true,
    );
  });

  it("peer only, no rooted-visible resource → foundation not applied", () => {
    // 丙 day, peer 丁 hour, no 인성 stem; month avoids resource (use 午 with 丁/己 — 己 is output mid)
    // year 庚 = wealth; month 戊午 has no 乙; peer hour 丁
    const pillars = chart({
      year: { stem: "庚", branch: "申" },
      month: { stem: "戊", branch: "午" },
      day: { stem: "丙", branch: "子" },
      hour: { stem: "丁", branch: "酉" },
    });
    const evidence = collectStrengthEvidence(pillars);
    const hasResource = evidence.supportEvidence.items.some(
      (item) =>
        (item.shiShen === "정인" || item.shiShen === "편인") &&
        item.presence === "rooted-visible",
    );
    const hasPeer = evidence.supportEvidence.items.some(
      (item) =>
        (item.shiShen === "비견" || item.shiShen === "겁재") &&
        item.presence === "rooted-visible",
    );
    expect(hasPeer).toBe(true);
    expect(hasResource).toBe(false);

    const { structural, fer, summary } = resolveAll(pillars);
    expect(structural.reasons).not.toContain("foundation-established:day-element");
    if (structural.reasons.some((r) => r.startsWith("foundation-established:"))) {
      expect(structural.reasons).toContain("foundation-established:blocked-by-no-rooted-resource");
    }
    // Must not open Core solely via foundation
    if (fer.finalElement === stemElement(pillars.day.stem)) {
      expect(fer.decisionTrace.join(" ")).not.toContain("foundation-established:day-element");
    }
    void summary;
  });

  it("resource+peer but root absent → foundation blocked", () => {
    // Force structural path with overridden summary.rootQuality via resolveStructuralElement unit call
    const pillars = DING_YOU;
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);
    const summary = {
      ...buildStrengthSummary(pillars),
      rootQuality: "absent" as const,
    };
    const roleActivities = deriveRoleActivities({ pillars, evidence, observations });
    const r2Bottleneck = deriveR2Bottleneck({
      pillars,
      summary,
      evidence,
      observations,
      roleActivities,
    });
    const r5Bottleneck = deriveR5Bottleneck({
      evidence,
      observations,
      roleActivities,
    });
    const climate = buildAdjustedClimateSummary(pillars);
    const roleElementCandidates = deriveRoleElementCandidates({
      pillars,
      roleActivities,
      r2Bottleneck,
      r5Bottleneck,
      evidence,
      observations,
      climate,
    });

    const structural = resolveStructuralElement({
      primaryRoles: [], // no structural primary
      roleElementCandidates,
      roleActivities,
      r2Bottleneck,
      r5Bottleneck,
      summary,
      evidence,
      observations,
    });

    expect(structural.status).toBe("unresolved");
    expect(structural.reasons).toContain("foundation-established:blocked-by-root-absent");
    expect(structural.reasons).not.toContain("foundation-established:day-element");
  });

  it("existing resolved structural primary → foundation does not override", () => {
    const { structural, fer } = resolveAll(XU);
    expect(structural.status).toBe("resolved");
    expect(structural.reasons).toContain("structural-resolved");
    expect(structural.reasons).not.toContain("foundation-established:day-element");
    expect(fer.finalElement).toBe("火");
  });

  it("R5 CLEAR → foundation does not overwrite", () => {
    const pillars = DING_YOU;
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);
    const summary = buildStrengthSummary(pillars);
    const roleActivities = deriveRoleActivities({ pillars, evidence, observations });
    const climate = buildAdjustedClimateSummary(pillars);
    const roleElementCandidates = deriveRoleElementCandidates({
      pillars,
      roleActivities,
      r2Bottleneck: "NOT",
      r5Bottleneck: "CLEAR",
      evidence,
      observations,
      climate,
    });

    // Empty structural primary list + R5 CLEAR must not open foundation
    const structural = resolveStructuralElement({
      primaryRoles: [],
      roleElementCandidates,
      roleActivities,
      r2Bottleneck: "NOT",
      r5Bottleneck: "CLEAR",
      summary,
      evidence,
      observations,
    });

    expect(structural.reasons).toContain("foundation-established:blocked-by-r5-clear");
    expect(structural.reasons).not.toContain("foundation-established:day-element");
    expect(structural.status).toBe("unresolved");
  });

  it("contested R6 only (no foundation) → does not confirm Core from R6", () => {
    // No rooted peer/resource supports — climate may still list 水
    const pillars = chart({
      year: { stem: "庚", branch: "戌" },
      month: { stem: "戊", branch: "午" },
      day: { stem: "丙", branch: "子" },
      hour: { stem: "戊", branch: "戌" },
    });
    const evidence = collectStrengthEvidence(pillars);
    const hasResource = evidence.supportEvidence.items.some(
      (item) =>
        (item.shiShen === "정인" || item.shiShen === "편인") &&
        item.presence === "rooted-visible",
    );
    const hasPeer = evidence.supportEvidence.items.some(
      (item) =>
        (item.shiShen === "비견" || item.shiShen === "겁재") &&
        item.presence === "rooted-visible",
    );
    expect(hasResource || hasPeer).toBe(false);

    const { structural, fer } = resolveAll(pillars);
    expect(structural.reasons).not.toContain("foundation-established:day-element");
    // Contested climate must not become confirmed/provisional Core via R6 alone
    if (fer.finalElement === "水") {
      expect(fer.certainty).not.toBe("confirmed");
      expect(fer.reasons.join(" ")).toMatch(/contested|unresolved/);
    }
    expect(fer.certainty === "unresolved" || fer.finalElement !== "水").toBe(true);
  });
});
