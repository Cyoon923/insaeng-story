"use client";

import { useEffect, useMemo, useState } from "react";
import { Star } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { fetchMe } from "@/lib/client/api";
import { reviewKindFromSaved, type ReviewKind } from "@/lib/constants/reviews";

/** 공개 후기 응답. 작성일과 targetKey는 공개 API에 담기지 않는다. */
type PublicReview = {
  id: string;
  name: string;
  rating: number;
  text: string;
  kind?: string;
  title?: string;
  verified?: boolean;
};

type FilterId = "all" | ReviewKind;

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "story", label: "이야기 인생곡" },
  { id: "premium", label: "프리미엄" },
  { id: "saju-song", label: "사주 인생곡" },
  { id: "consultation", label: "1:1 사주상담" },
];

const KIND_LABEL: Record<ReviewKind, string> = {
  story: "이야기 인생곡",
  premium: "프리미엄 인생곡",
  "saju-song": "사주 인생곡",
  consultation: "1:1 사주상담",
};

const PER_PAGE = 6;
/** 페이지가 많아져도 현재 페이지 주변 번호만 보여 준다. */
const PAGE_WINDOW = 5;

function pageNumbers(current: number, total: number): number[] {
  const count = Math.min(PAGE_WINDOW, total);
  const start = Math.min(
    Math.max(1, current - Math.floor(PAGE_WINDOW / 2)),
    Math.max(1, total - count + 1),
  );
  return Array.from({ length: count }, (_, i) => start + i);
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [filter, setFilter] = useState<FilterId>("all");
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchMe()
      .then((data) => {
        setReviews((data.reviews ?? []) as PublicReview[]);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return reviews;
    return reviews.filter((item) => reviewKindFromSaved(item.title ?? "", item.kind) === filter);
  }, [reviews, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const current = Math.min(page, totalPages);
  const visible = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  return (
    <MobileShell>
      <AppHeader variant="page" title="고객 후기" backHref="/" />

      <section className="px-4 py-5">
        <h2 className="font-serif text-[24px] font-bold text-[#403A49]">고객 후기</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#6B6570]">
          실제로 이용하신 분들이 남겨 주신 이야기입니다.
        </p>
      </section>

      <div className="no-scrollbar overflow-x-auto px-4 pb-4">
        <div className="flex gap-2">
          {FILTERS.map((item) => {
            const active = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setFilter(item.id);
                  // 필터를 바꾸면 항상 첫 페이지부터 본다.
                  setPage(1);
                }}
                className={`h-10 shrink-0 rounded-full px-4 text-[14px] font-semibold ${
                  active
                    ? "bg-[#403A49] text-white"
                    : "border border-[#e8dfd4] bg-white text-[#6B6570]"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 px-4 pb-8">
        {loaded && filtered.length === 0 ? (
          <p className="rounded-2xl bg-white p-5 text-[15px] leading-relaxed text-[#6B6570] ring-1 ring-[#ebe3d8]">
            아직 등록된 후기가 없습니다.
          </p>
        ) : null}

        {visible.map((review) => {
          const kind = reviewKindFromSaved(review.title ?? "", review.kind);
          return (
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
              <p className="mt-1 text-[12px] text-[#6B6570]">{KIND_LABEL[kind]}</p>
              {review.title ? (
                <p className="mt-2 text-[15px] font-semibold text-[#403A49]">{review.title}</p>
              ) : null}
              <p className="mt-1 text-[14px] leading-relaxed text-[#5c3d2e]">{review.text}</p>
            </div>
          );
        })}

        {filtered.length > PER_PAGE ? (
          <nav className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
            <button
              type="button"
              onClick={() => setPage(current - 1)}
              disabled={current === 1}
              className="h-10 rounded-full border border-[#e8dfd4] bg-white px-3 text-[14px] font-medium text-[#403A49] disabled:opacity-40"
            >
              이전
            </button>
            {pageNumbers(current, totalPages).map((number) => (
              <button
                key={number}
                type="button"
                onClick={() => setPage(number)}
                aria-current={number === current ? "page" : undefined}
                className={`h-10 w-10 rounded-full text-[14px] font-semibold ${
                  number === current
                    ? "bg-[#403A49] text-white"
                    : "border border-[#e8dfd4] bg-white text-[#6B6570]"
                }`}
              >
                {number}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage(current + 1)}
              disabled={current === totalPages}
              className="h-10 rounded-full border border-[#e8dfd4] bg-white px-3 text-[14px] font-medium text-[#403A49] disabled:opacity-40"
            >
              다음
            </button>
          </nav>
        ) : null}
      </div>
    </MobileShell>
  );
}
