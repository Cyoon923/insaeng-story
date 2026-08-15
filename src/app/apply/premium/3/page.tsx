"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ApplyLayout } from "@/components/apply/ApplyLayout";
import { STORY_STEPS } from "@/components/apply/ApplyStepper";
import { getDraft, saveDraft } from "@/lib/client/api";

const PROTAGONIST_IMAGES: Record<string, string> = {
  self: "/images/photo-self.jpg",
  parents: "/images/photo-parents.jpg",
  partner: "/images/photo-couple.jpg",
  family: "/images/photo-family.jpg",
  pet: "/images/photo-pet.jpg",
  other: "/images/photo-self.jpg",
};

const QUESTIONS = [
  {
    key: "memory",
    q: "가장 기억에 남는 순간은 언제인가요?",
    hint: "함께 여행했던 순간, 따뜻한 한마디, 특별한 추억",
    max: 500,
  },
  {
    key: "message",
    q: "꼭 전하고 싶은 말은 무엇인가요?",
    hint: "감사의 마음, 사랑의 표현, 전하지 못했던 말",
    max: 500,
  },
  {
    key: "image",
    q: "가장 기억하고 싶은 모습은 어떤 모습인가요?",
    hint: "환하게 웃는 모습, 열심히 사는 모습, 함께한 행복한 순간",
    max: 500,
  },
] as const;

export default function ApplyStep3Page() {
  const [answers, setAnswers] = useState({ memory: "", message: "", image: "", free: "" });
  const [protagonist, setProtagonist] = useState("부모님");
  const [protagonistId, setProtagonistId] = useState("parents");

  useEffect(() => {
    const draft = getDraft("premium");
    setAnswers({
      memory: draft.memory ?? "",
      message: draft.message ?? "",
      image: draft.image ?? "",
      free: draft.free ?? "",
    });
    if (draft.protagonist) setProtagonist(draft.protagonist);
    if (draft.protagonistId) setProtagonistId(draft.protagonistId);
  }, []);

  const update = (key: keyof typeof answers, value: string) => {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    saveDraft("premium", next);
  };

  return (
    <ApplyLayout
      step={3}
      title="프리미엄 인생곡 신청하기"
      basePath="/apply/premium"
      steps={STORY_STEPS}
      prevHref="/apply/premium/2"
      nextHref="/apply/premium/4"
      heroText={"선생님과 나눈 이야기가\n노래가 됩니다"}
    >
      <div className="mb-4 flex items-center justify-between rounded-xl bg-[#f5efe6] p-3">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 overflow-hidden rounded-full bg-white">
            <Image
              src={PROTAGONIST_IMAGES[protagonistId] ?? "/images/photo-parents.jpg"}
              alt=""
              fill
              className="object-cover"
              sizes="40px"
            />
          </div>
          <div>
            <p className="text-[12px] text-[#8b6f5c]">선택한 주인공</p>
            <p className="text-[16px] font-bold text-[#3d2b1f]">{protagonist}</p>
          </div>
        </div>
        <Link href="/apply/premium/2" className="text-[13px] font-medium text-[#5c3d2e]">
          주인공 변경
        </Link>
      </div>

      <h2 className="font-serif text-[22px] font-bold text-[#3d2b1f]">3. 당신의 이야기를 들려주세요</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-[#8b6f5c]">
        선택하신 주인공에 대한 이야기를 자유롭게 작성해주세요. 작성하신 내용은 가사와 음악 제작에 소중한 재료가 됩니다.
      </p>

      <div className="mt-5 space-y-6">
        {QUESTIONS.map((item, i) => (
          <div key={item.key}>
            <label className="mb-1 block text-[16px] font-semibold text-[#3d2b1f]">
              {i + 1}. {item.q}
            </label>
            <p className="mb-2 text-[13px] text-[#8b6f5c]">{item.hint}</p>
            <textarea
              rows={5}
              maxLength={item.max}
              value={answers[item.key]}
              onChange={(e) => update(item.key, e.target.value)}
              placeholder="자유롭게 작성해주세요"
              className="w-full resize-none rounded-xl border border-[#e8dfd4] bg-white px-4 py-3 text-[16px] outline-none focus:border-[#5c3d2e]"
            />
            <p className="mt-1 text-right text-[12px] text-[#8b6f5c]">
              {answers[item.key].length} / {item.max}
            </p>
          </div>
        ))}

        <div>
          <label className="mb-1 block text-[16px] font-semibold text-[#3d2b1f]">하고 싶은 말</label>
          <p className="mb-2 text-[13px] text-[#8b6f5c]">
            위 질문 외에 전하고 싶은 이야기를 자유롭게 적어주세요.
          </p>
          <textarea
            rows={7}
            maxLength={1000}
            value={answers.free}
            onChange={(e) => update("free", e.target.value)}
            placeholder="당신의 이야기를 자유롭게 들려주세요."
            className="w-full resize-none rounded-xl border border-[#e8dfd4] bg-white px-4 py-3 text-[16px] outline-none focus:border-[#5c3d2e]"
          />
          <p className="mt-1 text-right text-[12px] text-[#8b6f5c]">{answers.free.length} / 1000</p>
        </div>
      </div>

      <p className="mt-4 rounded-xl bg-[#f5efe6] px-4 py-3 text-[13px] leading-relaxed text-[#5c3d2e]">
        많이 쓸수록 더 깊고 감동적인 노래가 됩니다. 부담 없이 마음 가는 대로 작성해 주세요.
      </p>
    </ApplyLayout>
  );
}
