import { readFileSync } from "node:fs";
import path from "node:path";
import { branchElement, stemElement } from "@/lib/saju/constants/elements";
import { hiddenStemsOf } from "@/lib/saju/data/hiddenStems";
import { shiShenOf } from "@/lib/saju/data/shiShen";
import { analyzeElementPresence } from "@/lib/saju/elements/presence";
import { analyzeStemRoots } from "@/lib/saju/elements/roots";
import { labelStemSeasonPhase, seasonPhaseOf } from "@/lib/saju/elements/season";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { buildFourPillars } from "@/lib/saju/pillars/build";
import { BRANCHES } from "@/lib/saju/types";
import type {
  BirthInput,
  Branch,
  Element,
  FourPillars,
  HiddenStemPart,
  HiddenStemRole,
  HourPillar,
  Pillar,
  PillarSlot,
  RootHit,
  Stem,
} from "@/lib/saju/types";

export type RuleTableMatchStatus = "match" | "difference";

export type RuleTableRowResult = {
  id: string;
  table: string;
  sourceRule: string;
  input: unknown;
  expected: unknown;
  actual: unknown;
  status: RuleTableMatchStatus;
};

type PillarInput = {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  hour: HourPillar;
};

function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(__dirname, name), "utf8")) as T;
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function row(
  id: string,
  table: string,
  sourceRule: string,
  input: unknown,
  expected: unknown,
  actual: unknown,
): RuleTableRowResult {
  return {
    id,
    table,
    sourceRule,
    input,
    expected,
    actual,
    status: sameValue(expected, actual) ? "match" : "difference",
  };
}

function chart(partial: PillarInput): FourPillars {
  return {
    ...partial,
    hourCertainty: partial.hour === "unknown" ? "unknown" : "confirmed",
    warnings: [],
  };
}

type StemCase = { id: string; stem: Stem; element: Element };
type BranchCase = { id: string; branch: Branch; element: Element };
type HiddenCase = { id: string; branch: Branch; parts: HiddenStemPart[] };
type ShiShenCase = { id: string; dayStem: Stem; targetStem: Stem; shiShen: string };
type PhaseCase = { id: string; element: Element; monthBranch: Branch; phase: string };
type StemPair = { yang: Stem; yin: Stem; element: Element };
type WangRootCase = {
  id: string;
  element: Element;
  monthBranch: Branch;
  principalStem: Stem;
  principalRole: HiddenStemRole;
};
type RootCase = { id: string; dayStem: Stem; pillars: PillarInput; expectedHits: RootHit[] };
type PresenceCase = {
  id: string;
  element: Element;
  pillars: PillarInput;
  expected: {
    presence: string;
    hourUnknown: boolean;
    visibleSlots: PillarSlot[];
    rootedSlots: PillarSlot[];
  };
};
type ExactCase = {
  id: string;
  pillars: PillarInput;
  inspect: { slot: PillarSlot; hiddenStem: Stem };
  expected: {
    element: Element;
    elementPresence: string;
    exactStemVisible: boolean;
    exactStemVisibleAt: PillarSlot[];
  };
};
type EarthStorageCase = {
  id: string;
  dayStem: Stem;
  pillars: PillarInput;
  expectedByBranch: Record<
    string,
    Array<{ hiddenStem: Stem; hiddenRole: HiddenStemRole; shiShen: string }>
  >;
};

function compareHeavenlyStems(): RuleTableRowResult[] {
  const fixture = loadJson<{ sourceRule: string; cases: StemCase[] }>("heavenlyStems.json");
  return fixture.cases.map((item) =>
    row(item.id, "heavenly-stems", fixture.sourceRule, { stem: item.stem }, item.element, stemElement(item.stem)),
  );
}

function compareEarthlyBranches(): RuleTableRowResult[] {
  const fixture = loadJson<{ sourceRule: string; cases: BranchCase[] }>("earthlyBranches.json");
  return fixture.cases.map((item) =>
    row(
      item.id,
      "earthly-branches",
      fixture.sourceRule,
      { branch: item.branch },
      item.element,
      branchElement(item.branch),
    ),
  );
}

