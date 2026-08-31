"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
              className="flex h-16 w-full items-center justify-center rounded-xl bg-[#403A49] text-[20px] font-semibold text-white"
            >
              어르신 쉬운 화면
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
