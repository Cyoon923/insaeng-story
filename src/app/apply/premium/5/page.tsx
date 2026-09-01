"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ApplyLayout } from "@/components/apply/ApplyLayout";
import { STORY_STEPS, CHARCOAL_STEPPER } from "@/components/apply/ApplyStepper";
import { formatPrice } from "@/lib/constants/products";
import { getDraft, saveDraft } from "@/lib/client/api";

const VIDEO_STYLES = [
  {
    name: "AI 실사 영상풍",
    desc: "실제 사람처럼 보이는 영상",
    image: "/images/video-style-live.png",
  },
  {
    name: "과거 레트로풍",
    desc: "옛날 사진처럼 따뜻하고 빛바랜 느낌",
    image: "/images/video-style-retro.png",
  },
  {
    name: "애니메이션풍",
    desc: "만화처럼 부드럽고 따뜻한 그림 느낌",
    image: "/images/video-style-animation.png",
  },
  {
    name: "스타일 상담 후 결정",
    desc: "어떤 스타일이 어울릴지 모르시겠다면 전화 상담을 통해 함께 결정해드립니다.",
    image: "/images/photo-video-style-consultation.png",
  },
];

const OPTIONS = [
  {
    id: "ai-mv",
    title: "내 얼굴 AI 뮤직비디오",
    price: 100000,
    desc: "얼굴 사진을 바탕으로 노래에 맞는 AI 뮤직비디오를 제작합니다.",
  },
  {
    id: "photo-mv",
    title: "추억사진 영상 제작",
    price: 50000,
    desc: "보내주신 사진을 인생곡에 맞춰 영상으로 편집합니다.",
  },
  {
    id: "lyric-edit",
    title: "가사 수정 1회 추가",
    price: 10000,
    desc: "기본 수정 1회에 더해 가사 수정을 1회 추가합니다.",
  },
  {
    id: "gift",
    title: "선물 패키지",
    price: null,
    desc: "음원, 가사 카드, 프리미엄 포장 등 실물 선물 구성입니다.",
  },
];

export default function ApplyStep5Page() {
  const [selected, setSelected] = useState<string[]>([]);
  const [videoStyle, setVideoStyle] = useState("AI 실사 영상풍");

  const persist = (ids: string[], style: string) => {
    const labels = OPTIONS.filter((opt) => ids.includes(opt.id)).map((opt) => opt.title);
    saveDraft("premium", {
      options: labels.join(", "),
      videoStyle: ids.includes("ai-mv") ? style : "",
    });
  };

  useEffect(() => {
    const draft = getDraft("premium");
    if (draft.options) {
      const ids = OPTIONS.filter((opt) => draft.options.includes(opt.title)).map((opt) => opt.id);
      if (ids.length) setSelected(ids);
    }
    if (draft.videoStyle) {
      const exists = VIDEO_STYLES.some((style) => style.name === draft.videoStyle);
      setVideoStyle(exists ? draft.videoStyle : "AI 실사 영상풍");
    }
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      const style = id === "ai-mv" && !next.includes("ai-mv") ? "AI 실사 영상풍" : videoStyle;
      if (id === "ai-mv" && !next.includes("ai-mv")) {
        setVideoStyle("AI 실사 영상풍");
      }
      persist(next, style);
      return next;
    });
  };

  const total = OPTIONS.filter((opt) => selected.includes(opt.id)).reduce(
    (sum, opt) => sum + (opt.price ?? 0),
    0
  );

  return (
    <ApplyLayout
      step={5}
      title="프리미엄 인생곡 신청하기"
      basePath="/apply/premium"
      steps={STORY_STEPS}
      prevHref="/apply/premium/4"
      nextHref="/apply/premium/6"
      heroText={"필요한 추가 옵션을\n선택해 주세요"}
    
      stepperTheme={CHARCOAL_STEPPER}
      shellBg="bg-[#FFFFFF]"
    >
      <h2 className="text-[22px] font-bold text-[#403A49]">5. 추가 옵션을 선택해주세요</h2>
      <p className="mt-2 text-[14px] text-[#6B6570]">여러 개를 함께 선택하실 수 있습니다.</p>

      <div className="mt-5 space-y-3">
        {OPTIONS.map((opt) => {
          const active = selected.includes(opt.id);
          return (
            <div
              key={opt.id}
              className={`rounded-2xl border p-4 ${
                active ? "border-[#403A49] bg-[#faf6f1]" : "border-[#e8dfd4] bg-white"
              }`}
            >
              <button type="button" onClick={() => toggle(opt.id)} className="flex w-full items-start gap-3 text-left">
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 text-[12px] ${
                    active ? "border-[#403A49] bg-[#403A49] text-white" : "border-[#d4c8ba] bg-white"
                  }`}
                >
                  {active ? "✓" : ""}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-bold text-[#403A49]">{opt.title}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-[#6B6570]">{opt.desc}</p>
                  <p className="mt-2 text-[15px] font-bold text-[#403A49]">
                    {opt.price !== null ? `+ ${formatPrice(opt.price)}` : "가격 별도 문의"}
                  </p>
                </div>
              </button>

              {opt.id === "ai-mv" && active ? (
                <div className="mt-4 border-t border-[#ebe3d8] pt-4">
                  <p className="text-[17px] font-semibold text-[#403A49]">
                    영상 스타일 <span className="text-red-500">*</span>
                  </p>
                  <p className="mt-1 text-[14px] text-[#6B6570]">사진을 보고 1개를 골라 주세요.</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {VIDEO_STYLES.map((style) => {
                      const styleActive = videoStyle === style.name;
                      return (
                        <button
                          key={style.name}
                          type="button"
                          onClick={() => {
                            setVideoStyle(style.name);
                            persist(selected, style.name);
                          }}
                          className={`overflow-hidden rounded-2xl bg-white text-left ${
                            styleActive ? "ring-2 ring-[#403A49]" : "ring-1 ring-[#ebe3d8]"
                          }`}
                        >
                          <div className="relative h-[88px] w-full bg-[#f5efe6]">
                            <Image src={style.image} alt="" fill className="object-cover" sizes="160px" />
                          </div>
                          <div className="px-2 py-2.5">
                            <p className="text-[14px] font-bold leading-snug text-[#3d2b1f]">{style.name}</p>
                            <p className="mt-1 text-[12px] leading-snug text-[#6B6570]">{style.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-between rounded-2xl bg-[#f5efe6] p-4">
        <span className="text-[14px] text-[#3d2b1f]">선택한 추가 옵션 금액</span>
        <span className="text-[20px] font-bold text-[#403A49]">{formatPrice(total)}</span>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-[#6B6570]">
        기본 상품 금액과 합산된 최종 금액은 다음 단계에서 확인하실 수 있습니다.
      </p>
    </ApplyLayout>
  );
}
