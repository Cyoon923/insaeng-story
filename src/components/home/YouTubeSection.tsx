"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { useRef } from "react";
import { YOUTUBE_VIDEOS, YOUTUBE_CHANNEL_URL } from "@/lib/constants/youtube";

export function YouTubeSection() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -160 : 160, behavior: "smooth" });
  };

  return (
    <section className="bg-[#faf8f5] px-4 pb-5 pt-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded bg-[#ff0000] text-[8px] font-bold text-white">
              ▶
            </span>
            <h2 className="text-[17px] font-bold text-[#3d2b1f]">인생스토리 공식 유튜브</h2>
          </div>
          <p className="mt-1 pl-[22px] text-[13px] leading-relaxed text-[#8b6f5c]">
            실제 고객님의 이야기를 완성 작품으로 만나보세요.
          </p>
        </div>
        <a
          href={YOUTUBE_CHANNEL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-0.5 shrink-0 rounded-md bg-[#ff0000] px-3 py-1.5 text-[11px] font-bold text-white"
        >
          구독하기
        </a>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => scroll("left")}
          className="absolute -left-1 top-[38px] z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-[#ebe3d8]"
          aria-label="이전 영상"
        >
          <ChevronLeft className="h-4 w-4 text-[#8b6f5c]" />
        </button>
        <button
          type="button"
          onClick={() => scroll("right")}
          className="absolute -right-1 top-[38px] z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-[#ebe3d8]"
          aria-label="다음 영상"
        >
          <ChevronRight className="h-4 w-4 text-[#8b6f5c]" />
        </button>

        <div ref={scrollRef} className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1">
          {YOUTUBE_VIDEOS.map((video) => (
            <a
              key={video.id}
              href={`https://www.youtube.com/watch?v=${video.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-[138px] shrink-0"
            >
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl ring-1 ring-[#ebe3d8]">
                <Image src={video.thumbnail} alt={video.title} fill className="object-cover" sizes="138px" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow-sm">
                    <Play className="ml-0.5 h-3.5 w-3.5 fill-[#5c3d2e] text-[#5c3d2e]" />
                  </div>
                </div>
                {video.duration ? (
                  <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    {video.duration}
                  </span>
                ) : null}
              </div>
              <h3 className="mt-2 line-clamp-2 text-[11px] font-bold leading-snug text-[#3d2b1f]">
                {video.title}
              </h3>
              <p className="mt-0.5 text-[10px] text-[#8b6f5c]">{video.views}</p>
            </a>
          ))}
        </div>
      </div>

      <Link
        href="/cases"
        className="mt-3.5 flex w-full items-center justify-center gap-1 rounded-xl border border-[#d4c8ba] bg-white py-3 text-[13px] font-medium text-[#5c3d2e]"
      >
        제작 사례 더 보기 <ChevronRight className="h-4 w-4" />
      </Link>
    </section>
  );
}
