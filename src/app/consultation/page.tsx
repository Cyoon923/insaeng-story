"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronRight,
  Star,
  ClipboardList,
  Pencil,
  MessageCircle,
  CheckCircle,
  User,
  X,
} from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { displayReviewsForProduct, summarizeReviews, type Review } from "@/lib/constants/reviews";

/**
 * 상담 선생님 카드 데이터.
 * image가 없는 선생님은 사진이 아직 확정되지 않아 placeholder로 표시한다.
 * 새 이미지 파일은 만들지 않는다.
 */
const TEACHERS = [
  {
    id: "yubi",
    name: "유비 선생",
    badge: "사주로그 전담 선생",
    role: "전체 운세 · 인생 방향 상담",
    desc: "사람의 마음과 이야기에 귀 기울이며, 당신만의 특별한 인생길을 함께 찾아드립니다.",
    tags: ["전체적인 운세", "진로", "올해의 흐름"],
    image: "/images/photo-yubi-teacher.png",
    showRating: true,
    // 아래 상세 내용은 임시 문구다. 실제 약력을 받으면 이 값만 교체하면 된다.
    intro:
      "20년 넘게 사람의 사주와 이야기를 함께 살펴 왔습니다. 어려운 말 대신 지금 상황에 맞는 이야기로 풀어 드립니다.",
    career: [
      "사주로그 전담 선생",
      "개인 상담 다수 진행",
      "인생곡 사주 해석 자문",
    ],
    style:
      "말을 끊지 않고 끝까지 듣습니다. 좋은 이야기만 하지 않고, 지금 챙겨야 할 부분을 분명히 짚어 드립니다.",
  },
  {
    id: "helen",
    name: "헬렌 선생",
    badge: "사주로그 선생",
    role: "연애 · 인연 · 결혼 궁합 상담",
    desc: "관계 속에서 생기는 고민을 편안하게 나누며, 인연의 흐름을 함께 살펴봅니다.",
    tags: ["연애·인연", "결혼·궁합", "가족"],
    image: "/images/photo-helen-teacher.png",
    showRating: false,
    intro:
      "마음이 복잡할 때 편하게 이야기 나눌 수 있는 상담을 지향합니다. 관계의 흐름을 찬찬히 함께 살펴봅니다.",
    career: [
      "사주로그 선생",
      "연애·궁합 상담 다수 진행",
      "가족 관계 상담 진행",
    ],
    style:
      "재촉하지 않고 편안하게 듣습니다. 상대방 사주까지 함께 보며 관계를 넓게 살펴 드립니다.",
  },
  {
    id: "pending",
    name: "이권기 선생",
    badge: "사주로그 선생",
    role: "재물 · 직장 · 사업 흐름 상담",
    desc: "금전과 일의 흐름을 차분히 짚어 보며, 지금 필요한 선택을 함께 정리합니다.",
    tags: ["재물·금전", "직장·사업", "전체적인 운세"],
    image: "/images/photo-pending-teacher.png",
    showRating: false,
    intro:
      "일과 돈에 관한 고민을 현실적인 기준으로 정리해 드립니다. 막연한 불안보다 다음에 할 일을 찾는 상담입니다.",
    career: [
      "사주로그 선생",
      "재물·직장 흐름 상담 진행",
      "사업 시기 상담 진행",
    ],
    style:
      "돌려 말하지 않고 정리해서 알려 드립니다. 선택지를 함께 두고 비교하며 방향을 잡아 갑니다.",
  },
] as const;

type Teacher = (typeof TEACHERS)[number];

const RECOMMENDS = [
  {
    title: "앞으로의 방향이\n고민되는 분",
    desc: "이직·사업·진로 등\n중요한 선택을 앞두고 있을 때",
    image: "/images/photo-career.jpg",
  },
  {
    title: "연애와 인연이\n궁금한 분",
    desc: "연애·결혼·궁합 등\n관계의 흐름이 궁금할 때",
    image: "/images/photo-couple.jpg",
  },
  {
    title: "재물과 일의 흐름이\n궁금한 분",
    desc: "금전·직장·사업의 흐름을\n살펴보고 싶을 때",
    image: "/images/photo-talk.jpg",
  },
  {
    title: "마음속 고민을\n나누고 싶은 분",
    desc: "혼자 결정하기 어려운 고민을\n편안하게 이야기하고 싶을 때",
    image: "/images/photo-tea.jpg",
  },
];

const FIELDS = [
  "전체적인 운세",
  "재물·금전",
  "직장·사업",
  "연애·인연",
  "결혼·궁합",
  "가족",
  "진로",
  "올해의 흐름",
];

