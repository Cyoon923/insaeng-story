import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ExternalLink, Menu, User } from "lucide-react";
import type { FreeResultMusicCardModel } from "@/components/saju/MusicRecommendationCard";
import { MobileShell } from "@/components/layout/MobileShell";
import {
  buildAdjustedClimateSummary,
  buildMusicRecommendationReason,
  buildNeedCandidateSet,
  buildNeedResolution,
  buildObservationInterpretation,
  buildStrengthObservations,
  buildStrengthSummary,
  collectStrengthEvidence,
  deriveMusicRecommendationGate,
} from "@/lib/saju";
import { resolveFinalElement } from "@/lib/saju/final";
import { resolveSupplementFlow } from "@/lib/saju/final/resolveSupplementFlow";
import { buildFreeSajuPipeline } from "@/lib/saju/free/buildFreeSajuPipeline";
import type { FreeSajuBirthFormInput } from "@/lib/saju/free/buildFreeSajuPillars";
import {
  freeSajuBirthFromSearchParams,
  freeSajuBirthToQuery,
} from "@/lib/saju/free/unyulBirthQuery";
import { deriveAnnualPresentationGate } from "@/lib/saju/luck/annual/deriveAnnualPresentationGate";
import { resolveAnnualSupplementFlowV2 } from "@/lib/saju/luck/annual/resolveAnnualSupplementFlowV2";
import { selectMusicBySupplementElement } from "@/lib/saju/music/selectMusicBySupplementElement";
import { buildSpeakableOutput } from "@/lib/saju/speakable/buildSpeakableOutput";
import { readData } from "@/lib/server/store";

const ANNUAL_YEAR = 2026;
const MAX_MUSIC_CARDS = 3;
const HERO_IMAGE = "/images/photo-listen.jpg";

const BLOCKED_MUSIC_MESSAGE =
  "현재 정보로는 2026년 추천 음악을 한 방향으로 정하기 어려워요.";

const SECTION_INTRO =
  "지금의 흐름에 맞춰 고른 음악을 편안하게 들어보세요.";

const BADGE_TONES = [
  "bg-[#eef4ee] text-[#4a7c59]",
  "bg-[#eef2f6] text-[#4a6b8a]",
  "bg-[#f5efe8] text-[#8a735a]",
] as const;

function buildQuerySuffix(input: FreeSajuBirthFormInput): string {
  return `?${freeSajuBirthToQuery(input)}`;
}

function easyEngineError(message: string): string {
  if (message.includes("범위")) return "입력하신 연도는 아직 계산할 수 없어요. 다시 입력해 주세요.";
  if (message.includes("윤달")) return "윤달 정보를 다시 확인해 주세요.";
  if (message.includes("음력") || message.includes("양력")) return "생년월일을 다시 확인해 주세요.";
  return "입력 내용을 다시 확인해 주세요.";
}

function resolveThumbnail(card: FreeResultMusicCardModel): string | null {
  if (card.thumbnailUrl) return card.thumbnailUrl;
  const match = card.youtubeUrl.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/,
  );
  if (!match?.[1]) return null;
  return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
}

