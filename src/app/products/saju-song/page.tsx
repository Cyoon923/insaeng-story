"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductDetailPage } from "@/components/products/ProductDetailPage";
import { Grid3X3, Mic, Music, Play } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { formatPriceFrom } from "@/lib/constants/products";

const EASY_MODE_KEY = "insaeng-easy-mode";

const config = {
  slug: "saju-song",
  title: "사주 인생곡",
  badge: "사주 정보만 입력하면 OK!",
  heroImage: "/images/photo-ohaeng.png",
  description:
    "상담 없이 사주 정보와 당신의 이야기, 음악 취향을 함께 반영해 인생곡을 제작합니다.",
  features: [
    { icon: <Grid3X3 className="h-5 w-5" />, label: "사주 분석", sub: "운명 흐름" },
    { icon: <Mic className="h-5 w-5" />, label: "메시지 구성", sub: "자동 구성" },
    { icon: <Music className="h-5 w-5" />, label: "작사·작곡", sub: "맞춤 음악" },
    { icon: <Play className="h-5 w-5" />, label: "음원 파일", sub: "기본 제공" },
  ],
  priceFrom: 199000,
  applyHref: "/apply/saju-song/1",
  recommends: [
    {
      image: "/images/photo-self.jpg",
      title: "나만을 위한 특별한 노래를 원하시는 분",
    },
    {
      image: "/images/photo-career.jpg",
      title: "새로운 시작에 힘이 필요하신 분",
    },
    {
      image: "/images/photo-parents.jpg",
      title: "부모님이나 가족에게 노래를 선물하고 싶으신 분",
    },
    {
      image: "/images/photo-writing.jpg",
      title: "긴 상담이 부담스러우신 분",
    },
  ],
  process: [
    { num: "01", title: "사주 정보 입력", desc: "생년월일·시간을 입력합니다" },
    { num: "02", title: "당신의 이야기", desc: "글로 쓰거나 말로 들려주세요" },
    { num: "03", title: "AI 작사·작곡", desc: "사주와 이야기를 담아 곡을 만듭니다" },
    { num: "04", title: "완성·전달", desc: "음원과 가사를 전달합니다" },
  ],
  faqs: [
    {
      question: "사주 정보는 어떻게 제공하나요?",
      answer: "신청 시 이름, 연락처, 성별, 생년월일, 태어난 시간, 양력/음력, 혈액형을 입력해 주시면 됩니다. 태어난 시간을 모르셔도 신청할 수 있습니다.",
    },
    {
      question: "상담 없이도 가능한가요?",
      answer: "네. 사주 인생곡은 별도 상담 없이, 사주 정보와 당신의 이야기, 음악 취향을 반영해 제작합니다.",
    },
    {
      question: "제작 기간은?",
      answer: "결제 완료 후 평균 5~7일 정도 소요됩니다.",
    },
    {
      question: "수정은 몇 번 가능한가요?",
      answer: "기본 가사 수정 1회가 포함됩니다. 추가 수정은 옵션으로 선택하실 수 있습니다.",
    },
    {
      question: "완성된 노래는 어떻게 받나요?",
      answer: "음원 파일로 전달해 드립니다.",
    },
  ],
};

const EASY_STEPS = [
  { title: "1. 사주 정보 넣기" },
  {
    title: "2. 이야기와 좋아하는 노래 고르기",
    note: "이야기는 글로 쓰거나, 말로 할 수 있습니다",
  },
  { title: "3. 노래 만들기" },
  { title: "4. 완성해서 보내드리기" },
];

export default function SajuSongProductPage() {
  const [easyMode, setEasyMode] = useState(false);

  useEffect(() => {
    setEasyMode(localStorage.getItem(EASY_MODE_KEY) === "on");
  }, []);

  if (easyMode) {
    return (
      <MobileShell>
        <AppHeader variant="page" title="사주 인생곡" backHref="/products" />
        <section className="px-4 py-6">
          <p className="text-center text-[20px] font-bold leading-relaxed text-[#3d2b1f]">
            사주 정보를 넣으면
            <br />
            노래를 만들어 드립니다
          </p>
          <p className="mt-4 text-center text-[22px] font-bold text-[#5c3d2e]">
            {formatPriceFrom(config.priceFrom)}
          </p>
          <div className="mt-6 rounded-2xl bg-white px-4 py-5 ring-1 ring-[#ebe3d8]">
            <p className="text-[17px] font-bold text-[#3d2b1f]">이렇게 진행됩니다</p>
            <ul className="mt-3 space-y-3">
              {EASY_STEPS.map((step) => (
                <li key={step.title}>
                  <p className="text-[16px] leading-relaxed text-[#5c3d2e]">{step.title}</p>
                  {step.note ? (
                    <p className="mt-0.5 text-[14px] leading-relaxed text-[#8b6f5c]">{step.note}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
          <Link
            href={config.applyHref}
            className="mt-6 flex h-16 items-center justify-center rounded-xl bg-[#5c3d2e] text-[20px] font-semibold text-white"
          >
            신청하기
          </Link>
        </section>
      </MobileShell>
    );
  }

  return <ProductDetailPage config={config} />;
}
