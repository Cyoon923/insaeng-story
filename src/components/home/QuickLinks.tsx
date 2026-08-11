import { MockupSlice, Hotspot } from "@/components/home/MockupSlice";

export function QuickLinks() {
  return (
    <section className="bg-[#faf8f5]">
      <MockupSlice src="/images/home-quicklinks.png" width={576} height={64} alt="빠른 메뉴">
        <Hotspot href="/events" ariaLabel="이벤트" className="left-0 top-0 h-full w-[33%]" />
        <Hotspot href="/faq" ariaLabel="자주 묻는 질문" className="left-[33%] top-0 h-full w-[34%]" />
        <Hotspot href="/notice" ariaLabel="공지사항" className="left-[67%] top-0 h-full w-[33%]" />
      </MockupSlice>
    </section>
  );
}
