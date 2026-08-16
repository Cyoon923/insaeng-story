"use client";

import { useCallback, useEffect, useState } from "react";
import { MobileShell } from "@/components/layout/MobileShell";
import type { Consultation, Inquiry, Order, User } from "@/lib/types/app";

type SlotStatus = "available" | "booked" | "blocked";

type TabId = "users" | "orders" | "consultations" | "reviews" | "events" | "inquiries" | "schedule";

type ReviewItem = {
  id: string;
  name: string;
  title: string;
  rating: number;
  text: string;
  createdAt: string;
  visible?: boolean;
};

const TABS: { id: TabId; label: string }[] = [
  { id: "users", label: "회원" },
  { id: "orders", label: "주문" },
  { id: "consultations", label: "상담" },
  { id: "reviews", label: "후기" },
  { id: "events", label: "이벤트" },
  { id: "inquiries", label: "문의" },
  { id: "schedule", label: "일정" },
];

function formatDate(value: string) {
  if (!value) return "-";
  return value.slice(0, 16).replace("T", " ").replaceAll("-", ".");
}

function formatAmount(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function userLabel(user: User) {
  if (user.name) return user.name;
  if (user.phone) return user.phone;
  if (user.email) return user.email;
  return "이름 없음";
}

function contactLabel(user: User) {
  if (user.phone && user.email) return `${user.phone} · ${user.email}`;
  return user.phone || user.email || "-";
}

function referralCodeFor(user: User): string {
  const raw = user.id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const tail = (raw.slice(-6) || "HOME").padStart(6, "0");
  return `IS${tail}`;
}

function isEventInquiry(item: Inquiry) {
  return item.product.startsWith("이벤트");
}

function eventTitle(item: Inquiry) {
  if (item.product.includes("구독")) return "구독 이벤트";
  if (item.product.includes("사연") || item.product.includes("프리미엄 인생곡")) return "사연 신청";
  return "이벤트 신청";
}

function scheduleStatusLabel(status: SlotStatus) {
  if (status === "booked") return "예약됨";
  if (status === "blocked") return "막힘";
  return "가능";
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabId>("users");
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [scheduleDates, setScheduleDates] = useState<string[]>([]);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleSlots, setScheduleSlots] = useState<{ time: string; status: SlotStatus }[]>([]);
  const [teacher, setTeacher] = useState("유비 선생");

  const loadData = useCallback(async () => {
    const res = await fetch("/api/admin", { cache: "no-store" });
    if (res.status === 401) {
      setAuthed(false);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setUsers(data.users ?? []);
    setOrders(data.orders ?? []);
    setConsultations(data.consultations ?? []);
    setReviews((data.reviews ?? []) as ReviewItem[]);
    setInquiries(data.inquiries ?? []);
    const nextDates = (data.dates ?? []) as string[];
    setScheduleDates(nextDates);
    setScheduleDate((current) => current || nextDates[0] || "");
    setTeacher(String(data.teacher ?? "유비 선생"));
    setAuthed(true);
    setLoading(false);
  }, []);

  const loadSchedule = useCallback(
    async (date: string) => {
      if (!date) return;
      const res = await fetch(`/api/consultation/availability?date=${encodeURIComponent(date)}&teacher=${encodeURIComponent(teacher)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      setScheduleSlots((data.slots ?? []) as { time: string; status: SlotStatus }[]);
    },
    [teacher],
  );

  useEffect(() => {
    if (authed && scheduleDate) {
      loadSchedule(scheduleDate);
    }
  }, [authed, scheduleDate, loadSchedule]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "로그인에 실패했습니다.");
      return;
    }
    setPassword("");
    setLoading(true);
    await loadData();
  }

  async function handleLogout() {
    await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    setAuthed(false);
    setUsers([]);
    setOrders([]);
    setConsultations([]);
    setReviews([]);
    setInquiries([]);
  }

  async function handleToggleSlot(time: string) {
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "toggleBlockSlot",
        teacher,
        date: scheduleDate,
        time,
      }),
    });
    const data = await res.json();
    if (!res.ok) return;
    setScheduleSlots((data.slots ?? []) as { time: string; status: SlotStatus }[]);
  }

  const userMap = new Map(users.map((user) => [user.id, user]));

  if (loading) {
    return (
      <MobileShell>
        <div className="flex min-h-[60vh] items-center justify-center px-4 text-[15px] text-[#8b6f5c]">
          불러오는 중...
        </div>
      </MobileShell>
    );
  }

  if (!authed) {
    return (
      <MobileShell>
        <div className="px-4 py-8">
          <h1 className="font-serif text-[26px] font-bold text-[#3d2b1f]">관리자</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-[#8b6f5c]">
            회원, 주문, 상담, 후기, 이벤트, 문의 현황을 확인합니다.
          </p>
          <form onSubmit={handleLogin} className="mt-8 space-y-4">
            <div>
              <label htmlFor="admin-password" className="mb-2 block text-[14px] font-semibold text-[#3d2b1f]">
                관리자 비밀번호
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 w-full rounded-xl border border-[#d4c8ba] bg-white px-4 text-[16px] text-[#3d2b1f] outline-none focus:border-[#5c3d2e]"
                placeholder="비밀번호 입력"
                autoComplete="current-password"
              />
            </div>
            {error ? <p className="text-[14px] text-[#b42318]">{error}</p> : null}
            <button
              type="submit"
              className="flex h-12 w-full items-center justify-center rounded-xl bg-[#5c3d2e] text-[15px] font-semibold text-white"
            >
              로그인
            </button>
          </form>
        </div>
      </MobileShell>
    );
  }

  const eventItems = inquiries.filter(isEventInquiry);
  const inquiryItems = inquiries.filter((item) => !isEventInquiry(item));
  const counts: Record<Exclude<TabId, "schedule">, number> = {
    users: users.length,
    orders: orders.length,
    consultations: consultations.length,
    reviews: reviews.length,
    events: eventItems.length,
    inquiries: inquiryItems.length,
  };

  return (
    <MobileShell>
      <header className="sticky top-0 z-40 border-b border-[#ebe3d8] bg-[#fffdf9]/95 px-4 py-4 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[18px] font-bold text-[#3d2b1f]">관리자</h1>
            <p className="text-[12px] text-[#8b6f5c]">인생스토리 운영 현황</p>
            <p className="mt-1 text-[12px] font-semibold text-[#5c3d2e]">관리자 코드 INSAENG30 · 30% 할인</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="h-10 rounded-full border border-[#d4c8ba] px-4 text-[13px] font-medium text-[#5c3d2e]"
          >
            로그아웃
          </button>
        </div>
        <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`h-10 shrink-0 rounded-full px-4 text-[13px] font-semibold ${
                  active ? "bg-[#5c3d2e] text-white" : "border border-[#d4c8ba] bg-white text-[#5c3d2e]"
                }`}
              >
                {item.id === "schedule" ? item.label : `${item.label} ${counts[item.id as Exclude<TabId, "schedule">] ?? ""}`}
              </button>
            );
          })}
        </div>
      </header>

      <div className="space-y-3 px-4 py-5">
        {tab === "users"
          ? users.map((user) => (
              <article key={user.id} className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
                <p className="text-[16px] font-bold text-[#3d2b1f]">{userLabel(user)}</p>
                <p className="mt-1 text-[14px] text-[#5c3d2e]">{contactLabel(user)}</p>
                <p className="mt-2 text-[13px] text-[#8b6f5c]">추천인 코드 {referralCodeFor(user)}</p>
                <p className="mt-1 text-[13px] text-[#8b6f5c]">가입일 {formatDate(user.createdAt)}</p>
              </article>
            ))
          : null}

        {tab === "orders"
          ? orders.map((order) => {
              const member = userMap.get(order.userId);
              return (
                <article key={order.id} className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[16px] font-bold text-[#3d2b1f]">{order.title}</p>
                    <span className="shrink-0 rounded-full bg-[#f5efe6] px-3 py-1 text-[12px] font-semibold text-[#5c3d2e]">
                      {order.status}
                    </span>
                  </div>
                  <p className="mt-2 text-[14px] text-[#5c3d2e]">
                    {member ? userLabel(member) : "회원 정보 없음"} · {formatAmount(order.amount)}
                  </p>
                  <p className="mt-1 text-[13px] text-[#8b6f5c]">
                    {order.payment} · {formatDate(order.createdAt)}
                  </p>
                </article>
              );
            })
          : null}

        {tab === "consultations"
          ? consultations.map((item) => {
              const member = userMap.get(item.userId);
              return (
                <article key={item.id} className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[16px] font-bold text-[#3d2b1f]">{item.teacher}</p>
                    <span className="shrink-0 rounded-full bg-[#f5efe6] px-3 py-1 text-[12px] font-semibold text-[#5c3d2e]">
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-2 text-[14px] text-[#5c3d2e]">
                    {member ? userLabel(member) : "회원 정보 없음"} · {formatAmount(item.amount)}
                  </p>
                  <p className="mt-1 text-[13px] text-[#8b6f5c]">
                    {item.datetime} · {item.method}
                  </p>
                  <p className="mt-1 text-[13px] text-[#8b6f5c]">{item.purpose}</p>
                </article>
              );
            })
          : null}

        {tab === "reviews"
          ? reviews.map((item) => (
              <article key={item.id} className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[16px] font-bold text-[#3d2b1f]">{item.title || "후기"}</p>
                  <span className="shrink-0 rounded-full bg-[#f5efe6] px-3 py-1 text-[12px] font-semibold text-[#5c3d2e]">
                    {item.visible ? "공개" : "대기"}
                  </span>
                </div>
                <p className="mt-2 text-[14px] text-[#5c3d2e]">
                  {item.name || "이름 없음"} · 별점 {item.rating}점
                </p>
                {item.text ? (
                  <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-[#8b6f5c]">{item.text}</p>
                ) : null}
                <p className="mt-2 text-[13px] text-[#8b6f5c]">{formatDate(item.createdAt)}</p>
              </article>
            ))
          : null}

        {tab === "events"
          ? eventItems.map((item) => {
              const member = userMap.get(item.userId);
              return (
                <article key={item.id} className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[16px] font-bold text-[#3d2b1f]">{eventTitle(item)}</p>
                    <span className="shrink-0 rounded-full bg-[#f5efe6] px-3 py-1 text-[12px] font-semibold text-[#5c3d2e]">
                      신청접수
                    </span>
                  </div>
                  <p className="mt-2 text-[14px] text-[#5c3d2e]">
                    {item.name || member?.name || "이름 없음"} · {item.phone || member?.phone || "-"}
                  </p>
                  <p className="mt-1 text-[13px] text-[#8b6f5c]">{item.method}</p>
                  <p className="mt-2 text-[14px] leading-relaxed text-[#5c3d2e]">{item.product}</p>
                  {item.message ? (
                    <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-[#8b6f5c]">{item.message}</p>
                  ) : null}
                  <p className="mt-2 text-[13px] text-[#8b6f5c]">{formatDate(item.createdAt)}</p>
                </article>
              );
            })
          : null}

        {tab === "inquiries"
          ? inquiryItems.map((item) => {
              const member = userMap.get(item.userId);
              return (
                <article key={item.id} className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
                  <p className="text-[16px] font-bold text-[#3d2b1f]">{item.name || member?.name || "이름 없음"}</p>
                  <p className="mt-1 text-[14px] text-[#5c3d2e]">
                    {item.phone || member?.phone || "-"} · {item.method}
                  </p>
                  <p className="mt-2 text-[14px] leading-relaxed text-[#5c3d2e]">{item.message}</p>
                  <p className="mt-2 text-[13px] text-[#8b6f5c]">
                    {item.product} · {formatDate(item.createdAt)}
                  </p>
                </article>
              );
            })
          : null}

        {tab === "schedule" ? (
          <>
            <p className="text-[15px] font-bold text-[#3d2b1f]">{teacher} 상담 일정</p>
            <p className="mt-1 text-[13px] text-[#8b6f5c]">
              예약된 시간은 자동으로 막힙니다. 선생님 개인 일정은 아래에서 막거나 열 수 있습니다.
            </p>
            <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
              {scheduleDates.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setScheduleDate(item)}
                  className={`h-11 shrink-0 rounded-xl px-3 text-[13px] font-semibold ${
                    scheduleDate === item ? "bg-[#5c3d2e] text-white" : "bg-[#f5efe6] text-[#3d2b1f]"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {scheduleSlots.map((item) => (
                <div
                  key={item.time}
                  className="flex items-center justify-between rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]"
                >
                  <div>
                    <p className="text-[15px] font-bold text-[#3d2b1f]">{item.time}</p>
                    <p className="mt-1 text-[13px] text-[#8b6f5c]">{scheduleStatusLabel(item.status)}</p>
                  </div>
                  {item.status === "booked" ? (
                    <span className="text-[13px] text-[#8b6f5c]">변경 불가</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleToggleSlot(item.time)}
                      className={`h-10 rounded-full px-4 text-[13px] font-semibold ${
                        item.status === "blocked"
                          ? "border border-[#d4c8ba] bg-white text-[#5c3d2e]"
                          : "bg-[#5c3d2e] text-white"
                      }`}
                    >
                      {item.status === "blocked" ? "열기" : "막기"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : null}

        {counts[tab as Exclude<TabId, "schedule">] === 0 && tab !== "schedule" ? (
          <div className="rounded-2xl bg-[#f5efe6] px-4 py-10 text-center text-[15px] text-[#8b6f5c]">
            아직 등록된 내역이 없습니다.
          </div>
        ) : null}
      </div>
    </MobileShell>
  );
}
