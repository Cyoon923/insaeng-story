import Image from "next/image";
import { ChevronRight, MessageCircle, Music, Clapperboard } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/Button";
import { formatPriceFrom } from "@/lib/constants/products";

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

export function ProductDetailPage({ config }: ProductDetailPageProps) {
  return (
    <MobileShell>
      <AppHeader variant="page" title={config.title} backHref="/" showActions />

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
            <h2 className="font-[family-name:var(--font-noto-serif-kr)] text-3xl font-bold">{config.title}</h2>
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
            <span className="text-[10px] text-brown-light">{f.sub}</span>
          </div>
        ))}
      </section>

      {/* Price + CTA */}
      <section className="flex items-center justify-between px-5 py-4">
        <p className="text-lg font-bold text-brown-dark">{formatPriceFrom(config.priceFrom)}</p>
        <Button href={config.applyHref} size="lg">
          신청하기 <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </section>

      {/* Recommend */}
      <section className="px-4 py-6">
        <h3 className="mb-4 text-base font-bold text-brown-dark">이런 분께 추천드려요</h3>
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

      {/* Process */}
      <section className="bg-ivory px-4 py-6">
        <h3 className="mb-4 text-base font-bold text-brown-dark">제작 과정</h3>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-2">
          {config.process.map((step, i) => (
            <div key={i} className="flex shrink-0 items-center gap-2">
              <div className="w-28 rounded-xl bg-card p-3 ring-1 ring-border">
                <span className="text-xs font-bold text-brown">{step.num}</span>
                <p className="mt-1 text-xs font-semibold text-brown-dark">{step.title}</p>
                <p className="mt-1 text-[10px] leading-relaxed text-brown-light">{step.desc}</p>
              </div>
              {i < config.process.length - 1 && (
                <ChevronRight className="h-4 w-4 shrink-0 text-brown-light" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 py-6">
        <h3 className="mb-4 text-base font-bold text-brown-dark">자주 묻는 질문</h3>
        <div className="space-y-2">
          {config.faqs.map((faq, i) => (
            <details key={i} className="group rounded-xl bg-card ring-1 ring-border">
              <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-sm font-medium text-brown-dark">
                {faq.question}
                <ChevronRight className="h-4 w-4 shrink-0 text-brown-light transition group-open:rotate-90" />
              </summary>
              <p className="border-t border-border px-4 pb-4 pt-2 text-sm leading-relaxed text-brown-light">
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
