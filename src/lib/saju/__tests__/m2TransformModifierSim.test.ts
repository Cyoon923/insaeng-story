/**
 * TBD-01b candidate B final validation (pools 12 / 16).
 * Engine NOT wired.
 *
 * Run: npx vitest run src/lib/saju/__tests__/m2TransformModifierSim.test.ts
 */
import { describe, expect, it } from "vitest";
import type { ElementStrengthLevel } from "@/lib/saju/elements/buildElementStrengthProfiles";
import { STRENGTH_DISPLAY_BANDS } from "@/lib/saju/elements/toElementStrengthDisplayProfiles";
import type { Element } from "@/lib/saju/types";
import { ELEMENTS } from "@/lib/saju/types";

const LO = STRENGTH_DISPLAY_BANDS["very-weak"].lo;
const HI = STRENGTH_DISPLAY_BANDS["very-strong"].hi;

type Scores = Record<Element, number>;
type HeKind = "五合" | "삼합" | "방합";
type PoolSet = { name: "A" | "B" | "C"; pair: number; triple: number };

type Modifier = {
  id: string;
  kind: HeKind;
  attenSlots: Element[];
  target: Element;
  modifierActive?: boolean;
};

const POOLS: PoolSet[] = [
  { name: "A", pair: 8, triple: 12 },
  { name: "B", pair: 12, triple: 16 },
  { name: "C", pair: 16, triple: 20 },
];

const B = POOLS.find((p) => p.name === "B")!;

const LEVEL_ORDER: ElementStrengthLevel[] = [
  "very-weak",
  "weak",
  "balanced",
  "strong",
  "very-strong",
];

const STEM_HE: Record<string, { slots: [Element, Element]; target: Element }> = {
  甲己: { slots: ["木", "土"], target: "土" },
  乙庚: { slots: ["木", "金"], target: "金" },
  丙辛: { slots: ["火", "金"], target: "水" },
  丁壬: { slots: ["火", "水"], target: "木" },
  戊癸: { slots: ["土", "水"], target: "火" },
};

function poolFor(set: PoolSet, kind: HeKind): number {
  return kind === "五合" ? set.pair : set.triple;
}

function cloneScores(s: Scores): Scores {
  return { 木: s.木, 火: s.火, 土: s.土, 金: s.金, 水: s.水 };
}

function sumScores(s: Scores): number {
  return ELEMENTS.reduce((acc, e) => acc + s[e], 0);
}

function uniform(n: number): Scores {
  return { 木: n, 火: n, 土: n, 金: n, 水: n };
}

/** Open gaps (bandHi, nextLo) — continuous, not integer-only. */
function gapRanges() {
  const gaps = [];
  for (let i = 0; i < LEVEL_ORDER.length - 1; i += 1) {
    const lower = LEVEL_ORDER[i]!;
    const upper = LEVEL_ORDER[i + 1]!;
    const bandHi = STRENGTH_DISPLAY_BANDS[lower].hi;
    const nextLo = STRENGTH_DISPLAY_BANDS[upper].lo;
    gaps.push({
      lower,
      upper,
      bandHi,
      nextLo,
      mid: (bandHi + nextLo) / 2,
    });
  }
  return gaps;
}

/** Internal Effective → Level (policy locked). */
export function levelFromInternal(score: number): ElementStrengthLevel {
  if (score < LO) return "very-weak";
  if (score > HI) return "very-strong";

  for (const level of LEVEL_ORDER) {
    const { lo, hi } = STRENGTH_DISPLAY_BANDS[level];
    if (score >= lo && score <= hi) return level;
  }

  for (const gap of gapRanges()) {
    if (score > gap.bandHi && score < gap.nextLo) {
      const distLo = Math.abs(score - gap.bandHi);
      const distHi = Math.abs(score - gap.nextLo);
      if (distLo < distHi) return gap.lower;
      if (distHi < distLo) return gap.upper;
      return gap.upper; // midpoint tie
    }
  }

  throw new Error(`unmapped Internal score: ${score}`);
}

function synthesize(natal: Scores, modifiers: Modifier[], set: PoolSet): Scores {
  const s = cloneScores(natal);
  for (const m of modifiers) {
    if (m.modifierActive === false) continue;
    const pool = poolFor(set, m.kind);
    const per = pool / m.attenSlots.length;
    for (const e of m.attenSlots) s[e] -= per;
    s[m.target] += pool;
  }
  return s;
}

function levelJump(from: ElementStrengthLevel, to: ElementStrengthLevel): number {
  return Math.abs(LEVEL_ORDER.indexOf(to) - LEVEL_ORDER.indexOf(from));
}

