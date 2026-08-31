"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ChevronRight, MessageCircle, Music, Clapperboard, Star } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/Button";
import { formatPriceFrom } from "@/lib/constants/products";
import { displayReviewsForProduct, reviewsForProduct } from "@/lib/constants/reviews";

export interface ProductFeature {
  icon: React.ReactNode;
  label: string;
  sub: string;
}

export interface RecommendCard {
  image: string;
  title: string;
}

export interface ProcessStep {
  num: string;
  title: string;
  desc: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface ProductDetailConfig {
  slug: string;
  title: string;
  badge?: string;
  heroImage: string;
  description: string;
  features: ProductFeature[];
  priceFrom: number;
  applyHref: string;
  recommends: RecommendCard[];
  process: ProcessStep[];
  faqs: FaqItem[];
}

interface ProductDetailPageProps {
  config: ProductDetailConfig;
}

function DetailProcessCard({ step, fullWidth = false }: { step: ProcessStep; fullWidth?: boolean }) {
  return (
    <div
      className={`rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8] ${fullWidth ? "w-full" : "flex-1"}`}
    >
      <p className="text-[11px] font-bold text-[#6B6570]">{step.num}</p>
      <p className="mt-1 break-keep text-[14px] font-bold leading-snug text-[#3d2b1f]">{step.title}</p>
      <p className="mt-1 text-[12px] leading-snug text-[#6B6570]">{step.desc}</p>
    </div>
  );
}

function DetailProcessFlow({ steps }: { steps: ProcessStep[] }) {
  const rows: ProcessStep[][] = [];
  for (let i = 0; i < steps.length; i += 2) {
    rows.push(steps.slice(i, i + 2));
  }

  return (
    <div className="space-y-3">
      {rows.map((row, rowIndex) =>
        row.length === 1 ? (
          <DetailProcessCard key={row[0].num} step={row[0]} fullWidth />
        ) : (
          <div key={rowIndex} className="flex gap-2">
            {row.map((step) => (
              <DetailProcessCard key={step.num} step={step} />
            ))}
          </div>
        ),
      )}
    </div>
  );
}

export function ProductDetailPage({ config }: ProductDetailPageProps) {
  const [reviews, setReviews] = useState(() => reviewsForProduct(config.slug));

  useEffect(() => {
    fetch("/api/app", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { reviews?: { id: string; name: string; rating: number; text: string; kind?: string; title?: string }[] }) => {
        setReviews(displayReviewsForProduct(config.slug, data.reviews ?? []));
      })
      .catch(() => {});
  }, [config.slug]);

  return (
    <MobileShell>
      <AppHeader variant="page" title={config.title} backHref="/products" showActions />

      {/* Hero */}
      <section className="relative">
        <div className="relative h-52 w-full">
          <Image src={config.heroImage} alt="" fill className="object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent" />
          <div className="absolute bottom-0 left-0 p-5 text-white">
            {config.badge && (
              <span className="mb-2 inline-block rounded-full bg-white/20 px-3 py-1 text-xs backdrop-blur-sm">
                {config.badge}
              </span>
            )}
            <h2 className="font-serif text-3xl font-bold">{config.title}</h2>
            <p className="mt-2 max-w-[240px] text-sm leading-relaxed text-white/90">{config.description}</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="flex justify-around border-b border-border bg-cream px-4 py-4">
        {config.features.map((f, i) => (
          <div key={i} className="flex flex-col items-center text-center">
            <div className="mb-1.5 flex h-10 w-10 items-center justify-center rounded-full bg-ivory text-brown">
              {f.icon}
            </div>
            <span className="text-[11px] font-semibold text-brown-dark">{f.label}</span>
            <span className="text-[10px] text-[#6B6570]">{f.sub}</span>
          </div>
        ))}
      </section>

      {/* Price + CTA */}
      <section className="flex items-center justify-between gap-3 px-5 py-4">
        <p className="text-lg font-bold text-[#403A49]">{formatPriceFrom(config.priceFrom)}</p>
        <Button href={config.applyHref} size="lg">
          신청하기 <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </section>

      {/* Recommend */}
      <section className="px-4 py-6">
        <h3 className="mb-4 text-base font-bold text-[#403A49]">이런 분께 추천드려요</h3>
        <div className="grid grid-cols-2 gap-3">
          {config.recommends.map((item, i) => (
            <div key={i} className="overflow-hidden rounded-2xl bg-card ring-1 ring-border">
              <div className="relative h-28">
                <Image src={item.image} alt="" fill className="object-cover" />
              </div>
              <p className="p-3 text-xs leading-relaxed text-brown-dark">{item.title}</p>
            </div>
          ))}
        </div>
      </section>

      {reviews.length > 0 ? (
        <section className="px-4 pb-6">
          <h3 className="mb-1 text-base font-bold text-[#403A49]">이 상품을 받으신 분</h3>
          <p className="mb-4 text-[13px] text-[#6B6570]">완성 후 남겨 주신 후기입니다.</p>
          <div className="space-y-3">
            {reviews.map((review) => (
              <div key={review.id} className="rounded-2xl bg-card p-4 ring-1 ring-border">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[15px] font-bold text-[#403A49]">{review.name}</p>
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
      ) : null}

      {/* Process */}
      <section className="bg-ivory px-4 py-6">
        <h3 className="mb-4 text-base font-bold text-[#403A49]">제작 과정</h3>
        <DetailProcessFlow steps={config.process} />
      </section>

      {/* FAQ */}
      <section className="px-4 py-6">
        <h3 className="mb-4 text-base font-bold text-[#403A49]">자주 묻는 질문</h3>
        <div className="space-y-2">
          {config.faqs.map((faq, i) => (
            <details key={i} className="group rounded-xl bg-card ring-1 ring-border">
              <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-sm font-medium text-brown-dark">
                {faq.question}
                <ChevronRight className="h-4 w-4 shrink-0 text-brown-light transition group-open:rotate-90" />
              </summary>
              <p className="border-t border-border px-4 pb-4 pt-2 text-sm leading-relaxed text-[#6B6570]">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </section>
    </MobileShell>
  );
}

export const STORY_FEATURES: ProductFeature[] = [
  { icon: <MessageCircle className="h-5 w-5" />, label: "스토리상담", sub: "인생 이야기" },
  { icon: <Music className="h-5 w-5" />, label: "인생곡 제작", sub: "맞춤 음악" },
  { icon: <Clapperboard className="h-5 w-5" />, label: "뮤직비디오", sub: "영상 제작" },
];
