"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { fetchMe } from "@/lib/client/api";
import { REFUND_COMPLETED_STATUS } from "@/lib/myOrders";
import { hasCompletedRefundForOrder } from "@/lib/refundRequestSection";
import type { Consultation, LatestRefundRequestsView, User } from "@/lib/types/app";

export default function MyConsultationsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<Consultation[]>([]);
  /**
   * 주문별 최신 환불 문의. 이미 받은 응답을 그대로 들고 있는다(추가 조회 없음).
   * 읽지 못했으면 loaded가 false이고, 그때는 환불 완료로 추정하지 않는다.
   */
  const [refunds, setRefunds] = useState<LatestRefundRequestsView | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchMe().then((data) => {
      setUser(data.user ?? null);
      setItems(data.consultations ?? []);
      setRefunds((data.latestRefundRequests as LatestRefundRequestsView | undefined) ?? null);
      setLoaded(true);
    });
  }, []);

  return (
    <MobileShell>
      <AppHeader variant="page" title="1:1 사주상담 내역" backHref="/my" />

      <section className="px-4 py-5">
        <h2 className="font-serif text-[24px] font-bold text-[#403A49]">1:1 사주상담 내역</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#6B6570]">
          신청한 사주상담의 일정과 진행 상황을 확인하세요.
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-[#6B6570]">
          상담 신청 → 사주정보 입력 → 선생님과 1:1 상담 → 상담 완료
        </p>
      </section>

      <div className="space-y-3 px-4 pb-8">
        {loaded && !user ? (
          <div className="rounded-2xl bg-white p-5 text-center ring-1 ring-[#ebe3d8]">
            <p className="text-[15px] text-[#6B6570]">로그인하면 사주상담 내역을 볼 수 있습니다.</p>
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
            아직 신청한 상담이 없습니다.
          </p>
        ) : null}
        {items.map((item) => {
          /*
           * 상담과 결제 귀속 주문은 같은 id를 쓴다(applyOrder.ts). 그래서 상담 id로 찾는다.
           * 짝이 되는 주문이 없는 옛 상담에는 환불 문의도 없어 언제나 false가 된다.
           */
          const refundCompleted = hasCompletedRefundForOrder(refunds, item.id);
          return (
          <Link
            key={item.id}
            href={`/my/consultations/${item.id}`}
            className="block rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[17px] font-bold text-[#403A49]">{item.teacher}</h3>
                <p className="mt-1 text-[15px] text-[#403A49]">{item.datetime}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
                  refundCompleted ? "bg-[#403A49] text-white" : "bg-[#e8f3ea] text-[#3d6b45]"
                }`}
              >
                {refundCompleted ? REFUND_COMPLETED_STATUS : item.status}
              </span>
            </div>
            <ul className="mt-3 space-y-1 text-[14px] leading-relaxed text-[#6B6570]">
              <li>상담 목적: {item.purpose || "미입력"}</li>
              <li>상담 방법: {item.method}</li>
              <li>상담 옵션: {item.option}</li>
            </ul>
          </Link>
          );
        })}
      </div>
    </MobileShell>
  );
}
