import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildNeedCandidateSet,
  buildStrengthObservations,
  buildStrengthSummary,
  elementGenerates,
} from "@/lib/saju";
import { chainDedupeKey } from "@/lib/saju/observation/buildStrengthObservations";
import { clusterAnchorDedupeKey } from "@/lib/saju/observation/buildElementClusters";
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

const chartB = chart({
  year: { stem: "辛", branch: "酉" },
  month: { stem: "乙", branch: "未" },
  day: { stem: "丙", branch: "申" },
  hour: { stem: "丁", branch: "酉" },
});

describe("elementGenerates", () => {
  it("matches the five-element generation cycle", () => {
    expect(elementGenerates("木", "火")).toBe(true);
    expect(elementGenerates("火", "土")).toBe(true);
    expect(elementGenerates("土", "金")).toBe(true);
    expect(elementGenerates("金", "水")).toBe(true);
    expect(elementGenerates("水", "木")).toBe(true);
  });

  it("does not treat non-adjacent or same elements as generating", () => {
    expect(elementGenerates("木", "土")).toBe(false);
    expect(elementGenerates("金", "火")).toBe(false);
    expect(elementGenerates("火", "火")).toBe(false);
  });
});

describe("buildStrengthObservations — chart B", () => {
  it("includes 乙木 → 丙火(day master) and 乙木 → 丁火 generation chains", () => {
    const observations = buildStrengthObservations(chartB);

    expect(observations.dayStem).toBe("丙");

    const resourceToDay = observations.generationChains.find(
      (chain) => chain.relation === "resource-to-day-master",
    );
    expect(resourceToDay).toEqual(
      expect.objectContaining({
        relation: "resource-to-day-master",
        from: expect.objectContaining({
          slot: "month",
          layer: "stem",
          stem: "乙",
          element: "木",
          presence: "rooted-visible",
          shiShen: "정인",
        }),
        to: expect.objectContaining({
          target: "day-master",
          slot: "day",
          layer: "stem",
          stem: "丙",
          element: "火",
        }),
        evidenceRef: { evidenceSide: "support" },
      }),
    );

    const woodToPeerFire = observations.generationChains.find(
      (chain) =>
        chain.relation === "element-generates" &&
        chain.from.stem === "乙" &&
        "target" in chain.to === false &&
        chain.to.stem === "丁",
    );
    expect(woodToPeerFire).toEqual(
      expect.objectContaining({
        relation: "element-generates",
        from: expect.objectContaining({
          slot: "month",
          layer: "stem",
          stem: "乙",
          element: "木",
          presence: "rooted-visible",
        }),
        to: expect.objectContaining({
          slot: "hour",
          layer: "stem",
          stem: "丁",
          element: "火",
          presence: "rooted-visible",
          shiShen: "겁재",
        }),
      }),
    );
  });

  it("preserves visible, rooted, and hidden layer metadata on chains", () => {
    const observations = buildStrengthObservations(chartB);

    for (const chain of observations.generationChains) {
      expect(chain.from.layer).toMatch(/^(stem|hiddenStem)$/);
      expect(chain.from.presence).toMatch(/^(rooted-visible|unrooted-visible|hidden-only|absent)$/);
      if ("target" in chain.to) {
        expect(chain.to.target).toBe("day-master");
        expect(chain.to.layer).toBe("stem");
      } else {
        expect(chain.to.layer).toMatch(/^(stem|hiddenStem)$/);
        expect(chain.to.presence).toMatch(/^(rooted-visible|unrooted-visible|hidden-only|absent)$/);
      }
    }

    const hiddenFrom = observations.generationChains.find(
      (chain) => chain.from.layer === "hiddenStem" && chain.from.stem === "乙",
    );
    const hiddenTo = observations.generationChains.find(
      (chain) => "target" in chain.to === false && chain.to.layer === "hiddenStem" && chain.to.stem === "丁",
    );
    expect(hiddenFrom ?? hiddenTo).toBeDefined();
  });

  it("dedupes duplicate from-stem sources in favor of visible month stem 乙", () => {
    const observations = buildStrengthObservations(chartB);
    const dayMasterKeys = observations.generationChains
      .filter((chain) => chain.relation === "resource-to-day-master")
      .map((chain) => chainDedupeKey(chain.relation, chain.from.stem, chain.to));

    expect(dayMasterKeys).toEqual(["resource-to-day-master:乙:day-master"]);
    expect(
      observations.generationChains.filter(
        (chain) => chain.relation === "resource-to-day-master" && chain.from.stem === "乙",
      ),
    ).toHaveLength(1);
    expect(
      observations.generationChains.every(
        (chain) =>
          chain.relation !== "resource-to-day-master" ||
          (chain.from.slot === "month" && chain.from.layer === "stem"),
      ),
    ).toBe(true);
  });

  it("does not expose score, winner, or need fields", () => {
    const observations = buildStrengthObservations(chartB);
    expect(observations).not.toHaveProperty("score");
    expect(observations).not.toHaveProperty("winner");
    expect(observations).not.toHaveProperty("need");
    expect(observations).not.toHaveProperty("yongsin");
    for (const cluster of observations.elementClusters) {
      expect(cluster).not.toHaveProperty("strength");
      expect(cluster).not.toHaveProperty("dominant");
      expect(cluster).not.toHaveProperty("count");
    }
  });
});

