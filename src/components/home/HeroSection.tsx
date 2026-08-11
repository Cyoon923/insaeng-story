import { MockupSlice, Hotspot } from "@/components/home/MockupSlice";

export function HeroSection() {
  return (
    <MockupSlice src="/images/home-hero.png" width={576} height={302} priority alt="히어로">
      <Hotspot
        href="/apply/story-song/1"
        ariaLabel="내 이야기 시작하기"
        className="bottom-[6%] left-[3%] h-[10%] w-[44%]"
      />
      <Hotspot
        href="/consultation"
        ariaLabel="무료 상담 신청하기"
        className="bottom-[6%] left-[48%] h-[10%] w-[49%]"
      />
    </MockupSlice>
  );
}
