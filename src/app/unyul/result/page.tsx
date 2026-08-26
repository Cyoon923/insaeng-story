import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import {
  MusicRecommendationCard,
  type FreeResultMusicCardModel,
} from "@/components/saju/MusicRecommendationCard";
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
  selectMusicRecommendationCandidates,
} from "@/lib/saju";
import { buildFinalPresentation } from "@/lib/saju/final/buildFinalPresentation";
import { resolveFinalElement } from "@/lib/saju/final";
import type { FinalPresentation } from "@/lib/saju/final/buildFinalPresentation";
import type { FreeSajuBirthFormInput } from "@/lib/saju/free/buildFreeSajuPillars";
import { buildFreeSajuPipeline } from "@/lib/saju/free/buildFreeSajuPipeline";
import { freeSajuBirthFromSearchParams } from "@/lib/saju/free/unyulBirthQuery";
import type { FreeInterpretation } from "@/lib/saju/interpretation/types";
import type { ObservationInterpretation } from "@/lib/saju/observation/interpretation/types";
import { buildSpeakableOutput } from "@/lib/saju/speakable/buildSpeakableOutput";
import { readData } from "@/lib/server/store";

const MAX_MUSIC_CARDS = 3;

function easyEngineError(message: string): string {
  if (message.includes("범위")) return "입력하신 연도는 아직 계산할 수 없어요. 다시 입력해 주세요.";
  if (message.includes("윤달")) return "윤달 정보를 다시 확인해 주세요.";
  if (message.includes("음력") || message.includes("양력")) return "생년월일을 다시 확인해 주세요.";
  return "입력 내용을 다시 확인해 주세요.";
}

function UnyulShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#f7f4ef] shadow-xl">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-[#ebe3d8] bg-[#f7f4ef]/92 px-3 backdrop-blur">
        <Link
          href="/unyul/input"
          aria-label="뒤로가기"
          className="flex h-11 w-11 items-center justify-center rounded-full text-[#5c3d2e]"
        >
          <ChevronLeft className="h-6 w-6" />
        </Link>
        <h1 className="font-serif text-[20px] font-bold text-[#3d2b1f]">
          운율
          <span className="ml-1.5 align-middle text-[12px] font-semibold tracking-[0.04em] text-[#7c3aed]">
            UNYUL
          </span>
        </h1>
      </header>
      {children}
    </div>
  );
}

