"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronRight,
  Pencil,
  ClipboardList,
  MessageCircle,
  Music,
} from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { LIFE_SONG_PRODUCTS, CONSULTATION, formatPriceFrom } from "@/lib/constants/products";

const TABS = [
  { id: "all", label: "전체" },
  { id: "story", label: "인생곡 제작" },
  { id: "premium", label: "프리미엄" },
  { id: "saju-song", label: "사주 인생곡" },
  { id: "consultation", label: "상담" },
] as const;

const ITEMS = [
  {
    id: "story",
    href: LIFE_SONG_PRODUCTS[0].href,
    title: LIFE_SONG_PRODUCTS[0].title,
    description: LIFE_SONG_PRODUCTS[0].description,
    price: formatPriceFrom(LIFE_SONG_PRODUCTS[0].priceFrom),
    image: LIFE_SONG_PRODUCTS[0].heroImage,
    features: ["맞춤 작사·작곡", "이야기 반영", "음원 파일 제공"],
  },
  {
    id: "premium",
    href: LIFE_SONG_PRODUCTS[1].href,
    title: LIFE_SONG_PRODUCTS[1].title,
    description: LIFE_SONG_PRODUCTS[1].description,
    price: formatPriceFrom(LIFE_SONG_PRODUCTS[1].priceFrom),
    image: LIFE_SONG_PRODUCTS[1].heroImage,
    features: ["사주상담", "스토리상담", "뮤직비디오"],
  },
  {
    id: "saju-song",
    href: LIFE_SONG_PRODUCTS[2].href,
    title: LIFE_SONG_PRODUCTS[2].title,
    description: LIFE_SONG_PRODUCTS[2].description,
    price: formatPriceFrom(LIFE_SONG_PRODUCTS[2].priceFrom),
    image: LIFE_SONG_PRODUCTS[2].heroImage,
    features: ["사주 분석", "상담 없음", "음원 파일 제공"],
  },
  {
    id: "consultation",
    href: CONSULTATION.href,
    title: CONSULTATION.title,
    description: CONSULTATION.description,
    price: formatPriceFrom(CONSULTATION.priceFrom),
    image: "/images/photo-yubi-teacher.png",
    features: ["전문 선생님", "카카오톡·전화", "약 50분"],
  },
];

const PROCESS = [
  { num: "01", label: "신청·문의", icon: ClipboardList },
  { num: "02", label: "상담·인터뷰", icon: MessageCircle },
  { num: "03", label: "AI 작사·작곡", icon: Pencil },
  { num: "04", label: "완성·전달", icon: Music },
];

const EASY_MODE_KEY = "insaeng-easy-mode";

const EASY_ITEMS = [
  {
    href: LIFE_SONG_PRODUCTS[0].href,
    title: "이야기 인생곡",
    description: "내가 쓴 이야기로 노래를 만듭니다",
    price: formatPriceFrom(LIFE_SONG_PRODUCTS[0].priceFrom),
  },
  {
    href: LIFE_SONG_PRODUCTS[1].href,
    title: "프리미엄 인생곡",
    description: "상담부터 노래, 영상까지 함께합니다",
    price: formatPriceFrom(LIFE_SONG_PRODUCTS[1].priceFrom),
  },
  {
    href: LIFE_SONG_PRODUCTS[2].href,
    title: "사주 인생곡",
    description: "사주 정보로 노래를 만듭니다",
    price: formatPriceFrom(LIFE_SONG_PRODUCTS[2].priceFrom),
  },
];

