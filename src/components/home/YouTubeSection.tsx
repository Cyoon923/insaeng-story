import { MockupSlice, Hotspot } from "@/components/home/MockupSlice";

export function YouTubeSection() {
  return (
    <section className="bg-[#faf8f5]">
      <MockupSlice src="/images/home-youtube-1.png" width={576} height={168} alt="유튜브">
        <Hotspot href="https://www.youtube.com" ariaLabel="구독하기" className="right-[3%] top-[8%] h-[20%] w-[22%]" />
        <Hotspot href="https://www.youtube.com" ariaLabel="영상 1" className="bottom-[12%] left-[3%] h-[58%] w-[23%]" />
        <Hotspot href="https://www.youtube.com" ariaLabel="영상 2" className="bottom-[12%] left-[26%] h-[58%] w-[23%]" />
        <Hotspot href="https://www.youtube.com" ariaLabel="영상 3" className="bottom-[12%] left-[49%] h-[58%] w-[23%]" />
        <Hotspot href="https://www.youtube.com" ariaLabel="영상 4" className="bottom-[12%] left-[72%] h-[58%] w-[25%]" />
      </MockupSlice>
      <MockupSlice src="/images/home-youtube-2.png" width={576} height={28} alt="유튜브 더보기">
        <Hotspot href="https://www.youtube.com" ariaLabel="유튜브에서 더 많은 이야기 보기" className="inset-0" />
      </MockupSlice>
    </section>
  );
}