function compareHiddenStems(): RuleTableRowResult[] {
  const fixture = loadJson<{ sourceRule: string; cases: HiddenCase[] }>("hiddenStems.json");
  return fixture.cases.map((item) =>
    row(
      item.id,
      "hidden-stems",
      fixture.sourceRule,
      { branch: item.branch },
      item.parts,
      hiddenStemsOf(item.branch),
    ),
  );
}

function compareShiShen(): RuleTableRowResult[] {
  const fixture = loadJson<{ sourceRule: string; cases: ShiShenCase[] }>("shiShen.json");
  return fixture.cases.map((item) =>
    row(
      item.id,
      "shi-shen",
      fixture.sourceRule,
      { dayStem: item.dayStem, targetStem: item.targetStem },
      item.shiShen,
      shiShenOf(item.dayStem, item.targetStem),
    ),
  );
}

function compareSeasonPhases(): RuleTableRowResult[] {
  const fixture = loadJson<{
    sourceRule: string;
    cases: PhaseCase[];
    stemPolarityPairs: StemPair[];
    wangMonthRoots: WangRootCase[];
  }>("seasonPhases.json");

  const phaseRows = fixture.cases.map((item) =>
    row(
      item.id,
      "season-phases",
      fixture.sourceRule,
      { element: item.element, monthBranch: item.monthBranch },
      item.phase,
      seasonPhaseOf(item.element, item.monthBranch),
    ),
  );

  const pairRows: RuleTableRowResult[] = [];
  for (const pair of fixture.stemPolarityPairs) {
    for (const monthBranch of BRANCHES) {
      const tablePhase = fixture.cases.find(
        (item) => item.element === pair.element && item.monthBranch === monthBranch,
      )?.phase;
      const yangPhase = labelStemSeasonPhase(pair.yang, monthBranch).phase;
      const yinPhase = labelStemSeasonPhase(pair.yin, monthBranch).phase;
      pairRows.push(
        row(
          `phase-pair-${pair.element}-${monthBranch}`,
          "season-phases-stem-polarity",
          fixture.sourceRule,
          { yang: pair.yang, yin: pair.yin, monthBranch },
          { yangPhase: tablePhase, yinPhase: tablePhase, same: true },
          { yangPhase, yinPhase, same: yangPhase === yinPhase },
        ),
      );
    }
  }

  return [...phaseRows, ...pairRows];
}

function compareWangMonthRoots(): RuleTableRowResult[] {
  const fixture = loadJson<{ sourceRule: string; wangMonthRoots: WangRootCase[] }>("seasonPhases.json");
  return fixture.wangMonthRoots.map((item) => {
    const parts = hiddenStemsOf(item.monthBranch);
    const principal = parts.find((part) => part.role === "정기");
    return row(
      item.id,
      "wang-month-root",
      "phase=왕이면 월지 정기에 같은 오행이 반드시 존재. 월령표+지장간표 구조 consistency.",
      { element: item.element, monthBranch: item.monthBranch },
      {
        phase: "왕",
        principalStem: item.principalStem,
        principalRole: item.principalRole,
        principalElement: item.element,
      },
      {
        phase: seasonPhaseOf(item.element, item.monthBranch),
        principalStem: principal?.stem ?? null,
        principalRole: principal?.role ?? null,
        principalElement: principal ? stemElement(principal.stem) : null,
      },
    );
  });
}

function compareRoots(): RuleTableRowResult[] {
  const fixture = loadJson<{ sourceRule: string; cases: RootCase[] }>("roots.json");
  return fixture.cases.map((item) => {
    const pillars = chart(item.pillars);
    const analysis = analyzeStemRoots(pillars, item.dayStem);
    return row(
      item.id,
      "roots",
      fixture.sourceRule,
      { dayStem: item.dayStem, pillars: item.pillars },
      { hourUnknown: item.pillars.hour === "unknown", hits: item.expectedHits },
      { hourUnknown: analysis.hourUnknown, hits: analysis.hits },
    );
  });
}