function SectionBadge({ number }: { number: string }) {
  return (
    <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[#f3eee6] px-2 text-[12px] font-semibold tracking-wide text-[#8a735a]">
      {number}
    </span>
  );
}

function MusicHeader({
  hubHref,
  basicInfoHref,
}: {
  hubHref: string;
  basicInfoHref: string;
}) {
  return (
    <header className="px-5 pt-5 pb-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-0.5">
          <Link
            href={hubHref}
            aria-label="뒤로가기"
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#5c3d2e]"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.8} aria-hidden />
          </Link>
          <div className="min-w-0 pt-0.5">
            <h1 className="font-serif text-[22px] font-bold tracking-tight text-[#3d2b1f]">
              운율
            </h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#8a735a]">
              사주로 만나는
              <br />
              오늘의 흐름, 더 좋은 내일
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Link
            href={basicInfoHref}
            className="flex h-11 min-w-[88px] items-center justify-center gap-1.5 rounded-full border border-[#ebe3d8] bg-white px-3 text-[13px] font-semibold text-[#5c3d2e] shadow-[0_1px_2px_rgba(61,43,31,0.04)]"
          >
            <User className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
            내 정보
          </Link>
          <Link
            href="/"
            aria-label="메뉴"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[#ebe3d8] bg-white text-[#5c3d2e] shadow-[0_1px_2px_rgba(61,43,31,0.04)]"
          >
            <Menu className="h-5 w-5" strokeWidth={1.8} aria-hidden />
          </Link>
        </div>
      </div>
    </header>
  );
}

function PageHero() {
  return (
    <section className="relative mx-5 mt-2 overflow-hidden rounded-[1.75rem] shadow-[0_8px_28px_rgba(61,43,31,0.06)] ring-1 ring-[#ebe3d8]">
      <div className="relative aspect-[16/10] min-h-[200px] w-full">
        <Image
          src={HERO_IMAGE}
          alt=""
          fill
          priority
          className="object-cover object-center"
          sizes="(max-width: 430px) 100vw, 430px"
        />
        <div className="absolute inset-0 bg-[#3d2b1f]/32" aria-hidden />
        <div className="absolute inset-0 flex flex-col justify-end px-5 pb-5 pt-8 sm:px-6 sm:pb-6">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-white/85">
            MUSIC FOR YOU
          </p>
          <h2 className="mt-2 font-serif text-[26px] font-bold leading-tight text-white sm:text-[28px]">
            지금, 당신에게
            <br />
            추천하는 음악
          </h2>
          <p className="mt-3 max-w-[260px] text-[13px] leading-relaxed text-white/90 sm:text-[14px]">
            지금의 흐름에 맞춰 선별한 음악으로
            <br />
            편안하게 들어보세요.
          </p>
        </div>
      </div>
    </section>
  );
}

function MusicTrackCard({ card }: { card: FreeResultMusicCardModel }) {
  const thumb = resolveThumbnail(card);

  return (
    <article className="rounded-[1.5rem] bg-white p-4 shadow-[0_6px_20px_rgba(61,43,31,0.05)] ring-1 ring-[#ebe3d8] sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative h-[88px] w-full shrink-0 overflow-hidden rounded-2xl bg-[#ebe3d8] sm:h-[84px] sm:w-[112px]">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-[12px] text-[#8a735a]">
              음악
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h4 className="font-serif text-[17px] font-bold leading-snug text-[#3d2b1f] sm:text-[18px]">
            {card.title}
          </h4>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[#6b5648] sm:text-[14px]">
            {card.message}
          </p>
          {card.badges.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {card.badges.map((badge, index) => (
                <span
                  key={badge}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${BADGE_TONES[index % BADGE_TONES.length]}`}
                >
                  {badge}
                </span>
              ))}
            </div>
          ) : null}
          {card.reason ? (
            <p className="mt-2.5 text-[12px] leading-relaxed text-[#8a735a] sm:text-[13px]">
              {card.reason}
            </p>
          ) : null}
        </div>

        <a
          href={card.youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#3d2b1f] px-4 text-[14px] font-semibold text-white sm:mt-0.5 sm:h-10 sm:w-auto sm:min-w-[108px]"
        >
          음악 듣기
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        </a>
      </div>
    </article>
  );
}

function MusicListSection({ items }: { items: FreeResultMusicCardModel[] }) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-[1.75rem] bg-white px-5 py-5 shadow-[0_6px_20px_rgba(61,43,31,0.05)] ring-1 ring-[#ebe3d8]">
      <div className="flex items-center gap-2.5">
        <SectionBadge number="01" />
        <h3 className="font-serif text-[20px] font-bold text-[#3d2b1f]">당신을 위한 추천 음악</h3>
      </div>
      <p className="mt-3 text-[14px] leading-relaxed text-[#6b5648]">{SECTION_INTRO}</p>
      <ul className="mt-5 space-y-4">
        {items.map((card) => (
          <li key={card.id}>
            <MusicTrackCard card={card} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function BlockedMusicSection({ hubHref }: { hubHref: string }) {
  return (
    <section className="rounded-[1.75rem] bg-white px-5 py-6 shadow-[0_6px_20px_rgba(61,43,31,0.05)] ring-1 ring-[#ebe3d8]">
      <p className="text-[16px] leading-relaxed text-[#5c3d2e]">{BLOCKED_MUSIC_MESSAGE}</p>
      <Link
        href={hubHref}
        className="mt-6 flex h-14 w-full items-center justify-center rounded-2xl bg-[#3d2b1f] text-[16px] font-semibold text-white shadow-[0_4px_14px_rgba(61,43,31,0.18)]"
      >
        내 운율 메인으로 가기 →
      </Link>
    </section>
  );
}

function PreparingMusicSection() {
  return (
    <section className="rounded-[1.75rem] bg-white px-5 py-6 shadow-[0_6px_20px_rgba(61,43,31,0.05)] ring-1 ring-[#ebe3d8]">
      <p className="text-[15px] leading-relaxed text-[#6b5648]">
        지금 결과에 맞는 음악을 준비하고 있어요.
      </p>
    </section>
  );
}

export default async function UnyulMusicPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const parsed = freeSajuBirthFromSearchParams(params);

  if (!parsed.ok) {
    return (
      <MobileShell>
        <div className="bg-[#f9f7f2]">
          <MusicHeader hubHref="/unyul" basicInfoHref="/unyul/input" />
          <div className="px-5 py-8">
            <p className="text-[17px] leading-relaxed text-[#5c3d2e]">{parsed.error}</p>
            <Link
              href="/unyul/input"
              className="mt-6 inline-flex h-14 items-center justify-center rounded-2xl bg-[#3d2b1f] px-6 text-[17px] font-bold text-white"
            >
              다시 입력하기
            </Link>
          </div>
        </div>
      </MobileShell>
    );
  }

  const birth = parsed.input;
  const querySuffix = buildQuerySuffix(birth);
  const hubHref = `/unyul${querySuffix}`;
  const basicInfoHref = `/unyul/basic-info${querySuffix}`;

  let musicRecommendations: FreeResultMusicCardModel[] = [];
  let showAnnualMusic = false;

  try {
    const { pillars, interpretation } = buildFreeSajuPipeline(birth);

    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);
    const observationInterpretation = buildObservationInterpretation({
      dayStem: observations.dayStem,
      structureObservation: observations.structureObservation,
    });

    const strength = buildStrengthSummary(pillars);
    const climate = buildAdjustedClimateSummary(pillars);
    const needCandidates = buildNeedCandidateSet(pillars);
    const needResolution = buildNeedResolution(pillars);

    const finalResolution = resolveFinalElement({
      pillars,
      summary: strength,
      evidence,
      observations,
      climate,
      needResolution,
    });

    const natalSupplementFlow = resolveSupplementFlow({
      pillars,
      finalResolution,
      observations,
      climate,
      needResolution,
    });

    const annualFlowV2 = resolveAnnualSupplementFlowV2({
      year: ANNUAL_YEAR,
      natalCoreElement: natalSupplementFlow.resolution.coreElement,
      natalCoreCertainty: natalSupplementFlow.resolution.coreCertainty,
      natalSupplementElement: natalSupplementFlow.resolution.supplementElement,
      natalSupplementStatus: natalSupplementFlow.resolution.supplementStatus,
      natalPolicies: natalSupplementFlow.policies,
      natalCorridors: natalSupplementFlow.corridors,
      natalCoreState: natalSupplementFlow.coreState,
      natalClimate: climate,
      needResolution,
    });

    const selectedAnnualElement = annualFlowV2.resolution.annualSupplementElement;
    const selectedSafety = selectedAnnualElement
      ? annualFlowV2.safeties.find((item) => item.element === selectedAnnualElement)
      : undefined;

    const presentationGate = deriveAnnualPresentationGate(annualFlowV2.resolution, {
      selectedWinnerSafety: selectedSafety?.safety,
      selectedConflictingGoals: selectedSafety?.conflictingGoals ?? [],
    });

    showAnnualMusic =
      presentationGate.showAnnualMusic && presentationGate.presentationElement !== null;

    if (showAnnualMusic && presentationGate.presentationElement !== null) {
      const speakable = buildSpeakableOutput({
        strength,
        climate,
        needCandidates,
        needResolution,
        hourUnknown: pillars.hour === "unknown",
      });

      const musicGate = deriveMusicRecommendationGate({
        needResolution,
        freeInterpretation: interpretation,
        speakable,
      });

      const data = await readData();
      const candidates = selectMusicBySupplementElement({
        supplementElement: presentationGate.presentationElement,
        gate: musicGate,
        hints: speakable.musicRecommendationHints,
        catalog: data.musicCatalog ?? [],
      }).slice(0, MAX_MUSIC_CARDS);

      musicRecommendations = candidates.map((candidate) => {
        const reasonView = buildMusicRecommendationReason({
          gate: musicGate,
          candidate,
          hints: speakable.musicRecommendationHints,
          freeInterpretation: interpretation,
          observationInterpretation,
        });
        return {
          id: candidate.record.id,
          youtubeUrl: candidate.record.youtubeUrl,
          ...(candidate.record.thumbnailUrl
            ? { thumbnailUrl: candidate.record.thumbnailUrl }
            : {}),
          ...reasonView,
        };
      });
    }
  } catch (error) {
    const message = easyEngineError(error instanceof Error ? error.message : "");
    return (
      <MobileShell>
        <div className="bg-[#f9f7f2]">
          <MusicHeader hubHref={hubHref} basicInfoHref={basicInfoHref} />
          <div className="px-5 py-8">
            <p className="text-[17px] leading-relaxed text-[#5c3d2e]">{message}</p>
            <Link
              href={basicInfoHref}
              className="mt-6 inline-flex h-14 items-center justify-center rounded-2xl bg-[#3d2b1f] px-6 text-[17px] font-bold text-white"
            >
              기본 정보 확인하기
            </Link>
          </div>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <div className="bg-[#f9f7f2] pb-10">
        <MusicHeader hubHref={hubHref} basicInfoHref={basicInfoHref} />
        <PageHero />
        <div className="mt-6 px-5">
          {showAnnualMusic ? (
            musicRecommendations.length > 0 ? (
              <MusicListSection items={musicRecommendations} />
            ) : (
              <PreparingMusicSection />
            )
          ) : (
            <BlockedMusicSection hubHref={hubHref} />
          )}
        </div>
      </div>
    </MobileShell>
  );
}
