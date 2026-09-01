"use client";

import { useEffect, useState } from "react";
import { ApplyLayout } from "@/components/apply/ApplyLayout";
import { SAJU_STEPS, CHARCOAL_STEPPER } from "@/components/apply/ApplyStepper";
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

export default function SajuStep1Page() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [birth, setBirth] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [calendar, setCalendar] = useState<"solar" | "lunar">("solar");
  const [unknownTime, setUnknownTime] = useState(false);

  // 이전 단계에서 돌아왔을 때 이미 입력한 값을 되살린다.
  useEffect(() => {
    const draft = getDraft("saju-song");
    if (draft.name) setName(draft.name);
    if (draft.phone) setPhone(draft.phone);
    if (draft.birth) setBirth(draft.birth);
    if (draft.bloodType) setBloodType(draft.bloodType);
    if (draft.birthTime) {
      const [h = "", m = ""] = draft.birthTime.split(":");
      if (h) setHour(h);
      if (m) setMinute(m);
    }
    if (draft.gender === "여성") setGender("female");
    else if (draft.gender === "남성") setGender("male");
    if (draft.calendar === "음력") setCalendar("lunar");
    else if (draft.calendar === "양력") setCalendar("solar");
    if (draft.unknownTime === "1") setUnknownTime(true);
  }, []);

  // 화면에 필수(*)로 표시된 항목 중 기본값이 없는 것만 검사한다.
  // 태어난 시간은 "태어난 시간을 몰라요"를 정상값으로 인정한다.
  const validateNext = () => {
    if (!birth.trim()) return "생년월일을 입력해 주세요.";
    if (!unknownTime && !(hour && minute)) {
      return "태어난 시간을 입력하거나 '태어난 시간을 몰라요'를 선택해 주세요.";
    }
    return "";
  };

  return (
    <ApplyLayout
      step={1}
      title="사주 인생곡 신청하기"
      basePath="/apply/saju-song"
      steps={SAJU_STEPS}
      backHref="/products/saju-song"
      nextHref="/apply/saju-song/2"
      validateNext={validateNext}
      requireContactFlow="saju-song"
      heroText={"상담 없이 사주 정보로\n하나뿐인 인생곡을 만듭니다"}
    
      stepperTheme={CHARCOAL_STEPPER}
      shellBg="bg-[#FFFFFF]"
    >
      <h2 className="text-[22px] font-bold text-[#403A49]">1. 사주 정보를 입력해주세요</h2>
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
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              saveDraft("saju-song", { name: e.target.value });
            }}
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
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              saveDraft("saju-song", { phone: e.target.value });
            }}
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
            value={birth}
            onChange={(e) => {
              setBirth(e.target.value);
              saveDraft("saju-song", { birth: e.target.value });
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
                saveDraft("saju-song", { birthTime: birthTimeValue(next, minute) });
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
                saveDraft("saju-song", { birthTime: birthTimeValue(hour, next) });
              }}
              max={59}
              options={MINUTE_OPTIONS}
              placeholder="분 (00~59)"
              disabled={unknownTime}
              inputClass={inputClass}
            />
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
            value={bloodType}
            onChange={(e) => {
              setBloodType(e.target.value);
              saveDraft("saju-song", { bloodType: e.target.value });
            }}
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
