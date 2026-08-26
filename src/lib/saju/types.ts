export const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;
export const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;

export type Stem = (typeof STEMS)[number];
export type Branch = (typeof BRANCHES)[number];

export type CalendarKind = "solar" | "lunar";
export type TimezoneId = "Asia/Seoul";
export type DayBoundary = "night_ja" | "early_ja";
export type HourCertainty = "confirmed" | "unknown";

export type ClockTime = {
  hour: number;
  minute: number;
};

export type BirthTime = ClockTime | "unknown";

export type BirthInput = {
  calendar: CalendarKind;
  year: number;
  month: number;
  day: number;
  isLeapMonth: boolean;
  time: BirthTime;
  timezone?: TimezoneId;
  dayBoundary?: DayBoundary;
};

export type SolarInstant = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export type Pillar = {
  stem: Stem;
  branch: Branch;
};

export type HourPillar = Pillar | "unknown";

export type FourPillars = {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  hour: HourPillar;
  hourCertainty: HourCertainty;
  dayBoundaryNote?: string;
  warnings: string[];
};

export type SolarTermName =
  | "입춘"
  | "우수"
  | "경칩"
  | "춘분"
  | "청명"
  | "곡우"
  | "입하"
  | "소만"
  | "망종"
  | "하지"
  | "소서"
  | "대서"
  | "입추"
  | "처서"
  | "백로"
  | "추분"
  | "한로"
  | "상강"
  | "입동"
  | "소설"
  | "대설"
  | "동지"
  | "소한"
  | "대한";

export type MonthBranch = "寅" | "卯" | "辰" | "巳" | "午" | "未" | "申" | "酉" | "戌" | "亥" | "子" | "丑";

export const SAJU_YEAR_MIN = 1900;
export const SAJU_YEAR_MAX = 2100;

export const ELEMENTS = ["木", "火", "土", "金", "水"] as const;
export type Element = (typeof ELEMENTS)[number];

export type PillarSlot = "year" | "month" | "day" | "hour";
export type HiddenStemRole = "여기" | "중기" | "정기";
export type ElementLayer = "stem" | "branch" | "hiddenStem";

export type HiddenStemPart = {
  stem: Stem;
  role: HiddenStemRole;
};

export type ElementMaterialItem = {
  slot: PillarSlot;
  layer: ElementLayer;
  element: Element;
  stem?: Stem;
  branch?: Branch;
  role?: HiddenStemRole;
};

export type ElementMaterials = {
  hourUnknown: boolean;
  dayStem: Stem;
  items: ElementMaterialItem[];
};

export type SeasonName = "봄" | "여름" | "가을" | "겨울" | "환절";
export type SeasonPhase = "왕" | "상" | "휴" | "수" | "사";
export type StemPolarity = "비견" | "겁재";
export type ElementPresenceKind = "rooted-visible" | "unrooted-visible" | "hidden-only" | "absent";

export type SeasonPhaseLabel = {
  monthBranch: Branch;
  season: SeasonName;
  element: Element;
  phase: SeasonPhase;
};

export type RootHit = {
  slot: PillarSlot;
  branch: Branch;
  hiddenStem: Stem;
  role: HiddenStemRole;
  polarity: StemPolarity;
};

export type StemRootAnalysis = {
  stem: Stem;
  element: Element;
  hourUnknown: boolean;
  hits: RootHit[];
};

export type ElementPresenceAnalysis = {
  element: Element;
  hourUnknown: boolean;
  presence: ElementPresenceKind;
  visibleSlots: PillarSlot[];
  rootedSlots: PillarSlot[];
  monthOutletSlots: PillarSlot[];
};

export const SHI_SHEN = [
  "비견",
  "겁재",
  "식신",
  "상관",
  "편재",
  "정재",
  "편관",
  "정관",
  "편인",
  "정인",
] as const;
export type ShiShen = (typeof SHI_SHEN)[number];

export type SupportShiShen = "비견" | "겁재" | "편인" | "정인";
export type PressureShiShen = "식신" | "상관" | "편재" | "정재" | "편관" | "정관";

/** Diagnostic only: support-side source group (no weight / no decideDirection input). */
export type SupportSourceKind = "peer" | "resource";
/** Diagnostic only: pressure-side source group (no weight / no decideDirection input). */
export type PressureSourceKind = "output" | "wealth" | "officer";

