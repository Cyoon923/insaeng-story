"use client";

import { useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";

const TABS = [
  { id: "all", label: "전체" },
  { id: "parents", label: "부모님" },
  { id: "family", label: "가족" },
  { id: "pet", label: "반려동물" },
  { id: "love", label: "사랑" },
  { id: "self", label: "나의 이야기" },
] as const;

type CategoryId = (typeof TABS)[number]["id"];

const VIDEOS: { id: string; title: string; category: Exclude<CategoryId, "all"> }[] = [
  { id: "2ckhgD0XP-A", title: "보고싶다 울엄마", category: "parents" },
  { id: "GOmwOHmZ-4w", title: "포니 네가 있으면 좋아", category: "pet" },
  { id: "Q_DzSJQU6KA", title: "살아낸 하루", category: "self" },
  { id: "4paL0lkU6Lo", title: "내 속도로", category: "self" },
  { id: "cKoT_wCiDcs", title: "내 불씨야", category: "self" },
  { id: "Xfhvbd-6XoI", title: "네가 온 그날부터", category: "love" },
  { id: "94lEF9saIz4", title: "다시 웃는 캔디", category: "self" },
  { id: "zLgacL5bngk", title: "그러려니 웃어버리는 트롯 팝", category: "self" },
  { id: "xzijfOd_UN8", title: "거기 있으면 안 되잖아", category: "love" },
  { id: "vILp9lMvNPk", title: "내 인생은 꽃길이다", category: "self" },
  { id: "o7hhR3wP_6I", title: "아직도 네가 산다", category: "love" },
  { id: "UYvX7k84hu4", title: "멈춰버린 일상 속에서도", category: "self" },
  { id: "GQiPmravOhw", title: "공부할 때·일할 때 듣는 연주곡", category: "self" },
  { id: "Uo_6v5oLo_U", title: "너라는 비", category: "love" },
  { id: "GRzVS90gpzo", title: "10분간의 평온함", category: "self" },
  { id: "gs5qvtR0oaE", title: "사과 시러 우주 조아", category: "self" },
  { id: "JSfMZEedZWo", title: "로그아웃 증후군", category: "self" },
  { id: "7lUVzUfqzqk", title: "고양이 이별", category: "pet" },
  { id: "a68VXAj5DTQ", title: "첫사랑 생각에 잠 못 이룰때", category: "love" },
  { id: "WUopef4d4oc", title: "희노애락을 다 느끼고 싶을때", category: "self" },
  { id: "46LKeAiA0wg", title: "보란 듯 복수하고 싶을 때", category: "self" },
  { id: "lDP5Gx8dIGI", title: "여름앓이", category: "love" },
  { id: "BaJvNTIU_fk", title: "미치도록 보고싶을때", category: "love" },
  { id: "qqfV0CNnPaw", title: "닿지 못한 용서", category: "love" },
  { id: "17w3ypCWNUE", title: "그날의 우리", category: "love" },
  { id: "DKgEmo3jM_I", title: "새벽 3시의 불면증", category: "self" },
  { id: "lRItuLpuOrU", title: "오늘의 나는 어제와 달라", category: "self" },
];

export default function CasesPage() {
  const [tab, setTab] = useState<CategoryId>("all");
  const videos = tab === "all" ? VIDEOS : VIDEOS.filter((video) => video.category === tab);

  return (
    <MobileShell>
      <AppHeader variant="home" title="인생스토리" />

      <section className="px-4 py-5">
        <h2 className="font-serif text-[24px] font-bold text-[#3d2b1f]">제작 사례</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[#8b6f5c]">
          인생곡 창작소 유튜브의 완성 작품입니다.
        </p>
      </section>

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-4">
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`h-11 shrink-0 rounded-full px-4 text-[14px] font-semibold ${
                active ? "bg-[#5c3d2e] text-white" : "border border-[#d4c8ba] bg-[#faf6f1] text-[#5c3d2e]"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {videos.length === 0 ? (
        <div className="px-4 pb-8">
          <div className="rounded-2xl bg-white px-5 py-12 text-center ring-1 ring-[#ebe3d8]">
            <p className="text-[17px] font-bold text-[#3d2b1f]">준비 중입니다</p>
            <p className="mt-2 text-[15px] leading-relaxed text-[#8b6f5c]">
              이 주제의 완성 작품은 곧 공개됩니다.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-4 pb-8">
          {videos.map((video) => (
            <a
              key={video.id}
              href={`https://www.youtube.com/watch?v=${video.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <div className="relative aspect-video overflow-hidden rounded-xl bg-[#f5efe6]">
                <Image
                  src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}
                  alt={video.title}
                  fill
                  className="object-cover"
                  sizes="180px"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/15">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95">
                    <Play className="ml-0.5 h-4 w-4 fill-[#5c3d2e] text-[#5c3d2e]" />
                  </div>
                </div>
              </div>
              <h3 className="mt-2 line-clamp-2 text-[13px] font-bold leading-snug text-[#3d2b1f]">
                {video.title}
              </h3>
            </a>
          ))}
        </div>
      )}
    </MobileShell>
  );
}
