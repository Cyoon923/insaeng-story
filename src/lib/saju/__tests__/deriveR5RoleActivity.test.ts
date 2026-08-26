import { describe, expect, it } from "vitest";
import { deriveR5RoleActivity } from "@/lib/saju/final/deriveR5RoleActivity";
import { buildStrengthObservations } from "@/lib/saju/observation/buildStrengthObservations";
import { collectStrengthEvidence } from "@/lib/saju/elements/strength";
import { stemElement } from "@/lib/saju/constants/elements";
import { generatedElement } from "@/lib/saju/observation/elementGenerates";
import type { Element, FourPillars, HourPillar, Pillar } from "@/lib/saju/types";
import { ELEMENTS } from "@/lib/saju/types";

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

function parentElement(child: Element): Element {
  const parent = ELEMENTS.find((element) => generatedElement(element) === child);
  if (!parent) throw new Error(`No parent for ${child}`);
  return parent;
}

function corridorLegs(
  observations: ReturnType<typeof buildStrengthObservations>,
  mid: Element,
  dayElement: Element,
) {
  const parent = parentElement(mid);
  const child = generatedElement(mid);
  const pm = observations.generationChains.filter(
    (chain) =>
      chain.relation === "element-generates" &&
      chain.from.element === parent &&
      !("target" in chain.to) &&
      chain.to.element === mid,
  );
  const mq = observations.generationChains.filter((chain) => {
    if (chain.from.element !== mid) return false;
    if (chain.relation === "resource-to-day-master") return child === dayElement;
    return (
      chain.relation === "element-generates" &&
      !("target" in chain.to) &&
      chain.to.element === child
    );
  });
  return { parent, child, pm, mq };
}

