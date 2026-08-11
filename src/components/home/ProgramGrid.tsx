import { MockupSlice, Hotspot } from "@/components/home/MockupSlice";

export function ProgramGrid() {
  return (
    <MockupSlice src="/images/home-programs.png" width={576} height={332} alt="프로그램">
      <Hotspot href="/products" ariaLabel="전체 보기" className="right-0 top-[1%] h-[12%] w-[32%]" />
      <Hotspot href="/products/story" ariaLabel="이야기로 만드는 인생곡" className="left-0 top-[14%] h-[42%] w-[50%]" />
      <Hotspot href="/products/premium" ariaLabel="프리미엄 인생곡" className="left-[50%] top-[14%] h-[42%] w-[50%]" />
      <Hotspot href="/products/saju-song" ariaLabel="사주 인생곡" className="left-0 top-[56%] h-[44%] w-[50%]" />
      <Hotspot href="/consultation" ariaLabel="1:1 사주상담" className="left-[50%] top-[56%] h-[44%] w-[50%]" />
    </MockupSlice>
  );
}