describe("buildStrengthObservations — elementClusters chart B", () => {
  it("preserves 金 across year·day·hour branches as separate branch anchors", () => {
    const observations = buildStrengthObservations(chartB);
    const metal = observations.elementClusters.find((cluster) => cluster.element === "金");
    expect(metal).toBeDefined();

    const branchAnchors = metal!.anchors.filter((anchor) => anchor.layer === "branch");
    expect(branchAnchors).toEqual([
      expect.objectContaining({ slot: "year", layer: "branch", branch: "酉" }),
      expect.objectContaining({ slot: "day", layer: "branch", branch: "申" }),
      expect.objectContaining({ slot: "hour", layer: "branch", branch: "酉" }),
    ]);
  });

  it("tracks 金 hidden stems on year 辛, day 庚, hour 辛", () => {
    const observations = buildStrengthObservations(chartB);
    const metal = observations.elementClusters.find((cluster) => cluster.element === "金")!;

    expect(metal.anchors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slot: "year",
          layer: "hiddenStem",
          branch: "酉",
          stem: "辛",
          sourceKey: "year:酉:辛:정기",
        }),
        expect.objectContaining({
          slot: "day",
          layer: "hiddenStem",
          branch: "申",
          stem: "庚",
          sourceKey: "day:申:庚:정기",
        }),
        expect.objectContaining({
          slot: "hour",
          layer: "hiddenStem",
          branch: "酉",
          stem: "辛",
          sourceKey: "hour:酉:辛:정기",
        }),
      ]),
    );
  });

  it("keeps branch and hiddenStem layers distinct on the same pillar", () => {
    const observations = buildStrengthObservations(chartB);
    const metal = observations.elementClusters.find((cluster) => cluster.element === "金")!;

    const yearBranch = metal.anchors.find((anchor) => anchor.slot === "year" && anchor.layer === "branch");
    const yearHidden = metal.anchors.find(
      (anchor) => anchor.slot === "year" && anchor.layer === "hiddenStem" && anchor.stem === "辛",
    );
    const yearStem = metal.anchors.find((anchor) => anchor.slot === "year" && anchor.layer === "stem");

    expect(yearBranch).toEqual(expect.objectContaining({ branch: "酉", layer: "branch" }));
    expect(yearHidden).toEqual(expect.objectContaining({ branch: "酉", layer: "hiddenStem", stem: "辛" }));
    expect(yearStem).toEqual(expect.objectContaining({ layer: "stem", stem: "辛" }));
    expect(clusterAnchorDedupeKey(yearBranch!)).not.toBe(clusterAnchorDedupeKey(yearHidden!));
    expect(clusterAnchorDedupeKey(yearStem!)).not.toBe(clusterAnchorDedupeKey(yearHidden!));
  });

  it("dedupes only identical sources, not branch vs hiddenStem on the same pillar", () => {
    const observations = buildStrengthObservations(chartB);
    const keys = observations.elementClusters.flatMap((cluster) =>
      cluster.anchors.map((anchor) => `${cluster.element}:${clusterAnchorDedupeKey(anchor)}`),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("builds 木·火·土·水 clusters with the same logic", () => {
    const observations = buildStrengthObservations(chartB);
    const elements = observations.elementClusters.map((cluster) => cluster.element);

    expect(elements).toEqual(expect.arrayContaining(["木", "火", "土", "金", "水"]));

    const wood = observations.elementClusters.find((cluster) => cluster.element === "木")!;
    expect(wood.anchors.some((anchor) => anchor.layer === "stem" && anchor.stem === "乙")).toBe(true);
    expect(wood.anchors.some((anchor) => anchor.layer === "hiddenStem" && anchor.stem === "乙")).toBe(true);

    const fire = observations.elementClusters.find((cluster) => cluster.element === "火")!;
    expect(fire.anchors.some((anchor) => anchor.slot === "day" && anchor.layer === "stem" && anchor.stem === "丙")).toBe(
      true,
    );
    expect(fire.anchors.some((anchor) => anchor.slot === "hour" && anchor.layer === "stem" && anchor.stem === "丁")).toBe(
      true,
    );
  });

  it("leaves generationChains unchanged when elementClusters are added", () => {
    const observations = buildStrengthObservations(chartB);
    expect(observations.generationChains).toHaveLength(19);
    expect(observations.generationChains.some((chain) => chain.relation === "resource-to-day-master")).toBe(true);
    expect(
      observations.generationChains.some(
        (chain) =>
          chain.relation === "element-generates" &&
          chain.from.stem === "乙" &&
          "target" in chain.to === false &&
          chain.to.stem === "丁",
      ),
    ).toBe(true);
  });
});

describe("buildStrengthObservations — non-generating pairs", () => {
  it("never creates a chain unless elementGenerates(from, to) holds", () => {
    const observations = buildStrengthObservations(chartB);

    for (const chain of observations.generationChains) {
      const toElement = chain.to.element;
      expect(elementGenerates(chain.from.element, toElement)).toBe(true);
    }

    expect(
      observations.generationChains.some(
        (chain) => chain.from.element === "金" && chain.to.element === "火",
      ),
    ).toBe(false);
  });

  it("does not treat same-element stems as generating", () => {
    const pillars = chart({
      year: { stem: "丙", branch: "寅" },
      month: { stem: "丁", branch: "午" },
      day: { stem: "丙", branch: "午" },
      hour: { stem: "丁", branch: "巳" },
    });
    const observations = buildStrengthObservations(pillars);

    expect(
      observations.generationChains.some(
        (chain) => chain.from.element === "火" && chain.to.element === "火",
      ),
    ).toBe(false);
  });
});

describe("buildStrengthObservations — frozen Strength v1", () => {
  it("does not change Strength summary or Need candidates for chart B", () => {
    const summaryBefore = buildStrengthSummary(chartB);
    const needBefore = buildNeedCandidateSet(chartB);

    buildStrengthObservations(chartB);

    const summaryAfter = buildStrengthSummary(chartB);
    const needAfter = buildNeedCandidateSet(chartB);

    expect(summaryAfter).toEqual(summaryBefore);
    expect(needAfter).toEqual(needBefore);
    expect(summaryAfter.directionCandidate).toBeNull();
    expect(summaryAfter.resolution).toBe("unresolved");
    expect(needAfter.strengthNeedCandidates).toEqual([]);
    expect(needAfter.strengthNeedStatus).toBe("unresolved");
  });
});

const structureSource = readFileSync(
  path.join(__dirname, "../observation/buildStructureObservations.ts"),
  "utf8",
);

describe("buildStrengthObservations — structureObservation chart B", () => {
  it("builds generation-support, resource-support, and peer-support separately", () => {
    const { structureObservation } = buildStrengthObservations(chartB);

    expect(structureObservation.supportRelations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "generation-support",
          elements: ["木", "火"],
          slots: ["month", "day"],
        }),
        expect.objectContaining({
          kind: "resource-support",
          elements: ["木"],
          slots: ["month"],
          evidenceRefs: [expect.objectContaining({ stem: "乙", shiShen: "정인", evidenceSide: "support" })],
        }),
        expect.objectContaining({
          kind: "peer-support",
          elements: ["火"],
          slots: ["hour"],
          evidenceRefs: [expect.objectContaining({ stem: "丁", shiShen: "겁재", evidenceSide: "support" })],
        }),
      ]),
    );
  });

  it("splits 金 and 土 pressure into layer-specific sub-relations", () => {
    const { structureObservation } = buildStrengthObservations(chartB);
    const pressure = structureObservation.pressureRelations;

    expect(pressure.filter((relation) => relation.element === "金")).toEqual([
      expect.objectContaining({
        kind: "pressure-visible-stem",
        element: "金",
        slots: ["year"],
        evidenceRefs: [expect.objectContaining({ slot: "year", layer: "stem", stem: "辛", shiShen: "정재" })],
      }),
      expect.objectContaining({
        kind: "pressure-branch-anchor",
        element: "金",
        slots: ["year", "day", "hour"],
        evidenceRefs: [
          expect.objectContaining({ slot: "year", layer: "branch", branch: "酉" }),
          expect.objectContaining({ slot: "day", layer: "branch", branch: "申" }),
          expect.objectContaining({ slot: "hour", layer: "branch", branch: "酉" }),
        ],
      }),
      expect.objectContaining({
        kind: "pressure-hidden-context",
        element: "金",
        evidenceRefs: expect.arrayContaining([
          expect.objectContaining({ slot: "year", layer: "hiddenStem", stem: "辛", sourceKey: "year:酉:辛:정기" }),
          expect.objectContaining({ slot: "day", layer: "hiddenStem", stem: "庚", sourceKey: "day:申:庚:정기" }),
          expect.objectContaining({ slot: "hour", layer: "hiddenStem", stem: "辛", sourceKey: "hour:酉:辛:정기" }),
        ]),
      }),
    ]);

    expect(pressure.filter((relation) => relation.element === "土")).toEqual([
      expect.objectContaining({
        kind: "pressure-branch-anchor",
        element: "土",
        slots: ["month"],
        evidenceRefs: [expect.objectContaining({ slot: "month", layer: "branch", branch: "未" })],
      }),
      expect.objectContaining({
        kind: "pressure-hidden-context",
        element: "土",
        evidenceRefs: expect.arrayContaining([
          expect.objectContaining({ slot: "month", layer: "hiddenStem", stem: "己", sourceKey: "month:未:己:정기" }),
          expect.objectContaining({ slot: "day", layer: "hiddenStem", stem: "戊", sourceKey: "day:申:戊:여기" }),
        ]),
      }),
    ]);
    expect(pressure.some((relation) => relation.element === "土" && relation.kind === "pressure-visible-stem")).toBe(
      false,
    );
  });

  it("creates coexistence from salient 金 pressure only, excluding 土 hidden-context", () => {
    const { structureObservation } = buildStrengthObservations(chartB);

    expect(structureObservation.coexistenceNotes).toHaveLength(1);
    const note = structureObservation.coexistenceNotes[0]!;
    expect(note.kind).toBe("support-and-pressure-coexist");
    expect(note.supportRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ evidenceSide: "support", stem: "乙" }),
        expect.objectContaining({ evidenceSide: "support", stem: "丁" }),
      ]),
    );
    expect(note.pressureRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ layer: "stem", stem: "辛" }),
        expect.objectContaining({ layer: "branch", branch: "酉" }),
        expect.objectContaining({ layer: "branch", branch: "申" }),
      ]),
    );
    expect(note.pressureRefs.some((ref) => ref.stem === "己" || ref.stem === "戊")).toBe(false);
    expect(note.pressureRefs.some((ref) => ref.layer === "hiddenStem")).toBe(false);
    expect(note).not.toHaveProperty("winner");
    expect(note).not.toHaveProperty("strongerSide");
  });

  it("keeps generationChains and elementClusters unchanged", () => {
    const before = buildStrengthObservations(chartB);
    const chains = before.generationChains;
    const clusters = before.elementClusters;

    expect(before.structureObservation.supportRelations.length).toBeGreaterThan(0);
    expect(before.generationChains).toEqual(chains);
    expect(before.elementClusters).toEqual(clusters);
    expect(before.generationChains).toHaveLength(19);
  });

  it("does not hardcode specific element names in structure builder source", () => {
    expect(structureSource).not.toMatch(/===\s*["'][木火土金水]["']/);
    expect(structureSource).not.toMatch(/element\s*===/);
  });
});

