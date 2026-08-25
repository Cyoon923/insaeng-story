import type {
  AdjustedClimateSummary,
  Element,
  NeedCandidateSet,
  NeedDecisionBlocker,
  NeedRelationPattern,
  NeedResolution,
  NeedResolutionStatus,
  StrengthDirectionCandidate,
  StrengthNeedStatus,
  StrengthSummary,
  ClimateNeedStatus,
} from "@/lib/saju/types";

export type SpeakableStatus = "ready-provisional" | "partial-hold" | "diagnostic-only";

export type SpeakableConfidence = "provisional" | "partial" | "hold";

export type ThemeKind =
  | "strength-observation"
  | "need-strength-candidate"
  | "need-climate-candidate"
  | "climate-observation"
  | "relation-meta";

export type SpeakableProvenanceLayer =
  | "strength"
  | "climate"
  | "need-strength"
  | "need-climate"
  | "need-resolution";

export type SpeakableProvenance = {
  layer: SpeakableProvenanceLayer;
  evidenceRef: string;
};

export type SpeakableTheme = {
  id: string;
  kind: ThemeKind;
  phrase: string;
  elements?: Element[];
  provenance: SpeakableProvenance[];
};

export type MusicRecommendationHints = {
  moodTags: string[];
  lyricHints: string[];
  elementThemeBag: Element[];
  forbidden: string[];
  provenance: SpeakableProvenance[];
};

export type SpeakableFallbackCode =
  | "FB-STRENGTH-NULL"
  | "FB-STRENGTH-MIXED"
  | "FB-STRENGTH-NEED-GATED"
  | "FB-CLIMATE-AXIS-UNRESOLVED"
  | "FB-NEED-015-NO-CLAIM"
  | "FB-RESOLUTION-BLOCKED"
  | "FB-HOUR-UNKNOWN-PROVISIONAL"
  | "FB-STORY-FIRST";

export type SpeakableInput = {
  strength: StrengthSummary;
  climate: AdjustedClimateSummary;
  needCandidates: NeedCandidateSet;
  needResolution: NeedResolution;
  hourUnknown: boolean;
};

export type SpeakableInternal = {
  strengthDirection: StrengthDirectionCandidate;
  strengthNeedStatus: StrengthNeedStatus;
  climateNeedStatus: ClimateNeedStatus;
  relationPattern: NeedRelationPattern;
  resolutionStatus: NeedResolutionStatus;
  decisionBlockedBy: NeedDecisionBlocker[];
};

export type SpeakableOutput = {
  speakableStatus: SpeakableStatus;
  confidence: SpeakableConfidence;
  provisional: true;
  hourUnknown: boolean;
  hourUnknownProvisional: boolean;
  observationThemes: SpeakableTheme[];
  supportThemes: SpeakableTheme[];
  cautionThemes: SpeakableTheme[];
  climateThemes: SpeakableTheme[];
  musicRecommendationHints: MusicRecommendationHints;
  internal: SpeakableInternal;
  fallbackApplied: SpeakableFallbackCode[];
};
