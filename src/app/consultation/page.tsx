"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronRight,
  Star,
  ClipboardList,
  Pencil,
  MessageCircle,
  CheckCircle,
} from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { CONSULT_REVIEWS, displayReviewsForProduct } from "@/lib/constants/reviews";

const RECOMMENDS = [
  {
    title: "앞으로의 방향이\n고민되는 분",
    desc: "이직·사업·진로 등\n중요한 선택을 앞두고 있을 때",
    image: "/images/photo-career.jpg",
  },
  {
    title: "연애와 인연이\n궁금한 분",
    desc: "연애·결혼·궁합 등\n관계의 흐름이 궁금할 때",
    image: "/images/photo-couple.jpg",
  },
  {
    title: "재물과 일의 흐름이\n궁금한 분",
    desc: "금전·직장·사업의 흐름을\n살펴보고 싶을 때",
    image: "/images/photo-talk.jpg",
  },
  {
    title: "마음속 고민을\n나누고 싶은 분",
    desc: "혼자 결정하기 어려운 고민을\n편안하게 이야기하고 싶을 때",
    image: "/images/photo-tea.jpg",
  },
];

const FIELDS = [
  "전체적인 운세",
  "재물·금전",
  "직장·사업",
  "연애·인연",
  "결혼·궁합",
  "가족",
  "진로",
  "올해의 흐름",
];

const STEPS = [
  { num: "01", title: "상담 신청", desc: "선생님과 시간을 고릅니다", icon: ClipboardList },
  { num: "02", title: "사주정보 입력", desc: "생년월일과 시간을 알려주세요", icon: Pencil },
  { num: "03", title: "선생님과 1:1 상담", desc: "카카오톡 또는 전화로 약 50분", icon: MessageCircle },
  { num: "04", title: "상담 완료", desc: "흐름과 방향을 정리합니다", icon: CheckCircle },
];

const FAQS = [
  {
    q: "처음 사주상담을 받아도 괜찮을까요?",
    a: "괜찮습니다. 선생님이 편안하게 이끌어 드리며, 궁금한 것부터 천천히 살펴봅니다.",
  },
  {
    q: "상담은 어떻게 진행되나요?",
    a: "카카오톡 상담 또는 전화 상담 중 하나를 선택해, 약 50분 동안 진행합니다. 화상 상담은 하지 않습니다.",
  },
  {
    q: "상담 후에는 무엇을 받을 수 있나요?",
    a: "상담을 통해 지금의 흐름과 앞으로의 방향을 함께 정리해 드립니다. 상담 기록 요약 리포트는 신청 시 옵션으로 선택하실 수 있습니다.",
  },
];