/** Presence flags per source kind — observation meta, not a score. */
export type StrengthSourcePresence = {
  rootedVisible: boolean;
  unrootedVisible: boolean;
};

/**
 * Preserves peer/resource and output/wealth/officer distinctions inside support/pressure.
 * Must not feed decideDirection; equal-weight assumptions stay explicit and unused here.
 */
export type StrengthSourceBreakdown = {
  peer: StrengthSourcePresence;
  resource: StrengthSourcePresence;
  output: StrengthSourcePresence;
  wealth: StrengthSourcePresence;
  officer: StrengthSourcePresence;
};

export type StrengthStemSlot = "year" | "month" | "hour";

export type StrengthRelationItem = {
  slot: StrengthStemSlot;
  layer: "stem";
  stem: Stem;
  shiShen: ShiShen;
  elementPhase: SeasonPhase;
  presence: ElementPresenceKind;
};

export type SeasonalEvidence = SeasonPhaseLabel;

export type RootEvidence = {
  hits: RootHit[];
  hasRoot: boolean;
};

export type SupportEvidence = {
  items: Array<StrengthRelationItem & { shiShen: SupportShiShen }>;
};

export type PressureEvidence = {
  items: Array<StrengthRelationItem & { shiShen: PressureShiShen }>;
};

export type RelationSide = "support" | "pressure";

export type BranchRelationItem = {
  slot: PillarSlot;
  branch: Branch;
  hiddenStem: Stem;
  hiddenRole: HiddenStemRole;
  sourceKey: string;
  shiShen: ShiShen;
  relationSide: RelationSide;
  element: Element;
  elementPhase: SeasonPhase;
  /** 해당 오행이 명식 전체에서 rooted-visible / unrooted-visible / hidden-only / absent 인지. 지장간 글자의 투출이 아니다. */
  presence: ElementPresenceKind;
  /** 같은 천간 글자가 확정된 천간에 실제로 있는지. source를 합치지 않는다. */
  exactStemVisible: boolean;
  exactStemVisibleAt: PillarSlot[];
};

export type BranchRelationEvidence = {
  items: BranchRelationItem[];
};

export type StrengthEvidence = {
  dayStem: Stem;
  hourUnknown: boolean;
  includedSlots: PillarSlot[];
  omittedSlots: PillarSlot[];
  seasonalEvidence: SeasonalEvidence;
  rootEvidence: RootEvidence;
  supportEvidence: SupportEvidence;
  pressureEvidence: PressureEvidence;
  branchRelationEvidence: BranchRelationEvidence;
};

export type StrengthCertainty = "complete" | "partial";
export type StrengthResolution = "clear-direction" | "mixed" | "unresolved";
export type StrengthDirectionCandidate = "leaning-strong" | "mixed" | "leaning-weak" | null;
/** Diagnostic only: leaning direction under hour-unknown remains provisional (not fed to decideDirection/Need). */
export type StrengthDirectionSensitivity = "hour-unknown-provisional" | null;
export type RootQuality = "clear" | "present" | "shallow" | "absent";
/** Weak-season (사/수) ladder: root band from rootQuality. */
export type WeakSeasonRootBand = "absent" | "shallow" | "firm";
/** Weak-season ladder: rooted-visible peer/resource axes only (no counts). */
export type WeakSeasonSupportAxis = "none" | "peer" | "resource" | "both";
/** Weak-season ladder: rooted-visible output vs wealth/officer (no counts). */
export type WeakSeasonPressureAxis = "none" | "drain" | "control" | "multi";
/** Diagnostic: leaning-weak under 사/수 with root (L2). Not a mixedPattern. */
export type WeakSeasonPattern = "weak-season-with-root" | null;
export type MixedStrengthPattern =
  | "strong-base-with-pressure"
  | "weak-season-with-support"
  | "weak-season-root-under-pressure"
  | "shallow-root-under-pressure"
  | "help-season-absent-root"
  | "neutral-season-conflict"
  | "other-mixed";
export type MixedConflictLevel = "visible-visible" | "seasonal-visible" | "root-visible" | "multi-axis";
export type UnresolvedStrengthReason =
  | "seasonal-phase-insufficient"
  | "only-unrooted-visible-evidence"
  | "hidden-relations-conflict"
  | "insufficient-visible-direction"
  | "hour-unknown-sensitive";
