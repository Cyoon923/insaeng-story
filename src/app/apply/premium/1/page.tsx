"use client";

import { useEffect, useRef, useState } from "react";
import { ApplyLayout } from "@/components/apply/ApplyLayout";
import { STORY_STEPS, CHARCOAL_STEPPER } from "@/components/apply/ApplyStepper";
import { fetchMe, getDraft, saveDraft } from "@/lib/client/api";
import type { User } from "@/lib/types/app";
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

  /**
   * draft에 이미 있던 항목. 값이 빈 문자열이어도 "사용자가 정한 값"으로 보고
   * 회원정보로 덮어쓰지 않는다. 그래서 truthy가 아니라 key 존재로 판단한다.
   */
  const draftKeys = useRef<Set<string>>(new Set());
  /** 이 화면에서 사용자가 직접 건드린 항목. 늦게 도착한 회원정보가 덮지 못하게 한다. */
  const touched = useRef<Set<string>>(new Set());

  /** 입력 저장. draft에 남기면서 그 항목을 "사용자가 정한 값"으로 표시한다. */
  const commit = (values: Record<string, string>) => {
    for (const key of Object.keys(values)) touched.current.add(key);
    saveDraft("premium", values);
  };

  // 이전 단계에서 돌아왔을 때 이미 입력한 값을 되살린다.
  useEffect(() => {
    const draft = getDraft("premium");
    draftKeys.current = new Set(Object.keys(draft));
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

  /**
   * 로그인한 회원의 기본정보를 채운다.
   * draft에 없고 사용자가 아직 건드리지 않은 항목만 채우므로,
   * 다른 사람 이름으로 바꿔 둔 값이 되살아나지 않는다.
   * 회원정보가 비어 있는 항목은 기존 기본값을 그대로 둔다.
   */
  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((data) => {
        if (cancelled) return;
        const user = (data?.user ?? null) as User | null;
        if (!user) return;

        const canFill = (key: string) =>
          !draftKeys.current.has(key) && !touched.current.has(key);
        // 자동입력한 값도 draft에 남겨 다음 단계와 복원에서 그대로 쓰이게 한다.
        const filled: Record<string, string> = {};

        if (user.name && canFill("name")) {
          setName(user.name);
          filled.name = user.name;
        }
        if (user.phone && canFill("phone")) {
          setPhone(user.phone);
          filled.phone = user.phone;
        }
        if (user.birth && canFill("birth")) {
          setBirth(user.birth);
          filled.birth = user.birth;
        }
        if (user.bloodType && canFill("bloodType")) {
          setBloodType(user.bloodType);
          filled.bloodType = user.bloodType;
        }
        if (user.gender && canFill("gender")) {
          setGender(user.gender);
          filled.gender = user.gender === "female" ? "여성" : "남성";
        }
        if (user.calendar && canFill("calendar")) {
          setCalendar(user.calendar);
          filled.calendar = user.calendar === "lunar" ? "음력" : "양력";
        }
        if (user.birthTime && canFill("birthTime")) {
          const [h = "", m = ""] = user.birthTime.split(":");
          if (h) setHour(h);
          if (m) setMinute(m);
          filled.birthTime = user.birthTime;
        }
        if (user.unknownTime && canFill("unknownTime")) {
          setUnknownTime(true);
          filled.unknownTime = "1";
        }

        if (Object.keys(filled).length > 0) {
          for (const key of Object.keys(filled)) draftKeys.current.add(key);
          saveDraft("premium", filled);
        }
      })
      .catch(() => {
        // 회원정보를 불러오지 못해도 직접 입력해서 신청할 수 있어야 한다.
      });

    return () => {
      cancelled = true;
    };
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
              commit({ name: e.target.value });
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
              commit({ phone: e.target.value });
            }}
          />
        </Field>
        <Field label="성별" required>
          <div className="grid grid-cols-2 gap-3">
            <Choice
              active={gender === "male"}
              onClick={() => {
                setGender("male");
                commit({ gender: "남성" });
              }}
              label="남성"
            />
            <Choice
              active={gender === "female"}
              onClick={() => {
                setGender("female");
                commit({ gender: "여성" });
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
              commit({ birth: e.target.value });
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
                commit({ birthTime: birthTimeValue(next, minute) });
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
                commit({ birthTime: birthTimeValue(hour, next) });
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
                commit({ unknownTime: e.target.checked ? "1" : "" });
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
                commit({ calendar: "양력" });
              }}
              label="양력"
            />
            <Choice
              active={calendar === "lunar"}
              onClick={() => {
                setCalendar("lunar");
                commit({ calendar: "음력" });
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
              commit({ bloodType: e.target.value });
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
