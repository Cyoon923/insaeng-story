"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ApplyLayout } from "@/components/apply/ApplyLayout";
import { CONSULT_STEPS, CHARCOAL_STEPPER } from "@/components/apply/ApplyStepper";
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

function PersonFields({ title, subject }: { title: string; subject: "self" | "other" }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [birth, setBirth] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [calendar, setCalendar] = useState<"solar" | "lunar">("solar");
  const [unknownTime, setUnknownTime] = useState(false);
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("");

  const isSelf = title === "본인 상담 정보";
  const timeKey = isSelf ? "birthTime" : "counterpartBirthTime";
  const unknownKey = isSelf ? "unknownTime" : "counterpartUnknownTime";

  /**
   * draft에 이미 있던 항목. 값이 빈 문자열이어도 "사용자가 정한 값"으로 보고
   * 회원정보로 덮어쓰지 않는다. 그래서 truthy가 아니라 key 존재로 판단한다.
   */
  const draftKeys = useRef<Set<string>>(new Set());
  /** 이 화면에서 사용자가 직접 건드린 항목. 늦게 도착한 회원정보가 덮지 못하게 한다. */
  const touched = useRef<Set<string>>(new Set());

  /** 본인 정보 저장. 상대방 블록에서는 쓰지 않는다. */
  const commitSelf = (values: Record<string, string>) => {
    for (const key of Object.keys(values)) touched.current.add(key);
    saveDraft("consultation", values);
  };

  // 이전 단계에서 돌아왔을 때 입력을 되살린다.
  useEffect(() => {
    const draft = getDraft("consultation");
    draftKeys.current = new Set(Object.keys(draft));
    const saved = draft[timeKey];
    if (saved) {
      const [h = "", m = ""] = saved.split(":");
      if (h) setHour(h);
      if (m) setMinute(m);
    }
    if (draft[unknownKey] === "1") setUnknownTime(true);
    // 상대방 블록은 기존 그대로 시간 관련 입력만 되살린다.
    if (!isSelf) return;
    if (draft.name) setName(draft.name);
    if (draft.phone) setPhone(draft.phone);
    if (draft.birth) setBirth(draft.birth);
    if (draft.bloodType) setBloodType(draft.bloodType);
    if (draft.gender === "여성") setGender("female");
    else if (draft.gender === "남성") setGender("male");
    if (draft.calendar === "음력") setCalendar("lunar");
    else if (draft.calendar === "양력") setCalendar("solar");
  }, [timeKey, unknownKey, isSelf]);

  /**
   * 로그인한 회원의 정보를 "본인 상담 정보"에만 채운다.
   * 상대방 정보에는 절대 채우지 않는다(궁합 상대는 회원 본인이 아니다).
   * draft에 없고 사용자가 아직 건드리지 않은 항목만 채운다.
   */
  useEffect(() => {
    // 상대방 블록이거나 "다른 사람 정보"를 고른 경우에는 회원정보를 채우지 않는다.
    if (!isSelf || subject !== "self") return;
    let cancelled = false;
    fetchMe()
      .then((data) => {
        if (cancelled) return;
        const user = (data?.user ?? null) as User | null;
        if (!user) return;

        const canFill = (key: string) =>
          !draftKeys.current.has(key) && !touched.current.has(key);
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
          saveDraft("consultation", filled);
        }
      })
      .catch(() => {
        // 회원정보를 불러오지 못해도 직접 입력해서 신청할 수 있어야 한다.
      });

    return () => {
      cancelled = true;
    };
  }, [isSelf, subject]);

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
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (isSelf) commitSelf({ name: e.target.value });
            else saveDraft("consultation", { counterpartName: e.target.value });
          }}
        />
      </div>
      {isSelf ? (
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
              commitSelf({ phone: e.target.value });
            }}
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
            onClick={() => {
              setGender("male");
              if (isSelf) commitSelf({ gender: "남성" });
            }}
            className={`h-12 rounded-xl text-[15px] font-semibold ${gender === "male" ? "bg-[#403A49] text-white" : "border border-[#e8dfd4] bg-white text-[#403A49]"}`}
          >
            남성
          </button>
          <button
            type="button"
            onClick={() => {
              setGender("female");
              if (isSelf) commitSelf({ gender: "여성" });
            }}
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
          value={birth}
          onChange={(e) => {
            setBirth(e.target.value);
            if (isSelf) commitSelf({ birth: e.target.value });
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
              if (isSelf) commitSelf({ [timeKey]: birthTimeValue(next, minute) });
              else saveDraft("consultation", { [timeKey]: birthTimeValue(next, minute) });
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
              if (isSelf) commitSelf({ [timeKey]: birthTimeValue(hour, next) });
              else saveDraft("consultation", { [timeKey]: birthTimeValue(hour, next) });
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
              const value = e.target.checked ? "1" : "";
              if (isSelf) commitSelf({ [unknownKey]: value });
              else saveDraft("consultation", { [unknownKey]: value });
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
            onClick={() => {
              setCalendar("solar");
              if (isSelf) commitSelf({ calendar: "양력" });
            }}
            className={`h-12 rounded-xl text-[15px] font-semibold ${calendar === "solar" ? "bg-[#403A49] text-white" : "border border-[#e8dfd4] bg-white text-[#403A49]"}`}
          >
            양력
          </button>
          <button
            type="button"
            onClick={() => {
              setCalendar("lunar");
              if (isSelf) commitSelf({ calendar: "음력" });
            }}
            className={`h-12 rounded-xl text-[15px] font-semibold ${calendar === "lunar" ? "bg-[#403A49] text-white" : "border border-[#e8dfd4] bg-white text-[#403A49]"}`}
          >
            음력
          </button>
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-[15px] font-medium text-[#3d2b1f]">혈액형</label>
        <select
          className={inputClass}
          value={bloodType}
          onChange={(e) => {
            setBloodType(e.target.value);
            if (isSelf) commitSelf({ bloodType: e.target.value });
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
  /**
   * 이 상담 정보가 누구 것인지. 본인 정보일 때만 회원 프로필에 저장한다.
   * 초기값은 위 showCounterpart와 같은 방식으로 draft에서 바로 읽는다.
   */
  const [subject, setSubject] = useState<"self" | "other">(() =>
    getDraft("consultation").subject === "other" ? "other" : "self",
  );

  // 기존 draft에 subject가 없으면 "내 정보"를 기본값으로 남겨 둔다.
  useEffect(() => {
    if (!getDraft("consultation").subject) {
      saveDraft("consultation", { subject: "self" });
    }
  }, []);

  /**
   * 본인 상담 정보만 회원 프로필에 남긴다. 다음 신청 때 다시 입력하지 않기 위해서다.
   * 상대방(counterpart*) 값은 회원 본인의 정보가 아니므로 절대 담지 않는다.
   * 빈 값은 보내지 않는다. 기존에 저장해 둔 정보를 지우지 않기 위해서다.
   */
  const saveMyProfile = () => {
    // "다른 사람 정보"에서는 회원 프로필을 절대 건드리지 않는다.
    if (subject !== "self") return;
    const draft = getDraft("consultation");
    const unknownTime = draft.unknownTime === "1";
    const profile: Record<string, string | boolean> = {
      gender: draft.gender === "여성" ? "female" : "male",
      calendar: draft.calendar === "음력" ? "lunar" : "solar",
      unknownTime,
    };
    if (draft.name?.trim()) profile.name = draft.name.trim();
    if (draft.phone?.trim()) profile.phone = draft.phone.trim();
    if (draft.birth?.trim()) profile.birth = draft.birth.trim();
    if (draft.bloodType) profile.bloodType = draft.bloodType;
    // "태어난 시간 몰라요"를 고르면 예전에 저장해 둔 출생시간이 프로필에 남지 않도록 비운다.
    if (unknownTime) profile.birthTime = "";
    else if (draft.birthTime?.trim()) profile.birthTime = draft.birthTime.trim();

    // 저장 실패가 신청을 막으면 안 된다. 기다리지 않고 실패도 조용히 넘긴다.
    postApp({ action: "updateProfile", profile }).catch(() => {});
  };

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
    // 필수 검사를 모두 통과한 시점 = 3단계로 넘어가기 직전이다.
    saveMyProfile();
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
        <div>
          <label className="mb-1.5 block text-[15px] font-medium text-[#3d2b1f]">
            누구의 정보인가요? <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setSubject("self");
                saveDraft("consultation", { subject: "self" });
              }}
              className={`h-12 rounded-xl text-[15px] font-semibold ${subject === "self" ? "bg-[#403A49] text-white" : "border border-[#e8dfd4] bg-white text-[#403A49]"}`}
            >
              내 정보
            </button>
            <button
              type="button"
              onClick={() => {
                setSubject("other");
                saveDraft("consultation", { subject: "other" });
              }}
              className={`h-12 rounded-xl text-[15px] font-semibold ${subject === "other" ? "bg-[#403A49] text-white" : "border border-[#e8dfd4] bg-white text-[#403A49]"}`}
            >
              다른 사람 정보
            </button>
          </div>
          <p className="mt-2 text-[14px] leading-relaxed text-[#6B6570]">
            내 정보를 선택하시면 다음 신청부터 다시 입력하지 않으셔도 됩니다.
          </p>
        </div>
        <PersonFields title="본인 상담 정보" subject={subject} />
        {showCounterpart ? <PersonFields title="상대방 정보" subject={subject} /> : null}
      </div>
    </ApplyLayout>
  );
}
