import { validateBirthInput } from "@/lib/saju/calendar/validate";
import { buildSajuValidationReport } from "@/lib/saju/validation/report";
import type { BirthInput, DayBoundary, Pillar, SolarInstant } from "@/lib/saju/types";
import type { SajuValidationReport } from "@/lib/saju/validation/types";

export type CalculationMatchStatus = "match" | "difference" | "not-checked";

export type CalculationPillarExpected = {
  stem: string;
  branch: string;
};

export type CalculationSourceReference = {
  publisher: string;
  documentId: string | null;
  url?: string;
  note: string;
};

export type CalculationPolicyOutcome = {
  dayPillar?: CalculationPillarExpected | null;
  hourPillar?: CalculationPillarExpected | null;
};

export type CalculationExpected = {
  solarDate?: { year: number; month: number; day: number } | null;
  yearPillar?: CalculationPillarExpected | null;
  monthPillar?: CalculationPillarExpected | null;
  dayPillar?: CalculationPillarExpected | null;
  hourPillar?: CalculationPillarExpected | "unknown" | null;
  appliedJie?: string | null;
  accepted?: boolean;
  policyOutcomes?: {
    night_ja?: CalculationPolicyOutcome;
    early_ja?: CalculationPolicyOutcome;
  } | null;
};

export type CalculationCase = {
  id: string;
  status: string;
  group: string;
  topic: string;
  input: BirthInput | null;
  sourceReference: CalculationSourceReference;
  directOfficial?: boolean;
  officialTermInstant?: SolarInstant | null;
  historicalTimeWarningExpected?: boolean;
  expectRejection?: { messageIncludes: string } | null;
  expected: CalculationExpected;
};

export type CalculationFieldResult = {
  status: CalculationMatchStatus;
  expected: unknown;
  actual: unknown;
};

export type CalculationCompareResult = {
  caseId: string;
  sourceReference: CalculationSourceReference;
  fields: Record<string, CalculationFieldResult>;
  differenceType: string[];
};

function pillarActual(report: SajuValidationReport, slot: "year" | "month" | "day") {
  return { stem: report.pillars[slot].stem, branch: report.pillars[slot].branch };
}

function hourActual(report: SajuValidationReport) {
  const hour = report.pillars.hour;
  if (!hour.known) return "unknown";
  return { stem: hour.stem, branch: hour.branch };
}

function samePillar(expected: CalculationPillarExpected | null | undefined, actual: { stem: string; branch: string } | "unknown") {
  if (!expected) return true;
  if (actual === "unknown") return false;
  return expected.stem === actual.stem && expected.branch === actual.branch;
}

function compareValue(expected: unknown, actual: unknown): CalculationMatchStatus {
  if (expected === undefined || expected === null) return "not-checked";
  return JSON.stringify(expected) === JSON.stringify(actual) ? "match" : "difference";
}

function addField(
  fields: Record<string, CalculationFieldResult>,
  name: string,
  expected: unknown,
  actual: unknown,
) {
  fields[name] = { status: compareValue(expected, actual), expected, actual };
}

function reportFor(input: BirthInput, dayBoundary?: DayBoundary): SajuValidationReport {
  return buildSajuValidationReport({
    ...input,
    dayBoundary: dayBoundary ?? input.dayBoundary,
  });
}

export function compareCalculationCase(item: CalculationCase): CalculationCompareResult {
  const fields: Record<string, CalculationFieldResult> = {};

  if (item.expectRejection) {
    let actual: string | null = null;
    try {
      if (item.input) validateBirthInput(item.input);
      actual = "accepted";
    } catch (error) {
      actual = error instanceof Error ? error.message : String(error);
    }
    const matched = typeof actual === "string" && actual.includes(item.expectRejection.messageIncludes);
    fields.rejection = {
      status: matched ? "match" : "difference",
      expected: item.expectRejection.messageIncludes,
      actual,
    };
    const differenceType = Object.entries(fields)
      .filter(([, value]) => value.status === "difference")
      .map(([name]) => name);
    return { caseId: item.id, sourceReference: item.sourceReference, fields, differenceType };
  }

  if (!item.input) {
    fields.input = { status: "difference", expected: "BirthInput", actual: null };
    return { caseId: item.id, sourceReference: item.sourceReference, fields, differenceType: ["input"] };
  }

  let report: SajuValidationReport;
  try {
    report = reportFor(item.input);
  } catch (error) {
    fields.accepted = {
      status: item.expected.accepted === true ? "difference" : "not-checked",
      expected: item.expected.accepted ?? null,
      actual: error instanceof Error ? error.message : String(error),
    };
    const differenceType = Object.entries(fields)
      .filter(([, value]) => value.status === "difference")
      .map(([name]) => name);
    return { caseId: item.id, sourceReference: item.sourceReference, fields, differenceType };
  }

  if (item.expected.accepted === true) {
    fields.accepted = { status: "match", expected: true, actual: true };
  }

  const expected = item.expected;

  addField(
    fields,
    "solarDate",
    expected.solarDate ?? null,
    report.normalizedInput?.solarDate ?? null,
  );
  addField(fields, "yearPillar", expected.yearPillar ?? null, pillarActual(report, "year"));
  addField(fields, "monthPillar", expected.monthPillar ?? null, pillarActual(report, "month"));
  addField(fields, "dayPillar", expected.dayPillar ?? null, pillarActual(report, "day"));
  addField(fields, "hourPillar", expected.hourPillar ?? null, hourActual(report));
  addField(
    fields,
    "appliedJie",
    expected.appliedJie ?? null,
    report.solarTermContext?.currentJie.name ?? null,
  );

  if (item.historicalTimeWarningExpected) {
    const hasWarning = report.warnings.some((text) => text.includes("서머타임"));
    fields.historicalTimeWarning = {
      status: hasWarning ? "match" : "difference",
      expected: true,
      actual: hasWarning,
    };
  }

  const policies = expected.policyOutcomes;
  if (policies) {
    for (const policy of ["night_ja", "early_ja"] as const) {
      const outcome = policies[policy];
      if (!outcome) continue;
      const policyReport = reportFor(item.input, policy);
      addField(
        fields,
        `${policy}.dayPillar`,
        outcome.dayPillar ?? null,
        pillarActual(policyReport, "day"),
      );
      addField(
        fields,
        `${policy}.hourPillar`,
        outcome.hourPillar ?? null,
        hourActual(policyReport),
      );
    }
  }

  const differenceType = Object.entries(fields)
    .filter(([, value]) => value.status === "difference")
    .map(([name]) => name);

  return { caseId: item.id, sourceReference: item.sourceReference, fields, differenceType };
}

export function samePillarForTests(expected: CalculationPillarExpected, actual: Pillar) {
  return samePillar(expected, actual);
}
