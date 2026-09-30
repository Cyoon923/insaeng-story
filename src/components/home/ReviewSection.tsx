"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Star } from "lucide-react";
import { fetchMe } from "@/lib/client/api";
import {
  pickHomeReviews,
  REVIEW_KIND_LABELS,
  reviewKindFromSaved,
} from "@/lib/constants/reviews";

/** 공개 후기 응답(GET /api/app reviews). 이름은 서버에서 이미 가려져 온다. */
type PublicReview = {
  id: string;
  name: string;
  rating: number;
  text: string;
  kind?: string;
  title?: string;
  verified?: boolean;
};

/**
 * 홈 "고객 후기". 공개 후기 최신 3개와 평균 별점·개수를 보여 주고 전체 후기로 잇는다.
 * 카드 모양은 /reviews와 같다. 공개 후기가 없으면(또는 불러오지 못하면) 섹션을 그리지 않는다.
 */
export function ReviewSection() {
  const [reviews, setReviews] = useState<PublicReview[]>([]);

  useEffect(() => {
    fetchMe()
      .then((data) => setReviews((data.reviews ?? []) as PublicReview[]))
      .catch(() => setReviews([]));
  }, []);

  const home = pickHomeReviews(reviews);
  if (!home) return null;

  return (
    <section className="bg-[#FFFFFF] px-4 pb-5 pt-3">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-bold text-[#403A49]">고객 후기</h2>
          <p className="mt-1 flex items-center gap-1 text-[13px] text-[#6B6570]">
            <Star className="h-3.5 w-3.5 fill-[#c4a574] text-[#c4a574]" aria-hidden />
            <span>
              {home.summary.average.toFixed(1)} (후기 {home.summary.count}개)
            </span>
          </p>
        </div>
        <Link
          href="/reviews"
          className="flex min-h-11 shrink-0 items-center gap-0.5 text-[14px] font-semibold text-[#403A49]"
        >
          전체 후기 보기
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      <div className="space-y-3">
        {home.items.map((review) => {
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
                <div className="flex items-center gap-0.5" aria-label={`별점 ${review.rating}점`}>
                  {Array.from({ length: review.rating }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-[#c4a574] text-[#c4a574]" aria-hidden />
                  ))}
                </div>
              </div>
              <p className="mt-1 text-[12px] text-[#6B6570]">{REVIEW_KIND_LABELS[kind]}</p>
              {review.title ? (
                <p className="mt-2 text-[15px] font-semibold text-[#403A49]">{review.title}</p>
              ) : null}
              <p className="mt-1 text-[14px] leading-relaxed text-[#5c3d2e]">{review.text}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
