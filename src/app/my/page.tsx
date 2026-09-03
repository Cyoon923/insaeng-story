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
  Star,
} from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { fetchMe } from "@/lib/client/api";
import type { Order, User } from "@/lib/types/app";

const MENU_GRID = [
  { icon: Headphones, label: "1:1 사주상담 내역", href: "/my/consultations" },
  { icon: ClipboardList, label: "이벤트 신청", href: "/my/inquiries" },
  { icon: Star, label: "후기", href: "/my/reviews" },
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

function referralCodeFor(user: User): string {
  const raw = user.id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const tail = (raw.slice(-6) || "HOME").padStart(6, "0");
  return `IS${tail}`;
}

export default function MyPage() {
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const currentStatus = orders[0]?.status ?? "신청접수";
  const referralCode = user ? referralCodeFor(user) : "";

  const copyReferralCode = async () => {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralCode);
    } catch {
      const input = document.createElement("textarea");
      input.value = referralCode;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <MobileShell>
      <AppHeader variant="page" title="마이페이지" subtitle="" backHref="/" />

      <div className="mx-4 mt-4 rounded-2xl bg-[#f5efe6] p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#403A49]">
            👤
          </div>
          <div className="min-w-0 flex-1">
            {user ? (
              <>
                <p className="text-[18px] font-bold text-[#403A49]">{user.name || "회원"}님</p>
                <p className="text-[13px] text-[#6B6570]">{user.phone}</p>
                <Link href="/my/profile" className="mt-2 inline-block rounded-full bg-white px-3 py-1.5 text-[12px] text-[#403A49]">
                  회원정보 수정 &gt;
                </Link>
              </>
            ) : (
              <>
                <p className="text-[18px] font-bold text-[#403A49]">로그인이 필요합니다</p>
                <p className="text-[13px] text-[#6B6570]">주문과 상담을 확인하세요.</p>
                <Link href="/login" className="mt-2 inline-block rounded-full bg-white px-3 py-1.5 text-[12px] text-[#403A49]">
                  로그인하기 &gt;
                </Link>
              </>
            )}
          </div>
          <Link href="/my/orders" className="border-l border-[#d4c8ba] pl-4 text-center">
            <Music className="mx-auto h-5 w-5 text-[#403A49]" />
            <p className="mt-1 text-[11px] text-[#6B6570]">나의 인생곡</p>
            <p className="text-[16px] font-bold text-[#403A49]">
              {orders.length}곡 <ChevronRight className="inline h-4 w-4" />
            </p>
          </Link>
        </div>
      </div>

      {user ? (
        <section className="px-4 pt-4">
          <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-[#ebe3d8]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[15px] font-bold text-[#403A49]">추천인 코드</p>
              <p className="text-[15px] font-bold text-[#403A49]">
                적립금 {(user.points ?? 0).toLocaleString("ko-KR")}원
              </p>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <p className="min-w-0 flex-1 text-[16px] font-semibold tracking-wide text-[#403A49]">
                {referralCode}
              </p>
              <button
                type="button"
                onClick={copyReferralCode}
                className="h-9 shrink-0 rounded-lg bg-[#403A49] px-3 text-[13px] font-semibold text-white"
              >
                {copied ? "복사됨" : "복사"}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="px-4 py-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-bold text-[#403A49]">주문 및 제작 현황</h3>
          <Link href="/my/orders" className="text-[13px] text-[#403A49]">
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
                      active ? "bg-[#403A49] text-white" : "bg-[#f5efe6] text-[#6B6570]"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="mt-1.5 text-[11px] font-medium text-[#403A49]">{step.label}</span>
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
          <h3 className="text-[17px] font-bold text-[#403A49]">나의 주문 내역</h3>
          <ChevronRight className="h-5 w-5 text-[#8b6f5c]" />
        </Link>
        <div className="space-y-3">
          {loaded && orders.length === 0 ? (
            <p className="rounded-2xl bg-white p-5 text-center text-[14px] text-[#6B6570] ring-1 ring-[#ebe3d8]">
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
                  <span className="text-[15px] font-semibold text-[#403A49]">{order.title}</span>
                  <span className="rounded-full bg-[#f5efe6] px-2 py-0.5 text-[11px] font-medium text-[#403A49]">
                    {order.status}
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-[#6B6570]">신청일 {formatDate(order.createdAt)}</p>
              </div>
              <span className="text-[12px] text-[#403A49]">상세보기 &gt;</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="px-4 py-4">
        <h3 className="mb-3 text-[17px] font-bold text-[#403A49]">편리한 메뉴</h3>
        <div className="grid grid-cols-3 gap-3">
          {MENU_GRID.map(({ icon: Icon, label, href }) => (
            <Link
              key={label}
              href={href}
              className="flex flex-col items-center rounded-2xl bg-white py-4 ring-1 ring-[#ebe3d8]"
            >
              <Icon className="mb-2 h-6 w-6 text-[#403A49]" />
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
