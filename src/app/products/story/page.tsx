"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductDetailPage, STORY_FEATURES } from "@/components/products/ProductDetailPage";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { formatPriceFrom } from "@/lib/constants/products";

const EASY_MODE_KEY = "insaeng-easy-mode";

const config = {
  slug: "story",
  title: "인생곡",
  badge: "이야기로 만드는",
  heroImage: "/images/photo-writing.jpg",
  description: "직접 작성한 자신의 이야기 또는 소중한 사람의 이야기를 바탕으로 맞춤 가사와 음악을 제작합니다.",
  features: STORY_FEATURES,
  priceFrom: 149000,
  applyHref: "/apply/story-song/1",
  recommends: [
    {
      image: "/images/photo-parents.jpg",
      title: "부모님께 감동을 선물하고 싶으신 분",
    },
    {
      image: "/images/photo-couple.jpg",
      title: "연인 또는 배우자에게 특별한 마음을 전하고 싶으신 분",
    },
    {
      image: "/images/photo-pet.jpg",
      title: "반려동물과의 추억을 노래로 간직하고 싶으신 분",
    },
    {
      image: "/images/photo-self.jpg",
      title: "나만의 이야기를 노래로 남기고 싶으신 분",
    },
  ],
  process: [
    { num: "01", title: "신청·문의", desc: "온라인으로 간편하게 신청" },
    { num: "02", title: "상담·인터뷰", desc: "선생님과 이야기를 나눕니다" },
    { num: "03", title: "AI 작사·작곡", desc: "맞춤 가사와 음악을 제작합니다" },
    { num: "04", title: "완성·전달", desc: "완성된 작품을 전달합니다" },
  ],
  faqs: [
    {
      question: "이야기를 잘 못해도 괜찮을까요?",
      answer: "괜찮습니다. 선생님이 따뜻하게 이끌어 드리며, 질문에 답하시는 것만으로도 충분합니다.",
    },
    {
      question: "노래는 어떤 장르로 만들어지나요?",
      answer: "고객님이 좋아하시는 가수와 노래를 참고하여, 원하시는 분위기에 맞게 제작합니다.",
    },
    {
      question: "제작 기간은 얼마나 걸리나요?",
      answer: "결제 완료 후 평균 7~10일 정도 소요됩니다.",
    },
    {
      question: "수정은 몇 번까지 가능한가요?",
      answer: "기본 가사 수정 1회가 포함되어 있으며, 추가 수정은 옵션으로 선택하실 수 있습니다.",
    },
  ],
};

const EASY_STEPS = [
  { title: "1. 신청하기" },
  {
    title: "2. 이야기 접수",
    note: "글로 쓰거나, 말로 녹음할 수 있습니다",
  },
  { title: "3. 노래 만들기" },
  { title: "4. 완성해서 보내드리기" },
];

export default function StoryProductPage() {
  const [easyMode, setEasyMode] = useState(false);

  useEffect(() => {
    setEasyMode(localStorage.getItem(EASY_MODE_KEY) === "on");
  }, []);

  if (easyMode) {
    return (
      <MobileShell>
        <AppHeader variant="page" title="이야기 인생곡" backHref="/products" />
        <section className="px-4 py-6">
          <p className="text-center text-[20px] font-bold leading-relaxed text-[#403A49]">
            이야기를 적거나 말하면
            <br />
            노래를 만들어 드립니다
          </p>
          <p className="mt-4 text-center text-[22px] font-bold text-[#403A49]">
            {formatPriceFrom(config.priceFrom)}
          </p>
          <div className="mt-6 rounded-2xl bg-white px-4 py-5 ring-1 ring-[#ebe3d8]">
            <p className="text-[17px] font-bold text-[#403A49]">이렇게 진행됩니다</p>
            <ul className="mt-3 space-y-3">
              {EASY_STEPS.map((step) => (
                <li key={step.title}>
                  <p className="text-[16px] leading-relaxed text-[#5c3d2e]">{step.title}</p>
                  {step.note ? (
                    <p className="mt-0.5 text-[14px] leading-relaxed text-[#6B6570]">{step.note}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
          <Link
            href={config.applyHref}
            className="mt-6 flex h-16 items-center justify-center rounded-xl bg-[#403A49] text-[20px] font-semibold text-white"
          >
            신청하기
          </Link>
        </section>
      </MobileShell>
    );
  }

  return <ProductDetailPage config={config} />;
}
