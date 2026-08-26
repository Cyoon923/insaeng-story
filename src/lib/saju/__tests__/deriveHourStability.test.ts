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

function snap(
  partial: Partial<HourFerSnapshot> & Pick<HourFerSnapshot, "element">,
): HourFerSnapshot {
  return {
    role: partial.role ?? "R3",
    status: partial.status ?? (partial.element ? "resolved" : "unresolved"),
    roleBand: partial.roleBand ?? "CLEAR",
    element: partial.element,
  };
}

describe("classifyHourStability", () => {
  it("1. snapshots 12개 전부 null/unresolved → C", () => {
    const snapshots = Array.from({ length: 12 }, () =>
      snap({ element: null, role: null, status: "unresolved", roleBand: "UNRESOLVED" }),
    );
    expect(classifyHourStability(snapshots)).toBe("C");
  });

  it("2. 火/R3 12개 동일 + R3 band CLEAR↔POSSIBLE 변동 → B", () => {
    const snapshots: HourFerSnapshot[] = [
      ...Array.from({ length: 6 }, () =>
        snap({ element: "火", role: "R3", roleBand: "CLEAR" }),
      ),
      ...Array.from({ length: 6 }, () =>
        snap({ element: "火", role: "R3", roleBand: "POSSIBLE" }),
      ),
    ];
    expect(classifyHourStability(snapshots)).toBe("B");
  });

  it("3. 火/R3 + 火/R4 변동 → B", () => {
    const snapshots: HourFerSnapshot[] = [
      ...Array.from({ length: 6 }, () =>
        snap({ element: "火", role: "R3", roleBand: "CLEAR" }),
      ),
      ...Array.from({ length: 6 }, () =>
        snap({ element: "火", role: "R4", roleBand: "CLEAR" }),
      ),
    ];
    expect(classifyHourStability(snapshots)).toBe("B");
  });

  it("4. 火 ↔ 土 → C", () => {
    expect(
      classifyHourStability([
        snap({ element: "火", role: "R3", roleBand: "CLEAR" }),
        snap({ element: "土", role: "R3", roleBand: "CLEAR" }),
      ]),
    ).toBe("C");
  });

  it("5. 火 ↔ null → C", () => {
    expect(
      classifyHourStability([
        snap({ element: "火", role: "R3", roleBand: "CLEAR" }),
        snap({ element: null, role: null, status: "unresolved", roleBand: "UNRESOLVED" }),
      ]),
    ).toBe("C");
  });

  it("6. 火/R3/CLEAR 전부 동일 → A", () => {
    const snapshots = Array.from({ length: 12 }, () =>
      snap({ element: "火", role: "R3", roleBand: "CLEAR" }),
    );
    expect(classifyHourStability(snapshots)).toBe("A");
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
