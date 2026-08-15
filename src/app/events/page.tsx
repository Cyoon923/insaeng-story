import Image from "next/image";
import Link from "next/link";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";

const EVENTS = [
  {
    title: "소중한 분께 인생곡 선물하기",
    desc: "이야기와 마음을 담아, 세상에 단 하나뿐인 노래를 선물하세요.",
    period: "상시 진행",
    image: "/images/photo-gift.jpg",
    href: "/products/story",
  },
  {
    title: "1:1 사주상담 안내",
    desc: "지금의 흐름을 살펴보고 앞으로의 방향을 함께 찾아드립니다.",
    period: "상시 진행 · 100,000원~",
    image: "/images/life-graph-radar.png",
    href: "/consultation",
  },
];

export default function EventsPage() {
  return (
    <MobileShell>
      <AppHeader variant="page" title="이벤트" backHref="/" />

      <section className="px-4 py-5">
        <h2 className="font-serif text-[24px] font-bold text-[#3d2b1f]">이벤트</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#8b6f5c]">
          진행 중인 이벤트와 혜택을 확인하세요.
        </p>
      </section>

      <div className="space-y-4 px-4 pb-8">
        {EVENTS.map((event) => (
          <Link
            key={event.title}
            href={event.href}
            className="block overflow-hidden rounded-2xl bg-white ring-1 ring-[#ebe3d8]"
          >
            <div className="relative h-36 w-full bg-[#f5efe6]">
              <Image src={event.image} alt="" fill className="object-cover" sizes="400px" />
            </div>
            <div className="p-4">
              <p className="text-[13px] font-medium text-[#5c3d2e]">{event.period}</p>
              <h3 className="mt-1 text-[18px] font-bold text-[#3d2b1f]">{event.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[#8b6f5c]">{event.desc}</p>
              <p className="mt-3 text-[14px] font-semibold text-[#5c3d2e]">자세히 보기 &gt;</p>
            </div>
          </Link>
        ))}
      </div>
    </MobileShell>
  );
}
