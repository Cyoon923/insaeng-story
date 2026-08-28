import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, Menu, User } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import {
  buildAdjustedClimateSummary,
  buildNeedResolution,
  buildStrengthObservations,
  buildStrengthSummary,
  collectStrengthEvidence,
  ELEMENT_KO,
} from "@/lib/saju";
import { buildSupplementPresentation } from "@/lib/saju/final/buildSupplementPresentation";
import { resolveFinalElement } from "@/lib/saju/final";
import { resolveSupplementFlow } from "@/lib/saju/final/resolveSupplementFlow";
import { buildFreeSajuPipeline } from "@/lib/saju/free/buildFreeSajuPipeline";
import type { FreeSajuBirthFormInput } from "@/lib/saju/free/buildFreeSajuPillars";
import {
  freeSajuBirthFromSearchParams,
  freeSajuBirthToQuery,
} from "@/lib/saju/free/unyulBirthQuery";
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
import { resolveAnnualSupplementFlowV2 } from "@/lib/saju/luck/annual/resolveAnnualSupplementFlowV2";
import type { Element } from "@/lib/saju/types";

const ANNUAL_YEAR = 2026;
const HERO_IMAGE = "/images/unyul-home-visual.png";

/** Accent only — layout/typography identical for all five elements. */
const ELEMENT_ACCENT: Record<Element, string> = {
  木: "#4a7c59",
  火: "#b85c4a",
  土: "#8a735a",
  金: "#9a8458",
  水: "#4a6b8a",
};

function buildQuerySuffix(input: FreeSajuBirthFormInput): string {
  return `?${freeSajuBirthToQuery(input)}`;
}

