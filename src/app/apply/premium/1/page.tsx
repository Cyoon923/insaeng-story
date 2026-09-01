"use client";

import { useEffect, useState } from "react";
import { ApplyLayout } from "@/components/apply/ApplyLayout";
import { STORY_STEPS, CHARCOAL_STEPPER } from "@/components/apply/ApplyStepper";
import { getDraft, saveDraft } from "@/lib/client/api";
import { BirthTimeField } from "@/components/apply/BirthTimeField";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
/** ▼ 목록은 10분 단위. 직접 타이핑은 00~59 모두 가능하다. */
const MINUTE_OPTIONS = ["00", "10", "20", "30", "40", "50"];

/** 기존 형식 그대로 "시:분" 으로 저장한다. 한쪽만 있으면 저장하지 않는다. */
function birthTimeValue(hour: string, minute: string): string {
  if (!hour || !minute) return "";
  return `${Number(hour)}:${minute.padStart(2, "0")}`;
}

export default function PremiumStep1Page() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [birth, setBirth] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("");
  const [unknownTime, setUnknownTime] = useState(false);
  const [gender, setGender] = useState<"male" | "female">("male");
  const [calendar, setCalendar] = useState<"solar" | "lunar">("solar");

  // 이전 단계에서 돌아왔을 때 이미 입력한 값을 되살린다.
  useEffect(() => {
    const draft = getDraft("premium");
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
  // 성별·양력/음력은 기본값이 늘 선택되어 있어 비워질 수 없다.
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
      title="프리미엄 인생곡 신청하기"
      basePath="/apply/premium"
      steps={STORY_STEPS}
      backHref="/products/premium"
      nextHref="/apply/premium/2"
      validateNext={validateNext}
      requireContactFlow="premium"
      heroText={"당신의 인생을 깊이 이해하고,\n하나뿐인 인생곡으로 남겨드립니다"}
    
      stepperTheme={CHARCOAL_STEPPER}
      shellBg="bg-[#FFFFFF]"
    >
      <h2 className="text-[22px] font-bold text-[#403A49]">1. 기본정보</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-[#6B6570]">프리미엄 인생곡 제작을 위한 기본 정보를 입력해 주세요.</p>

      <div className="mt-5 space-y-5">
        <Field label="이름" required>
          <input
            type="text"
            placeholder="실명을 입력해주세요"
            className={inputClass}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              saveDraft("premium", { name: e.target.value });
            }}
          />
        </Field>
        <Field label="연락처" required>
          <input
            type="tel"
            placeholder="예) 010-1234-5678"
            className={inputClass}
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              saveDraft("premium", { phone: e.target.value });
            }}
          />
        </Field>
        <Field label="성별" required>
          <div className="grid grid-cols-2 gap-3">
            <Choice
              active={gender === "male"}
              onClick={() => {
                setGender("male");
                saveDraft("premium", { gender: "남성" });
              }}
              label="남성"
            />
            <Choice
              active={gender === "female"}
              onClick={() => {
                setGender("female");
                saveDraft("premium", { gender: "여성" });
              }}
              label="여성"
            />
          </div>
        </Field>
        <Field label="생년월일" required>
          <input
            type="text"
            placeholder="예) 1990-01-01"
            className={inputClass}
            value={birth}
            onChange={(e) => {
              setBirth(e.target.value);
              saveDraft("premium", { birth: e.target.value });
            }}
          />
        </Field>
        <Field label="태어난 시간" required>
          <div className="grid grid-cols-2 gap-3">
            <BirthTimeField
              label="시"
              value={hour}
              onChange={(next) => {
                setHour(next);
                saveDraft("premium", { birthTime: birthTimeValue(next, minute) });
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
                saveDraft("premium", { birthTime: birthTimeValue(hour, next) });
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
                saveDraft("premium", { unknownTime: e.target.checked ? "1" : "" });
              }}
              className="h-5 w-5 accent-[#403A49]"
            />
            태어난 시간을 몰라요
          </label>
        </Field>
        <Field label="양력 / 음력" required>
          <div className="grid grid-cols-2 gap-3">
            <Choice
              active={calendar === "solar"}
              onClick={() => {
                setCalendar("solar");
                saveDraft("premium", { calendar: "양력" });
              }}
              label="양력"
            />
            <Choice
              active={calendar === "lunar"}
              onClick={() => {
                setCalendar("lunar");
                saveDraft("premium", { calendar: "음력" });
              }}
              label="음력"
            />
          </div>
        </Field>
        <Field label="혈액형">
          <select
            className={inputClass}
            value={bloodType}
            onChange={(e) => {
              setBloodType(e.target.value);
              saveDraft("premium", { bloodType: e.target.value });
            }}
          >
            <option value="" disabled>
              선택해주세요
            </option>
            {["A", "B", "O", "AB"].map((type) => (
              <option key={type}>{type}형</option>
            ))}
          </select>
        </Field>
      </div>
    </ApplyLayout>
  );
}

const inputClass =
  "h-14 w-full rounded-xl border border-[#e8dfd4] bg-white px-4 text-[17px] outline-none focus:border-[#403A49]";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[16px] font-medium text-[#3d2b1f]">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </label>
      {children}
    </div>
  );
}

function Choice({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-14 rounded-xl text-[17px] font-semibold ${
        active ? "bg-[#403A49] text-white" : "border border-[#e8dfd4] bg-white text-[#403A49]"
      }`}
    >
      {label}
    </button>
  );
}
