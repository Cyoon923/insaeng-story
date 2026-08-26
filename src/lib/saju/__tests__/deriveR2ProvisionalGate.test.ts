import { describe, expect, it } from "vitest";
import { deriveR2ProvisionalGate } from "@/lib/saju/final/deriveR2ProvisionalGate";
import { deriveRoleActivities } from "@/lib/saju/final/deriveRoleActivities";
import { deriveR2Bottleneck } from "@/lib/saju/final/deriveR2Bottleneck";
import { deriveR5Bottleneck } from "@/lib/saju/final/deriveR5Bottleneck";
import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { buildStrengthSummary } from "@/lib/saju/elements/strengthSummary";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import type { BottleneckLevel, HourStability, RoleActivityMap } from "@/lib/saju/final/types";
import type {
  FourPillars,
  HourPillar,
  Pillar,
  StrengthEvidence,
  StrengthSummary,
} from "@/lib/saju/types";
import type { StrengthObservations } from "@/lib/saju/observation/types";

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
    r2Bottleneck?: BottleneckLevel;
    r5Bottleneck?: BottleneckLevel;
    hourStability?: HourStability | null;
    summaryMut?: (summary: StrengthSummary) => StrengthSummary;
    evidenceMut?: (evidence: StrengthEvidence) => StrengthEvidence;
    observationsMut?: (observations: StrengthObservations) => StrengthObservations;
  },
) {
  let evidence = collectStrengthEvidence(pillars);
  if (options?.evidenceMut) evidence = options.evidenceMut(evidence);
  let observations = buildStrengthObservations(pillars, evidence);
  if (options?.observationsMut) observations = options.observationsMut(observations);
  let summary = buildStrengthSummary(pillars);
  if (options?.summaryMut) summary = options.summaryMut(summary);
  const climate = buildAdjustedClimateSummary(pillars);
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
  const gate = deriveR2ProvisionalGate({
    pillars,
    summary,
    evidence,
    observations,
    roleActivities,
    r2Bottleneck,
    r5Bottleneck,
    hourStability: options?.hourStability,
  });
  return { summary, evidence, roleActivities, r2Bottleneck, r5Bottleneck, gate };
}

describe("deriveR2ProvisionalGate", () => {
  it("1. MX-1981 → allowed=true", () => {
    const input = pack(MX_1981);
    expect(input.r2Bottleneck).toBe("POSSIBLE");
    expect(input.roleActivities.R1).toBe("C");
    expect(input.roleActivities.R2 === "A" || input.roleActivities.R2 === "B").toBe(true);
    expect(input.gate.allowed).toBe(true);
    expect(input.gate.reasons).toContain("allowed:possible-dominant");
  });

  it("2. leaning-strong + POSSIBLE → false", () => {
    const input = pack(MX_1981, {
      r2Bottleneck: "POSSIBLE",
      summaryMut: (summary) => ({
        ...summary,
        directionCandidate: "leaning-strong",
      }),
    });
    expect(input.gate.allowed).toBe(false);
    expect(input.gate.reasons).toContain("fail:leaning-strong");
  });

  it("3. R1≠C → false", () => {
    const input = pack(MX_1981, {
      roleOverride: { R1: "B" },
      r2Bottleneck: "POSSIBLE",
    });
    expect(input.gate.allowed).toBe(false);
    expect(input.gate.reasons).toContain("fail:r1-not-c");
  });

  it("4. R3=A → false", () => {
    const input = pack(MX_1981, {
      roleOverride: { R3: "A" },
      r2Bottleneck: "POSSIBLE",
    });
    expect(input.gate.allowed).toBe(false);
    expect(input.gate.reasons).toContain("fail:r3-is-a");
  });

  it("5. R4=A → false", () => {
    const input = pack(MX_1981, {
      roleOverride: { R4: "A" },
      r2Bottleneck: "POSSIBLE",
    });
    expect(input.gate.allowed).toBe(false);
    expect(input.gate.reasons).toContain("fail:r4-is-a");
  });

  it("6. R5=CLEAR → false", () => {
    const input = pack(MX_1981, {
      r2Bottleneck: "POSSIBLE",
      r5Bottleneck: "CLEAR",
    });
    expect(input.gate.allowed).toBe(false);
    expect(input.gate.reasons).toContain("fail:r5-clear");
  });

  it("7. resource RV 없음 → false", () => {
    const input = pack(MX_1981, {
      r2Bottleneck: "POSSIBLE",
      summaryMut: (summary) => ({
        ...summary,
        sourceBreakdown: {
          ...summary.sourceBreakdown,
          resource: { rootedVisible: false, unrootedVisible: false },
        },
      }),
    });
    expect(input.gate.allowed).toBe(false);
    expect(input.gate.reasons).toContain("fail:resource-not-rooted-visible");
  });

  it("8. visible peer 있음 → false", () => {
    const input = pack(MX_1981, {
      roleOverride: { R2: "B" },
      r2Bottleneck: "POSSIBLE",
      evidenceMut: (evidence) => ({
        ...evidence,
        supportEvidence: {
          items: [
            ...evidence.supportEvidence.items,
            {
              slot: "year",
              stem: "丁",
              shiShen: "겁재",
              presence: "rooted-visible",
            },
          ],
        },
      }),
    });
    expect(input.gate.allowed).toBe(false);
    expect(input.gate.reasons).toContain("fail:visible-peer-support-present");
  });

  it("9. hour unknown + stability C → false", () => {
    const input = pack(
      chart({
        year: { stem: "辛", branch: "酉" },
        month: { stem: "乙", branch: "未" },
        day: { stem: "丙", branch: "申" },
        hour: "unknown",
      }),
      {
        roleOverride: { R1: "C", R2: "B", R3: "C", R4: "C" },
        r2Bottleneck: "POSSIBLE",
        r5Bottleneck: "NOT",
        hourStability: "C",
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
    expect(input.evidence.hourUnknown).toBe(true);
    expect(input.gate.allowed).toBe(false);
    expect(input.gate.reasons).toContain("fail:hour-unknown-stability-c");
  });

  it("10. null + root absent → false", () => {
    const input = pack(MX_1981, {
      r2Bottleneck: "POSSIBLE",
      summaryMut: (summary) => ({
        ...summary,
        directionCandidate: null,
        rootQuality: "absent",
      }),
    });
    expect(input.gate.allowed).toBe(false);
    expect(input.gate.reasons).toContain("fail:null-direction-root-absent");
  });
});
