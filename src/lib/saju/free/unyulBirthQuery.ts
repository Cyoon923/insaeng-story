import type { FreeSajuBirthFormInput } from "@/lib/saju/free/buildFreeSajuPillars";
import type { CalendarKind } from "@/lib/saju/types";

export type FreeSajuBirthQueryParseResult =
  | { ok: true; input: FreeSajuBirthFormInput }
  | { ok: false; error: string };

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseIntParam(raw: string | undefined, label: string): number | null {
  if (raw === undefined || raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isInteger(n)) {
    throw new Error(`${label}이(가) 올바르지 않아요.`);
  }
  return n;
}

/** Serialize free birth input for /unyul/result query (no PII storage). */
export function freeSajuBirthToQuery(input: FreeSajuBirthFormInput): string {
  const params = new URLSearchParams();
  params.set("calendar", input.calendar);
  params.set("y", String(input.year));
  params.set("m", String(input.month));
  params.set("d", String(input.day));
  if (input.calendar === "lunar" && input.isLeapMonth) {
    params.set("leap", "1");
  }
  if (input.timeUnknown) {
    params.set("unknown", "1");
  } else {
    params.set("h", String(input.hour ?? 0));
    params.set("min", String(input.minute ?? 0));
  }
  return params.toString();
}

/** Restore FreeSajuBirthFormInput from URL search params. */
export function freeSajuBirthFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): FreeSajuBirthQueryParseResult {
  try {
    const calendarRaw = first(searchParams.calendar);
    if (calendarRaw !== "solar" && calendarRaw !== "lunar") {
      return { ok: false, error: "양력/음력 정보가 없어요. 다시 입력해 주세요." };
    }
    const calendar = calendarRaw as CalendarKind;

    const year = parseIntParam(first(searchParams.y), "출생 연도");
    const month = parseIntParam(first(searchParams.m), "출생 월");
    const day = parseIntParam(first(searchParams.d), "출생 일");
    if (year === null || month === null || day === null) {
      return { ok: false, error: "생년월일 정보가 없어요. 다시 입력해 주세요." };
    }

    const timeUnknown = first(searchParams.unknown) === "1";
    const isLeapMonth = calendar === "lunar" && first(searchParams.leap) === "1";

    if (timeUnknown) {
      return {
        ok: true,
        input: { calendar, year, month, day, isLeapMonth, timeUnknown: true },
      };
    }

    const hour = parseIntParam(first(searchParams.h), "출생 시");
    const minute = parseIntParam(first(searchParams.min), "출생 분");
    if (hour === null || minute === null) {
      return { ok: false, error: "출생시간 정보가 없어요. 다시 입력해 주세요." };
    }

    return {
      ok: true,
      input: { calendar, year, month, day, isLeapMonth, timeUnknown: false, hour, minute },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "입력 정보를 읽지 못했어요. 다시 입력해 주세요.",
    };
  }
}
