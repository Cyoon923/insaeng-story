import { describe, expect, it } from "vitest";
import { solarTermInstant } from "@/lib/saju/calendar/solarTerms";
import {
  analyzeJieBoundaryMismatches,
  analyzeMinuteMismatches,
  lichun2023Raw,
  summarizeDiscrepancyClasses,
} from "@/lib/saju/validation/experimental/boundaryPolicy";

describe("solar-term boundary policy investigation (no product adoption)", () => {
  it("does not change v1 product 2020 입춘", () => {
    expect(solarTermInstant(2020, "입춘")).toEqual({ year: 2020, month: 2, day: 4, hour: 18, minute: 8 });
  });

  it("reports v2 raw seconds for KASI minute mismatches without rewriting expected", () => {
    const mismatches = analyzeMinuteMismatches();
    const classes = summarizeDiscrepancyClasses(mismatches);
    const jieBoundaries = analyzeJieBoundaryMismatches(mismatches);
    const lichun = lichun2023Raw();
    const yearMismatchOffsets = jieBoundaries.flatMap((row) =>
      row.offsets.filter((offset) => !offset.yearMatches).map((offset) => ({ year: row.year, term: row.term, ...offset })),
    );

    console.log(
      JSON.stringify(
        {
          classes,
          lichun2023: lichun,
          yearMismatchOffsets,
          mismatches,
          jieBoundaries,
        },
        null,
        2,
      ),
    );

    expect(mismatches).toHaveLength(51);
    expect(classes.jie).toBe(27);
    expect(lichun.v2RoundedMinute).toBe("2023-02-04 11:42");
    expect(lichun.kasiMinute).toBe("2023-02-04 11:43");
  });
});
