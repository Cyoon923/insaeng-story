import { describe, expect, it } from "vitest";
import { derivePriorityRoles } from "@/lib/saju/final/derivePriorityRoles";
import { deriveRoleElementCandidates } from "@/lib/saju/final/deriveRoleElementCandidates";
import type { RoleElementCandidateMap } from "@/lib/saju/final/deriveRoleElementCandidates";
import { deriveRoleActivities } from "@/lib/saju/final/deriveRoleActivities";
import { deriveR2Bottleneck } from "@/lib/saju/final/deriveR2Bottleneck";
import { deriveR5Bottleneck } from "@/lib/saju/final/deriveR5Bottleneck";
import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { buildStrengthSummary } from "@/lib/saju/elements/strengthSummary";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import type { BottleneckLevel, HourStability, RoleActivityMap } from "@/lib/saju/final/types";
import type {
  AdjustedClimateSummary,
  FourPillars,
  HourPillar,
  Pillar,
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

const EMPTY_CANDIDATES: RoleElementCandidateMap = {
  R1: [],
  R2: [],
  R3: [],
  R4: [],
  R5: [],
  R6: [],
};

const MX_1981 = chart({
  year: { stem: "辛", branch: "酉" },
  month: { stem: "乙", branch: "未" },
  day: { stem: "丙", branch: "申" },
  hour: { stem: "戊", branch: "戌" },
});

function pack(
  pillars: FourPillars,
  options?: {
    roleOverride?: Partial<RoleActivityMap>;
    candidateOverride?: Partial<RoleElementCandidateMap>;
    r2Bottleneck?: BottleneckLevel;
    r5Bottleneck?: BottleneckLevel;
    climateOverride?: Partial<AdjustedClimateSummary>;
    hourStability?: HourStability | null;
    summaryMut?: (summary: StrengthSummary) => StrengthSummary;
  },
) {
  const evidence = collectStrengthEvidence(pillars);
  const observations = buildStrengthObservations(pillars, evidence);
  let summary = buildStrengthSummary(pillars);
  if (options?.summaryMut) summary = options.summaryMut(summary);
  const climate = {
    ...buildAdjustedClimateSummary(pillars),
    ...options?.climateOverride,
  };
  const roleActivities = {
    ...deriveRoleActivities({ pillars, evidence, observations, climate }),
    ...options?.roleOverride,
  };
  const r2Bottleneck =
    options?.r2Bottleneck ??
    deriveR2Bottleneck({ pillars, summary, evidence, observations, roleActivities });
  const r5Bottleneck =
    options?.r5Bottleneck ??
    deriveR5Bottleneck({ evidence, observations, roleActivities });
  const roleElementCandidates = {
    ...deriveRoleElementCandidates({
      pillars,
      roleActivities,
      r2Bottleneck,
      r5Bottleneck,
      evidence,
      observations,
      climate,
    }),
    ...options?.candidateOverride,
  };
  const result = derivePriorityRoles({
    pillars,
    summary,
    roleActivities,
    roleElementCandidates,
    r2Bottleneck,
    r5Bottleneck,
    evidence,
    observations,
    climate,
    hourStability: options?.hourStability,
  });
  return {
    pillars,
    summary,
    roleActivities,
    roleElementCandidates,
    r2Bottleneck,
    r5Bottleneck,
    climate,
    result,
  };
}

/** Neutral base chart; overrides drive gates. */
function baseChart(): FourPillars {
  return chart({
    year: { stem: "甲", branch: "子" },
    month: { stem: "甲", branch: "子" },
    day: { stem: "甲", branch: "子" },
    hour: "unknown",
  });
}

describe("derivePriorityRoles", () => {
  it("1. R5 CLEAR → R5 primary", () => {
    const input = pack(baseChart(), {
      roleOverride: { R1: "C", R2: "C", R3: "C", R4: "C", R5: "B", R6: "A" },
      r5Bottleneck: "CLEAR",
      r2Bottleneck: "NOT",
      candidateOverride: { ...EMPTY_CANDIDATES, R5: ["木"] },
    });
    expect(input.result.primaryRoles).toEqual(["R5"]);
    expect(input.result.reasons).toContain("g1:r5-clear");
  });

  it("2. R5 POSSIBLE → G1 아님", () => {
    const input = pack(baseChart(), {
      roleOverride: { R1: "C", R2: "C", R3: "C", R4: "C", R5: "B", R6: "A" },
      r5Bottleneck: "POSSIBLE",
      r2Bottleneck: "NOT",
      candidateOverride: { ...EMPTY_CANDIDATES, R5: ["木"] },
    });
    expect(input.result.reasons).toContain("g1:r5-possible-not-g1");
    expect(input.result.reasons).not.toContain("g1:r5-clear");
  });

  it("3. R1 open + R2 open → R1 우선", () => {
    const input = pack(baseChart(), {
      roleOverride: { R1: "A", R2: "B", R3: "C", R4: "C", R5: "A", R6: "A" },
      r5Bottleneck: "NOT",
      r2Bottleneck: "POSSIBLE",
      candidateOverride: { ...EMPTY_CANDIDATES, R1: ["水"], R2: ["木"] },
    });
    expect(input.result.primaryRoles).toEqual(["R1"]);
    expect(input.result.reasons).toContain("g2:r1-open-priority");
  });

  it("4. R1=C + R2 CLEAR → R2 primary 가능", () => {
    const input = pack(baseChart(), {
      roleOverride: { R1: "C", R2: "B", R3: "C", R4: "C", R5: "A", R6: "A" },
      r5Bottleneck: "NOT",
      r2Bottleneck: "CLEAR",
      candidateOverride: { ...EMPTY_CANDIDATES, R2: ["木"] },
    });
    expect(input.result.primaryRoles).toEqual(["R2"]);
    expect(input.result.reasons).toContain("g2:r2-clear");
  });

  it("5. R3만 열린 구조 → R3 primary", () => {
    const input = pack(baseChart(), {
      roleOverride: { R1: "C", R2: "C", R3: "A", R4: "C", R5: "A", R6: "A" },
      r5Bottleneck: "NOT",
      r2Bottleneck: "NOT",
      candidateOverride: { ...EMPTY_CANDIDATES, R3: ["火"] },
    });
    expect(input.result.primaryRoles).toEqual(["R3"]);
  });

  it("6. R4만 열린 구조 → R4 primary", () => {
    const input = pack(
      chart({
        year: { stem: "戊", branch: "午" },
        month: { stem: "己", branch: "未" },
        day: { stem: "甲", branch: "寅" },
        hour: { stem: "庚", branch: "午" },
      }),
      {
        roleOverride: { R1: "C", R2: "C", R3: "C", R4: "A", R5: "A", R6: "A" },
        r5Bottleneck: "NOT",
        r2Bottleneck: "NOT",
        candidateOverride: { ...EMPTY_CANDIDATES, R4: ["土", "金"] },
      },
    );
    expect(input.result.primaryRoles).toEqual(["R4"]);
  });

  it("7. R3/R4 동급이면 둘 다 남김", () => {
    const input = pack(baseChart(), {
      roleOverride: { R1: "C", R2: "C", R3: "B", R4: "B", R5: "A", R6: "A" },
      r5Bottleneck: "NOT",
      r2Bottleneck: "NOT",
      candidateOverride: { ...EMPTY_CANDIDATES, R3: ["火"], R4: ["土"] },
    });
    expect(input.result.primaryRoles).toEqual(["R3", "R4"]);
  });

  it("8. R6 contested → clear primary 금지", () => {
    const input = pack(baseChart(), {
      roleOverride: { R1: "C", R2: "C", R3: "C", R4: "C", R5: "A", R6: "B" },
      r5Bottleneck: "NOT",
      r2Bottleneck: "NOT",
      candidateOverride: { ...EMPTY_CANDIDATES, R6: ["火"] },
      climateOverride: {
        conflicts: ["contested-fixture"],
        temperature: {
          status: "unresolved",
          value: "cold",
          outcome: "unresolved",
        },
        moisture: {
          status: "unresolved",
          value: "dry",
          outcome: "partially-mitigated",
        },
      },
    });
    expect(input.result.primaryRoles).not.toContain("R6");
    expect(input.result.reasons).toContain("g4:r6-contested-or-partial-blocked");
  });

  it("9. MX-1981: R2 POSSIBLE-DOMINANT via G2, not G5", () => {
    const input = pack(MX_1981);
    expect(input.r2Bottleneck).toBe("POSSIBLE");
    expect(input.result.primaryRoles).toEqual(["R2"]);
    expect(input.result.reasons).toContain("g2:r2-possible-dominant");
    expect(input.result.reasons).not.toContain("g5:directness-r2");
    expect(input.result).not.toHaveProperty("finalElement");
    expect(JSON.stringify(input.result)).not.toMatch(/"火"/);
  });

  it("10. R2 POSSIBLE + R3=A → not dominant → R2 primary 금지", () => {
    const input = pack(MX_1981, {
      roleOverride: { R3: "A" },
      candidateOverride: { R3: ["土"] },
    });
    expect(input.r2Bottleneck).toBe("POSSIBLE");
    expect(input.result.reasons).toContain("g2:r2-possible-not-dominant");
    expect(input.result.primaryRoles).not.toContain("R2");
    expect(input.result.reasons).not.toContain("g5:directness-r2");
  });

  it("11. R2 POSSIBLE + leaning-strong → R2 primary 금지", () => {
    const input = pack(MX_1981, {
      r2Bottleneck: "POSSIBLE",
      summaryMut: (summary) => ({
        ...summary,
        directionCandidate: "leaning-strong",
      }),
    });
    expect(input.result.reasons).toContain("g2:r2-possible-not-dominant");
    expect(input.result.primaryRoles).not.toContain("R2");
  });

  it("12. R2 POSSIBLE + hour stability C → R2 primary 금지", () => {
    const input = pack(
      chart({
        year: { stem: "辛", branch: "酉" },
        month: { stem: "乙", branch: "未" },
        day: { stem: "丙", branch: "申" },
        hour: "unknown",
      }),
      {
        roleOverride: { R1: "C", R2: "B", R3: "C", R4: "C", R5: "C", R6: "B" },
        r2Bottleneck: "POSSIBLE",
        r5Bottleneck: "NOT",
        hourStability: "C",
        candidateOverride: { ...EMPTY_CANDIDATES, R2: ["火"] },
        summaryMut: (summary) => ({
          ...summary,
          directionCandidate: "mixed",
          rootQuality: "present",
          sourceBreakdown: {
            ...summary.sourceBreakdown,
            resource: { rootedVisible: true, unrootedVisible: false },
            peer: { rootedVisible: false, unrootedVisible: false },
          },
        }),
      },
    );
    expect(input.result.reasons).toContain("g2:r2-possible-not-dominant");
    expect(input.result.primaryRoles).not.toContain("R2");
    expect(input.result.reasons).not.toContain("g5:directness-r2");
  });

  it("13. POSSIBLE-WEAK alone must not be salvaged by G5", () => {
    const input = pack(MX_1981, {
      roleOverride: { R3: "A", R4: "A", R5: "C", R6: "C" },
      r5Bottleneck: "NOT",
      candidateOverride: {
        ...EMPTY_CANDIDATES,
        R2: ["火"],
      },
    });
    expect(input.r2Bottleneck).toBe("POSSIBLE");
    expect(input.result.reasons).toContain("g2:r2-possible-not-dominant");
    expect(input.result.primaryRoles).not.toContain("R2");
    expect(input.result.reasons).not.toContain("g5:directness-r2");
  });
});
