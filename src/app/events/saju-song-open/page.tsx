import Image from "next/image";
import Link from "next/link";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { LIFE_SONG_PRODUCTS } from "@/lib/constants/products";
import { PROMOTION_PRICES } from "@/lib/constants/promotions";
import { ORDER_OPTION_PRICES } from "@/lib/server/pricing";

/**
 * 사주 인생곡 OPEN EVENT 랜딩.
 *
 * 금액은 화면에 따로 적지 않고 가격표 상수를 그대로 읽는다. 표시가와 결제가가 갈라지지 않게 하기 위해서다.
 * 실제 적용 여부(시작일 포함)는 신청·결제 단계에서 서버가 다시 판정한다.
 */
const APPLY_HREF = "/apply/saju-song/1?promotion=saju-song-open-2026";
const EVENT_PRICE = PROMOTION_PRICES["saju-song-open-2026"].basePrice;
const REGULAR_PRICE = LIFE_SONG_PRODUCTS.find((item) => item.id === "saju-song")?.priceFrom ?? 0;

const won = (value: number) => `${value.toLocaleString("ko-KR")}원`;

const OPTIONS = [
  { title: "2026·2027년 사주풀이 리포트", price: ORDER_OPTION_PRICES["saju-report-2026-2027"] },
  { title: "1:1 사주상담", price: ORDER_OPTION_PRICES["saju-consultation"] },
  { title: "AI 뮤직비디오", price: ORDER_OPTION_PRICES["ai-mv"] },
  { title: "추억사진 영상", price: ORDER_OPTION_PRICES["photo-mv"] },
  { title: "가사 수정", price: ORDER_OPTION_PRICES["lyric-edit"] },
];

const STEPS = [
  { num: "01", title: "사주 정보 입력", desc: "생년월일과 태어난 시간을 넣어 주세요" },
  { num: "02", title: "이야기와 노래 취향", desc: "하고 싶은 이야기와 좋아하는 노래를 알려 주세요" },
  { num: "03", title: "인생곡 제작", desc: "사주 흐름과 이야기를 담아 곡을 만듭니다" },
  { num: "04", title: "완성·전달", desc: "음원과 가사를 전달해 드립니다" },
];

const RECOMMENDS = [
  "나만을 위한 노래를 갖고 싶은 분",
  "새로운 시작에 힘이 필요한 분",
  "부모님·가족에게 노래를 선물하고 싶은 분",
  "상담 없이 간편하게 노래를 받고 싶은 분",
];

const FAQS = [
  {
    question: "이벤트는 언제부터인가요?",
    answer: "2026년 10월 4일부터 이벤트가로 신청하실 수 있습니다.",
  },
  {
    question: "쿠폰이나 적립금과 함께 쓸 수 있나요?",
    answer: "오픈 이벤트 상품에는 쿠폰, 추천인 코드, 적립금을 함께 사용할 수 없습니다.",
  },
  {
    question: "1:1 사주상담 옵션은 어떻게 진행되나요?",
    answer: "신청하신 연락처로 담당자가 연락드려 상담 일정을 잡아 드립니다.",
  },
  {
    question: "제작 기간은 얼마나 걸리나요?",
    answer: "결제 완료 후 평균 5~7일 정도 걸립니다.",
  },
  {
    question: "완성된 노래는 어떻게 받나요?",
    answer: "음원 파일과 가사로 전달해 드립니다.",
  },
];

