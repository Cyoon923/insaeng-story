"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { HeroSection } from "@/components/home/HeroSection";
import { ProgramGrid } from "@/components/home/ProgramGrid";
import { YouTubeSection } from "@/components/home/YouTubeSection";
import { QuickLinks } from "@/components/home/QuickLinks";
import { UnyulOrbitGraphic } from "@/components/home/UnyulOrbitGraphic";

const EASY_MODE_KEY = "insaeng-easy-mode";

const EASY_LINKS = [
  { href: "/products", label: "인생곡 만들기" },
  { href: "/consultation", label: "사주상담 받기" },
  { href: "/events", label: "이벤트 보기" },
  { href: "/cases", label: "유튜브 보기" },
  { href: "/my", label: "내 신청 확인" },
] as const;

export default function HomePage() {
  const [easyMode, setEasyMode] = useState(false);

  useEffect(() => {
    setEasyMode(localStorage.getItem(EASY_MODE_KEY) === "on");
  }, []);

  const turnOnEasyMode = () => {
    localStorage.setItem(EASY_MODE_KEY, "on");
    setEasyMode(true);
  };

  const turnOffEasyMode = () => {
    localStorage.setItem(EASY_MODE_KEY, "off");
    setEasyMode(false);
  };

  return (
    <MobileShell>
      <AppHeader variant="home" />
      {easyMode ? (
        <section className="px-4 py-6">
          <p className="text-center text-[18px] leading-relaxed text-[#8b6f5c]">
            글씨가 큰 쉬운 화면입니다
          </p>
          <div className="mt-5 flex flex-col gap-3">
            {EASY_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex h-16 items-center justify-center rounded-xl bg-[#5c3d2e] text-[18px] font-semibold text-white"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <button
            type="button"
            onClick={turnOffEasyMode}
            className="mt-5 flex h-14 w-full items-center justify-center rounded-xl border border-[#d4c8ba] bg-white text-[17px] font-semibold text-[#5c3d2e]"
          >
            일반 화면으로
          </button>
        </section>
      ) : (
        <>
          <HeroSection />
          <div className="px-4">
            <button
              type="button"
              onClick={turnOnEasyMode}
              className="flex h-16 w-full items-center justify-center rounded-xl bg-[#5c3d2e] text-[20px] font-semibold text-white"
            >
              어르신 쉬운 화면
            </button>
          </div>
          <div className="px-4 pt-3 pb-1">
            <Link
              href="/unyul/input"
              className="relative block min-h-[148px] overflow-hidden rounded-2xl bg-gradient-to-br from-[#FFF9F2] via-[#FFF9F2] to-[#efeaf8] px-4 py-3.5 no-underline shadow-[0_1px_8px_rgba(92,61,46,0.05)] ring-1 ring-[#ebe3d8]"
            >
              <div
                className="pointer-events-none absolute bottom-[-20%] right-[-4%] h-[140px] w-[140px] rounded-full bg-[#ddd6fe]/40 blur-2xl"
                aria-hidden
              />

              <div className="relative z-10 w-[46%]">
                <p className="flex items-center gap-1 text-[12px] font-bold leading-none text-[#6B5BDB]">
                  운율
                  <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" fill="currentColor" aria-hidden>
                    <path d="M5 0L5.85 3.5L9.5 3.7L6.7 6.1L7.6 9.7L5 7.8L2.4 9.7L3.3 6.1L0.5 3.7L4.15 3.5L5 0Z" />
                  </svg>
                </p>
                <h3 className="mt-2 break-keep font-serif text-[18px] font-bold leading-[1.28] text-[#5B3A29]">
                  <span className="block">
                    나의 <span className="text-[#6B5BDB]">운을,</span>
                  </span>
                  <span className="block">노래로 채우다</span>
                </h3>
                <p className="mt-2 break-keep text-[12px] leading-[1.5] text-[#8C6F5C]">
                  <span className="block">나에게 보완이 될 수 있는 기운을</span>
                  <span className="block">음악과 함께 만나보세요.</span>
                </p>
                <span className="mt-2.5 inline-block text-[12px] font-semibold text-[#6B5BDB] underline decoration-[#6B5BDB]/50 underline-offset-[3px]">
                  무료로 시작하기 →
                </span>
              </div>

              {/* 시안처럼 카드 중~우측 중앙에 큰 그래픽 */}
              <div
                className="pointer-events-none absolute inset-y-0 left-[40%] right-0 flex items-center justify-center"
                aria-hidden
              >
                <UnyulOrbitGraphic className="h-[168px] w-[168px]" />
              </div>
            </Link>
          </div>
          <ProgramGrid />
          <YouTubeSection />
          <QuickLinks />
        </>
      )}
    </MobileShell>
  );
}
