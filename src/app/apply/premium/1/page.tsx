"use client";

import { useState } from "react";
import { ApplyLayout } from "@/components/apply/ApplyLayout";
import { STORY_STEPS, CHARCOAL_STEPPER } from "@/components/apply/ApplyStepper";
import { saveDraft } from "@/lib/client/api";

export default function PremiumStep1Page() {
  const [gender, setGender] = useState<"male" | "female">("male");
  const [calendar, setCalendar] = useState<"solar" | "lunar">("solar");

  return (
    <ApplyLayout
      step={1}
      title="프리미엄 인생곡 신청하기"
      basePath="/apply/premium"
      steps={STORY_STEPS}
      backHref="/products/premium"
      nextHref="/apply/premium/2"
      requireContactFlow="premium"
      heroText={"당신의 인생을 깊이 이해하고,\n하나뿐인 인생곡으로 남겨드립니다"}
    
      stepperTheme={CHARCOAL_STEPPER}
      shellBg="bg-[#FFFFFF]"
    >
      <h2 className="font-serif text-[22px] font-bold text-[#403A49]">1. 기본정보</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-[#6B6570]">프리미엄 인생곡 제작을 위한 기본 정보를 입력해 주세요.</p>

      <div className="mt-5 space-y-5">
        <Field label="이름" required>
          <input
            type="text"
            placeholder="실명을 입력해주세요"
            className={inputClass}
            onChange={(e) => saveDraft("premium", { name: e.target.value })}
          />
        </Field>
        <Field label="연락처" required>
          <input
            type="tel"
            placeholder="예) 010-1234-5678"
            className={inputClass}
            onChange={(e) => saveDraft("premium", { phone: e.target.value })}
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
            onChange={(e) => saveDraft("premium", { birth: e.target.value })}
          />
        </Field>
        <Field label="태어난 시간" required>
          <div className="grid grid-cols-2 gap-3">
            <select className={inputClass}>
              <option>시 선택</option>
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i}>{`${i}시`}</option>
              ))}
            </select>
            <select className={inputClass}>
              <option>분 선택</option>
              {["00", "10", "20", "30", "40", "50"].map((m) => (
                <option key={m}>{`${m}분`}</option>
              ))}
            </select>
          </div>
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
            defaultValue=""
            onChange={(e) => saveDraft("premium", { bloodType: e.target.value })}
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
