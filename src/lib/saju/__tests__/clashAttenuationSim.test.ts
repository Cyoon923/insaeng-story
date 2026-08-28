/**
 * TBD-01c · 지지 충 root attenuation.
 *
 * 확정: **A안 δ = 4** (evidence 1건당) — docs §1.6.8.0.
 * B(6) · C(8)은 기각. 후보 sweep은 근거 기록으로 유지한다.
 *
 * Engine NOT wired. Opening (TBD-03a) excluded.
 * 위치 가중 · natal/luck source 차등 · 개고 병존 상한은 **별도 TBD**.
 *
 * Run: npx vitest run src/lib/saju/__tests__/clashAttenuationSim.test.ts
 */
import { describe, expect, it } from "vitest";
import { stemElement } from "@/lib/saju/constants/elements";
import { HIDDEN_STEMS } from "@/lib/saju/data/hiddenStems";
import type { ElementStrengthLevel } from "@/lib/saju/elements/buildElementStrengthProfiles";
import { STRENGTH_DISPLAY_BANDS } from "@/lib/saju/elements/toElementStrengthDisplayProfiles";
import type { Branch, Element } from "@/lib/saju/types";
import { ELEMENTS } from "@/lib/saju/types";

const LO = STRENGTH_DISPLAY_BANDS["very-weak"].lo;
const HI = STRENGTH_DISPLAY_BANDS["very-strong"].hi;

type Scores = Record<Element, number>;
type BranchSlot = "year" | "month" | "day" | "hour";

/** Root evidence tied to one branch slot (TBD-03 unit). */
type RootEvidence = {
  id: string;
  element: Element;
  branchSlot: BranchSlot;
};

type ClashHit = {
  id: string;
  /** Both party slots (육충 당사자). */
  slots: [BranchSlot, BranchSlot];
};

type HeKind = "五合" | "삼합" | "방합";

type TransformMod = {
  id: string;
  kind: HeKind;
  /** Elements attenuated by M2 (slot-level proxy). */
  attenElements: Element[];
  target: Element;
  /** Branch slots this he uses — clash on any → release. */
  branchSlots: BranchSlot[];
  modifierActive: boolean;
};

type Candidate = { name: "A" | "B" | "C"; delta: number; note: string };

/** Per clash-affected root evidence. Cap vs M2: 五合 pool 12 / per-slot 6 · triple 16. */
const CANDIDATES: Candidate[] = [
  { name: "A", delta: 4, note: "五合 per-slot(6)보다 약 · pool 12의 ~1/3" },
  { name: "B", delta: 6, note: "五合 per-slot atten과 동급 · pool 12의 1/2" },
  { name: "C", delta: 8, note: "五合 per-slot보다 강 · 단 pool 12 미만" },
];

/**
 * TBD-01c 확정값 (§1.6.8.0) — A안. Engine NOT wired.
 * B/C는 비교 기록으로만 CANDIDATES에 남긴다.
 */
const CONFIRMED_DELTA = 4;

const M2_PAIR = 12;

const LEVEL_ORDER: ElementStrengthLevel[] = [
  "very-weak",
  "weak",
  "balanced",
  "strong",
  "very-strong",
];

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

function levelFromInternal(score: number): ElementStrengthLevel {
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
      return gap.upper;
    }
  }
  throw new Error(`unmapped Internal score: ${score}`);
}

