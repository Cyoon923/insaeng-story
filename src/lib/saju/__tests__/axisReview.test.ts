import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeElementPresence, analyzeStemRoots, labelStemSeasonPhase } from "@/lib/saju";
import { STEM_ELEMENT } from "@/lib/saju/constants/elements";
import { HIDDEN_STEMS } from "@/lib/saju/data/hiddenStems";
import { BRANCH_SEASON, SEASON_PHASE } from "@/lib/saju/data/seasonPhases";
import { ELEMENTS } from "@/lib/saju/types";
import type {
  Branch,
  Element,
  ElementPresenceKind,
  FourPillars,
  HourPillar,
  Pillar,
  PillarSlot,
  RootHit,
  SeasonName,
  SeasonPhase,
} from "@/lib/saju/types";

type PresenceExpected = {
  presence: ElementPresenceKind;
  visibleSlots: PillarSlot[];
  rootedSlots: PillarSlot[];
  monthOutletSlots: PillarSlot[];
};

type SampleFixture = {
  id: string;
  name: string;
  pillars: {
    year: Pillar;
    month: Pillar;
    day: Pillar;
    hour: HourPillar;
  };
  expected: {
    season: {
      monthBranch: Branch;
      season: SeasonName;
      element: Element;
      phase: SeasonPhase;
    };
    dayStemRoots: RootHit[];
    presence: Record<Element, PresenceExpected>;
  };
};

const samples = JSON.parse(
  readFileSync(path.join(__dirname, "axisReview.fixtures.json"), "utf8"),
).samples as SampleFixture[];

function chart(partial: SampleFixture["pillars"]): FourPillars {
  return {
    ...partial,
    hourCertainty: partial.hour === "unknown" ? "unknown" : "confirmed",
    warnings: [],
  };
}

function confirmedPillars(pillars: FourPillars): Array<{ slot: PillarSlot; pillar: Pillar }> {
  const rows: Array<{ slot: PillarSlot; pillar: Pillar }> = [
    { slot: "year", pillar: pillars.year },
    { slot: "month", pillar: pillars.month },
    { slot: "day", pillar: pillars.day },
  ];
  if (pillars.hour !== "unknown") {
    rows.push({ slot: "hour", pillar: pillars.hour });
  }
  return rows;
}

