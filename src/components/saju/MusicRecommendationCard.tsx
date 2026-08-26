import type { MusicRecommendationReasonView } from "@/lib/saju/music/types";

export type FreeResultMusicCardModel = MusicRecommendationReasonView & {
  id: string;
  youtubeUrl: string;
  thumbnailUrl?: string;
};

function resolveThumbnail(card: FreeResultMusicCardModel): string | null {
  if (card.thumbnailUrl) return card.thumbnailUrl;
  const match = card.youtubeUrl.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/,
  );
  if (!match?.[1]) return null;
  return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
}

/**
 * Single music recommendation card for Unyul free result.
 * Does not show element / rank / TOP labels.
 */
export function MusicRecommendationCard({ card }: { card: FreeResultMusicCardModel }) {
  const thumb = resolveThumbnail(card);

  return (
    <article className="overflow-hidden rounded-2xl bg-[#faf7f2] ring-1 ring-[#ebe3d8]">
      <div className="flex gap-3 p-3">
        <div className="relative h-[72px] w-[96px] shrink-0 overflow-hidden rounded-xl bg-[#ebe3d8]">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-[12px] text-[#8b6f5c]">음악</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-serif text-[16px] font-semibold leading-snug text-[#3d2b1f]">
            {card.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[#6b5648]">{card.message}</p>
          {card.badges.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {card.badges.map((badge) => (
                <span
                  key={badge}
                  className="rounded-full bg-[#f3eefc] px-2 py-0.5 text-[11px] font-medium text-[#7c3aed]"
                >
                  {badge}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className="border-t border-[#ebe3d8] px-3 py-2.5">
        <p className="text-[13px] leading-relaxed text-[#5c3d2e]">{card.reason}</p>
        <a
          href={card.youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2.5 inline-flex min-h-10 items-center justify-center rounded-xl bg-[#5c3d2e] px-4 text-[14px] font-semibold text-white"
        >
          YouTube에서 듣기
        </a>
      </div>
    </article>
  );
}
