import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, Menu, User } from "lucide-react";
import {
  buildAdjustedClimateSummary,
  buildNeedResolution,
  buildStrengthObservations,
  buildStrengthSummary,
  branchElement,
  collectStrengthEvidence,
  stemElement,
} from "@/lib/saju";
import { buildElementStrengthProfiles } from "@/lib/saju/elements/buildElementStrengthProfiles";
import {
  toElementStrengthDisplayProfiles,
  type ElementStrengthDisplaySet,
} from "@/lib/saju/elements/toElementStrengthDisplayProfiles";
import { buildFinalPresentation } from "@/lib/saju/final/buildFinalPresentation";
import { resolveFinalElement } from "@/lib/saju/final";
import { buildFreeSajuPillars } from "@/lib/saju/free/buildFreeSajuPillars";
import type { FreeSajuBirthFormInput } from "@/lib/saju/free/buildFreeSajuPillars";
import {
  freeSajuBirthFromSearchParams,
  freeSajuBirthToQuery,
} from "@/lib/saju/free/unyulBirthQuery";
import { ElementStrengthPentagon } from "@/components/unyul/ElementStrengthPentagon";
import { MobileShell } from "@/components/layout/MobileShell";
import type { Element, FourPillars, HourPillar, Pillar } from "@/lib/saju/types";

const HERO_IMAGE = "/images/photo-saju.jpg";

const ELEMENT_SHORT_KO: Record<Element, string> = {
  木: "목",
  火: "화",
  土: "토",
  金: "금",
  水: "수",
};

function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function buildQuerySuffix(input: FreeSajuBirthFormInput): string {
  return `?${freeSajuBirthToQuery(input)}`;
}

function formatCalendarLabel(birth: FreeSajuBirthFormInput): string {
  if (birth.calendar === "lunar") {
    return birth.isLeapMonth ? "음력 (윤달)" : "음력";
  }
  return "양력";
}

function formatBirthDateWithCalendar(birth: FreeSajuBirthFormInput): string {
  return `${birth.year}년 ${birth.month}월 ${birth.day}일 (${formatCalendarLabel(birth)})`;
}

