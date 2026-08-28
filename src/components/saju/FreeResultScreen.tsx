"use client";

import { useMemo, useState } from "react";
import type { FreeInterpretation } from "@/lib/saju/interpretation/types";
import type { ObservationInterpretation } from "@/lib/saju/observation/interpretation/types";
import {
  HOUR_UNKNOWN_NOTE,
  selectCompactObservation,
} from "@/lib/saju/observation/interpretation/selectCompactObservation";
import type { Element, FourPillars } from "@/lib/saju/types";
import type { FreeSajuBirthFormInput } from "@/lib/saju/free/buildFreeSajuPillars";
import {
  MusicRecommendationCard,
  type FreeResultMusicCardModel,
} from "@/components/saju/MusicRecommendationCard";

const ELEMENT_SOFT: Record<Element, string> = {
  木: "나무",
  火: "불",
  土: "흙",
  金: "쇠",
  水: "물",
};

const ELEMENT_DOT: Record<Element, string> = {
  木: "bg-[#7d9b76]",
  火: "bg-[#c47a5a]",
  土: "bg-[#b8956c]",
  金: "bg-[#8a8f9a]",
  水: "bg-[#6b8fad]",
};

export type FreeResultBirthSummary = {
  birth: FreeSajuBirthFormInput;
  pillars: FourPillars;
};

export type FreeResultScreenProps = {
  interpretation: FreeInterpretation;
  observationInterpretation?: ObservationInterpretation;
  hourUnknown?: boolean;
  birthSummary?: FreeResultBirthSummary;
  /** Pre-built music cards (max 3). Empty array shows empty state. */
  musicRecommendations?: FreeResultMusicCardModel[];
};

function formatBirthDate(birth: FreeSajuBirthFormInput): string {
  return `${birth.year}년 ${birth.month}월 ${birth.day}일`;
}

