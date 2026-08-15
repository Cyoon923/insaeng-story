"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronRight,
  Music,
  Headphones,
  Heart,
  Ticket,
  Megaphone,
  HelpCircle,
  BookOpen,
  Lock,
  Bell,
  LogIn,
  LogOut,
  ClipboardList,
  MessageCircle,
  Pencil,
  CheckCircle,
} from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { fetchMe } from "@/lib/client/api";
import type { Order, User } from "@/lib/types/app";

const MENU_GRID = [
  { icon: Headphones, label: "1:1 상담 내역", href: "/my/consultations" },
  { icon: Heart, label: "찜한 상품", href: "/my/wishlist" },
  { icon: Ticket, label: "쿠폰함", href: "/my/coupons" },
  { icon: Megaphone, label: "공지사항", href: "/notice?from=my" },
  { icon: HelpCircle, label: "자주 묻는 질문", href: "/faq?from=my" },
  { icon: BookOpen, label: "이용 안내", href: "/guide?from=my" },
];

const PROCESS = [
  { num: "01", label: "신청접수", icon: ClipboardList },
  { num: "02", label: "상담진행", icon: MessageCircle },
  { num: "03", label: "제작중", icon: Pencil },
  { num: "04", label: "완성/전달", icon: Music },
  { num: "05", label: "완료", icon: CheckCircle },
];

const IMAGES: Record<string, string> = {
  story: "/images/photo-writing.jpg",
  premium: "/images/photo-premium-life.png",
  "saju-song": "/images/photo-ohaeng.png",
};

function formatDate(value: string) {
  return value.slice(0, 10).replaceAll("-", ".");
}

export default function MyPage() {
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchMe().then((data) => {
      setUser(data.user ?? null);
      setOrders(data.orders ?? []);
      setLoaded(true);
    });
  }, []);

  const currentStatus = orders[0]?.status ?? "신청접수";

  return (
    <MobileShell>
      <AppHeader variant="page" title="마이페이지" subtitle="" backHref="/" />

      <div className="mx-4 mt-4 rounded-2xl bg-[#f5efe6] p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#5c3d2e]">
            👤
          </div>
          <div className="min-w-0 flex-1">
            {user ? (
              <>
                <p className="text-[18px] font-bold text-[#3d2b1f]">{user.name || "회원"}님</p>
                <p className="text-[13px] text-[#8b6f5c]">{user.phone}</p>
                <Link href="/my/profile" className="mt-2 inline-block rounded-full bg-white px-3 py-1.5 text-[12px] text-[#5c3d2e]">
                  회원정보 수정 &gt;
                </Link>
              </>
            ) : (
              <>
                <p className="text-[18px] font-bold text-[#3d2b1f]">로그인이 필요합니다</p>
                <p className="text-[13px] text-[#8b6f5c]">주문과 상담을 확인하세요.</p>
                <Link href="/login" className="mt-2 inline-block rounded-full bg-white px-3 py-1.5 text-[12px] text-[#5c3d2e]">
                  로그인하기 &gt;
                </Link>
              </>
            )}
          </div>
          <Link href="/my/orders" className="border-l border-[#d4c8ba] pl-4 text-center">
            <Music className="mx-auto h-5 w-5 text-[#5c3d2e]" />
            <p className="mt-1 text-[11px] text-[#8b6f5c]">나의 인생곡</p>
            <p className="text-[16px] font-bold text-[#3d2b1f]">
              {orders.length}곡 <ChevronRight className="inline h-4 w-4" />
            </p>
          </Link>
        </div>
      </div>

      <section className="px-4 py-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-bold text-[#3d2b1f]">주문 및 제작 현황</h3>
          <Link href="/my/orders" className="text-[13px] text-[#5c3d2e]">
            전체보기 &gt;
          </Link>
        </div>
        <div className="flex items-start justify-between">
          {PROCESS.map((step, i) => {
            const Icon = step.icon;
            const active = step.label === currentStatus;
            return (
              <div key={step.num} className="flex flex-1 items-start">
                <div className="flex flex-1 flex-col items-center text-center">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-full ${
                      active ? "bg-[#5c3d2e] text-white" : "bg-[#f5efe6] text-[#8b6f5c]"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="mt-1.5 text-[11px] font-medium text-[#5c3d2e]">{step.label}</span>
                </div>
                {i < PROCESS.length - 1 ? (
                  <ChevronRight className="mt-3 h-4 w-4 shrink-0 text-[#d4c8ba]" />
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="px-4 pb-4">
        <Link href="/my/orders" className="mb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-bold text-[#3d2b1f]">나의 주문 내역</h3>
          <ChevronRight className="h-5 w-5 text-[#8b6f5c]" />
        </Link>
        <div className="space-y-3">
          {loaded && orders.length === 0 ? (
            <p className="rounded-2xl bg-white p-5 text-center text-[14px] text-[#8b6f5c] ring-1 ring-[#ebe3d8]">
              아직 신청한 주문이 없습니다.
            </p>
          ) : null}
          {orders.slice(0, 3).map((order) => (
            <Link
              key={order.id}
              href={`/my/orders/${order.id}`}
              className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-[#ebe3d8]"
            >
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#f5efe6]">
                <Image src={IMAGES[order.product] ?? "/images/photo-hero.jpg"} alt="" fill className="object-cover" sizes="56px" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold text-[#3d2b1f]">{order.title}</span>
                  <span className="rounded-full bg-[#f5efe6] px-2 py-0.5 text-[11px] font-medium text-[#5c3d2e]">
                    {order.status}
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-[#8b6f5c]">신청일 {formatDate(order.createdAt)}</p>
              </div>
              <span className="text-[12px] text-[#5c3d2e]">상세보기 &gt;</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="px-4 py-4">
        <h3 className="mb-3 text-[17px] font-bold text-[#3d2b1f]">편리한 메뉴</h3>
        <div className="grid grid-cols-3 gap-3">
          {MENU_GRID.map(({ icon: Icon, label, href }) => (
            <Link
              key={label}
              href={href}
              className="flex flex-col items-center rounded-2xl bg-white py-4 ring-1 ring-[#ebe3d8]"
            >
              <Icon className="mb-2 h-6 w-6 text-[#5c3d2e]" />
              <span className="text-[12px] font-medium text-[#3d2b1f]">{label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="px-4 pb-8">
        {(user
          ? [
              { icon: Lock, label: "개인정보 관리", href: "/my/profile" },
              { icon: Bell, label: "알림 설정", href: "/my/notifications" },
              { icon: LogOut, label: "로그아웃", href: "/my/logout" },
            ]
          : [
              { icon: LogIn, label: "로그인", href: "/login" },
              { icon: Bell, label: "알림 설정", href: "/my/notifications" },
            ]
        ).map(({ icon: Icon, label, href }) => (
          <Link
            key={label}
            href={href}
            className="flex w-full items-center justify-between border-b border-[#ebe3d8] py-4 text-[15px] text-[#3d2b1f]"
          >
            <div className="flex items-center gap-3">
              <Icon className="h-5 w-5 text-[#8b6f5c]" />
              {label}
            </div>
            <ChevronRight className="h-5 w-5 text-[#8b6f5c]" />
          </Link>
        ))}
      </section>
    </MobileShell>
  );
}
