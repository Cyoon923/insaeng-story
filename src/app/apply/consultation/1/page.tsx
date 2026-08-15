"use client";

import { useEffect, useState } from "react";
import { ApplyLayout } from "@/components/apply/ApplyLayout";
import { CONSULT_STEPS } from "@/components/apply/ApplyStepper";
import { getDraft, saveDraft } from "@/lib/client/api";

const PURPOSES = [
  "자존감 회복 · 마음 치유",
  "인생 진로 · 방향 설정",
  "가족 관계 개선",
  "사랑 · 관계 상담",
  "직업 · 사업 고민",
  "기타 인생 고민",
];

const DATES = ["8월 12일(화)", "8월 13일(수)", "8월 14일(목)", "8월 15일(금)", "8월 16일(토)"];
const TIMES = ["오전 10:00", "오후 2:00", "오후 6:00"];

export default function ConsultationStep1Page() {
  const [date, setDate] = useState(DATES[0]);
  const [time, setTime] = useState(TIMES[0]);
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
    saveDraft("consultation", {
      teacher: "유비 선생",
      datetime: `${nextDate} ${nextTime}`,
      purpose: nextPurposes.join(" / "),
      option: options || "없음",
      extraPerson: nextExtra ? "1" : "",
      report: nextReport ? "1" : "",
    });
  };

  useEffect(() => {
    const draft = getDraft("consultation");
    if (draft.datetime) {
      const [foundDate] = DATES.filter((item) => draft.datetime.startsWith(item));
      const foundTime = TIMES.find((item) => draft.datetime.includes(item));
      if (foundDate) setDate(foundDate);
      if (foundTime) setTime(foundTime);
    }
    if (draft.purpose) setPurposes(draft.purpose.split(" / ").filter(Boolean));
    if (draft.report === "1") setReport(true);
    if (draft.extraPerson === "1") setExtraPerson(true);
    if (!draft.datetime) {
      persist({});
    }
  }, []);

  const togglePurpose = (item: string) => {
    const next = purposes.includes(item) ? purposes.filter((p) => p !== item) : [...purposes, item];
    setPurposes(next);
    persist({ purposes: next });
  };

  return (
    <ApplyLayout
      step={1}
      title="1:1 사주상담 시작하기"
      basePath="/apply/consultation"
      steps={CONSULT_STEPS}
      backHref="/consultation"
      nextHref={extraPerson ? "/apply/consultation/2?extra=1" : "/apply/consultation/2"}
      heroText={"혼자 고민했던 이야기를\n편안하게 들려주세요"}
    >
      <h2 className="font-serif text-[22px] font-bold text-[#3d2b1f]">1. 상담 예약</h2>
      <p className="mt-2 text-[14px] text-[#8b6f5c]">선생님, 날짜, 시간, 상담 목적과 옵션을 선택해 주세요.</p>

      <section className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
        <p className="text-[16px] font-bold text-[#3d2b1f]">선생님</p>
        <p className="mt-2 text-[15px] font-semibold text-[#5c3d2e]">유비 선생</p>
        <p className="mt-1 text-[13px] text-[#8b6f5c]">인생스토리 전담 선생 · 5.0 (후기 128개)</p>
      </section>

      <section className="mt-5">
        <p className="mb-2 text-[16px] font-bold text-[#3d2b1f]">상담 가능한 날짜</p>
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {DATES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setDate(item);
                persist({ date: item });
              }}
              className={`h-12 shrink-0 rounded-xl px-4 text-[14px] font-semibold ${
                date === item ? "bg-[#5c3d2e] text-white" : "bg-[#f5efe6] text-[#3d2b1f]"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-5">
        <p className="mb-2 text-[16px] font-bold text-[#3d2b1f]">상담 가능한 시간</p>
        <div className="grid grid-cols-3 gap-2">
          {TIMES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setTime(item);
                persist({ time: item });
              }}
              className={`h-12 rounded-xl text-[14px] font-semibold ${
                time === item ? "bg-[#5c3d2e] text-white" : "border border-[#e8dfd4] bg-white text-[#3d2b1f]"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-[#8b6f5c]">상담 시간은 50분 내외입니다.</p>
      </section>

      <section className="mt-5">
        <p className="mb-2 text-[16px] font-bold text-[#3d2b1f]">
          상담 목적 <span className="text-[13px] font-normal text-[#8b6f5c]">복수 선택 가능</span>
        </p>
        <div className="grid grid-cols-1 gap-2">
          {PURPOSES.map((item) => {
            const active = purposes.includes(item);
            return (
              <button
                key={item}
                type="button"
                onClick={() => togglePurpose(item)}
                className={`h-12 rounded-xl text-[15px] font-medium ${
                  active ? "bg-[#5c3d2e] text-white" : "border border-[#e8dfd4] bg-white text-[#3d2b1f]"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-5 space-y-3">
        <p className="text-[16px] font-bold text-[#3d2b1f]">상담 옵션</p>
        <button
          type="button"
          onClick={() => {
            setReport((v) => {
              persist({ report: !v });
              return !v;
            });
          }}
          className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left ${
            report ? "border-[#5c3d2e] bg-[#faf6f1]" : "border-[#e8dfd4] bg-white"
          }`}
        >
          <div>
            <p className="text-[15px] font-bold text-[#3d2b1f]">상담 기록 요약 리포트</p>
            <p className="mt-1 text-[14px] font-semibold text-[#5c3d2e]">+20,000원</p>
          </div>
          <span className="text-[14px] text-[#5c3d2e]">{report ? "선택됨" : "선택"}</span>
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
            extraPerson ? "border-[#5c3d2e] bg-[#faf6f1]" : "border-[#e8dfd4] bg-white"
          }`}
        >
          <div>
            <p className="text-[15px] font-bold text-[#3d2b1f]">추가 인원 1명 (궁합)</p>
            <p className="mt-1 text-[13px] text-[#8b6f5c]">궁합·가족·관계 상담 시 상대방의 사주를 함께 살펴봅니다.</p>
            <p className="mt-1 text-[14px] font-semibold text-[#5c3d2e]">+50,000원</p>
          </div>
          <span className="text-[14px] text-[#5c3d2e]">{extraPerson ? "선택됨" : "선택"}</span>
        </button>
      </section>
    </ApplyLayout>
  );
}
