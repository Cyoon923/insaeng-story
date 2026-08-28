import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, Menu, User } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import {
  freeSajuBirthFromSearchParams,
  freeSajuBirthToQuery,
} from "@/lib/saju/free/unyulBirthQuery";

const HERO_IMAGE = "/images/unyul-home-visual.png";

const FOOTER_QUOTE =
  "좋은 흐름을 아는 것은,\n더 좋은 선택을 할 수 있는 힘이 됩니다.";

type HubMenuCard = {
  number: string;
  englishLabel: string;
  title: string;
  description: string;
  buttonLabel: string;
  href: string;
  imageSrc: string;
  imagePosition: string;
  ctaClassName: string;
};

const HUB_MENU_CARDS: Omit<HubMenuCard, "href">[] = [
  {
    number: "01",
    englishLabel: "BASIC INFORMATION",
    title: "기본 정보",
    description: "나의 사주 정보와\n타고난 흐름, 기본 균형을 확인해보세요.",
    buttonLabel: "살펴보기 →",
    imageSrc: "/images/photo-saju.jpg",
    imagePosition: "object-[70%_40%]",
    ctaClassName: "bg-[#3d2b1f]",
  },
  {
    number: "02",
    englishLabel: "YOUR BALANCE",
    title: "2026년 보완 기운",
    description: "올해 나에게 필요한 방향과\n중요한 포인트를 알아보세요.",
    buttonLabel: "결과 보기 →",
    // Neutral balance visual — not a single-element cue (sprout/fire/water).
    imageSrc: "/images/photo-tea.jpg",
    imagePosition: "object-center",
    ctaClassName: "bg-[#3f6b4f]",
  },
  {
    number: "03",
    englishLabel: "2026 OVERVIEW",
    title: "2026년 전체 흐름",
    description: "올해의 변화와 흐름을\n한눈에 확인해보세요.",
    buttonLabel: "살펴보기 →",
    imageSrc: "/images/unyul-home-visual.png",
    imagePosition: "object-center",
    ctaClassName: "bg-[#3d4a5c]",
  },
  {
    number: "04",
    englishLabel: "MUSIC FOR YOU",
    title: "나에게 맞는 음악",
    description: "지금의 흐름과 함께 듣는\n맞춤 음악을 만나보세요.",
    buttonLabel: "음악 듣기 →",
    imageSrc: "/images/photo-listen.jpg",
    imagePosition: "object-center",
    ctaClassName: "bg-[#5c4638]",
  },
];

const HUB_CARD_ROUTES = [
  "/unyul/basic-info",
  "/unyul/2026/supplement",
  "/unyul/2026/flow",
  "/unyul/music",
] as const;