export type StrengthSideKind = "seasonal" | "root" | "visible-support" | "visible-pressure";
export type StrengthSideQuality =
  | SeasonPhase
  | RootQuality
  | "rooted-visible"
  | "unrooted-visible";

export type StrengthSideEvidenceItem = {
  kind: StrengthSideKind;
  quality: StrengthSideQuality;
  help?: boolean;
  slot?: StrengthStemSlot;
  stem?: Stem;
  shiShen?: ShiShen;
  presence?: ElementPresenceKind;
};

export type HiddenRelationNote = {
  slot: PillarSlot;
  branch: Branch;
  hiddenStem: Stem;
  hiddenRole: HiddenStemRole;
  shiShen: ShiShen;
  elementPhase: SeasonPhase;
  elementPresence: ElementPresenceKind;
  exactStemVisible: boolean;
  exactStemVisibleAt: PillarSlot[];
  sourceKey: string;
};

export type StrengthSummary = {
  certainty: StrengthCertainty;
  resolution: StrengthResolution;
  directionCandidate: StrengthDirectionCandidate;
  /**
   * Diagnostic: hour unknown + leaning-* means direction may change if hour is known.
   * Not used by decideDirection, resolution, certainty, or Need.
   */
  directionSensitivity: StrengthDirectionSensitivity;
  seasonalPhase: SeasonPhase;
  rootQuality: RootQuality;
  strongSideEvidence: StrengthSideEvidenceItem[];
  weakSideEvidence: StrengthSideEvidenceItem[];
  hiddenSupportNotes: HiddenRelationNote[];
  hiddenPressureNotes: HiddenRelationNote[];
  /** Diagnostic source-type presence inside support/pressure; not used by decideDirection. */
  sourceBreakdown: StrengthSourceBreakdown;
  conflicts: string[];
  unresolvedReasons: string[];
  mixedPattern: MixedStrengthPattern | null;
  mixedConflictLevel: MixedConflictLevel | null;
  /** Set when 사/수 ladder yields leaning-weak with root (L2). Null otherwise. */
  weakSeasonPattern: WeakSeasonPattern;
  unresolvedStrengthReasons: UnresolvedStrengthReason[];
  omittedSlots: PillarSlot[];
};

export type ClimateTemperature = "cold" | "balanced" | "warm";
export type ClimateMoisture = "dry" | "balanced" | "moist";
export type ClimateElement = "火" | "水";
export type ClimateFactorRole = "mitigation" | "reinforcement" | "contextual";

export type BaseClimate = {
  temperature: ClimateTemperature;
  moisture: ClimateMoisture;
};

export type ClimateFactor = {
  element: ClimateElement;
  slot: PillarSlot;
  layer: ElementLayer;
  sourceStem?: Stem;
  sourceBranch?: Branch;
  role?: HiddenStemRole;
  presence: ElementPresenceKind;
  visible: boolean;
  hidden: boolean;
  temperatureRole: ClimateFactorRole;
  moistureRole: ClimateFactorRole;
};

export type ClimateEvidence = {
  monthBranch: Branch;
  baseClimate: BaseClimate;
  factors: ClimateFactor[];
  hourUnknown: boolean;
  includedSlots: PillarSlot[];
  omittedSlots: PillarSlot[];
};

export type ClimateCertainty = "complete" | "partial";
export type ClimateAxisStatus = "resolved" | "unresolved";
export type ClimateElementQuality = "clear" | "substantial" | "shallow" | "hidden" | "branch-only" | "absent";

/**
 * Qualitative mitigation path for one adjusted Climate axis.
 * Need must gate on `status === "resolved"` only — `value != null` does not mean resolved.
 * When `status === "unresolved"` and `value != null`, value is residual base polarity (not a final judgment).
 */
export type ClimateMitigationOutcome =
  | "unchanged"
  | "partially-mitigated"
  | "balanced"
  | "mitigation-reinforcement-conflict"
  | "unresolved";

export type AdjustedTemperatureAxis = {
  status: ClimateAxisStatus;
  value: ClimateTemperature | null;
  outcome: ClimateMitigationOutcome;
};

