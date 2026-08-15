import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-[#faf8f5] px-4 pb-4 pt-5">
      <div className="relative flex min-h-[268px] items-stretch">
        <div className="relative z-10 flex w-[56%] flex-col justify-center pr-1">
          <h2 className="font-serif text-[22px] font-bold leading-[1.35] text-[#3d2b1f]">
            당신의 이야기가
            <br />
            세상에 단 하나뿐인
            <br />
            노래가 됩니다
          </h2>
          <p className="mt-3 text-[13px] leading-relaxed text-[#8b6f5c]">
            당신의 삶을 특별한 노래로
            <br />
            오래도록 간직하세요.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <Link
              href="/products"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-[#5c3d2e] px-3 text-[13px] font-semibold text-white"
            >
              인생곡 만들기
              <ChevronRight className="ml-0.5 h-4 w-4" />
            </Link>
            <Link
              href="/consultation"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-[#d4c8ba] bg-white px-3 text-[13px] font-medium text-[#5c3d2e]"
            >
              사주상담
            </Link>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-y-0 right-0 w-[52%]">
          <Image
            src="/images/photo-hero-memories.png"
            alt="음악을 들으며 추억을 떠올리는 모습"
            fill
            priority
            className="object-cover object-[85%_center]"
            sizes="220px"
          />
          <div className="absolute inset-y-0 left-0 w-14 bg-gradient-to-r from-[#faf8f5] to-transparent" />
        </div>
      </div>

      <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
        <span className="h-1.5 w-1.5 rounded-full bg-[#5c3d2e]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#d4c8ba]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#d4c8ba]" />
      </div>
    </section>
  );
}
