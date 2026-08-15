"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { fetchMe } from "@/lib/client/api";
import type { Consultation, User } from "@/lib/types/app";

export default function MyConsultationsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<Consultation[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchMe().then((data) => {
      setUser(data.user ?? null);
      setItems(data.consultations ?? []);
      setLoaded(true);
    });
  }, []);

  return (
    <MobileShell>
      <AppHeader variant="page" title="1:1 상담 내역" backHref="/my" />

      <section className="px-4 py-5">
        <h2 className="font-serif text-[24px] font-bold text-[#3d2b1f]">1:1 상담 내역</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#8b6f5c]">
          신청한 사주상담의 일정과 진행 상황을 확인하세요.
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-[#8b6f5c]">
          상담 신청 → 사주정보 입력 → 선생님과 1:1 상담 → 상담 완료
        </p>
      </section>

      <div className="space-y-3 px-4 pb-8">
        {loaded && !user ? (
          <div className="rounded-2xl bg-white p-5 text-center ring-1 ring-[#ebe3d8]">
            <p className="text-[15px] text-[#8b6f5c]">로그인하면 상담 내역을 볼 수 있습니다.</p>
            <Link
              href="/login"
              className="mt-4 inline-flex h-12 items-center justify-center rounded-full bg-[#5c3d2e] px-6 text-[15px] font-semibold text-white"
            >
              로그인하기
            </Link>
          </div>
        ) : null}
        {loaded && user && items.length === 0 ? (
          <p className="rounded-2xl bg-white p-5 text-center text-[14px] text-[#8b6f5c] ring-1 ring-[#ebe3d8]">
            아직 신청한 상담이 없습니다.
          </p>
        ) : null}
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/my/consultations/${item.id}`}
            className="block rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[17px] font-bold text-[#3d2b1f]">{item.teacher}</h3>
                <p className="mt-1 text-[15px] text-[#5c3d2e]">{item.datetime}</p>
              </div>
              <span className="shrink-0 rounded-full bg-[#e8f3ea] px-2.5 py-0.5 text-[12px] font-medium text-[#3d6b45]">
                {item.status}
              </span>
            </div>
            <ul className="mt-3 space-y-1 text-[14px] leading-relaxed text-[#8b6f5c]">
              <li>상담 목적: {item.purpose || "미입력"}</li>
              <li>상담 방법: {item.method}</li>
              <li>상담 옵션: {item.option}</li>
            </ul>
          </Link>
        ))}
      </div>
    </MobileShell>
  );
}