const chartRC01 = chart({
  year: { stem: "甲", branch: "寅" },
  month: { stem: "甲", branch: "寅" },
  day: { stem: "甲", branch: "子" },
  hour: { stem: "甲", branch: "子" },
});

const chartI1 = chart({
  year: { stem: "丙", branch: "子" },
  month: { stem: "丁", branch: "酉" },
  day: { stem: "甲", branch: "子" },
  hour: "unknown",
});

describe("buildStrengthObservations — structureObservation RC-01 and i1", () => {
  it("RC-01 does not create coexistence when only hidden-context pressure exists", () => {
    const { structureObservation } = buildStrengthObservations(chartRC01);

    expect(structureObservation.pressureRelations.every((relation) => relation.kind === "pressure-hidden-context")).toBe(
      true,
    );
    expect(structureObservation.coexistenceNotes).toEqual([]);
  });

  it("i1 preserves stem-only pressure as pressure-visible-stem", () => {
    const { structureObservation } = buildStrengthObservations(chartI1);
    const fireStem = structureObservation.pressureRelations.find(
      (relation) => relation.kind === "pressure-visible-stem" && relation.element === "火",
    );

    expect(fireStem).toEqual(
      expect.objectContaining({
        kind: "pressure-visible-stem",
        element: "火",
        slots: ["year", "month"],
        evidenceRefs: [
          expect.objectContaining({ slot: "year", layer: "stem", stem: "丙" }),
          expect.objectContaining({ slot: "month", layer: "stem", stem: "丁" }),
        ],
      }),
    );
  });
});

describe("buildStrengthObservations — structureObservation edge cases", () => {
  it("does not promote hidden-only pressure to coexistence", () => {
    const { structureObservation } = buildStrengthObservations(chartRC01);
    expect(structureObservation.supportRelations.length).toBeGreaterThan(0);
    expect(structureObservation.coexistenceNotes).toEqual([]);
  });

  it("emits pressure observations without visible support and skips coexistence", () => {
    const pillars = chart({
      year: { stem: "庚", branch: "申" },
      month: { stem: "辛", branch: "酉" },
      day: { stem: "丙", branch: "子" },
      hour: { stem: "庚", branch: "申" },
    });
    const { structureObservation } = buildStrengthObservations(pillars);

    expect(structureObservation.supportRelations).toEqual([]);
    expect(structureObservation.pressureRelations.length).toBeGreaterThan(0);
    expect(structureObservation.coexistenceNotes).toEqual([]);
  });
});