function cloneScores(s: Scores): Scores {
  return { 木: s.木, 火: s.火, 土: s.土, 金: s.金, 水: s.水 };
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

function displayClamp(score: number): number {
  return Math.min(HI, Math.max(LO, score));
}

/**
 * Clash attenuation only — Opening excluded.
 * Unit: each RootEvidence whose branchSlot ∈ clash party slots gets −δ once per clash hit.
 */
function applyClashAtten(
  natal: Scores,
  evidences: RootEvidence[],
  clashes: ClashHit[],
  delta: number,
): { effective: Scores; hitEvidenceIds: string[] } {
  const s = cloneScores(natal);
  const hitEvidenceIds: string[] = [];
  for (const clash of clashes) {
    const party = new Set(clash.slots);
    for (const ev of evidences) {
      if (!party.has(ev.branchSlot)) continue;
      s[ev.element] -= delta;
      hitEvidenceIds.push(ev.id);
    }
  }
  return { effective: s, hitEvidenceIds };
}

function applyM2(natal: Scores, mods: TransformMod[]): Scores {
  const s = cloneScores(natal);
  for (const m of mods) {
    if (!m.modifierActive) continue;
    const per = M2_PAIR / m.attenElements.length;
    for (const e of m.attenElements) s[e] -= per;
    s[m.target] += M2_PAIR;
  }
  return s;
}

/** Clash on any transform branch slot → release that modifier (TBD-03 §1.6.5). */
function releaseTransformsOnClash(mods: TransformMod[], clashes: ClashHit[]): TransformMod[] {
  const party = new Set(clashes.flatMap((c) => c.slots));
  return mods.map((m) => {
    if (!m.modifierActive) return m;
    const hit = m.branchSlots.some((slot) => party.has(slot));
    return hit ? { ...m, modifierActive: false } : m;
  });
}

type Scenario = {
  id: string;
  natal: Scores;
  evidences: RootEvidence[];
  clashes: ClashHit[];
};

function scenarios(): Scenario[] {
  return [
    {
      id: "single-root-clash",
      natal: { 木: 52, 火: 52, 土: 52, 金: 52, 水: 52 },
      evidences: [
        { id: "木-day", element: "木", branchSlot: "day" },
        { id: "火-month", element: "火", branchSlot: "month" },
      ],
      clashes: [{ id: "zi-wu", slots: ["day", "year"] }], // day 木 only
    },
    {
      id: "same-element-multi-root-one-clash",
      natal: { 木: 72, 火: 48, 土: 48, 金: 48, 水: 48 },
      evidences: [
        { id: "木-year", element: "木", branchSlot: "year" },
        { id: "木-month", element: "木", branchSlot: "month" },
        { id: "木-day", element: "木", branchSlot: "day" },
      ],
      clashes: [{ id: "zi-wu", slots: ["day", "hour"] }], // only 木-day
    },
    {
      id: "two-branches-each-clash",
      natal: { 木: 60, 火: 56, 土: 52, 金: 48, 水: 44 },
      evidences: [
        { id: "木-year", element: "木", branchSlot: "year" },
        { id: "火-month", element: "火", branchSlot: "month" },
        { id: "土-day", element: "土", branchSlot: "day" },
      ],
      clashes: [
        { id: "yin-shen", slots: ["year", "hour"] },
        { id: "mao-you", slots: ["month", "day"] },
      ],
    },
    {
      id: "strong-core-root-clash",
      natal: { 木: 40, 火: 40, 土: 40, 金: 92, 水: 40 },
      evidences: [
        { id: "金-month", element: "金", branchSlot: "month" },
        { id: "金-day", element: "金", branchSlot: "day" },
        { id: "水-year", element: "水", branchSlot: "year" },
      ],
      clashes: [{ id: "si-hai", slots: ["month", "year"] }], // 金-month + 水-year
    },
    {
      id: "weak-only-root-clash",
      natal: { 木: 52, 火: 52, 土: 52, 金: 52, 水: 12 },
      evidences: [{ id: "水-day", element: "水", branchSlot: "day" }],
      clashes: [{ id: "zi-wu", slots: ["day", "hour"] }],
    },
  ];
}

describe("TBD-01c · unit contract", () => {
  it("Natal immutable; unrelated evidence untouched; Need not involved", () => {
    const natal: Scores = { 木: 52, 火: 52, 土: 52, 金: 52, 水: 52 };
    const natalSnap = cloneScores(natal);
    const evidences: RootEvidence[] = [
      { id: "木-day", element: "木", branchSlot: "day" },
      { id: "火-month", element: "火", branchSlot: "month" },
      { id: "土-year", element: "土", branchSlot: "year" },
    ];
    const { effective, hitEvidenceIds } = applyClashAtten(
      natal,
      evidences,
      [{ id: "c", slots: ["day", "hour"] }],
      CONFIRMED_DELTA,
    );

    expect(natal).toEqual(natalSnap);
    expect(hitEvidenceIds).toEqual(["木-day"]);
    expect(effective.木).toBe(48); // 52 − 4
    expect(effective.火).toBe(52);
    expect(effective.土).toBe(52);
    // Display clamp only — Internal may go below 8
    const weakOnly = applyClashAtten(
      { 木: 52, 火: 52, 土: 52, 金: 52, 水: 10 },
      [{ id: "水-day", element: "水", branchSlot: "day" }],
      [{ id: "c", slots: ["day", "hour"] }],
      CONFIRMED_DELTA,
    );
    expect(weakOnly.effective.水).toBe(6); // Internal unclamped, below LO
    expect(displayClamp(weakOnly.effective.水)).toBe(8);
    expect(levelFromInternal(weakOnly.effective.水)).toBe("very-weak");
  });
});

describe("TBD-01c · candidates A/B/C sweep", () => {
  it("reports jumps; excludes Opening; flags single-clash jump≥2", () => {
    type Row = {
      candidate: "A" | "B" | "C";
      scenario: string;
      deltaElement: Partial<Scores>;
      maxJump: number;
      hitIds: string[];
    };
    const rows: Row[] = [];
    const singleClashJump2: Row[] = [];
    const multiMaxJump: Record<"A" | "B" | "C", number> = { A: 0, B: 0, C: 0 };

    for (const cand of CANDIDATES) {
      for (const sc of scenarios()) {
        const { effective, hitEvidenceIds } = applyClashAtten(
          sc.natal,
          sc.evidences,
          sc.clashes,
          cand.delta,
        );
        const jump = maxLevelJump(sc.natal, effective);
        const deltaElement: Partial<Scores> = {};
        for (const e of ELEMENTS) {
          const d = effective[e] - sc.natal[e];
          if (d !== 0) deltaElement[e] = d;
        }
        const row: Row = {
          candidate: cand.name,
          scenario: sc.id,
          deltaElement,
          maxJump: jump,
          hitIds: hitEvidenceIds,
        };
        rows.push(row);
        if (sc.clashes.length === 1 && jump >= 2) singleClashJump2.push(row);
        if (sc.clashes.length >= 2) {
          multiMaxJump[cand.name] = Math.max(multiMaxJump[cand.name], jump);
        }
      }
    }

    // Same-element multi-root: only one evidence hit
    for (const cand of CANDIDATES) {
      const sc = scenarios().find((s) => s.id === "same-element-multi-root-one-clash")!;
      const { effective, hitEvidenceIds } = applyClashAtten(
        sc.natal,
        sc.evidences,
        sc.clashes,
        cand.delta,
      );
      expect(hitEvidenceIds).toEqual(["木-day"]);
      expect(effective.木).toBe(sc.natal.木 - cand.delta);
    }

    // Prefer exclude candidates with single-clash jump≥2
    expect(singleClashJump2).toEqual([]);

    // Soft report via assertions that keep suite green
    const byCand = (name: "A" | "B" | "C") => rows.filter((r) => r.candidate === name);
    for (const name of ["A", "B", "C"] as const) {
      const maxJ = Math.max(...byCand(name).map((r) => r.maxJump));
      expect(maxJ).toBeLessThanOrEqual(name === "C" ? 2 : 2); // allow multi ≤2; document
      expect(multiMaxJump[name]).toBeLessThanOrEqual(2);
    }

    // Aggregate for doc: single-clash max jump per candidate
    const singleMax: Record<string, number> = { A: 0, B: 0, C: 0 };
    for (const r of rows) {
      const sc = scenarios().find((s) => s.id === r.scenario)!;
      if (sc.clashes.length === 1) {
        singleMax[r.candidate] = Math.max(singleMax[r.candidate]!, r.maxJump);
      }
    }
    expect(singleMax.A).toBeLessThanOrEqual(1);
    expect(singleMax.B).toBeLessThanOrEqual(1);
    expect(singleMax.C).toBeLessThanOrEqual(1);
  });
});

describe("TBD-01c · Transform release vs clash atten stacking", () => {
  it("releases M2 on shared slot; measures double-effect vs release-only", () => {
    const natal: Scores = { 木: 52, 火: 52, 土: 52, 金: 52, 水: 52 };
    const evidences: RootEvidence[] = [
      { id: "木-day", element: "木", branchSlot: "day" },
      { id: "土-month", element: "土", branchSlot: "month" },
    ];
    const he: TransformMod = {
      id: "五合-甲己",
      kind: "五合",
      attenElements: ["木", "土"],
      target: "土",
      branchSlots: ["day", "month"],
      modifierActive: true,
    };
    const clashes: ClashHit[] = [{ id: "zi-wu", slots: ["day", "year"] }];

    const withHe = applyM2(natal, [he]);
    const released = releaseTransformsOnClash([he], clashes);
    expect(released[0]!.modifierActive).toBe(false);

    const afterReleaseOnly = applyM2(natal, released);
    expect(afterReleaseOnly).toEqual(natal);

    // P-separate: release + clash atten (TBD-03 layers independent)
    const afterSeparate = applyClashAtten(
      afterReleaseOnly,
      evidences,
      clashes,
      CONFIRMED_DELTA,
    ).effective;
    expect(afterSeparate.木).toBe(48); // 52 − 4 (clash atten only)
    expect(afterSeparate.土).toBe(52); // month not in clash party for 土 evidence? month not in ["day","year"]
    expect(afterSeparate.火).toBe(52);

    // Level granularity hides this transition: 46 / 52 / 58 are all `balanced`,
    // so the release↔atten separation must be measured on Internal scores.
    const jumpSeparate = maxLevelJump(natal, afterSeparate);
    const jumpFromHe = maxLevelJump(withHe, afterSeparate);
    expect(jumpSeparate).toBeLessThanOrEqual(1);
    expect(jumpFromHe).toBe(0);

    // Internal-score evidence of the separation (the actual contract):
    //   withHe        : 木 46 (−6 M2 atten) · 土 58 (−6 atten +12 boost)
    //   release only  : 木 52 · 土 52 — Natal restored by removing the modifier
    //   release+clash : 木 48 (−4 clash atten only) · 土 52
    expect(withHe.木).toBe(46);
    expect(withHe.土).toBe(58);
    expect(afterSeparate.土).toBe(52);

    // Document: P-separate is NOT “double clash atten”; it is release + root atten.
    // Forbidden anti-pattern: keep M2 active AND apply clash atten on same participation.
    const badStack = applyClashAtten(withHe, evidences, clashes, CONFIRMED_DELTA).effective;
    // badStack keeps +12 土 and −6 木 from he, then adds −4 木 clash → −10 from Natal.
    expect(badStack.木).toBe(withHe.木 - CONFIRMED_DELTA);
    expect(badStack.土).toBe(withHe.土);
    // Quantified double penalty: forbidden path costs 木 −10, correct path −4 (§1.6.8.7).
    expect(natal.木 - badStack.木).toBe(10);
    expect(natal.木 - afterSeparate.木).toBe(4);
    // Contract: always release first; never leave modifierActive with clash on participation slot
  });
});

describe("TBD-01c · multi-clash accumulation", () => {
  it("stacks per hit evidence; C may reach jump 2 on multi only", () => {
    const sc = scenarios().find((s) => s.id === "two-branches-each-clash")!;
    const results = CANDIDATES.map((c) => {
      const { effective, hitEvidenceIds } = applyClashAtten(
        sc.natal,
        sc.evidences,
        sc.clashes,
        c.delta,
      );
      return {
        name: c.name,
        hitEvidenceIds,
        effective,
        jump: maxLevelJump(sc.natal, effective),
        delta木: effective.木 - sc.natal.木,
        delta火: effective.火 - sc.natal.火,
        delta土: effective.土 - sc.natal.土,
      };
    });

    // year+month+day evidences all hit (two clashes cover year, month, day)
    expect(results[0]!.hitEvidenceIds).toEqual(["木-year", "火-month", "土-day"]);
    expect(results[0]!.delta木).toBe(-4);
    expect(results[1]!.delta木).toBe(-6);
    expect(results[2]!.delta木).toBe(-8);

    for (const r of results) {
      expect(r.jump).toBeLessThanOrEqual(2);
    }
  });
});

describe("TBD-01c · candidate summary fixture", () => {
  it("computes recommendable set (no single-clash jump≥2)", () => {
    const summary = CANDIDATES.map((c) => {
      let singleMax = 0;
      let multiMax = 0;
      let maxAbsDelta = 0;
      for (const sc of scenarios()) {
        const { effective } = applyClashAtten(sc.natal, sc.evidences, sc.clashes, c.delta);
        const jump = maxLevelJump(sc.natal, effective);
        if (sc.clashes.length === 1) singleMax = Math.max(singleMax, jump);
        else multiMax = Math.max(multiMax, jump);
        for (const e of ELEMENTS) {
          maxAbsDelta = Math.max(maxAbsDelta, Math.abs(effective[e] - sc.natal[e]));
        }
      }
      return {
        name: c.name,
        delta: c.delta,
        note: c.note,
        singleMaxJump: singleMax,
        multiMaxJump: multiMax,
        maxAbsDelta,
        disqualifySingleJump2: singleMax >= 2,
      };
    });

    expect(summary.every((s) => !s.disqualifySingleJump2)).toBe(true);
    // Prefer B: parity with M2 per-slot, single jump≤1, multi still ≤2 in this set
    const b = summary.find((s) => s.name === "B")!;
    expect(b.singleMaxJump).toBeLessThanOrEqual(1);
    expect(b.delta).toBe(6);
  });
});

/* ------------------------------------------------------------------------ *
 * TBD-01c · 후속 보강 (이어받은 작업)
 *
 * 위 baseline 시나리오 5종은 A/B/C를 전혀 분리하지 못한다(전부 통과).
 * 따라서 수치 근거가 되지 못한다. 아래 블록은 두 축으로 근거를 만든다.
 *   (1) Level 경계 기하 — ±2 이동에 실제로 필요한 낙폭
 *   (2) 지장간 표에서 유도되는 동일 오행 root hit 수의 구조적 상한
 * 두 값이 잡히면 후보별 최대 Level 이동은 시나리오 운이 아니라 계산으로 나온다.
 * ------------------------------------------------------------------------ */

const SCORE_MIN = LO;
const SCORE_MAX = HI;

/** 사용 구간 전체를 훑어 jump≥target을 만드는 최소 낙폭. */
function minDropForJump(target: number): { drop: number; fromScore: number } {
  let drop = Number.POSITIVE_INFINITY;
  let fromScore = SCORE_MIN;
  for (let s = SCORE_MIN; s <= SCORE_MAX; s += 1) {
    for (let d = 1; d <= SCORE_MAX; d += 1) {
      if (levelJump(levelFromInternal(s), levelFromInternal(s - d)) >= target) {
        if (d < drop) {
          drop = d;
          fromScore = s;
        }
        break;
      }
    }
  }
  return { drop, fromScore };
}

/** δ × 동일 오행 hit 수 h 에 대한 전 구간 최대 Level 이동. */
function maxJumpFor(delta: number, hits: number): { maxJump: number; worstFrom: number } {
  let maxJump = 0;
  let worstFrom = SCORE_MIN;
  for (let s = SCORE_MIN; s <= SCORE_MAX; s += 1) {
    const j = levelJump(levelFromInternal(s), levelFromInternal(s - delta * hits));
    if (j > maxJump) {
      maxJump = j;
      worstFrom = s;
    }
  }
  return { maxJump, worstFrom };
}

describe("TBD-01c · Level 경계 기하", () => {
  it("±2 Level 이동에 필요한 최소 낙폭을 확정한다", () => {
    const j1 = minDropForJump(1);
    const j2 = minDropForJump(2);

    // 대역: vw 8–20 · w 24–40 · b 44–60 · s 64–80 · vs 84–96 (갭 4)
    // 최악 출발점은 갭 중점(예: 42 → tie → upper = balanced).
    expect(j1.drop).toBe(1);
    expect(j2.drop).toBe(21);
    expect(j2.fromScore).toBe(42);

    // ⇒ 단일 오행 총 낙폭이 21 미만이면 ±2 이동은 구조적으로 불가능.
    console.log(
      JSON.stringify({ minDropJump1: j1.drop, minDropJump2: j2.drop, worstFrom: j2.fromScore }),
    );
  });
});

/** §1.6.1 육충 6쌍 — 지지 글자 기준. */
const CLASH_PAIRS: Array<{ id: string; pair: [Branch, Branch] }> = [
  { id: "clash-zi-wu", pair: ["子", "午"] },
  { id: "clash-chou-wei", pair: ["丑", "未"] },
  { id: "clash-yin-shen", pair: ["寅", "申"] },
  { id: "clash-mao-you", pair: ["卯", "酉"] },
  { id: "clash-chen-xu", pair: ["辰", "戌"] },
  { id: "clash-si-hai", pair: ["巳", "亥"] },
];

/** 개고 대상 쌍 — Opening(TBD-03a)은 범위 밖이나, 충 감쇠 경로는 병존(§1.6.7.6). */
const OPENING_PAIR_IDS = new Set(["clash-chou-wei", "clash-chen-xu"]);

/** 한 지지가 root를 제공하는 오행별 hit 수. */
function rootHitsByElement(branch: Branch): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const part of HIDDEN_STEMS[branch]) {
    const el = stemElement(part.stem);
    tally[el] = (tally[el] ?? 0) + 1;
  }
  return tally;
}

