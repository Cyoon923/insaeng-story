import Image from "next/image";
import { Play } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { YOUTUBE_CHANNEL_URL } from "@/lib/constants/youtube";
import { loadChannelVideos } from "@/lib/server/youtubeFeed";

export const revalidate = 600;

export default async function CasesPage() {
  const videos = await loadChannelVideos();

  return (
    <MobileShell>
      <AppHeader variant="page" title="유튜브" backHref="/" />

      <section className="px-4 py-5">
        <h2 className="font-serif text-[24px] font-bold text-[#403A49]">유튜브</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[#6B6570]">
          인생곡 창작소 유튜브의 완성 작품입니다.
        </p>
        <a
          href={YOUTUBE_CHANNEL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex h-12 items-center justify-center rounded-xl bg-[#403A49] text-[15px] font-semibold text-white"
        >
          유튜브 바로가기
        </a>
      </section>

      <div className="grid grid-cols-2 gap-3 px-4 pb-8">
        {videos.map((video) => (
          <a
            key={video.id}
            href={`https://www.youtube.com/watch?v=${video.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <div className="relative aspect-video overflow-hidden rounded-xl bg-[#f5efe6]">
              <Image
                src={video.thumbnail}
                alt={video.title}
                fill
                className="object-cover"
                sizes="180px"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/15">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95">
                  <Play className="ml-0.5 h-4 w-4 fill-[#5c3d2e] text-[#5c3d2e]" />
                </div>
              </div>
            </div>
            <h3 className="mt-2 line-clamp-2 text-[13px] font-bold leading-snug text-[#403A49]">
              {video.title}
            </h3>
          </a>
        ))}
      </div>
    </MobileShell>
  );
}
