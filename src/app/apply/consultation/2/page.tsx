"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ApplyLayout } from "@/components/apply/ApplyLayout";
import { CONSULT_STEPS, CHARCOAL_STEPPER } from "@/components/apply/ApplyStepper";
import { getDraft, saveDraft } from "@/lib/client/api";
import { BirthTimeField } from "@/components/apply/BirthTimeField";

const inputClass =
  "h-12 w-full rounded-xl border border-[#e8dfd4] bg-white px-4 text-[16px] outline-none focus:border-[#403A49]";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
/** ▼ 목록은 10분 단위. 직접 타이핑은 00~59 모두 가능하다. */
const MINUTE_OPTIONS = ["00", "10", "20", "30", "40", "50"];

/** 기존 형식 그대로 "시:분" 으로 저장한다. 한쪽만 있으면 저장하지 않는다. */
function birthTimeValue(hour: string, minute: string): string {
  if (!hour || !minute) return "";
  return `${Number(hour)}:${minute.padStart(2, "0")}`;
}

function PersonFields({ title }: { title: string }) {
  const [gender, setGender] = useState<"male" | "female">("male");
  const [calendar, setCalendar] = useState<"solar" | "lunar">("solar");
  const [unknownTime, setUnknownTime] = useState(false);
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("");

  const isSelf = title === "본인 상담 정보";
  const timeKey = isSelf ? "birthTime" : "counterpartBirthTime";
  const unknownKey = isSelf ? "unknownTime" : "counterpartUnknownTime";

  // 이전 단계에서 돌아왔을 때 시간 관련 입력을 되살린다.
  useEffect(() => {
    const draft = getDraft("consultation");
    const saved = draft[timeKey];
    if (saved) {
      const [h = "", m = ""] = saved.split(":");
      if (h) setHour(h);
      if (m) setMinute(m);
    }
    if (draft[unknownKey] === "1") setUnknownTime(true);
  }, [timeKey, unknownKey]);

  return (
    <div className="space-y-5">
      <h3 className="text-[17px] font-bold text-[#403A49]">{title}</h3>
      <div>
        <label className="mb-1.5 block text-[15px] font-medium text-[#3d2b1f]">
          이름 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          placeholder="실명을 입력해주세요"
          className={inputClass}
          onChange={(e) => {
            if (title === "본인 상담 정보") saveDraft("consultation", { name: e.target.value });
            else saveDraft("consultation", { counterpartName: e.target.value });
          }}
        />
      </div>
      {title === "본인 상담 정보" ? (
        <div>
          <label className="mb-1.5 block text-[15px] font-medium text-[#3d2b1f]">
            연락처 <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            placeholder="예) 010-1234-5678"
            className={inputClass}
            onChange={(e) => saveDraft("consultation", { phone: e.target.value })}
          />
        </div>
      ) : null}
      <div>
        <label className="mb-1.5 block text-[15px] font-medium text-[#3d2b1f]">
          성별 <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setGender("male")}
            className={`h-12 rounded-xl text-[15px] font-semibold ${gender === "male" ? "bg-[#403A49] text-white" : "border border-[#e8dfd4] bg-white text-[#403A49]"}`}
          >
            남성
          </button>
          <button
            type="button"
            onClick={() => setGender("female")}
            className={`h-12 rounded-xl text-[15px] font-semibold ${gender === "female" ? "bg-[#403A49] text-white" : "border border-[#e8dfd4] bg-white text-[#403A49]"}`}
          >
            여성
          </button>
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-[15px] font-medium text-[#3d2b1f]">
          생년월일 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          placeholder="예) 1990-01-01"
          className={inputClass}
          onChange={(e) => {
            if (title === "본인 상담 정보") saveDraft("consultation", { birth: e.target.value });
            else saveDraft("consultation", { counterpartBirth: e.target.value });
          }}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[15px] font-medium text-[#3d2b1f]">
          태어난 시간 <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <BirthTimeField
            label="시"
            value={hour}
            onChange={(next) => {
              setHour(next);
              saveDraft("consultation", { [timeKey]: birthTimeValue(next, minute) });
            }}
            max={23}
            options={HOURS}
            placeholder="시 (00~23)"
            disabled={unknownTime}
            inputClass={inputClass}
          />
          <BirthTimeField
            label="분"
            value={minute}
            onChange={(next) => {
              setMinute(next);
              saveDraft("consultation", { [timeKey]: birthTimeValue(hour, next) });
            }}
            max={59}
            options={MINUTE_OPTIONS}
            placeholder="분 (00~59)"
            disabled={unknownTime}
            inputClass={inputClass}
          />
        </div>
        {/* 상대방도 태어난 시간을 모를 수 있어 같은 선택지를 준다. */}
        <label className="mt-3 flex items-center gap-2 text-[14px] text-[#3d2b1f]">
          <input
            type="checkbox"
            checked={unknownTime}
            onChange={(e) => {
              setUnknownTime(e.target.checked);
              saveDraft("consultation", { [unknownKey]: e.target.checked ? "1" : "" });
            }}
            className="h-5 w-5 accent-[#403A49]"
          />
          태어난 시간을 몰라요
        </label>
      </div>
      <div>
        <label className="mb-1.5 block text-[15px] font-medium text-[#3d2b1f]">
          양력 / 음력 <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setCalendar("solar")}
            className={`h-12 rounded-xl text-[15px] font-semibold ${calendar === "solar" ? "bg-[#403A49] text-white" : "border border-[#e8dfd4] bg-white text-[#403A49]"}`}
          >
            양력
          </button>
          <button
            type="button"
            onClick={() => setCalendar("lunar")}
            className={`h-12 rounded-xl text-[15px] font-semibold ${calendar === "lunar" ? "bg-[#403A49] text-white" : "border border-[#e8dfd4] bg-white text-[#403A49]"}`}
          >
            음력
          </button>
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-[15px] font-medium text-[#3d2b1f]">혈액형</label>
        <select className={inputClass} defaultValue="">
          <option value="" disabled>
            선택해주세요
          </option>
          {["A", "B", "O", "AB"].map((type) => (
            <option key={type}>{type}형</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function ConsultationStep2Page() {
  return (
    <Suspense>
      <ConsultationStep2Content />
    </Suspense>
  );
}

function ConsultationStep2Content() {
  const searchParams = useSearchParams();
  const showCounterpart = searchParams.get("extra") === "1" || getDraft("consultation").extraPerson === "1";

  // 본인 생년월일은 화면에 필수(*)로 표시되어 있고, 4단계 요약에서도 쓰인다.
  const validateNext = () => {
    const draft = getDraft("consultation");
    if (!draft.birth?.trim()) return "생년월일을 입력해 주세요.";
    if (draft.unknownTime !== "1" && !draft.birthTime?.trim()) {
      return "태어난 시간을 입력하거나 '태어난 시간을 몰라요'를 선택해 주세요.";
    }
    if (showCounterpart) {
      if (!draft.counterpartName?.trim()) return "상대방 이름을 입력해 주세요.";
      if (!draft.counterpartBirth?.trim()) return "상대방 생년월일을 입력해 주세요.";
      if (draft.counterpartUnknownTime !== "1" && !draft.counterpartBirthTime?.trim()) {
        return "상대방의 태어난 시간을 입력하거나 '태어난 시간을 몰라요'를 선택해 주세요.";
      }
    }
    return "";
  };

  return (
    <ApplyLayout
      step={2}
      title="사주 분석 시작하기"
      basePath="/apply/consultation"
      steps={CONSULT_STEPS}
      stepperTheme={CHARCOAL_STEPPER}
      shellBg="bg-[#FFFFFF]"
      prevHref="/apply/consultation/1"
      nextHref="/apply/consultation/3"
      requireContactFlow="consultation"
      validateNext={validateNext}
      heroText={"상담에 필요한 정보를\n입력해 주세요"}
    >
      <h2 className="text-[22px] font-bold text-[#403A49]">2. 상담 정보 입력</h2>
      <p className="mt-2 text-[14px] text-[#6B6570]">사주 상담을 위한 기본 정보를 알려주세요.</p>
      <div className="mt-5 space-y-8">
        <PersonFields title="본인 상담 정보" />
        {showCounterpart ? <PersonFields title="상대방 정보" /> : null}
      </div>
    </ApplyLayout>
  );
}
