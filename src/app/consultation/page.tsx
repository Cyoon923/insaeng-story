import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Star, Calendar } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/Button";
import { formatPriceFrom } from "@/lib/constants/products";

const PURPOSES = [
  { icon: "❤️", title: "자존감·치유", sub: "마음의 회복" },
  { icon: "🧭", title: "진로·인생방향", sub: "앞길 탐색" },
  { icon: "👨‍👩‍👧", title: "가족관계", sub: "관계 이해" },
  { icon: "💕", title: "연애·관계", sub: "사랑의 흐름" },
  { icon: "💼", title: "직장·사업", sub: "일과 재물" },
  { icon: "🍃", title: "기타 고민", sub: "자유 상담" },
];

export default function ConsultationPage() {
  return (
    <MobileShell>
      <AppHeader variant="page" title="1:1 사주상담" subtitle="전문 상담사와 함께 당신의 흐름을 살펴보세요" backHref="/" />

      <div className="relative h-44">
        <Image
          src="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&h=300&fit=crop"
          alt=""
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute bottom-0 left-0 p-5 text-white">
          <p className="text-lg font-bold leading-snug">
            전문 상담사와 함께
            <br />
            당신의 현재와 미래를 더 깊이 이해하세요
          </p>
        </div>
      </div>

      {/* Counselor */}
      <div className="mx-4 -mt-6 relative rounded-2xl bg-white p-4 shadow-md ring-1 ring-border">
        <div className="flex items-center gap-3">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full">
            <Image
              src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&h=120&fit=crop"
              alt="이채윤 상담사"
              fill
              className="object-cover"
            />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-brown-dark">이채윤 상담사</span>
              <span className="rounded bg-ivory px-1.5 py-0.5 text-[10px] text-brown">인생스토리 전담</span>
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-gold">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-3 w-3 fill-gold text-gold" />
              ))}
              <span className="text-brown-light">5.0 (후기 128개)</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-brown-light">
              사람의 마음과 이야기에 귀 기울이며, 당신만의 특별한 인생길을 함께 찾아드립니다.
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-brown-light" />
        </div>
      </div>

      {/* Schedule */}
      <section className="px-4 py-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold text-brown-dark">상담 가능 일정</h3>
          <button type="button" className="text-xs text-brown">
            다른 날짜 보기 &gt;
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {["8/12 화", "8/13 수", "8/14 목", "8/15 금", "8/16 토"].map((d, i) => (
            <button
              key={d}
              type="button"
              className={`shrink-0 rounded-xl px-4 py-3 text-sm font-semibold ${
                i === 0 ? "bg-brown text-white" : "bg-ivory text-brown-dark"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          {["오전 10:00", "오후 2:00", "오후 6:00"].map((t, i) => (
            <button
              key={t}
              type="button"
              className={`flex-1 rounded-xl py-3 text-sm font-semibold ${
                i === 0 ? "bg-brown text-white" : "border border-border bg-white text-brown"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      {/* Purpose */}
      <section className="px-4 pb-6">
        <h3 className="mb-3 font-bold text-brown-dark">상담 목적을 선택해주세요</h3>
        <div className="grid grid-cols-2 gap-3">
          {PURPOSES.map((p) => (
            <button
              key={p.title}
              type="button"
              className="rounded-2xl border border-border bg-white p-4 text-left"
            >
              <span className="text-xl">{p.icon}</span>
              <p className="mt-2 text-sm font-bold text-brown-dark">{p.title}</p>
              <p className="text-xs text-brown-light">{p.sub}</p>
            </button>
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="sticky bottom-16 border-t border-border bg-cream px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-bold text-brown-dark">{formatPriceFrom(99000)}</p>
            <p className="text-xs text-brown-light">선택한 옵션에 따라 금액이 달라져요</p>
          </div>
          <Button href="/apply/consultation/1" size="lg" className="gap-2">
            <Calendar className="h-4 w-4" /> 상담 신청하기
          </Button>
        </div>
      </div>
    </MobileShell>
  );
}
