import { JIE_TERMS } from "@/lib/saju/data/solarTerms";
import { stemElement } from "@/lib/saju/constants/elements";
import {
  MONTH_BRANCHES_FROM_YIN,
  YIN_MONTH_STEM_BY_YEAR_STEM,
  ZI_HOUR_STEM_BY_DAY_STEM,
  ganzhiByIndex,
  pillarLabel,
} from "@/lib/saju/constants/ganzhi";
import { compareKst, jieTermAt, julianFromKst, lichunInstant, solarTermInstant } from "@/lib/saju/calendar/solarTerms";
import { toSolarInstant } from "@/lib/saju/calendar/toSolar";
import {
  ELEMENTS,
  type BirthInput,
  type FourPillars,
  type MonthBranch,
  type Pillar,
  type SolarInstant,
  type StrengthEvidence,
} from "@/lib/saju/types";
import { collectElementMaterials } from "@/lib/saju/elements/materials";
import { analyzeElementPresence } from "@/lib/saju/elements/presence";
import { labelStemSeasonPhase } from "@/lib/saju/elements/season";
import { collectStrengthEvidence, hiddenStemSourceKey } from "@/lib/saju/elements/strength";
import { buildStrengthSummary } from "@/lib/saju/elements/strengthSummary";
import { collectClimateEvidence } from "@/lib/saju/elements/climate";
import { buildAdjustedClimateSummary } from "@/lib/saju/elements/adjustedClimate";
import { buildNeedCandidateSet } from "@/lib/saju/elements/needCandidates";
import { buildNeedResolution } from "@/lib/saju/elements/needResolution";
import { buildFourPillars } from "@/lib/saju/pillars/build";
import { civilDayOffset, DAY_PILLAR_EPOCH, dayDateForPillar } from "@/lib/saju/pillars/day";
import { yearGanzhiYear } from "@/lib/saju/pillars/year";
import type {
  HourPillarContext,
  SajuValidationReport,
  SolarTermContext,
  SolarTermNeighbor,
  ValidationHourRecord,
  ValidationPillarRecord,
  ValidationRawInput,
  VisibleRelationValidationItem,
} from "@/lib/saju/validation/types";

function pillarRecord(pillar: Pillar): ValidationPillarRecord {
  return {
    stem: pillar.stem,
    branch: pillar.branch,
    ganzhi: `${pillar.stem}${pillar.branch}`,
    ganzhiKo: pillarLabel(pillar.stem, pillar.branch),
  };
}

function hourRecord(hour: FourPillars["hour"]): ValidationHourRecord {
  if (hour === "unknown") return { known: false, hour: "unknown" };
  return { known: true, ...pillarRecord(hour) };
}

function rawInputOf(input: BirthInput): ValidationRawInput {
  const timeUnknown = input.time === "unknown";
  return {
    calendarType: input.calendar,
    year: input.year,
    month: input.month,
    day: input.day,
    hour: input.time === "unknown" ? null : input.time.hour,
    minute: input.time === "unknown" ? null : input.time.minute,
    timeUnknown,
    dayBoundary: input.dayBoundary ?? null,
    timezone: input.timezone ?? null,
    leapMonth: input.isLeapMonth,
  };
}

function visibleRelation(
  item:
    | StrengthEvidence["supportEvidence"]["items"][number]
    | StrengthEvidence["pressureEvidence"]["items"][number],
  relationSide: "support" | "pressure",
): VisibleRelationValidationItem {
  return {
    ...item,
    relationSide,
    element: stemElement(item.stem),
  };
}

function jieNeighborList(year: number): SolarTermNeighbor[] {
  const items: Array<SolarTermNeighbor & { jd: number }> = [];
  for (const offsetYear of [year - 1, year, year + 1]) {
    for (const term of JIE_TERMS) {
      if (!term.monthBranch) continue;
      const startedAt = solarTermInstant(offsetYear, term.name);
      items.push({
        name: term.name,
        monthBranch: term.monthBranch,
        startedAt,
        jd: julianFromKst(startedAt),
      });
    }
  }
  items.sort((a, b) => a.jd - b.jd);
  return items.map(({ jd: _jd, ...item }) => item);
}

