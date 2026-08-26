import type {
  AdjustedClimateSummary,
  Element,
  NeedCandidateSet,
  NeedResolution,
  StrengthSummary,
} from "@/lib/saju/types";
import type { SpeakableOutput } from "@/lib/saju/speakable/types";

export type FreeDirectionStance = "open-candidate" | "held-aside" | "tentative" | "context-only";

export type FreeDirectionOrigin = "strength-support" | "strength-caution" | "climate-context";

export type FreeDirectionItem = {
  text: string;
  element?: Element;
  stance: FreeDirectionStance;
  origin: FreeDirectionOrigin;
};

/** Free v1 Interpretation Layer — user-facing copy only. No engine re-judgment. */
export type FreeInterpretation = {
  headline: string;
  /** Extra observation only; null when there is nothing to add beyond headline. */
  explanation: string | null;
  supportItems: FreeDirectionItem[];
  cautionItems: FreeDirectionItem[];
  climateNotes: FreeDirectionItem[];
  uncertaintyNotes: string[];
};

export type FreeInterpretationInput = {
  speakable: SpeakableOutput;
  strength: StrengthSummary;
  climate: AdjustedClimateSummary;
  needCandidates: NeedCandidateSet;
  needResolution: NeedResolution;
};
