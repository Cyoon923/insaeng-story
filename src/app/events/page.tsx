import Image from "next/image";
import Link from "next/link";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";

export default function EventsPage() {
  return (
    <MobileShell>
      <AppHeader variant="page" title="이벤트" backHref="/" />

      <section className="px-4 py-5">
        <h2 className="font-serif text-[24px] font-bold text-[#3d2b1f]">이벤트</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#8b6f5c]">
          지금 진행 중인 이벤트입니다.
        </p>
      </section>

      <article className="mx-4 mb-8 overflow-hidden rounded-2xl bg-white ring-1 ring-[#ebe3d8]">
        <div className="relative h-40 w-full bg-[#f5efe6]">
          <Image src="/images/photo-hero.jpg" alt="" fill className="object-cover" sizes="400px" />
        </div>
        <div className="p-4">
          <p className="text-[13px] font-medium text-[#5c3d2e]">오픈 기념 · 진행 중</p>
          <h3 className="mt-1 text-[20px] font-bold leading-snug text-[#3d2b1f]">
            사연을 보내 주세요
          </h3>
          <p className="mt-3 text-[15px] leading-relaxed text-[#8b6f5c]">
            인생스토리 오픈을 기념해 사연을 받습니다. 보내 주신 사연을 살펴보고, 추천을 통해 5분을
            선정해 프리미엄 인생곡을 만들어 드립니다.
          </p>

          <div className="mt-5 rounded-2xl bg-[#f5efe6] p-4">
            <p className="text-[16px] font-bold text-[#3d2b1f]">선정되면 받는 것</p>
            <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
              프리미엄 인생곡 1곡. 사주상담, 스토리상담, 노래, 뮤직비디오가 포함됩니다.
            </p>
          </div>

          <div className="mt-4 rounded-2xl bg-[#f5efe6] p-4">
            <p className="text-[16px] font-bold text-[#3d2b1f]">이렇게 참여하세요</p>
            <ol className="mt-3 space-y-2 text-[15px] leading-relaxed text-[#5c3d2e]">
              <li>1. 아래 버튼으로 사연을 보냅니다</li>
              <li>2. 사연을 살펴보고 추천을 통해 5분을 선정합니다</li>
              <li>3. 선정된 분께 연락드려 프리미엄 인생곡을 만들어 드립니다</li>
            </ol>
          </div>

          <Link
            href="/apply/free-consult"
            className="mt-5 flex h-14 items-center justify-center rounded-xl bg-[#5c3d2e] text-[17px] font-semibold text-white"
          >
            사연 보내기
          </Link>
        </div>
      </article>

      <article
        id="subscribe"
        className="mx-4 mb-8 overflow-hidden rounded-2xl bg-white ring-1 ring-[#ebe3d8]"
      >
        <div className="relative h-40 w-full bg-[#f5efe6]">
          <Image src="/images/photo-listen.jpg" alt="" fill className="object-cover" sizes="400px" />
        </div>
        <div className="p-4">
          <p className="text-[13px] font-medium text-[#5c3d2e]">구독 이벤트 · 진행 중</p>
          <h3 className="mt-1 text-[20px] font-bold leading-snug text-[#3d2b1f]">
            인생곡 창작소 구독 이벤트
          </h3>
          <p className="mt-3 text-[15px] leading-relaxed text-[#8b6f5c]">
            유튜브 인생곡 창작소를 구독하고, 좋아요와 댓글을 남겨 주세요. 인생의 포춘타임을 알려
            드립니다.
          </p>

          <div className="mt-5 rounded-2xl bg-[#f5efe6] p-4">
            <p className="text-[16px] font-bold text-[#3d2b1f]">이렇게 참여하세요</p>
            <ol className="mt-3 space-y-2 text-[15px] leading-relaxed text-[#5c3d2e]">
              <li>1. 인생곡 창작소 유튜브를 구독합니다</li>
              <li>2. 영상에 좋아요를 누릅니다</li>
              <li>3. 댓글을 남깁니다</li>
              <li>4. 인생의 포춘타임을 안내받습니다</li>
            </ol>
          </div>

          <a
            href="https://www.youtube.com/@Asha-Music-8"
            target="_blank"
            rel="noreferrer"
            className="mt-5 flex h-14 items-center justify-center rounded-xl bg-[#5c3d2e] text-[17px] font-semibold text-white"
          >
            유튜브 바로가기
          </a>
          <Link
            href="/apply/free-consult"
            className="mt-3 flex h-14 items-center justify-center rounded-xl border border-[#d4c8ba] bg-white text-[17px] font-semibold text-[#5c3d2e]"
          >
            이벤트 신청
          </Link>
        </div>
      </article>
    </MobileShell>
  );
}