function comparePresence(): RuleTableRowResult[] {
  const fixture = loadJson<{ sourceRule: string; cases: PresenceCase[] }>("presence.json");
  return fixture.cases.map((item) => {
    const analysis = analyzeElementPresence(chart(item.pillars), item.element);
    return row(
      item.id,
      "presence",
      fixture.sourceRule,
      { element: item.element, pillars: item.pillars },
      item.expected,
      {
        presence: analysis.presence,
        hourUnknown: analysis.hourUnknown,
        visibleSlots: analysis.visibleSlots,
        rootedSlots: analysis.rootedSlots,
      },
    );
  });
}

function compareExactStemVisible(): RuleTableRowResult[] {
  const fixture = loadJson<{ sourceRule: string; cases: ExactCase[] }>("exactStemVisible.json");
  return fixture.cases.map((item) => {
    const pillars = chart(item.pillars);
    const evidence = collectStrengthEvidence(pillars);
    const found = evidence.branchRelationEvidence.items.find(
      (entry) => entry.slot === item.inspect.slot && entry.hiddenStem === item.inspect.hiddenStem,
    );
    const presence = analyzeElementPresence(pillars, item.expected.element);
    return row(
      item.id,
      "exact-stem-visible",
      fixture.sourceRule,
      { pillars: item.pillars, inspect: item.inspect },
      item.expected,
      {
        element: found?.element ?? null,
        elementPresence: found?.presence ?? presence.presence,
        exactStemVisible: found?.exactStemVisible ?? null,
        exactStemVisibleAt: found?.exactStemVisibleAt ?? null,
      },
    );
  });
}

function compareChenWeiXuChou(): RuleTableRowResult[] {
  const fixture = loadJson<{
    sourceRule: string;
    hiddenStems: HiddenCase[];
    cases: EarthStorageCase[];
  }>("chenWeiXuChou.json");

  const hiddenRows = fixture.hiddenStems.map((item) =>
    row(
      `earth-hidden-${item.branch}`,
      "chen-wei-xu-chou",
      fixture.sourceRule,
      { branch: item.branch },
      item.parts,
      hiddenStemsOf(item.branch),
    ),
  );

  const relationRows = fixture.cases.flatMap((item) => {
    const evidence = collectStrengthEvidence(chart(item.pillars));
    return (Object.keys(item.expectedByBranch) as Branch[]).map((branch) => {
      const actual = evidence.branchRelationEvidence.items
        .filter((entry) => entry.branch === branch)
        .map((entry) => ({
          hiddenStem: entry.hiddenStem,
          hiddenRole: entry.hiddenRole,
          shiShen: entry.shiShen,
        }));
      return row(
        `${item.id}-${branch}`,
        "chen-wei-xu-chou",
        fixture.sourceRule,
        { dayStem: item.dayStem, branch },
        item.expectedByBranch[branch],
        actual,
      );
    });
  });

  const distinctHidden = row(
    "earth-storage-hidden-not-collapsed",
    "chen-wei-xu-chou",
    fixture.sourceRule,
    { branches: ["辰", "未", "戌", "丑"] },
    true,
    new Set(fixture.hiddenStems.map((item) => JSON.stringify(item.parts))).size === 4,
  );

  const distinctShiShenJiaBing = row(
    "earth-storage-shishen-changes-with-day-stem",
    "chen-wei-xu-chou",
    fixture.sourceRule,
    { dayStems: ["甲", "丙", "己"] },
    true,
    new Set(fixture.cases.map((item) => JSON.stringify(item.expectedByBranch))).size === fixture.cases.length,
  );

  return [...hiddenRows, ...relationRows, distinctHidden, distinctShiShenJiaBing];
}

