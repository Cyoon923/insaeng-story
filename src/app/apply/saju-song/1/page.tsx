"use client";

import { useEffect, useRef, useState } from "react";
import { ApplyLayout } from "@/components/apply/ApplyLayout";
import { SAJU_STEPS, CHARCOAL_STEPPER } from "@/components/apply/ApplyStepper";
import { fetchMe, getDraft, postApp, saveDraft } from "@/lib/client/api";
import type { User } from "@/lib/types/app";
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
  /** 이 사주정보가 누구 것인지. 본인 정보일 때만 회원 프로필에 저장한다. */
  const [subject, setSubject] = useState<"self" | "other">("self");

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
    saveDraft("saju-song", values);
  };

  // 이전 단계에서 돌아왔을 때 이미 입력한 값을 되살린다.
  useEffect(() => {
    const draft = getDraft("saju-song");
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
    if (draft.subject === "other") setSubject("other");
    // 기존 draft에 없으면 "내 정보"를 기본값으로 남겨 둔다.
    else if (!draft.subject) saveDraft("saju-song", { subject: "self" });
  }, []);

  /**
   * 로그인한 회원의 사주 정보를 채운다.
   * draft에 없고 사용자가 아직 건드리지 않은 항목만 채우므로,
   * 다른 사람 정보로 바꿔 둔 값이 되살아나지 않는다.
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
          saveDraft("saju-song", filled);
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
  // 태어난 시간은 "태어난 시간을 몰라요"를 정상값으로 인정한다.
  /**
   * 본인 정보일 때만 회원 프로필에 남긴다. 다음에 신청할 때 다시 입력하지 않기 위해서다.
   * "다른 사람 정보"에서는 호출하지 않으므로 내 프로필이 남의 사주로 덮이지 않는다.
   * 빈 값은 보내지 않는다. 기존에 저장해 둔 정보를 지우지 않기 위해서다.
   */
  const saveMyProfile = () => {
    if (subject !== "self") return;
    const profile: Record<string, string | boolean> = {
      gender: gender === "female" ? "female" : "male",
      calendar: calendar === "lunar" ? "lunar" : "solar",
      unknownTime,
    };
    if (name.trim()) profile.name = name.trim();
    if (phone.trim()) profile.phone = phone.trim();
    if (birth.trim()) profile.birth = birth.trim();
    if (bloodType) profile.bloodType = bloodType;
    // "태어난 시간 몰라요"를 고르면 예전에 저장해 둔 출생시간이 프로필에 남지 않도록 비운다.
    if (unknownTime) profile.birthTime = "";
    else {
      const time = birthTimeValue(hour, minute);
      if (time) profile.birthTime = time;
    }

    // 저장 실패가 신청을 막으면 안 된다. 기다리지 않고 실패도 조용히 넘긴다.
    postApp({ action: "updateProfile", profile }).catch(() => {});
  };

  const validateNext = () => {
    if (!birth.trim()) return "생년월일을 입력해 주세요.";
    if (!unknownTime && !(hour && minute)) {
      return "태어난 시간을 입력하거나 '태어난 시간을 몰라요'를 선택해 주세요.";
    }
    // 필수 검사를 모두 통과한 시점 = 다음 단계로 넘어가기 직전이다.
    saveMyProfile();
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
            누구의 정보인가요? <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Toggle
              active={subject === "self"}
              onClick={() => {
                setSubject("self");
                saveDraft("saju-song", { subject: "self" });
              }}
              label="내 정보"
            />
            <Toggle
              active={subject === "other"}
              onClick={() => {
                setSubject("other");
                saveDraft("saju-song", { subject: "other" });
              }}
              label="다른 사람 정보"
            />
          </div>
          <p className="mt-2 text-[14px] leading-relaxed text-[#6B6570]">
            내 정보를 선택하시면 다음 신청부터 다시 입력하지 않으셔도 됩니다.
          </p>
        </div>

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
              commit({ name: e.target.value });
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
              commit({ phone: e.target.value });
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
                commit({ gender: "남성" });
              }}
              label="남성"
            />
            <Toggle
              active={gender === "female"}
              onClick={() => {
                setGender("female");
                commit({ gender: "여성" });
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
              commit({ birth: e.target.value });
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
                commit({ calendar: "양력" });
              }}
              label="양력"
            />
            <Toggle
              active={calendar === "lunar"}
              onClick={() => {
                setCalendar("lunar");
                commit({ calendar: "음력" });
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
