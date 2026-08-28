/**
 * Build LuckEvidenceLayer from AnnualTarget + natal Core/Supplement elements.
 * No A1–A5, no ACTIVE/CAUTION, no annualSupplement winner.
 */

import {
  elementGenerates,
  generatedElement,
} from "@/lib/saju/observation/elementGenerates";
import type {
  AnnualClimateSignal,
  AnnualLuckEvidence,
  AnnualRelationKind,
  AnnualSignal,
  BuildAnnualLuckEvidenceInput,
} from "@/lib/saju/luck/annual/types";
import type { Element } from "@/lib/saju/types";

/** 상극 via 상생 cycle: E 剋 T iff generatedElement(generatedElement(E)) === T. */
function elementControls(from: Element, to: Element): boolean {
  return generatedElement(generatedElement(from)) === to;
}

/**
 * Relation of signal element E toward reference T.
 * Uses ELEMENT_GENERATES only (no separate 克 table).
 */
export function relationFromTo(from: Element, to: Element): AnnualRelationKind {
  if (from === to) return "same";
  if (elementGenerates(from, to)) return "generates";
  if (elementGenerates(to, from)) return "generated-by";
  if (elementControls(from, to)) return "controls";
  if (elementControls(to, from)) return "controlled-by";
  // Five-element cycle always hits one of the above for distinct pair.
  throw new Error(`relationFromTo: unexpected pair ${from}/${to}`);
}

function climateTag(element: Element): AnnualClimateSignal {
  if (element === "火") return "fire-signal";
  if (element === "水") return "water-signal";
  return "none";
}

function buildSignal(input: {
  source: AnnualSignal["source"];
  element: Element;
  natalCoreElement: Element;
  natalSupplementElement: Element | null;
}): AnnualSignal {
  return {
    source: input.source,
    element: input.element,
    relationToNatalCore: relationFromTo(input.element, input.natalCoreElement),
    relationToNatalSupplement:
      input.natalSupplementElement === null
        ? null
        : relationFromTo(input.element, input.natalSupplementElement),
  };
}

/**
 * Stem + branch-main signals only. Same element keeps two source rows (no count merge).
 */
export function buildAnnualLuckEvidence(
  input: BuildAnnualLuckEvidenceInput,
): AnnualLuckEvidence {
  const { target, natalCoreElement, natalSupplementElement } = input;
  const reasons: string[] = [
    `luck:annual-year=${target.year}`,
    `luck:stem=${target.stem}`,
    `luck:branch=${target.branch}`,
    `luck:natal-core=${natalCoreElement}`,
    natalSupplementElement === null
      ? "luck:natal-supplement=null"
      : `luck:natal-supplement=${natalSupplementElement}`,
  ];

  const signals: AnnualSignal[] = [
    buildSignal({
      source: "stem",
      element: target.stemElement,
      natalCoreElement,
      natalSupplementElement,
    }),
    buildSignal({
      source: "branch-main",
      element: target.branchMainElement,
      natalCoreElement,
      natalSupplementElement,
    }),
  ];

  const climateSignals = signals.map((signal) => climateTag(signal.element));
  reasons.push(
    `luck:signals=${signals.map((s) => `${s.source}:${s.element}`).join(",")}`,
  );
  reasons.push(`luck:climate=${climateSignals.join(",")}`);

  return {
    target,
    signals,
    climateSignals,
    reasons,
  };
}