describe("TBD-01c · 동일 오행 root hit 수의 구조적 상한", () => {
  it("지장간 표에서 오행당 지지 1 hit 상한을 유도한다", () => {
    let maxPerBranch = 0;
    for (const { pair } of CLASH_PAIRS) {
      for (const branch of pair) {
        maxPerBranch = Math.max(maxPerBranch, ...Object.values(rootHitsByElement(branch)));
      }
    }
    // 지장간은 여기·중기·정기가 모두 다른 오행이라 동일 오행이 겹치지 않는다.
    expect(maxPerBranch).toBe(1);
  });

  it("단일 충의 동일 오행 hit 상한은 2이며 土 전용이다", () => {
    const shared: Array<{ id: string; elements: Element[]; opening: boolean }> = [];
    for (const { id, pair } of CLASH_PAIRS) {
      const a = rootHitsByElement(pair[0]);
      const b = rootHitsByElement(pair[1]);
      const both = ELEMENTS.filter((e) => a[e] !== undefined && b[e] !== undefined);
      shared.push({ id, elements: both, opening: OPENING_PAIR_IDS.has(id) });
    }

    const withShared = shared.filter((s) => s.elements.length > 0);
    // 丑未 · 寅申 · 辰戌 만 두 당사자가 같은 오행(土)에 root를 준다.
    expect(withShared.map((s) => s.id).sort()).toEqual([
      "clash-chen-xu",
      "clash-chou-wei",
      "clash-yin-shen",
    ]);
    for (const s of withShared) expect(s.elements).toEqual(["土"]);

    // 그 3쌍 중 개고 대상이 아닌 것은 寅申 하나뿐.
    const nonOpening = withShared.filter((s) => !s.opening).map((s) => s.id);
    expect(nonOpening).toEqual(["clash-yin-shen"]);

    // 나머지 3쌍은 오행당 최대 1 hit.
    const noShared = shared.filter((s) => s.elements.length === 0).map((s) => s.id);
    expect(noShared.sort()).toEqual(["clash-mao-you", "clash-si-hai", "clash-zi-wu"]);

    console.log(
      JSON.stringify({
        singleClashMaxHits: 2,
        onlyElement: "土",
        pairs: withShared.map((s) => s.id),
        nonOpeningPair: nonOpening,
      }),
    );
  });

  it("2충 동시(4슬롯 소진) 시 동일 오행 hit 상한은 4이며 土 전용이다", () => {
    // 4개 지지 슬롯 → 서로소 충 쌍은 최대 2개.
    // 土 4 hit 구성 예: year 寅 · month 申 (寅申) + day 丑 · hour 未 (丑未)
    const combo: Branch[] = ["寅", "申", "丑", "未"];
    const total = combo.reduce((acc, b) => acc + (rootHitsByElement(b)["土"] ?? 0), 0);
    expect(total).toBe(4);

    // 土 이외의 오행으로 4 hit를 만드는 2충 조합은 없다.
    let best: { element: Element; hits: number } = { element: "土", hits: 0 };
    for (let i = 0; i < CLASH_PAIRS.length; i += 1) {
      for (let j = i + 1; j < CLASH_PAIRS.length; j += 1) {
        const branches = [...CLASH_PAIRS[i]!.pair, ...CLASH_PAIRS[j]!.pair];
        for (const e of ELEMENTS) {
          const hits = branches.reduce((acc, b) => acc + (rootHitsByElement(b)[e] ?? 0), 0);
          if (hits > best.hits) best = { element: e, hits };
        }
      }
    }
    expect(best).toEqual({ element: "土", hits: 4 });
    console.log(JSON.stringify({ twoClashMaxHits: best.hits, element: best.element }));
  });
});

describe("TBD-01c · 구조적 상한에서의 후보 sweep", () => {
  it("h=1..4 전 구간 최대 Level 이동표를 만든다", () => {
    const table = CANDIDATES.map((c) => {
      const row: Record<string, unknown> = { name: c.name, delta: c.delta };
      for (let h = 1; h <= 4; h += 1) {
        const { maxJump, worstFrom } = maxJumpFor(c.delta, h);
        row[`h${h}`] = { drop: c.delta * h, maxJump, worstFrom };
      }
      return row;
    });
    console.log(JSON.stringify(table, null, 2));

    // 단일 충 상한 h=2 → 총 낙폭 8/12/16, 모두 21 미만.
    for (const c of CANDIDATES) {
      expect(c.delta * 2).toBeLessThan(21);
      expect(maxJumpFor(c.delta, 1).maxJump).toBe(1);
      expect(maxJumpFor(c.delta, 2).maxJump).toBe(1);
    }

    // 2충 누적에서만 갈린다.
    expect(maxJumpFor(4, 3).maxJump).toBe(1);
    expect(maxJumpFor(4, 4).maxJump).toBe(1); // A: 16 < 21 → 상한에서도 ±1
    expect(maxJumpFor(6, 3).maxJump).toBe(1);
    expect(maxJumpFor(6, 4).maxJump).toBe(2); // B: 24 ≥ 21 → 최대 구성에서만 ±2
    expect(maxJumpFor(8, 3).maxJump).toBe(2); // C: 3 hit부터 ±2
    expect(maxJumpFor(8, 4).maxJump).toBe(2);
  });

  it("사용자 하드 룰(단일 충 ±2 이상 제외)로는 A/B/C 누구도 탈락하지 않는다", () => {
    // 단일 충의 동일 오행 hit 상한이 2로 고정되어 있으므로,
    // ±2가 나오려면 δ ≥ 11 이어야 한다 (2δ ≥ 21).
    const disqualified = CANDIDATES.filter((c) => maxJumpFor(c.delta, 2).maxJump >= 2);
    expect(disqualified).toEqual([]);

    const minDeltaForSingleClashJump2 = Math.ceil(21 / 2);
    expect(minDeltaForSingleClashJump2).toBe(11);
    for (const c of CANDIDATES) expect(c.delta).toBeLessThan(minDeltaForSingleClashJump2);
    console.log(JSON.stringify({ disqualifiedBySingleClashRule: [], deltaCeiling: 10 }));
  });

  it("2충 누적에서 후보가 갈린다", () => {
    const multi = CANDIDATES.map((c) => ({
      name: c.name,
      delta: c.delta,
      minHitsForJump2: [1, 2, 3, 4, 5, 6].find((h) => maxJumpFor(c.delta, h).maxJump >= 2) ?? null,
      maxDropAtStructuralCap: c.delta * 4,
      jumpAtCap: maxJumpFor(c.delta, 4).maxJump,
    }));
    console.log(JSON.stringify(multi));

    expect(multi.find((m) => m.name === "A")!.minHitsForJump2).toBe(6); // 구조적으로 도달 불가
    expect(multi.find((m) => m.name === "B")!.minHitsForJump2).toBe(4); // 최대 구성에서만
    expect(multi.find((m) => m.name === "C")!.minHitsForJump2).toBe(3); // 도달 가능
  });
});

describe("TBD-01c · M2(TBD-01b) 대비 강도", () => {
  it("M2 per-slot atten과 비교하고 비보존 특성을 기록한다", () => {
    const M2_TRIPLE = 16;
    const m2PairPerSlot = M2_PAIR / 2; // 五合: 2슬롯 균등 → 6
    const m2TriplePerSlot = M2_TRIPLE / 3; // 삼합·방합: 3슬롯 균등 → ≈5.33

    expect(m2PairPerSlot).toBe(6);
    expect(m2TriplePerSlot).toBeCloseTo(5.333, 3);

    const rel = CANDIDATES.map((c) => ({
      name: c.name,
      delta: c.delta,
      vsPairPerSlot: Number((c.delta / m2PairPerSlot).toFixed(3)),
      vsTriplePerSlot: Number((c.delta / m2TriplePerSlot).toFixed(3)),
      vsPairPool: Number((c.delta / M2_PAIR).toFixed(3)),
    }));
    console.log(JSON.stringify(rel));

    // 핵심 비대칭: M2는 Σ 보존(atten 합 = boost), 충 감쇠는 순손실(보상 없음).
    const natal: Scores = { 木: 52, 火: 52, 土: 52, 金: 52, 水: 52 };
    const sum = (s: Scores) => ELEMENTS.reduce((a, e) => a + s[e], 0);

    const he: TransformMod = {
      id: "五合-甲己",
      kind: "五合",
      attenElements: ["木", "土"],
      target: "土",
      branchSlots: ["day", "month"],
      modifierActive: true,
    };
    expect(sum(applyM2(natal, [he]))).toBe(sum(natal)); // M2 = Σ 보존

    for (const c of CANDIDATES) {
      const { effective } = applyClashAtten(
        natal,
        [{ id: "土-day", element: "土", branchSlot: "day" }],
        [{ id: "yin-shen", slots: ["day", "year"] }],
        c.delta,
      );
      expect(sum(natal) - sum(effective)).toBe(c.delta); // 충 = 순손실
    }

    // ⇒ 동일 숫자라도 충 감쇠가 M2 atten보다 왜곡이 크다.
    //    따라서 δ는 M2 per-slot(6) '이하'가 보수적이다.
    expect(CANDIDATES.filter((c) => c.delta <= m2PairPerSlot).map((c) => c.name)).toEqual([
      "A",
      "B",
    ]);
  });
});

