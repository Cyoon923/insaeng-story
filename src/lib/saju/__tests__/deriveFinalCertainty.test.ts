import { describe, expect, it } from "vitest";
import { deriveFinalCertainty } from "@/lib/saju/final/deriveFinalCertainty";
import type { FinalCandidateView } from "@/lib/saju/final/deriveFinalCertainty";
import { deriveHourStability } from "@/lib/saju/final/deriveHourStability";
import { resolveStructureVsClimate } from "@/lib/saju/final/resolveStructureVsClimate";
import { resolveStructuralElement } from "@/lib/saju/final/resolveStructuralElement";
import { deriveRoleElementCandidates } from "@/lib/saju/final/deriveRoleElementCandidates";
import { derivePriorityRoles } from "@/lib/saju/final/derivePriorityRoles";
import { deriveRoleActivities } from "@/lib/saju/final/deriveRoleActivities";
import { deriveR2Bottleneck } from "@/lib/saju/final/deriveR2Bottleneck";
import { deriveR5Bottleneck } from "@/lib/saju/final/deriveR5Bottleneck";
import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { buildNeedResolution } from "@/lib/saju/elements/needResolution";
import { buildStrengthSummary } from "@/lib/saju/elements/strengthSummary";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import type {
  BottleneckLevel,
  HourStability,
  RoleActivityMap,
} from "@/lib/saju/final/types";
import type {
  AdjustedClimateSummary,
  FourPillars,
  HourPillar,
  NeedResolution,
  Pillar,
  StrengthEvidence,
  StrengthSummary,
} from "@/lib/saju/types";

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

const ROLES: RoleActivityMap = {
  R1: "C",
  R2: "B",
  R3: "A",
  R4: "A",
  R5: "B",
  R6: "B",
};

function baseSummary(direction: StrengthSummary["directionCandidate"] = "leaning-weak"): StrengthSummary {
  const summary = buildStrengthSummary(
    chart({
      year: { stem: "甲", branch: "子" },
      month: { stem: "甲", branch: "子" },
      day: { stem: "甲", branch: "子" },
      hour: { stem: "甲", branch: "子" },
    }),
  );
  return { ...summary, directionCandidate: direction };
}

function clearClimate(): AdjustedClimateSummary {
  const climate = buildAdjustedClimateSummary(
    chart({
      year: { stem: "甲", branch: "子" },
      month: { stem: "甲", branch: "子" },
      day: { stem: "甲", branch: "子" },
      hour: { stem: "甲", branch: "子" },
    }),
  );
  return {
    ...climate,
    conflicts: [],
    temperature: { status: "resolved", value: "balanced", outcome: "unchanged" },
    moisture: { status: "resolved", value: "balanced", outcome: "unchanged" },
  };
}

function grade(partial: {
  candidate: FinalCandidateView;
  summary?: StrengthSummary;
  roles?: Partial<RoleActivityMap>;
  r2?: BottleneckLevel;
  r5?: BottleneckLevel;
  hourStability?: HourStability | null;
  climate?: AdjustedClimateSummary;
  needResolution?: NeedResolution;
  evidence?: StrengthEvidence;
}) {
  return deriveFinalCertainty({
    candidate: partial.candidate,
    summary: partial.summary ?? baseSummary(),
    roleActivities: { ...ROLES, ...partial.roles },
    r2Bottleneck: partial.r2 ?? "NOT",
    r5Bottleneck: partial.r5 ?? "NOT",
    hourStability: partial.hourStability === undefined ? null : partial.hourStability,
    climate: partial.climate ?? clearClimate(),
    needResolution: partial.needResolution,
    evidence: partial.evidence,
  });
}

