"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { fetchMe } from "@/lib/client/api";
import type { Inquiry, User } from "@/lib/types/app";

function formatDate(value: string) {
  return value.slice(0, 10).replaceAll("-", ".");
}

function inquiryTitle(item: Inquiry) {
  if (item.product.includes("구독")) return "구독 이벤트";
  if (item.product.includes("사연") || item.product.includes("프리미엄 인생곡")) return "사연 신청";
  if (item.product.startsWith("이벤트")) return "이벤트 신청";
  return "무료 문의";
}

export default function MyInquiriesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<Inquiry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchMe().then((data) => {
      setUser(data.user ?? null);
      setItems(data.inquiries ?? []);
      setLoaded(true);
    });
  }, []);

  return (
    <MobileShell>
      <AppHeader variant="page" title="이벤트 신청" backHref="/my" />

      <section className="px-4 py-5">
        <h2 className="font-serif text-[24px] font-bold text-[#403A49]">이벤트 신청</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#6B6570]">
          이벤트와 무료 문의 신청을 여기에서 확인하세요.
        </p>
      </section>

      <div className="space-y-3 px-4 pb-8">
        {loaded && !user ? (
          <div className="rounded-2xl bg-white p-5 text-center ring-1 ring-[#ebe3d8]">
            <p className="text-[15px] text-[#6B6570]">로그인하면 신청 내역을 볼 수 있습니다.</p>
            <Link
              href="/login"
              className="mt-4 inline-flex h-12 items-center justify-center rounded-full bg-[#403A49] px-6 text-[15px] font-semibold text-white"
            >
              로그인하기
            </Link>
          </div>
        ) : null}
        {loaded && user && items.length === 0 ? (
          <p className="rounded-2xl bg-white p-5 text-center text-[14px] text-[#6B6570] ring-1 ring-[#ebe3d8]">
            아직 신청한 내역이 없습니다.
          </p>
        ) : null}
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[17px] font-bold text-[#403A49]">{inquiryTitle(item)}</h3>
                <p className="mt-1 text-[14px] text-[#6B6570]">신청일 {formatDate(item.createdAt)}</p>
              </div>
              <span className="shrink-0 rounded-full bg-[#e8f3ea] px-2.5 py-0.5 text-[12px] font-medium text-[#3d6b45]">
                신청접수
              </span>
            </div>
            <p className="mt-3 text-[15px] leading-relaxed text-[#403A49]">{item.product}</p>
            {item.message ? (
              <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-[#6B6570]">{item.message}</p>
            ) : null}
          </div>
        ))}
      </div>
    </MobileShell>
  );
}
