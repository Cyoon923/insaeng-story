"use client";

import { useState } from "react";
import { ApplyLayout } from "@/components/apply/ApplyLayout";
import { formatPrice } from "@/lib/constants/products";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { id: "ai-mv", title: "내 얼굴 AI 뮤직비디오", price: 100000, recommended: true },
  { id: "photo-mv", title: "추억사진 영상 제작", price: 50000 },
  { id: "lyric-edit", title: "가사 수정 1회 추가", price: 10000 },
  { id: "gift", title: "선물 패키지", price: null, label: "별도 문의" },
];

export default function ApplyStep5Page() {
  const [selected, setSelected] = useState<string[]>([]);

  const total = OPTIONS.filter((o) => selected.includes(o.id)).reduce(
    (sum, o) => sum + (o.price ?? 0),
    0
  );

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <ApplyLayout step={5} prevHref="/apply/story-song/4" nextHref="/apply/story-song/6">
      <h2 className="font-[family-name:var(--font-noto-serif-kr)] text-xl font-bold text-brown-dark">
        5. 추가 옵션을 선택해주세요
      </h2>
      <p className="mt-2 text-sm text-brown-light">복수 선택 가능합니다.</p>

      <div className="mt-5 space-y-3">
        {OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => toggle(opt.id)}
            className={cn(
              "flex w-full items-center justify-between rounded-2xl border p-4 text-left",
              selected.includes(opt.id) ? "border-brown bg-brown/5" : "border-border bg-white"
            )}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-brown-dark">{opt.title}</span>
                {opt.recommended && (
                  <span className="rounded bg-brown px-1.5 py-0.5 text-[10px] text-white">추천</span>
                )}
              </div>
              <span className="text-sm font-bold text-brown">
                {opt.price !== null ? `+ ${formatPrice(opt.price)}` : opt.label}
              </span>
            </div>
            <div
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded border-2",
                selected.includes(opt.id) ? "border-brown bg-brown text-white" : "border-border"
              )}
            >
              {selected.includes(opt.id) && "✓"}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between rounded-2xl bg-ivory p-4">
        <span className="text-sm text-brown-dark">선택한 추가 옵션 금액</span>
        <span className="text-xl font-bold text-brown">{formatPrice(total)}</span>
      </div>
      <p className="mt-2 text-xs text-brown-light">
        💡 기본 상품 금액과 합산된 최종 금액은 다음 단계에서 확인하실 수 있습니다.
      </p>
    </ApplyLayout>
  );
}