describe("deriveR5RoleActivity", () => {
  it("returns C for non-day Q corridor 水→木→火 when 木 mid links operate", () => {
    const pillars = chart({
      year: { stem: "壬", branch: "子" },
      month: { stem: "甲", branch: "寅" },
      day: { stem: "庚", branch: "申" },
      hour: { stem: "丙", branch: "午" },
    });
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);
    const dayElement = stemElement(pillars.day.stem);
    const { parent, child, pm, mq } = corridorLegs(observations, "木", dayElement);

    expect(dayElement).not.toBe(child);
    expect(parent).toBe("水");
    expect(child).toBe("火");
    expect(pm.some((chain) => chain.from.presence === "rooted-visible")).toBe(true);
    expect(mq.some((chain) => chain.from.presence === "rooted-visible")).toBe(true);

    expect(deriveR5RoleActivity({ pillars, evidence, observations })).toBe("C");
  });

  it("does not return C when mid 木 has presence but corridor relations do not operate on surface", () => {
    const pillars = chart({
      year: { stem: "甲", branch: "酉" },
      month: { stem: "乙", branch: "酉" },
      day: { stem: "庚", branch: "酉" },
      hour: "unknown",
    });
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);
    const dayElement = stemElement(pillars.day.stem);
    const { pm, mq } = corridorLegs(observations, "木", dayElement);

    expect(observations.elementClusters.some((cluster) => cluster.element === "木")).toBe(true);
    expect(pm.length).toBe(0);
    expect(mq.length).toBe(0);

    expect(deriveR5RoleActivity({ pillars, evidence, observations })).not.toBe("C");
  });

  it("returns C for resource→day as one general P→M→Q case (Q may be day)", () => {
    const pillars = chart({
      year: { stem: "壬", branch: "子" },
      month: { stem: "乙", branch: "未" },
      day: { stem: "丙", branch: "申" },
      hour: { stem: "丁", branch: "酉" },
    });
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);
    const dayElement = stemElement(pillars.day.stem);
    const mid: Element = "木";
    const { child, pm, mq } = corridorLegs(observations, mid, dayElement);

    expect(child).toBe(dayElement);
    expect(pm.some((chain) => chain.from.presence === "rooted-visible")).toBe(true);
    expect(
      mq.some(
        (chain) =>
          (chain.relation === "resource-to-day-master" ||
            chain.relation === "element-generates") &&
          chain.from.presence === "rooted-visible",
      ),
    ).toBe(true);

    expect(deriveR5RoleActivity({ pillars, evidence, observations })).toBe("C");
  });

  it("returns C when rooted P→M exists and rooted generation-support alone confirms M→Q", () => {
    const pillars = chart({
      year: { stem: "壬", branch: "子" },
      month: { stem: "乙", branch: "未" },
      day: { stem: "丙", branch: "申" },
      hour: { stem: "丁", branch: "酉" },
    });
    const evidence = collectStrengthEvidence(pillars);
    const base = buildStrengthObservations(pillars, evidence);
    const dayElement = stemElement(pillars.day.stem);
    const mid: Element = "木";

    // Strip M→Q generationChains; keep rooted P→M and generation-support.
    const observations = {
      ...base,
      generationChains: base.generationChains.filter((chain) => {
        if (chain.relation === "resource-to-day-master" && chain.from.element === mid) {
          return false;
        }
        if (
          chain.relation === "element-generates" &&
          chain.from.element === mid &&
          !("target" in chain.to) &&
          chain.to.element === dayElement
        ) {
          return false;
        }
        return true;
      }),
    };

    const { pm, mq } = corridorLegs(observations, mid, dayElement);
    expect(pm.some((chain) => chain.from.presence === "rooted-visible")).toBe(true);
    expect(mq.length).toBe(0);
    expect(
      observations.structureObservation.supportRelations.some(
        (relation) =>
          relation.kind === "generation-support" &&
          relation.elements.includes(mid) &&
          relation.elements.includes(dayElement),
      ),
    ).toBe(true);
    expect(
      evidence.supportEvidence.items.some(
        (item) =>
          (item.shiShen === "정인" || item.shiShen === "편인") &&
          item.presence === "rooted-visible" &&
          stemElement(item.stem) === mid,
      ),
    ).toBe(true);

    expect(deriveR5RoleActivity({ pillars, evidence, observations })).toBe("C");
  });

  it("does not return C when generation-support M→Q is only hidden/unrooted", () => {
    const pillars = chart({
      year: { stem: "壬", branch: "子" },
      month: { stem: "乙", branch: "未" },
      day: { stem: "丙", branch: "申" },
      hour: { stem: "丁", branch: "酉" },
    });
    const evidence = collectStrengthEvidence(pillars);
    const base = buildStrengthObservations(pillars, evidence);
    const dayElement = stemElement(pillars.day.stem);
    const mid: Element = "木";

    // Keep P→M rooted; remove M→Q chains and rooted resource supportEvidence.
    // generation-support kind remains, but backing is forced to hidden-only only.
    const observations = {
      ...base,
      generationChains: [
        ...base.generationChains.filter((chain) => {
          if (chain.relation === "resource-to-day-master" && chain.from.element === mid) {
            return false;
          }
          if (
            chain.relation === "element-generates" &&
            chain.from.element === mid &&
            !("target" in chain.to) &&
            chain.to.element === dayElement
          ) {
            return false;
          }
          return true;
        }),
        ...base.generationChains
          .filter(
            (chain) =>
              chain.relation === "resource-to-day-master" && chain.from.element === mid,
          )
          .map((chain) => ({
            ...chain,
            from: { ...chain.from, presence: "hidden-only" as const },
          })),
      ],
    };
    const weakEvidence = {
      ...evidence,
      supportEvidence: {
        items: evidence.supportEvidence.items.filter(
          (item) => !(item.shiShen === "정인" || item.shiShen === "편인"),
        ),
      },
    };

    const { pm, mq } = corridorLegs(observations, mid, dayElement);
    expect(pm.some((chain) => chain.from.presence === "rooted-visible")).toBe(true);
    expect(mq.every((chain) => chain.from.presence !== "rooted-visible")).toBe(true);
    expect(
      observations.structureObservation.supportRelations.some(
        (relation) => relation.kind === "generation-support",
      ),
    ).toBe(true);

    expect(deriveR5RoleActivity({ pillars, evidence: weakEvidence, observations })).not.toBe(
      "C",
    );
  });

  it("returns B when connection mid is hidden-only and surface corridor is not working", () => {
    const pillars = chart({
      year: { stem: "戊", branch: "辰" },
      month: { stem: "戊", branch: "辰" },
      day: { stem: "甲", branch: "子" },
      hour: "unknown",
    });
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);
    const dayElement = stemElement(pillars.day.stem);
    const { pm, mq } = corridorLegs(observations, "水", dayElement);

    expect(mq.some((chain) => chain.from.presence === "hidden-only")).toBe(true);
    expect(pm.some((chain) => chain.from.presence === "rooted-visible")).toBe(false);
    expect(mq.some((chain) => chain.from.presence === "rooted-visible")).toBe(false);

    expect(deriveR5RoleActivity({ pillars, evidence, observations })).toBe("B");
  });

  it("returns B when mid is structural-only and generation is not surface-working", () => {
    const pillars = chart({
      year: { stem: "甲", branch: "子" },
      month: { stem: "甲", branch: "子" },
      day: { stem: "庚", branch: "辰" },
      hour: "unknown",
    });
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);
    const dayElement = stemElement(pillars.day.stem);
    const mid: Element = "土";
    const cluster = observations.elementClusters.find((item) => item.element === mid);
    const { pm, mq } = corridorLegs(observations, mid, dayElement);

    expect(cluster?.anchors.some((anchor) => anchor.layer === "branch")).toBe(true);
    expect(
      [...pm, ...mq].some((chain) => chain.from.presence === "rooted-visible"),
    ).toBe(false);

    expect(deriveR5RoleActivity({ pillars, evidence, observations })).toBe("B");
  });

  it("does not return C for unrelated single-leg element-generates", () => {
    const pillars = chart({
      year: { stem: "甲", branch: "子" },
      month: { stem: "甲", branch: "子" },
      day: { stem: "甲", branch: "子" },
      hour: "unknown",
    });
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);

    expect(observations.generationChains.some((chain) => chain.relation === "element-generates")).toBe(
      true,
    );

    const dayElement = stemElement(pillars.day.stem);
    for (const mid of ELEMENTS) {
      const { pm, mq } = corridorLegs(observations, mid, dayElement);
      const bothRooted =
        pm.some((chain) => chain.from.presence === "rooted-visible") &&
        mq.some((chain) => chain.from.presence === "rooted-visible");
      expect(bothRooted).toBe(false);
    }

    expect(deriveR5RoleActivity({ pillars, evidence, observations })).not.toBe("C");
  });

  it("returns A when there is no R5 connection role trace", () => {
    const pillars = chart({
      year: { stem: "庚", branch: "酉" },
      month: { stem: "庚", branch: "酉" },
      day: { stem: "庚", branch: "酉" },
      hour: "unknown",
    });
    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);

    expect(observations.generationChains).toHaveLength(0);

    expect(deriveR5RoleActivity({ pillars, evidence, observations })).toBe("A");
  });
});
