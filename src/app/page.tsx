"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Star, ChevronRight } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { HeroSection } from "@/components/home/HeroSection";
import { ProgramGrid } from "@/components/home/ProgramGrid";
import { YouTubeSection } from "@/components/home/YouTubeSection";
import { QuickLinks } from "@/components/home/QuickLinks";

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
    <MobileShell bgClass="bg-[#FFFFFF]">
      <AppHeader variant="home" />
      {easyMode ? (
        <section className="px-4 py-6">
          <p className="text-center text-[18px] leading-relaxed text-[#6B6570]">
            글씨가 큰 쉬운 화면입니다
          </p>
          <div className="mt-5 flex flex-col gap-3">
            {EASY_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex h-16 items-center justify-center rounded-xl bg-[#403A49] text-[18px] font-semibold text-white"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <button
            type="button"
            onClick={turnOffEasyMode}
            className="mt-5 flex h-14 w-full items-center justify-center rounded-xl border border-[#403A49] bg-[#fffdf9] text-[17px] font-semibold text-[#403A49]"
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
              className="relative flex w-full items-center gap-4 overflow-hidden rounded-[20px] border border-[#d9cdf2] bg-[#f6f2fd] px-5 py-5 text-left shadow-[0_2px_10px_rgba(90,70,150,0.10)]"
            >
              {/* 오른쪽 위 리본 */}
              <span
                aria-hidden
                className="absolute -right-[34px] top-[14px] flex w-[110px] rotate-45 items-center justify-center gap-0.5 bg-[#7c5cd6] py-1 text-[12px] font-bold tracking-[0.08em] text-white shadow-[0_1px_3px_rgba(90,70,150,0.35)]"
              >
                <Star className="h-3 w-3 fill-[#ffd54a] text-[#ffd54a]" strokeWidth={0} />
                추천
              </span>

              <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#ece4fb]">
                <Image
                  src="/images/icon-easy-mode-seniors.png"
                  alt=""
                  width={128}
                  height={128}
                  className="h-[52px] w-[52px] object-contain"
                />
              </span>

              <span className="flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="text-[20px] font-bold text-[#403A49]">쉬운 화면으로 보기</span>
                  <ChevronRight className="h-5 w-5 text-[#403A49]" strokeWidth={2.5} />
                </span>
                <span className="mt-1.5 block text-[15px] leading-[1.5] text-[#5d5570]">
                  큰 글씨와 간단한 메뉴로
                  <br />
                  편하게 이용해요.
                </span>
              </span>
            </button>
          </div>
          <ProgramGrid />
          <YouTubeSection />
          <QuickLinks />
        </>
      )}
    </MobileShell>
  );
}