function formatKeywordLine(keyword: string): string {
  const trimmed = keyword.replace(/을?\s*만드는\s*힘$/, "").trim();
  return trimmed
    .split(",")
    .map((part) =>
      part
        .trim()
        .replace(/하고$/, "")
        .replace(/을$/, "")
        .replace(/를$/, ""),
    )
    .filter(Boolean)
    .join(" · ");
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

function reasonSectionTitle(name: string | null): string {
  if (name) return `왜 ${name}일까요?`;
  return "왜 이 기운일까요?";
}

function easyEngineError(message: string): string {
  if (message.includes("범위")) return "입력하신 연도는 아직 계산할 수 없어요. 다시 입력해 주세요.";
  if (message.includes("윤달")) return "윤달 정보를 다시 확인해 주세요.";
  if (message.includes("음력") || message.includes("양력")) return "생년월일을 다시 확인해 주세요.";
  return "입력 내용을 다시 확인해 주세요.";
}

function SectionBadge({ number }: { number: string }) {
  return (
    <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[#f3eee6] px-2 text-[12px] font-semibold tracking-wide text-[#8a735a]">
      {number}
    </span>
  );
}

function SupplementHeader({
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
            2026 YOUR FLOW
          </p>
          <h2 className="mt-2 font-serif text-[26px] font-bold leading-tight text-white sm:text-[28px]">
            2026년,
            <br />
            2026년 보완 기운
          </h2>
          <p className="mt-3 max-w-[240px] text-[13px] leading-relaxed text-white/90 sm:text-[14px]">
            한 해의 큰 흐름을 미리 알고,
            <br />
            나의 사주와 만나는 균형의 방향을 살펴보세요.
          </p>
          <p className="mt-4 self-end font-serif text-[12px] italic leading-snug text-white/80">
            A Better You in 2026
          </p>
        </div>
      </div>
    </section>
  );
}

/** Shared mark: large hanja + (독음) — identical size for every element. */
function ElementMark({ element }: { element: Element }) {
  const reading = ELEMENT_KO[element];
  const accent = ELEMENT_ACCENT[element];

  return (
    <div
      className="flex h-[108px] w-[108px] shrink-0 flex-col items-center justify-center rounded-full sm:h-[116px] sm:w-[116px]"
      style={{
        backgroundColor: `${accent}14`,
        boxShadow: `inset 0 0 0 1.5px ${accent}33`,
      }}
    >
      <span
        className="font-serif text-[44px] font-bold leading-none tracking-tight sm:text-[48px]"
        style={{ color: accent }}
      >
        {element}
      </span>
      <span className="mt-1.5 text-[13px] font-medium text-[#8a735a]">({reading})</span>
    </div>
  );
}

function AnnualResultSection({ presentation }: { presentation: AnnualPresentation }) {
  const showElement =
    presentation.showAnnualElement &&
    presentation.element !== null &&
    presentation.name !== null;

  return (
    <section className="rounded-[1.75rem] bg-white px-5 py-5 shadow-[0_6px_20px_rgba(61,43,31,0.05)] ring-1 ring-[#ebe3d8]">
      <div className="flex items-center gap-2.5">
        <SectionBadge number="01" />
        <h3 className="font-serif text-[20px] font-bold text-[#3d2b1f]">2026년 보완 기운</h3>
      </div>

      {!showElement ? (
        <div className="mt-5">
          <p className="font-serif text-[18px] leading-snug text-[#3d2b1f]">
            {presentation.headline}
          </p>
          {presentation.description ? (
            <p className="mt-3 text-[15px] leading-relaxed text-[#6b5648]">
              {presentation.description}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 flex items-start gap-4">
          <ElementMark element={presentation.element!} />
          <div className="min-w-0 flex-1 pt-1">
            <p className="text-[14px] leading-relaxed text-[#6b5648] sm:text-[15px]">
              타고난 흐름과 2026년의 흐름을 함께 봤을 때, 올해 보완하면 좋은 기운이에요.
            </p>
            {presentation.keyword ? (
              <p className="mt-3 text-[14px] font-medium leading-relaxed text-[#5c3d2e] sm:text-[15px]">
                {formatKeywordLine(presentation.keyword)}
              </p>
            ) : null}
            <p className="mt-3 text-[15px] leading-relaxed text-[#3d2b1f] sm:text-[16px]">
              {presentation.headline}
            </p>
            {presentation.description ? (
              <p className="mt-2 text-[13px] leading-relaxed text-[#6b5648] sm:text-[14px]">
                {presentation.description}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

function AnnualReasonsSection({
  title,
  reasons,
}: {
  title: string;
  reasons: AnnualReasonsPresentation;
}) {
  if (reasons.items.length === 0) return null;

  const multi = reasons.items.length > 1;

  return (
    <section className="rounded-[1.75rem] bg-white px-5 py-5 shadow-[0_6px_20px_rgba(61,43,31,0.05)] ring-1 ring-[#ebe3d8]">
      <div className="flex items-center gap-2.5">
        <SectionBadge number="02" />
        <h3 className="font-serif text-[20px] font-bold text-[#3d2b1f]">{title}</h3>
      </div>

      <ul
        className={
          multi
            ? "mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
            : "mt-4 grid grid-cols-1 gap-3"
        }
      >
        {reasons.items.map((item) => (
          <li
            key={`${item.category}-${item.text}`}
            className="rounded-2xl bg-[#faf7f2] px-4 py-4 ring-1 ring-[#ebe3d8]/80"
          >
            <p className="text-[14px] leading-relaxed text-[#5c3d2e] sm:text-[15px]">
              {item.text}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AnnualFlowReferenceSection({ notice }: { notice: AnnualFlowNotice }) {
  return (
    <section className="rounded-[1.75rem] bg-[#f3eee6] px-5 py-5 ring-1 ring-[#e5dccf]">
      <div className="flex items-center gap-2.5">
        <SectionBadge number="03" />
        <h3 className="font-serif text-[20px] font-bold text-[#3d2b1f]">2026년 참고하세요</h3>
      </div>
      <p className="mt-4 text-[15px] font-semibold leading-snug text-[#3d2b1f]">
        {notice.title}
      </p>
      <p className="mt-2 text-[14px] leading-relaxed text-[#6b5648] sm:text-[15px]">
        {notice.description}
      </p>
    </section>
  );
}

function MusicCta({ musicHref }: { musicHref: string }) {
  return (
    <section className="mx-5 mt-6 overflow-hidden rounded-[1.75rem] bg-[#3d2b1f] px-5 py-5 shadow-[0_6px_20px_rgba(61,43,31,0.16)]">
      <p className="text-[14px] font-medium text-white/75">나에게 맞는 음악</p>
      <p className="mt-1 font-serif text-[17px] font-bold leading-snug text-white">
        지금의 균형이 더 좋은 내일을 만듭니다.
      </p>
      <Link
        href={musicHref}
        className="mt-4 inline-flex h-11 items-center justify-center rounded-full border border-white/35 bg-white/10 px-5 text-[14px] font-semibold text-white"
      >
        추천 음악 보기 →
      </Link>
    </section>
  );
}

export default async function Unyul2026SupplementPage({
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
          <SupplementHeader hubHref="/unyul" basicInfoHref="/unyul/input" />
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
  const musicHref = `/unyul/music${querySuffix}`;

  let annualPresentation: AnnualPresentation;
  let annualReasons: AnnualReasonsPresentation;
  let annualFlowNotice: AnnualFlowNotice | null;

  try {
    const { pillars } = buildFreeSajuPipeline(birth);

    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);
    const strength = buildStrengthSummary(pillars);
    const climate = buildAdjustedClimateSummary(pillars);
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

    const natalBalancePresentation = buildSupplementPresentation(
      natalSupplementFlow.resolution,
    );

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
  } catch (error) {
    const message = easyEngineError(error instanceof Error ? error.message : "");
    return (
      <MobileShell>
        <div className="bg-[#f9f7f2]">
          <SupplementHeader hubHref={hubHref} basicInfoHref={basicInfoHref} />
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

  const displayReasons = displayAnnualReasons(annualReasons, annualFlowNotice);
  const reasonsTitle = reasonSectionTitle(annualPresentation.name);

  return (
    <MobileShell>
      <div className="bg-[#f9f7f2] pb-10">
        <SupplementHeader hubHref={hubHref} basicInfoHref={basicInfoHref} />
        <PageHero />
        <div className="mt-6 space-y-5 px-5">
          <AnnualResultSection presentation={annualPresentation} />
          <AnnualReasonsSection title={reasonsTitle} reasons={displayReasons} />
          {annualFlowNotice ? (
            <AnnualFlowReferenceSection notice={annualFlowNotice} />
          ) : null}
        </div>
        <MusicCta musicHref={musicHref} />
      </div>
    </MobileShell>
  );
}
