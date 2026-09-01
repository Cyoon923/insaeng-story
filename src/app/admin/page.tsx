"use client";

import { useCallback, useEffect, useState } from "react";
import { MobileShell } from "@/components/layout/MobileShell";
import type {
  AdminPromo,
  Consultation,
  ConsultStatus,
  Coupon,
  CouponProduct,
  Inquiry,
  Order,
  OrderStatus,
  User,
} from "@/lib/types/app";

type SlotStatus = "available" | "booked" | "blocked";

type TabId = "users" | "points" | "coupons" | "codes" | "orders" | "consultations" | "reviews" | "events" | "inquiries" | "schedule";

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
  { id: "consultations", label: "사주상담" },
  { id: "reviews", label: "후기" },
  { id: "events", label: "이벤트" },
  { id: "inquiries", label: "문의" },
  { id: "schedule", label: "일정" },
  { id: "points", label: "적립금" },
  { id: "coupons", label: "쿠폰" },
  { id: "codes", label: "코드" },
];

const ORDER_STATUSES: OrderStatus[] = ["신청접수", "상담진행", "제작중", "완성/전달", "완료"];
const CONSULT_STATUSES: ConsultStatus[] = ["상담 신청", "사주정보 입력", "선생님과 1:1 상담", "상담 완료"];

const FREE_COUPON_PRODUCTS: { id: CouponProduct; label: string }[] = [
  { id: "story", label: "이야기로 만드는 인생곡" },
  { id: "premium", label: "프리미엄 인생곡" },
  { id: "saju-song", label: "사주 인생곡" },
  { id: "consultation", label: "1:1 사주상담" },
];

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function parseConsultDate(value: string) {
  const match = value.match(/^(\d+)월 (\d+)일\((.+)\)$/);
  if (!match) return null;
  return { month: Number(match[1]), day: Number(match[2]), weekday: match[3] };
}

function buildCalendarCells(dates: string[]) {
  if (!dates.length) return [] as ({ empty: true } | { empty: false; date: string; day: number })[];

  const first = parseConsultDate(dates[0]);
  const offset = first ? WEEKDAYS.indexOf(first.weekday) : 0;
  const cells: ({ empty: true } | { empty: false; date: string; day: number })[] = [];

  for (let i = 0; i < offset; i++) cells.push({ empty: true });
  for (const date of dates) {
    const parsed = parseConsultDate(date);
    cells.push({ empty: false, date, day: parsed?.day ?? 0 });
  }
  while (cells.length % 7 !== 0) cells.push({ empty: true });

  return cells;
}

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