export type AdjustedMoistureAxis = {
  status: ClimateAxisStatus;
  value: ClimateMoisture | null;
  outcome: ClimateMitigationOutcome;
};

export type AdjustedClimateSummary = {
  certainty: ClimateCertainty;
  baseClimate: BaseClimate;
  temperature: AdjustedTemperatureAxis;
  moisture: AdjustedMoistureAxis;
  fireQuality: ClimateElementQuality;
  waterQuality: ClimateElementQuality;
  mitigationFactors: ClimateFactor[];
  reinforcementFactors: ClimateFactor[];
  conflicts: string[];
  unresolvedReasons: string[];
  omittedSlots: PillarSlot[];
};

export type NeedSource = "strength" | "climate";
export type NeedCandidateStatus = "candidate" | "suppressed";
export type NeedDirection = "peer" | "resource" | "output" | "wealth" | "official" | "climate";
export type StrengthNeedStatus = "ready" | "unresolved";
export type ClimateNeedStatus = "ready" | "axis-unresolved" | "unresolved";

/** Literature/product boundary inherited onto a Need candidate (e.g. NEED-022 dry). */
export type NeedCandidateBoundary = null | "contested-inherited";

export type NeedCandidate = {
  element: Element;
  source: NeedSource;
  reasons: string[];
  direction: NeedDirection;
  existingPresence: ElementPresenceKind;
  alreadyPresent: boolean;
  certainty: StrengthCertainty | ClimateCertainty;
  status: NeedCandidateStatus;
  evidenceRefs: string[];
  /** Contested climate paths only; Strength and warm/cold-only stay null. */
  boundary: NeedCandidateBoundary;
};

export type ClimateCounterSignal = {
  element: Element;
  reason: string;
  evidenceRefs: string[];
};

export type NeedCandidateSet = {
  strengthNeedCandidates: NeedCandidate[];
  climateNeedCandidates: NeedCandidate[];
  climateCounterSignals: ClimateCounterSignal[];
  strengthNeedStatus: StrengthNeedStatus;
  climateNeedStatus: ClimateNeedStatus;
};

export type NeedRelationPattern =
  | "no-candidates"
  | "strength-only"
  | "climate-only"
  | "exact-overlap"
  | "partial-overlap"
  | "disjoint";

export type NeedResolutionStatus = "convergent" | "single-axis" | "competing" | "indeterminate";

export type NeedPolicyGap = "mixed-strength-resolution" | "unresolved-strength-direction";

export type NeedDecisionBlocker =
  | "strength-axis-unresolved"
  | "climate-axis-unresolved"
  | "no-active-climate-need"
  | "deferred-strength-only-element"
  | "competing-axes"
  | "strength-three-way-unranked"
  | "climate-need-contested-inherited";

export type NeedSupportedElement = {
  element: Element;
  supports: NeedCandidate[];
};

export type NeedCompetingElementsByAxis = {
  strength: NeedCandidate[];
  climate: NeedCandidate[];
};

export type NeedCounterSignal = {
  element: Element;
  source: NeedSource;
  reason: string;
};

export type NeedElementState = {
  element: Element;
  existingPresence: ElementPresenceKind;
  alreadyPresent: boolean;
};

export type NeedResolutionCertainty = {
  strength: StrengthCertainty;
  climate: ClimateCertainty;
};

export type NeedResolution = {
  status: NeedResolutionStatus;
  relationPattern: NeedRelationPattern;
  supportedElements: NeedSupportedElement[];
  singleAxisElements: NeedCandidate[];
  strengthOnlyElements: NeedCandidate[];
  climateOnlyElements: NeedCandidate[];
  competingElementsByAxis: NeedCompetingElementsByAxis;
  deferredElements: NeedCandidate[];
  suppressedSharedElements: Element[];
  counterSignals: NeedCounterSignal[];
  elementStates: NeedElementState[];
  strengthAxisStatus: StrengthNeedStatus;
  climateAxisStatus: ClimateNeedStatus;
  certainty: NeedResolutionCertainty;
  policyGaps: NeedPolicyGap[];
  decisionBlockedBy: NeedDecisionBlocker[];
  reasons: string[];
  originalStrengthCandidates: NeedCandidate[];
  originalClimateCandidates: NeedCandidate[];
};
