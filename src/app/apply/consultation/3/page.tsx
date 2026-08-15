"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApplyLayout } from "@/components/apply/ApplyLayout";
import { CONSULT_STEPS } from "@/components/apply/ApplyStepper";
import { getDraft, saveDraft } from "@/lib/client/api";

export default function ConsultationStep3Page() {
  const [content, setContent] = useState("");
  const [method, setMethod] = useState<"kakao" | "phone">("kakao");
  const [summary, setSummary] = useState({
    datetime: "8월 12일(화) 오전 10:00",
    teacher: "유비 선생",
    purpose: "직업 · 사업 고민",
    option: "추가 인원 1명(궁합) +50,000원",
  });

  useEffect(() => {
    const draft = getDraft("consultation");
    if (draft.content) setContent(draft.content);
    if (draft.method === "전화 상담") setMethod("phone");
    setSummary({
      datetime: draft.datetime || "8월 12일(화) 오전 10:00",
      teacher: draft.teacher || "유비 선생",
      purpose: draft.purpose || "직업 · 사업 고민",
      option: draft.option || "없음",
    });
  }, []);

  const persist = (nextContent: string, nextMethod: "kakao" | "phone") => {
    saveDraft("consultation", {
      content: nextContent,
      method: nextMethod === "kakao" ? "카카오톡 상담" : "전화 상담",
    });
  };

  return (
    <ApplyLayout
      step={3}
      title="1:1 사주상담 시작하기"
      basePath="/apply/consultation"
      steps={CONSULT_STEPS}
      prevHref="/apply/consultation/2"
      nextHref="/apply/consultation/4"
      heroText={"가장 궁금한 내용을\n편하게 적어주세요"}
    >
      <h2 className="font-serif text-[22px] font-bold text-[#3d2b1f]">3. 상담 내용</h2>

      <div className="mt-4 rounded-2xl bg-[#f5efe6] p-4">
        <div className="flex items-center justify-between">
          <p className="text-[16px] font-bold text-[#3d2b1f]">선택한 상담 정보</p>
          <Link href="/apply/consultation/1" className="text-[13px] font-medium text-[#5c3d2e]">
            변경하기
          </Link>
        </div>
        <ul className="mt-3 space-y-1 text-[14px] leading-relaxed text-[#5c3d2e]">
          <li>{summary.datetime}</li>
          <li>{summary.teacher}</li>
          <li>{summary.purpose}</li>
          <li>{summary.option}</li>
        </ul>
      </div>

      <div className="mt-6">
        <label className="mb-2 block text-[16px] font-semibold text-[#3d2b1f]">
          가장 궁금한 내용을 적어주세요 <span className="text-red-500">*</span>
        </label>
        <textarea
          rows={8}
          maxLength={500}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            persist(e.target.value, method);
          }}
          placeholder="지금 가장 고민되는 부분이나 궁금한 내용을 자세히 적어주시면 더 정확한 상담이 가능합니다."
          className="w-full resize-none rounded-xl border border-[#e8dfd4] bg-white px-4 py-3 text-[16px] outline-none focus:border-[#5c3d2e]"
        />
        <p className="mt-1 text-right text-[12px] text-[#8b6f5c]">{content.length} / 500</p>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-[16px] font-semibold text-[#3d2b1f]">
          상담 방법 <span className="text-red-500">*</span>
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              setMethod("kakao");
              persist(content, "kakao");
            }}
            className={`h-14 rounded-xl text-[15px] font-semibold ${
              method === "kakao" ? "bg-[#5c3d2e] text-white" : "border border-[#e8dfd4] bg-white text-[#5c3d2e]"
            }`}
          >
            카카오톡 상담
          </button>
          <button
            type="button"
            onClick={() => {
              setMethod("phone");
              persist(content, "phone");
            }}
            className={`h-14 rounded-xl text-[15px] font-semibold ${
              method === "phone" ? "bg-[#5c3d2e] text-white" : "border border-[#e8dfd4] bg-white text-[#5c3d2e]"
            }`}
          >
            전화 상담
          </button>
        </div>
      </div>
    </ApplyLayout>
  );
}
