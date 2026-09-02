"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { fetchMe } from "@/lib/client/api";
import type { Order, User } from "@/lib/types/app";

const IMAGES: Record<string, string> = {
  story: "/images/photo-writing.jpg",
  premium: "/images/photo-premium-life.png",
  "saju-song": "/images/photo-ohaeng.png",
};

const STEPS = ["신청접수", "상담진행", "제작중", "완성/전달", "완료"];

function formatDate(value: string) {
  return value.slice(0, 10).replaceAll("-", ".");
}

export default function MyOrdersPage() {
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchMe().then((data) => {
      setUser(data.user ?? null);
      // 상담 주문은 결제 귀속용이므로 인생곡 중심 화면에서는 제외한다.
      setOrders(
        ((data.orders ?? []) as Order[]).filter((order) => order.product !== "consultation"),
      );
      setLoaded(true);
    });
  }, []);

  return (
    <MobileShell>
      <AppHeader variant="page" title="나의 주문 내역" backHref="/my" />

      <section className="px-4 py-5">
        <h2 className="font-serif text-[24px] font-bold text-[#403A49]">나의 주문 내역</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#6B6570]">
          신청부터 완성까지 진행 상황을 확인하세요.
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-[#6B6570]">
          신청접수 → 상담진행 → 제작중 → 완성/전달 → 완료
        </p>
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
        {loaded && user && orders.length === 0 ? (
          <p className="rounded-2xl bg-white p-5 text-center text-[14px] text-[#6B6570] ring-1 ring-[#ebe3d8]">
            아직 신청한 주문이 없습니다.
          </p>
        ) : null}
        {orders.map((order) => {
          const current = STEPS.indexOf(order.status);
          const process = STEPS.slice(0, Math.max(current + 1, 1)).join(" → ");
          return (
            <Link
              key={order.id}
              href={`/my/orders/${order.id}`}
              className="block rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]"
            >
              <div className="flex items-center gap-3">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#f5efe6]">
                  <Image
                    src={IMAGES[order.product] ?? "/images/photo-hero.jpg"}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[17px] font-bold text-[#403A49]">{order.title}</h3>
                    <span className="rounded-full bg-[#f5efe6] px-2.5 py-0.5 text-[12px] font-medium text-[#403A49]">
                      {order.status}
                    </span>
                  </div>
                  <p className="mt-1 text-[14px] text-[#6B6570]">신청일 {formatDate(order.createdAt)}</p>
                </div>
              </div>
              <p className="mt-3 text-[14px] leading-relaxed text-[#403A49]">{process}</p>
            </Link>
          );
        })}
      </div>
    </MobileShell>
  );
}
