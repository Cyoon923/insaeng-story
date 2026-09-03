"use client";

import { useEffect, useState } from "react";
import { ApplyLayout } from "@/components/apply/ApplyLayout";
import { CONSULT_STEPS, CHARCOAL_STEPPER } from "@/components/apply/ApplyStepper";
import { fetchMe, getDraft, saveDraft } from "@/lib/client/api";
import { displayReviewsForProduct, summarizeReviews } from "@/lib/constants/reviews";

type SlotStatus = "available" | "booked" | "blocked";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const PURPOSES = [
  "자존감 회복 · 마음 치유",
  "인생 진로 · 방향 설정",
  "가족 관계 개선",
  "사랑 · 관계 상담",
  "직업 · 사업 고민",
  "기타 인생 고민",
];

const TEACHER = "유비 선생";

function parseConsultDate(value: string) {
  const match = value.match(/^(\d+)월 (\d+)일\((.+)\)$/);
  if (!match) return null;
  return { month: Number(match[1]), day: Number(match[2]), weekday: match[3] };
}

function buildCalendarCells(dates: string[]) {
  if (!dates.length) return [] as ({ empty: true } | { empty: false; date: string; day: number })[];

  const first = parseConsultDate(dates[0]);
  const offset = first ? WEEKDAYS.indexOf(first.weekday) : 0;
  const cells: ({ empty: true } | { empty: false; date: string; day: number })[] = [];

  for (let i = 0; i < offset; i++) cells.push({ empty: true });
  for (const date of dates) {
    const parsed = parseConsultDate(date);
    cells.push({ empty: false, date, day: parsed?.day ?? 0 });
  }
  while (cells.length % 7 !== 0) cells.push({ empty: true });

  return cells;
}

function slotLabel(status: SlotStatus) {
  if (status === "booked") return "예약됨";
  if (status === "blocked") return "불가";
  return "";
}

function formatSlotButton(time: string) {
  if (time.startsWith("오전 ")) {
    return { period: "오전", clock: time.replace("오전 ", "") };
  }
  if (time.startsWith("오후 ")) {
    return { period: "오후", clock: time.replace("오후 ", "") };
  }
  return { period: "", clock: time };
}