function FinalPresentationHero({ presentation }: { presentation: FinalPresentation }) {
  const isUnresolved =
    presentation.certainty === "unresolved" || presentation.element === null;

  if (isUnresolved) {
    return (
      <section className="px-5 pb-2 pt-8">
        <p className="font-serif text-[22px] leading-snug tracking-tight text-[#3d2b1f]">
          {presentation.headline}
        </p>
      </section>
    );
  }

  const flow = presentation.reasonFlow.slice(0, 3);

  return (
    <section className="px-5 pb-4 pt-8">
      <p className="font-serif text-[42px] font-bold leading-none tracking-tight text-[#3d2b1f]">
        <span aria-hidden="true">{presentation.symbol}</span>{" "}
        <span>{presentation.element}</span>
        <span className="mx-2 text-[28px] font-semibold text-[#8a735a]">·</span>
        <span className="text-[34px]">{presentation.name}</span>
      </p>
      <p className="mt-5 text-[17px] leading-relaxed text-[#5c3d2e]">{presentation.keyword}</p>
      <p className="mt-6 font-serif text-[20px] leading-snug text-[#3d2b1f]">
        {presentation.headline}
      </p>
      {presentation.reasonTitle && flow.length > 0 ? (
        <div className="mt-8">
          <p className="text-[18px] font-semibold text-[#5c3d2e]">{presentation.reasonTitle}</p>
          <div className="mt-4 flex flex-nowrap items-center gap-1">
            {flow.map((word, index) => (
              <div key={`${word}-${index}`} className="contents">
                <div className="flex min-w-0 flex-1 flex-col items-center rounded-2xl bg-[#fffaf3] px-2 py-3 shadow-[0_1px_0_rgba(61,43,31,0.06)]">
                  <span className="text-[26px] leading-none" aria-hidden="true">
                    {presentation.symbol}
                  </span>
                  <span className="mt-1.5 truncate text-[17px] font-semibold leading-none text-[#3d2b1f]">
                    {word}
                  </span>
                </div>
                {index < flow.length - 1 ? (
                  <span
                    className="shrink-0 select-none px-0.5 text-[18px] font-medium text-[#8a735a]"
                    aria-hidden="true"
                  >
                    →
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function looksInternalCopy(text: string): boolean {
  return /R[1-6]|bottleneck|leaning|provisional|confirmed|\bmixed\b|\bnull\b/i.test(text);
}

function firstSentence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^[\s\S]+?[.!?。요]$/);
  if (match) return match[0].trim();
  const cut = trimmed.split(/(?<=요)\s+/)[0]?.trim();
  return cut || trimmed;
}

/**
 * Collapse FreeInterpretation / Observation into one short user sentence.
 */
function buildFlowSummarySentences(
  interpretation: FreeInterpretation,
  observation: ObservationInterpretation,
  presentation: FinalPresentation,
): string[] {
  const heroHeadline = presentation.headline.trim();
  const candidates = [
    interpretation.explanation,
    observation.helpingRelations[0]?.text,
    observation.actingStructures[0]?.text,
    observation.coexistence?.text,
    interpretation.headline,
  ].filter((text): text is string => Boolean(text && text.trim()));

  for (const raw of candidates) {
    const sentence = firstSentence(raw);
    if (!sentence || looksInternalCopy(sentence)) continue;
    if (sentence === heroHeadline) continue;
    if (presentation.headline.includes(sentence) || sentence.includes(presentation.headline)) {
      continue;
    }
    return [sentence];
  }

  return [];
}

function FlowSummaryCard({
  interpretation,
  observation,
  presentation,
}: {
  interpretation: FreeInterpretation;
  observation: ObservationInterpretation;
  presentation: FinalPresentation;
}) {
  const sentences = buildFlowSummarySentences(interpretation, observation, presentation);
  if (sentences.length === 0) return null;

  return (
    <section className="mx-5 mt-2 rounded-[1.5rem] bg-white px-5 py-6 shadow-[0_8px_24px_rgba(92,61,46,0.04)] ring-1 ring-[#ebe3d8]">
      <h2 className="font-serif text-[22px] font-bold tracking-tight text-[#3d2b1f]">지금의 흐름</h2>
      <div className="mt-4 space-y-3">
        {sentences.map((sentence) => (
          <p key={sentence} className="text-[17px] leading-relaxed text-[#5c3d2e]">
            {sentence}
          </p>
        ))}
      </div>
    </section>
  );
}

function formatBirthDate(birth: FreeSajuBirthFormInput): string {
  return `${birth.year}년 ${birth.month}월 ${birth.day}일`;
}

function formatBirthTime(birth: FreeSajuBirthFormInput): string {
  if (birth.timeUnknown) return "시간 모름";
  const hour = birth.hour ?? 0;
  const minute = birth.minute ?? 0;
  const period = hour < 12 ? "오전" : "오후";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${period} ${hour12}시 ${String(minute).padStart(2, "0")}분`;
}

function BirthInfoCard({ birth }: { birth: FreeSajuBirthFormInput }) {
  return (
    <section className="mx-5 mt-6 border-t border-[#ebe3d8]/80 pt-4">
      <p className="text-[12px] font-medium text-[#8a735a]">입력한 정보</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[#6b5648]">
        {formatBirthDate(birth)}
        <span className="mx-1.5 text-[#c4b5a5]" aria-hidden="true">
          ·
        </span>
        {formatBirthTime(birth)}
      </p>
    </section>
  );
}

function MusicRecommendationSection({
  name,
  items,
}: {
  name: string;
  items: FreeResultMusicCardModel[];
}) {
  return (
    <section className="mx-5 mt-5 mb-12 rounded-[1.5rem] bg-white p-5 shadow-[0_8px_24px_rgba(92,61,46,0.04)] ring-1 ring-[#ebe3d8]">
      <h2 className="font-serif text-[24px] font-bold tracking-tight text-[#3d2b1f]">
        지금 당신에게 어울리는 음악
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
        {name}의 성질을 자연스럽게 느낄 수 있는 음악을 골랐어요.
      </p>
      {items.length === 0 ? (
        <div className="mt-4 flex min-h-[88px] items-center justify-center rounded-2xl border border-dashed border-[#e4d8ca] bg-[#faf7f2] px-4">
          <p className="text-center text-[14px] leading-relaxed text-[#8b6f5c]">
            지금 결과에 맞는 음악을 준비하고 있어요.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((card) => (
            <li key={card.id}>
              <MusicRecommendationCard card={card} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Unyul free result: query birth → free pipeline → FER hero + short flow + music.
 */
export default async function UnyulResultPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const parsed = freeSajuBirthFromSearchParams(params);

  if (!parsed.ok) {
    return (
      <UnyulShell>
        <div className="px-5 py-8">
          <p className="text-[17px] leading-relaxed text-[#5c3d2e]">{parsed.error}</p>
          <Link
            href="/unyul/input"
            className="mt-6 inline-flex h-14 items-center justify-center rounded-2xl bg-[#7c3aed] px-6 text-[17px] font-bold text-white"
          >
            다시 입력하기
          </Link>
        </div>
      </UnyulShell>
    );
  }

  let pillars: ReturnType<typeof buildFreeSajuPipeline>["pillars"];
  let interpretation: ReturnType<typeof buildFreeSajuPipeline>["interpretation"];
  let observationInterpretation: ReturnType<typeof buildObservationInterpretation>;
  let musicRecommendations: FreeResultMusicCardModel[] = [];
  let finalPresentation: FinalPresentation;

  try {
    const result = buildFreeSajuPipeline(parsed.input);
    pillars = result.pillars;
    interpretation = result.interpretation;

    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);
    observationInterpretation = buildObservationInterpretation({
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
    finalPresentation = buildFinalPresentation(finalResolution);

    const speakable = buildSpeakableOutput({
      strength,
      climate,
      needCandidates,
      needResolution,
      hourUnknown: pillars.hour === "unknown",
    });

    const gate = deriveMusicRecommendationGate({
      needResolution,
      freeInterpretation: interpretation,
      speakable,
    });

    const allowMusic = finalPresentation.certainty !== "unresolved";

    if (allowMusic) {
      const data = await readData();
      const candidates = selectMusicRecommendationCandidates({
        gate,
        hints: speakable.musicRecommendationHints,
        catalog: data.musicCatalog ?? [],
      }).slice(0, MAX_MUSIC_CARDS);

      musicRecommendations = candidates.map((candidate) => {
        const reasonView = buildMusicRecommendationReason({
          gate,
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
      <UnyulShell>
        <div className="px-5 py-8">
          <p className="text-[17px] leading-relaxed text-[#5c3d2e]">{message}</p>
          <Link
            href="/unyul/input"
            className="mt-6 inline-flex h-14 items-center justify-center rounded-2xl bg-[#7c3aed] px-6 text-[17px] font-bold text-white"
          >
            다시 입력하기
          </Link>
        </div>
      </UnyulShell>
    );
  }

  return (
    <UnyulShell>
      <FinalPresentationHero presentation={finalPresentation} />
      <FlowSummaryCard
        interpretation={interpretation}
        observation={observationInterpretation}
        presentation={finalPresentation}
      />
      <BirthInfoCard birth={parsed.input} />
      {pillars.hour === "unknown" ? (
        <p className="mx-5 mt-3 text-[14px] leading-relaxed text-[#8b6f5c]">
          태어난 시간을 몰라서, 시주에 따라 달라질 수 있는 부분은 열어두고 살펴봤어요.
        </p>
      ) : null}
      {finalPresentation.certainty !== "unresolved" && finalPresentation.name ? (
        <MusicRecommendationSection
          name={finalPresentation.name}
          items={musicRecommendations}
        />
      ) : null}
    </UnyulShell>
  );
}