function HubHeader({
  querySuffix,
  hasBirth,
}: {
  querySuffix: string;
  hasBirth: boolean;
}) {
  return (
    <header className="px-5 pt-5 pb-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-0.5">
          <Link
            href={`/unyul/input${querySuffix}`}
            aria-label="뒤로가기"
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#5c3d2e]"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.8} aria-hidden />
          </Link>
          <div className="min-w-0 pt-0.5">
            <h1 className="font-serif text-[22px] font-bold tracking-tight text-[#3d2b1f]">
              운율
            </h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#8a735a]">
              사주로 만나는
              <br />
              오늘의 흐름, 더 좋은 내일
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Link
            href={hasBirth ? `/unyul/basic-info${querySuffix}` : "/unyul/input"}
            className="flex h-11 min-w-[88px] items-center justify-center gap-1.5 rounded-full border border-[#ebe3d8] bg-white px-3 text-[13px] font-semibold text-[#5c3d2e] shadow-[0_1px_2px_rgba(61,43,31,0.04)]"
          >
            <User className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
            내 정보
          </Link>
          <Link
            href="/"
            aria-label="메뉴"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[#ebe3d8] bg-white text-[#5c3d2e] shadow-[0_1px_2px_rgba(61,43,31,0.04)]"
          >
            <Menu className="h-5 w-5" strokeWidth={1.8} aria-hidden />
          </Link>
        </div>
      </div>
    </header>
  );
}

function HubHero() {
  return (
    <section className="relative mx-5 mt-2 overflow-hidden rounded-[1.75rem] bg-[#f3eee6] shadow-[0_8px_28px_rgba(61,43,31,0.06)] ring-1 ring-[#ebe3d8]">
      <div className="relative grid min-h-[210px] grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)]">
        <div className="flex flex-col justify-center px-5 py-6 sm:px-6 sm:py-7">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[#8a735a]">
            MY UNYUL
          </p>
          <h2 className="mt-2 font-serif text-[28px] font-bold leading-tight tracking-tight text-[#3d2b1f] sm:text-[30px]">
            나의 운율
          </h2>
          <p className="mt-3 text-[13px] leading-relaxed text-[#5c3d2e] sm:text-[14px]">
            흐르는 시간을 이해하면,
            <br />
            지금의 선택이 더 선명해집니다.
          </p>
          <p className="mt-3 text-[12px] leading-relaxed text-[#8a735a] sm:text-[13px]">
            사주로 만나는 더 좋은 오늘,
            <br />
            운율이 함께합니다.
          </p>
        </div>
        <div className="relative min-h-[210px]">
          <Image
            src={HERO_IMAGE}
            alt=""
            fill
            priority
            className="object-cover object-center"
            sizes="(max-width: 430px) 45vw, 200px"
          />
          <div
            className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[#f3eee6] to-transparent"
            aria-hidden
          />
          <p className="absolute bottom-4 right-3 font-serif text-[12px] italic leading-snug text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)] sm:bottom-5 sm:text-[13px]">
            Your Better Flow
          </p>
        </div>
      </div>
    </section>
  );
}

function HubMenuCardItem({ card }: { card: HubMenuCard }) {
  return (
    <article className="overflow-hidden rounded-[1.75rem] bg-white shadow-[0_6px_20px_rgba(61,43,31,0.05)] ring-1 ring-[#ebe3d8]">
      <div className="grid min-h-[168px] grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
        <div className="flex flex-col justify-between px-4 py-4 sm:px-5 sm:py-5">
          <div>
            <p className="text-[12px] font-medium tracking-wide text-[#8a735a]">
              {card.number}
            </p>
            <p className="mt-1 text-[10px] font-semibold tracking-[0.14em] text-[#a08b78]">
              {card.englishLabel}
            </p>
            <h3 className="mt-1.5 font-serif text-[19px] font-bold leading-snug text-[#3d2b1f] sm:text-[20px]">
              {card.title}
            </h3>
            <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-[#6b5648] sm:text-[14px]">
              {card.description}
            </p>
          </div>
          <Link
            href={card.href}
            className={`mt-4 inline-flex h-10 w-fit items-center justify-center rounded-full px-4 text-[13px] font-semibold text-white ${card.ctaClassName}`}
          >
            {card.buttonLabel}
          </Link>
        </div>
        <div className="relative min-h-[168px]">
          <Image
            src={card.imageSrc}
            alt=""
            fill
            className={`object-cover ${card.imagePosition}`}
            sizes="(max-width: 430px) 42vw, 180px"
          />
          <div
            className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent"
            aria-hidden
          />
        </div>
      </div>
    </article>
  );
}

function HubInputPrompt() {
  return (
    <section className="rounded-[1.75rem] bg-white px-5 py-6 shadow-[0_6px_20px_rgba(61,43,31,0.05)] ring-1 ring-[#ebe3d8]">
      <p className="text-[15px] leading-relaxed text-[#5c3d2e]">
        먼저 생년월일과 태어난 시간을 알려주세요.
        <br />
        입력한 정보를 바탕으로 나의 운율을 살펴볼 수 있어요.
      </p>
      <Link
        href="/unyul/input"
        className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl bg-[#3d2b1f] text-[16px] font-semibold text-white shadow-[0_4px_14px_rgba(61,43,31,0.18)]"
      >
        사주 정보 입력하기 →
      </Link>
    </section>
  );
}

function HubQuote() {
  return (
    <div className="mx-5 mt-8 flex items-start gap-3">
      <span
        className="mt-0.5 font-serif text-[28px] leading-none text-[#c4b5a5]"
        aria-hidden
      >
        “
      </span>
      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-line font-serif text-[14px] leading-relaxed text-[#6b5648] sm:text-[15px]">
          {FOOTER_QUOTE}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <span className="h-px flex-1 bg-[#e5dccf]" aria-hidden />
          <span className="text-[11px] font-semibold tracking-[0.16em] text-[#a08b78]">
            UNYUL
          </span>
        </div>
      </div>
    </div>
  );
}

export default async function UnyulHubPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const parsed = freeSajuBirthFromSearchParams(params);
  const hasBirth = parsed.ok;
  const querySuffix = hasBirth ? `?${freeSajuBirthToQuery(parsed.input)}` : "";

  const menuCards: HubMenuCard[] = HUB_MENU_CARDS.map((card, index) => ({
    ...card,
    href: `${HUB_CARD_ROUTES[index]}${querySuffix}`,
  }));

  return (
    <MobileShell>
      <div className="bg-[#f9f7f2] pb-10">
        <HubHeader querySuffix={querySuffix} hasBirth={hasBirth} />
        <HubHero />
        <div className="mt-6 space-y-4 px-5">
          {hasBirth ? (
            menuCards.map((card) => (
              <HubMenuCardItem key={card.number} card={card} />
            ))
          ) : (
            <HubInputPrompt />
          )}
        </div>
        <HubQuote />
      </div>
    </MobileShell>
  );
}