export default function ConsultationStep1Page() {
  const [dates, setDates] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<{ time: string; status: SlotStatus }[]>([]);
  const [purposes, setPurposes] = useState<string[]>(["직업 · 사업 고민"]);
  const [report, setReport] = useState(false);
  const [extraPerson, setExtraPerson] = useState(false);

  const persist = (next: {
    date?: string;
    time?: string;
    purposes?: string[];
    report?: boolean;
    extraPerson?: boolean;
  }) => {
    const nextDate = next.date ?? date;
    const nextTime = next.time ?? time;
    const nextPurposes = next.purposes ?? purposes;
    const nextReport = next.report ?? report;
    const nextExtra = next.extraPerson ?? extraPerson;
    const options = [
      nextReport ? "상담 기록 요약 리포트" : "",
      nextExtra ? "추가 인원 1명(궁합)" : "",
    ]
      .filter(Boolean)
      .join(" / ");
    if (!nextDate || !nextTime) return;
    saveDraft("consultation", {
      teacher: TEACHER,
      datetime: `${nextDate} ${nextTime}`,
      purpose: nextPurposes.join(" / "),
      option: options || "없음",
      extraPerson: nextExtra ? "1" : "",
      report: nextReport ? "1" : "",
    });
  };

  useEffect(() => {
    fetch("/api/consultation/availability", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const nextDates = (data.dates ?? []) as string[];
        setDates(nextDates);
        const draft = getDraft("consultation");
        const initialDate =
          nextDates.find((item) => draft.datetime?.startsWith(item)) ?? nextDates[0] ?? "";
        setDate(initialDate);
      });
  }, []);

  useEffect(() => {
    if (!date) return;
    fetch(`/api/consultation/availability?date=${encodeURIComponent(date)}&teacher=${encodeURIComponent(TEACHER)}`, {
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((data) => {
        const nextSlots = (data.slots ?? []) as { time: string; status: SlotStatus }[];
        setSlots(nextSlots);
        const draft = getDraft("consultation");
        const draftTime = nextSlots.find(
          (item) => draft.datetime?.includes(item.time) && item.status === "available",
        )?.time;
        const firstAvailable = nextSlots.find((item) => item.status === "available")?.time ?? "";
        const nextTime = draftTime ?? firstAvailable;
        setTime(nextTime);
        if (nextTime) {
          persist({ date, time: nextTime });
        }
      });
  }, [date]);

  useEffect(() => {
    const draft = getDraft("consultation");
    if (draft.purpose) setPurposes(draft.purpose.split(" / ").filter(Boolean));
    if (draft.report === "1") setReport(true);
    if (draft.extraPerson === "1") setExtraPerson(true);
  }, []);

  // 실제 공개된 상담 후기가 있을 때만 평균 별점과 개수를 함께 보여 준다.
  const [reviewSummary, setReviewSummary] = useState<{ count: number; average: number } | null>(null);

  useEffect(() => {
    fetchMe()
      .then((data) => {
        setReviewSummary(
          summarizeReviews(displayReviewsForProduct("consultation", data.reviews ?? [])),
        );
      })
      .catch(() => {});
  }, []);

  const togglePurpose = (item: string) => {
    const next = purposes.includes(item) ? purposes.filter((p) => p !== item) : [...purposes, item];
    setPurposes(next);
    persist({ purposes: next });
  };

  const calendarCells = buildCalendarCells(dates);
  const monthLabel = parseConsultDate(date)?.month ?? parseConsultDate(dates[0] ?? "")?.month ?? "";

  return (
    <ApplyLayout
      step={1}
      title="사주 분석 시작하기"
      basePath="/apply/consultation"
      steps={CONSULT_STEPS}
      stepperTheme={CHARCOAL_STEPPER}
      shellBg="bg-[#FFFFFF]"
      backHref="/consultation"
      nextHref={extraPerson ? "/apply/consultation/2?extra=1" : "/apply/consultation/2"}
      heroText={"혼자 고민했던 이야기를\n편안하게 들려주세요"}
    >
      <h2 className="text-[22px] font-bold text-[#403A49]">1. 상담 예약</h2>
      <p className="mt-2 text-[14px] text-[#6B6570]">선생님, 날짜, 시간, 상담 목적과 옵션을 선택해 주세요.</p>

      <section className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
        <p className="text-[16px] font-bold text-[#403A49]">선생님</p>
        <p className="mt-2 text-[15px] font-semibold text-[#403A49]">{TEACHER}</p>
        <p className="mt-1 text-[13px] text-[#6B6570]">
          사주로그 전담 선생
          {reviewSummary
            ? ` · ${reviewSummary.average.toFixed(1)} (후기 ${reviewSummary.count}개)`
            : ""}
        </p>
      </section>

      <section className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-[15px] font-bold text-[#403A49]">상담 날짜 · 시간</p>
            <p className="mt-1 text-[12px] text-[#6B6570]">오전 10시 ~ 오후 6시 · 50분 상담</p>
          </div>
          {date && time ? (
            <p className="text-right text-[12px] font-semibold text-[#403A49]">
              {parseConsultDate(date)?.day}일 {time}
            </p>
          ) : null}
        </div>

        <p className="mt-4 text-center text-[17px] font-bold text-[#403A49]">{monthLabel}월</p>
        <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-[#6B6570]">
          {WEEKDAYS.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {calendarCells.map((cell, index) =>
            cell.empty ? (
              <span key={`empty-${index}`} className="aspect-square" />
            ) : (
              <button
                key={cell.date}
                type="button"
                onClick={() => setDate(cell.date)}
                className={`flex aspect-square items-center justify-center rounded-full text-[14px] font-bold ${
                  date === cell.date ? "bg-[#403A49] text-white" : "bg-[#f5efe6] text-[#3d2b1f]"
                }`}
              >
                {cell.day}
              </button>
            ),
          )}
        </div>

        <p className="mb-2 mt-4 text-[14px] font-bold text-[#3d2b1f]">상담 가능한 시간</p>
        <div className="grid grid-cols-3 gap-1.5">
          {slots.map((item) => {
            const disabled = item.status !== "available";
            const active = time === item.time && !disabled;
            const slotTime = formatSlotButton(item.time);
            return (
              <button
                key={item.time}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setTime(item.time);
                  persist({ time: item.time });
                }}
                className={`flex h-12 flex-col items-center justify-center rounded-lg font-semibold ${
                  disabled
                    ? "cursor-not-allowed bg-[#f0ebe3] text-[#b0a090]"
                    : active
                      ? "bg-[#403A49] text-white"
                      : "border border-[#e8dfd4] bg-white text-[#3d2b1f]"
                }`}
              >
                {disabled ? (
                  <span className="text-[12px]">{slotLabel(item.status)}</span>
                ) : (
                  <>
                    <span className="text-[10px] leading-none opacity-80">{slotTime.period}</span>
                    <span className="mt-0.5 text-[13px] leading-none">{slotTime.clock}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
        <p className="mb-2 text-[14px] font-bold text-[#3d2b1f]">
          상담 목적 <span className="text-[12px] font-normal text-[#6B6570]">복수 선택</span>
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {PURPOSES.map((item) => {
            const active = purposes.includes(item);
            return (
              <button
                key={item}
                type="button"
                onClick={() => togglePurpose(item)}
                className={`min-h-11 rounded-lg px-2 py-2 text-[12px] font-semibold leading-snug break-keep ${
                  active ? "bg-[#403A49] text-white" : "border border-[#e8dfd4] bg-[#faf6f1] text-[#3d2b1f]"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-5 space-y-3">
        <p className="text-[16px] font-bold text-[#403A49]">상담 옵션</p>
        <button
          type="button"
          onClick={() => {
            setReport((v) => {
              persist({ report: !v });
              return !v;
            });
          }}
          className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left ${
            report ? "border-[#403A49] bg-[#faf6f1]" : "border-[#e8dfd4] bg-white"
          }`}
        >
          <div>
            <p className="text-[15px] font-bold text-[#403A49]">상담 기록 요약 리포트</p>
            <p className="mt-1 text-[14px] font-semibold text-[#403A49]">+20,000원</p>
          </div>
          <span className="text-[14px] text-[#403A49]">{report ? "선택됨" : "선택"}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setExtraPerson((v) => {
              persist({ extraPerson: !v });
              return !v;
            });
          }}
          className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left ${
            extraPerson ? "border-[#403A49] bg-[#faf6f1]" : "border-[#e8dfd4] bg-white"
          }`}
        >
          <div>
            <p className="text-[15px] font-bold text-[#403A49]">추가 인원 1명 (궁합)</p>
            <p className="mt-1 text-[13px] text-[#6B6570]">궁합·가족·관계 상담 시 상대방의 사주를 함께 살펴봅니다.</p>
            <p className="mt-1 text-[14px] font-semibold text-[#403A49]">+50,000원</p>
          </div>
          <span className="text-[14px] text-[#403A49]">{extraPerson ? "선택됨" : "선택"}</span>
        </button>
      </section>
    </ApplyLayout>
  );
}