export default function ConsultationPage() {
  const [reviews, setReviews] = useState(CONSULT_REVIEWS);

  useEffect(() => {
    fetch("/api/app", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { reviews?: { id: string; name: string; rating: number; text: string; kind?: string; title?: string }[] }) => {
        setReviews(displayReviewsForProduct("consultation", data.reviews ?? []));
      })
      .catch(() => {});
  }, []);

  return (
    <MobileShell>
      <AppHeader
        variant="page"
        title="1:1 사주상담"
        subtitle="전문 선생님과 함께 당신의 흐름을 살펴보세요"
        backHref="/"
      />

      <section className="relative overflow-hidden bg-[#faf8f5] px-4 pb-4 pt-5">
        <div className="relative flex min-h-[268px] items-stretch">
          <div className="relative z-10 flex w-[56%] flex-col justify-center pr-1">
            <p className="text-[13px] font-medium text-[#5c3d2e]">혼자 고민하지 마세요</p>
            <h2 className="mt-2 break-keep font-serif text-[20px] font-bold leading-[1.4] text-[#3d2b1f]">
              지금의 흐름을
              <br />
              이해하면
              <br />
              앞으로의 방향이
              <br />
              보입니다
            </h2>
            <p className="mt-3 break-keep text-[13px] leading-relaxed text-[#8b6f5c]">
              사주를 바탕으로
              <br />
              현재의 고민과 흐름을
              <br />
              살펴보고 방향을 찾습니다.
            </p>
            <p className="mt-4 text-[18px] font-bold text-[#3d2b1f]">100,000원~</p>
            <Link
              href="/apply/consultation/1"
              className="mt-4 inline-flex h-11 items-center justify-center rounded-lg bg-[#5c3d2e] px-3 text-[13px] font-semibold text-white"
            >
              사주상담 신청하기
              <ChevronRight className="ml-0.5 h-4 w-4" />
            </Link>
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex w-[48%] items-center justify-end">
            <div className="relative aspect-square h-full overflow-hidden rounded-2xl">
              <Image
                src="/images/life-graph-radar.png"
                alt=""
                fill
                priority
                className="object-cover"
                sizes="268px"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-6">
        <h3 className="text-[17px] font-bold text-[#3d2b1f]">상담 선생님 소개</h3>
        <div className="mt-3 space-y-3">
          <div className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
            <div className="flex items-start gap-3">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-[#f5efe6]">
                <Image
                  src="/images/photo-yubi-teacher.png"
                  alt="유비 선생"
                  fill
                  className="object-cover object-top"
                  sizes="64px"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[16px] font-bold text-[#3d2b1f]">유비 선생</p>
                  <span className="rounded bg-[#f5efe6] px-2 py-0.5 text-[10px] text-[#5c3d2e]">
                    인생스토리 전담 선생
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-[#c4a574] text-[#c4a574]" />
                  ))}
                  <span className="text-[12px] text-[#8b6f5c]">5.0 (후기 128개)</span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-[#8b6f5c]">
                  사람의 마음과 이야기에 귀 기울이며, 당신만의 특별한 인생길을 함께 찾아드립니다.
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
            <div className="flex items-start gap-3">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-[#f5efe6]">
                <Image
                  src="/images/photo-haeja-teacher.png"
                  alt="해자 선생"
                  fill
                  className="object-cover object-top"
                  sizes="64px"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[16px] font-bold text-[#3d2b1f]">해자 선생</p>
                  <span className="rounded bg-[#f5efe6] px-2 py-0.5 text-[10px] text-[#5c3d2e]">
                    인생스토리 전담 선생
                  </span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-[#8b6f5c]">
                  사람의 마음과 이야기에 귀 기울이며, 당신만의 특별한 인생길을 함께 찾아드립니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-6">
        <h3 className="text-[17px] font-bold text-[#3d2b1f]">상담에서 보는 그래프</h3>
        <p className="mt-2 break-keep text-[14px] leading-relaxed text-[#8b6f5c]">
          10개 항목을 개별 그래프와 누적 그래프로 살펴보며 방향을 정리합니다.
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <p className="mb-2 text-[15px] font-bold text-[#3d2b1f]">개별 그래프</p>
            <p className="mb-2 text-[13px] text-[#8b6f5c]">항목별 흐름을 따로 봅니다.</p>
            <div className="overflow-hidden rounded-2xl bg-[#f3f4f6] ring-1 ring-[#ebe3d8]">
              <Image
                src="/images/life-graph-business.png"
                alt="개별 그래프 예시"
                width={1400}
                height={420}
                className="h-auto w-full"
              />
            </div>
          </div>
          <div>
            <p className="mb-2 text-[15px] font-bold text-[#3d2b1f]">누적 그래프</p>
            <p className="mb-2 text-[13px] text-[#8b6f5c]">흐름을 모아 함께 봅니다.</p>
            <div className="overflow-hidden rounded-2xl bg-[#f3f4f6] ring-1 ring-[#ebe3d8]">
              <Image
                src="/images/life-graph-health.png"
                alt="누적 그래프 예시"
                width={1400}
                height={420}
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-6">
        <h3 className="text-[17px] font-bold text-[#3d2b1f]">이런 분께 추천드려요</h3>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {RECOMMENDS.map((item) => (
            <div key={item.title} className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#ebe3d8]">
              <div className="relative h-24">
                <Image src={item.image} alt="" fill className="object-cover" sizes="180px" />
              </div>
              <div className="p-3">
                <p className="whitespace-pre-line break-keep text-[13px] font-bold leading-snug text-[#3d2b1f]">{item.title}</p>
                <p className="mt-1 whitespace-pre-line break-keep text-[11px] leading-relaxed text-[#8b6f5c]">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 pb-6">
        <h3 className="text-[17px] font-bold text-[#3d2b1f]">상담 분야</h3>
        <p className="mt-1 text-[13px] text-[#8b6f5c]">이런 주제로 상담을 받으실 수 있습니다.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {FIELDS.map((field) => (
            <div
              key={field}
              className="rounded-xl bg-[#f5efe6] px-3 py-3 text-center text-[13px] font-medium text-[#3d2b1f]"
            >
              {field}
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#f5efe6] px-4 py-6">
        <h3 className="text-[17px] font-bold text-[#3d2b1f]">상담은 이렇게 진행돼요</h3>
        <div className="mt-4 grid grid-cols-4 gap-1">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.num} className="flex flex-col items-center text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#5c3d2e]">
                  <Icon className="h-4 w-4" />
                </div>
                <p className="mt-2 text-[10px] font-bold text-[#8b6f5c]">{step.num}</p>
                <p className="text-[11px] font-bold leading-snug text-[#3d2b1f]">{step.title}</p>
                <p className="mt-1 text-[10px] leading-snug text-[#8b6f5c]">{step.desc}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex gap-2">
          <span className="rounded-full bg-white px-3 py-1.5 text-[12px] text-[#5c3d2e]">카카오톡 또는 전화</span>
          <span className="rounded-full bg-white px-3 py-1.5 text-[12px] text-[#5c3d2e]">약 50분</span>
        </div>
      </section>

      <section className="px-4 py-6">
        <h3 className="text-[17px] font-bold text-[#3d2b1f]">상담 후기</h3>
        <p className="mt-1 text-[13px] text-[#8b6f5c]">유비 선생과 상담하신 분의 이야기입니다.</p>
        <div className="mt-3 space-y-3">
          {reviews.map((review) => (
            <div key={review.id} className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[15px] font-bold text-[#3d2b1f]">{review.name}</p>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: review.rating }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-[#c4a574] text-[#c4a574]" />
                  ))}
                </div>
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-[#5c3d2e]">{review.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 pb-8">
        <h3 className="text-[17px] font-bold text-[#3d2b1f]">자주 묻는 질문</h3>
        <div className="mt-3 space-y-2">
          {FAQS.map((faq) => (
            <details key={faq.q} className="rounded-xl bg-white ring-1 ring-[#ebe3d8]">
              <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-[14px] font-medium text-[#3d2b1f]">
                {faq.q}
                <ChevronRight className="h-4 w-4 shrink-0 text-[#8b6f5c]" />
              </summary>
              <p className="border-t border-[#ebe3d8] px-4 pb-4 pt-3 text-[13px] leading-relaxed text-[#8b6f5c]">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </section>
    </MobileShell>
  );
}