function formatBirthTime(birth: FreeSajuBirthFormInput): string {
  if (birth.timeUnknown) return "태어난 시간을 모름";
  const hour = birth.hour ?? 0;
  const minute = birth.minute ?? 0;
  const period = hour < 12 ? "오전" : "오후";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${period} ${hour12}시 ${String(minute).padStart(2, "0")}분`;
}

function formatCalendar(birth: FreeSajuBirthFormInput): string {
  if (birth.calendar === "lunar") {
    return birth.isLeapMonth ? "음력 (윤달)" : "음력";
  }
  return "양력";
}

function pillarText(pillars: FourPillars, slot: "year" | "month" | "day" | "hour"): string {
  if (slot === "hour") {
    return pillars.hour === "unknown" ? "모름" : `${pillars.hour.stem}${pillars.hour.branch}`;
  }
  const pillar = pillars[slot];
  return `${pillar.stem}${pillar.branch}`;
}

function ElementChips({ elements }: { elements: Element[] }) {
  if (elements.length === 0) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {elements.map((element) => (
        <span
          key={element}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#f3eee6] px-2.5 py-1 text-[12px] font-medium text-[#5c3d2e]"
        >
          <span className={`h-2.5 w-2.5 rounded-full ${ELEMENT_DOT[element]}`} aria-hidden />
          {ELEMENT_SOFT[element]}
        </span>
      ))}
    </div>
  );
}

function SectionLabel({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <p
      className={`text-[13px] font-semibold tracking-[0.04em] ${
        accent ? "text-[#7c3aed]" : "text-[#8b6f5c]"
      }`}
    >
      {children}
    </p>
  );
}

function DetailBlock({ title, sentences }: { title: string; sentences: string[] }) {
  if (sentences.length === 0) return null;
  return (
    <div className="mt-5 first:mt-0">
      <p className="text-[13px] font-semibold text-[#8b6f5c]">{title}</p>
      <ul className="mt-2.5 space-y-2.5">
        {sentences.map((text) => (
          <li key={text} className="text-[15px] leading-relaxed text-[#3d2b1f]">
            {text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BirthInfoCard({ birthSummary }: { birthSummary: FreeResultBirthSummary }) {
  const { birth, pillars } = birthSummary;
  const slots: Array<{ key: "year" | "month" | "day" | "hour"; label: string }> = [
    { key: "year", label: "년주" },
    { key: "month", label: "월주" },
    { key: "day", label: "일주" },
    { key: "hour", label: "시주" },
  ];

  return (
    <section className="rounded-[1.5rem] bg-white p-5 shadow-[0_8px_24px_rgba(92,61,46,0.05)] ring-1 ring-[#ebe3d8]">
      <SectionLabel>나의 사주 기본 정보</SectionLabel>
      <dl className="mt-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <dt className="text-[14px] text-[#8b6f5c]">생년월일</dt>
          <dd className="text-right text-[15px] font-medium text-[#3d2b1f]">{formatBirthDate(birth)}</dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-[14px] text-[#8b6f5c]">출생시간</dt>
          <dd className="text-right text-[15px] font-medium text-[#3d2b1f]">{formatBirthTime(birth)}</dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-[14px] text-[#8b6f5c]">양력 / 음력</dt>
          <dd className="text-right text-[15px] font-medium text-[#3d2b1f]">{formatCalendar(birth)}</dd>
        </div>
      </dl>
      <div className="mt-5 grid grid-cols-4 gap-2">
        {slots.map((slot) => (
          <div
            key={slot.key}
            className="rounded-2xl bg-[#faf7f2] px-1.5 py-3 text-center ring-1 ring-[#ebe3d8]"
          >
            <p className="text-[11px] font-medium text-[#8b6f5c]">{slot.label}</p>
            <p className="mt-1.5 font-serif text-[17px] font-semibold leading-none text-[#3d2b1f]">
              {pillarText(pillars, slot.key)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function MusicPlaceholder() {
  return (
    <section className="rounded-[1.5rem] bg-white p-5 ring-1 ring-[#ebe3d8]">
      <SectionLabel accent>나의 기운과 어울리는 음악</SectionLabel>
      <p className="mt-2 text-[14px] leading-relaxed text-[#8b6f5c]">
        사주에서 보이는 관계와 분위기를 바탕으로
        <br />
        어울리는 음악을 연결할 예정이에요.
      </p>
      <div className="mt-4 flex min-h-[88px] items-center justify-center rounded-2xl border border-dashed border-[#ddd6fe] bg-[#faf7ff] px-4">
        <p className="text-center text-[14px] leading-relaxed text-[#7c3aed]/80">
          음악 자리 준비 중
        </p>
      </div>
    </section>
  );
}

function MusicRecommendationSection({
  items,
}: {
  items: FreeResultMusicCardModel[] | undefined;
}) {
  // undefined = not wired (legacy); empty array = wired but no candidates
  if (items === undefined) {
    return <MusicPlaceholder />;
  }

  return (
    <section className="rounded-[1.5rem] bg-white p-5 shadow-[0_8px_24px_rgba(92,61,46,0.04)] ring-1 ring-[#ebe3d8]">
      <SectionLabel accent>나의 기운과 어울리는 음악</SectionLabel>
      <p className="mt-2 text-[14px] leading-relaxed text-[#8b6f5c]">
        사주에서 보이는 분위기와 관계를 참고해 어울리는 음악을 골라봤어요.
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

function CompactObservationResult({
  interpretation,
  observationInterpretation,
  hourUnknown = false,
  birthSummary,
  musicRecommendations,
}: Required<Pick<FreeResultScreenProps, "interpretation" | "observationInterpretation">> &
  Pick<FreeResultScreenProps, "hourUnknown" | "birthSummary" | "musicRecommendations">) {
  const [expanded, setExpanded] = useState(false);
  const compact = useMemo(
    () =>
      selectCompactObservation({
        headline: interpretation.headline,
        interpretation,
        observation: observationInterpretation,
      }),
    [interpretation, observationInterpretation],
  );

  const basicActingSentences = [
    ...compact.basicActing.map((item) => item.text),
    ...(compact.basicCoexistence ? [compact.basicCoexistence.text] : []),
  ];

  const detailHelpingSentences = compact.detailHelping.map((item) => item.text);
  const detailActingSentences = compact.detailActing.map((item) => item.text);
  const detailCoexistenceSentences = compact.detailCoexistence ? [compact.detailCoexistence.text] : [];
  const detailHiddenSentences = compact.detailHiddenContext.map((item) => item.text);
  const detailClimateSentences = compact.detailClimateNotes.map((item) => item.text);

  const hasDetail =
    detailHelpingSentences.length > 0 ||
    detailActingSentences.length > 0 ||
    detailCoexistenceSentences.length > 0 ||
    Boolean(compact.detailExplanation) ||
    compact.detailUncertaintyNotes.length > 0 ||
    detailHiddenSentences.length > 0 ||
    compact.detailSupportItems.length > 0 ||
    compact.detailCautionItems.length > 0 ||
    detailClimateSentences.length > 0;

  return (
    <div className="px-4 pb-12 pt-5 text-[#3d2b1f]">
      <header className="mb-6">
        <p className="text-[12px] font-semibold tracking-[0.08em] text-[#7c3aed]">운율 결과</p>
        <h1 className="mt-2 font-serif text-[28px] font-bold leading-snug text-[#3d2b1f]">
          나의 사주를
          <br />
          한눈에 살펴보세요
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#6b5648]">
          태어난 사주 안의 관계와 계절적인 특징을
          <br />
          쉽게 풀어드려요.
        </p>
      </header>

      {hourUnknown ? (
        <section
          aria-live="polite"
          className="mb-5 rounded-2xl border border-[#ddd6fe] bg-[#f5f3ff] px-4 py-3"
        >
          <p className="text-[14px] leading-relaxed text-[#5b21b6]">{HOUR_UNKNOWN_NOTE}</p>
        </section>
      ) : null}

      {birthSummary ? (
        <div className="mb-5">
          <BirthInfoCard birthSummary={birthSummary} />
        </div>
      ) : null}

      <section className="rounded-[1.5rem] bg-gradient-to-b from-white to-[#faf7f2] p-5 shadow-[0_10px_28px_rgba(92,61,46,0.07)] ring-1 ring-[#e4d8ca]">
        <SectionLabel>한 줄로 보는 흐름</SectionLabel>
        <p className="mt-3 font-serif text-[21px] font-semibold leading-relaxed text-[#3d2b1f]">
          {interpretation.headline}
        </p>
      </section>

      {compact.basicHelping.length > 0 ? (
        <section className="mt-5 rounded-[1.5rem] bg-white p-5 shadow-[0_8px_24px_rgba(92,61,46,0.04)] ring-1 ring-[#ebe3d8]">
          <SectionLabel>내 사주 안에서 보이는 관계</SectionLabel>
          <p className="mt-2 text-[14px] leading-relaxed text-[#8b6f5c]">
            내 사주에 이미 들어 있는 기운들이 서로 어떤 관계를 이루는지 살펴본 내용이에요.
            <br />
            부족한 기운이나 보완할 오행을 정한 것은 아니에요.
          </p>
          <ul className="mt-4 space-y-3">
            {compact.basicHelping.map((item) => (
              <li key={`${item.kind}-${item.order}`} className="rounded-2xl bg-[#faf7f2] px-4 py-3.5">
                <ElementChips elements={item.elements} />
                <p className="text-[16px] leading-relaxed text-[#3d2b1f]">{item.text}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {basicActingSentences.length > 0 ? (
        <section className="mt-5 rounded-[1.5rem] bg-white p-5 shadow-[0_8px_24px_rgba(92,61,46,0.04)] ring-1 ring-[#ebe3d8]">
          <SectionLabel>함께 나타나는 성질</SectionLabel>
          <ul className="mt-4 space-y-3">
            {compact.basicActing.map((item) => (
              <li key={`${item.kind}-${item.element}`} className="rounded-2xl bg-[#faf7f2] px-4 py-3.5">
                <ElementChips elements={[item.element]} />
                <p className="text-[16px] leading-relaxed text-[#3d2b1f]">{item.text}</p>
              </li>
            ))}
            {compact.basicCoexistence ? (
              <li className="rounded-2xl bg-[#faf7f2] px-4 py-3.5">
                <p className="text-[16px] leading-relaxed text-[#3d2b1f]">{compact.basicCoexistence.text}</p>
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      {compact.basicClimateNote ? (
        <section className="mt-5 rounded-[1.5rem] border border-[#e9d5ff] bg-[#f7f4ff] p-5 shadow-[0_8px_24px_rgba(124,58,237,0.06)]">
          <SectionLabel accent>환경적으로 참고할 부분</SectionLabel>
          <p className="mt-2 text-[14px] leading-relaxed text-[#6b5648]">
            위의 오행 관계와는 별개로,
            <br />
            태어난 계절과 환경의 성향만 참고해 본 내용이에요.
          </p>
          <p className="mt-4 text-[16px] leading-relaxed text-[#3d2b1f]">{compact.basicClimateNote.text}</p>
        </section>
      ) : null}

      {hasDetail ? (
        <div className="mt-6">
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
            className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-[#e4d8ca] bg-white px-4 py-3 text-[16px] font-semibold text-[#5c3d2e] ring-1 ring-[#ebe3d8]"
          >
            {expanded ? "간단히 보기" : "조금 더 자세히 보기"}
          </button>

          {expanded ? (
            <section className="mt-4 rounded-[1.5rem] bg-[#faf7f2] p-5 ring-1 ring-[#ebe3d8]">
              <DetailBlock title="추가로 보이는 관계" sentences={detailHelpingSentences} />
              <DetailBlock title="추가로 나타나는 성질" sentences={detailActingSentences} />
              <DetailBlock title="함께 나타나는 흐름" sentences={detailCoexistenceSentences} />
              {compact.detailExplanation ? (
                <div className="mt-5 first:mt-0">
                  <p className="text-[13px] font-semibold text-[#8b6f5c]">조금 더 살펴보면</p>
                  <p className="mt-2.5 text-[15px] leading-relaxed text-[#3d2b1f]">
                    {compact.detailExplanation}
                  </p>
                </div>
              ) : null}
              <DetailBlock title="알아두면 좋은 점" sentences={compact.detailUncertaintyNotes} />
              <DetailBlock
                title="힘을 채울 때 참고할 방향"
                sentences={compact.detailSupportItems.map((item) => item.text)}
              />
              <DetailBlock
                title="함께 살펴볼 점"
                sentences={compact.detailCautionItems.map((item) => item.text)}
              />
              <DetailBlock title="환경 참고" sentences={detailClimateSentences} />
              <DetailBlock title="안쪽 흐름에서 보이는 자리" sentences={detailHiddenSentences} />
            </section>
          ) : null}
        </div>
      ) : null}

      <div className="mt-8">
        <MusicRecommendationSection items={musicRecommendations} />
      </div>
    </div>
  );
}

/** Legacy free-v1 layout when ObservationInterpretation is not provided. */
function LegacyFreeResult({ interpretation }: { interpretation: FreeInterpretation }) {
  const {
    headline,
    explanation,
    supportItems,
    cautionItems,
    climateNotes,
    uncertaintyNotes,
  } = interpretation;

  return (
    <div className="mx-auto w-full max-w-[430px] bg-[#f7f4ef] px-4 pb-10 pt-6 text-[#3d2b1f]">
      <header className="mb-6">
        <p className="text-[12px] font-medium tracking-[0.08em] text-[#8b6f5c]">무료로 살펴보기</p>
        <h1 className="mt-1 font-serif text-[26px] font-bold leading-snug text-[#3d2b1f]">
          나의 흐름 읽기
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[#8b6f5c]">
          확정이 아니라, 지금 보이는 모습을 부드럽게 살펴봅니다.
        </p>
      </header>

      <section className="rounded-[1.5rem] bg-gradient-to-b from-white to-[#faf7f2] p-5 shadow-[0_8px_30px_rgba(92,61,46,0.06)] ring-1 ring-[#ebe3d8]">
        <p className="text-[12px] font-semibold tracking-[0.04em] text-[#a8907c]">한 줄로 보는 흐름</p>
        <p className="mt-3 font-serif text-[20px] font-semibold leading-relaxed text-[#3d2b1f]">
          {headline}
        </p>
      </section>

      {explanation ? (
        <section className="mt-4 rounded-[1.5rem] bg-white p-5 ring-1 ring-[#ebe3d8]">
          <p className="text-[12px] font-semibold tracking-[0.04em] text-[#a8907c]">조금 더 살펴보면</p>
          <p className="mt-3 text-[15px] leading-relaxed text-[#5c3d2e]">{explanation}</p>
        </section>
      ) : null}

      {supportItems.length > 0 ? (
        <section className="mt-4 rounded-[1.5rem] bg-white p-5 ring-1 ring-[#ebe3d8]">
          <p className="text-[12px] font-semibold tracking-[0.04em] text-[#a8907c]">
            힘을 채울 때 참고할 방향
          </p>
          <ul className="mt-4 space-y-2.5">
            {supportItems.map((item, index) => (
              <li key={`support-${index}`} className="text-[15px] leading-relaxed">
                {item.text}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {cautionItems.length > 0 ? (
        <section className="mt-4 rounded-[1.5rem] bg-[#fffaf6] p-5 ring-1 ring-[#eadfce]">
          <p className="text-[12px] font-semibold tracking-[0.04em] text-[#a8907c]">함께 살펴볼 점</p>
          <ul className="mt-4 space-y-2.5">
            {cautionItems.map((item, index) => (
              <li key={`caution-${index}`} className="text-[15px] leading-relaxed">
                {item.text}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {climateNotes.length > 0 ? (
        <section className="mt-4 rounded-[1.5rem] bg-[#faf8f5] p-5 ring-1 ring-[#ebe3d8]">
          <p className="text-[12px] font-semibold tracking-[0.04em] text-[#a8907c]">
            참고해서 볼 부분
          </p>
          <ul className="mt-4 space-y-2.5">
            {climateNotes.map((item, index) => (
              <li key={`climate-${index}`} className="text-[15px] leading-relaxed">
                {item.text}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {uncertaintyNotes.length > 0 ? (
        <section className="mt-4 rounded-[1.5rem] bg-[#f3eee6] px-5 py-4">
          <p className="text-[12px] font-semibold tracking-[0.04em] text-[#a8907c]">알아두면 좋은 점</p>
          <ul className="mt-2.5 space-y-2">
            {uncertaintyNotes.map((note) => (
              <li key={note} className="text-[14px] leading-relaxed text-[#6b5648]">
                {note}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export function FreeResultScreen({
  interpretation,
  observationInterpretation,
  hourUnknown = false,
  birthSummary,
  musicRecommendations,
}: FreeResultScreenProps) {
  if (observationInterpretation) {
    return (
      <CompactObservationResult
        interpretation={interpretation}
        observationInterpretation={observationInterpretation}
        hourUnknown={hourUnknown}
        birthSummary={birthSummary}
        musicRecommendations={musicRecommendations}
      />
    );
  }

  return <LegacyFreeResult interpretation={interpretation} />;
}