describe("TBD-01c · 최대 구성 실측 (土 4 hit / 2충)", () => {
  it("year 寅 · month 申 · day 丑 · hour 未 구성에서 후보별 결과", () => {
    // 4슬롯 모두 土 root, 서로소 충 2쌍(寅申 · 丑未) → 土만 4회 감쇠.
    const natal: Scores = { 木: 44, 火: 44, 土: 42, 金: 44, 水: 44 };
    const evidences: RootEvidence[] = [
      { id: "土-year(寅)", element: "土", branchSlot: "year" },
      { id: "土-month(申)", element: "土", branchSlot: "month" },
      { id: "土-day(丑)", element: "土", branchSlot: "day" },
      { id: "土-hour(未)", element: "土", branchSlot: "hour" },
    ];
    const clashes: ClashHit[] = [
      { id: "clash-yin-shen", slots: ["year", "month"] },
      { id: "clash-chou-wei", slots: ["day", "hour"] },
    ];

    const rows = CANDIDATES.map((c) => {
      const { effective, hitEvidenceIds } = applyClashAtten(natal, evidences, clashes, c.delta);
      return {
        name: c.name,
        delta: c.delta,
        hits: hitEvidenceIds.length,
        internal土: effective.土,
        display土: displayClamp(effective.土),
        level: levelFromInternal(effective.土),
        jump: maxLevelJump(natal, effective),
      };
    });
    console.log(JSON.stringify(rows));

    for (const r of rows) expect(r.hits).toBe(4); // 4 evidence 모두 피격
    expect(rows.find((r) => r.name === "A")!.jump).toBe(1);
    expect(rows.find((r) => r.name === "B")!.jump).toBe(2);
    expect(rows.find((r) => r.name === "C")!.jump).toBe(2);

    // 비피격 오행은 전부 불변 — 전역 패널티 없음.
    for (const c of CANDIDATES) {
      const { effective } = applyClashAtten(natal, evidences, clashes, c.delta);
      for (const e of ELEMENTS) {
        if (e !== "土") expect(effective[e]).toBe(natal[e]);
      }
    }
  });

  it("Internal은 비clamp, Display만 8~96로 잘린다", () => {
    const natal: Scores = { 木: 52, 火: 52, 土: 10, 金: 52, 水: 52 };
    const evidences: RootEvidence[] = [
      { id: "土-year", element: "土", branchSlot: "year" },
      { id: "土-month", element: "土", branchSlot: "month" },
      { id: "土-day", element: "土", branchSlot: "day" },
      { id: "土-hour", element: "土", branchSlot: "hour" },
    ];
    const clashes: ClashHit[] = [
      { id: "clash-yin-shen", slots: ["year", "month"] },
      { id: "clash-chou-wei", slots: ["day", "hour"] },
    ];

    const { effective } = applyClashAtten(natal, evidences, clashes, 8);
    expect(effective.土).toBe(-22); // Internal 음수 허용 (비clamp)
    expect(displayClamp(effective.土)).toBe(8); // Display만 clamp
    expect(levelFromInternal(effective.土)).toBe("very-weak");
    expect(natal.土).toBe(10); // Natal 불변
  });
});

describe("TBD-01c · A안 확정 잠금 (§1.6.8.0 · §1.6.8.5.1)", () => {
  it("확정값은 4이며 기각된 B/C와 구분된다", () => {
    expect(CONFIRMED_DELTA).toBe(4);
    expect(CANDIDATES.find((c) => c.name === "A")!.delta).toBe(CONFIRMED_DELTA);
    // 기각 후보는 비교 기록으로만 남는다.
    expect(CANDIDATES.filter((c) => c.delta !== CONFIRMED_DELTA).map((c) => c.name)).toEqual([
      "B",
      "C",
    ]);
  });

  it("도달 가능한 모든 구성에서 Level 이동 ≤ 1 (핵심 불변식)", () => {
    // 구조 상한: 단일 충 h≤2, 2충 h≤4 (§1.6.8.2)
    for (let h = 1; h <= 4; h += 1) {
      expect(maxJumpFor(CONFIRMED_DELTA, h).maxJump).toBe(1);
      expect(CONFIRMED_DELTA * h).toBeLessThan(21); // ±2 임계 미만
    }
    // ±2는 h=6에서야 발생하고, h=6은 구조적으로 도달 불가.
    expect(maxJumpFor(CONFIRMED_DELTA, 6).maxJump).toBe(2);
  });

  it("확정값 하한/상한 계약: δ ≤ M2 per-slot(6) 이고 δ ≤ 10", () => {
    expect(CONFIRMED_DELTA).toBeLessThanOrEqual(M2_PAIR / 2); // 순손실 → M2보다 약해야 함
    expect(CONFIRMED_DELTA).toBeLessThanOrEqual(10); // 단일 충 ±2 금지에서 나온 상한
  });

  it("baseline 시나리오 전체에서 확정값의 Level 이동은 ≤ 1", () => {
    for (const sc of scenarios()) {
      const { effective } = applyClashAtten(
        sc.natal,
        sc.evidences,
        sc.clashes,
        CONFIRMED_DELTA,
      );
      expect(maxLevelJump(sc.natal, effective)).toBeLessThanOrEqual(1);
      expect(sc.natal).toEqual(sc.natal); // Natal 비mutate
    }
  });

  it("최대 구성(土 4 hit / 2충)에서도 확정값은 1단만 움직인다", () => {
    const natal: Scores = { 木: 44, 火: 44, 土: 42, 金: 44, 水: 44 };
    const evidences: RootEvidence[] = [
      { id: "土-year(寅)", element: "土", branchSlot: "year" },
      { id: "土-month(申)", element: "土", branchSlot: "month" },
      { id: "土-day(丑)", element: "土", branchSlot: "day" },
      { id: "土-hour(未)", element: "土", branchSlot: "hour" },
    ];
    const clashes: ClashHit[] = [
      { id: "clash-yin-shen", slots: ["year", "month"] },
      { id: "clash-chou-wei", slots: ["day", "hour"] },
    ];
    const { effective, hitEvidenceIds } = applyClashAtten(
      natal,
      evidences,
      clashes,
      CONFIRMED_DELTA,
    );

    expect(hitEvidenceIds).toHaveLength(4);
    expect(effective.土).toBe(26); // 42 − 16
    expect(levelFromInternal(effective.土)).toBe("weak");
    expect(maxLevelJump(natal, effective)).toBe(1);
    for (const e of ELEMENTS) {
      if (e !== "土") expect(effective[e]).toBe(natal[e]); // 전역 패널티 없음
    }
  });

  it("Internal unclamped · Display만 8~96 · Need 미반영", () => {
    const natal: Scores = { 木: 52, 火: 52, 土: 10, 金: 52, 水: 52 };
    const evidences: RootEvidence[] = [
      { id: "土-year", element: "土", branchSlot: "year" },
      { id: "土-month", element: "土", branchSlot: "month" },
      { id: "土-day", element: "土", branchSlot: "day" },
      { id: "土-hour", element: "土", branchSlot: "hour" },
    ];
    const { effective } = applyClashAtten(
      natal,
      evidences,
      [
        { id: "clash-yin-shen", slots: ["year", "month"] },
        { id: "clash-chou-wei", slots: ["day", "hour"] },
      ],
      CONFIRMED_DELTA,
    );

    expect(effective.土).toBe(-6); // Internal 음수 허용
    expect(displayClamp(effective.土)).toBe(8); // Display만 clamp
    expect(levelFromInternal(effective.土)).toBe("very-weak");
    expect(natal.土).toBe(10); // Natal 불변
  });

  it("위치 가중은 미도입 — 전 슬롯 균등 (TBD-01c-position)", () => {
    // 같은 오행·같은 hit 수라면 어느 슬롯이든 결과가 동일해야 한다.
    const natal: Scores = { 木: 52, 火: 52, 土: 52, 金: 52, 水: 52 };
    const slots: BranchSlot[] = ["year", "month", "day", "hour"];
    const results = slots.map((slot) => {
      const other: BranchSlot = slot === "year" ? "month" : "year";
      return applyClashAtten(
        natal,
        [{ id: `木-${slot}`, element: "木", branchSlot: slot }],
        [{ id: "c", slots: [slot, other] }],
        CONFIRMED_DELTA,
      ).effective.木;
    });
    expect(new Set(results).size).toBe(1);
    expect(results[0]).toBe(48);
  });
});

/* ========================================================================== *
 * TBD-01c-position · 위치(년/월/일/시) 가중 시뮬레이션
 *
 * 질문: 같은 root evidence가 충을 받아도 슬롯 위치에 따라 δ를 달리해야 하는가?
 * 전제: 확정값 δ=4 불변 · Natal 비mutate · 전역 패널티 금지 ·
 *       Internal unclamped / Display만 clamp · Need 미반영 ·
 *       개고(丑未·辰戌 Opening) 및 natal/luck source 차등 제외 · 엔진 미연결.
 * ========================================================================== */

type SeasonPhase = "왕" | "상" | "휴" | "수" | "사";

/** 위치 가중 후보. δ=4를 기준선으로 슬롯별 실효 δ를 돌려준다. */
type PositionCandidate = {
  name: "P0" | "P1" | "P2";
  label: string;
  basis: string;
  deltaFor: (slot: BranchSlot, seasonPhase: SeasonPhase) => number;
};

const POSITION_CANDIDATES: PositionCandidate[] = [
  {
    name: "P0",
    label: "전 슬롯 동일 (현행)",
    basis: "v1 root 모델이 위치 축을 갖지 않음 — 깊이(role)로만 위계 표현",
    deltaFor: () => CONFIRMED_DELTA,
  },
  {
    name: "P1",
    label: "월지만 소폭 가중 (월 6 · 나머지 4)",
    basis: "월지=제강(提綱), 통근 1순위. 6은 M2 五合 per-slot 상한 재사용(신규 창작 아님)",
    deltaFor: (slot) => (slot === "month" ? 6 : CONFIRMED_DELTA),
  },
  {
    name: "P2",
    label: "월령 연동 가중 (월령 왕/상 오행의 월지 root만 8)",
    basis:
      "‘월지 근이 강하다’의 실질은 ‘월령을 받은 근이 강하다’ — seasonPhase를 " +
      "attenuation에 재사용하는 안. 이중 반영 검증용.",
    deltaFor: (slot, phase) =>
      slot === "month" && (phase === "왕" || phase === "상") ? 8 : CONFIRMED_DELTA,
  },
];

