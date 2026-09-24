"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ApplyLayout } from "@/components/apply/ApplyLayout";
import { CONSULT_STEPS, CHARCOAL_STEPPER } from "@/components/apply/ApplyStepper";
import { fetchMe, getDraft, saveDraft } from "@/lib/client/api";
import { displayReviewsForProduct, summarizeReviews } from "@/lib/constants/reviews";
import { CONSULT_TEACHERS, teacherNameById } from "@/lib/server/consultationSlots";

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

/** 목록에 있는 id인지 확인한다. 아니면 기존과 같이 유비 선생으로 둔다. */
function isTeacherId(value: string): boolean {
  return CONSULT_TEACHERS.some((item) => item.id === value);
}

const TEACHER_BADGES: Record<string, string> = {
  yubi: "사주로그 전담 선생",
  helen: "사주로그 선생",
  pending: "사주로그 선생",
};

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

function ConsultationStep1Flow() {
  const params = useSearchParams();
  // 상세페이지에서 넘어온 선생님을 최초 선택값으로 쓴다.
  // 값이 없거나 목록에 없으면 기존 기본값(유비 선생)이다.
  const paramTeacher = params.get("teacher") ?? "";
  const [teacherId, setTeacherId] = useState(() =>
    isTeacherId(paramTeacher) ? paramTeacher : "yubi",
  );
  const teacherName = teacherNameById(teacherId);
  // 선생님을 바꾼 직후에는 이전 선생님 기준으로 골라 둔 시간을 되살리지 않는다.
  const teacherChanged = useRef(false);

  const [dates, setDates] = useState<string[]>([]);
  const [date, setDate] = useState("");
  /**
   * 표시 문구("8월 12일(화)") → 한국 날짜("2026-08-12") 대응표.
   * 서버가 날짜 목록과 함께 내려준 값을 그대로 들고 있다가 신청에 함께 보낸다.
   * 표시 문구에서 연도를 역추론하지 않기 위한 것이다.
   */
  const [isoDates, setIsoDates] = useState<Record<string, string>>({});
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<{ time: string; status: SlotStatus }[]>([]);
  const [purposes, setPurposes] = useState<string[]>(["직업 · 사업 고민"]);
  const [report, setReport] = useState(false);
  const [extraPerson, setExtraPerson] = useState(false);

  /** 선생님 변경. 날짜는 그대로 두고 시간 선택만 초기화한다. */
  const changeTeacher = (nextId: string) => {
    if (nextId === teacherId) return;
    teacherChanged.current = true;
    setTeacherId(nextId);
    setTime("");
  };

  const persist = (next: {
    date?: string;
    isoDates?: Record<string, string>;
    time?: string;
    purposes?: string[];
    report?: boolean;
    extraPerson?: boolean;
  }) => {
    const nextDate = next.date ?? date;
    const nextTime = next.time ?? time;
    const nextIsoDates = next.isoDates ?? isoDates;
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
      teacher: teacherName,
      datetime: `${nextDate} ${nextTime}`,
      // 서버가 예약 절대시각(scheduledAt)을 만드는 데 쓴다. 화면 표시에는 쓰지 않는다.
      scheduledDate: nextIsoDates[nextDate] ?? "",
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
        const options = (data.dateOptions ?? []) as { label: string; date: string }[];
        const nextDates = options.length
          ? options.map((option) => option.label)
          : ((data.dates ?? []) as string[]);
        const nextIsoDates = Object.fromEntries(
          options.map((option) => [option.label, option.date]),
        );
        setDates(nextDates);
        setIsoDates(nextIsoDates);
        const draft = getDraft("consultation");
        const initialDate =
          nextDates.find((item) => draft.datetime?.startsWith(item)) ?? nextDates[0] ?? "";
        setDate(initialDate);
        // draft 저장은 아래 date/teacher effect가 시간을 정한 뒤 한 번에 한다.
        // 그때 isoDates가 이미 채워져 있어 한국 날짜도 함께 담긴다.
      });
  }, []);

  useEffect(() => {
    if (!date) return;
    fetch(`/api/consultation/availability?date=${encodeURIComponent(date)}&teacher=${encodeURIComponent(teacherName)}`, {
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((data) => {
        const nextSlots = (data.slots ?? []) as { time: string; status: SlotStatus }[];
        setSlots(nextSlots);
        const draft = getDraft("consultation");
        const draftTime = teacherChanged.current
          ? undefined
          : nextSlots.find(
              (item) => draft.datetime?.includes(item.time) && item.status === "available",
            )?.time;
        teacherChanged.current = false;
        const firstAvailable = nextSlots.find((item) => item.status === "available")?.time ?? "";
        const nextTime = draftTime ?? firstAvailable;
        setTime(nextTime);
        if (nextTime) {
          persist({ date, time: nextTime });
        }
      });
  }, [date, teacherName]);

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
        <div className="mt-3 grid grid-cols-3 gap-2">
          {CONSULT_TEACHERS.map((item) => {
            const active = teacherId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => changeTeacher(item.id)}
                aria-pressed={active}
                className={`flex h-11 items-center justify-center whitespace-nowrap rounded-xl px-1 text-[14px] font-semibold ${
                  active
                    ? "bg-[#403A49] text-white"
                    : "border border-[#e8dfd4] bg-white text-[#403A49]"
                }`}
              >
                {item.name}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[13px] text-[#6B6570]">
          {TEACHER_BADGES[teacherId]}
          {teacherId === "yubi" && reviewSummary
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

export default function ConsultationStep1Page() {
  return (
    <Suspense fallback={null}>
      <ConsultationStep1Flow />
    </Suspense>
  );
}
