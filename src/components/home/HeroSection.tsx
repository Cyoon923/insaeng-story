"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

const SLIDES = [
  {
    id: "story",
    badge: "",
    title: "사주로 이야기하고,\n노래로 남기다",
    desc: "사주 분석부터 인생 이야기, 그리고\n인생곡 제작까지\n당신의 삶을 하나의 이야기로 기록합니다.",
    image: "/images/photo-hero-sajulog-v2.webp",
    imageClass: "object-center",
    imageAlt: "노을 진 산과 호수 위로 별자리가 떠 있는 모습",
    primaryHref: "/consultation",
    primaryLabel: "사주 분석 시작하기",
    secondaryHref: "/products",
    secondaryLabel: "인생곡 제작 신청",
  },
  {
    id: "event",
    badge: "오픈 이벤트",
    title: "사연을 보내 주세요",
    desc: "추천을 통해 5분을 선정해\n프리미엄 인생곡을 만들어 드립니다.",
    image: "/images/photo-gift.jpg",
    imageClass: "object-center",
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
    image: "/images/photo-changjakso.png",
    imageClass: "object-center",
    imageAlt: "",
    primaryHref: "https://www.youtube.com/@Asha-Music-8",
    primaryLabel: "유튜브 바로가기",
    secondaryHref: "/apply/event?type=subscribe",
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
  // Hero 1 전용 배색·서체·레이아웃 분기. 다른 슬라이드는 기존 구성을 그대로 쓴다.
  const isStory = slide.id === "story";

  return (
    <section className="relative bg-[#FFFFFF] px-4 pb-4">
      {/* Hero 1은 -mx-4로 section의 px-4를 상쇄해 콘텐츠 가로폭을 꽉 채운다. */}
      <div
        className={`relative flex min-h-[300px] items-stretch overflow-hidden ${
          isStory ? "-mx-4" : ""
        }`}
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
        <div
          className={
            isStory
              ? "relative z-10 flex w-full flex-col justify-center px-5"
              : "relative z-10 flex w-[56%] flex-col justify-center pr-1"
          }
        >
          {slide.badge ? (
            <p className="mb-2 inline-flex w-fit rounded-full bg-[#c53030] px-2.5 py-1 text-[11px] font-bold text-white">
              {slide.badge}
            </p>
          ) : null}
          {/* Hero 1의 큰 제목. Hero 1만 Sans(본문 기본 서체)를 쓰고 Hero 2/3은 Serif다. */}
          {isStory ? (
            <p className="text-[28px] font-bold leading-[1.25] text-[#403A49]">사주로그</p>
          ) : null}
          <h2
            className={`whitespace-pre-line text-[22px] font-bold leading-[1.35] ${
              isStory ? "mt-2 max-w-[68%] text-[#403A49]" : "font-serif text-[#403A49]"
            }`}
          >
            {slide.title}
          </h2>
          <p
            className={`mt-3 whitespace-pre-line text-[13px] leading-relaxed ${
              isStory ? "max-w-[68%] text-[#222222]" : "text-[#6B6570]"
            }`}
          >
            {slide.desc}
          </p>
          {/* Hero 1만 가로 2열(동일 폭). Hero 2/3은 기존 세로 배치를 그대로 쓴다. */}
          <div className={isStory ? "mt-5 flex w-full flex-row gap-2" : "mt-5 flex w-full flex-col gap-2"}>
            <Link
              href={slide.primaryHref}
              target={slide.primaryHref.startsWith("http") ? "_blank" : undefined}
              rel={slide.primaryHref.startsWith("http") ? "noreferrer" : undefined}
              className={`inline-flex h-11 items-center justify-center whitespace-nowrap rounded-lg px-3 text-[13px] font-semibold text-white ${
                isStory ? "flex-1 basis-0 bg-[#403A49]" : "w-full bg-[#403A49]"
              }`}
            >
              {slide.primaryLabel}
              <ChevronRight className="ml-0.5 h-4 w-4" />
            </Link>
            {slide.secondaryLabel ? (
              <Link
                href={slide.secondaryHref}
                className={`inline-flex h-11 items-center justify-center whitespace-nowrap rounded-lg border px-3 text-[13px] font-semibold ${
                  isStory
                    ? "flex-1 basis-0 border-[#403A49] bg-[#fffdf9] text-[#403A49]"
                    : "w-full border-[#403A49] bg-[#fffdf9] text-[#403A49]"
                }`}
              >
                {slide.secondaryLabel}
              </Link>
            ) : null}
          </div>
        </div>

        {/*
          Hero 1의 이미지는 왼쪽 페이드가 원본에 그려져 있어 전체 폭 배경으로 깔고
          CSS gradient overlay를 두지 않는다 — 덧씌우면 오히려 경계가 생긴다.
          Hero 2/3은 기존 우측 52% 슬롯 + 좌측 페이드를 그대로 쓴다.
        */}
        <div
          className={
            isStory
              ? "pointer-events-none absolute inset-0"
              : "pointer-events-none absolute inset-y-0 right-0 w-[52%]"
          }
        >
          <Image
            src={slide.image}
            alt={slide.imageAlt}
            fill
            priority={index === 0}
            className={`object-cover ${slide.imageClass}`}
            sizes={isStory ? "430px" : "220px"}
          />
          {isStory ? null : (
            <div className="absolute inset-y-0 left-0 w-14 bg-gradient-to-r from-[#FFFFFF] to-transparent" />
          )}
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