describe("deriveFinalCertainty", () => {
  it("1. candidate unresolved → unresolved", () => {
    const result = grade({
      candidate: { role: null, element: null, status: "unresolved", source: null },
    });
    expect(result.certainty).toBe("unresolved");
  });

  it("2. R2 POSSIBLE-DOMINANT resolved → provisional", () => {
    const result = grade({
      candidate: { role: "R2", element: "火", status: "resolved", source: "structure" },
      r2: "POSSIBLE",
      roles: { R2: "B" },
      summary: baseSummary("mixed"),
      hourStability: null,
    });
    expect(result.certainty).toBe("provisional");
    expect(result.reasons).toContain("provisional:r2-possible-dominant");
  });

  it("3. R2 CLEAR + hour confirmed + 비충돌 → confirmed", () => {
    const result = grade({
      candidate: { role: "R2", element: "木", status: "resolved", source: "structure" },
      r2: "CLEAR",
      roles: { R1: "C", R2: "B" },
      summary: baseSummary("leaning-weak"),
      hourStability: null,
    });
    expect(result.certainty).toBe("confirmed");
  });

  it("4. hour C → unresolved", () => {
    const result = grade({
      candidate: { role: "R2", element: "火", status: "resolved", source: "structure" },
      r2: "CLEAR",
      hourStability: "C",
    });
    expect(result.certainty).toBe("unresolved");
    expect(result.reasons).toContain("unresolved:hour-stability-c");
  });

  it("5. hour B → provisional", () => {
    const result = grade({
      candidate: { role: "R2", element: "火", status: "resolved", source: "structure" },
      r2: "CLEAR",
      hourStability: "B",
      summary: baseSummary("leaning-weak"),
    });
    expect(result.certainty).toBe("provisional");
    expect(result.reasons).toContain("provisional:hour-stability-b");
  });

  it("6. structure resolved + contested climate 참고 → provisional", () => {
    const pillars = chart({
      year: { stem: "辛", branch: "酉" },
      month: { stem: "乙", branch: "未" },
      day: { stem: "丙", branch: "申" },
      hour: { stem: "戊", branch: "戌" },
    });
    const needResolution = buildNeedResolution(pillars);
    const result = grade({
      candidate: { role: "R2", element: "火", status: "resolved", source: "structure" },
      r2: "POSSIBLE",
      summary: { ...baseSummary("mixed") },
      needResolution,
      hourStability: null,
    });
    expect(result.certainty).toBe("provisional");
  });

  it("7. clean R3 CLEAR급 + leaning + hour confirmed → confirmed", () => {
    const evidence = collectStrengthEvidence(
      chart({
        year: { stem: "甲", branch: "寅" },
        month: { stem: "甲", branch: "寅" },
        day: { stem: "甲", branch: "子" },
        hour: { stem: "丙", branch: "午" },
      }),
    );
    const summary = baseSummary("leaning-strong");
    summary.sourceBreakdown = {
      ...summary.sourceBreakdown,
      output: { rootedVisible: true, unrootedVisible: false },
    };
    const result = grade({
      candidate: { role: "R3", element: "火", status: "resolved", source: "structure" },
      roles: { R3: "A" },
      summary,
      evidence,
      hourStability: null,
      r2: "NOT",
      r5: "NOT",
    });
    expect(result.certainty).toBe("confirmed");
  });

  it("8. R5 CLEAR + clean → confirmed", () => {
    const result = grade({
      candidate: { role: "R5", element: "木", status: "resolved", source: "structure" },
      r5: "CLEAR",
      roles: { R5: "B" },
      summary: baseSummary("leaning-weak"),
      hourStability: null,
    });
    expect(result.certainty).toBe("confirmed");
  });

  it("9. R6 clear 단독 clean → confirmed", () => {
    const result = grade({
      candidate: { role: "R6", element: "水", status: "resolved", source: "climate" },
      roles: { R6: "B" },
      summary: baseSummary(null),
      climate: clearClimate(),
      hourStability: null,
    });
    expect(result.certainty).toBe("confirmed");
  });

  it("10. mixed + resolved 1개 → 기본 provisional", () => {
    const result = grade({
      candidate: { role: "R1", element: "水", status: "resolved", source: "structure" },
      roles: { R1: "A" },
      summary: baseSummary("mixed"),
      r2: "NOT",
      hourStability: null,
      // no clear R1 evidence → not confirmed
    });
    expect(result.certainty).toBe("provisional");
    expect(result.reasons).toContain("provisional:mixed-or-null-direction");
  });
});

