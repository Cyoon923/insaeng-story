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
} from "@/lib/saju";
import { resolveFinalElement } from "@/lib/saju/final";
import { resolveSupplementFlow } from "@/lib/saju/final/resolveSupplementFlow";
import { buildFreeSajuPipeline } from "@/lib/saju/free/buildFreeSajuPipeline";
import type { FreeSajuBirthFormInput } from "@/lib/saju/free/buildFreeSajuPillars";
import {
  freeSajuBirthFromSearchParams,
  freeSajuBirthToQuery,
} from "@/lib/saju/free/unyulBirthQuery";
import {
  buildAnnualFlowSummaryPresentation,
  type AnnualFlowSummaryPresentation,
} from "@/lib/saju/luck/annual/buildAnnualFlowSummaryPresentation";
import { resolveAnnualSupplementFlowV2 } from "@/lib/saju/luck/annual/resolveAnnualSupplementFlowV2";

const ANNUAL_YEAR = 2026;
const HERO_IMAGE = "/images/unyul-home-visual.png";

function buildQuerySuffix(input: FreeSajuBirthFormInput): string {
  return `?${freeSajuBirthToQuery(input)}`;
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

function FlowHeader({
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
            2026 OVERVIEW
          </p>
          <h2 className="mt-2 font-serif text-[26px] font-bold leading-tight text-white sm:text-[28px]">
            2026년
            <br />
            전체 흐름
          </h2>
          <p className="mt-3 max-w-[240px] text-[13px] leading-relaxed text-white/90 sm:text-[14px]">
            올해의 흐름이
            <br />
            나의 사주와 어떻게 만나는지 살펴보세요.
          </p>
        </div>
      </div>
    </section>
  );
}

function FlowSummarySection({ summary }: { summary: AnnualFlowSummaryPresentation }) {
  if (summary.sentences.length === 0) {
    return (
      <section className="rounded-[1.75rem] bg-white px-5 py-5 shadow-[0_6px_20px_rgba(61,43,31,0.05)] ring-1 ring-[#ebe3d8] sm:px-6">
        <div className="flex items-center gap-2.5">
          <SectionBadge number="01" />
          <h3 className="font-serif text-[20px] font-bold text-[#3d2b1f]">올해 한눈에 보기</h3>
        </div>
        <p className="mt-5 text-[15px] leading-relaxed text-[#5c3d2e] sm:text-[16px]">
          태어난 시간을 알면 2026년의 흐름을
          <br />
          조금 더 구체적으로 살펴볼 수 있어요.
        </p>
        <p className="mt-3 text-[14px] leading-relaxed text-[#6b5648]">
          현재 정보로 확인할 수 있는 범위만 열어두었어요.
        </p>
      </section>
    );
  }

  const sentences = summary.sentences.slice(0, 4);

  return (
    <section className="rounded-[1.75rem] bg-white px-5 py-5 shadow-[0_6px_20px_rgba(61,43,31,0.05)] ring-1 ring-[#ebe3d8] sm:px-6">
      <div className="flex items-center gap-2.5">
        <SectionBadge number="01" />
        <h3 className="font-serif text-[20px] font-bold text-[#3d2b1f]">올해 한눈에 보기</h3>
      </div>

      <div className="mt-5 space-y-3">
        {sentences.map((sentence) => (
          <p
            key={sentence}
            className="rounded-2xl bg-[#faf7f2] px-4 py-3.5 text-[14px] leading-relaxed text-[#3d2b1f] ring-1 ring-[#ebe3d8]/70 sm:px-5 sm:py-4 sm:text-[15px] sm:leading-[1.7]"
          >
            {sentence}
          </p>
        ))}
      </div>
    </section>
  );
}

function BottomCtas({
  supplementHref,
  musicHref,
}: {
  supplementHref: string;
  musicHref: string;
}) {
  return (
    <div className="mt-6 space-y-3 px-5">
      <Link
        href={supplementHref}
        className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#3d2b1f] text-[16px] font-semibold text-white shadow-[0_4px_14px_rgba(61,43,31,0.18)]"
      >
        2026년 보완 기운 보기 →
      </Link>
      <Link
        href={musicHref}
        className="flex h-12 w-full items-center justify-center rounded-2xl border border-[#ebe3d8] bg-white text-[15px] font-semibold text-[#5c3d2e] shadow-[0_1px_2px_rgba(61,43,31,0.04)]"
      >
        나에게 맞는 음악 →
      </Link>
    </div>
  );
}

export default async function Unyul2026FlowPage({
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
          <FlowHeader hubHref="/unyul" basicInfoHref="/unyul/input" />
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
  const supplementHref = `/unyul/2026/supplement${querySuffix}`;
  const musicHref = `/unyul/music${querySuffix}`;

  let flowSummary: AnnualFlowSummaryPresentation;

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

    flowSummary = buildAnnualFlowSummaryPresentation({
      year: ANNUAL_YEAR,
      evidence: annualFlowV2.evidence,
      goalSatisfactions: annualFlowV2.goalSatisfactions,
      imbalances: annualFlowV2.imbalances,
      resolution: annualFlowV2.resolution,
    });
  } catch (error) {
    const message = easyEngineError(error instanceof Error ? error.message : "");
    return (
      <MobileShell>
        <div className="bg-[#f9f7f2]">
          <FlowHeader hubHref={hubHref} basicInfoHref={basicInfoHref} />
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
        <FlowHeader hubHref={hubHref} basicInfoHref={basicInfoHref} />
        <PageHero />
        <div className="mt-6 px-5">
          <FlowSummarySection summary={flowSummary} />
        </div>
        <BottomCtas supplementHref={supplementHref} musicHref={musicHref} />
      </div>
    </MobileShell>
  );
}
