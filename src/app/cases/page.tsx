"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, Heart, ExternalLink } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { cn } from "@/lib/utils";
import { YOUTUBE_CHANNEL_URL } from "@/lib/constants/youtube";

const CATEGORIES = ["전체", "부모님", "가족", "반려동물", "사랑", "나의 이야기"];

const CASES = [
  {
    id: "1",
    title: "어머니의 삶을 노래로 담다",
    category: "부모님",
    duration: "4:35",
    image: "https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=400&h=400&fit=crop",
  },
  {
    id: "2",
    title: "우리 가족의 이야기",
    category: "가족",
    duration: "5:10",
    image: "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=400&h=400&fit=crop",
  },
  {
    id: "3",
    title: "반려견 뭉치의 추억",
    category: "반려동물",
    duration: "3:48",
    image: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=400&fit=crop",
  },
  {
    id: "4",
    title: "평생의 동반자에게",
    category: "사랑",
    duration: "4:22",
    image: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=400&h=400&fit=crop",
  },
  {
    id: "5",
    title: "나의 50년 인생",
    category: "나의 이야기",
    duration: "6:05",
    image: "https://images.unsplash.com/photo-1455396577869-51adff057779?w=400&h=400&fit=crop",
  },
  {
    id: "6",
    title: "아버지께 전하는 마음",
    category: "부모님",
    duration: "4:15",
    image: "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=400&h=400&fit=crop",
  },
];

export default function CasesPage() {
  const [active, setActive] = useState("전체");
  const filtered = active === "전체" ? CASES : CASES.filter((c) => c.category === active);

  return (
    <MobileShell>
      <AppHeader variant="home" title="인생스토리" />

      <section className="px-4 py-5">
        <h2 className="font-[family-name:var(--font-noto-serif-kr)] text-2xl font-bold text-brown-dark">
          제작 사례
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-brown-light">
          실제 고객님의 이야기가
          <br />
          어떻게 노래로 탄생했는지 만나보세요.
        </p>
      </section>

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-4">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActive(cat)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium",
              active === cat ? "bg-brown text-white" : "bg-ivory text-brown-dark"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 pb-6">
        {filtered.map((item) => (
          <article key={item.id}>
            <div className="relative aspect-square overflow-hidden rounded-2xl">
              <Image src={item.image} alt={item.title} fill className="object-cover" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90">
                  <Play className="h-5 w-5 fill-brown text-brown" />
                </div>
              </div>
              <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                {item.duration}
              </span>
            </div>
            <div className="mt-2 flex items-start justify-between gap-1">
              <div>
                <h3 className="text-xs font-bold text-brown-dark">{item.title}</h3>
                <p className="text-[10px] text-brown-light">
                  {item.category} 인생곡 · {item.duration}
                </p>
              </div>
              <Heart className="h-4 w-4 shrink-0 text-brown-light" />
            </div>
          </article>
        ))}
      </div>

      <div className="mx-4 mb-6 rounded-2xl bg-ivory p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-red-600 text-[10px] font-bold text-white">
            ▶
          </span>
          <p className="text-sm text-brown-dark">인생스토리 유튜브에서 더 많은 인생곡을 만나보세요.</p>
        </div>
        <Link
          href={YOUTUBE_CHANNEL_URL}
          className="mt-3 flex items-center justify-center gap-1 rounded-xl border border-brown py-2.5 text-sm font-medium text-brown"
        >
          인생곡 바로가기 <ExternalLink className="h-4 w-4" />
        </Link>
      </div>
    </MobileShell>
  );
}
