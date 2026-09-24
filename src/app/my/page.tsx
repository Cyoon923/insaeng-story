"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronRight,
  Music,
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
  UserMinus,
} from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { fetchMe } from "@/lib/client/api";
import { formatPrice } from "@/lib/constants/products";
import { buildMyOrderItems } from "@/lib/myOrders";
import type { MyOrderItem } from "@/lib/myOrders";
import type {
  Consultation,
  LatestRefundRequestsView,
  Order,
  User,
} from "@/lib/types/app";

const MENU_GRID = [
  // "1:1 사주상담 내역"은 아래 "나의 주문 내역"에 합쳐져서 뺐다.
  // 상담 내역·상세 화면(/my/consultations)은 그대로 두고 거기서 계속 연결된다.
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
  // 1:1 사주상담 화면이 쓰는 이미지를 그대로 쓴다.
  consultation: "/images/photo-hero-saju-analysis.png",
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
  const [items, setItems] = useState<MyOrderItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchMe().then((data) => {
      setUser(data.user ?? null);
      const allOrders = (data.orders ?? []) as Order[];
      // 위 "주문 및 제작 현황"은 인생곡 제작 단계를 보여주는 자리라 그대로 둔다.
      setOrders(allOrders.filter((order) => order.product !== "consultation"));
      // 아래 "나의 주문 내역"만 인생곡과 사주상담을 함께 보여준다.
      setItems(
        buildMyOrderItems(
          allOrders,
          (data.consultations ?? []) as Consultation[],
          // 환불이 끝난 건을 대표 상태로 보여주기 위해 함께 넘긴다(추가 조회 없음).
          data.latestRefundRequests as LatestRefundRequestsView | undefined,
        ),
      );
      setLoaded(true);
    });
  }, []);

  /*
   * "주문 및 제작 현황"은 인생곡 제작 단계를 보여주는 자리다. 이번 단계에서 이 영역의
   * 구조를 다시 설계하지 않는다. 다만 환불이 끝난 주문의 단계를 지금 진행 중인 것처럼
   * 켜 두면 명백히 틀린 안내가 되므로, 환불된 건은 건너뛰고 그다음 주문을 본다.
   * 볼 주문이 하나도 없으면 아무 단계도 켜지 않는다(없는 진행을 지어내지 않는다).
   */
  const refundedIds = new Set(
    items.filter((item) => item.refundCompleted).map((item) => item.id),
  );
  const progressOrder = orders.find((order) => !refundedIds.has(order.id));
  const currentStatus = progressOrder?.status ?? (orders.length > 0 ? "" : "신청접수");
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
          {loaded && items.length === 0 ? (
            <p className="rounded-2xl bg-white p-5 text-center text-[14px] text-[#6B6570] ring-1 ring-[#ebe3d8]">
              아직 신청한 주문이 없습니다.
            </p>
          ) : null}
          {items.slice(0, 3).map((item) => (
            <Link
              key={`${item.kind}-${item.id}`}
              href={item.href}
              className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-[#ebe3d8]"
            >
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#f5efe6]">
                <Image src={IMAGES[item.product] ?? "/images/photo-hero.jpg"} alt="" fill className="object-cover" sizes="56px" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="break-keep text-[15px] font-semibold text-[#403A49]">{item.title}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      item.refundCompleted
                        ? "bg-[#403A49] text-white"
                        : "bg-[#f5efe6] text-[#403A49]"
                    }`}
                  >
                    {item.displayStatus}
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-[#6B6570]">신청일 {formatDate(item.createdAt)}</p>
                {item.kind === "consultation" ? (
                  <p className="mt-0.5 break-keep text-[12px] text-[#6B6570]">
                    {[item.teacher, item.datetime, formatPrice(item.amount)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
              </div>
              <span className="shrink-0 text-[12px] text-[#403A49]">
                {item.kind === "consultation" ? "상담 상세보기" : "상세보기"} &gt;
              </span>
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
              // 계정 메뉴 맨 아래. 실제 안내와 확인은 /my/withdraw 화면에서 한다.
              { icon: UserMinus, label: "회원탈퇴", href: "/my/withdraw" },
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