function ProcessStep({ step, className = "" }: { step: (typeof PROCESS)[number]; className?: string }) {
  const Icon = step.icon;
  return (
    <div className={`rounded-xl bg-white p-3 ring-1 ring-[#ebe3d8] ${className}`}>
      <div className="flex items-center gap-2.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f5efe6] text-[#5c3d2e]">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-[#8b6f5c]">{step.num}</p>
          <p className="break-keep text-[13px] font-bold leading-snug text-[#3d2b1f]">{step.label}</p>
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");
  const [easyMode, setEasyMode] = useState(false);
  const items = tab === "all" ? ITEMS : ITEMS.filter((item) => item.id === tab);

  useEffect(() => {
    setEasyMode(localStorage.getItem(EASY_MODE_KEY) === "on");
  }, []);

  if (easyMode) {
    return (
      <MobileShell>
        <AppHeader variant="page" title="인생곡" backHref="/" />
        <section className="px-4 py-6">
          <p className="text-center text-[20px] font-bold leading-relaxed text-[#3d2b1f]">
            어떤 노래를 만들까요?
          </p>
          <div className="mt-6 flex flex-col gap-4">
            {EASY_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-[88px] flex-col items-center justify-center rounded-xl bg-[#5c3d2e] px-4 py-5 text-center"
              >
                <span className="text-[22px] font-bold text-white">{item.title}</span>
                <span className="mt-1 text-[15px] leading-relaxed text-white/90">{item.description}</span>
                <span className="mt-2 text-[16px] font-semibold text-white">{item.price}</span>
              </Link>
            ))}
          </div>
        </section>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <AppHeader variant="page" title="인생곡" backHref="/" />

      <section className="relative h-44 overflow-hidden">
        <Image src="/images/photo-products-hero.png" alt="" fill className="object-cover object-center" priority />
        <div className="absolute inset-0 bg-[#faf8f5]/70" />
        <div className="relative z-10 flex h-full flex-col justify-end px-5 pb-5">
          <h2 className="font-serif text-[28px] font-bold text-[#3d2b1f]">상품</h2>
          <p className="mt-1 text-[14px] leading-relaxed text-[#5c3d2e]">
            당신의 이야기에 가장 어울리는
            <br />
            인생스토리를 선택하세요.
          </p>
        </div>
      </section>

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-4">
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`h-10 shrink-0 rounded-full px-4 text-[13px] font-semibold ${
                active
                  ? "bg-[#5c3d2e] text-white"
                  : "border border-[#d4c8ba] bg-[#faf6f1] text-[#5c3d2e]"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-3 px-4 pb-6">
        {items.map((item) => (
          <article
            key={item.id}
            className="flex gap-3 rounded-2xl bg-white p-3 ring-1 ring-[#ebe3d8]"
          >
            <div className="relative h-[92px] w-[92px] shrink-0 overflow-hidden rounded-xl bg-[#f5efe6]">
              <Image src={item.image} alt="" fill className="object-cover" sizes="92px" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-bold leading-snug text-[#3d2b1f]">{item.title}</h3>
              <p className="mt-1 text-[12px] leading-relaxed text-[#8b6f5c]">{item.description}</p>
              <p className="mt-1.5 text-[11px] text-[#8b6f5c]">{item.features.join(" · ")}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[14px] font-bold text-[#5c3d2e]">{item.price}</span>
                <Link
                  href={item.href}
                  className="inline-flex h-8 items-center rounded-full border border-[#d4c8ba] bg-white px-3 text-[12px] font-medium text-[#5c3d2e]"
                >
                  자세히 보기 <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>

      <section className="px-4 pb-6">
        <h3 className="text-[17px] font-bold text-[#3d2b1f]">인생곡 제작 과정</h3>
        <p className="mt-1 text-[13px] text-[#8b6f5c]">
          당신의 이야기가 노래가 되는 과정입니다. 기본 가사 수정 1회가 포함됩니다.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {PROCESS.map((step) => (
            <ProcessStep key={step.num} step={step} />
          ))}
        </div>
      </section>

      <section className="px-4 pb-8">
        <div className="rounded-2xl bg-[#f5efe6] px-4 py-5">
          <p className="text-[15px] font-bold leading-snug text-[#3d2b1f]">
            어떤 상품이 나에게 맞을지
            <br />
            고민되시나요?
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-[#8b6f5c]">
            무료 상담을 통해 자세히 안내해드릴게요.
          </p>
          <Link
            href="/apply/free-consult"
            className="mt-4 inline-flex h-11 items-center justify-center rounded-lg bg-[#5c3d2e] px-5 text-[14px] font-semibold text-white"
          >
            무료 상담 신청 <ChevronRight className="ml-0.5 h-4 w-4" />
          </Link>
        </div>
      </section>
    </MobileShell>
  );
}
