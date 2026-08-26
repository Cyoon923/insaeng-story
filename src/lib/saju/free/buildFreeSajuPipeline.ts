import {
  buildAdjustedClimateSummary,
  buildFreeInterpretation,
  buildNeedCandidateSet,
  buildNeedResolution,
  buildStrengthSummary,
} from "@/lib/saju";
import {
  buildFreeSajuPillars,
  type FreeSajuBirthFormInput,
} from "@/lib/saju/free/buildFreeSajuPillars";
import type { FreeInterpretation } from "@/lib/saju/interpretation/types";
import { buildSpeakableOutput } from "@/lib/saju/speakable/buildSpeakableOutput";
import type { FourPillars } from "@/lib/saju/types";

export type FreeSajuPipelineResult = {
  pillars: FourPillars;
  interpretation: FreeInterpretation;
};

/**
 * Free form birth → FourPillars → frozen free-v1 interpretation pipeline.
 * Same order as preview/free-saju-result; no re-judgment beyond existing builders.
 */
export function buildFreeSajuPipeline(input: FreeSajuBirthFormInput): FreeSajuPipelineResult {
  const pillars = buildFreeSajuPillars(input);

  const strength = buildStrengthSummary(pillars);
  const climate = buildAdjustedClimateSummary(pillars);
  const needCandidates = buildNeedCandidateSet(pillars);
  const needResolution = buildNeedResolution(pillars);

  const speakable = buildSpeakableOutput({
    strength,
    climate,
    needCandidates,
    needResolution,
    hourUnknown: pillars.hour === "unknown",
  });

  const interpretation = buildFreeInterpretation({
    speakable,
    strength,
    climate,
    needCandidates,
    needResolution,
  });

  return { pillars, interpretation };
}
