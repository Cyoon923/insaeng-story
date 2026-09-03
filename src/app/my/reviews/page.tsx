"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { fetchMe } from "@/lib/client/api";
import type { Consultation, Order } from "@/lib/types/app";

/** 내 후기 응답. targetKey는 예전 후기에서 빈 값일 수 있다. */
type MyReview = {
  id: string;
  targetKey: string;
  kind?: "story" | "premium" | "saju-song" | "consultation";
  title: string;
  rating: number;
  text: string;
  createdAt: string;
  visible: boolean;
};

type Target = {
  key: string;
  title: string;
  subtitle: string;
};

/** 후기 작성 화면(/my/reviews/write)과 같은 자격 규칙을 쓴다. */
function receivedTargets(orders: Order[], consultations: Consultation[]): Target[] {
  const songs = orders
    .filter((item) => item.status === "완성/전달" || item.status === "완료")
    .map((item) => ({
      key: `order:${item.id}`,
      title: item.title,
      subtitle: item.status,
    }));
  const consults = consultations
    .filter((item) => item.status === "상담 완료")
    .map((item) => ({
      key: `consult:${item.id}`,
      title: "1:1 사주상담",
      subtitle: `${item.teacher} · ${item.datetime}`,
    }));
  return [...songs, ...consults];
}

function formatDate(value: string) {
  return value.slice(0, 10).replaceAll("-", ".");
}

export default function MyReviewsPage() {
  const [loaded, setLoaded] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [targets, setTargets] = useState<Target[]>([]);
  const [reviews, setReviews] = useState<MyReview[]>([]);

  useEffect(() => {
    fetchMe()
      .then((data) => {
        setLoggedIn(Boolean(data.user));
        const mine = (data.myReviews ?? []) as MyReview[];
        setReviews(mine);
        // 이미 후기를 남긴 대상은 작성 목록에서 뺀다. 서버도 409로 한 번 더 막는다.
        const written = new Set(mine.map((item) => item.targetKey).filter(Boolean));
        setTargets(
          receivedTargets(
            (data.orders ?? []) as Order[],
            (data.consultations ?? []) as Consultation[],
          ).filter((item) => !written.has(item.key)),
        );
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  return (
    <MobileShell>
      <AppHeader variant="page" title="후기" backHref="/my" />

      <section className="px-4 py-5">
        <h2 className="font-serif text-[24px] font-bold text-[#403A49]">후기</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#6B6570]">
          받아 보신 상품과 상담에 후기를 남기실 수 있습니다.
        </p>
      </section>

      {loaded && !loggedIn ? (
        <div className="px-4 pb-8">
          <div className="rounded-2xl bg-white px-5 py-12 text-center ring-1 ring-[#ebe3d8]">
            <Star className="mx-auto h-10 w-10 text-[#8b6f5c]" strokeWidth={1.4} />
            <p className="mt-4 text-[17px] font-bold text-[#403A49]">로그인이 필요합니다</p>
            <p className="mt-2 text-[15px] leading-relaxed text-[#6B6570]">
              로그인하면 후기를 남기고 확인할 수 있습니다.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-[#403A49] px-6 text-[15px] font-semibold text-white"
            >
              로그인하기
            </Link>
          </div>
        </div>
      ) : null}

      {loaded && loggedIn ? (
        <>
          <section className="px-4 pb-6">
            <h3 className="text-[17px] font-bold text-[#403A49]">작성 가능한 후기</h3>
            <div className="mt-3 space-y-3">
              {targets.length === 0 ? (
                <p className="rounded-2xl bg-white p-5 text-[15px] leading-relaxed text-[#6B6570] ring-1 ring-[#ebe3d8]">
                  지금 후기를 남기실 수 있는 신청이 없습니다.
                </p>
              ) : null}
              {targets.map((target) => (
                <div key={target.key} className="rounded-2xl bg-white p-5 ring-1 ring-[#ebe3d8]">
                  <p className="text-[16px] font-bold text-[#403A49]">{target.title}</p>
                  <p className="mt-1 text-[14px] text-[#6B6570]">{target.subtitle}</p>
                  <Link
                    href="/my/reviews/write"
                    className="mt-3 inline-flex h-12 items-center justify-center rounded-full bg-[#403A49] px-6 text-[15px] font-semibold text-white"
                  >
                    후기 작성하기
                  </Link>
                </div>
              ))}
            </div>
          </section>

          <section className="px-4 pb-8">
            <h3 className="text-[17px] font-bold text-[#403A49]">내가 작성한 후기</h3>
            <div className="mt-3 space-y-3">
              {reviews.length === 0 ? (
                <p className="rounded-2xl bg-white p-5 text-[15px] leading-relaxed text-[#6B6570] ring-1 ring-[#ebe3d8]">
                  아직 작성하신 후기가 없습니다.
                </p>
              ) : null}
              {reviews.map((review) => (
                <div key={review.id} className="rounded-2xl bg-white p-5 ring-1 ring-[#ebe3d8]">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[16px] font-bold text-[#403A49]">{review.title}</p>
                    <span className="shrink-0 rounded-full bg-[#f5efe6] px-2.5 py-0.5 text-[12px] font-medium text-[#5c3d2e]">
                      {review.visible ? "공개" : "승인 대기"}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-0.5">
                    {Array.from({ length: review.rating }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-[#c4a574] text-[#c4a574]" />
                    ))}
                  </div>
                  <p className="mt-2 text-[14px] leading-relaxed text-[#5c3d2e]">{review.text}</p>
                  <p className="mt-2 text-[12px] text-[#6B6570]">{formatDate(review.createdAt)}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </MobileShell>
  );
}