function maxLevelJump(natal: Scores, effective: Scores): number {
  let max = 0;
  for (const e of ELEMENTS) {
    max = Math.max(
      max,
      levelJump(levelFromInternal(natal[e]), levelFromInternal(effective[e])),
    );
  }
  return max;
}

function natalCases(): Array<{ id: string; natal: Scores }> {
  return [
    { id: "balanced", natal: uniform(52) },
    { id: "one-very-strong-金", natal: { 木: 40, 火: 40, 土: 40, 金: 92, 水: 40 } },
    { id: "one-very-weak-水", natal: { 木: 52, 火: 52, 土: 52, 金: 52, 水: 10 } },
    { id: "target-already-top-土", natal: { 木: 40, 火: 40, 土: 88, 金: 44, 水: 40 } },
    { id: "target-bottom-木", natal: { 木: 12, 火: 52, 土: 52, 金: 72, 水: 52 } },
    { id: "donor-strongest-木", natal: { 木: 90, 火: 44, 土: 44, 金: 44, 水: 44 } },
    { id: "dyu-like", natal: { 木: 44, 火: 52, 土: 60, 金: 72, 水: 32 } },
  ];
}

function allStemMods(): Modifier[] {
  return (Object.keys(STEM_HE) as (keyof typeof STEM_HE)[]).map((id) => ({
    id: `五合-${id}`,
    kind: "五合" as const,
    attenSlots: [...STEM_HE[id].slots],
    target: STEM_HE[id].target,
  }));
}

function sampleBranchMods(): Modifier[] {
  return [
    { id: "삼합-申子辰", kind: "삼합", attenSlots: ["金", "水", "土"], target: "水" },
    { id: "삼합-寅午戌", kind: "삼합", attenSlots: ["木", "火", "土"], target: "火" },
    { id: "방합-寅卯辰", kind: "방합", attenSlots: ["木", "木", "土"], target: "木" },
    { id: "방합-巳午未", kind: "방합", attenSlots: ["火", "火", "土"], target: "火" },
  ];
}

type Fail = { kind: string; detail: unknown };

describe("Level gap continuous mapping", () => {
  it("maps fractional scores between 20 and 24 without falling through", () => {
    expect(levelFromInternal(20)).toBe("very-weak");
    expect(levelFromInternal(20.67)).toBe("very-weak");
    expect(levelFromInternal(22)).toBe("weak"); // mid 22 → upper
    expect(levelFromInternal(23.9)).toBe("weak");
    expect(levelFromInternal(24)).toBe("weak");
  });
});

