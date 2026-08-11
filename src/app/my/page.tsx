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
  LogOut,
  ClipboardList,
  MessageCircle,
  Pencil,
  CheckCircle,
} from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";

const ORDERS = [
  {
    title: "인생곡",
    status: "제작중",
    statusColor: "bg-beige text-brown",
    date: "2024.05.20",
    image: "https://images.unsplash.com/photo-1455396577869-51adff057779?w=80&h=80&fit=crop",
  },
  {
    title: "사주 인생곡",
    status: "상담완료",
    statusColor: "bg-green-100 text-green-700",
    date: "2024.05.18",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop",
  },
];

const MENU_GRID = [
  { icon: Headphones, label: "1:1 상담 내역" },
  { icon: Heart, label: "찜한 상품" },
  { icon: Ticket, label: "쿠폰함" },
  { icon: Megaphone, label: "공지사항" },
  { icon: HelpCircle, label: "자주 묻는 질문" },
  { icon: BookOpen, label: "이용 안내" },
];

const PROCESS = [
  { num: "01", label: "신청접수", icon: ClipboardList, active: true },
  { num: "02", label: "상담진행", icon: MessageCircle },
  { num: "03", label: "제작중", icon: Pencil },
  { num: "04", label: "완성/전달", icon: Music },
  { num: "05", label: "완료", icon: CheckCircle },
];

export default function MyPage() {
  return (
    <MobileShell>
      <AppHeader variant="page" title="마이페이지" subtitle="" backHref="/" />

      {/* Profile */}
      <div className="mx-4 mt-4 rounded-2xl bg-ivory p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-beige text-brown">
            👤
          </div>
          <div>
            <p className="text-lg font-bold text-brown-dark">홍길동님</p>
            <p className="text-sm text-brown-light">반갑습니다!</p>
            <button type="button" className="mt-2 rounded-full bg-white px-3 py-1 text-xs text-brown">
              회원정보 수정 &gt;
            </button>
          </div>
          <div className="ml-auto border-l border-border pl-4 text-center">
            <Music className="mx-auto h-5 w-5 text-brown" />
            <p className="mt-1 text-xs text-brown-light">나의 인생곡</p>
            <p className="text-lg font-bold text-brown-dark">
              2곡 <ChevronRight className="inline h-4 w-4" />
            </p>
          </div>
        </div>
      </div>

      {/* Process */}
      <section className="px-4 py-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold text-brown-dark">주문 및 제작 현황</h3>
          <button type="button" className="text-xs text-brown">
            전체보기 &gt;
          </button>
        </div>
        <div className="no-scrollbar flex items-center gap-1 overflow-x-auto">
          {PROCESS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.num} className="flex shrink-0 items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      step.active ? "bg-brown text-white" : "bg-ivory text-brown-light"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="mt-1 text-[9px] text-brown-light">{step.label}</span>
                </div>
                {i < PROCESS.length - 1 && <ChevronRight className="mx-1 h-3 w-3 text-border" />}
              </div>
            );
          })}
        </div>
      </section>

      {/* Orders */}
      <section className="px-4 pb-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold text-brown-dark">나의 주문 내역</h3>
          <ChevronRight className="h-4 w-4 text-brown-light" />
        </div>
        <div className="space-y-3">
          {ORDERS.map((order) => (
            <div key={order.title} className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-border">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                <Image src={order.image} alt="" fill className="object-cover" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-brown-dark">{order.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${order.statusColor}`}>
                    {order.status}
                  </span>
                </div>
                <p className="text-xs text-brown-light">신청일 {order.date}</p>
              </div>
              <button type="button" className="text-xs text-brown">
                상세보기 &gt;
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Menu grid */}
      <section className="px-4 py-4">
        <h3 className="mb-3 font-bold text-brown-dark">편리한 메뉴</h3>
        <div className="grid grid-cols-3 gap-3">
          {MENU_GRID.map(({ icon: Icon, label }) => (
            <button
              key={label}
              type="button"
              className="flex flex-col items-center rounded-2xl bg-white py-4 ring-1 ring-border"
            >
              <Icon className="mb-2 h-5 w-5 text-brown" />
              <span className="text-xs text-brown-dark">{label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Service info */}
      <section className="px-4 pb-6">
        {[
          { icon: Lock, label: "개인정보 관리" },
          { icon: Bell, label: "알림 설정" },
          { icon: LogOut, label: "로그아웃" },
        ].map(({ icon: Icon, label }) => (
          <button
            key={label}
            type="button"
            className="flex w-full items-center justify-between border-b border-border py-4 text-sm text-brown-dark"
          >
            <div className="flex items-center gap-3">
              <Icon className="h-4 w-4 text-brown-light" />
              {label}
            </div>
            <ChevronRight className="h-4 w-4 text-brown-light" />
          </button>
        ))}
      </section>
    </MobileShell>
  );
}