function ApplyButton() {
  return (
    <Link
      href={APPLY_HREF}
      className="flex h-14 items-center justify-center rounded-xl bg-[#5c3d2e] text-[18px] font-semibold text-white"
    >
      이벤트가로 신청하기
    </Link>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-serif text-[22px] font-bold text-[#403A49]">{children}</h2>;
}

export default function SajuSongOpenEventPage() {
  return (
    <MobileShell>
      <AppHeader variant="page" title="OPEN EVENT" backHref="/events" />

      {/* Hero. 이미지 비율(1672×941)을 그대로 두고 자르지 않는다. */}
      <section>
        <Image
          src="/images/sajulog-open-event-hero-retro-final.png"
          alt="사주 인생곡 오픈 이벤트"
          width={1672}
          height={941}
          priority
          sizes="430px"
          className="h-auto w-full"
        />
        <div className="px-4 py-6">
          <p className="text-[14px] font-semibold text-[#8a5a3b]">OPEN EVENT · 2026년 10월 4일 OPEN</p>
          <h1 className="mt-2 font-serif text-[28px] font-bold leading-snug text-[#403A49]">
            사주 인생곡
            <br />
            오픈 기념 특별가
          </h1>
          <p className="mt-4 text-[16px] text-[#6B6570] line-through">정상가 {won(REGULAR_PRICE)}</p>
          <p className="mt-1 text-[30px] font-bold text-[#5c3d2e]">{won(EVENT_PRICE)}</p>
          <div className="mt-5">
            <ApplyButton />
          </div>
        </div>
      </section>

      <section className="px-4 py-6">
        <SectionTitle>사주 인생곡이란?</SectionTitle>
        <p className="mt-3 text-[16px] leading-relaxed text-[#403A49]">
          상담 없이 사주 정보와 당신의 이야기, 좋아하는 음악을 함께 담아 세상에 하나뿐인 노래를
          만들어 드립니다.
        </p>
      </section>

      <section className="px-4 py-6">
        <SectionTitle>OPEN EVENT에서 받는 것</SectionTitle>
        <div className="mt-4 rounded-2xl bg-white p-5 ring-1 ring-[#ebe3d8]">
          <p className="text-[17px] font-bold text-[#403A49]">사주 인생곡 1곡</p>
          <ul className="mt-3 space-y-2 text-[16px] leading-relaxed text-[#5c3d2e]">
            <li>· 사주 흐름을 담은 맞춤 가사</li>
            <li>· 이야기와 취향을 반영한 음악</li>
            <li>· 음원 파일과 가사 전달</li>
          </ul>
          <p className="mt-4 text-[16px] text-[#403A49]">
            정상가 <span className="line-through">{won(REGULAR_PRICE)}</span> →{" "}
            <strong className="text-[#5c3d2e]">{won(EVENT_PRICE)}</strong>
          </p>
        </div>
      </section>

      <section className="px-4 py-6">
        <SectionTitle>추가 옵션</SectionTitle>
        <p className="mt-2 text-[15px] text-[#6B6570]">필요한 것만 골라 더할 수 있습니다.</p>
        <ul className="mt-4 divide-y divide-[#ebe3d8] rounded-2xl bg-white ring-1 ring-[#ebe3d8]">
          {OPTIONS.map((option) => (
            <li key={option.title} className="flex items-center justify-between gap-3 px-4 py-4">
              <span className="text-[16px] text-[#403A49]">{option.title}</span>
              <span className="shrink-0 text-[16px] font-semibold text-[#5c3d2e]">
                +{won(option.price)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="px-4 py-6">
        <SectionTitle>제작 과정</SectionTitle>
        <ol className="mt-4 space-y-3">
          {STEPS.map((step) => (
            <li key={step.num} className="flex gap-4 rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
              <span className="text-[18px] font-bold text-[#b08d57]">{step.num}</span>
              <div>
                <p className="text-[17px] font-bold text-[#403A49]">{step.title}</p>
                <p className="mt-1 text-[15px] text-[#6B6570]">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="px-4 py-6">
        <SectionTitle>이런 분께 추천</SectionTitle>
        <ul className="mt-4 space-y-3">
          {RECOMMENDS.map((item) => (
            <li
              key={item}
              className="rounded-2xl bg-[#f5efe6] p-4 text-[16px] font-medium text-[#403A49]"
            >
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="px-4 py-6">
        <SectionTitle>자주 묻는 질문</SectionTitle>
        <div className="mt-4 space-y-3">
          {FAQS.map((faq) => (
            <details key={faq.question} className="rounded-xl bg-white ring-1 ring-[#ebe3d8]">
              <summary className="cursor-pointer px-4 py-4 text-[16px] font-semibold text-[#403A49]">
                {faq.question}
              </summary>
              <p className="px-4 pb-4 text-[15px] leading-relaxed text-[#6B6570]">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="px-4 pb-10 pt-6">
        <div className="rounded-2xl bg-white p-5 text-center ring-1 ring-[#ebe3d8]">
          <p className="font-serif text-[20px] font-bold leading-snug text-[#403A49]">
            당신의 사주와 이야기를
            <br />
            노래로 간직하세요
          </p>
          <p className="mt-2 text-[15px] text-[#6B6570]">2026년 10월 4일 OPEN · {won(EVENT_PRICE)}</p>
          <div className="mt-5">
            <ApplyButton />
          </div>
        </div>
      </section>
    </MobileShell>
  );
}
