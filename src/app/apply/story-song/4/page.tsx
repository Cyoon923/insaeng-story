"use client";

import { useState } from "react";
import Image from "next/image";
import { ApplyLayout } from "@/components/apply/ApplyLayout";
import { cn } from "@/lib/utils";

const MOODS = ["따뜻한", "잔잔한", "희망적인", "감동적인", "아련한", "설렘 가득한", "차분한", "직접 입력"];

export default function ApplyStep4Page() {
  const [selectedMoods, setSelectedMoods] = useState<string[]>(["따뜻한"]);
  const [songCount, setSongCount] = useState(3);

  const toggleMood = (mood: string) => {
    setSelectedMoods((prev) =>
      prev.includes(mood) ? prev.filter((m) => m !== mood) : [...prev, mood]
    );
  };

  return (
    <ApplyLayout step={4} prevHref="/apply/story-song/3" nextHref="/apply/story-song/5">
      <h2 className="font-[family-name:var(--font-noto-serif-kr)] text-xl font-bold text-brown-dark">
        4. 어떤 노래로 만들어드릴까요?
      </h2>
      <p className="mt-2 text-sm text-brown-light">여러 개를 선택하시면 더 잘 반영됩니다.</p>

      <div className="mt-4 flex items-center justify-between rounded-xl bg-ivory p-3">
        <div className="flex items-center gap-2">
          <div className="relative h-8 w-8 overflow-hidden rounded-full">
            <Image
              src="https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=80&h=80&fit=crop"
              alt=""
              fill
              className="object-cover"
            />
          </div>
          <span className="text-sm text-brown-dark">
            선택한 주인공: <strong>부모님</strong>
          </span>
        </div>
        <button type="button" className="text-xs text-brown underline">
          주인공 변경
        </button>
      </div>

      <div className="mt-6">
        <p className="mb-3 text-sm font-semibold text-brown-dark">
          ① 어떤 가사 분위기가 좋으신가요? <span className="text-xs font-normal text-brown-light">복수 선택</span>
        </p>
        <div className="grid grid-cols-4 gap-2">
          {MOODS.map((mood) => (
            <button
              key={mood}
              type="button"
              onClick={() => toggleMood(mood)}
              className={cn(
                "rounded-xl border py-2.5 text-xs font-medium",
                selectedMoods.includes(mood)
                  ? "border-brown bg-brown/10 text-brown"
                  : "border-border bg-white text-brown-dark"
              )}
            >
              {mood}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-3 text-sm font-semibold text-brown-dark">
          ② 참고하고 싶은 가수와 노래 <span className="text-red-500">*</span>
        </p>
        {Array.from({ length: songCount }).map((_, i) => (
          <input
            key={i}
            type="text"
            placeholder={
              i === 0
                ? "예) 김광석 - 서른 즈음에"
                : i === 1
                  ? "예) 아이유 - 밤편지"
                  : "예) 성시경 - 너의 모든 순간"
            }
            className="mb-2 w-full rounded-xl border border-border bg-white px-4 py-3.5 text-base outline-none focus:border-brown"
          />
        ))}
        {songCount < 5 && (
          <button
            type="button"
            onClick={() => setSongCount((c) => Math.min(5, c + 1))}
            className="mt-1 w-full rounded-xl border border-dashed border-brown py-3 text-sm font-medium text-brown"
          >
            + 노래 추가하기 (최대 5곡까지)
          </button>
        )}
        <p className="mt-2 text-xs text-brown-light">
          💡 참고용이며, 원곡과 동일하게 만들지 않습니다.
        </p>
      </div>
    </ApplyLayout>
  );
}
