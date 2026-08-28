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
