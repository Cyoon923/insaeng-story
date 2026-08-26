import { describe, expect, it } from "vitest";
import { buildFreeSajuPipeline } from "@/lib/saju/free/buildFreeSajuPipeline";

/** Same BirthInput as fixtures.json "1990 before lichun, chou month". */
const FIXTURE_BIRTH = {
  calendar: "solar" as const,
  year: 1990,
  month: 1,
  day: 15,
  hour: 12,
  minute: 0,
};

describe("buildFreeSajuPipeline", () => {
  it("runs birth → FourPillars → FreeInterpretation end-to-end", () => {
    const { pillars, interpretation } = buildFreeSajuPipeline(FIXTURE_BIRTH);

    expect(pillars.year).toEqual({ stem: "己", branch: "巳" });
    expect(pillars.month).toEqual({ stem: "丁", branch: "丑" });
    expect(pillars.hourCertainty).toBe("confirmed");
    expect(pillars.hour).not.toBe("unknown");

    expect(interpretation.headline.length).toBeGreaterThan(0);
    expect(Array.isArray(interpretation.supportItems)).toBe(true);
    expect(Array.isArray(interpretation.cautionItems)).toBe(true);
    expect(Array.isArray(interpretation.climateNotes)).toBe(true);
    expect(Array.isArray(interpretation.uncertaintyNotes)).toBe(true);
  });
});