function findUsersByName(users: User[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return users.filter((user) => user.name.trim().toLowerCase().includes(q));
}

function adminCodeUses(orders: Order[], consultations: Consultation[]) {
  const fromOrders = orders
    .filter((item) => item.details.referralType === "admin")
    .map((item) => ({
      id: `order-${item.id}`,
      userId: item.userId,
      title: item.title,
      code: item.details.referralCode ?? "",
      percent: item.details.referralPercent ?? "",
      discount: item.details.referralDiscount ?? "",
      createdAt: item.createdAt,
    }));
  const fromConsults = consultations
    .filter((item) => item.details.referralType === "admin")
    .map((item) => ({
      id: `consult-${item.id}`,
      userId: item.userId,
      title: "1:1 사주상담",
      code: item.details.referralCode ?? "",
      percent: item.details.referralPercent ?? "",
      discount: item.details.referralDiscount ?? "",
      createdAt: item.createdAt,
    }));
  return [...fromOrders, ...fromConsults].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const input = document.createElement("textarea");
    input.value = value;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    document.body.removeChild(input);
  }
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
  const [adminPromo, setAdminPromo] = useState<AdminPromo | null>(null);
  const [promoPercent, setPromoPercent] = useState(20);
  const [promoCopied, setPromoCopied] = useState(false);
  const [pointInputs, setPointInputs] = useState<Record<string, string>>({});
  const [userCoupons, setUserCoupons] = useState<Record<string, Coupon[]>>({});
  const [couponName, setCouponName] = useState("");
  const [couponMatches, setCouponMatches] = useState<User[]>([]);
  const [couponTarget, setCouponTarget] = useState<User | null>(null);
  const [couponProduct, setCouponProduct] = useState<CouponProduct | "">("");
  const [couponSearched, setCouponSearched] = useState(false);
  const [couponNotifyDone, setCouponNotifyDone] = useState(false);
  const [codeNotifyName, setCodeNotifyName] = useState("");
  const [codeNotifyMatches, setCodeNotifyMatches] = useState<User[]>([]);
  const [codeNotifyTarget, setCodeNotifyTarget] = useState<User | null>(null);
  const [codeNotifySearched, setCodeNotifySearched] = useState(false);
  const [codeNotifyDone, setCodeNotifyDone] = useState(false);

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
    setAdminPromo((data.adminPromo ?? null) as AdminPromo | null);
    setUserCoupons((data.coupons ?? {}) as Record<string, Coupon[]>);
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
    setAdminPromo(null);
    setUserCoupons({});
    setCouponName("");
    setCouponMatches([]);
    setCouponTarget(null);
    setCouponProduct("");
    setCouponSearched(false);
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

  async function handleGeneratePromo() {
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generateAdminPromo", percent: promoPercent }),
    });
    const data = await res.json();
    if (!res.ok) return;
    const next = (data.adminPromo ?? null) as AdminPromo | null;
    setAdminPromo(next);
    if (next?.code) {
      await copyText(next.code);
      setPromoCopied(true);
      window.setTimeout(() => setPromoCopied(false), 2000);
    }
  }

  async function copyAdminPromo() {
    if (!adminPromo?.code) return;
    await copyText(adminPromo.code);
    setPromoCopied(true);
    window.setTimeout(() => setPromoCopied(false), 2000);
  }

  async function handleAdjustPoints(userId: string, direction: "add" | "subtract") {
    const amount = Math.floor(Number(pointInputs[userId] ?? ""));
    if (!Number.isFinite(amount) || amount < 1) return;
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "adjustPoints", userId, amount, direction }),
    });
    const data = await res.json();
    if (!res.ok) return;
    const nextUser = data.user as User;
    setUsers((current) => current.map((item) => (item.id === nextUser.id ? nextUser : item)));
    setPointInputs((current) => ({ ...current, [userId]: "" }));
  }

  function handleFindCouponUser() {
    const matches = findUsersByName(users, couponName);
    setCouponSearched(true);
    setCouponMatches(matches);
    setCouponTarget(matches.length === 1 ? matches[0] : null);
    setCouponProduct("");
    setCouponNotifyDone(false);
  }

  async function handleGiveCoupon() {
    if (!couponTarget || !couponProduct) return;
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "giveCoupon", userId: couponTarget.id, product: couponProduct }),
    });
    const data = await res.json();
    if (!res.ok) return;
    setUserCoupons((current) => ({ ...current, [couponTarget.id]: (data.coupons ?? []) as Coupon[] }));
    setCouponNotifyDone(true);
  }

  function handleFindCodeUser() {
    const matches = findUsersByName(users, codeNotifyName);
    setCodeNotifySearched(true);
    setCodeNotifyMatches(matches);
    setCodeNotifyTarget(matches.length === 1 ? matches[0] : null);
    setCodeNotifyDone(false);
  }

  async function handleNotifyPromo() {
    if (!codeNotifyTarget) return;
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "notifyPromoCode", userId: codeNotifyTarget.id }),
    });
    if (!res.ok) return;
    setCodeNotifyDone(true);
  }

  async function handleUpdateOrderStatus(id: string, status: OrderStatus) {
    const current = orders.find((item) => item.id === id);
    if (!current || current.status === status) return;
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "updateOrderStatus", id, status }),
    });
    const data = await res.json();
    if (!res.ok) return;
    const next = data.order as Order;
    setOrders((list) => list.map((item) => (item.id === next.id ? next : item)));
  }

  async function handleUpdateConsultationStatus(id: string, status: ConsultStatus) {
    const current = consultations.find((item) => item.id === id);
    if (!current || current.status === status) return;
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "updateConsultationStatus", id, status }),
    });
    const data = await res.json();
    if (!res.ok) return;
    const next = data.consultation as Consultation;
    setConsultations((list) => list.map((item) => (item.id === next.id ? next : item)));
  }

  async function handleToggleReviewVisible(id: string, visible: boolean) {
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggleReviewVisible", id, visible }),
    });
    const data = await res.json();
    if (!res.ok) return;
    const next = data.review as ReviewItem;
    setReviews((list) => list.map((item) => (item.id === next.id ? { ...item, visible: next.visible } : item)));
  }

  const userMap = new Map(users.map((user) => [user.id, user]));

  if (loading) {
    return (
      <MobileShell>
        <div className="flex min-h-[60vh] items-center justify-center px-4 text-[15px] text-[#6B6570]">
          불러오는 중...
        </div>
      </MobileShell>
    );
  }

  if (!authed) {
    return (
      <MobileShell>
        <div className="px-4 py-8">
          <h1 className="font-serif text-[26px] font-bold text-[#403A49]">관리자</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-[#6B6570]">
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
              className="flex h-12 w-full items-center justify-center rounded-xl bg-[#403A49] text-[15px] font-semibold text-white"
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
  const codeUses = adminCodeUses(orders, consultations);
  const currentCodeUses = codeUses.filter((item) => item.code === adminPromo?.code);
  const counts: Record<Exclude<TabId, "schedule">, number> = {
    users: users.length,
    points: users.length,
    coupons: users.length,
    codes: codeUses.length,
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
            <h1 className="text-[18px] font-bold text-[#403A49]">관리자</h1>
            <p className="text-[12px] text-[#6B6570]">사주로그 운영 현황</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="h-10 rounded-full border border-[#403A49] px-4 text-[13px] font-semibold text-[#403A49]"
          >
            로그아웃
          </button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`h-11 rounded-xl px-2 text-[13px] font-semibold ${
                  active ? "bg-[#5c3d2e] text-white" : "border border-[#d4c8ba] bg-white text-[#5c3d2e]"
                }`}
              >
                {item.id === "schedule" || item.id === "coupons" ? item.label : `${item.label} ${counts[item.id as Exclude<TabId, "schedule">] ?? ""}`}
              </button>
            );
          })}
        </div>
      </header>

      <div className="space-y-3 px-4 py-5">
        {tab === "users"
          ? users.map((user) => (
              <article key={user.id} className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
                <p className="text-[16px] font-bold text-[#403A49]">{userLabel(user)}</p>
                <p className="mt-1 text-[14px] text-[#5c3d2e]">{contactLabel(user)}</p>
                <p className="mt-2 text-[13px] text-[#6B6570]">추천인 코드 {referralCodeFor(user)}</p>
                <p className="mt-1 text-[13px] text-[#6B6570]">가입일 {formatDate(user.createdAt)}</p>
              </article>
            ))
          : null}

        {tab === "points"
          ? users.map((user) => {
              const amount = Math.floor(Number(pointInputs[user.id] ?? ""));
              const canAdjust = Number.isFinite(amount) && amount >= 1;
              return (
                <article key={user.id} className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
                  <p className="text-[16px] font-bold text-[#403A49]">{userLabel(user)}</p>
                  <p className="mt-1 text-[14px] text-[#5c3d2e]">{contactLabel(user)}</p>
                  <p className="mt-2 text-[15px] font-semibold text-[#403A49]">
                    적립금 {(user.points ?? 0).toLocaleString("ko-KR")}원
                  </p>
                  <label htmlFor={`points-${user.id}`} className="mt-3 block text-[13px] font-semibold text-[#6B6570]">
                    금액
                  </label>
                  <input
                    id={`points-${user.id}`}
                    type="number"
                    min={1}
                    value={pointInputs[user.id] ?? ""}
                    onChange={(event) =>
                      setPointInputs((current) => ({ ...current, [user.id]: event.target.value }))
                    }
                    className="mt-2 h-12 w-full rounded-xl border border-[#d4c8ba] bg-white px-4 text-[16px] text-[#3d2b1f] outline-none focus:border-[#5c3d2e]"
                    placeholder="10000"
                  />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleAdjustPoints(user.id, "add")}
                      disabled={!canAdjust}
                      className="h-12 rounded-xl bg-[#403A49] text-[15px] font-semibold text-white disabled:opacity-40"
                    >
                      지급
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdjustPoints(user.id, "subtract")}
                      disabled={!canAdjust}
                      className="h-12 rounded-xl border border-[#403A49] bg-[#fffdf9] text-[15px] font-semibold text-[#403A49] disabled:opacity-40"
                    >
                      차감
                    </button>
                  </div>
                </article>
              );
            })
          : null}

        {tab === "coupons" ? (
          <>
            <article className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
              <label htmlFor="coupon-name" className="block text-[15px] font-bold text-[#403A49]">
                회원 이름
              </label>
              <p className="mt-1 text-[13px] leading-relaxed text-[#6B6570]">
                쿠폰을 줄 회원 이름을 적고 찾아 주세요.
              </p>
              <input
                id="coupon-name"
                type="text"
                value={couponName}
                onChange={(event) => setCouponName(event.target.value)}
                className="mt-3 h-12 w-full rounded-xl border border-[#d4c8ba] bg-white px-4 text-[16px] text-[#3d2b1f] outline-none focus:border-[#5c3d2e]"
                placeholder="예: 김민수"
              />
              <button
                type="button"
                onClick={handleFindCouponUser}
                className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-[#403A49] text-[15px] font-semibold text-white"
              >
                회원 찾기
              </button>
            </article>

            {couponSearched && couponMatches.length === 0 ? (
              <p className="rounded-2xl bg-[#f5efe6] px-4 py-8 text-center text-[15px] text-[#8b6f5c]">
                그 이름의 회원을 찾을 수 없습니다.
              </p>
            ) : null}

            {couponMatches.length > 1 && !couponTarget
              ? couponMatches.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setCouponTarget(user)}
                    className="w-full rounded-2xl bg-white p-4 text-left ring-1 ring-[#ebe3d8]"
                  >
                    <p className="text-[16px] font-bold text-[#403A49]">{userLabel(user)}</p>
                    <p className="mt-1 text-[14px] text-[#5c3d2e]">{contactLabel(user)}</p>
                  </button>
                ))
              : null}

            {couponTarget ? (
              <article className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
                <p className="text-[16px] font-bold text-[#403A49]">{userLabel(couponTarget)}</p>
                <p className="mt-1 text-[14px] text-[#5c3d2e]">{contactLabel(couponTarget)}</p>
                {(userCoupons[couponTarget.id] ?? []).length === 0 ? (
                  <p className="mt-2 text-[14px] text-[#6B6570]">보유 쿠폰 없음</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {(userCoupons[couponTarget.id] ?? []).map((coupon) => (
                      <div key={coupon.id} className="rounded-xl bg-[#f5efe6] px-3 py-2">
                        <p className="text-[14px] font-semibold text-[#3d2b1f]">{coupon.title}</p>
                        <p className="mt-1 text-[13px] text-[#6B6570]">{coupon.usedAt ? "사용함" : "사용 전"}</p>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-[13px] font-semibold text-[#6B6570]">무료로 줄 상품</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {FREE_COUPON_PRODUCTS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setCouponProduct(item.id)}
                      className={`min-h-12 rounded-xl px-2 text-[13px] font-semibold ${
                        couponProduct === item.id
                          ? "bg-[#5c3d2e] text-white"
                          : "border border-[#d4c8ba] bg-white text-[#5c3d2e]"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleGiveCoupon}
                  disabled={!couponProduct}
                  className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-[#403A49] text-[15px] font-semibold text-white disabled:opacity-40"
                >
                  무료 쿠폰 지급
                </button>
                {couponNotifyDone ? (
                  <p className="mt-2 text-[14px] font-semibold text-[#5c3d2e]">쿠폰을 주고 회원에게 알림을 보냈습니다.</p>
                ) : null}
              </article>
            ) : null}
          </>
        ) : null}

        {tab === "codes" ? (
          <>
            <article className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
              <p className="text-[13px] font-semibold text-[#6B6570]">관리자 전용 코드</p>
              {adminPromo ? (
                <>
                  <div className="mt-2 flex items-center gap-2">
                    <p className="min-w-0 flex-1 text-[22px] font-bold tracking-wide text-[#403A49]">{adminPromo.code}</p>
                    <button
                      type="button"
                      onClick={copyAdminPromo}
                      className="h-10 shrink-0 rounded-lg bg-[#403A49] px-4 text-[14px] font-semibold text-white"
                    >
                      {promoCopied ? "복사됨" : "복사"}
                    </button>
                  </div>
                  <p className="mt-2 text-[14px] leading-relaxed text-[#5c3d2e]">
                    결제할 때 이 코드를 넣으면 {adminPromo.percent}% 할인됩니다. 새 코드를 만들면 이전 코드는 사용할 수 없습니다.
                  </p>
                  <p className="mt-2 text-[14px] font-semibold text-[#3d2b1f]">
                    {currentCodeUses.length === 0
                      ? "아직 사용한 사람이 없습니다."
                      : `지금 코드를 ${currentCodeUses.length}명이 사용했습니다.`}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-[14px] leading-relaxed text-[#6B6570]">
                  아직 코드가 없습니다. 아래에서 만들어 주세요.
                </p>
              )}
              <label htmlFor="promo-percent" className="mt-3 block text-[13px] font-semibold text-[#6B6570]">
                할인율
              </label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  id="promo-percent"
                  type="number"
                  min={10}
                  max={90}
                  step={10}
                  value={promoPercent}
                  onChange={(event) => setPromoPercent(Number(event.target.value))}
                  className="h-12 w-full rounded-xl border border-[#d4c8ba] bg-white px-4 text-[16px] text-[#3d2b1f] outline-none focus:border-[#5c3d2e]"
                />
                <span className="shrink-0 text-[16px] font-semibold text-[#403A49]">%</span>
              </div>
              <button
                type="button"
                onClick={handleGeneratePromo}
                disabled={!Number.isFinite(promoPercent) || promoPercent < 1 || promoPercent > 90}
                className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-[#403A49] text-[15px] font-semibold text-white disabled:opacity-40"
              >
                {promoPercent}% 코드 만들기
              </button>
            </article>

            {adminPromo ? (
              <article className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
                <p className="text-[15px] font-bold text-[#403A49]">회원에게 알리기</p>
                <p className="mt-1 text-[13px] leading-relaxed text-[#6B6570]">
                  코드를 받은 회원 이름을 적으면, 그 회원 화면에 알림이 뜹니다.
                </p>
                <label htmlFor="code-notify-name" className="mt-3 block text-[13px] font-semibold text-[#6B6570]">
                  회원 이름
                </label>
                <input
                  id="code-notify-name"
                  type="text"
                  value={codeNotifyName}
                  onChange={(event) => setCodeNotifyName(event.target.value)}
                  className="mt-2 h-12 w-full rounded-xl border border-[#d4c8ba] bg-white px-4 text-[16px] text-[#3d2b1f] outline-none focus:border-[#5c3d2e]"
                  placeholder="예: 김민수"
                />
                <button
                  type="button"
                  onClick={handleFindCodeUser}
                  className="mt-3 flex h-12 w-full items-center justify-center rounded-xl border border-[#403A49] bg-[#fffdf9] text-[15px] font-semibold text-[#403A49]"
                >
                  회원 찾기
                </button>
                {codeNotifySearched && codeNotifyMatches.length === 0 ? (
                  <p className="mt-3 text-[14px] text-[#6B6570]">그 이름의 회원을 찾을 수 없습니다.</p>
                ) : null}
                {codeNotifyMatches.length > 1 && !codeNotifyTarget
                  ? codeNotifyMatches.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => setCodeNotifyTarget(user)}
                        className="mt-2 w-full rounded-xl bg-[#f5efe6] px-4 py-3 text-left"
                      >
                        <p className="text-[15px] font-bold text-[#403A49]">{userLabel(user)}</p>
                        <p className="mt-1 text-[13px] text-[#5c3d2e]">{contactLabel(user)}</p>
                      </button>
                    ))
                  : null}
                {codeNotifyTarget ? (
                  <>
                    <p className="mt-3 text-[15px] font-semibold text-[#403A49]">
                      {userLabel(codeNotifyTarget)} · {contactLabel(codeNotifyTarget)}
                    </p>
                    <button
                      type="button"
                      onClick={handleNotifyPromo}
                      className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-[#403A49] text-[15px] font-semibold text-white"
                    >
                      이 코드 알리기
                    </button>
                    {codeNotifyDone ? (
                      <p className="mt-2 text-[14px] font-semibold text-[#5c3d2e]">회원에게 알림을 보냈습니다.</p>
                    ) : null}
                  </>
                ) : null}
              </article>
            ) : null}

            <p className="pt-2 text-[15px] font-bold text-[#403A49]">사용 내역</p>
            {codeUses.length === 0 ? (
              <p className="rounded-2xl bg-[#f5efe6] px-4 py-8 text-center text-[15px] text-[#8b6f5c]">
                아직 코드를 사용한 신청이 없습니다.
              </p>
            ) : (
              codeUses.map((item) => {
                const member = userMap.get(item.userId ?? "");
                const isCurrent = item.code === adminPromo?.code;
                return (
                  <article key={item.id} className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[16px] font-bold text-[#403A49]">
                        {member ? userLabel(member) : "회원 정보 없음"}
                      </p>
                      <span className="shrink-0 rounded-full bg-[#f5efe6] px-3 py-1 text-[12px] font-semibold text-[#5c3d2e]">
                        {isCurrent ? "사용함" : "이전 코드"}
                      </span>
                    </div>
                    <p className="mt-2 text-[14px] text-[#5c3d2e]">{item.title}</p>
                    <p className="mt-1 text-[13px] text-[#6B6570]">
                      {item.code}
                      {item.percent ? ` · ${item.percent}%` : ""}
                      {item.discount ? ` · ${formatAmount(Number(item.discount))}` : ""}
                    </p>
                    {member ? <p className="mt-1 text-[13px] text-[#6B6570]">{contactLabel(member)}</p> : null}
                    <p className="mt-1 text-[13px] text-[#6B6570]">{formatDate(item.createdAt)}</p>
                  </article>
                );
              })
            )}
          </>
        ) : null}

        {tab === "orders"
          ? orders.map((order) => {
              const member = userMap.get(order.userId);
              return (
                <article key={order.id} className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[16px] font-bold text-[#403A49]">{order.title}</p>
                    <span className="shrink-0 rounded-full bg-[#f5efe6] px-3 py-1 text-[12px] font-semibold text-[#5c3d2e]">
                      {order.status}
                    </span>
                  </div>
                  <p className="mt-2 text-[14px] text-[#5c3d2e]">
                    {member ? userLabel(member) : "회원 정보 없음"} · {formatAmount(order.amount)}
                  </p>
                  <p className="mt-1 text-[13px] text-[#6B6570]">
                    {order.payment} · {formatDate(order.createdAt)}
                  </p>
                  <p className="mt-3 text-[13px] font-semibold text-[#6B6570]">진행 상태</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ORDER_STATUSES.map((status) => {
                      const active = order.status === status;
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => handleUpdateOrderStatus(order.id, status)}
                          className={`min-h-10 rounded-lg px-3 text-[13px] font-semibold ${
                            active
                              ? "bg-[#5c3d2e] text-white"
                              : "border border-[#d4c8ba] bg-white text-[#5c3d2e]"
                          }`}
                        >
                          {status}
                        </button>
                      );
                    })}
                  </div>
                </article>
              );
            })
          : null}

        {tab === "consultations"
          ? consultations.map((item) => {
              const member = userMap.get(item.userId ?? "");
              return (
                <article key={item.id} className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[16px] font-bold text-[#403A49]">{item.teacher}</p>
                    <span className="shrink-0 rounded-full bg-[#f5efe6] px-3 py-1 text-[12px] font-semibold text-[#5c3d2e]">
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-2 text-[14px] text-[#5c3d2e]">
                    {member ? userLabel(member) : "회원 정보 없음"} · {formatAmount(item.amount)}
                  </p>
                  <p className="mt-1 text-[13px] text-[#6B6570]">
                    {item.datetime} · {item.method}
                  </p>
                  <p className="mt-1 text-[13px] text-[#6B6570]">{item.purpose}</p>
                  <p className="mt-3 text-[13px] font-semibold text-[#6B6570]">진행 상태</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {CONSULT_STATUSES.map((status) => {
                      const active = item.status === status;
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => handleUpdateConsultationStatus(item.id, status)}
                          className={`min-h-10 rounded-lg px-3 text-[13px] font-semibold ${
                            active
                              ? "bg-[#5c3d2e] text-white"
                              : "border border-[#d4c8ba] bg-white text-[#5c3d2e]"
                          }`}
                        >
                          {status}
                        </button>
                      );
                    })}
                  </div>
                </article>
              );
            })
          : null}

        {tab === "reviews"
          ? reviews.map((item) => (
              <article key={item.id} className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[16px] font-bold text-[#403A49]">{item.title || "후기"}</p>
                  <span className="shrink-0 rounded-full bg-[#f5efe6] px-3 py-1 text-[12px] font-semibold text-[#5c3d2e]">
                    {item.visible ? "공개" : "대기"}
                  </span>
                </div>
                <p className="mt-2 text-[14px] text-[#5c3d2e]">
                  {item.name || "이름 없음"} · 별점 {item.rating}점
                </p>
                {item.text ? (
                  <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-[#6B6570]">{item.text}</p>
                ) : null}
                <p className="mt-2 text-[13px] text-[#6B6570]">{formatDate(item.createdAt)}</p>
                <button
                  type="button"
                  onClick={() => handleToggleReviewVisible(item.id, !item.visible)}
                  className={`mt-3 min-h-10 rounded-lg px-3 text-[13px] font-semibold ${
                    item.visible
                      ? "border border-[#d4c8ba] bg-white text-[#5c3d2e]"
                      : "bg-[#5c3d2e] text-white"
                  }`}
                >
                  {item.visible ? "대기로 바꾸기" : "상품에 공개"}
                </button>
              </article>
            ))
          : null}

        {tab === "events"
          ? eventItems.map((item) => {
              const member = userMap.get(item.userId ?? "");
              return (
                <article key={item.id} className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[16px] font-bold text-[#403A49]">{eventTitle(item)}</p>
                    <span className="shrink-0 rounded-full bg-[#f5efe6] px-3 py-1 text-[12px] font-semibold text-[#5c3d2e]">
                      신청접수
                    </span>
                  </div>
                  <p className="mt-2 text-[14px] text-[#5c3d2e]">
                    {item.name || member?.name || "이름 없음"} · {item.phone || member?.phone || "-"}
                  </p>
                  <p className="mt-1 text-[13px] text-[#6B6570]">{item.method}</p>
                  <p className="mt-2 text-[14px] leading-relaxed text-[#5c3d2e]">{item.product}</p>
                  {item.message ? (
                    <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-[#6B6570]">{item.message}</p>
                  ) : null}
                  <p className="mt-2 text-[13px] text-[#6B6570]">{formatDate(item.createdAt)}</p>
                </article>
              );
            })
          : null}

        {tab === "inquiries"
          ? inquiryItems.map((item) => {
              const member = userMap.get(item.userId ?? "");
              return (
                <article key={item.id} className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
                  <p className="text-[16px] font-bold text-[#403A49]">{item.name || member?.name || "이름 없음"}</p>
                  <p className="mt-1 text-[14px] text-[#5c3d2e]">
                    {item.phone || member?.phone || "-"} · {item.method}
                  </p>
                  <p className="mt-2 text-[14px] leading-relaxed text-[#5c3d2e]">{item.message}</p>
                  <p className="mt-2 text-[13px] text-[#6B6570]">
                    {item.product} · {formatDate(item.createdAt)}
                  </p>
                </article>
              );
            })
          : null}

        {tab === "schedule" ? (
          <>
            <p className="text-[15px] font-bold text-[#403A49]">{teacher} 상담 일정</p>
            <p className="mt-1 text-[13px] text-[#6B6570]">
              예약된 시간은 자동으로 막힙니다. 선생님 개인 일정은 아래에서 막거나 열 수 있습니다.
            </p>
            <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
              <p className="text-center text-[17px] font-bold text-[#403A49]">
                {parseConsultDate(scheduleDate)?.month ?? parseConsultDate(scheduleDates[0] ?? "")?.month ?? ""}월
              </p>
              {scheduleDate ? (
                <p className="mt-1 text-center text-[13px] font-semibold text-[#5c3d2e]">{scheduleDate}</p>
              ) : null}
              <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[12px] font-semibold text-[#6B6570]">
                {WEEKDAYS.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {buildCalendarCells(scheduleDates).map((cell, index) =>
                  cell.empty ? (
                    <span key={`empty-${index}`} className="aspect-square" />
                  ) : (
                    <button
                      key={cell.date}
                      type="button"
                      onClick={() => setScheduleDate(cell.date)}
                      className={`flex aspect-square items-center justify-center rounded-full text-[15px] font-bold ${
                        scheduleDate === cell.date ? "bg-[#5c3d2e] text-white" : "bg-[#f5efe6] text-[#3d2b1f]"
                      }`}
                    >
                      {cell.day}
                    </button>
                  ),
                )}
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {scheduleSlots.map((item) => (
                <div
                  key={item.time}
                  className="flex items-center justify-between rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]"
                >
                  <div>
                    <p className="text-[15px] font-bold text-[#403A49]">{item.time}</p>
                    <p className="mt-1 text-[13px] text-[#6B6570]">{scheduleStatusLabel(item.status)}</p>
                  </div>
                  {item.status === "booked" ? (
                    <span className="text-[13px] text-[#6B6570]">변경 불가</span>
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

        {counts[tab as Exclude<TabId, "schedule">] === 0 && tab !== "schedule" && tab !== "coupons" && tab !== "codes" ? (
          <div className="rounded-2xl bg-[#f5efe6] px-4 py-10 text-center text-[15px] text-[#8b6f5c]">
            아직 등록된 내역이 없습니다.
          </div>
        ) : null}
      </div>
    </MobileShell>
  );
}
