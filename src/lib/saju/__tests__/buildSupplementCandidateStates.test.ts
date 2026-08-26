import { describe, expect, it } from "vitest";
import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { buildNeedResolution } from "@/lib/saju/elements/needResolution";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { buildStrengthSummary } from "@/lib/saju/elements/strengthSummary";
import { buildCoreElementState } from "@/lib/saju/final/buildCoreElementState";
import { buildSupplementCandidateStates } from "@/lib/saju/final/buildSupplementCandidateStates";
import { resolveFinalElement } from "@/lib/saju/final/resolveFinalElement";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import type { FourPillars } from "@/lib/saju/types";

describe("buildSupplementCandidateStates — regression 辛酉/乙未/丙申/戊戌", () => {
  const pillars: FourPillars = {
    year: { stem: "辛", branch: "酉" },
    month: { stem: "乙", branch: "未" },
    day: { stem: "丙", branch: "申" },
    hour: { stem: "戊", branch: "戌" },
  };

  it("returns all five candidates with Core=火 relation table", () => {
    const evidence = collectStrengthEvidence(pillars);
    const summary = buildStrengthSummary(pillars);
    const climate = buildAdjustedClimateSummary(pillars);
    const needResolution = buildNeedResolution(pillars);
    const observations = buildStrengthObservations(pillars, evidence);
    const fer = resolveFinalElement({
      pillars,
      summary,
      evidence,
      observations,
      climate,
      needResolution,
    });

    expect(fer.finalElement).toBe("火");

    const coreState = buildCoreElementState({
      pillars,
      core: fer.finalElement!,
      observations,
    });
    const rows = buildSupplementCandidateStates({
      pillars,
      coreState,
      observations,
    });

    expect(rows.map((row) => row.element)).toEqual(["木", "火", "土", "金", "水"]);

    const byElement = Object.fromEntries(rows.map((row) => [row.element, row]));

    expect(byElement["木"]).toMatchObject({
      relationToCore: "generates-core",
      isParent: true,
      isChild: false,
      isController: false,
      generationToCore: "surface",
      generationFromCore: "none",
      presence: "rooted-visible",
      corridorMidForCore: null,
    });

    expect(byElement["火"]).toMatchObject({
      relationToCore: "direct",
      isParent: false,
      isChild: false,
      isController: false,
      generationToCore: "none",
      generationFromCore: "none",
      presence: "rooted-visible",
      corridorMidForCore: null,
    });

    expect(byElement["土"]).toMatchObject({
      relationToCore: "generated-by-core",
      isParent: false,
      isChild: true,
      isController: false,
      generationToCore: "none",
      generationFromCore: "surface",
      presence: "rooted-visible",
      corridorMidForCore: null,
    });

    expect(byElement["金"]).toMatchObject({
      relationToCore: "controlled-by-core",
      isParent: false,
      isChild: false,
      isController: false,
      generationToCore: "none",
      generationFromCore: "none",
      presence: "rooted-visible",
      corridorMidForCore: null,
    });

    expect(byElement["水"]).toMatchObject({
      relationToCore: "controls-core",
      isParent: false,
      isChild: false,
      isController: true,
      generationToCore: "none",
      generationFromCore: "none",
      presence: "hidden-only",
      corridorMidForCore: null,
    });

    // No suitability / winner fields.
    for (const row of rows) {
      expect(row).not.toHaveProperty("suitable");
      expect(row).not.toHaveProperty("winner");
      expect(row).not.toHaveProperty("score");
      expect(row.corridorMidForCore).toBeNull();
    }
  });
});
