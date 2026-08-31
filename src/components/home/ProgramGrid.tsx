import Link from "next/link";
import Image from "next/image";
import { ChevronRight } from "lucide-react";

const PROGRAMS = [
  {
    id: "story",
    href: "/products/story",
    title: "이야기로 만드는 인생곡",
    desc: "직접 쓴 이야기 또는 소중한 사람의 이야기로 맞춤 가사와 음악을 만듭니다.",
    cta: "자세히 보기",
    image: "/images/photo-program-story-song.png",
  },
  {
    id: "premium",
    href: "/products/premium",
    title: "프리미엄 인생곡",
    desc: "사주상담, 스토리상담, 인생곡, 뮤직비디오까지 함께 진행합니다.",
    cta: "자세히 보기",
    image: "/images/photo-program-premium.png",
  },
  {
    id: "saju",
    href: "/products/saju-song",
    title: "사주 인생곡",
    desc: "상담 없이 사주 정보로 흐름과 메시지를 담아 인생곡을 만듭니다.",
    cta: "자세히 보기",
    image: "/images/photo-program-saju-song.png",
  },
  {
    id: "consultation",
    href: "/consultation",
    title: "사주 분석",
    desc: "인생곡과 별도로 받는 전문 사주상담입니다.",
    cta: "사주상담 신청하기",
    image: "/images/photo-program-saju-analysis.png",
  },
];

export function ProgramGrid() {
  return (
    <section className="bg-[#FFFFFF] px-4 py-5">
      <div className="mb-3.5 flex items-center justify-between">
        <h2 className="text-[17px] font-bold text-[#403A49]">프로그램</h2>
        <Link href="/products" className="flex items-center text-[13px] text-[#6B6570]">
          전체 보기 <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {PROGRAMS.map((p) => {
          return (
            <Link
              key={p.id}
              href={p.href}
              className="flex flex-col overflow-hidden rounded-2xl bg-[#FFFFFF] shadow-[0_1px_8px_rgba(92,61,46,0.06)] ring-1 ring-[#ebe3d8]"
            >
              {/* 사진이 이미지 영역 전체를 채운다. 부분 슬롯·페이드·아이콘을 두지 않아 구획선이 생기지 않는다. */}
              <div className="relative h-[88px] overflow-hidden bg-[#F7F6F8]">
                <Image
                  src={p.image}
                  alt=""
                  fill
                  className="object-cover object-center"
                  sizes="(max-width: 430px) 50vw, 200px"
                />
              </div>

              <div className="flex flex-1 flex-col px-3 pb-3 pt-2.5">
                <h3 className="text-[13px] font-bold leading-snug text-[#403A49]">{p.title}</h3>
                <p className="mt-1.5 flex-1 text-[11px] leading-[1.45] text-[#6B6570]">{p.desc}</p>
                <span className="mt-2.5 inline-flex w-fit items-center rounded-full border border-[#403A49] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#403A49]">
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
