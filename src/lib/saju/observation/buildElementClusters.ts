import { branchElement, stemElement } from "@/lib/saju/constants/elements";
import { analyzeElementPresence } from "@/lib/saju/elements/presence";
import type { ElementCluster, ElementClusterAnchor, ElementClusterLayer } from "@/lib/saju/observation/types";
import type {
  Element,
  FourPillars,
  PillarSlot,
  Stem,
  StrengthEvidence,
} from "@/lib/saju/types";
import { ELEMENTS } from "@/lib/saju/types";

const SLOT_ORDER: Record<PillarSlot, number> = {
  year: 0,
  month: 1,
  day: 2,
  hour: 3,
};

const LAYER_ORDER: Record<ElementClusterLayer, number> = {
  branch: 0,
  stem: 1,
  hiddenStem: 2,
};

function pillarForSlot(pillars: FourPillars, slot: PillarSlot) {
  if (slot === "year") return pillars.year;
  if (slot === "month") return pillars.month;
  if (slot === "day") return pillars.day;
  if (pillars.hour === "unknown") return null;
  return pillars.hour;
}

export function clusterAnchorDedupeKey(anchor: ElementClusterAnchor): string {
  if (anchor.layer === "branch" && anchor.branch) {
    return `${anchor.slot}:branch:${anchor.branch}`;
  }
  if (anchor.layer === "stem" && anchor.stem) {
    return `${anchor.slot}:stem:${anchor.stem}`;
  }
  if (anchor.sourceKey) {
    return anchor.sourceKey;
  }
  return `${anchor.slot}:hiddenStem:${anchor.branch}:${anchor.stem}:${anchor.hiddenRole ?? ""}`;
}

function anchorElement(anchor: ElementClusterAnchor): Element {
  if (anchor.layer === "branch" && anchor.branch) {
    return branchElement(anchor.branch);
  }
  if (anchor.stem) {
    return stemElement(anchor.stem);
  }
  throw new Error("ElementClusterAnchor must have branch or stem");
}

function sortAnchors(anchors: ElementClusterAnchor[]): ElementClusterAnchor[] {
  return [...anchors].sort((a, b) => {
    const slotDiff = SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot];
    if (slotDiff !== 0) return slotDiff;
    return LAYER_ORDER[a.layer] - LAYER_ORDER[b.layer];
  });
}

export function collectClusterAnchors(pillars: FourPillars, evidence: StrengthEvidence): ElementClusterAnchor[] {
  const anchors: ElementClusterAnchor[] = [];
  const seen = new Set<string>();

  function add(anchor: ElementClusterAnchor): void {
    const key = clusterAnchorDedupeKey(anchor);
    if (seen.has(key)) return;
    seen.add(key);
    anchors.push(anchor);
  }

  for (const slot of evidence.includedSlots) {
    const pillar = pillarForSlot(pillars, slot);
    if (!pillar) continue;

    const branch = pillar.branch;
    add({
      slot,
      layer: "branch",
      branch,
      presence: analyzeElementPresence(pillars, branchElement(branch)).presence,
    });

    const stem = pillar.stem;
    add({
      slot,
      layer: "stem",
      stem,
      presence: analyzeElementPresence(pillars, stemElement(stem)).presence,
    });
  }

  for (const item of evidence.branchRelationEvidence.items) {
    add({
      slot: item.slot,
      layer: "hiddenStem",
      branch: item.branch,
      stem: item.hiddenStem,
      hiddenRole: item.hiddenRole,
      presence: item.presence,
      sourceKey: item.sourceKey,
    });
  }

  return anchors;
}

export function buildElementClusters(pillars: FourPillars, evidence: StrengthEvidence): ElementCluster[] {
  const anchors = collectClusterAnchors(pillars, evidence);
  const grouped = new Map<Element, ElementClusterAnchor[]>();

  for (const anchor of anchors) {
    const element = anchorElement(anchor);
    const bucket = grouped.get(element) ?? [];
    bucket.push(anchor);
    grouped.set(element, bucket);
  }

  return ELEMENTS.filter((element) => grouped.has(element)).map((element) => ({
    element,
    anchors: sortAnchors(grouped.get(element)!),
  }));
}

export { anchorElement, sortAnchors };
