import Link from "next/link";
import Image from "next/image";
import { ChevronRight, Pencil, Crown, Sparkles, Headphones } from "lucide-react";

const PROGRAMS = [
  {
    id: "story",
    href: "/products/story",
    title: "이야기로 만드는 인생곡",
    desc: "직접 쓴 이야기 또는 소중한 사람의 이야기로 맞춤 가사와 음악을 만듭니다.",
    cta: "자세히 보기",
    icon: Pencil,
    iconBg: "bg-[#5c3d2e]",
    image: "/images/photo-writing.jpg",
  },
  {
    id: "premium",
    href: "/products/premium",
    title: "프리미엄 인생곡",
    desc: "사주상담, 스토리상담, 인생곡, 뮤직비디오까지 함께 진행합니다.",
    cta: "자세히 보기",
    icon: Crown,
    iconBg: "bg-[#c4a574]",
    image: "/images/photo-premium-life.png",
  },
  {
    id: "saju",
    href: "/products/saju-song",
    title: "사주 인생곡",
    desc: "상담 없이 사주 정보로 흐름과 메시지를 담아 인생곡을 만듭니다.",
    cta: "자세히 보기",
    icon: Sparkles,
    iconBg: "bg-[#8b7aab]",
    image: "/images/photo-ohaeng.png",
  },
  {
    id: "consultation",
    href: "/consultation",
    title: "1:1 사주상담",
    desc: "인생곡과 별도로 받는 전문 사주상담입니다.",
    cta: "상담 신청하기",
    icon: Headphones,
    iconBg: "bg-[#6b8f6e]",
    image: "/images/photo-yubi-teacher.png",
  },
];

export function ProgramGrid() {
  return (
    <section className="bg-[#faf8f5] px-4 py-5">
      <div className="mb-3.5 flex items-center justify-between">
        <h2 className="text-[17px] font-bold text-[#3d2b1f]">프로그램</h2>
        <Link href="/products" className="flex items-center text-[13px] text-[#8b6f5c]">
          전체 보기 <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {PROGRAMS.map((p) => {
          const Icon = p.icon;
          return (
            <Link
              key={p.id}
              href={p.href}
              className="flex flex-col overflow-hidden rounded-2xl bg-[#faf6f1] shadow-[0_1px_8px_rgba(92,61,46,0.06)] ring-1 ring-[#ebe3d8]"
            >
              <div className="relative h-[88px] overflow-hidden bg-[#f5efe6]">
                <div className={`absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full ${p.iconBg} shadow-sm`}>
                  <Icon className="h-[18px] w-[18px] text-white" strokeWidth={1.8} />
                </div>
                <div className="absolute -right-1 bottom-0 h-[88px] w-[62%] overflow-hidden">
                  <Image
                    src={p.image}
                    alt=""
                    fill
                    className="object-cover object-center opacity-90"
                    sizes="150px"
                  />
                  <div className="absolute inset-0 bg-gradient-to-l from-transparent via-[#f5efe6]/30 to-[#f5efe6]" />
                </div>
              </div>

              <div className="flex flex-1 flex-col px-3 pb-3 pt-2.5">
                <h3 className="text-[13px] font-bold leading-snug text-[#3d2b1f]">{p.title}</h3>
                <p className="mt-1.5 flex-1 text-[11px] leading-[1.45] text-[#8b6f5c]">{p.desc}</p>
                <span className="mt-2.5 inline-flex w-fit items-center rounded-full border border-[#d4c8ba] bg-white px-3 py-1.5 text-[11px] font-medium text-[#5c3d2e]">
                  {p.cta} <ChevronRight className="ml-0.5 h-3 w-3" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
