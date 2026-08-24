import type {
  AdjustedClimateSummary,
  BirthInput,
  Branch,
  BranchRelationItem,
  CalendarKind,
  ClimateEvidence,
  ClimateFactor,
  DayBoundary,
  Element,
  ElementMaterialItem,
  ElementPresenceAnalysis,
  ElementPresenceKind,
  FourPillars,
  HiddenStemRole,
  HourCertainty,
  NeedCandidateSet,
  NeedRelationPattern,
  NeedResolution,
  RootHit,
  RootQuality,
  SeasonPhaseLabel,
  SolarInstant,
  SolarTermName,
  Stem,
  StrengthEvidence,
  StrengthSummary,
  TimezoneId,
} from "@/lib/saju/types";

export type ValidationPillarRecord = {
  stem: Stem;
  branch: Branch;
  ganzhi: string;
  ganzhiKo: string;
};

export type ValidationHourRecord =
  | (ValidationPillarRecord & { known: true })
  | { known: false; hour: "unknown" };

export type SolarTermNeighbor = {
  name: SolarTermName;
  monthBranch: Branch;
  startedAt: SolarInstant;
};

export type SolarTermContext = {
  lichun: SolarInstant;
  lichunRelation: "before" | "on-or-after";
  currentJie: SolarTermNeighbor;
  previousJie: SolarTermNeighbor | null;
  nextJie: SolarTermNeighbor | null;
  monthBranchBasis: string;
  monthStemBasis: string;
};

export type DayPillarContext = {
  epochDate: { year: number; month: number; day: number };
  epochGanzhi: string;
  epochGanzhiIndex: number;
  civilDayOffset: number;
  dayBoundary: DayBoundary;
  inputCivilDate: { year: number; month: number; day: number };
  dateUsedForDayPillar: { year: number; month: number; day: number };
  inputDateDiffersFromDayPillarDate: boolean;
};

export type HourPillarContext =
  | {
      known: true;
      appliedHour: number | null;
      hourBranch: Branch;
      dayStem: Stem;
      ziHourStem: Stem;
      method: "오자시법";
    }
  | {
      known: false;
      hour: "unknown";
      hourCandidatesAutoSelected: false;
    };

export type ValidationRawInput = {
  calendarType: CalendarKind;
  year: number;
  month: number;
  day: number;
  hour: number | null;
  minute: number | null;
  timeUnknown: boolean;
  dayBoundary: DayBoundary | null;
  timezone: TimezoneId | null;
  leapMonth: boolean;
};

export type NormalizedBirthInput = {
  solarDate: { year: number; month: number; day: number };
  effectiveHour: { hour: number; minute: number } | null;
  hourKnown: boolean;
  appliedDayBoundary: DayBoundary;
  appliedTimezone: TimezoneId;
};

export type HiddenRelationValidationItem = BranchRelationItem & {
  elementPresence: ElementPresenceKind;
  overlapsRoot: boolean;
};

export type VisibleRelationValidationItem = StrengthEvidence["supportEvidence"]["items"][number] & {
  relationSide: "support" | "pressure";
  element: Element;
};

export type RootHitValidationItem = RootHit & {
  hiddenRole: HiddenStemRole;
  sourceKey: string;
};

export type ClimateEvidenceValidation = ClimateEvidence & {
  fireQualityMaterials: ClimateFactor[];
  waterQualityMaterials: ClimateFactor[];
};

/** 검증 종류를 한 "검증 완료"로 합치지 않는다. 자동으로 expert-reviewed를 붙이지 않는다. */
export type ValidationKind = "astronomical-calendar" | "rule-table" | "interpretive";

export const VALIDATION_KIND_SCOPES: Record<ValidationKind, readonly string[]> = {
  "astronomical-calendar": ["solar-terms", "lunar-solar", "day-pillar", "year-pillar", "month-pillar", "day-boundary"],
  "rule-table": ["hidden-stems", "shi-shen", "elements", "season-phases", "root-definition"],
  interpretive: ["strength-summary", "adjusted-climate", "need-candidates", "need-resolution"],
};

export type ValidationStatus = {
  fourPillarsComputed: boolean;
  strengthResolved: boolean;
  climateResolved: boolean;
  strengthCandidateAvailable: boolean;
  climateCandidateAvailable: boolean;
  relationPattern: NeedRelationPattern;
  finalDecisionBlocked: boolean;
};