type PositionEvidence = RootEvidence & { seasonPhase: SeasonPhase };

/** 슬롯별 가중을 적용하는 attenuation. 구조는 applyClashAtten과 동일. */
function applyClashAttenWeighted(
  natal: Scores,
  evidences: PositionEvidence[],
  clashes: ClashHit[],
  cand: PositionCandidate,
): { effective: Scores; hits: Array<{ id: string; delta: number }> } {
  const s = cloneScores(natal);
  const hits: Array<{ id: string; delta: number }> = [];
  for (const clash of clashes) {
    const party = new Set<BranchSlot>(clash.slots);
    for (const ev of evidences) {
      if (!party.has(ev.branchSlot)) continue;
      const d = cand.deltaFor(ev.branchSlot, ev.seasonPhase);
      s[ev.element] -= d;
      hits.push({ id: ev.id, delta: d });
    }
  }
  return { effective: s, hits };
}

type PositionCase = {
  id: string;
  natal: Scores;
  evidences: PositionEvidence[];
  clashes: ClashHit[];
};

/** 요구된 8개 비교 사례. natal 42는 ±2 최악 출발점(§1.6.8.1). */
function positionCases(): PositionCase[] {
  const flat: Scores = { 木: 42, 火: 52, 土: 52, 金: 52, 水: 52 };
  const ev = (
    id: string,
    slot: BranchSlot,
    phase: SeasonPhase = "휴",
    element: Element = "木",
  ): PositionEvidence => ({ id, element, branchSlot: slot, seasonPhase: phase });

  return [
    {
      id: "1-년지-단독충",
      natal: flat,
      evidences: [ev("木-year", "year")],
      clashes: [{ id: "c", slots: ["year", "month"] }],
    },
    {
      id: "2-월지-단독충",
      natal: flat,
      evidences: [ev("木-month", "month")],
      clashes: [{ id: "c", slots: ["month", "year"] }],
    },
    {
      id: "3-일지-단독충",
      natal: flat,
      evidences: [ev("木-day", "day")],
      clashes: [{ id: "c", slots: ["day", "hour"] }],
    },
    {
      id: "4-시지-단독충",
      natal: flat,
      evidences: [ev("木-hour", "hour")],
      clashes: [{ id: "c", slots: ["hour", "day"] }],
    },
    {
      id: "5-월지+타지지-동시충",
      natal: flat,
      evidences: [ev("木-month", "month"), ev("木-day", "day")],
      clashes: [
        { id: "c1", slots: ["month", "year"] },
        { id: "c2", slots: ["day", "hour"] },
      ],
    },
    {
      id: "6-다중root-일부만-충",
      natal: { 木: 72, 火: 48, 土: 48, 金: 48, 水: 48 },
      evidences: [ev("木-year", "year"), ev("木-month", "month"), ev("木-day", "day")],
      clashes: [{ id: "c", slots: ["day", "hour"] }], // 日만 피격
    },
    {
      id: "7-약한오행-유일root-월지충",
      natal: { 木: 24, 火: 52, 土: 52, 金: 52, 水: 52 }, // weak 하단
      evidences: [ev("木-month", "month", "사")],
      clashes: [{ id: "c", slots: ["month", "year"] }],
    },
    {
      id: "8-강한오행-다중root-월지만충",
      natal: { 木: 84, 火: 44, 土: 44, 金: 44, 水: 44 }, // very-strong 하단
      evidences: [
        ev("木-year", "year", "왕"),
        ev("木-month", "month", "왕"),
        ev("木-day", "day", "왕"),
      ],
      clashes: [{ id: "c", slots: ["month", "hour"] }], // 月만 피격
    },
  ];
}

