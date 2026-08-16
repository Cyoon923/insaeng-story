"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

const SLIDES = [
  {
    id: "story",
    badge: "",
    title: "당신의 이야기가\n세상에 단 하나뿐인\n노래가 됩니다",
    desc: "당신의 삶을 특별한 노래로\n오래도록 간직하세요.",
    image: "/images/photo-hero-memories.png",
    imageAlt: "음악을 들으며 추억을 떠올리는 모습",
    primaryHref: "/products",
    primaryLabel: "인생곡 만들기",
    secondaryHref: "/consultation",
    secondaryLabel: "사주상담",
  },
  {
    id: "event",
    badge: "오픈 이벤트",
    title: "사연을 보내 주세요",
    desc: "추천을 통해 5분을 선정해\n프리미엄 인생곡을 만들어 드립니다.",
    image: "/images/photo-gift.jpg",
    imageAlt: "",
    primaryHref: "/events",
    primaryLabel: "사연 보내기",
    secondaryHref: "",
    secondaryLabel: "",
  },
  {
    id: "subscribe",
    badge: "구독 이벤트",
    title: "인생곡 창작소",
    desc: "구독·좋아요·댓글을 남기면\n인생의 포춘타임을 알려 드립니다.",
    image: "/images/photo-hero.jpg",
    imageAlt: "",
    primaryHref: "https://www.youtube.com/@Asha-Music-8",
    primaryLabel: "유튜브 바로가기",
    secondaryHref: "/apply/free-consult",
    secondaryLabel: "이벤트 신청",
  },
] as const;

export function HeroSection() {
  const [index, setIndex] = useState(0);
  const startX = useRef<number | null>(null);

  const goTo = (next: number) => {
    const last = SLIDES.length - 1;
    if (next < 0) setIndex(last);
    else if (next > last) setIndex(0);
    else setIndex(next);
  };

  const slide = SLIDES[index];

  return (
    <section className="relative bg-[#faf8f5] px-4 pb-4 pt-5">
      <div
        className="relative flex min-h-[300px] items-stretch overflow-hidden"
        onTouchStart={(e) => {
          startX.current = e.changedTouches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          if (startX.current === null) return;
          const endX = e.changedTouches[0]?.clientX ?? startX.current;
          const moved = endX - startX.current;
          startX.current = null;
          if (moved < -40) goTo(index + 1);
          if (moved > 40) goTo(index - 1);
        }}
      >
        <div className="relative z-10 flex w-[56%] flex-col justify-center pr-1">
          {slide.badge ? (
            <p className="mb-2 inline-flex w-fit rounded-full bg-[#c53030] px-2.5 py-1 text-[11px] font-bold text-white">
              {slide.badge}
            </p>
          ) : null}
          <h2 className="whitespace-pre-line font-serif text-[22px] font-bold leading-[1.35] text-[#3d2b1f]">
            {slide.title}
          </h2>
          <p className="mt-3 whitespace-pre-line text-[13px] leading-relaxed text-[#8b6f5c]">
            {slide.desc}
          </p>
          <div className="mt-5 flex w-full flex-col gap-2">
            <Link
              href={slide.primaryHref}
              target={slide.primaryHref.startsWith("http") ? "_blank" : undefined}
              rel={slide.primaryHref.startsWith("http") ? "noreferrer" : undefined}
              className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#5c3d2e] px-3 text-[13px] font-semibold text-white"
            >
              {slide.primaryLabel}
              <ChevronRight className="ml-0.5 h-4 w-4" />
            </Link>
            {slide.secondaryLabel ? (
              <Link
                href={slide.secondaryHref}
                className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-[#d4c8ba] bg-white px-3 text-[13px] font-medium text-[#5c3d2e]"
              >
                {slide.secondaryLabel}
              </Link>
            ) : null}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-y-0 right-0 w-[52%]">
          <Image
            src={slide.image}
            alt={slide.imageAlt}
            fill
            priority={index === 0}
            className="object-cover object-[85%_center]"
            sizes="220px"
          />
          <div className="absolute inset-y-0 left-0 w-14 bg-gradient-to-r from-[#faf8f5] to-transparent" />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-3">
        <button
          type="button"
          aria-label="이전 배너"
          onClick={() => goTo(index - 1)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d4c8ba] bg-white text-[#5c3d2e]"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <div className="flex items-center gap-1.5">
          {SLIDES.map((item, i) => (
            <button
              key={item.id}
              type="button"
              aria-label={`${i + 1}번째 배너`}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full ${
                i === index ? "w-4 bg-[#5c3d2e]" : "w-1.5 bg-[#d4c8ba]"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          aria-label="다음 배너"
          onClick={() => goTo(index + 1)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d4c8ba] bg-white text-[#5c3d2e]"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>
    </section>
  );
}
