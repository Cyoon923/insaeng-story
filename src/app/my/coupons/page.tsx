"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Ticket } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { fetchMe } from "@/lib/client/api";
import type { Coupon } from "@/lib/types/app";

function formatDate(value: string) {
  return value.slice(0, 10).replaceAll("-", ".");
}

export default function CouponsPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchMe().then((data) => {
      setLoggedIn(Boolean(data.user));
      setCoupons(data.coupons ?? []);
      setLoaded(true);
    });
  }, []);

  return (
    <MobileShell>
      <AppHeader variant="page" title="쿠폰함" backHref="/my" />

      <section className="px-4 py-5">
        <h2 className="font-serif text-[24px] font-bold text-[#403A49]">쿠폰함</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#6B6570]">
          받으신 쿠폰을 여기에서 확인하세요.
        </p>
      </section>

      <div className="space-y-3 px-4 pb-8">
        {loaded && !loggedIn ? (
          <div className="rounded-2xl bg-white px-5 py-12 text-center ring-1 ring-[#ebe3d8]">
            <Ticket className="mx-auto h-10 w-10 text-[#8b6f5c]" strokeWidth={1.4} />
            <p className="mt-4 text-[17px] font-bold text-[#403A49]">로그인이 필요합니다</p>
            <p className="mt-2 text-[15px] leading-relaxed text-[#6B6570]">
              로그인하면 받은 쿠폰을 확인할 수 있습니다.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-[#403A49] px-6 text-[15px] font-semibold text-white"
            >
              로그인하기
            </Link>
          </div>
        ) : null}
        {loaded && loggedIn && coupons.length === 0 ? (
          <div className="rounded-2xl bg-white px-5 py-12 text-center ring-1 ring-[#ebe3d8]">
            <Ticket className="mx-auto h-10 w-10 text-[#8b6f5c]" strokeWidth={1.4} />
            <p className="mt-4 text-[17px] font-bold text-[#403A49]">보유한 쿠폰이 없습니다</p>
            <p className="mt-2 text-[15px] leading-relaxed text-[#6B6570]">
              진행 중인 이벤트에서
              <br />
              혜택을 확인하실 수 있습니다.
            </p>
            <Link
              href="/events"
              className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-[#403A49] px-6 text-[15px] font-semibold text-white"
            >
              이벤트 보기
            </Link>
          </div>
        ) : null}
        {coupons.map((coupon) => (
          <div key={coupon.id} className="rounded-2xl bg-white p-5 ring-1 ring-[#ebe3d8]">
            <div className="flex items-start gap-3">
              <Ticket className="mt-0.5 h-6 w-6 text-[#403A49]" />
              <div>
                <p className="text-[16px] font-bold text-[#403A49]">{coupon.title}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-[#6B6570]">{coupon.desc}</p>
                <p className="mt-2 text-[12px] text-[#6B6570]">
                  {coupon.usedAt
                    ? "사용함"
                    : coupon.product
                      ? "신청할 때 쓰면 무료입니다"
                      : `받은 날 ${formatDate(coupon.createdAt)}`}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </MobileShell>
  );
}