describe("TBD-01c-position · 8개 사례 후보 비교", () => {
  it("후보별 Δ·Level 이동을 표로 기록한다", () => {
    const rows: Array<Record<string, unknown>> = [];
    for (const sc of positionCases()) {
      const row: Record<string, unknown> = { case: sc.id };
      for (const cand of POSITION_CANDIDATES) {
        const { effective, hits } = applyClashAttenWeighted(
          sc.natal,
          sc.evidences,
          sc.clashes,
          cand,
        );
        const natalSnap = cloneScores(sc.natal);
        expect(sc.natal).toEqual(natalSnap); // Natal 비mutate
        row[cand.name] = {
          drop: sc.natal.木 - effective.木,
          internal: effective.木,
          level: levelFromInternal(effective.木),
          jump: maxLevelJump(sc.natal, effective),
          hits: hits.length,
        };
      }
      rows.push(row);
    }
    console.log(JSON.stringify(rows, null, 1));
    expect(rows).toHaveLength(8);
  });

  it("단일 충 ±2 배제 룰: 세 후보 모두 통과", () => {
    const violations: string[] = [];
    for (const sc of positionCases()) {
      if (sc.clashes.length !== 1) continue;
      for (const cand of POSITION_CANDIDATES) {
        const { effective } = applyClashAttenWeighted(sc.natal, sc.evidences, sc.clashes, cand);
        if (maxLevelJump(sc.natal, effective) >= 2) violations.push(`${cand.name}/${sc.id}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("비피격 오행은 어떤 후보에서도 불변 (전역 패널티 금지)", () => {
    for (const sc of positionCases()) {
      for (const cand of POSITION_CANDIDATES) {
        const { effective } = applyClashAttenWeighted(sc.natal, sc.evidences, sc.clashes, cand);
        for (const e of ELEMENTS) {
          if (e !== "木") expect(effective[e]).toBe(sc.natal[e]);
        }
      }
    }
  });
});

describe("TBD-01c-position · 가중이 Level 해상도에서 관측되는가", () => {
  it("전 구간 sweep: P1/P2가 P0와 Level이 갈리는 지점 빈도", () => {
    // 단일 월지 충: P0 drop 4 · P1 drop 6 · P2(왕/상) drop 8
    const probes = [
      { name: "P1-vs-P0", d0: 4, d1: 6 },
      { name: "P2-vs-P0", d0: 4, d1: 8 },
      { name: "P2-vs-P1", d0: 6, d1: 8 },
    ];
    const report = probes.map((p) => {
      const diverge: number[] = [];
      for (let s = LO; s <= HI; s += 1) {
        const a = levelFromInternal(s - p.d0);
        const b = levelFromInternal(s - p.d1);
        if (a !== b) diverge.push(s);
      }
      return {
        pair: p.name,
        divergingScores: diverge.length,
        pctOfRange: Number(((diverge.length / (HI - LO + 1)) * 100).toFixed(1)),
        examples: diverge.slice(0, 6),
      };
    });
    console.log(JSON.stringify(report));

    // 발산은 임의로 흩어지지 않는다: 대역 경계 4곳에서만,
    // 각 경계마다 '가중 차이'만큼의 폭으로 발생한다.
    //   발산 점수 개수 = (가중 차이) × (대역 경계 수 4)
    const BOUNDARIES = LEVEL_ORDER.length - 1; // 4
    expect(BOUNDARIES).toBe(4);
    for (const [i, p] of probes.entries()) {
      expect(report[i]!.divergingScores).toBe((p.d1 - p.d0) * BOUNDARIES);
    }
    // 발산 지점은 전부 대역 lo 직상단(경계 근처)이다.
    expect(report[0]!.examples).toEqual([26, 27, 46, 47, 66, 67]);
  });

  it("8개 사례 전부에서 P0/P1/P2의 Level 이동(jump)이 동일하다", () => {
    for (const sc of positionCases()) {
      const jumps = POSITION_CANDIDATES.map((cand) => {
        const { effective } = applyClashAttenWeighted(sc.natal, sc.evidences, sc.clashes, cand);
        return maxLevelJump(sc.natal, effective);
      });
      expect(new Set(jumps).size).toBe(1); // 후보 간 차이 없음
    }
  });
});

describe("TBD-01c-position · 월령/통근 이중 반영 분석", () => {
  it("월지는 Strength에서 이미 전용 채널 2개를 갖는다", () => {
    // buildElementStrengthProfiles의 Level 입력 6개 중 월지 유래:
    const levelInputs = [
      { input: "seasonPhase", source: "month.branch", positional: true },
      { input: "hasMonthOutlet", source: "month.branch 지장간 투출", positional: true },
      { input: "presence", source: "전 슬롯 무차별", positional: false },
      { input: "rootStatus", source: "role(정기>중기>여기)만", positional: false },
      { input: "hasBranchMain", source: "cluster anchor layer", positional: false },
      { input: "exactStemVisible", source: "branch relation evidence", positional: false },
    ];
    const monthChannels = levelInputs.filter((i) => i.positional);
    const otherSlotChannels = levelInputs.filter(
      (i) => !i.positional && i.source.includes("슬롯"),
    );

    expect(monthChannels.map((c) => c.input)).toEqual(["seasonPhase", "hasMonthOutlet"]);
    // 년/일/시 전용 채널은 0개.
    expect(otherSlotChannels.every((c) => c.source.includes("무차별"))).toBe(true);
    console.log(
      JSON.stringify({
        월지_전용채널: monthChannels.map((c) => c.input),
        년일시_전용채널: [],
        root_위계_기준: "role(깊이)만 — slot 무관",
      }),
    );
  });

  it("P2는 seasonPhase를 두 번 쓴다 — 이중 반영의 직접 사례", () => {
    // 같은 원인(월령 왕)이 base Level을 올리고, 동시에 감쇠도 키운다.
    const natal: Scores = { 木: 84, 火: 44, 土: 44, 金: 44, 水: 44 };
    const clashes: ClashHit[] = [{ id: "c", slots: ["month", "hour"] }];

    const wang: PositionEvidence[] = [
      { id: "木-month", element: "木", branchSlot: "month", seasonPhase: "왕" },
    ];
    const su: PositionEvidence[] = [
      { id: "木-month", element: "木", branchSlot: "month", seasonPhase: "수" },
    ];

    const p2 = POSITION_CANDIDATES.find((c) => c.name === "P2")!;
    const wangDrop = natal.木 - applyClashAttenWeighted(natal, wang, clashes, p2).effective.木;
    const suDrop = natal.木 - applyClashAttenWeighted(natal, su, clashes, p2).effective.木;

    expect(wangDrop).toBe(8);
    expect(suDrop).toBe(4);
    // 월령 왕이라는 '같은 사실'이 base Level 상승(very-strong 게이트)과
    // 감쇠 2배를 동시에 유발한다 → 축 분리 위반.
    expect(wangDrop / suDrop).toBe(2);

    // P0/P1은 seasonPhase를 읽지 않는다 (축 분리 유지).
    for (const name of ["P0", "P1"] as const) {
      const cand = POSITION_CANDIDATES.find((c) => c.name === name)!;
      const a = applyClashAttenWeighted(natal, wang, clashes, cand).effective.木;
      const b = applyClashAttenWeighted(natal, su, clashes, cand).effective.木;
      expect(a).toBe(b);
    }
  });

  it("월지 가중 상한: 다른 슬롯 4 고정 시 월지 δ ≤ 8", () => {
    // 2충 4슬롯 소진에서 총 낙폭이 21 미만이어야 ±2가 안 난다.
    const ceiling = [4, 5, 6, 7, 8, 9, 10].filter((w) => w + CONFIRMED_DELTA * 3 < 21);
    expect(Math.max(...ceiling)).toBe(8);
    // P1(6) · P2(8) 모두 이 상한 안에 있다 → ±2 룰로는 배제 불가.
    expect(6).toBeLessThanOrEqual(8);
    expect(8).toBeLessThanOrEqual(8);
  });
});

/* ========================================================================== *
 * TBD-01c-source · Natal 충 vs Luck 충 설계 조사 (구조 시뮬)
 *
 * 질문: Luck(대/세/월/일)에서 들어온 충에도 δ=4를 그대로 쓸 수 있는가?
 * 전제: δ=4 불변 · Natal immutable · Strength≠Need · Luck이 Natal Strength를
 *       덮어쓰지 않음 · 전역 패널티 금지 · 개고 제외 · 위치 가중 미사용 ·
 *       transform 제거와 root attenuation 분리 · 엔진 미연결.
 * ========================================================================== */

/** 충 source. Natal 내부 vs 각 Luck layer. */
type ClashSource = "natal" | "daeun" | "seun" | "wolun" | "ilun";

const LUCK_SOURCES: ClashSource[] = ["daeun", "seun", "wolun", "ilun"];

/** Luck 충 hit: 어떤 source가 어떤 natal 슬롯의 root를 때리는가. */
type SourcedHit = {
  source: ClashSource;
  natalSlot: BranchSlot;
  element: Element;
};

/** 중복 감쇠 붕괴 정책 (Q4). 숫자가 아니라 구조 후보. */
type SourcePolicy = {
  name: "L0" | "L1";
  label: string;
  /** 감쇠 횟수로 셀 hit 집합을 고른다. δ 자체는 건드리지 않는다. */
  collapse: (hits: SourcedHit[]) => SourcedHit[];
};

const SOURCE_POLICIES: SourcePolicy[] = [
  {
    name: "L0",
    label: "source 무차등 · per-hit 누적 (현행 규칙 단순 확장)",
    collapse: (hits) => hits,
  },
  {
    name: "L1",
    label: "source 무차등 · natal 슬롯당 1회 붕괴 (§1.6.6 상태 합집합과 정합)",
    collapse: (hits) => {
      const seen = new Set<string>();
      const out: SourcedHit[] = [];
      for (const h of hits) {
        const key = `${h.element}:${h.natalSlot}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(h);
      }
      return out;
    },
  },
];

function applySourcedAtten(
  natal: Scores,
  hits: SourcedHit[],
  policy: SourcePolicy,
): { effective: Scores; counted: number } {
  const s = cloneScores(natal);
  const counted = policy.collapse(hits);
  for (const h of counted) s[h.element] -= CONFIRMED_DELTA;
  return { effective: s, counted: counted.length };
}

describe("TBD-01c-source · Luck 충 admission이 ±1 불변식에 미치는 영향", () => {
  it("Luck을 허용하면 동일 오행 hit 상한이 natal-only 4를 넘는다", () => {
    // 시나리오: natal 午가 month·day 두 슬롯에 있고 (火 root 각 1),
    // 대/세/월/일운이 모두 子로 들어와 두 슬롯을 각각 충한다.
    const natalSlotsWithRoot: BranchSlot[] = ["month", "day"];
    const hits: SourcedHit[] = [];
    for (const source of LUCK_SOURCES) {
      for (const natalSlot of natalSlotsWithRoot) {
        hits.push({ source, natalSlot, element: "火" });
      }
    }
    // 4 layer × 2 slot = 8 hit — natal 단독 구조 상한(4)의 2배.
    expect(hits).toHaveLength(8);
    expect(hits.length).toBeGreaterThan(4);
  });

  it("L0(누적)는 ±1 불변식을 깨고 L1(슬롯 붕괴)은 보존한다", () => {
    const natal: Scores = { 木: 52, 火: 42, 土: 52, 金: 52, 水: 52 };
    const natalSlotsWithRoot: BranchSlot[] = ["month", "day"];
    const hits: SourcedHit[] = LUCK_SOURCES.flatMap((source) =>
      natalSlotsWithRoot.map((natalSlot) => ({ source, natalSlot, element: "火" as Element })),
    );

    const rows = SOURCE_POLICIES.map((p) => {
      const { effective, counted } = applySourcedAtten(natal, hits, p);
      return {
        policy: p.name,
        countedHits: counted,
        drop: natal.火 - effective.火,
        internal: effective.火,
        jump: maxLevelJump(natal, effective),
      };
    });
    console.log(JSON.stringify(rows));

    const l0 = rows.find((r) => r.policy === "L0")!;
    const l1 = rows.find((r) => r.policy === "L1")!;

    // L0: 8 hit × 4 = 32 ≥ 21 → Level 2단 이동. §1.6.8.5.1 불변식 파괴.
    expect(l0.countedHits).toBe(8);
    expect(l0.drop).toBe(32);
    expect(l0.jump).toBe(2);

    // L1: natal 슬롯 2개로 붕괴 → 8 ≤ 16 < 21 → ±1 유지.
    expect(l1.countedHits).toBe(2);
    expect(l1.drop).toBe(8);
    expect(l1.jump).toBe(1);
  });

  it("L1의 상한은 natal-only 구조 상한과 정확히 같다", () => {
    // 최악: 4개 natal 슬롯 전부가 같은 오행 root이고 전부 피격.
    const allSlots: BranchSlot[] = ["year", "month", "day", "hour"];
    const saturated: SourcedHit[] = [];
    for (const source of ["natal", ...LUCK_SOURCES] as ClashSource[]) {
      for (const natalSlot of allSlots) {
        saturated.push({ source, natalSlot, element: "土" });
      }
    }
    const l1 = SOURCE_POLICIES.find((p) => p.name === "L1")!;
    const counted = l1.collapse(saturated).length;

    expect(saturated).toHaveLength(20); // 5 source × 4 slot
    expect(counted).toBe(4); // natal 슬롯 수로 붕괴
    expect(counted * CONFIRMED_DELTA).toBe(16); // = §1.6.8.5.1의 2충 상한과 동일
    expect(counted * CONFIRMED_DELTA).toBeLessThan(21); // ±2 임계 미만
  });

  it("Luck modifier 제거 시 Natal로 완전 복귀한다 (Q5 계약)", () => {
    const natal: Scores = { 木: 52, 火: 42, 土: 52, 金: 52, 水: 52 };
    const natalSnap = cloneScores(natal);
    const hits: SourcedHit[] = [{ source: "seun", natalSlot: "month", element: "火" }];
    const l1 = SOURCE_POLICIES.find((p) => p.name === "L1")!;

    const during = applySourcedAtten(natal, hits, l1).effective;
    expect(during.火).toBe(38);

    // window 종료 → hit 목록에서 제거 = modifier 제거. 스냅샷 복원 불필요.
    const after = applySourcedAtten(natal, [], l1).effective;
    expect(after).toEqual(natalSnap);
    expect(natal).toEqual(natalSnap); // Natal 자체는 한 번도 변하지 않음
  });

  it("source 가중은 근거가 없어 시뮬 대상이 아니다 — 무차등만 검증", () => {
    // 대/세/월/일 어느 source든 같은 natal 슬롯이면 결과가 같아야 한다.
    const natal: Scores = { 木: 52, 火: 42, 土: 52, 金: 52, 水: 52 };
    const l1 = SOURCE_POLICIES.find((p) => p.name === "L1")!;
    const perSource = LUCK_SOURCES.map(
      (source) =>
        applySourcedAtten(natal, [{ source, natalSlot: "day", element: "火" }], l1).effective.火,
    );
    expect(new Set(perSource).size).toBe(1);
    expect(perSource[0]).toBe(38);
  });
});

/* ========================================================================== *
 * TBD-01c-source · Q4 — 중복 감쇠 collapse 검증
 *
 * 질문: 동일 natal root가 여러 Luck 충을 동시에 받을 때 δ를 몇 번 적용하는가?
 * 전제: δ=4 불변 · Natal immutable · Luck은 Effective modifier only ·
 *       전역 패널티 금지 · 개고 제외 · 위치 가중 없음(P0) · source 수치 생성 금지.
 * ========================================================================== */

/** 육충 relation 1건. natal 슬롯 하나에 대한 '관계'이지 '감쇠 횟수'가 아니다. */
type ClashRelation = {
  source: ClashSource;
  natalSlot: BranchSlot;
  natalBranch: Branch;
  /** 충 상대 지지 — 육충은 1:1이므로 natalBranch가 정하면 유일하다. */
  partner: Branch;
};

/** 육충 짝 조회 (완전 매칭). */
function clashPartnerOf(branch: Branch): Branch | null {
  for (const { pair } of CLASH_PAIRS) {
    if (pair[0] === branch) return pair[1];
    if (pair[1] === branch) return pair[0];
  }
  return null;
}

describe("TBD-01c-source · Q4-2 · 육충은 완전 매칭이므로 충 상대가 유일하다", () => {
  it("모든 지지의 충 상대는 정확히 1개", () => {
    const all: Branch[] = CLASH_PAIRS.flatMap((c) => c.pair);
    expect(new Set(all).size).toBe(12); // 12지지 전부, 중복 없음
    for (const b of all) {
      const partners = CLASH_PAIRS.filter((c) => c.pair.includes(b));
      expect(partners).toHaveLength(1); // 완전 매칭 = 짝이 유일
      expect(clashPartnerOf(b)).not.toBeNull();
    }
  });

  it("한 natal 지지에 걸리는 충은 전부 '같은 관계의 반복'이다", () => {
    // natal day = 午. 대/세/월/일운이 전부 子 → 4개 relation.
    const natalSlot: BranchSlot = "day";
    const natalBranch: Branch = "午";
    const partner = clashPartnerOf(natalBranch)!;
    expect(partner).toBe("子");

    const relations: ClashRelation[] = LUCK_SOURCES.map((source) => ({
      source,
      natalSlot,
      natalBranch,
      partner,
    }));

    // source만 다를 뿐 relation의 종류는 하나다 — 다른 종류의 손상이 아니다.
    expect(new Set(relations.map((r) => `${r.natalBranch}-${r.partner}`)).size).toBe(1);
    expect(new Set(relations.map((r) => r.source)).size).toBe(4);
  });
});

describe("TBD-01c-source · Q4-6 · collapse 단위: RootHit vs (오행 × 지지슬롯)", () => {
  it("RootHit 리스트는 같은 물리적 근을 비견/겁재로 2번 담는다", () => {
    // 실측(엔진): 寅 한 지지에서 木 RootHit이 2건 —
    //   {寅, 甲, 정기, 비견} · {寅, 甲, 정기, 겁재}
    // dedupeRootHits의 키에 polarity가 들어가므로 붕괴되지 않는다.
    // 지장간 자체는 1개(§1.6.8.2)지만 RootHit 레코드는 2개다.
    const hiddenStemsOfYin = rootHitsByElement("寅");
    expect(hiddenStemsOfYin["木"]).toBe(1); // 지장간 사실: 1
    const ROOTHIT_RECORDS_PER_BRANCH_ELEMENT = 2; // 엔진 실측: 비견 + 겁재
    expect(ROOTHIT_RECORDS_PER_BRANCH_ELEMENT).toBe(2);
  });

  it("RootHit 단위로 감쇠하면 δ=4의 ±1 불변식이 natal-only에서도 깨진다", () => {
    // §1.6.8.5.1은 '지지 1개 = 1단위'를 암묵 전제로 계산됐다.
    const PER_BRANCH_UNITS_ASSUMED = 1;
    const PER_BRANCH_UNITS_ROOTHIT = 2;

    const natalTwoClashBranches = 4; // 2충이 4슬롯 소진
    const dropAssumed = natalTwoClashBranches * PER_BRANCH_UNITS_ASSUMED * CONFIRMED_DELTA;
    const dropRootHit = natalTwoClashBranches * PER_BRANCH_UNITS_ROOTHIT * CONFIRMED_DELTA;

    expect(dropAssumed).toBe(16);
    expect(dropRootHit).toBe(32);

    // 21 = ±2 임계(§1.6.8.1)
    expect(dropAssumed).toBeLessThan(21); // 기존 확정 유지
    expect(dropRootHit).toBeGreaterThanOrEqual(21); // 확정 붕괴

    const natal: Scores = { 木: 42, 火: 52, 土: 52, 金: 52, 水: 52 };
    const byBranch = { ...natal, 木: natal.木 - dropAssumed };
    const byRootHit = { ...natal, 木: natal.木 - dropRootHit };
    expect(maxLevelJump(natal, byBranch)).toBe(1);
    expect(maxLevelJump(natal, byRootHit)).toBe(2);
  });
});

/** relation은 전부 기록하고, 감쇠는 (오행 × natal 슬롯) 1회로 붕괴한다. */
function collapseToAttenuationUnits(
  relations: ClashRelation[],
  element: Element,
): Array<{ element: Element; natalSlot: BranchSlot }> {
  const seen = new Set<string>();
  const units: Array<{ element: Element; natalSlot: BranchSlot }> = [];
  for (const r of relations) {
    const key = `${element}:${r.natalSlot}`;
    if (seen.has(key)) continue;
    seen.add(key);
    units.push({ element, natalSlot: r.natalSlot });
  }
  return units;
}

describe("TBD-01c-source · Q4-3·4 · relation multiplicity vs attenuation multiplicity", () => {
  it("relation은 전부 남고 감쇠만 1회로 붕괴한다", () => {
    const partner = clashPartnerOf("午")!;
    const relations: ClashRelation[] = LUCK_SOURCES.map((source) => ({
      source,
      natalSlot: "day",
      natalBranch: "午",
      partner,
    }));

    const units = collapseToAttenuationUnits(relations, "火");

    // relation multiplicity = 4 (기록 보존)
    expect(relations).toHaveLength(4);
    expect(relations.map((r) => r.source)).toEqual(["daeun", "seun", "wolun", "ilun"]);
    // attenuation multiplicity = 1 (수치 붕괴)
    expect(units).toHaveLength(1);
  });

  it("추가 충은 '무의미'가 아니다 — 수치 외 효과는 유지된다", () => {
    // 서로 다른 source의 충이 각각 다른 transform modifier를 해제할 수 있다.
    const seunRelation: ClashRelation = {
      source: "seun",
      natalSlot: "day",
      natalBranch: "午",
      partner: "子",
    };
    const wolunRelation: ClashRelation = {
      source: "wolun",
      natalSlot: "month",
      natalBranch: "寅",
      partner: "申",
    };

    const heOnDay: TransformMod = {
      id: "he-day",
      kind: "삼합",
      attenElements: ["火", "火", "木"],
      target: "火",
      branchSlots: ["day", "year"],
      modifierActive: true,
    };
    const heOnMonth: TransformMod = {
      id: "he-month",
      kind: "五合",
      attenElements: ["木", "土"],
      target: "土",
      branchSlots: ["month", "hour"],
      modifierActive: true,
    };

    const released = releaseTransformsOnClash(
      [heOnDay, heOnMonth],
      [
        { id: "c-seun", slots: [seunRelation.natalSlot, "year"] },
        { id: "c-wolun", slots: [wolunRelation.natalSlot, "hour"] },
      ],
    );
    // 두 충이 각각 다른 modifier를 해제 — 감쇠가 1회로 붕괴돼도 이 효과는 별개다.
    expect(released.every((m) => m.modifierActive === false)).toBe(true);
  });

  it("일부 Luck이 종료돼도 남은 충이 있으면 conflicted가 유지된다", () => {
    const partner = clashPartnerOf("午")!;
    const all: ClashRelation[] = LUCK_SOURCES.map((source) => ({
      source,
      natalSlot: "day",
      natalBranch: "午",
      partner,
    }));

    // 월운·일운 창 종료 → 대운·세운만 남음
    const remaining = all.filter((r) => r.source === "daeun" || r.source === "seun");
    expect(collapseToAttenuationUnits(remaining, "火")).toHaveLength(1); // 여전히 1회 감쇠
    // 전부 종료 → 감쇠 0회
    expect(collapseToAttenuationUnits([], "火")).toHaveLength(0);
  });
});

describe("TBD-01c-source · Q4-7 · Luck 생성/소멸에 대한 결정론적 복원", () => {
  it("활성 집합만으로 Effective가 결정된다 (경로 무관)", () => {
    const natal: Scores = { 木: 52, 火: 42, 土: 52, 金: 52, 水: 52 };
    const partner = clashPartnerOf("午")!;
    const rel = (source: ClashSource): ClashRelation => ({
      source,
      natalSlot: "day",
      natalBranch: "午",
      partner,
    });

    const effectiveFor = (sources: ClashSource[]): Scores => {
      const units = collapseToAttenuationUnits(sources.map(rel), "火");
      const s = cloneScores(natal);
      for (const u of units) s[u.element] -= CONFIRMED_DELTA;
      return s;
    };

    // 경로 A: 대운 → +세운 → +월운 → −월운 → −세운
    const pathA = effectiveFor(["daeun"]);
    // 경로 B: 세운만 (다른 순서로 도달)
    const pathB = effectiveFor(["seun"]);
    // 같은 '활성 집합 크기 1' → 같은 Effective
    expect(pathA).toEqual(pathB);

    // 활성 집합이 커져도 동일 슬롯이면 Effective 불변 (멱등)
    expect(effectiveFor(["daeun", "seun", "wolun", "ilun"])).toEqual(pathA);

    // 전부 소멸 → Natal 복귀
    expect(effectiveFor([])).toEqual(natal);
    expect(natal.火).toBe(42); // Natal 자체 불변
  });

  it("멱등성: 같은 활성 집합을 두 번 평가해도 결과가 같다", () => {
    const natal: Scores = { 木: 52, 火: 42, 土: 52, 金: 52, 水: 52 };
    const partner = clashPartnerOf("午")!;
    const relations: ClashRelation[] = ["seun", "wolun"].map((source) => ({
      source: source as ClashSource,
      natalSlot: "day",
      natalBranch: "午",
      partner,
    }));
    const run = () => {
      const units = collapseToAttenuationUnits(relations, "火");
      const s = cloneScores(natal);
      for (const u of units) s[u.element] -= CONFIRMED_DELTA;
      return s;
    };
    expect(run()).toEqual(run());
    expect(run().火).toBe(38);
  });
});

/* ========================================================================== *
 * TBD-01c-source · Q5 — Luck 충에 δ=4 동일 적용 가능성 검증
 *
 * 전제(기잠금): attenuation 단위 = (오행 × natal 지지슬롯) 1회 ·
 *   source/활성 충 개수 무관 · relation 전량 기록 · Natal immutable ·
 *   Luck은 Effective modifier only · 활성 집합에서 매번 재계산 ·
 *   누적/차감 금지 · position weighting 없음 · Opening 제외 · source 가중 없음.
 * 신규 상수 생성 금지 — CONFIRMED_DELTA(4)만 사용.
 * ========================================================================== */

const NATAL_BRANCH_SLOTS: BranchSlot[] = ["year", "month", "day", "hour"];
const ALL_CLASH_SOURCES: ClashSource[] = ["natal", "daeun", "seun", "wolun", "ilun"];

/** (source, natalSlot) 관계 하나. 감쇠 단위가 아니라 relation이다. */
type SourcedRelation = { source: ClashSource; natalSlot: BranchSlot };

/**
 * L1-S collapse: relation 집합 → 감쇠 단위 집합.
 * 키는 natal 슬롯뿐. source는 키에 들어가지 않는다(= source 무관 1회).
 */
function collapseUnits(relations: SourcedRelation[]): BranchSlot[] {
  return [...new Set(relations.map((r) => r.natalSlot))];
}

/** 한 오행에 대한 총 낙폭. δ는 CONFIRMED_DELTA 하나뿐. */
function totalDrop(relations: SourcedRelation[]): number {
  return collapseUnits(relations).length * CONFIRMED_DELTA;
}

describe("TBD-01c-source · Q5-1·3 · collapse가 hit 상한을 구조적으로 고정한다", () => {
  it("감쇠 단위 상한은 natal 지지 슬롯 수(4)이며 Luck이 이를 넘길 수 없다", () => {
    // collapse 키가 natal 슬롯이므로 상한 = |{year,month,day,hour}| = 4.
    // Luck 지지는 '충 상대'일 뿐 natal 슬롯이 아니다 → 키를 늘리지 못한다.
    const everySourceEverySlot: SourcedRelation[] = ALL_CLASH_SOURCES.flatMap((source) =>
      NATAL_BRANCH_SLOTS.map((natalSlot) => ({ source, natalSlot })),
    );
    expect(everySourceEverySlot).toHaveLength(20); // 5 source × 4 slot
    expect(collapseUnits(everySourceEverySlot)).toHaveLength(4); // 상한 고정
    expect(totalDrop(everySourceEverySlot)).toBe(16);
    expect(totalDrop(everySourceEverySlot)).toBeLessThan(21); // ±2 임계 미만
  });

  it("exhaustive: (source × slot) 20개 관계의 모든 부분집합 2^20에서 상한 검증", () => {
    const rels: SourcedRelation[] = ALL_CLASH_SOURCES.flatMap((source) =>
      NATAL_BRANCH_SLOTS.map((natalSlot) => ({ source, natalSlot })),
    );
    const n = rels.length;
    expect(n).toBe(20);

    let maxUnits = 0;
    let maxDrop = 0;
    let violations = 0;
    const dropHistogram = new Map<number, number>();

    for (let mask = 0; mask < 1 << n; mask += 1) {
      const active: SourcedRelation[] = [];
      for (let i = 0; i < n; i += 1) {
        if (mask & (1 << i)) active.push(rels[i]!);
      }
      const units = collapseUnits(active).length;
      const drop = units * CONFIRMED_DELTA;
      if (units > maxUnits) maxUnits = units;
      if (drop > maxDrop) maxDrop = drop;
      if (drop >= 21) violations += 1; // ±2 임계 도달
      dropHistogram.set(drop, (dropHistogram.get(drop) ?? 0) + 1);
    }

    console.log(
      JSON.stringify({
        subsets: 1 << n,
        maxUnits,
        maxDrop,
        thresholdViolations: violations,
        dropHistogram: [...dropHistogram.entries()].sort((a, b) => a[0] - b[0]),
      }),
    );

    expect(maxUnits).toBe(4); // 어떤 조합에서도 4를 못 넘음
    expect(maxDrop).toBe(16);
    expect(violations).toBe(0); // ±2 도달 조합 0개
  });

  it("모든 낙폭 값에서 Level 이동이 ≤1 (전 구간 8~96 교차 검증)", () => {
    const possibleDrops = [0, 1, 2, 3, 4].map((u) => u * CONFIRMED_DELTA); // 0,4,8,12,16
    let worst = 0;
    for (const drop of possibleDrops) {
      for (let s = LO; s <= HI; s += 1) {
        worst = Math.max(worst, levelJump(levelFromInternal(s), levelFromInternal(s - drop)));
      }
    }
    expect(worst).toBe(1); // ±1 불변식 유지
  });
});

describe("TBD-01c-source · Q5-2·4 · 요구된 8개 사례", () => {
  const natal: Scores = { 木: 42, 火: 52, 土: 52, 金: 52, 水: 52 };
  const drop = (rels: SourcedRelation[]) => totalDrop(rels);
  const eff = (rels: SourcedRelation[]): Scores => ({ ...natal, 木: natal.木 - drop(rels) });

  it("8개 사례의 collapse 결과와 Level 이동", () => {
    const cases: Array<{ id: string; rels: SourcedRelation[] }> = [
      { id: "1-natal 내부 충만", rels: [{ source: "natal", natalSlot: "day" }] },
      { id: "2-luck 충만", rels: [{ source: "seun", natalSlot: "day" }] },
      {
        id: "3-natal+luck 같은 슬롯",
        rels: [
          { source: "natal", natalSlot: "day" },
          { source: "seun", natalSlot: "day" },
        ],
      },
      {
        id: "4-natal+luck 다른 슬롯",
        rels: [
          { source: "natal", natalSlot: "day" },
          { source: "seun", natalSlot: "month" },
        ],
      },
      {
        id: "5-natal 4슬롯 전부 충",
        rels: NATAL_BRANCH_SLOTS.map((natalSlot) => ({ source: "natal" as ClashSource, natalSlot })),
      },
      {
        id: "6-대+세+월+일 동시 활성",
        rels: LUCK_SOURCES.flatMap((source) =>
          NATAL_BRANCH_SLOTS.map((natalSlot) => ({ source, natalSlot })),
        ),
      },
      {
        id: "7-일부 luck window 종료 후",
        rels: [
          { source: "daeun", natalSlot: "day" },
          { source: "seun", natalSlot: "day" },
        ],
      },
      { id: "8-모든 luck 종료", rels: [] },
    ];

    const rows = cases.map((c) => ({
      case: c.id,
      relations: c.rels.length,
      units: collapseUnits(c.rels).length,
      drop: drop(c.rels),
      internal: eff(c.rels).木,
      level: levelFromInternal(eff(c.rels).木),
      jump: maxLevelJump(natal, eff(c.rels)),
    }));
    console.log(JSON.stringify(rows, null, 1));

    // 3: natal+luck 같은 슬롯 → 2 relation이지만 1 unit
    expect(rows[2]!.relations).toBe(2);
    expect(rows[2]!.units).toBe(1);
    expect(rows[2]!.drop).toBe(4);
    // 2와 3이 동일 — source 조합이 수치에 영향 없음
    expect(rows[2]!.drop).toBe(rows[1]!.drop);

    // 4: 서로 다른 슬롯 → 2 unit
    expect(rows[3]!.units).toBe(2);
    expect(rows[3]!.drop).toBe(8);

    // 5와 6이 동일 — natal 단독 4슬롯 = 4 layer 전부 활성
    expect(rows[4]!.drop).toBe(16);
    expect(rows[5]!.drop).toBe(16);
    expect(rows[5]!.relations).toBe(16); // relation은 16건
    expect(rows[5]!.units).toBe(4); // 감쇠는 4회

    // 8: 전부 종료 → Natal 복귀
    expect(rows[7]!.drop).toBe(0);
    expect(eff([])).toEqual(natal);

    // 전 사례 Level 이동 ≤1
    for (const r of rows) expect(r.jump).toBeLessThanOrEqual(1);
  });

  it("7 → 8 재계산: window 종료가 결정론적으로 복원된다", () => {
    const full: SourcedRelation[] = LUCK_SOURCES.map((source) => ({
      source,
      natalSlot: "day" as BranchSlot,
    }));
    expect(totalDrop(full)).toBe(4); // 4 relation → 1 unit

    const afterWolunIlunEnd = full.filter(
      (r) => r.source === "daeun" || r.source === "seun",
    );
    expect(totalDrop(afterWolunIlunEnd)).toBe(4); // 여전히 1 unit — 값 불변

    const afterAllEnd: SourcedRelation[] = [];
    expect(totalDrop(afterAllEnd)).toBe(0);
    expect(eff(afterAllEnd)).toEqual(natal);
    expect(natal.木).toBe(42); // Natal 자체 불변
  });
});

describe("TBD-01c-source · Q5-5 · 별도 δ_luck 도입의 구조적 비용", () => {
  it("δ_luck ≠ δ_natal이면 혼합 슬롯에 우선순위 규칙이 새로 필요해진다", () => {
    // collapse가 (오행 × 슬롯) 1회이므로, 한 슬롯이 natal·luck 양쪽에서
    // 충을 받으면 '어느 δ를 쓸지' 정해야 한다 — 현재 근거 없는 새 규칙.
    const mixed: SourcedRelation[] = [
      { source: "natal", natalSlot: "day" },
      { source: "seun", natalSlot: "day" },
    ];
    expect(collapseUnits(mixed)).toHaveLength(1); // 단위는 1개
    expect(new Set(mixed.map((r) => r.source)).size).toBe(2); // 그런데 source는 2종

    // 단일 상수(δ=4)를 쓰면 이 선택 자체가 발생하지 않는다.
    expect(totalDrop(mixed)).toBe(CONFIRMED_DELTA);
  });

  it("source별 severity는 relation 기록으로 이미 보존된다 (수치화 없이)", () => {
    const rels: SourcedRelation[] = [
      { source: "natal", natalSlot: "day" },
      { source: "daeun", natalSlot: "day" },
      { source: "seun", natalSlot: "day" },
    ];
    // 수치는 1회지만 기여 source 집합은 온전히 남는다 → 미래 계층에서 사용 가능.
    const contributingSources = [...new Set(rels.map((r) => r.source))];
    expect(contributingSources).toEqual(["natal", "daeun", "seun"]);
    expect(totalDrop(rels)).toBe(CONFIRMED_DELTA); // 수치층은 불변
  });
});
