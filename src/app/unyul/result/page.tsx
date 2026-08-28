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
} from "@/lib/saju";
import { buildSupplementPresentation } from "@/lib/saju/final/buildSupplementPresentation";
import type { SupplementPresentation } from "@/lib/saju/final/buildSupplementPresentation";
import { resolveFinalElement } from "@/lib/saju/final";
import { resolveSupplementFlow } from "@/lib/saju/final/resolveSupplementFlow";
import type { FreeSajuBirthFormInput } from "@/lib/saju/free/buildFreeSajuPillars";
import { buildFreeSajuPipeline } from "@/lib/saju/free/buildFreeSajuPipeline";
import { freeSajuBirthFromSearchParams } from "@/lib/saju/free/unyulBirthQuery";
import {
  buildAnnualPresentation,
  type AnnualPresentation,
} from "@/lib/saju/luck/annual/buildAnnualPresentation";
import {
  buildAnnualFlowNotice,
  type AnnualFlowNotice,
} from "@/lib/saju/luck/annual/buildAnnualFlowNotice";
import {
  buildAnnualReasonsPresentation,
  type AnnualReasonsPresentation,
} from "@/lib/saju/luck/annual/buildAnnualReasonsPresentation";
import { deriveAnnualPresentationGate } from "@/lib/saju/luck/annual/deriveAnnualPresentationGate";
import type { AnnualPresentationGate } from "@/lib/saju/luck/annual/deriveAnnualPresentationGate";
import { resolveAnnualSupplementFlowV2 } from "@/lib/saju/luck/annual/resolveAnnualSupplementFlowV2";
import { selectMusicBySupplementElement } from "@/lib/saju/music/selectMusicBySupplementElement";
import { buildSpeakableOutput } from "@/lib/saju/speakable/buildSpeakableOutput";
import { readData } from "@/lib/server/store";

const MAX_MUSIC_CARDS = 3;
/** Free-service annual window label (입춘 경계는 flow 내부). */
const ANNUAL_YEAR = 2026;

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

function AnnualPresentationHero({ presentation }: { presentation: AnnualPresentation }) {
  const showElement =
    presentation.showAnnualElement &&
    presentation.element !== null &&
    presentation.name !== null;

  if (!showElement) {
    return (
      <section className="px-5 pb-2 pt-8">
        <p className="font-serif text-[22px] leading-snug tracking-tight text-[#3d2b1f]">
          {presentation.headline}
        </p>
        {presentation.description ? (
          <p className="mt-4 text-[17px] leading-relaxed text-[#5c3d2e]">
            {presentation.description}
          </p>
        ) : null}
      </section>
    );
  }

  const heroSymbol = presentation.symbol ?? "";

  return (
    <section className="px-5 pb-4 pt-8">
      <p className="font-serif text-[42px] font-bold leading-none tracking-tight text-[#3d2b1f]">
        <span aria-hidden="true">{heroSymbol}</span>{" "}
        <span>{presentation.element}</span>
        <span className="mx-2 text-[28px] font-semibold text-[#8a735a]">·</span>
        <span className="text-[34px]">{presentation.name}</span>
      </p>
      {presentation.keyword ? (
        <p className="mt-5 text-[17px] leading-relaxed text-[#5c3d2e]">
          {presentation.keyword}
        </p>
      ) : null}
      <p className="mt-6 font-serif text-[20px] leading-snug text-[#3d2b1f]">
        {presentation.headline}
      </p>
      {presentation.description ? (
        <p className="mt-3 text-[17px] leading-relaxed text-[#5c3d2e]">
          {presentation.description}
        </p>
      ) : null}
    </section>
  );
}

function displayAnnualReasons(
  reasons: AnnualReasonsPresentation,
  flowNotice: AnnualFlowNotice | null,
): AnnualReasonsPresentation {
  if (!flowNotice) return reasons;
  return {
    title: reasons.title,
    items: reasons.items.filter((item) => item.category !== "CLIMATE_NOTICE"),
  };
}

