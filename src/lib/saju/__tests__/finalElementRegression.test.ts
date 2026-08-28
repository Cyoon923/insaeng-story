import { describe, expect, it } from "vitest";
import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { buildNeedResolution } from "@/lib/saju/elements/needResolution";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { buildStrengthSummary } from "@/lib/saju/elements/strengthSummary";
import { resolveFinalElement } from "@/lib/saju/final/resolveFinalElement";
import type { FinalResolution } from "@/lib/saju/final/types";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import type {
  FourPillars,
  HourPillar,
  Pillar,
} from "@/lib/saju/types";
import type { EarthlyBranch, HeavenlyStem } from "@/lib/saju/luck/annual/types";

function parsePillar(s: string): Pillar {
  return { stem: s[0] as HeavenlyStem, branch: s[1] as EarthlyBranch };
}

function chart(y: string, m: string, d: string, h: string | "unknown"): FourPillars {
  const hour: HourPillar = h === "unknown" ? "unknown" : parsePillar(h);
  return {
    year: parsePillar(y),
    month: parsePillar(m),
    day: parsePillar(d),
    hour,
    hourCertainty: h === "unknown" ? "unknown" : "confirmed",
    warnings: [],
  };
}

function resolve(y: string, m: string, d: string, h: string | "unknown"): FinalResolution {
  const pillars = chart(y, m, d, h);
  const evidence = collectStrengthEvidence(pillars);
  const observations = buildStrengthObservations(pillars, evidence);
  const summary = buildStrengthSummary(pillars);
  const climate = buildAdjustedClimateSummary(pillars);
  const needResolution = buildNeedResolution(pillars);
  return resolveFinalElement({
    pillars,
    summary,
    evidence,
    observations,
    climate,
    needResolution,
  });
}

type CaseSpec = {
  id: string;
  y: string;
  m: string;
  d: string;
  h: string | "unknown";
  finalElement: FinalResolution["finalElement"];
  finalRole: FinalResolution["finalRole"];
  certainty: FinalResolution["certainty"];
  hourStability?: FinalResolution["hourStability"];
  r2Bottleneck?: FinalResolution["r2Bottleneck"];
  r5Bottleneck?: FinalResolution["r5Bottleneck"];
};

const CASES: CaseSpec[] = [
  {
    id: "LS-gapin",
    y: "甲寅",
    m: "甲寅",
    d: "甲子",
    h: "甲子",
    finalElement: null,
    finalRole: null,
    certainty: "unresolved",
  },
  {
    id: "LS-birth",
    y: "己卯",
    m: "丙子",
    d: "癸卯",
    h: "壬子",
    finalElement: null,
    finalRole: null,
    certainty: "unresolved",
  },
  {
    id: "LW-eulhae",
    y: "乙亥",
    m: "乙酉",
    d: "甲寅",
    h: "甲子",
    finalElement: "水",
    finalRole: "R1",
    certainty: "provisional",
  },
  {
    id: "LW-gapyu",
    y: "甲酉",
    m: "庚酉",
    d: "甲酉",
    h: "unknown",
    finalElement: null,
    finalRole: null,
    certainty: "unresolved",
    hourStability: "C",
  },
  {
    id: "LW-bingo",
    y: "丙午",
    m: "戊戌",
    d: "甲申",
    h: "甲子",
    finalElement: "水",
    finalRole: "R1",
    certainty: "provisional",
  },
  {
    id: "MX-1981",
    y: "辛酉",
    m: "乙未",
    d: "丙申",
    h: "戊戌",
    finalElement: "火",
    finalRole: "R2",
    certainty: "provisional",
    r2Bottleneck: "POSSIBLE",
  },
  {
    id: "MX-gimo",
    y: "己卯",
    m: "丙子",
    d: "戊午",
    h: "戊午",
    finalElement: "金",
    finalRole: "R3",
    certainty: "provisional",
    r5Bottleneck: "POSSIBLE",
  },
  {
    id: "MX-1984",
    y: "甲子",
    m: "丙寅",
    d: "己卯",
    h: "己巳",
    finalElement: "金",
    finalRole: "R3",
    certainty: "provisional",
  },
  {
    id: "MX-1990",
    y: "己巳",
    m: "丁丑",
    d: "庚辰",
    h: "庚辰",
    finalElement: "水",
    finalRole: "R3",
    certainty: "provisional",
  },
  {
    id: "NL-1921",
    y: "辛酉",
    m: "乙未",
    d: "丙申",
    h: "丁酉",
    finalElement: null,
    finalRole: null,
    certainty: "unresolved",
  },
  {
    id: "NL-gaphae",
    y: "甲寅",
    m: "辛亥",
    d: "庚子",
    h: "unknown",
    finalElement: null,
    finalRole: null,
    certainty: "unresolved",
    hourStability: "C",
  },
  {
    id: "NL-2005",
    y: "乙酉",
    m: "甲申",
    d: "甲子",
    h: "壬申",
    finalElement: "火",
    finalRole: "R3",
    certainty: "provisional",
  },
  {
    id: "HU-LS",
    y: "甲寅",
    m: "甲寅",
    d: "甲子",
    h: "unknown",
    finalElement: null,
    finalRole: null,
    certainty: "unresolved",
    hourStability: "C",
  },
  {
    id: "MX-neutral",
    y: "辛酉",
    m: "乙未",
    d: "丙申",
    h: "戊戌",
    finalElement: "火",
    finalRole: "R2",
    certainty: "provisional",
  },
];

describe("finalElementRegression (14 fixtures)", () => {
  const results = CASES.map((spec) => ({
    spec,
    result: resolve(spec.y, spec.m, spec.d, spec.h),
  }));

  for (const { spec, result } of results) {
    it(`${spec.id} → ${String(spec.finalElement)} / ${String(spec.finalRole)} / ${spec.certainty}`, () => {
      expect(result.finalElement).toBe(spec.finalElement);
      expect(result.finalRole).toBe(spec.finalRole);
      expect(result.certainty).toBe(spec.certainty);
      if (spec.hourStability !== undefined) {
        expect(result.hourStability).toBe(spec.hourStability);
      }
      if (spec.r2Bottleneck !== undefined) {
        expect(result.r2Bottleneck).toBe(spec.r2Bottleneck);
      }
      if (spec.r5Bottleneck !== undefined) {
        expect(result.r5Bottleneck).toBe(spec.r5Bottleneck);
      }
    });
  }

  it("invariants: unresolved null contract + counts + R5 CLEAR 0 + hour-unknown C", () => {
    for (const { result } of results) {
      if (result.certainty === "unresolved") {
        expect(result.finalElement).toBeNull();
        expect(result.finalRole).toBeNull();
      }
    }

    const resolved = results.filter(
      (row) => row.result.certainty === "confirmed" || row.result.certainty === "provisional",
    );
    const provisional = results.filter((row) => row.result.certainty === "provisional");
    const unresolved = results.filter((row) => row.result.certainty === "unresolved");
    const confirmed = results.filter((row) => row.result.certainty === "confirmed");

    expect(resolved).toHaveLength(8);
    expect(provisional).toHaveLength(8);
    expect(unresolved).toHaveLength(6);
    expect(confirmed).toHaveLength(0);

    expect(results.every((row) => row.result.r5Bottleneck !== "CLEAR")).toBe(true);

    const hourUnknownIds = ["LW-gapyu", "NL-gaphae", "HU-LS"];
    for (const id of hourUnknownIds) {
      const row = results.find((item) => item.spec.id === id);
      expect(row).toBeDefined();
      expect(row!.result.hourStability).toBe("C");
    }
  });
});
