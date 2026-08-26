/**
 * Assemble FER Core + Supplement into one contract.
 * No re-resolution, climate/Need lookup, or winner re-pick.
 */

import type {
  CoreAndSupplementResolution,
  FinalResolution,
} from "@/lib/saju/final/types";
import type { ResolveSupplementElementResult } from "@/lib/saju/final/resolveSupplementElement";

export type ResolveCoreAndSupplementInput = {
  finalResolution: FinalResolution;
  supplementResolution: ResolveSupplementElementResult;
};

function prefixReasons(prefix: string, reasons: string[]): string[] {
  return reasons.map((reason) => `${prefix}:${reason}`);
}

/**
 * Map FinalResolution + Supplement resolution into CoreAndSupplementResolution.
 * When Core is unresolved, Supplement is forced null / unresolved.
 */
export function resolveCoreAndSupplement(
  input: ResolveCoreAndSupplementInput,
): CoreAndSupplementResolution {
  const { finalResolution, supplementResolution } = input;
  const coreUnresolved =
    finalResolution.certainty === "unresolved" || finalResolution.finalElement === null;

  const coreReasons = prefixReasons("core", finalResolution.reasons);
  const supplementReasons = prefixReasons("supplement", supplementResolution.reasons);

  if (coreUnresolved) {
    return {
      coreElement: null,
      coreRole: null,
      coreCertainty: finalResolution.certainty,
      supplementElement: null,
      supplementStatus: "unresolved",
      reasons: [
        ...coreReasons,
        "core:unresolved-forces-supplement-null",
        ...supplementReasons,
      ],
    };
  }

  return {
    coreElement: finalResolution.finalElement,
    coreRole: finalResolution.finalRole,
    coreCertainty: finalResolution.certainty,
    supplementElement: supplementResolution.supplementElement,
    supplementStatus: supplementResolution.status,
    reasons: [...coreReasons, ...supplementReasons],
  };
}
