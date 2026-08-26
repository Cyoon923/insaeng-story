import { describe, expect, it } from "vitest";
import { resolveStructureVsClimate } from "@/lib/saju/final/resolveStructureVsClimate";
import type { StructuralElementResult } from "@/lib/saju/final/resolveStructuralElement";
import { resolveStructuralElement } from "@/lib/saju/final/resolveStructuralElement";
import type { RoleElementCandidateMap } from "@/lib/saju/final/deriveRoleElementCandidates";
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
import type { RoleActivityMap } from "@/lib/saju/final/types";
import type {
  AdjustedClimateSummary,
  FourPillars,
  HourPillar,
  NeedResolution,
  Pillar,
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

const ROLES: RoleActivityMap = {
  R1: "C",
  R2: "B",
  R3: "C",
  R4: "C",
  R5: "A",
  R6: "B",
};

function structuralFire(): StructuralElementResult {
  return {
    role: "R2",
    element: "火",
    status: "resolved",
    reasons: ["fixture"],
  };
}

function structuralUnresolved(): StructuralElementResult {
  return { role: null, element: null, status: "unresolved", reasons: ["fixture"] };
}

function clearClimate(): AdjustedClimateSummary {
  const base = buildAdjustedClimateSummary(
    chart({
      year: { stem: "甲", branch: "子" },
      month: { stem: "甲", branch: "子" },
      day: { stem: "甲", branch: "子" },
      hour: "unknown",
    }),
  );
  return {
    ...base,
    conflicts: [],
    temperature: { status: "resolved", value: "cold", outcome: "unchanged" },
    moisture: { status: "resolved", value: "balanced", outcome: "unchanged" },
  };
}

function contestedClimate(): AdjustedClimateSummary {
  return {
    ...clearClimate(),
    conflicts: ["contested-fixture"],
    temperature: { status: "unresolved", value: "warm", outcome: "unresolved" },
    moisture: {
      status: "unresolved",
      value: "dry",
      outcome: "partially-mitigated",
    },
  };
}

function compare(partial: {
  structural: StructuralElementResult;
  r6?: string[];
  climate?: AdjustedClimateSummary;
  needResolution?: NeedResolution;
  roles?: Partial<RoleActivityMap>;
}) {
  return resolveStructureVsClimate({
    structuralResolution: partial.structural,
    roleElementCandidates: {
      ...EMPTY,
      R6: (partial.r6 ?? []) as RoleElementCandidateMap["R6"],
    },
    roleActivities: { ...ROLES, ...partial.roles },
    climate: partial.climate ?? clearClimate(),
    needResolution: partial.needResolution,
  });
}

describe("resolveStructureVsClimate", () => {
  it("1. 구조 火 + R6 火 → aligned", () => {
    const result = compare({
      structural: structuralFire(),
      r6: ["火"],
      climate: clearClimate(),
    });
    expect(result.status).toBe("resolved");
    expect(result.source).toBe("aligned");
    expect(result.element).toBe("火");
    expect(result.role).toBe("R2");
    expect(result.reasons).toContain("aligned-not-auto-confirmed");
  });

  it("2. 구조 火 + contested 水 → 구조 火 유지", () => {
    const result = compare({
      structural: structuralFire(),
      r6: ["水"],
      climate: contestedClimate(),
    });
    expect(result.status).toBe("resolved");
    expect(result.source).toBe("structure");
    expect(result.element).toBe("火");
    expect(result.reasons).toContain("case-e:structure-over-contested-or-incomplete-r6");
  });

  it("3. 구조 null + clear R6 水 → climate 水", () => {
    const result = compare({
      structural: structuralUnresolved(),
      r6: ["水"],
      climate: clearClimate(),
    });
    expect(result.status).toBe("resolved");
    expect(result.source).toBe("climate");
    expect(result.role).toBe("R6");
    expect(result.element).toBe("水");
  });

  it("4. 구조 火 + clear R6 水 + 반대 → unresolved", () => {
    const result = compare({
      structural: structuralFire(),
      r6: ["水"],
      climate: clearClimate(),
    });
    expect(result.status).toBe("unresolved");
    expect(result.element).toBeNull();
    expect(result.reasons).toContain("case-c:opposite-action-conflict");
  });

  it("5. 구조 木 + clear R6 水 + 비반대 → 구조 木 유지", () => {
    const result = compare({
      structural: {
        role: "R1",
        element: "木",
        status: "resolved",
        reasons: ["fixture"],
      },
      r6: ["水"],
      climate: clearClimate(),
    });
    expect(result.status).toBe("resolved");
    expect(result.source).toBe("structure");
    expect(result.element).toBe("木");
    expect(result.reasons).toContain("case-b:different-non-opposite-keep-structure");
  });

  it("6. 구조 unresolved + contested R6 → unresolved", () => {
    const result = compare({
      structural: structuralUnresolved(),
      r6: ["水"],
      climate: contestedClimate(),
    });
    expect(result.status).toBe("unresolved");
    expect(result.reasons).toContain("structure-unresolved-and-r6-contested");
  });

  it("7. R6 복수 후보 → winner 금지", () => {
    const withStructure = compare({
      structural: structuralFire(),
      r6: ["水", "火"],
      climate: clearClimate(),
    });
    expect(withStructure.reasons).toContain("r6:multiple-candidates-no-winner");
    expect(withStructure.element).toBe("火");
    expect(withStructure.source).toBe("structure");

    const withoutStructure = compare({
      structural: structuralUnresolved(),
      r6: ["水", "火"],
      climate: clearClimate(),
    });
    expect(withoutStructure.status).toBe("unresolved");
    expect(withoutStructure.element).toBeNull();
  });

  it("representative: MX-1981 구조 火 + contested 水 → 火 유지", () => {
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
    const result = resolveStructureVsClimate({
      structuralResolution: structural,
      roleElementCandidates,
      roleActivities,
      climate,
      needResolution,
    });
    expect(structural.element).toBe("火");
    expect(roleElementCandidates.R6).toEqual(["水"]);
    expect(needResolution.decisionBlockedBy).toContain("climate-need-contested-inherited");
    expect(result.status).toBe("resolved");
    expect(result.source).toBe("structure");
    expect(result.element).toBe("火");
    expect(result.role).toBe("R2");
  });

  it("representative: LS-birth structure vs R6 trace", () => {
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
    const result = resolveStructureVsClimate({
      structuralResolution: structural,
      roleElementCandidates,
      roleActivities,
      climate,
      needResolution,
    });
    // 金 vs R6 火: 火극金 → opposite → unresolved when R6 clear; else structure/keep path.
    expect(structural.element).toBe("金");
    expect(roleElementCandidates.R6).toContain("火");
    if (result.status === "unresolved") {
      expect(result.reasons).toContain("case-c:opposite-action-conflict");
    } else {
      expect(result.element).toBe("金");
      expect(result.source === "structure" || result.source === "aligned").toBe(true);
    }
  });

  it("representative: NL-gaphae C-conflict path check", () => {
    // Synthetic: structure 水 + clear R6 火 → 水극火 opposite → unresolved
    const result = compare({
      structural: {
        role: "R3",
        element: "水",
        status: "resolved",
        reasons: ["nl-gaphae-fixture"],
      },
      r6: ["火"],
      climate: clearClimate(),
    });
    expect(result.status).toBe("unresolved");
    expect(result.reasons).toContain("case-c:opposite-action-conflict");
  });
});