function AnnualFlowNoticeSection({ notice }: { notice: AnnualFlowNotice }) {
  return (
    <section className="mx-5 mt-2 rounded-[1.5rem] bg-[#faf7f2] px-5 py-5 ring-1 ring-[#ebe3d8]">
      <h2 className="font-serif text-[18px] font-semibold tracking-tight text-[#3d2b1f]">
        {notice.title}
      </h2>
      <p className="mt-3 text-[15px] leading-relaxed text-[#6b5648]">{notice.description}</p>
    </section>
  );
}

function AnnualReasonsSection({ reasons }: { reasons: AnnualReasonsPresentation }) {
  if (reasons.items.length === 0) return null;

  return (
    <section className="mx-5 mt-2 rounded-[1.5rem] bg-white px-5 py-6 ring-1 ring-[#ebe3d8]">
      <h2 className="font-serif text-[22px] font-bold tracking-tight text-[#3d2b1f]">
        {reasons.title}
      </h2>
      <div className="mt-4 space-y-3">
        {reasons.items.map((item) => (
          <p key={item.text} className="text-[17px] leading-relaxed text-[#5c3d2e]">
            {item.text}
          </p>
        ))}
      </div>
    </section>
  );
}

const NATAL_BASELINE_DESCRIPTION =
  "이 기운은 2026년 결과와는 별개로, 나에게 기본적으로 필요한 균형의 방향이에요.";

function hasResolvableNatalBaseline(natal: SupplementPresentation): boolean {
  return (
    natal.supplementStatus === "resolved" &&
    natal.element !== null &&
    natal.name !== null
  );
}

function annualMatchesNatal(
  natal: SupplementPresentation,
  gate: AnnualPresentationGate,
): boolean {
  if (!hasResolvableNatalBaseline(natal)) return false;
  if (!gate.showAnnualElement || gate.presentationElement === null) return false;
  return gate.presentationElement === natal.element;
}

