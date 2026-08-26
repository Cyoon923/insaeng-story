import { stemElement } from "@/lib/saju/constants/elements";
import { describe, expect, it } from "vitest";
import { resolveStructuralElement } from "@/lib/saju/final/resolveStructuralElement";
import type { RoleElementCandidateMap } from "@/lib/saju/final/deriveRoleElementCandidates";
import { deriveRoleElementCandidates } from "@/lib/saju/final/deriveRoleElementCandidates";
import { derivePriorityRoles } from "@/lib/saju/final/derivePriorityRoles";
import { deriveRoleActivities } from "@/lib/saju/final/deriveRoleActivities";
import { deriveR2Bottleneck } from "@/lib/saju/final/deriveR2Bottleneck";
import { deriveR5Bottleneck } from "@/lib/saju/final/deriveR5Bottleneck";
import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { buildStrengthSummary } from "@/lib/saju/elements/strengthSummary";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import type { BottleneckLevel, FinalRole, RoleActivityMap } from "@/lib/saju/final/types";
import type {
  FourPillars,
  HourPillar,
  Pillar,
  StrengthEvidence,
  StrengthObservations,
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

const EMPTY: RoleElementCandidateMap = {
  R1: [],
  R2: [],
  R3: [],
  R4: [],
  R5: [],
  R6: [],
};

const BASE_ROLES: RoleActivityMap = {
  R1: "C",
  R2: "C",
  R3: "C",
  R4: "C",
  R5: "A",
  R6: "A",
};

function emptyEvidenceDay(dayStem: StrengthEvidence["dayStem"]): StrengthEvidence {
  const base = collectStrengthEvidence(
    chart({
      year: { stem: "甲", branch: "子" },
      month: { stem: "甲", branch: "子" },
      day: { stem: dayStem, branch: "子" },
      hour: { stem: "甲", branch: "子" },
    }),
  );
  return {
    ...base,
    dayStem,
    supportEvidence: { items: [] },
    pressureEvidence: { items: [] },
    branchRelationEvidence: { items: [] },
  };
}

function emptyObservations(dayStem: StrengthEvidence["dayStem"]): StrengthObservations {
  return {
    dayStem,
    elementClusters: [],
    generationChains: [],
    structureObservation: {
      supportRelations: [],
      pressureRelations: [],
      coexistenceNotes: [],
    },
  };
}

function emptySummary(): StrengthSummary {
  return buildStrengthSummary(
    chart({
      year: { stem: "甲", branch: "子" },
      month: { stem: "甲", branch: "子" },
      day: { stem: "甲", branch: "子" },
      hour: "unknown",
    }),
  );
}

function resolve(partial: {
  primaryRoles: FinalRole[];
  candidates?: Partial<RoleElementCandidateMap>;
  roleActivities?: Partial<RoleActivityMap>;
  r2Bottleneck?: BottleneckLevel;
  r5Bottleneck?: BottleneckLevel;
  evidence?: StrengthEvidence;
  observations?: StrengthObservations;
  summary?: StrengthSummary;
}) {
  const evidence = partial.evidence ?? emptyEvidenceDay("甲");
  return resolveStructuralElement({
    primaryRoles: partial.primaryRoles,
    roleElementCandidates: { ...EMPTY, ...partial.candidates },
    roleActivities: { ...BASE_ROLES, ...partial.roleActivities },
    r2Bottleneck: partial.r2Bottleneck ?? "NOT",
    r5Bottleneck: partial.r5Bottleneck ?? "NOT",
    summary: partial.summary ?? emptySummary(),
    evidence,
    observations: partial.observations ?? emptyObservations(evidence.dayStem),
  });
}

describe("resolveStructuralElement", () => {
  it("1. R1 단일 후보 → resolved", () => {
    const result = resolve({
      primaryRoles: ["R1"],
      candidates: { R1: ["水"] },
      roleActivities: { R1: "A" },
    });
    expect(result).toEqual(
      expect.objectContaining({
        status: "resolved",
        role: "R1",
        element: "水",
      }),
    );
  });

  it("2. R2 단일 후보 → resolved", () => {
    const result = resolve({
      primaryRoles: ["R2"],
      candidates: { R2: ["火"] },
      roleActivities: { R2: "B" },
      r2Bottleneck: "CLEAR",
    });
    expect(result).toEqual(
      expect.objectContaining({
        status: "resolved",
        role: "R2",
        element: "火",
      }),
    );
  });

  it("3. R3 단일 후보 → resolved", () => {
    const result = resolve({
      primaryRoles: ["R3"],
      candidates: { R3: ["火"] },
      roleActivities: { R3: "A" },
    });
    expect(result).toEqual(
      expect.objectContaining({
        status: "resolved",
        role: "R3",
        element: "火",
      }),
    );
  });

  it("4. R4 wealth만 direct evidence → wealth 오행 resolved", () => {
    // Day 甲 → wealth 土, officer 金
    const evidence = emptyEvidenceDay("甲");
    evidence.pressureEvidence.items.push({
      slot: "year",
      stem: "戊",
      shiShen: "편재",
      presence: "rooted-visible",
    });
    const result = resolve({
      primaryRoles: ["R4"],
      candidates: { R4: ["土", "金"] },
      roleActivities: { R4: "A" },
      evidence,
    });
    expect(result.status).toBe("resolved");
    expect(result.role).toBe("R4");
    expect(result.element).toBe("土");
    expect(result.reasons).toContain("r4:wealth-axis-direct");
  });

  it("5. R4 officer만 direct evidence → officer 오행 resolved", () => {
    const evidence = emptyEvidenceDay("甲");
    evidence.pressureEvidence.items.push({
      slot: "month",
      stem: "庚",
      shiShen: "편관",
      presence: "rooted-visible",
    });
    const result = resolve({
      primaryRoles: ["R4"],
      candidates: { R4: ["土", "金"] },
      roleActivities: { R4: "A" },
      evidence,
    });
    expect(result.status).toBe("resolved");
    expect(result.role).toBe("R4");
    expect(result.element).toBe("金");
    expect(result.reasons).toContain("r4:officer-axis-direct");
  });

  it("6. R4 둘 다 동급 → unresolved", () => {
    const evidence = emptyEvidenceDay("甲");
    evidence.pressureEvidence.items.push(
      {
        slot: "year",
        stem: "戊",
        shiShen: "편재",
        presence: "rooted-visible",
      },
      {
        slot: "month",
        stem: "庚",
        shiShen: "편관",
        presence: "rooted-visible",
      },
    );
    const result = resolve({
      primaryRoles: ["R4"],
      candidates: { R4: ["土", "金"] },
      roleActivities: { R4: "A" },
      evidence,
    });
    expect(result.status).toBe("unresolved");
    expect(result.role).toBeNull();
    expect(result.element).toBeNull();
    expect(result.reasons).toContain("r4:wealth-officer-tie");
  });

  it("7. R5 CLEAR + mid 1개 → resolved", () => {
    const pillars = chart({
      year: { stem: "壬", branch: "子" },
      month: { stem: "癸", branch: "子" },
      day: { stem: "庚", branch: "申" },
      hour: { stem: "丙", branch: "午" },
    });
    let evidence = collectStrengthEvidence(pillars);
    evidence = {
      ...evidence,
      pressureEvidence: {
        items: evidence.pressureEvidence.items.filter(
          (item) => stemElement(item.stem) !== "水",
        ),
      },
    };
    let observations = buildStrengthObservations(pillars, evidence);
    observations = {
      ...observations,
      structureObservation: {
        ...observations.structureObservation,
        pressureRelations: observations.structureObservation.pressureRelations.filter(
          (relation) => relation.element !== "水",
        ),
      },
      generationChains: [
        ...observations.generationChains,
        {
          relation: "element-generates",
          from: {
            slot: "year",
            layer: "stem",
            stem: "壬",
            element: "水",
            presence: "unrooted-visible",
            shiShen: "식신",
          },
          to: {
            slot: "month",
            layer: "hiddenStem",
            stem: "甲",
            element: "木",
            presence: "hidden-only",
            shiShen: "편관",
          },
        },
      ],
    };
    const summary = buildStrengthSummary(pillars);
    const climate = buildAdjustedClimateSummary(pillars);
    const roleActivities = {
      ...deriveRoleActivities({ pillars, evidence, observations, climate }),
      R5: "B" as const,
    };
    const result = resolveStructuralElement({
      primaryRoles: ["R5"],
      roleElementCandidates: { ...EMPTY, R5: ["木"] },
      roleActivities,
      r2Bottleneck: "NOT",
      r5Bottleneck: "CLEAR",
      summary,
      evidence,
      observations,
    });
    expect(result.status).toBe("resolved");
    expect(result.role).toBe("R5");
    expect(result.element).toBe("木");
  });

  it("8. R5 CLEAR + mid 복수 candidates without unique CLEAR mid → unresolved", () => {
    const result = resolve({
      primaryRoles: ["R5"],
      candidates: { R5: ["木", "火"] },
      roleActivities: { R5: "B" },
      r5Bottleneck: "CLEAR",
      evidence: emptyEvidenceDay("庚"),
    });
    expect(result.status).toBe("unresolved");
    expect(result.element).toBeNull();
    expect(result.reasons).toContain("r5:no-clear-corridor-mid");
  });

  it("9. primaryRoles=[R3,R4] → unresolved", () => {
    const result = resolve({
      primaryRoles: ["R3", "R4"],
      candidates: { R3: ["火"], R4: ["土"] },
      roleActivities: { R3: "B", R4: "B" },
    });
    expect(result.status).toBe("unresolved");
    expect(result.role).toBeNull();
    expect(result.element).toBeNull();
    expect(result.reasons).toContain("multiple-structural-primaries");
  });

  it("representative: MX-1981 → 火 / R2", () => {
    const pillars = chart({
      year: { stem: "辛", branch: "酉" },
      month: { stem: "乙", branch: "未" },
      day: { stem: "丙", branch: "申" },
      hour: { stem: "戊", branch: "戌" },
    });
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);
    const summary = buildStrengthSummary(pillars);
    const climate = buildAdjustedClimateSummary(pillars);
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
    });
    const result = resolveStructuralElement({
      primaryRoles,
      roleElementCandidates,
      roleActivities,
      r2Bottleneck,
      r5Bottleneck,
      summary,
      evidence,
      observations,
    });
    expect(primaryRoles).toEqual(["R2"]);
    expect(result.status).toBe("resolved");
    expect(result.role).toBe("R2");
    expect(result.element).toBe("火");
  });

  it("representative: LS-birth structural trace (no R6 compare)", () => {
    const pillars = chart({
      year: { stem: "己", branch: "卯" },
      month: { stem: "丙", branch: "子" },
      day: { stem: "癸", branch: "卯" },
      hour: { stem: "壬", branch: "子" },
    });
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);
    const summary = buildStrengthSummary(pillars);
    const climate = buildAdjustedClimateSummary(pillars);
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
    const { primaryRoles, reasons: priorityReasons } = derivePriorityRoles({
      pillars,
      summary,
      roleActivities,
      roleElementCandidates,
      r2Bottleneck,
      r5Bottleneck,
      evidence,
      observations,
      climate,
    });
    const result = resolveStructuralElement({
      primaryRoles,
      roleElementCandidates,
      roleActivities,
      r2Bottleneck,
      r5Bottleneck,
      summary,
      evidence,
      observations,
    });
    // Priority opens R1; structural resolves 金. R6 not compared here.
    expect(primaryRoles).toEqual(["R1"]);
    expect(priorityReasons).toContain("g2:r1-open-priority");
    expect(result.status).toBe("resolved");
    expect(result.role).toBe("R1");
    expect(result.element).toBe("金");
    expect(result).not.toHaveProperty("certainty");
  });
});
