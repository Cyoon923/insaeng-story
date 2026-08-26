import { describe, expect, it } from "vitest";
import {
  classifyHourStability,
  deriveHourStability,
  type HourFerSnapshot,
} from "@/lib/saju/final/deriveHourStability";
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

function snap(partial: Partial<HourFerSnapshot> & Pick<HourFerSnapshot, "element">): HourFerSnapshot {
  return {
    role: partial.role ?? "R2",
    status: partial.status ?? (partial.element ? "resolved" : "unresolved"),
    r2Bottleneck: partial.r2Bottleneck ?? "NOT",
    r5Bottleneck: partial.r5Bottleneck ?? "NOT",
    element: partial.element,
  };
}

describe("classifyHourStability", () => {
  it("A fixture: element/role/band all fixed", () => {
    const snapshots = Array.from({ length: 12 }, () =>
      snap({ element: "火", role: "R2", r2Bottleneck: "POSSIBLE", r5Bottleneck: "NOT" }),
    );
    expect(classifyHourStability(snapshots)).toBe("A");
  });

  it("B fixture: same element, band varies", () => {
    const snapshots: HourFerSnapshot[] = [
      ...Array.from({ length: 6 }, () =>
        snap({ element: "火", role: "R2", r2Bottleneck: "POSSIBLE", r5Bottleneck: "NOT" }),
      ),
      ...Array.from({ length: 6 }, () =>
        snap({ element: "火", role: "R2", r2Bottleneck: "CLEAR", r5Bottleneck: "NOT" }),
      ),
    ];
    expect(classifyHourStability(snapshots)).toBe("B");
  });

  it("B fixture: same element, role varies", () => {
    const snapshots: HourFerSnapshot[] = [
      ...Array.from({ length: 6 }, () => snap({ element: "水", role: "R1" })),
      ...Array.from({ length: 6 }, () => snap({ element: "水", role: "R6" })),
    ];
    expect(classifyHourStability(snapshots)).toBe("B");
  });

  it("C: multiple elements", () => {
    expect(
      classifyHourStability([
        snap({ element: "火" }),
        snap({ element: "水" }),
      ]),
    ).toBe("C");
  });

  it("C: element mixed with unresolved", () => {
    expect(
      classifyHourStability([
        snap({ element: "火" }),
        snap({ element: null, status: "unresolved", role: null }),
      ]),
    ).toBe("C");
  });
});

describe("deriveHourStability", () => {
  it("rejects confirmed hour", () => {
    expect(() =>
      deriveHourStability({
        pillars: chart({
          year: { stem: "甲", branch: "子" },
          month: { stem: "甲", branch: "子" },
          day: { stem: "甲", branch: "子" },
          hour: { stem: "甲", branch: "子" },
        }),
      }),
    ).toThrow(/hour-unknown/);
  });

  it("HU-LS 甲寅/甲寅/甲子/unknown → C", () => {
    expect(
      deriveHourStability({
        pillars: chart({
          year: { stem: "甲", branch: "寅" },
          month: { stem: "甲", branch: "寅" },
          day: { stem: "甲", branch: "子" },
          hour: "unknown",
        }),
      }),
    ).toBe("C");
  });

  it("NL-gaphae 甲寅/辛亥/庚子/unknown → C", () => {
    expect(
      deriveHourStability({
        pillars: chart({
          year: { stem: "甲", branch: "寅" },
          month: { stem: "辛", branch: "亥" },
          day: { stem: "庚", branch: "子" },
          hour: "unknown",
        }),
      }),
    ).toBe("C");
  });

  it("LW-gapyu 甲酉/庚酉/甲酉/unknown → C", () => {
    expect(
      deriveHourStability({
        pillars: chart({
          year: { stem: "甲", branch: "酉" },
          month: { stem: "庚", branch: "酉" },
          day: { stem: "甲", branch: "酉" },
          hour: "unknown",
        }),
      }),
    ).toBe("C");
  });
});