function BasicBalanceSection({
  natalBalancePresentation,
  presentationGate,
}: {
  natalBalancePresentation: SupplementPresentation;
  presentationGate: AnnualPresentationGate;
}) {
  if (!hasResolvableNatalBaseline(natalBalancePresentation)) return null;

  if (annualMatchesNatal(natalBalancePresentation, presentationGate)) {
    return (
      <p className="mx-5 mt-3 px-1 text-[15px] leading-relaxed text-[#6b5648]">
        올해의 보강 방향이 나의 기본 균형과도 같은 흐름이에요.
      </p>
    );
  }

  const { element, symbol, name, keyword } = natalBalancePresentation;

  return (
    <section className="mx-5 mt-2 rounded-[1.5rem] bg-white px-5 py-5 shadow-[0_8px_24px_rgba(92,61,46,0.04)] ring-1 ring-[#ebe3d8]">
      <h2 className="text-[13px] font-medium text-[#8a735a]">기본 보완 기운</h2>
      <p className="mt-3 font-serif text-[28px] font-bold leading-none tracking-tight text-[#3d2b1f]">
        <span aria-hidden="true">{symbol}</span>{" "}
        <span>{element}</span>
        <span className="mx-1.5 text-[20px] font-semibold text-[#8a735a]">·</span>
        <span className="text-[24px]">{name}</span>
      </p>
      <p className="mt-3 text-[15px] leading-relaxed text-[#6b5648]">
        중심 기운이 자연스럽게 힘을 쓸 수 있도록 도와주는 기운이에요.
      </p>
      {keyword ? (
        <p className="mt-3 text-[16px] leading-relaxed text-[#5c3d2e]">{keyword}</p>
      ) : null}
      <p className="mt-4 text-[15px] leading-relaxed text-[#6b5648]">
        {NATAL_BASELINE_DESCRIPTION}
      </p>
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
    <section className="mx-5 mt-7 mb-12 rounded-[1.5rem] bg-white p-5 shadow-[0_8px_24px_rgba(92,61,46,0.04)] ring-1 ring-[#ebe3d8]">
      <h2 className="font-serif text-[22px] font-bold tracking-tight text-[#3d2b1f]">
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
 * Unyul free result: query birth → FER Core → Supplement hero + short flow + music.
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
  let annualPresentation: AnnualPresentation;
  let annualReasons: AnnualReasonsPresentation;
  let annualFlowNotice: AnnualFlowNotice | null;
  let presentationGate: AnnualPresentationGate;
  /** Natal supplement kept for 기본 균형 기운 (UI card not wired this step). */
  let natalBalancePresentation: SupplementPresentation;

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

    const natalSupplementFlow = resolveSupplementFlow({
      pillars,
      finalResolution,
      observations,
      climate,
      needResolution,
    });

    const natalCoreElement = natalSupplementFlow.resolution.coreElement;
    const natalCoreCertainty = natalSupplementFlow.resolution.coreCertainty;
    const natalSupplementElement = natalSupplementFlow.resolution.supplementElement;
    const natalSupplementStatus = natalSupplementFlow.resolution.supplementStatus;

    natalBalancePresentation = buildSupplementPresentation(natalSupplementFlow.resolution);

    const annualFlowV2 = resolveAnnualSupplementFlowV2({
      year: ANNUAL_YEAR,
      natalCoreElement,
      natalCoreCertainty,
      natalSupplementElement,
      natalSupplementStatus,
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

    presentationGate = deriveAnnualPresentationGate(annualFlowV2.resolution, {
      selectedWinnerSafety: selectedSafety?.safety,
      selectedConflictingGoals: selectedSafety?.conflictingGoals ?? [],
    });

    annualPresentation = buildAnnualPresentation({
      year: ANNUAL_YEAR,
      gate: presentationGate,
      resolution: annualFlowV2.resolution,
      natalBalancePresentation,
    });

    annualReasons = buildAnnualReasonsPresentation({
      year: ANNUAL_YEAR,
      evidence: annualFlowV2.evidence,
      natalGoals: annualFlowV2.natalGoals,
      goalSatisfactions: annualFlowV2.goalSatisfactions,
      imbalances: annualFlowV2.imbalances,
      candidatePolicies: annualFlowV2.candidatePolicies,
      safeties: annualFlowV2.safeties,
      winnerInput: annualFlowV2.winnerInput,
      resolution: annualFlowV2.resolution,
      presentationGate,
    });

    annualFlowNotice = buildAnnualFlowNotice({
      year: ANNUAL_YEAR,
      presentationGate,
      resolution: annualFlowV2.resolution,
      imbalances: annualFlowV2.imbalances,
      natalClimate: climate,
    });

    // Natal / annual fields kept distinct for 기본 균형 vs 2026 (UI cards next step).
    const natalBaseline = {
      core: natalCoreElement,
      supplement: natalSupplementElement,
      status: natalSupplementStatus,
      presentation: natalBalancePresentation,
    };
    void natalBaseline;

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

    // Music hard-gated by annual v2 presentation gate (no natal fallback).
    if (
      presentationGate.showAnnualMusic &&
      presentationGate.presentationElement !== null &&
      annualPresentation.name
    ) {
      const data = await readData();
      const candidates = selectMusicBySupplementElement({
        supplementElement: presentationGate.presentationElement,
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

  const displayReasons = displayAnnualReasons(annualReasons, annualFlowNotice);

  return (
    <UnyulShell>
      <AnnualPresentationHero presentation={annualPresentation} />
      <AnnualReasonsSection reasons={displayReasons} />
      {annualFlowNotice ? <AnnualFlowNoticeSection notice={annualFlowNotice} /> : null}
      <BasicBalanceSection
        natalBalancePresentation={natalBalancePresentation}
        presentationGate={presentationGate}
      />
      {annualPresentation.showAnnualMusic && annualPresentation.name ? (
        <MusicRecommendationSection
          name={annualPresentation.name}
          items={musicRecommendations}
        />
      ) : null}
      <BirthInfoCard birth={parsed.input} />
      {pillars.hour === "unknown" ? (
        <p className="mx-5 mt-3 text-[14px] leading-relaxed text-[#8b6f5c]">
          태어난 시간을 몰라서, 시주에 따라 달라질 수 있는 부분은 열어두고 살펴봤어요.
        </p>
      ) : null}
    </UnyulShell>
  );
}