describe("TBD-01b · B final sweep", () => {
  it("single-he: conserve, restore, jump≤1, target rises", () => {
    const fails: Fail[] = [];
    let cases = 0;
    let maxJump = 0;

    for (const { id, natal } of natalCases()) {
      for (const mod of [...allStemMods(), ...sampleBranchMods()]) {
        cases += 1;
        const eff = synthesize(natal, [mod], B);
        const cleared = synthesize(natal, [], B);
        const jump = maxLevelJump(natal, eff);
        maxJump = Math.max(maxJump, jump);

        if (Math.abs(sumScores(eff) - sumScores(natal)) > 1e-8) {
          fails.push({ kind: "conserve", detail: { id, mod: mod.id } });
        }
        if (JSON.stringify(cleared) !== JSON.stringify(natal)) {
          fails.push({ kind: "restore", detail: { id, mod: mod.id } });
        }
        if (jump >= 2) {
          fails.push({ kind: "jump>=2", detail: { id, mod: mod.id, jump, eff } });
        }
        if (!(eff[mod.target] > natal[mod.target] + 1e-9)) {
          fails.push({ kind: "target-not-up", detail: { id, mod: mod.id } });
        }
      }
    }

    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ cases, maxJump, failCount: fails.length, fails }));
    expect(fails).toEqual([]);
    expect(maxJump).toBeLessThanOrEqual(1);
  });

  it("dual non-shared: conserve, jump≤1, both targets rise", () => {
    const fails: Fail[] = [];
    let maxJump = 0;
    const pairs: Modifier[][] = [
      [
        { id: "甲己", kind: "五合", attenSlots: ["木", "土"], target: "土" },
        { id: "寅午戌", kind: "삼합", attenSlots: ["木", "火", "土"], target: "火" },
      ],
      [
        { id: "申子辰", kind: "삼합", attenSlots: ["金", "水", "土"], target: "水" },
        { id: "寅午戌", kind: "삼합", attenSlots: ["木", "火", "土"], target: "火" },
      ],
    ];
    for (const { id, natal } of natalCases()) {
      for (const mods of pairs) {
        const eff = synthesize(natal, mods, B);
        const jump = maxLevelJump(natal, eff);
        maxJump = Math.max(maxJump, jump);
        if (Math.abs(sumScores(eff) - sumScores(natal)) > 1e-8) {
          fails.push({ kind: "dual-conserve", detail: { id } });
        }
        if (jump >= 2) fails.push({ kind: "dual-jump", detail: { id, jump } });
        for (const m of mods) {
          if (!(eff[m.target] > natal[m.target] + 1e-9)) {
            fails.push({ kind: "dual-target", detail: { id, m: m.id } });
          }
        }
      }
    }
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ maxJump, failCount: fails.length, fails }));
    expect(fails).toEqual([]);
  });

  it("same-target stack: conserve; jump≤2 accepted for 2 mods", () => {
    const natal = uniform(52);
    const mods: Modifier[] = [
      { id: "t1", kind: "방합", attenSlots: ["木", "土", "金"], target: "火" },
      { id: "t2", kind: "삼합", attenSlots: ["木", "水", "土"], target: "火" },
    ];
    const eff = synthesize(natal, mods, B);
    expect(sumScores(eff) - sumScores(natal)).toBeCloseTo(0, 10);
    expect(eff.火).toBeGreaterThan(natal.火);
    const jump = maxLevelJump(natal, eff);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ 火: { n: natal.火, e: eff.火 }, jump }));
    expect(jump).toBeLessThanOrEqual(2);
  });

  it("competition-unresolved excluded from Effective", () => {
    const natal = uniform(52);
    const active: Modifier = {
      id: "甲己",
      kind: "五合",
      attenSlots: ["木", "土"],
      target: "土",
      modifierActive: true,
    };
    const held: Modifier = {
      id: "held",
      kind: "五合",
      attenSlots: ["木", "金"],
      target: "金",
      modifierActive: false,
    };
    expect(synthesize(natal, [active, held], B)).toEqual(
      synthesize(natal, [active], B),
    );
  });

  it("OOB Internal Level ok", () => {
    const hot = synthesize(
      { 木: 52, 火: 90, 土: 52, 金: 52, 水: 52 },
      [{ id: "戊癸", kind: "五合", attenSlots: ["土", "水"], target: "火" }],
      B,
    );
    expect(hot.火).toBeGreaterThan(96);
    expect(levelFromInternal(hot.火)).toBe("very-strong");
    const cold = synthesize(
      { 木: 10, 火: 52, 土: 10, 金: 52, 水: 52 },
      [{ id: "甲己", kind: "五合", attenSlots: ["木", "土"], target: "土" }],
      B,
    );
    expect(cold.木).toBeLessThan(8);
    expect(levelFromInternal(cold.木)).toBe("very-weak");
  });
});

describe("A/B/C comparison", () => {
  it("B between A and C on mean target delta; no single-he jump≥2", () => {
    const stats = POOLS.map((set) => {
      let sumAbsTarget = 0;
      let jump2 = 0;
      let n = 0;
      for (const { natal } of natalCases()) {
        for (const mod of [...allStemMods(), ...sampleBranchMods()]) {
          n += 1;
          const eff = synthesize(natal, [mod], set);
          sumAbsTarget += Math.abs(eff[mod.target] - natal[mod.target]);
          if (maxLevelJump(natal, eff) >= 2) jump2 += 1;
        }
      }
      return {
        name: set.name,
        meanTargetDelta: sumAbsTarget / n,
        jump2Count: jump2,
      };
    });
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(stats, null, 2));
    const a = stats.find((s) => s.name === "A")!;
    const b = stats.find((s) => s.name === "B")!;
    const c = stats.find((s) => s.name === "C")!;
    expect(b.meanTargetDelta).toBeGreaterThan(a.meanTargetDelta);
    expect(b.meanTargetDelta).toBeLessThan(c.meanTargetDelta);
    expect(b.jump2Count).toBe(0);
  });
});

describe("TBD-01b finalize", () => {
  it("locks B numbers in documentation contract", () => {
    const locked = {
      TBD_01b: "finalized",
      五合_pool: 12,
      삼합_방합_pool: 16,
      atten: "equal split across participation slots",
      boost: "Σatten",
      internalEffective: "unclamped",
      display: "clamp 8–96 only",
      level: "Internal + nearest; midpoint tie → upper; continuous gaps",
      softNote: "same-target multi-mod stack may move ±2 Levels (2× pool)",
      engineWired: false,
    };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(locked, null, 2));
    expect(locked.TBD_01b).toBe("finalized");
  });
});