function compareHourUnknown(): RuleTableRowResult[] {
  const fixture = loadJson<{
    sourceRule: string;
    cases: Array<{
      id: string;
      kind: string;
      dayStem?: Stem;
      element?: Element;
      inspectHiddenStem?: Stem;
      pillars?: PillarInput;
      input?: BirthInput;
      expected: Record<string, unknown>;
    }>;
  }>("hourUnknown.json");

  return fixture.cases.map((item) => {
    if (item.kind === "build-four-pillars-unknown" && item.input) {
      const pillars = buildFourPillars(item.input);
      return row(
        item.id,
        "hour-unknown",
        fixture.sourceRule,
        item.input,
        item.expected,
        {
          hour: pillars.hour,
          hourCertainty: pillars.hourCertainty,
          hourCandidatesAutoSelected: pillars.hour !== "unknown",
        },
      );
    }

    if (!item.pillars || !item.dayStem || !item.element) {
      return row(item.id, "hour-unknown", fixture.sourceRule, item, "valid-case", "missing-fields");
    }

    const pillars = chart(item.pillars);
    const roots = analyzeStemRoots(pillars, item.dayStem);
    const presence = analyzeElementPresence(pillars, item.element);
    const evidence = collectStrengthEvidence(pillars);
    const inspectItems = evidence.branchRelationEvidence.items.filter(
      (entry) => entry.hiddenStem === item.inspectHiddenStem,
    );

    if (item.kind === "synthetic-omit-hour") {
      return row(
        item.id,
        "hour-unknown",
        fixture.sourceRule,
        item.pillars,
        item.expected,
        {
          hour: pillars.hour,
          hourCertainty: pillars.hourCertainty,
          rootHourHits: roots.hits.filter((hit) => hit.slot === "hour").length,
          presenceHasHour: presence.visibleSlots.includes("hour") || presence.rootedSlots.includes("hour"),
          exactStemVisibleAtHasHour: inspectItems.some((entry) => entry.exactStemVisibleAt.includes("hour")),
          branchRelationHasHour: evidence.branchRelationEvidence.items.some((entry) => entry.slot === "hour"),
          woodPresence: presence.presence,
        },
      );
    }

    return row(
      item.id,
      "hour-unknown",
      fixture.sourceRule,
      item.pillars,
      item.expected,
      {
        hourKnown: pillars.hour !== "unknown",
        rootHourHits: roots.hits.filter((hit) => hit.slot === "hour").length,
        presenceHasHour: presence.visibleSlots.includes("hour") || presence.rootedSlots.includes("hour"),
        exactStemVisibleAtHasHour: inspectItems.some((entry) => entry.exactStemVisibleAt.includes("hour")),
        branchRelationHasHour: evidence.branchRelationEvidence.items.some((entry) => entry.slot === "hour"),
        woodPresence: presence.presence,
      },
    );
  });
}

export function compareAllRuleTables(): RuleTableRowResult[] {
  return [
    ...compareHeavenlyStems(),
    ...compareEarthlyBranches(),
    ...compareHiddenStems(),
    ...compareShiShen(),
    ...compareSeasonPhases(),
    ...compareWangMonthRoots(),
    ...compareRoots(),
    ...comparePresence(),
    ...compareExactStemVisible(),
    ...compareChenWeiXuChou(),
    ...compareHourUnknown(),
  ];
}

export function summarizeRuleTable(rows: RuleTableRowResult[] = compareAllRuleTables()) {
  const differences = rows.filter((item) => item.status === "difference");
  const byTable: Record<string, { total: number; match: number; difference: number }> = {};
  for (const item of rows) {
    const current = byTable[item.table] ?? { total: 0, match: 0, difference: 0 };
    current.total += 1;
    current[item.status] += 1;
    byTable[item.table] = current;
  }
  return {
    total: rows.length,
    match: rows.length - differences.length,
    difference: differences.length,
    byTable,
    differences,
  };
}
