"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ApplyLayout } from "@/components/apply/ApplyLayout";
import { CONSULT_STEPS } from "@/components/apply/ApplyStepper";
import { getDraft, saveDraft } from "@/lib/client/api";

const inputClass =
  "h-12 w-full rounded-xl border border-[#e8dfd4] bg-white px-4 text-[16px] outline-none focus:border-[#5c3d2e]";

function PersonFields({ title }: { title: string }) {
  const [gender, setGender] = useState<"male" | "female">("male");
  const [calendar, setCalendar] = useState<"solar" | "lunar">("solar");
  const [unknownTime, setUnknownTime] = useState(false);

  return (
    <div className="space-y-5">
      <h3 className="text-[17px] font-bold text-[#3d2b1f]">{title}</h3>
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
            className={`h-12 rounded-xl text-[15px] font-semibold ${gender === "male" ? "bg-[#5c3d2e] text-white" : "border border-[#e8dfd4] bg-white text-[#5c3d2e]"}`}
          >
            남성
          </button>
          <button
            type="button"
            onClick={() => setGender("female")}
            className={`h-12 rounded-xl text-[15px] font-semibold ${gender === "female" ? "bg-[#5c3d2e] text-white" : "border border-[#e8dfd4] bg-white text-[#5c3d2e]"}`}
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
        {title === "본인 상담 정보" ? (
          <label className="mt-3 flex items-center gap-2 text-[14px] text-[#3d2b1f]">
            <input
              type="checkbox"
              checked={unknownTime}
              onChange={(e) => setUnknownTime(e.target.checked)}
              className="h-5 w-5 accent-[#5c3d2e]"
            />
            태어난 시간을 몰라요
          </label>
        ) : null}
      </div>
      <div>
        <label className="mb-1.5 block text-[15px] font-medium text-[#3d2b1f]">
          양력 / 음력 <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setCalendar("solar")}
            className={`h-12 rounded-xl text-[15px] font-semibold ${calendar === "solar" ? "bg-[#5c3d2e] text-white" : "border border-[#e8dfd4] bg-white text-[#5c3d2e]"}`}
          >
            양력
          </button>
          <button
            type="button"
            onClick={() => setCalendar("lunar")}
            className={`h-12 rounded-xl text-[15px] font-semibold ${calendar === "lunar" ? "bg-[#5c3d2e] text-white" : "border border-[#e8dfd4] bg-white text-[#5c3d2e]"}`}
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

  return (
    <ApplyLayout
      step={2}
      title="1:1 사주상담 시작하기"
      basePath="/apply/consultation"
      steps={CONSULT_STEPS}
      prevHref="/apply/consultation/1"
      nextHref="/apply/consultation/3"
      requireContactFlow="consultation"
      heroText={"상담에 필요한 정보를\n입력해 주세요"}
    >
      <h2 className="font-serif text-[22px] font-bold text-[#3d2b1f]">2. 상담 정보 입력</h2>
      <p className="mt-2 text-[14px] text-[#8b6f5c]">사주 상담을 위한 기본 정보를 알려주세요.</p>
      <div className="mt-5 space-y-8">
        <PersonFields title="본인 상담 정보" />
        {showCounterpart ? <PersonFields title="상대방 정보" /> : null}
      </div>
    </ApplyLayout>
  );
}
