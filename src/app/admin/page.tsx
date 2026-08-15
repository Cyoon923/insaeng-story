"use client";

import { useCallback, useEffect, useState } from "react";
import { MobileShell } from "@/components/layout/MobileShell";
import type { Consultation, Inquiry, Order, User } from "@/lib/types/app";

type TabId = "users" | "orders" | "consultations" | "inquiries";

const TABS: { id: TabId; label: string }[] = [
  { id: "users", label: "회원" },
  { id: "orders", label: "주문" },
  { id: "consultations", label: "상담" },
  { id: "inquiries", label: "문의" },
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

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabId>("users");
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);

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
    setInquiries(data.inquiries ?? []);
    setAuthed(true);
    setLoading(false);
  }, []);

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
    setInquiries([]);
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
            회원, 주문, 상담, 문의 현황을 확인합니다.
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

  const counts: Record<TabId, number> = {
    users: users.length,
    orders: orders.length,
    consultations: consultations.length,
    inquiries: inquiries.length,
  };

  return (
    <MobileShell>
      <header className="sticky top-0 z-40 border-b border-[#ebe3d8] bg-[#fffdf9]/95 px-4 py-4 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[18px] font-bold text-[#3d2b1f]">관리자</h1>
            <p className="text-[12px] text-[#8b6f5c]">인생스토리 운영 현황</p>
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
                {item.label} {counts[item.id]}
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
                <p className="mt-2 text-[13px] text-[#8b6f5c]">가입일 {formatDate(user.createdAt)}</p>
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

        {tab === "inquiries"
          ? inquiries.map((item) => {
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

        {counts[tab] === 0 ? (
          <div className="rounded-2xl bg-[#f5efe6] px-4 py-10 text-center text-[15px] text-[#8b6f5c]">
            아직 등록된 내역이 없습니다.
          </div>
        ) : null}
      </div>
    </MobileShell>
  );
}