function solarTermContextOf(instant: SolarInstant): SolarTermContext {
  const lichun = lichunInstant(instant.year);
  const current = jieTermAt(instant);
  const neighbors = jieNeighborList(instant.year);
  const currentJd = julianFromKst(current.startedAt);
  const index = neighbors.findIndex(
    (item) => julianFromKst(item.startedAt) === currentJd && item.name === current.name,
  );
  const yearStem = ganzhiByIndex(yearGanzhiYear(instant) - 4).stem;
  const yinStem = YIN_MONTH_STEM_BY_YEAR_STEM[yearStem];
  const monthIndex = MONTH_BRANCHES_FROM_YIN.indexOf(current.monthBranch as MonthBranch);

  return {
    lichun,
    lichunRelation: compareKst(instant, lichun) < 0 ? "before" : "on-or-after",
    currentJie: {
      name: current.name,
      monthBranch: current.monthBranch,
      startedAt: current.startedAt,
    },
    previousJie: index > 0 ? (neighbors[index - 1] ?? null) : null,
    nextJie: index >= 0 ? (neighbors[index + 1] ?? null) : null,
    monthBranchBasis: `최신 12절 ${current.name}(${current.monthBranch}) 절입 ${current.startedAt.year}-${current.startedAt.month}-${current.startedAt.day} ${String(current.startedAt.hour).padStart(2, "0")}:${String(current.startedAt.minute).padStart(2, "0")} KST`,
    monthStemBasis: `연간 ${yearStem} → 인월간 ${yinStem}, ${current.monthBranch}는 인월부터 ${monthIndex}번째`,
  };
}

function hourContextOf(pillars: FourPillars, instant: SolarInstant | null): HourPillarContext {
  if (pillars.hour === "unknown" || pillars.hourCertainty === "unknown") {
    return { known: false, hour: "unknown", hourCandidatesAutoSelected: false };
  }
  return {
    known: true,
    appliedHour: instant ? instant.hour : null,
    hourBranch: pillars.hour.branch,
    dayStem: pillars.day.stem,
    ziHourStem: ZI_HOUR_STEM_BY_DAY_STEM[pillars.day.stem],
    method: "오자시법",
  };
}

function collectWarnings(input: BirthInput | null, pillars: FourPillars): string[] {
  const warnings = [...pillars.warnings];
  if (pillars.dayBoundaryNote) warnings.push(pillars.dayBoundaryNote);
  if (pillars.hourCertainty === "unknown") {
    warnings.push("시간 미상: 시주를 후보로 채우지 않음");
  }
  if (input) {
    warnings.push(`timezone=${input.timezone ?? "Asia/Seoul"} (KST 표준시). 진태양시는 반영하지 않음.`);
  }
  return warnings;
}

