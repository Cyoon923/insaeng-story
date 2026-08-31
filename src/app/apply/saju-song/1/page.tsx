"use client";

import { useState } from "react";
import { ApplyLayout } from "@/components/apply/ApplyLayout";
import { SAJU_STEPS, CHARCOAL_STEPPER } from "@/components/apply/ApplyStepper";
import { saveDraft } from "@/lib/client/api";

const inputClass =
  "h-12 w-full rounded-xl border border-[#e8dfd4] bg-white px-4 text-[16px] outline-none focus:border-[#403A49]";

export default function SajuStep1Page() {
  const [gender, setGender] = useState<"male" | "female">("male");
  const [calendar, setCalendar] = useState<"solar" | "lunar">("solar");
  const [unknownTime, setUnknownTime] = useState(false);

  return (
    <ApplyLayout
      step={1}
      title="사주 인생곡 신청하기"
      basePath="/apply/saju-song"
      steps={SAJU_STEPS}
      backHref="/products/saju-song"
      nextHref="/apply/saju-song/2"
      requireContactFlow="saju-song"
      heroText={"상담 없이 사주 정보로\n하나뿐인 인생곡을 만듭니다"}
    
      stepperTheme={CHARCOAL_STEPPER}
      shellBg="bg-[#FFFFFF]"
    >
      <h2 className="font-serif text-[22px] font-bold text-[#403A49]">1. 사주 정보를 입력해주세요</h2>
      <p className="mt-2 text-[14px] text-[#6B6570]">정확한 사주 흐름을 위해 아래 정보를 입력해 주세요.</p>

      <div className="mt-5 space-y-5">
        <div>
          <label className="mb-1.5 block text-[15px] font-medium text-[#3d2b1f]">
            이름 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="실명을 입력해주세요"
            className={inputClass}
            onChange={(e) => saveDraft("saju-song", { name: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[15px] font-medium text-[#3d2b1f]">
            연락처 <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            placeholder="예) 010-1234-5678"
            className={inputClass}
            onChange={(e) => saveDraft("saju-song", { phone: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[15px] font-medium text-[#3d2b1f]">
            성별 <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Toggle
              active={gender === "male"}
              onClick={() => {
                setGender("male");
                saveDraft("saju-song", { gender: "남성" });
              }}
              label="남성"
            />
            <Toggle
              active={gender === "female"}
              onClick={() => {
                setGender("female");
                saveDraft("saju-song", { gender: "여성" });
              }}
              label="여성"
            />
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
            onChange={(e) => saveDraft("saju-song", { birth: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[15px] font-medium text-[#3d2b1f]">
            태어난 시간 <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <select className={inputClass} disabled={unknownTime}>
              <option>시 선택</option>
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i}>{`${i}시`}</option>
              ))}
            </select>
            <select className={inputClass} disabled={unknownTime}>
              <option>분 선택</option>
              {["00", "10", "20", "30", "40", "50"].map((m) => (
                <option key={m}>{`${m}분`}</option>
              ))}
            </select>
          </div>
          <label className="mt-3 flex items-center gap-2 text-[14px] text-[#3d2b1f]">
            <input
              type="checkbox"
              checked={unknownTime}
              onChange={(e) => {
                setUnknownTime(e.target.checked);
                saveDraft("saju-song", { unknownTime: e.target.checked ? "1" : "" });
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
            <Toggle
              active={calendar === "solar"}
              onClick={() => {
                setCalendar("solar");
                saveDraft("saju-song", { calendar: "양력" });
              }}
              label="양력"
            />
            <Toggle
              active={calendar === "lunar"}
              onClick={() => {
                setCalendar("lunar");
                saveDraft("saju-song", { calendar: "음력" });
              }}
              label="음력"
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-[15px] font-medium text-[#3d2b1f]">혈액형</label>
          <select
            className={inputClass}
            defaultValue=""
            onChange={(e) => saveDraft("saju-song", { bloodType: e.target.value })}
          >
            <option value="" disabled>
              선택해주세요
            </option>
            {["A", "B", "O", "AB"].map((type) => (
              <option key={type}>{type}형</option>
            ))}
          </select>
        </div>
      </div>
    </ApplyLayout>
  );
}

function Toggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-12 rounded-xl text-[15px] font-semibold ${
        active ? "bg-[#403A49] text-white" : "border border-[#e8dfd4] bg-white text-[#403A49]"
      }`}
    >
      {label}
    </button>
  );
}
