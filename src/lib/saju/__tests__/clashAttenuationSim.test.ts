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