describe("명식 축 라벨 사람 검토 fixture", () => {
  it("loads at least sixteen hand-written samples", () => {
    expect(samples.length).toBeGreaterThanOrEqual(16);
  });

  it("covers 辰未戌丑, 왕상휴수사, 통근 유형, presence 4종", () => {
    const monthBranches = new Set(samples.map((sample) => sample.pillars.month.branch));
    expect(monthBranches.has("辰")).toBe(true);
    expect(monthBranches.has("未")).toBe(true);
    expect(monthBranches.has("戌")).toBe(true);
    expect(monthBranches.has("丑")).toBe(true);

    const phases = new Set(samples.map((sample) => sample.expected.season.phase));
    expect([...phases].sort()).toEqual(["사", "상", "수", "왕", "휴"].sort());

    const hasSameStemJeonggi = samples.some((sample) =>
      sample.expected.dayStemRoots.some(
        (hit) => hit.role === "정기" && hit.polarity === "비견",
      ),
    );
    const hasOppositeJeonggi = samples.some((sample) =>
      sample.expected.dayStemRoots.some(
        (hit) => hit.role === "정기" && hit.polarity === "겁재",
      ),
    );
    const junggiOnly = samples.some((sample) => {
      const roles = new Set(sample.expected.dayStemRoots.map((hit) => hit.role));
      return sample.expected.dayStemRoots.length > 0 && roles.size === 1 && roles.has("중기");
    });
    const yogiOnly = samples.some((sample) => {
      const roles = new Set(sample.expected.dayStemRoots.map((hit) => hit.role));
      return sample.expected.dayStemRoots.length > 0 && roles.size === 1 && roles.has("여기");
    });
    const mugun = samples.some((sample) => sample.expected.dayStemRoots.length === 0);
    const multiBranch = samples.some((sample) => {
      const slots = new Set(sample.expected.dayStemRoots.map((hit) => hit.slot));
      return slots.size >= 2;
    });
    const hourUnknown = samples.some((sample) => sample.pillars.hour === "unknown");

    expect(hasSameStemJeonggi).toBe(true);
    expect(hasOppositeJeonggi).toBe(true);
    expect(junggiOnly).toBe(true);
    expect(yogiOnly).toBe(true);
    expect(mugun).toBe(true);
    expect(multiBranch).toBe(true);
    expect(hourUnknown).toBe(true);

    const kinds = new Set(
      samples.flatMap((sample) => Object.values(sample.expected.presence).map((row) => row.presence)),
    );
    expect(kinds.has("rooted-visible")).toBe(true);
    expect(kinds.has("unrooted-visible")).toBe(true);
    expect(kinds.has("hidden-only")).toBe(true);
    expect(kinds.has("absent")).toBe(true);
  });

  for (const sample of samples) {
    describe(sample.name, () => {
      const pillars = chart(sample.pillars);
      const dayStem = pillars.day.stem;
      const monthBranch = pillars.month.branch;
      const hourUnknown = pillars.hour === "unknown";

      it("월령 라벨이 표와 일치한다", () => {
        const labeled = labelStemSeasonPhase(dayStem, monthBranch);
        expect(labeled).toEqual(sample.expected.season);
        expect(labeled.monthBranch).toBe(monthBranch);
        expect(labeled.season).toBe(BRANCH_SEASON[monthBranch]);
        expect(labeled.element).toBe(STEM_ELEMENT[dayStem]);
        expect(labeled.phase).toBe(SEASON_PHASE[labeled.season][labeled.element]);
      });

      it("일간 통근이 지장간 표와 일치한다", () => {
        const roots = analyzeStemRoots(pillars, dayStem);
        expect(roots.hourUnknown).toBe(hourUnknown);
        expect(roots.hits).toEqual(sample.expected.dayStemRoots);

        const tableHits: RootHit[] = [];
        for (const { slot, pillar } of confirmedPillars(pillars)) {
          for (const part of HIDDEN_STEMS[pillar.branch]) {
            if (STEM_ELEMENT[part.stem] !== STEM_ELEMENT[dayStem]) continue;
            tableHits.push({
              slot,
              branch: pillar.branch,
              hiddenStem: part.stem,
              role: part.role,
              polarity: part.stem === dayStem ? "비견" : "겁재",
            });
          }
        }
        expect(roots.hits).toEqual(tableHits);
      });

      it("presence와 monthOutlet이 천간·지장간 데이터와 일치한다", () => {
        const slots = confirmedPillars(pillars);
        const monthHidden = HIDDEN_STEMS[monthBranch].map((part) => part.stem);

        for (const element of ELEMENTS) {
          const actual = analyzeElementPresence(pillars, element);
          expect(actual.hourUnknown).toBe(hourUnknown);
          expect(actual).toMatchObject(sample.expected.presence[element]);

          const visibleSlots = slots
            .filter(({ pillar }) => STEM_ELEMENT[pillar.stem] === element)
            .map(({ slot }) => slot);
          const rootedSlots = slots
            .filter(({ pillar }) =>
              HIDDEN_STEMS[pillar.branch].some((part) => STEM_ELEMENT[part.stem] === element),
            )
            .map(({ slot }) => slot);
          const monthOutletSlots = slots
            .filter(({ pillar }) => monthHidden.includes(pillar.stem))
            .filter(({ pillar }) => STEM_ELEMENT[pillar.stem] === element)
            .map(({ slot }) => slot);

          expect(actual.visibleSlots).toEqual(visibleSlots);
          expect(actual.rootedSlots).toEqual(rootedSlots);
          expect(actual.monthOutletSlots).toEqual(monthOutletSlots);
        }
      });

      it("시간 미상이면 hour 슬롯이 없다", () => {
        if (!hourUnknown) return;
        const roots = analyzeStemRoots(pillars, dayStem);
        expect(roots.hits.every((hit) => hit.slot !== "hour")).toBe(true);
        for (const element of ELEMENTS) {
          const actual = analyzeElementPresence(pillars, element);
          expect(actual.visibleSlots).not.toContain("hour");
          expect(actual.rootedSlots).not.toContain("hour");
          expect(actual.monthOutletSlots).not.toContain("hour");
        }
      });
    });
  }

  it("monthOutlet은 월지 지장간과 같은 글자만 잡는다", () => {
    const sameLetter = chart({
      year: { stem: "庚", branch: "申" },
      month: { stem: "甲", branch: "寅" },
      day: { stem: "乙", branch: "卯" },
      hour: { stem: "丙", branch: "午" },
    });
    const wood = analyzeElementPresence(sameLetter, "木");
    expect(wood.monthOutletSlots).toEqual(["month"]);
    expect(sameLetter.month.stem).toBe("甲");
    expect(HIDDEN_STEMS.寅.some((part) => part.stem === "甲")).toBe(true);
    expect(HIDDEN_STEMS.寅.some((part) => part.stem === "乙")).toBe(false);

    const sameElementDifferentLetter = chart({
      year: { stem: "甲", branch: "酉" },
      month: { stem: "庚", branch: "酉" },
      day: { stem: "甲", branch: "酉" },
      hour: "unknown",
    });
    const metal = analyzeElementPresence(sameElementDifferentLetter, "金");
    expect(metal.monthOutletSlots).toEqual([]);
    expect(sameElementDifferentLetter.month.stem).toBe("庚");
    expect(HIDDEN_STEMS.酉.map((part) => part.stem)).toEqual(["辛"]);
  });
});