export function buildSajuValidationReportFromPillars(
  pillars: FourPillars,
  input: BirthInput | null = null,
): SajuValidationReport {
  const instant = input ? toSolarInstant(input) : null;
  const dayBoundary = input?.dayBoundary ?? "night_ja";
  const materials = collectElementMaterials(pillars);
  const strength = collectStrengthEvidence(pillars);
  const strengthSummary = buildStrengthSummary(pillars);
  const climateEvidence = collectClimateEvidence(pillars);
  const adjustedClimate = buildAdjustedClimateSummary(pillars);
  const needCandidates = buildNeedCandidateSet(pillars);
  const needResolution = buildNeedResolution(pillars);
  const rootKeys = new Set(
    strength.rootEvidence.hits.map((hit) => hiddenStemSourceKey(hit.slot, hit.branch, hit.hiddenStem, hit.role)),
  );

  const presence = Object.fromEntries(
    ELEMENTS.map((element) => [element, analyzeElementPresence(pillars, element)]),
  ) as SajuValidationReport["presence"];

  const season = labelStemSeasonPhase(pillars.day.stem, pillars.month.branch);

  return {
    input: input ? rawInputOf(input) : null,
    birthInput: input,
    normalizedInput: instant
      ? {
          solarDate: { year: instant.year, month: instant.month, day: instant.day },
          effectiveHour:
            input?.time === "unknown"
              ? null
              : { hour: instant.hour, minute: instant.minute },
          hourKnown: input?.time !== "unknown",
          appliedDayBoundary: dayBoundary,
          appliedTimezone: input?.timezone ?? "Asia/Seoul",
        }
      : null,
    pillars: {
      year: pillarRecord(pillars.year),
      month: pillarRecord(pillars.month),
      day: pillarRecord(pillars.day),
      hour: hourRecord(pillars.hour),
      hourCertainty: pillars.hourCertainty,
    },
    solarTermContext: instant ? solarTermContextOf(instant) : null,
    dayPillarContext: instant
      ? (() => {
          const dateUsed = dayDateForPillar(instant, dayBoundary, input?.time === "unknown");
          const inputCivilDate = { year: instant.year, month: instant.month, day: instant.day };
          const epochGanzhi = ganzhiByIndex(DAY_PILLAR_EPOCH.ganzhiIndex);
          return {
            epochDate: {
              year: DAY_PILLAR_EPOCH.year,
              month: DAY_PILLAR_EPOCH.month,
              day: DAY_PILLAR_EPOCH.day,
            },
            epochGanzhi: `${epochGanzhi.stem}${epochGanzhi.branch}`,
            epochGanzhiIndex: DAY_PILLAR_EPOCH.ganzhiIndex,
            civilDayOffset: civilDayOffset(dateUsed.year, dateUsed.month, dateUsed.day),
            dayBoundary,
            inputCivilDate,
            dateUsedForDayPillar: dateUsed,
            inputDateDiffersFromDayPillarDate:
              inputCivilDate.year !== dateUsed.year ||
              inputCivilDate.month !== dateUsed.month ||
              inputCivilDate.day !== dateUsed.day,
          };
        })()
      : null,
    hourPillarContext: hourContextOf(pillars, instant),
    elementMaterials: {
      hourUnknown: materials.hourUnknown,
      dayStem: materials.dayStem,
      items: materials.items,
    },
    seasonEvidence: {
      ...season,
      dayStem: pillars.day.stem,
      dayElement: stemElement(pillars.day.stem),
    },
    rootEvidence: {
      hits: strength.rootEvidence.hits.map((hit) => ({
        ...hit,
        hiddenRole: hit.role,
        sourceKey: hiddenStemSourceKey(hit.slot, hit.branch, hit.hiddenStem, hit.role),
      })),
      rootQuality: strengthSummary.rootQuality,
    },
    presence,
    visibleRelations: {
      support: strength.supportEvidence.items.map((item) => visibleRelation(item, "support")),
      pressure: strength.pressureEvidence.items.map((item) => visibleRelation(item, "pressure")),
    },
    hiddenRelations: strength.branchRelationEvidence.items.map((item) => ({
      ...item,
      elementPresence: item.presence,
      overlapsRoot: rootKeys.has(item.sourceKey),
    })),
    strengthSummary,
    climateEvidence: {
      ...climateEvidence,
      fireQualityMaterials: climateEvidence.factors.filter((factor) => factor.element === "火"),
      waterQualityMaterials: climateEvidence.factors.filter((factor) => factor.element === "水"),
    },
    adjustedClimate,
    needCandidates,
    needResolution,
    validationStatus: {
      fourPillarsComputed: true,
      strengthResolved: strengthSummary.resolution === "clear-direction",
      climateResolved:
        adjustedClimate.temperature.status === "resolved" && adjustedClimate.moisture.status === "resolved",
      strengthCandidateAvailable: needCandidates.strengthNeedCandidates.some((item) => item.status === "candidate"),
      climateCandidateAvailable: needCandidates.climateNeedCandidates.some((item) => item.status === "candidate"),
      relationPattern: needResolution.relationPattern,
      finalDecisionBlocked: needResolution.decisionBlockedBy.length > 0,
    },
    warnings: collectWarnings(input, pillars),
  };
}

export function buildSajuValidationReport(input: BirthInput): SajuValidationReport {
  return buildSajuValidationReportFromPillars(buildFourPillars(input), input);
}