const STEPS = [
  { num: "01", title: "상담 신청", desc: "선생님과 시간을 고릅니다", icon: ClipboardList },
  { num: "02", title: "사주정보 입력", desc: "생년월일과 시간을 알려주세요", icon: Pencil },
  { num: "03", title: "선생님과 1:1 상담", desc: "카카오톡 또는 전화로 약 50분", icon: MessageCircle },
  { num: "04", title: "상담 완료", desc: "흐름과 방향을 정리합니다", icon: CheckCircle },
];

const FAQS = [
  {
    q: "처음 사주상담을 받아도 괜찮을까요?",
    a: "괜찮습니다. 선생님이 편안하게 이끌어 드리며, 궁금한 것부터 천천히 살펴봅니다.",
  },
  {
    q: "상담은 어떻게 진행되나요?",
    a: "카카오톡 상담 또는 전화 상담 중 하나를 선택해, 약 50분 동안 진행합니다. 화상 상담은 하지 않습니다.",
  },
  {
    q: "상담 후에는 무엇을 받을 수 있나요?",
    a: "상담을 통해 지금의 흐름과 앞으로의 방향을 함께 정리해 드립니다. 상담 기록 요약 리포트는 신청 시 옵션으로 선택하실 수 있습니다.",
  },
];

export default function ConsultationPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  /** 열려 있는 선생님 상세. null이면 닫힌 상태다. */
  const [openTeacher, setOpenTeacher] = useState<Teacher | null>(null);
  // 실제 공개 후기가 있을 때만 별점·개수를 보여 준다. 없으면 줄 자체를 감춘다.
  const summary = summarizeReviews(reviews);

  useEffect(() => {
    fetch("/api/app", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { reviews?: { id: string; name: string; rating: number; text: string; kind?: string; title?: string }[] }) => {
        setReviews(displayReviewsForProduct("consultation", data.reviews ?? []));
      })
      .catch(() => {});
  }, []);

  return (
    <MobileShell bgClass="bg-[#FFFFFF]">
      <AppHeader
        variant="page"
        title="사주 분석"
        subtitle="사주와 인생의 흐름을 함께 살펴보세요"
        backHref="/"
        bgClass="bg-[#FFFFFF]"
      />

      <section className="relative overflow-hidden bg-[#FFFFFF] pb-4">
        <div className="relative flex min-h-[208px] items-stretch overflow-hidden">
          <div className="relative z-10 flex w-[60%] flex-col justify-center px-5 pt-4 pb-4">
            <p className="text-[13px] font-medium text-[#5c3d2e]">혼자 고민하지 마세요</p>
            <h2 className="mt-3 break-keep font-serif text-[20px] font-bold leading-[1.4] text-[#403A49]">
              지금의 흐름을 이해하면 앞으로의 방향이 보입니다
            </h2>
            <p className="mt-4 text-[18px] font-bold text-[#403A49]">100,000원~</p>
          </div>
          {/*
            Hero 전체를 채우는 배경 이미지. 왼쪽 밝은 페이드가 원본에 그려져 있어
            별도 gradient overlay를 두지 않는다. object-position은 오른쪽으로 치우쳐
            좁은 화면에서 태블릿이 잘리지 않게 하고, 남는 잘림은 빈 왼쪽에서 가져간다.
          */}
          <div className="pointer-events-none absolute inset-0">
            <Image
              src="/images/photo-hero-saju-analysis.png"
              alt=""
              fill
              priority
              className="object-cover object-[85%_center]"
              sizes="430px"
            />
          </div>
        </div>
      </section>

      <section className="px-4 py-6">
        <h3 className="text-[17px] font-bold text-[#403A49]">상담 선생님 소개</h3>
        <div className="mt-3 space-y-3">
          {TEACHERS.map((teacher) => (
            <div key={teacher.name} className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
              <div className="flex items-start gap-3">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-[#f5efe6]">
                  {teacher.image ? (
                    <Image
                      src={teacher.image}
                      alt={teacher.name}
                      fill
                      className="object-cover object-top"
                      sizes="64px"
                    />
                  ) : (
                    // 사진이 아직 없는 선생님은 새 이미지를 만들지 않고 아이콘으로 자리만 잡는다.
                    <div className="flex h-full w-full items-center justify-center">
                      <User className="h-7 w-7 text-[#c4a574]" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[16px] font-bold text-[#403A49]">{teacher.name}</p>
                    <span className="rounded bg-[#f5efe6] px-2 py-0.5 text-[10px] text-[#5c3d2e]">
                      {teacher.badge}
                    </span>
                  </div>
                  <p className="mt-1 break-keep text-[13px] font-medium text-[#5c3d2e]">
                    {teacher.role}
                  </p>
                  {teacher.showRating && summary ? (
                    <div className="mt-1 flex items-center gap-1">
                      {Array.from({ length: Math.round(summary.average) }).map((_, i) => (
                        <Star key={i} className="h-3.5 w-3.5 fill-[#c4a574] text-[#c4a574]" />
                      ))}
                      <span className="text-[12px] text-[#6B6570]">
                        {summary.average.toFixed(1)} (후기 {summary.count}개)
                      </span>
                    </div>
                  ) : null}
                  <p className="mt-2 break-keep text-[13px] leading-relaxed text-[#6B6570]">
                    {teacher.desc}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {teacher.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-[#faf8f5] px-2.5 py-1 text-[12px] text-[#5c3d2e] ring-1 ring-[#ebe3d8]"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpenTeacher(teacher)}
                  className="flex h-11 flex-1 items-center justify-center rounded-lg bg-[#faf8f5] text-[14px] font-semibold text-[#5c3d2e] ring-1 ring-[#ebe3d8]"
                >
                  자세히 보기
                </button>
                <Link
                  href={`/apply/consultation/1?teacher=${teacher.id}`}
                  className="flex h-11 flex-1 items-center justify-center rounded-lg bg-[#403A49] text-[14px] font-semibold text-white"
                >
                  상담 신청하기
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 pb-6">
        <h3 className="text-[17px] font-bold text-[#403A49]">상담에서 보는 그래프</h3>
        <p className="mt-2 break-keep text-[14px] leading-relaxed text-[#6B6570]">
          10개 항목을 개별 그래프와 누적 그래프로 살펴보며 방향을 정리합니다.
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <p className="mb-2 text-[15px] font-bold text-[#403A49]">개별 그래프</p>
            <p className="mb-2 text-[13px] text-[#6B6570]">항목별 흐름을 따로 봅니다.</p>
            <div className="overflow-hidden rounded-2xl bg-[#f3f4f6] ring-1 ring-[#ebe3d8]">
              <Image
                src="/images/life-graph-business.png"
                alt="개별 그래프 예시"
                width={1400}
                height={420}
                className="h-auto w-full"
              />
            </div>
          </div>
          <div>
            <p className="mb-2 text-[15px] font-bold text-[#403A49]">누적 그래프</p>
            <p className="mb-2 text-[13px] text-[#6B6570]">흐름을 모아 함께 봅니다.</p>
            <div className="overflow-hidden rounded-2xl bg-[#f3f4f6] ring-1 ring-[#ebe3d8]">
              <Image
                src="/images/life-graph-health.png"
                alt="누적 그래프 예시"
                width={1400}
                height={420}
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-6">
        <h3 className="text-[17px] font-bold text-[#403A49]">이런 분께 추천드려요</h3>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {RECOMMENDS.map((item) => (
            <div key={item.title} className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#ebe3d8]">
              <div className="relative h-24">
                <Image src={item.image} alt="" fill className="object-cover" sizes="180px" />
              </div>
              <div className="p-3">
                <p className="whitespace-pre-line break-keep text-[13px] font-bold leading-snug text-[#3d2b1f]">{item.title}</p>
                <p className="mt-1 whitespace-pre-line break-keep text-[11px] leading-relaxed text-[#6B6570]">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 pb-6">
        <h3 className="text-[17px] font-bold text-[#403A49]">상담 분야</h3>
        <p className="mt-1 text-[13px] text-[#6B6570]">이런 주제로 상담을 받으실 수 있습니다.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {FIELDS.map((field) => (
            <div
              key={field}
              className="rounded-xl bg-[#f5efe6] px-3 py-3 text-center text-[13px] font-medium text-[#3d2b1f]"
            >
              {field}
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#F7F6F8] px-4 py-6">
        <h3 className="text-[17px] font-bold text-[#403A49]">상담은 이렇게 진행돼요</h3>
        <div className="mt-4 grid grid-cols-4 gap-1">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.num} className="flex flex-col items-center text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#5c3d2e]">
                  <Icon className="h-4 w-4" />
                </div>
                <p className="mt-2 text-[10px] font-bold text-[#6B6570]">{step.num}</p>
                <p className="text-[11px] font-bold leading-snug text-[#3d2b1f]">{step.title}</p>
                <p className="mt-1 text-[10px] leading-snug text-[#6B6570]">{step.desc}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex gap-2">
          <span className="rounded-full bg-white px-3 py-1.5 text-[12px] text-[#5c3d2e]">카카오톡 또는 전화</span>
          <span className="rounded-full bg-white px-3 py-1.5 text-[12px] text-[#5c3d2e]">약 50분</span>
        </div>
      </section>

      <section className="px-4 py-6">
        <h3 className="text-[17px] font-bold text-[#403A49]">상담 후기</h3>
        <p className="mt-1 text-[13px] text-[#6B6570]">유비 선생과 상담하신 분의 이야기입니다.</p>
        {reviews.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-white p-4 text-[14px] text-[#6B6570] ring-1 ring-[#ebe3d8]">
            아직 등록된 후기가 없습니다.
          </p>
        ) : null}
        <div className="mt-3 space-y-3">
          {reviews.map((review) => (
            <div key={review.id} className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-[15px] font-bold text-[#403A49]">{review.name}</p>
                  {review.verified ? (
                    <span className="rounded-full bg-[#f5efe6] px-2 py-0.5 text-[11px] font-medium text-[#5c3d2e]">
                      구매 인증
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: review.rating }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-[#c4a574] text-[#c4a574]" />
                  ))}
                </div>
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-[#5c3d2e]">{review.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 pb-8">
        <h3 className="text-[17px] font-bold text-[#403A49]">자주 묻는 질문</h3>
        <div className="mt-3 space-y-2">
          {FAQS.map((faq) => (
            <details key={faq.q} className="rounded-xl bg-white ring-1 ring-[#ebe3d8]">
              <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-[14px] font-medium text-[#3d2b1f]">
                {faq.q}
                <ChevronRight className="h-4 w-4 shrink-0 text-[#8b6f5c]" />
              </summary>
              <p className="border-t border-[#ebe3d8] px-4 pb-4 pt-3 text-[13px] leading-relaxed text-[#6B6570]">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/*
        선생님 상세 Bottom Sheet.
        MobileShell(max-w-[430px]) 안에서 fixed로 띄우되 좌우를 화면 폭에 맞춰
        가운데 정렬하므로 body 가로 스크롤이 생기지 않는다.
      */}
      {openTeacher ? (
        <div className="fixed inset-0 z-[95] flex items-end justify-center">
          {/* 바깥 영역을 누르면 닫힌다. */}
          <button
            type="button"
            aria-label="닫기"
            onClick={() => setOpenTeacher(null)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative flex max-h-[85vh] w-full max-w-[430px] flex-col rounded-t-2xl bg-[#FFFFFF]">
            <div className="flex items-center justify-between border-b border-[#ebe3d8] px-4 py-3">
              <p className="text-[16px] font-bold text-[#403A49]">선생님 소개</p>
              <button
                type="button"
                aria-label="닫기"
                onClick={() => setOpenTeacher(null)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-[#6B6570]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 내용이 길면 이 영역만 세로로 스크롤된다. */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-[#f5efe6]">
                  {openTeacher.image ? (
                    <Image
                      src={openTeacher.image}
                      alt={openTeacher.name}
                      fill
                      className="object-cover object-top"
                      sizes="80px"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <User className="h-8 w-8 text-[#c4a574]" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[18px] font-bold text-[#403A49]">{openTeacher.name}</p>
                    <span className="rounded bg-[#f5efe6] px-2 py-0.5 text-[10px] text-[#5c3d2e]">
                      {openTeacher.badge}
                    </span>
                  </div>
                  <p className="mt-1 break-keep text-[14px] font-medium text-[#5c3d2e]">
                    {openTeacher.role}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {openTeacher.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-[#faf8f5] px-2.5 py-1 text-[12px] text-[#5c3d2e] ring-1 ring-[#ebe3d8]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <p className="text-[15px] font-bold text-[#403A49]">선생님 소개</p>
                <p className="mt-2 break-keep text-[14px] leading-relaxed text-[#6B6570]">
                  {openTeacher.intro}
                </p>
              </div>

              <div className="mt-5">
                <p className="text-[15px] font-bold text-[#403A49]">주요 약력</p>
                <ul className="mt-2 space-y-1.5">
                  {openTeacher.career.map((item) => (
                    <li
                      key={item}
                      className="flex gap-2 break-keep text-[14px] leading-relaxed text-[#6B6570]"
                    >
                      <span className="text-[#c4a574]">·</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-5">
                <p className="text-[15px] font-bold text-[#403A49]">상담 스타일</p>
                <p className="mt-2 break-keep text-[14px] leading-relaxed text-[#6B6570]">
                  {openTeacher.style}
                </p>
              </div>

              <div className="mt-5 rounded-2xl bg-[#faf8f5] p-4 ring-1 ring-[#ebe3d8]">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[14px] font-medium text-[#403A49]">상담 방식</p>
                  <p className="text-[14px] text-[#6B6570]">전화 · 카카오톡</p>
                </div>
                <div className="mt-2 flex items-start justify-between gap-3">
                  <p className="text-[14px] font-medium text-[#403A49]">상담 시간</p>
                  <p className="text-[14px] text-[#6B6570]">약 50분</p>
                </div>
              </div>
            </div>

            {/* 하단 고정 CTA. 기존 신청 경로를 그대로 쓴다. */}
            <div className="border-t border-[#ebe3d8] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
              <Link
                href={`/apply/consultation/1?teacher=${openTeacher.id}`}
                className="flex h-14 w-full items-center justify-center rounded-xl bg-[#403A49] text-[16px] font-bold text-white"
              >
                {openTeacher.name}에게 상담 신청하기
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </MobileShell>
  );
}