describe("deriveFinalCertainty representatives", () => {
  function pipeline(pillars: FourPillars) {
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);
    const summary = buildStrengthSummary(pillars);
    const climate = buildAdjustedClimateSummary(pillars);
    const needResolution = buildNeedResolution(pillars);
    const roleActivities = deriveRoleActivities({ pillars, evidence, observations, climate });
    const r2Bottleneck = deriveR2Bottleneck({
      pillars,
      summary,
      evidence,
      observations,
      roleActivities,
    });
    const r5Bottleneck = deriveR5Bottleneck({ evidence, observations, roleActivities });
    const roleElementCandidates = deriveRoleElementCandidates({
      pillars,
      roleActivities,
      r2Bottleneck,
      r5Bottleneck,
      evidence,
      observations,
      climate,
    });
    const hourStability =
      pillars.hour === "unknown" ? deriveHourStability({ pillars }) : null;
    const { primaryRoles } = derivePriorityRoles({
      pillars,
      summary,
      roleActivities,
      roleElementCandidates,
      r2Bottleneck,
      r5Bottleneck,
      evidence,
      observations,
      climate,
      hourStability,
    });
    const structural = resolveStructuralElement({
      primaryRoles,
      roleElementCandidates,
      roleActivities,
      r2Bottleneck,
      r5Bottleneck,
      summary,
      evidence,
      observations,
    });
    const candidate = resolveStructureVsClimate({
      structuralResolution: structural,
      roleElementCandidates,
      roleActivities,
      climate,
      needResolution,
    });
    const certainty = deriveFinalCertainty({
      candidate,
      summary,
      roleActivities,
      r2Bottleneck,
      r5Bottleneck,
      hourStability,
      climate,
      needResolution,
      evidence,
      observations,
    });
    return { candidate, certainty, hourStability, r2Bottleneck };
  }

  it("MX-1981 → provisional", () => {
    const { certainty, candidate } = pipeline(
      chart({
        year: { stem: "辛", branch: "酉" },
        month: { stem: "乙", branch: "未" },
        day: { stem: "丙", branch: "申" },
        hour: { stem: "戊", branch: "戌" },
      }),
    );
    expect(candidate.element).toBe("火");
    expect(certainty.certainty).toBe("provisional");
  });

  it("HU-LS → unresolved (hour C)", () => {
    const { certainty, hourStability } = pipeline(
      chart({
        year: { stem: "甲", branch: "寅" },
        month: { stem: "甲", branch: "寅" },
        day: { stem: "甲", branch: "子" },
        hour: "unknown",
      }),
    );
    expect(hourStability).toBe("C");
    expect(certainty.certainty).toBe("unresolved");
  });

  it("NL-gaphae → unresolved (hour C)", () => {
    const { certainty, hourStability } = pipeline(
      chart({
        year: { stem: "甲", branch: "寅" },
        month: { stem: "辛", branch: "亥" },
        day: { stem: "庚", branch: "子" },
        hour: "unknown",
      }),
    );
    expect(hourStability).toBe("C");
    expect(certainty.certainty).toBe("unresolved");
  });

  it("LW-gapyu → unresolved (hour C)", () => {
    const { certainty, hourStability } = pipeline(
      chart({
        year: { stem: "甲", branch: "酉" },
        month: { stem: "庚", branch: "酉" },
        day: { stem: "甲", branch: "酉" },
        hour: "unknown",
      }),
    );
    expect(hourStability).toBe("C");
    expect(certainty.certainty).toBe("unresolved");
  });
});
