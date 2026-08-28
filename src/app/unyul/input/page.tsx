"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, ChevronLeft } from "lucide-react";
import { buildFreeSajuPillars } from "@/lib/saju/free/buildFreeSajuPillars";
import type { FreeSajuBirthFormInput } from "@/lib/saju/free/buildFreeSajuPillars";
import {
  freeSajuBirthFromSearchParams,
  freeSajuBirthToQuery,
} from "@/lib/saju/free/unyulBirthQuery";
import type { CalendarKind } from "@/lib/saju/types";

const inputClass =
  "h-14 w-full rounded-2xl border border-[#E5E2DA] bg-white px-4 text-[17px] text-[#252823] outline-none focus:border-[#B9A8C9]";

const timeSelectClass =
  "h-[68px] w-full appearance-none rounded-2xl border border-[#E5E2DA] bg-white px-2 text-center text-[22px] font-semibold leading-none text-[#252823] outline-none focus:border-[#B9A8C9] disabled:opacity-50";

/** Digits only → YYYY-MM-DD display (no manual hyphen needed). */
function formatBirthDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

function birthDateDisplay(input: FreeSajuBirthFormInput): string {
  return formatBirthDigits(
    `${input.year}${String(input.month).padStart(2, "0")}${String(input.day).padStart(2, "0")}`,
  );
}

function readPrefillFromSearchParams(
  searchParams: URLSearchParams,
): FreeSajuBirthFormInput | null {
  const parsed = freeSajuBirthFromSearchParams(
    Object.fromEntries(searchParams.entries()),
  );
  if (!parsed.ok) return null;
  return parsed.input;
}

/** Explicit back target — never history.back(). */
function resolveInputBackHref(searchParams: URLSearchParams): string {
  if (searchParams.get("from") !== "basic-info") return "/";
  const prefill = readPrefillFromSearchParams(searchParams);
  if (prefill) return `/unyul/basic-info?${freeSajuBirthToQuery(prefill)}`;
  return "/unyul/basic-info";
}

function easyEngineError(message: string): string {
  if (message.includes("범위")) return "입력하신 연도는 아직 계산할 수 없어요. 다른 날짜를 확인해 주세요.";
  if (message.includes("윤달")) return "선택하신 해에는 그 윤달이 없어요. 윤달 여부를 다시 확인해 주세요.";
  if (message.includes("음력")) return "없는 음력 날짜예요. 생년월일을 다시 확인해 주세요.";
  if (message.includes("양력")) return "없는 양력 날짜예요. 생년월일을 다시 확인해 주세요.";
  if (message.includes("시") || message.includes("분")) return "출생시간을 다시 확인해 주세요.";
  if (message.includes("출생시간")) return message;
  return "입력 내용을 다시 확인해 주세요.";
}

function UnyulInputForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefill = useMemo(
    () => readPrefillFromSearchParams(searchParams),
    [searchParams],
  );

  const datePickerRef = useRef<HTMLInputElement>(null);
  const [calendar, setCalendar] = useState<CalendarKind>(
    () => prefill?.calendar ?? "solar",
  );
  const [birth, setBirth] = useState(() => (prefill ? birthDateDisplay(prefill) : ""));
  const [isLeapMonth, setIsLeapMonth] = useState(
    () => Boolean(prefill?.calendar === "lunar" && prefill.isLeapMonth),
  );
  const [timeUnknown, setTimeUnknown] = useState(() => Boolean(prefill?.timeUnknown));
  const [hour, setHour] = useState(() =>
    prefill && !prefill.timeUnknown && prefill.hour !== undefined
      ? String(prefill.hour)
      : "",
  );
  const [minute, setMinute] = useState(() =>
    prefill && !prefill.timeUnknown && prefill.minute !== undefined
      ? String(prefill.minute)
      : "",
  );
  const [error, setError] = useState<string | null>(null);

  const hours = useMemo(
    () => Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")),
    [],
  );
  const minutes = useMemo(
    () => Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")),
    [],
  );

  const pickerValue = /^\d{4}-\d{2}-\d{2}$/.test(birth) ? birth : "";

  const openDatePicker = () => {
    const el = datePickerRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
        return;
      } catch {
        // fall through to click()
      }
    }
    el.click();
  };

  const onSubmit = () => {
    setError(null);

    const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(birth.trim());
    if (!match) {
      setError("생년월일은 1990-01-15 형식으로 입력해 주세요.");
      return;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    if (!timeUnknown && (hour === "" || minute === "")) {
      setError("출생시간을 선택하거나, '태어난 시간을 몰라요'를 체크해 주세요.");
      return;
    }

    const input: FreeSajuBirthFormInput = {
      calendar,
      year,
      month,
      day,
      isLeapMonth: calendar === "lunar" ? isLeapMonth : false,
      timeUnknown,
      ...(timeUnknown
        ? {}
        : { hour: Number(hour), minute: Number(minute) }),
    };

    try {
      buildFreeSajuPillars(input);
    } catch (err) {
      setError(easyEngineError(err instanceof Error ? err.message : "입력 오류"));
      return;
    }

    router.push(`/unyul?${freeSajuBirthToQuery(input)}`);
  };

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#FAF8F3] shadow-xl">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-[#E5E2DA] bg-[#FAF8F3]/90 px-3 backdrop-blur">
        <button
          type="button"
          aria-label="뒤로가기"
          onClick={() => router.push(resolveInputBackHref(searchParams))}
          className="flex h-11 w-11 items-center justify-center rounded-full text-[#252823]"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="font-serif text-[20px] font-bold text-[#5D4A72]">운율</h1>
      </header>

      <div className="px-5 pb-10 pt-6">
        <h2 className="text-[24px] font-bold leading-snug text-[#5D4A72]">
          생년월일을
          <br />
          알려주세요
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#777A73]">
          간단한 정보만으로 오늘의 흐름을 살펴볼게요.
        </p>

        <div className="mt-8 space-y-6">
          <div>
            <p className="mb-2 text-[16px] font-semibold text-[#252823]">양력 / 음력</p>
            <div className="grid grid-cols-2 gap-3">
              <Choice
                active={calendar === "solar"}
                label="양력"
                onClick={() => {
                  setCalendar("solar");
                  setIsLeapMonth(false);
                }}
              />
              <Choice
                active={calendar === "lunar"}
                label="음력"
                onClick={() => setCalendar("lunar")}
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[16px] font-semibold text-[#252823]" htmlFor="unyul-birth">
              생년월일
            </label>
            <div className="relative">
              <input
                id="unyul-birth"
                type="text"
                inputMode="numeric"
                autoComplete="bday"
                placeholder="예) 19900115"
                value={birth}
                onChange={(e) => setBirth(formatBirthDigits(e.target.value))}
                className={`${inputClass} pr-14`}
              />
              <button
                type="button"
                onClick={openDatePicker}
                aria-label="달력에서 날짜 선택"
                className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-[#777A73]"
              >
                <Calendar className="h-5 w-5" strokeWidth={1.75} />
              </button>
              <input
                ref={datePickerRef}
                type="date"
                value={pickerValue}
                onChange={(e) => {
                  const next = e.target.value;
                  if (next) setBirth(formatBirthDigits(next));
                }}
                tabIndex={-1}
                aria-hidden
                className="pointer-events-none absolute h-0 w-0 opacity-0"
              />
            </div>
          </div>

          {calendar === "lunar" ? (
            <label className="flex items-center gap-3 text-[16px] text-[#252823]">
              <input
                type="checkbox"
                checked={isLeapMonth}
                onChange={(e) => setIsLeapMonth(e.target.checked)}
                className="h-6 w-6 accent-[#66527C]"
              />
              윤달이에요
            </label>
          ) : null}

          <div>
            <p className="mb-2 text-[16px] font-semibold text-[#252823]">태어난 시간</p>
            <div className="flex items-center gap-3">
              <select
                className={timeSelectClass}
                disabled={timeUnknown}
                value={hour}
                onChange={(e) => setHour(e.target.value)}
                aria-label="시 선택"
              >
                <option value="">시</option>
                {hours.map((h, i) => (
                  <option key={h} value={String(i)}>
                    {h}
                  </option>
                ))}
              </select>
              <span className="shrink-0 text-[24px] font-semibold text-[#5D4A72]" aria-hidden>
                :
              </span>
              <select
                className={timeSelectClass}
                disabled={timeUnknown}
                value={minute}
                onChange={(e) => setMinute(e.target.value)}
                aria-label="분 선택"
              >
                <option value="">분</option>
                {minutes.map((m) => (
                  <option key={m} value={String(Number(m))}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <label className="mt-4 flex items-center gap-3 text-[16px] text-[#252823]">
              <input
                type="checkbox"
                checked={timeUnknown}
                onChange={(e) => {
                  setTimeUnknown(e.target.checked);
                  if (e.target.checked) {
                    setHour("");
                    setMinute("");
                  }
                }}
                className="h-6 w-6 accent-[#66527C]"
              />
              태어난 시간을 몰라요
            </label>
          </div>
        </div>

        {error ? (
          <p
            className="mt-5 rounded-2xl border border-[#E5E2DA] bg-white px-4 py-3 text-[15px] leading-relaxed text-[#252823]"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={onSubmit}
          className="mt-8 h-14 w-full rounded-2xl bg-[#66527C] text-[18px] font-bold text-white"
        >
          결과 보기
        </button>
      </div>
    </div>
  );
}

export default function UnyulInputPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#FAF8F3] shadow-xl">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-[#E5E2DA] bg-[#FAF8F3]/90 px-3 backdrop-blur">
            {/* Suspense fallback: no Link — href="/" caused home navigations while searchParams load. */}
            <span
              className="flex h-11 w-11 items-center justify-center rounded-full text-[#252823]"
              aria-hidden
            >
              <ChevronLeft className="h-6 w-6" />
            </span>
            <h1 className="font-serif text-[20px] font-bold text-[#5D4A72]">운율</h1>
          </header>
          <div className="px-5 pb-10 pt-6">
            <p className="text-[15px] leading-relaxed text-[#777A73]">불러오는 중이에요.</p>
          </div>
        </div>
      }
    >
      <UnyulInputForm />
    </Suspense>
  );
}

function Choice({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-14 rounded-2xl text-[17px] font-semibold ${
        active
          ? "border border-[#B9A8C9] bg-[#F2EEF6] text-[#5D4A72]"
          : "border border-[#E5E2DA] bg-white text-[#252823]"
      }`}
    >
      {label}
    </button>
  );
}