function formatBirthTime(birth: FreeSajuBirthFormInput): string {
  if (birth.timeUnknown) return "시간 모름";
  const hour = birth.hour ?? 0;
  const minute = birth.minute ?? 0;
  const period = hour < 12 ? "오전" : "오후";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${period} ${hour12}시 ${String(minute).padStart(2, "0")}분`;
}

function pillarElementSlashLabel(pillar: Pillar): string {
  const stem = ELEMENT_SHORT_KO[stemElement(pillar.stem)];
  const branch = ELEMENT_SHORT_KO[branchElement(pillar.branch)];
  return `${stem}/${branch}`;
}

function easyEngineError(message: string): string {
  if (message.includes("범위")) return "입력하신 연도는 아직 계산할 수 없어요. 다시 입력해 주세요.";
  if (message.includes("윤달")) return "윤달 정보를 다시 확인해 주세요.";
  if (message.includes("음력") || message.includes("양력")) return "생년월일을 다시 확인해 주세요.";
  return "입력 내용을 다시 확인해 주세요.";
}

type PersonalInfoRow = {
  label: string;
  value: string;
};

function buildPersonalInfoRows(
  birth: FreeSajuBirthFormInput,
  searchParams: Record<string, string | string[] | undefined>,
): PersonalInfoRow[] {
  const rows: PersonalInfoRow[] = [];

  const name = firstParam(searchParams.name)?.trim();
  if (name) {
    rows.push({ label: "이름", value: name });
  }

  const gender = firstParam(searchParams.gender)?.trim();
  if (gender) {
    rows.push({ label: "성별", value: gender });
  }

  rows.push({ label: "생년월일", value: formatBirthDateWithCalendar(birth) });
  rows.push({ label: "출생시간", value: formatBirthTime(birth) });

  const region =
    birth.region?.trim() || firstParam(searchParams.region)?.trim() || undefined;
  if (region) {
    rows.push({ label: "출생지역", value: region });
  }

  return rows;
}

function SectionBadge({ number }: { number: string }) {
  return (
    <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[#f3eee6] px-2 text-[12px] font-semibold tracking-wide text-[#8a735a]">
      {number}
    </span>
  );
}

function BasicInfoHeader({
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
    <section className="relative mx-5 mt-2 overflow-hidden rounded-[1.75rem] bg-white shadow-[0_8px_28px_rgba(61,43,31,0.06)] ring-1 ring-[#ebe3d8]">
      <div className="relative grid min-h-[200px] grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)]">
        <div className="flex flex-col justify-center px-5 py-6 sm:px-6 sm:py-7">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[#8a735a]">
            BASIC INFORMATION
          </p>
          <h2 className="mt-2 font-serif text-[28px] font-bold leading-tight tracking-tight text-[#3d2b1f] sm:text-[30px]">
            기본 정보
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed text-[#5c3d2e] sm:text-[15px]">
            나의 사주 정보와
            <br />
            타고난 흐름을 확인해보세요.
          </p>
          <p className="mt-3 text-[12px] leading-relaxed text-[#8a735a] sm:text-[13px]">
            정확한 정보는
            <br />
            더 깊이 있는 분석의 시작입니다.
          </p>
        </div>
        <div className="relative min-h-[200px]">
          <Image
            src={HERO_IMAGE}
            alt=""
            fill
            priority
            className="object-cover object-[70%_40%]"
            sizes="(max-width: 430px) 45vw, 200px"
          />
          <div
            className="absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-white to-transparent"
            aria-hidden
          />
          <p className="absolute bottom-4 left-3 right-3 text-right font-serif text-[12px] leading-snug text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)] sm:bottom-5 sm:text-[13px]">
            나를 더 잘 아는
            <br />
            첫걸음
          </p>
        </div>
      </div>
    </section>
  );
}

function PersonalInfoSection({
  rows,
  editHref,
}: {
  rows: PersonalInfoRow[];
  editHref: string;
}) {
  return (
    <section className="rounded-[1.75rem] bg-white px-5 py-5 shadow-[0_6px_20px_rgba(61,43,31,0.05)] ring-1 ring-[#ebe3d8]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <SectionBadge number="01" />
          <h3 className="font-serif text-[20px] font-bold text-[#3d2b1f]">내 정보</h3>
        </div>
        <Link
          href={editHref}
          className="shrink-0 text-[13px] font-semibold text-[#8a735a]"
        >
          정보 수정하기 →
        </Link>
      </div>

      <div className="mt-5 flex items-start gap-4">
        <div
          className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-[#f3eee6] text-[#8a735a]"
          aria-hidden
        >
          <User className="h-8 w-8" strokeWidth={1.5} />
        </div>
        <dl className="min-w-0 flex-1 space-y-2.5 pt-0.5">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3">
              <dt className="shrink-0 text-[13px] text-[#8a735a]">{row.label}</dt>
              <dd className="text-right text-[14px] font-medium leading-snug text-[#3d2b1f] sm:text-[15px]">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function PillarColumn({
  label,
  pillar,
}: {
  label: string;
  pillar: Pillar | "unknown";
}) {
  return (
    <div className="min-w-0 text-center">
      <div className="rounded-t-xl bg-[#f3eee6] px-0.5 py-2">
        <p className="text-[11px] font-medium text-[#8a735a] sm:text-[12px]">{label}</p>
      </div>
      <div className="border-x border-b border-[#ebe3d8] px-0.5 pb-3 pt-3">
        {pillar === "unknown" ? (
          <p className="text-[12px] leading-snug text-[#6b5648] sm:text-[13px]">시간 모름</p>
        ) : (
          <>
            <p className="whitespace-nowrap font-serif text-[18px] font-bold leading-none text-[#3d2b1f] sm:text-[22px]">
              {pillar.stem}
              {pillar.branch}
            </p>
            <p className="mt-2 text-[11px] leading-none text-[#8a735a] sm:text-[12px]">
              {pillarElementSlashLabel(pillar)}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function FourPillarsSection({ pillars }: { pillars: FourPillars }) {
  const hourPillar: HourPillar = pillars.hour;

  return (
    <section className="rounded-[1.75rem] bg-white px-4 py-5 shadow-[0_6px_20px_rgba(61,43,31,0.05)] ring-1 ring-[#ebe3d8] sm:px-5">
      <div className="flex items-center gap-2.5 px-1 sm:px-0">
        <SectionBadge number="02" />
        <h3 className="font-serif text-[20px] font-bold text-[#3d2b1f]">사주팔자</h3>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-1.5 overflow-hidden rounded-xl sm:gap-2">
        <PillarColumn label="년주" pillar={pillars.year} />
        <PillarColumn label="월주" pillar={pillars.month} />
        <PillarColumn label="일주" pillar={pillars.day} />
        <PillarColumn
          label="시주"
          pillar={hourPillar === "unknown" ? "unknown" : hourPillar}
        />
      </div>
    </section>
  );
}

type CoreEnergyDisplay = {
  element: Element;
  name: string;
  keyword: string;
};

function strongestStrengthElement(
  displaySet: ElementStrengthDisplaySet,
): Element | null {
  if (displaySet.profiles.length === 0) return null;
  let best = displaySet.profiles[0]!;
  for (const profile of displaySet.profiles) {
    if (profile.displayScore > best.displayScore) best = profile;
  }
  return best.element;
}

function ElementBalanceSection({
  displaySet,
  core,
}: {
  displaySet: ElementStrengthDisplaySet;
  core: CoreEnergyDisplay | null;
}) {
  const isPartial = displaySet.certainty === "partial";
  const strongest = strongestStrengthElement(displaySet);

  return (
    <section className="rounded-[1.75rem] bg-white px-5 py-5 shadow-[0_6px_20px_rgba(61,43,31,0.05)] ring-1 ring-[#ebe3d8]">
      <div className="flex items-center gap-2.5">
        <SectionBadge number="03" />
        <div className="min-w-0">
          <h3 className="font-serif text-[20px] font-bold text-[#3d2b1f]">나의 오행 균형</h3>
          <p className="mt-1 text-[11px] font-semibold tracking-[0.14em] text-[#8a735a]">
            ELEMENT BALANCE
          </p>
        </div>
      </div>

      <p className="mt-3 text-[14px] leading-relaxed text-[#6b5648]">
        내 안의 다섯 기운이 얼마나 강하고 약한지 보여줘요.
      </p>

      <ElementStrengthPentagon displaySet={displaySet} className="mt-4" />

      {strongest ? (
        <p className="mt-3 text-center text-[14px] leading-relaxed text-[#5c3d2e]">
          가장 강하게 나타나는 기운은 {ELEMENT_SHORT_KO[strongest]}({strongest})이에요.
        </p>
      ) : null}

      {isPartial ? (
        <p className="mt-3 text-center text-[13px] leading-relaxed text-[#8a735a]">
          출생시간을 입력하면 오행 균형을 더 자세히 볼 수 있어요.
        </p>
      ) : null}

      {core ? (
        <div className="mt-5 rounded-2xl bg-[#f7f3ec] px-4 py-4 text-center">
          <p className="text-[12px] font-semibold tracking-[0.08em] text-[#8a735a]">
            현재 분석의 중심 기운
          </p>
          <p className="mt-2 font-serif text-[22px] font-bold leading-none tracking-tight text-[#3d2b1f]">
            {core.element}
            <span className="mx-1.5 text-[16px] font-semibold text-[#8a735a]">·</span>
            <span className="text-[18px] font-semibold text-[#5c3d2e]">{core.name}</span>
          </p>
          <p className="mt-3 text-[14px] leading-relaxed text-[#6b5648]">
            여러 기운의 관계를 종합했을 때, 나를 중심으로 해석하는 기운이에요.
          </p>
          {core.keyword ? (
            <p className="mt-2 text-[14px] leading-relaxed text-[#5c3d2e]">{core.keyword}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default async function UnyulBasicInfoPage({
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
          <BasicInfoHeader hubHref="/unyul" basicInfoHref="/unyul/input" />
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
  const editHref = `/unyul/input${querySuffix}&from=basic-info`;
  const basicInfoHref = `/unyul/basic-info${querySuffix}`;

  let pillars: FourPillars;
  let displaySet!: ElementStrengthDisplaySet;
  let coreDisplay: CoreEnergyDisplay | null = null;

  try {
    pillars = buildFreeSajuPillars(birth);

    const strengthProfiles = buildElementStrengthProfiles(pillars);
    displaySet = toElementStrengthDisplayProfiles(strengthProfiles);

    const evidence = collectStrengthEvidence(pillars);
    const observations = buildStrengthObservations(pillars, evidence);
    const climate = buildAdjustedClimateSummary(pillars);
    const needResolution = buildNeedResolution(pillars);
    const finalResolution = resolveFinalElement({
      pillars,
      summary: buildStrengthSummary(pillars),
      evidence,
      observations,
      climate,
      needResolution,
    });
    const finalPresentation = buildFinalPresentation(finalResolution);
    if (finalPresentation.element && finalPresentation.name) {
      coreDisplay = {
        element: finalPresentation.element,
        name: finalPresentation.name,
        keyword: finalPresentation.keyword,
      };
    }
  } catch (error) {
    const message = easyEngineError(error instanceof Error ? error.message : "");
    return (
      <MobileShell>
        <div className="bg-[#f9f7f2]">
          <BasicInfoHeader hubHref={hubHref} basicInfoHref={basicInfoHref} />
          <div className="px-5 py-8">
            <p className="text-[17px] leading-relaxed text-[#5c3d2e]">{message}</p>
            <Link
              href={editHref}
              className="mt-6 inline-flex h-14 items-center justify-center rounded-2xl bg-[#3d2b1f] px-6 text-[17px] font-bold text-white"
            >
              정보 수정하기
            </Link>
          </div>
        </div>
      </MobileShell>
    );
  }

  const personalRows = buildPersonalInfoRows(birth, params);

  return (
    <MobileShell>
      <div className="bg-[#f9f7f2] pb-10">
        <BasicInfoHeader hubHref={hubHref} basicInfoHref={basicInfoHref} />
        <PageHero />
        <div className="mt-6 space-y-5 px-5">
          <PersonalInfoSection rows={personalRows} editHref={editHref} />
          <FourPillarsSection pillars={pillars} />
          <ElementBalanceSection displaySet={displaySet} core={coreDisplay} />
        </div>
        <div className="mt-8 px-5">
          <Link
            href={hubHref}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#3d2b1f] text-[16px] font-semibold text-white shadow-[0_4px_14px_rgba(61,43,31,0.18)]"
          >
            내 운율 메인으로 가기 →
          </Link>
        </div>
      </div>
    </MobileShell>
  );
}