export type SajuValidationReport = {
  input: ValidationRawInput | null;
  birthInput: BirthInput | null;
  normalizedInput: NormalizedBirthInput | null;
  pillars: {
    year: ValidationPillarRecord;
    month: ValidationPillarRecord;
    day: ValidationPillarRecord;
    hour: ValidationHourRecord;
    hourCertainty: HourCertainty;
  };
  solarTermContext: SolarTermContext | null;
  dayPillarContext: DayPillarContext | null;
  hourPillarContext: HourPillarContext;
  elementMaterials: {
    hourUnknown: boolean;
    dayStem: Stem;
    items: ElementMaterialItem[];
  };
  seasonEvidence: SeasonPhaseLabel & { dayStem: Stem; dayElement: Element };
  rootEvidence: {
    hits: RootHitValidationItem[];
    rootQuality: RootQuality;
  };
  presence: Record<Element, ElementPresenceAnalysis>;
  visibleRelations: {
    support: VisibleRelationValidationItem[];
    pressure: VisibleRelationValidationItem[];
  };
  hiddenRelations: HiddenRelationValidationItem[];
  strengthSummary: StrengthSummary;
  climateEvidence: ClimateEvidenceValidation;
  adjustedClimate: AdjustedClimateSummary;
  needCandidates: NeedCandidateSet;
  needResolution: NeedResolution;
  validationStatus: ValidationStatus;
  warnings: string[];
};

export type BlindSourceType = "expert-blind" | "external-calendar" | "rule-table" | "other";

export type BlindCaseStatus =
  | "unreviewed"
  | "engine-run"
  | "expert-reviewed"
  | "compared"
  | "regression";

export type ExpertReviewConfidence = "high" | "medium" | "low";

export type ExpertConfirmedPillars = {
  year: string | null;
  month: string | null;
  day: string | null;
  hour: string | null;
};

/** 전문가 자신의 언어. 엔진 용어를 강요하지 않는다. 엔진 값으로 채우지 않는다. */
export type ExpertReview = {
  reviewerId: string | null;
  reviewDate: string | null;
  fourPillarsConfirmed: ExpertConfirmedPillars | null;
  dayMaster: string | null;
  monthCommand: string | null;
  rootAssessment: string | null;
  strengthAssessment: string | null;
  climateAssessment: string | null;
  candidateElements: string[];
  cannotDetermine: boolean;
  reasons: string[];
  comments: string;
  reviewConfidence: ExpertReviewConfidence | null;
};

export type BlindExpertReview = ExpertReview;

export type BlindValidationCase = {
  id: string;
  status: BlindCaseStatus;
  input: BirthInput | null;
  sourceType: BlindSourceType;
  sourceReference: string;
  expectedFourPillars: FourPillars | null;
  expertReview: ExpertReview;
  notes: string;
};

export type ValidationComparisonLayer =
  | "four-pillars"
  | "month-command"
  | "root"
  | "strength-direction"
  | "strength-mixed-or-ambiguous"
  | "climate-temperature"
  | "climate-moisture"
  | "need-candidates"
  | "decision-blocked";

export type ComparisonMatchStatus =
  | "match"
  | "partial-match"
  | "difference"
  | "expert-unresolved"
  | "engine-unresolved"
  | "not-comparable";

export type ValidationComparisonItem = {
  layer: ValidationComparisonLayer;
  status: ComparisonMatchStatus;
  engine: string;
  expert: string;
};

export type ValidationComparison = {
  caseId: string;
  engine: {
    relationPattern: NeedRelationPattern | null;
    strengthDirection: string | null;
    climateTemperature: string | null;
    climateMoisture: string | null;
    decisionBlockedBy: string[];
  };
  expert: ExpertReview;
  items: ValidationComparisonItem[];
  matches: ValidationComparisonItem[];
  differences: ValidationComparisonItem[];
  unresolved: ValidationComparisonLayer[];
  notes: string[];
};

/** Pilot 전문가 원문. 엔진 용어로 덮어쓰지 않는다. ExpertReview와 분리한다. */
export type PilotExpertRaw = {
  q1_fourPillars: string | null;
  q2_dayMaster: string | null;
  q3_monthCommand: string | null;
  q4_root: string | null;
  q5_strength: string | null;
  q6_strengthReasons: string | null;
  q7_climate: string | null;
  q8_climateNeed: string | null;
  q9_strengthNeedElements: string | null;
  q10_finalElement: string | null;
  expertStrengthRaw: string | null;
  expertClimateRaw: string | null;
  expertNeedRaw: string | null;
};

export type PilotStrengthMapping = "strong" | "weak" | "mixed" | "unresolved" | "not-comparable";
export type PilotClimateTemperatureMapping = "cold" | "balanced" | "warm" | "not-comparable";
export type PilotClimateMoistureMapping = "dry" | "balanced" | "moist" | "not-comparable";

/** 사람만 작성. 엔진이 자동 mapping하지 않는다. */
export type PilotExpertMapping = {
  mappedBy: string | null;
  mappingNotes: string | null;
  strength: PilotStrengthMapping | null;
  climateTemperature: PilotClimateTemperatureMapping | null;
  climateMoisture: PilotClimateMoistureMapping | null;
  needCandidates: string[];
  cannotDetermine: boolean | null;
};

export type PilotHourTarget = "confirmed" | "unknown";

export type PilotValidationCase = BlindValidationCase & {
  hourTarget: PilotHourTarget;
  inputSelectionHint: string;
  personName: null;
  expertRaw: PilotExpertRaw;
  mapping: PilotExpertMapping;
  comparison: ValidationComparison | null;
};
