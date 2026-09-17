"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { fetchMe } from "@/lib/client/api";
import { formatPrice } from "@/lib/constants/products";
import { buildMyOrderItems, filterMyOrderItems } from "@/lib/myOrders";
import type { MyOrderFilter, MyOrderItem } from "@/lib/myOrders";
import type { Consultation, Order, User } from "@/lib/types/app";

const IMAGES: Record<string, string> = {
  story: "/images/photo-writing.jpg",
  premium: "/images/photo-premium-life.png",
  "saju-song": "/images/photo-ohaeng.png",
  // 1:1 사주상담 화면이 쓰는 이미지를 그대로 쓴다.
  consultation: "/images/photo-hero-saju-analysis.png",
};

/** 인생곡 제작 단계. 상담에는 쓰지 않는다. */
const STEPS = ["신청접수", "상담진행", "제작중", "완성/전달", "완료"];

/** 사주상담 진행 단계. 제작 단계와 섞지 않는다. */
const CONSULT_STEPS = ["상담 신청", "사주정보 입력", "선생님과 1:1 상담", "상담 완료"];

const FILTERS: { id: MyOrderFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "song", label: "인생곡" },
  { id: "consultation", label: "사주상담" },
];

function formatDate(value: string) {
  return value.slice(0, 10).replaceAll("-", ".");
}

/** 진행 단계 문구. 상품 종류에 맞는 단계표만 쓴다. */
function processText(item: MyOrderItem) {
  const steps = item.kind === "consultation" ? CONSULT_STEPS : STEPS;
  const current = steps.indexOf(item.status);
  return steps.slice(0, Math.max(current + 1, 1)).join(" → ");
}

export default function MyOrdersPage() {
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<MyOrderItem[]>([]);
  const [filter, setFilter] = useState<MyOrderFilter>("all");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchMe().then((data) => {
      setUser(data.user ?? null);
      // 인생곡과 사주상담을 한 목록으로 합친다. 같은 id를 공유하는 상담 주문과
      // 상담은 한 장으로 합쳐지므로 같은 구매가 두 번 보이지 않는다.
      setItems(
        buildMyOrderItems(
          (data.orders ?? []) as Order[],
          (data.consultations ?? []) as Consultation[],
        ),
      );
      setLoaded(true);
    });
  }, []);

  const visible = filterMyOrderItems(items, filter);

  return (
    <MobileShell>
      <AppHeader variant="page" title="나의 주문 내역" backHref="/my" />

      <section className="px-4 py-5">
        <h2 className="font-serif text-[24px] font-bold text-[#403A49]">나의 주문 내역</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#6B6570]">
          인생곡과 사주상담 신청 내역을 함께 확인하세요.
        </p>

        {loaded && user ? (
          <div className="mt-4 flex gap-2">
            {FILTERS.map(({ id, label }) => {
              const active = filter === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  aria-pressed={active}
                  className={`h-11 flex-1 rounded-full text-[15px] font-semibold ${
                    active
                      ? "bg-[#403A49] text-white"
                      : "bg-white text-[#403A49] ring-1 ring-[#ebe3d8]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        ) : null}
      </section>

      <div className="space-y-3 px-4 pb-8">
        {loaded && !user ? (
          <div className="rounded-2xl bg-white p-5 text-center ring-1 ring-[#ebe3d8]">
            <p className="text-[15px] text-[#6B6570]">로그인하면 주문 내역을 볼 수 있습니다.</p>
            <Link
              href="/login"
              className="mt-4 inline-flex h-12 items-center justify-center rounded-full bg-[#403A49] px-6 text-[15px] font-semibold text-white"
            >
              로그인하기
            </Link>
          </div>
        ) : null}
        {loaded && user && visible.length === 0 ? (
          <p className="rounded-2xl bg-white p-5 text-center text-[14px] text-[#6B6570] ring-1 ring-[#ebe3d8]">
            {filter === "consultation"
              ? "아직 신청한 사주상담이 없습니다."
              : filter === "song"
                ? "아직 신청한 인생곡이 없습니다."
                : "아직 신청한 주문이 없습니다."}
          </p>
        ) : null}
        {visible.map((item) => (
          <Link
            key={`${item.kind}-${item.id}`}
            href={item.href}
            className="block rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]"
          >
            <div className="flex items-center gap-3">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#f5efe6]">
                <Image
                  src={IMAGES[item.product] ?? "/images/photo-hero.jpg"}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="break-keep text-[17px] font-bold text-[#403A49]">{item.title}</h3>
                  <span className="rounded-full bg-[#f5efe6] px-2.5 py-0.5 text-[12px] font-medium text-[#403A49]">
                    {item.status}
                  </span>
                </div>
                <p className="mt-1 text-[14px] text-[#6B6570]">신청일 {formatDate(item.createdAt)}</p>
              </div>
            </div>

            {item.kind === "consultation" ? (
              <div className="mt-3 space-y-1 text-[14px] leading-relaxed text-[#403A49]">
                {item.teacher ? <p>선생님 {item.teacher}</p> : null}
                {item.datetime ? <p className="break-keep">예약 {item.datetime}</p> : null}
                <p>결제 금액 {formatPrice(item.amount)}</p>
              </div>
            ) : null}

            <p className="mt-3 break-keep text-[14px] leading-relaxed text-[#403A49]">
              {processText(item)}
            </p>

            {item.kind === "consultation" ? (
              <p className="mt-2 text-[14px] font-semibold text-[#403A49]">상담 상세보기 &gt;</p>
            ) : null}
          </Link>
        ))}
      </div>
    </MobileShell>
  );
}
