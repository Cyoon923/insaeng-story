"use client";

import { useCallback, useEffect, useState } from "react";
import { MobileShell } from "@/components/layout/MobileShell";
import { hasVerifiedPhone } from "@/lib/phoneVerification";
import {
  hasCompletedRefund,
  pointsRestoreCardView,
  refundCardActions,
} from "@/lib/refundCardActions";
import type {
  AdminPromo,
  AdminRefundRequestItem,
  AdminRefundRequestsView,
  ComplaintCategory,
  ComplaintRecord,
  Consultation,
  ConsultStatus,
  Coupon,
  CouponProduct,
  Inquiry,
  Order,
  OrderStatus,
  RefundRequestReason,
  RefundRequestStatus,
  User,
} from "@/lib/types/app";

type SlotStatus = "available" | "booked" | "blocked";

/** 관리자가 눈으로 확인해야 하는 결제 1건. 서버가 필요한 값만 내려준다. */
interface PaymentReviewItem {
  merchantOrderId: string;
  status: string;
  requestedAmount: number;
  approvedAmount: number | null;
  pgTid: string | null;
  method: string | null;
  orderId: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  kind: string | null;
  goodsName: string | null;
  userId: string | null;
}

type TabId = "users" | "points" | "coupons" | "codes" | "orders" | "consultations" | "refunds" | "reviews" | "events" | "inquiries" | "chat" | "schedule";

/** 챗봇에서 접수한 문의의 product 값. 저장 시 쓰는 값과 같아야 한다. */
const CHAT_INQUIRY_PRODUCT = "챗봇 상담원 문의";

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
  { id: "refunds", label: "환불 문의" },
  { id: "reviews", label: "후기" },
  { id: "events", label: "이벤트" },
  { id: "inquiries", label: "문의" },
  { id: "chat", label: "챗봇 문의" },
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

/** 관리자 챗봇 문의방. /api/admin/chat-inquiries 응답 형태 그대로 담는다. */
interface AdminChatInquiry {
  id: string;
  name: string;
  phone: string;
  contactMethod: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  lastMessageBody?: string;
  lastMessageSender?: "customer" | "agent";
}

interface AdminChatMessage {
  id: string;
  sender: "customer" | "agent";
  body: string;
  createdAt: string;
}

/** 내부 상태값을 그대로 보여 주지 않는다. */
function chatStatusLabel(status: string): string {
  if (status === "in_progress") return "상담 중";
  if (status === "closed") return "상담 종료";
  return "새 문의";
}

/** 상태 변경 버튼에 쓰는 값과 문구. 데이터 계층이 허용하는 세 값 그대로다. */
const CHAT_STATUS_OPTIONS: { value: "new" | "in_progress" | "closed"; label: string }[] = [
  { value: "new", label: "새 문의" },
  { value: "in_progress", label: "상담 중" },
  { value: "closed", label: "상담 종료" },
];

/** 불만 분류. 서버 enum과 한 글자도 어긋나면 안 된다. 최종 판정은 서버가 한다. */
const COMPLAINT_CATEGORY_OPTIONS: { value: ComplaintCategory; label: string }[] = [
  { value: "service", label: "서비스" },
  { value: "payment", label: "결제" },
  { value: "consultation", label: "상담" },
  { value: "delivery", label: "전달" },
  { value: "privacy", label: "개인정보" },
  { value: "other", label: "기타" },
];

/** 요지 상한. 서버 규칙(complaintRecordRules)과 같은 값이며 서버가 최종 관문이다. */
const COMPLAINT_SUMMARY_MAX = 500;

function complaintCategoryLabel(value: string) {
  return COMPLAINT_CATEGORY_OPTIONS.find((item) => item.value === value)?.label ?? value;
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

/**
 * 환불 문의 상태 문구.
 *
 * approved를 "환불 완료"로 적지 않는다. 승인은 운영 결정이고 실제 결제 취소는
 * 아직 일어나지 않았다. 둘을 같은 말로 적으면 운영자가 돈이 나간 줄 안다.
 */
const REFUND_STATUS_LABEL: Record<RefundRequestStatus, string> = {
  requested: "접수",
  reviewing: "검토 중",
  approved: "환불 승인 · 결제 취소 대기",
  rejected: "거절",
  completed: "환불 완료",
};

/** 고객이 고른 사유를 사람이 읽는 말로 바꾼다. */
const REFUND_REASON_LABEL: Record<RefundRequestReason, string> = {
  "change-of-mind": "단순 변심",
  schedule: "일정 변경·취소",
  "service-issue": "서비스 문제",
  "duplicate-payment": "중복·오결제",
  other: "기타",
};

/**
 * 접수 당시 취소창 판정을 그대로 읽어 준다.
 *
 * 서버가 내린 결론은 "일반 문의 / 개별 확인"까지이고, 환불 가능 여부가 아니다.
 * 그래서 문구에도 "환불 가능"이나 "환불 불가"라고 적지 않는다.
 */
function cancelWindowLabel(snapshot: AdminRefundRequestItem["cancelWindowSnapshot"]) {
  if (!snapshot) return "기록 없음";
  if (snapshot.kind === "normal-request") {
    return `일반 문의 범위 (시작까지 ${snapshot.remainingMinutes}분 남음)`;
  }
  const reason =
    snapshot.reason === "within-window"
      ? "시작 3시간 이내"
      : snapshot.reason === "after-start"
        ? "시작 시각 이후"
        : snapshot.reason === "missing-scheduled-at"
          ? "예약 시각 기록 없음"
          : "예약 시각을 읽을 수 없음";
  return `개별 확인 필요 (${reason})`;
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
  const [paymentReview, setPaymentReview] = useState<{
    stale: PaymentReviewItem[];
    unlinked: PaymentReviewItem[];
  }>({ stale: [], unlinked: [] });
  const [orders, setOrders] = useState<Order[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  /**
   * 환불 문의 묶음. 목록만 두면 "문의 없음"과 "조회 실패"가 똑같이 빈 배열로 보여
   * 서버가 준 loaded를 그대로 들고 있는다. 첫 조회 전에는 loaded를 true로 두어
   * 화면이 뜨자마자 실패 문구가 깜빡이지 않게 한다.
   */
  const [refundRequests, setRefundRequests] = useState<AdminRefundRequestsView>({
    items: [],
    loaded: true,
  });
  /** 처리 중인 환불 문의 id. 같은 버튼을 두 번 누르지 못하게 하는 데 쓴다. */
  const [refundBusy, setRefundBusy] = useState("");
  /** 문의 1건마다 남기는 결과 문구. 기존 재접수 안내와 같은 방식이다. */
  const [refundMessage, setRefundMessage] = useState<Record<string, string>>({});
  const [scheduleDates, setScheduleDates] = useState<string[]>([]);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleSlots, setScheduleSlots] = useState<{ time: string; status: SlotStatus }[]>([]);
  const [teacher, setTeacher] = useState("유비 선생");
  /** 선택할 수 있는 선생님 목록. API가 주지 않으면 빈 배열이라 선택 UI를 그리지 않는다. */
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
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

  // 새 상담원 문의방(chat_inquiries). 기존 legacy 문의와 별개로 담는다.
  const [chatThreads, setChatThreads] = useState<AdminChatInquiry[]>([]);
  /**
   * 불만·분쟁 기록. 서버가 { items, loaded } 모양으로 준다.
   * loaded가 false면 "기록 없음"이 아니라 "읽지 못함"이다.
   */
  const [complaintRecords, setComplaintRecords] = useState<{
    items: ComplaintRecord[];
    loaded: boolean;
  }>({ items: [], loaded: false });
  const [complaintCategory, setComplaintCategory] = useState<ComplaintCategory>("service");
  const [complaintSummary, setComplaintSummary] = useState("");
  const [complaintSaving, setComplaintSaving] = useState(false);
  const [complaintError, setComplaintError] = useState("");
  // 목록을 한 번이라도 불러왔는지. 탭을 오갈 때 같은 조회를 반복하지 않기 위해 둔다.
  const [chatLoaded, setChatLoaded] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [selectedChatId, setSelectedChatId] = useState("");
  const [selectedChatMessages, setSelectedChatMessages] = useState<AdminChatMessage[]>([]);
  const [chatDetailLoading, setChatDetailLoading] = useState(false);
  const [chatDetailError, setChatDetailError] = useState("");
  const [chatReply, setChatReply] = useState("");
  const [chatReplySending, setChatReplySending] = useState(false);
  const [chatReplyError, setChatReplyError] = useState("");
  const [chatStatusSaving, setChatStatusSaving] = useState(false);
  // 재접수 중인 결제의 주문번호. 같은 버튼을 두 번 누르지 못하게 하는 데 쓴다.
  const [recommitting, setRecommitting] = useState("");
  // 재접수 결과 안내. 주문번호별로 한 줄씩 보여 준다.
  const [recommitMessage, setRecommitMessage] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    const res = await fetch("/api/admin", { cache: "no-store" });
    if (res.status === 401) {
      setAuthed(false);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setUsers(data.users ?? []);
    setPaymentReview(
      (data.paymentsNeedingReview ?? { stale: [], unlinked: [] }) as {
        stale: PaymentReviewItem[];
        unlinked: PaymentReviewItem[];
      },
    );
    // 상담 주문은 결제 귀속용이므로 인생곡 중심 화면에서는 제외한다.
    setOrders(
      ((data.orders ?? []) as Order[]).filter((order) => order.product !== "consultation"),
    );
    setConsultations(data.consultations ?? []);
    setReviews((data.reviews ?? []) as ReviewItem[]);
    setInquiries(data.inquiries ?? []);
    // 서버는 { items, loaded } 모양으로 준다. loaded가 false면 읽지 못한 것이며
    // 빈 목록을 "문의 없음"으로 보여주면 안 된다.
    setRefundRequests((data.refundRequests ?? { items: [], loaded: false }) as AdminRefundRequestsView);
    setComplaintRecords(
      (data.complaintRecords ?? { items: [], loaded: false }) as {
        items: ComplaintRecord[];
        loaded: boolean;
      },
    );
    const nextDates = (data.dates ?? []) as string[];
    setScheduleDates(nextDates);
    setScheduleDate((current) => current || nextDates[0] || "");
    setTeacher(String(data.teacher ?? "유비 선생"));
    setTeachers((data.teachers ?? []) as { id: string; name: string }[]);
    setAdminPromo((data.adminPromo ?? null) as AdminPromo | null);
    setUserCoupons((data.coupons ?? {}) as Record<string, Coupon[]>);
    setAuthed(true);
    setLoading(false);
  }, []);

  /**
   * 새 상담원 문의방 목록. 챗봇 문의 탭에 들어갈 때 한 번만 부른다.
   * 실패해도 다른 관리자 기능은 그대로 쓸 수 있도록 이 탭 안에만 오류를 남긴다.
   */
  const loadChatThreads = useCallback(async () => {
    setChatLoading(true);
    setChatError("");
    try {
      const res = await fetch("/api/admin/chat-inquiries", { cache: "no-store" });
      if (!res.ok) {
        setChatError("문의 목록을 불러오지 못했습니다.");
        return;
      }
      const data = (await res.json()) as { inquiries?: AdminChatInquiry[] };
      setChatThreads(data.inquiries ?? []);
      setChatLoaded(true);
    } catch {
      setChatError("문의 목록을 불러오지 못했습니다.");
    } finally {
      setChatLoading(false);
    }
  }, []);

  /** 문의방 하나의 전체 대화. 목록은 그대로 두고 상세 영역만 바꾼다. */
  const openChatThread = useCallback(async (id: string) => {
    setSelectedChatId(id);
    setSelectedChatMessages([]);
    setChatDetailError("");
    setChatReply("");
    setChatReplyError("");
    setChatDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/chat-inquiries/${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setChatDetailError("대화를 불러오지 못했습니다.");
        return;
      }
      const data = (await res.json()) as {
        inquiry: AdminChatInquiry;
        messages: AdminChatMessage[];
      };
      // 목록 쪽 상태도 서버가 준 최신 값으로 맞춘다.
      setChatThreads((list) =>
        list.map((item) => (item.id === data.inquiry.id ? { ...item, ...data.inquiry } : item)),
      );
      setSelectedChatMessages(data.messages ?? []);
    } catch {
      setChatDetailError("대화를 불러오지 못했습니다.");
    } finally {
      setChatDetailLoading(false);
    }
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

  /**
   * 승인은 끝났는데 주문이 연결되지 않은 결제를 다시 접수한다.
   *
   * 실제 판단은 전부 서버(/api/admin/payments/recommit)가 한다.
   * 이 화면은 주문번호만 보내고 결과 문구를 보여 줄 뿐이며, 실패해도 다시 부르지 않는다.
   * 자동 재시도는 같은 건을 여러 번 처리하려는 시도가 되어 위험하다.
   */
  async function handleRecommit(merchantOrderId: string) {
    // 이미 처리 중이면 아무것도 하지 않는다. 같은 버튼을 두 번 누른 경우다.
    if (recommitting) return;
    setRecommitting(merchantOrderId);
    setRecommitMessage((current) => ({ ...current, [merchantOrderId]: "" }));
    try {
      const res = await fetch("/api/admin/payments/recommit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantOrderId }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        // recommitted(새로 접수) / linkedOnly(연결만) / alreadyLinked(이미 끝남) 모두 성공이다.
        setRecommitMessage((current) => ({
          ...current,
          [merchantOrderId]: data.alreadyLinked
            ? "이미 접수가 연결되어 있습니다."
            : data.linkedOnly
              ? "기존 접수에 결제를 연결했습니다."
              : "재접수했습니다.",
        }));
        // 목록을 다시 불러 처리된 건이 빠지게 한다.
        await loadData();
        return;
      }
      setRecommitMessage((current) => ({
        ...current,
        [merchantOrderId]:
          data.reason ?? data.error ?? "재접수하지 못했습니다. 결제 상태를 확인해 주세요.",
      }));
    } catch {
      setRecommitMessage((current) => ({
        ...current,
        [merchantOrderId]: "재접수 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      }));
    } finally {
      setRecommitting("");
    }
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

  /**
   * 환불 문의 상태 변경.
   *
   * 화면은 어떤 전이가 가능한지 다시 판단하지 않는다. 버튼을 그릴 때 쓰는 목록과
   * 서버의 허용 규칙이 갈라질 수 있으므로, 최종 판단은 언제나 서버가 한다.
   *
   * 지금 보고 있는 상태(expectedCurrentStatus)를 함께 보내, 그 사이 다른 관리자가
   * 먼저 처리했다면 서버가 409로 막는다. 그때는 목록을 다시 불러 온다.
   * handledBy·decidedAt은 보내지 않는다. 서버가 정한다.
   */
  async function handleTransitionRefund(
    item: AdminRefundRequestItem,
    targetStatus: RefundRequestStatus,
    confirmText: string,
  ) {
    if (refundBusy) return;
    if (!window.confirm(confirmText)) return;
    setRefundBusy(item.id);
    setRefundMessage((current) => ({ ...current, [item.id]: "" }));
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "transitionRefundRequest",
          refundRequestId: item.id,
          expectedCurrentStatus: item.status,
          targetStatus,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (res.ok && data?.ok) {
        // 서버가 돌려준 값만 믿지 않고 목록을 다시 불러 최신 상태로 맞춘다.
        await loadData();
        setRefundMessage((current) => ({
          ...current,
          [item.id]: `${REFUND_STATUS_LABEL[targetStatus]}(으)로 변경했습니다.`,
        }));
        return;
      }
      if (res.status === 409) {
        // 그 사이 상태가 바뀌었다. 지금 상태를 보고 다시 판단해야 한다.
        setRefundMessage((current) => ({
          ...current,
          [item.id]: data?.error ?? "그 사이 상태가 바뀌었습니다. 현재 상태를 확인해 주세요.",
        }));
        await loadData();
        return;
      }
      setRefundMessage((current) => ({
        ...current,
        [item.id]: data?.error ?? "처리하지 못했습니다.",
      }));
    } catch {
      setRefundMessage((current) => ({
        ...current,
        [item.id]: "요청에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      }));
    } finally {
      setRefundBusy("");
    }
  }

  /**
   * 승인된 환불 문의의 실제 전액환불 실행.
   *
   * 보내는 값은 어떤 문의인지(refundRequestId)뿐이다. 주문·결제·거래 번호·금액·
   * 실행 단계는 보내지 않는다. 실행 대상은 서버가 DB에서 정한다.
   *
   * 실패하거나 결과가 불확실해도 여기서 다른 요청을 대신 보내지 않는다.
   * 복구(결제 상태 확인)를 자동으로 부르지 않고, 자동 재시도도 하지 않는다.
   * 결제사에서는 이미 환불이 끝났을 수 있어 다시 누르도록 유도하면 안 된다.
   */
  async function handleExecuteRefund(item: AdminRefundRequestItem) {
    if (refundBusy) return;
    if (
      !window.confirm(
        "실제로 결제를 취소하시겠습니까?\n\n결제사에 전액취소를 요청합니다. 이 작업은 되돌릴 수 없습니다.",
      )
    ) {
      return;
    }
    setRefundBusy(item.id);
    setRefundMessage((current) => ({ ...current, [item.id]: "" }));
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "executeApprovedRefund", refundRequestId: item.id }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; status?: string; message?: string; error?: string }
        | null;
      if (res.ok && data?.ok) {
        // 환불이 확인되어 내부 반영까지 끝났다. 목록을 다시 불러 최신 상태로 맞춘다.
        await loadData();
        setRefundMessage((current) => ({
          ...current,
          [item.id]: "환불이 완료되어 기록에 반영했습니다.",
        }));
        return;
      }
      if (res.status === 202) {
        // 실패가 아니다. 아직 확인되지 않았을 뿐이므로 다시 누르라고 하지 않는다.
        setRefundMessage((current) => ({
          ...current,
          [item.id]:
            data?.message ?? "결제사 거래 상태 확인이 아직 필요합니다. 잠시 후 상태를 확인해 주세요.",
        }));
        await loadData();
        return;
      }
      if (res.status === 409) {
        // 이미 실행되었거나 담당자 확인이 필요한 상태다. 여기서 다른 요청을 보내지 않는다.
        setRefundMessage((current) => ({
          ...current,
          [item.id]: data?.message ?? data?.error ?? "담당자가 결제 상태를 직접 확인해야 합니다.",
        }));
        await loadData();
        return;
      }
      setRefundMessage((current) => ({
        ...current,
        [item.id]: data?.error ?? "처리하지 못했습니다. 상태를 확인해 주세요.",
      }));
    } catch {
      setRefundMessage((current) => ({
        ...current,
        [item.id]: "요청에 실패했습니다. 상태를 확인해 주세요.",
      }));
    } finally {
      setRefundBusy("");
    }
  }

  /**
   * 환불이 끝난 주문의 적립금 복원 재시도.
   *
   * 환불을 다시 실행하는 버튼이 아니다. 결제사를 부르지 않고 결제·환불 상태도 바꾸지
   * 않는다. 환불 완료 뒤 적립금 복원만 빠진 건을 다시 시도한다.
   *
   * 보내는 값은 어떤 문의인지(refundRequestId)뿐이다. 주문·회원·결제·금액·적립금은
   * 보내지 않는다. 복원 대상과 금액은 서버가 DB에서 다시 읽어 정한다.
   *
   * 실패해도 다른 요청을 대신 보내지 않고 자동으로 다시 시도하지 않는다.
   */
  async function handleRestorePoints(item: AdminRefundRequestItem) {
    if (refundBusy) return;
    if (
      !window.confirm(
        "적립금 복원을 다시 시도하시겠습니까?\n\n결제사에 환불을 다시 요청하지 않습니다. 이 주문에 사용된 적립금만 회원에게 돌려줍니다.",
      )
    ) {
      return;
    }
    setRefundBusy(item.id);
    setRefundMessage((current) => ({ ...current, [item.id]: "" }));
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 문의 id 하나만 보낸다. 서버도 이 값만 읽는다.
        body: JSON.stringify({ action: "restoreOrderPoints", refundRequestId: item.id }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; status?: string; message?: string; error?: string }
        | null;
      if (res.ok && data?.ok) {
        // 복원되었거나 이미 복원된 주문이다. 목록을 다시 불러 원장 표시를 서버 기준으로 맞춘다.
        await loadData();
        setRefundMessage((current) => ({
          ...current,
          [item.id]: data?.message ?? "적립금을 복원했습니다.",
        }));
        return;
      }
      if (res.status === 202) {
        // 실패가 아니다. 저장소가 그사이 바뀌었을 뿐이라 다시 누르면 된다.
        setRefundMessage((current) => ({
          ...current,
          [item.id]: data?.message ?? "지금은 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        }));
        return;
      }
      if (res.status === 409) {
        // 자동 복원 대상이 아니다. 여기서 다른 요청을 대신 보내지 않는다.
        setRefundMessage((current) => ({
          ...current,
          [item.id]:
            data?.message ??
            data?.error ??
            "자동으로 복원할 수 있는 주문이 아닙니다. 담당자 확인이 필요합니다.",
        }));
        return;
      }
      setRefundMessage((current) => ({
        ...current,
        [item.id]: data?.error ?? "처리하지 못했습니다. 상태를 확인해 주세요.",
      }));
    } catch {
      setRefundMessage((current) => ({
        ...current,
        [item.id]: "요청에 실패했습니다. 상태를 확인해 주세요.",
      }));
    } finally {
      setRefundBusy("");
    }
  }

  /**
   * 승인된 환불 문의의 결제 상태 확인·복구.
   *
   * 돈을 새로 취소하는 버튼이 아니다. 서버가 결제사 거래조회로 지금 사실을 확인해
   * 내부 기록을 맞춘다. 보내는 값은 어떤 문의인지(refundRequestId)뿐이고,
   * 주문·결제·거래 번호·금액·실행 단계·복구 경로는 보내지 않는다. 서버가 DB에서 정한다.
   *
   * 실패해도 다른 요청을 대신 보내지 않는다. 자동 재시도도 하지 않는다.
   * 결제사에서는 이미 환불이 끝났을 수 있어, 화면이 다시 누르도록 유도하면 안 된다.
   */
  async function handleRecoverRefund(item: AdminRefundRequestItem) {
    if (refundBusy) return;
    if (
      !window.confirm(
        "결제 상태를 확인하시겠습니까?\n\n결제사에 취소를 다시 요청하지 않고, 지금 상태만 조회해 기록을 맞춥니다.",
      )
    ) {
      return;
    }
    setRefundBusy(item.id);
    setRefundMessage((current) => ({ ...current, [item.id]: "" }));
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "recoverApprovedRefund", refundRequestId: item.id }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; status?: string; message?: string; error?: string }
        | null;
      if (res.ok && data?.ok) {
        // 환불이 확인되어 내부 반영까지 끝났다. 목록을 다시 불러 최신 상태로 맞춘다.
        await loadData();
        setRefundMessage((current) => ({
          ...current,
          [item.id]: "환불 완료가 확인되어 기록에 반영했습니다.",
        }));
        return;
      }
      if (res.status === 202) {
        // 실패가 아니다. 아직 확인되지 않았을 뿐이므로 다시 누르라고 하지 않는다.
        setRefundMessage((current) => ({
          ...current,
          [item.id]:
            data?.message ?? "결제사 거래 상태 확인이 아직 필요합니다. 잠시 후 상태를 확인해 주세요.",
        }));
        return;
      }
      if (res.status === 409) {
        // 자동으로 정리할 수 없는 상태다. 여기서 다른 요청을 대신 보내지 않는다.
        setRefundMessage((current) => ({
          ...current,
          [item.id]:
            data?.message ?? data?.error ?? "담당자가 결제 상태를 직접 확인해야 합니다.",
        }));
        return;
      }
      setRefundMessage((current) => ({
        ...current,
        [item.id]: data?.error ?? "처리하지 못했습니다. 상태를 확인해 주세요.",
      }));
    } catch {
      setRefundMessage((current) => ({
        ...current,
        [item.id]: "요청에 실패했습니다. 상태를 확인해 주세요.",
      }));
    } finally {
      setRefundBusy("");
    }
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

  /**
   * 상담원 답변 저장. 성공한 메시지만 화면에 더하고, 목록의 마지막 말과 시간도 함께 맞춘다.
   * 관리자 전체 데이터를 다시 불러오지 않는다.
   */
  async function handleSendChatReply() {
    const message = chatReply.trim();
    if (!selectedChatId || !message || chatReplySending) return;
    setChatReplySending(true);
    setChatReplyError("");
    try {
      const res = await fetch(`/api/admin/chat-inquiries/${encodeURIComponent(selectedChatId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = (await res.json().catch(() => null)) as
        | { message?: AdminChatMessage; error?: string }
        | null;
      if (!res.ok || !data?.message) {
        setChatReplyError(data?.error ?? "답변을 보내지 못했습니다.");
        return;
      }
      const saved = data.message;
      setSelectedChatMessages((list) => [...list, saved]);
      // 서버가 new였던 방을 in_progress로 바꾸므로 화면에도 같게 반영한다.
      setChatThreads((list) =>
        list.map((item) =>
          item.id === selectedChatId
            ? {
                ...item,
                status: item.status === "new" ? "in_progress" : item.status,
                lastMessageAt: saved.createdAt,
                updatedAt: saved.createdAt,
                lastMessageBody: saved.body,
                lastMessageSender: saved.sender,
              }
            : item,
        ),
      );
      setChatReply("");
    } catch {
      setChatReplyError("답변을 보내지 못했습니다.");
    } finally {
      setChatReplySending(false);
    }
  }

  /** 상담 상태 변경. 실패하면 기존 상태를 그대로 둔다. */
  /**
   * 이 문의를 불만·분쟁 기록으로 승격한다.
   *
   * 보내는 값은 분류·요지와 어디에서 온 건인지뿐이다. 이름·연락처·대화 전문·원본 id는
   * 보내지 않고, 상태·시각·처리자도 서버가 정한다.
   * 요지는 상담원이 직접 적는다. 대화 내용을 자동으로 채우지 않는다.
   */
  async function handleCreateComplaint(sourceType: "chat" | "inquiry", userId: string | null) {
    const summary = complaintSummary.trim();
    if (!summary || complaintSaving) return;
    setComplaintSaving(true);
    setComplaintError("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createComplaintRecord",
          sourceType,
          category: complaintCategory,
          summary,
          userId,
          // 주문을 특정할 수 있는 화면이 아니라면 비워 둔다. 짐작해서 채우지 않는다.
          orderId: null,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setComplaintError(data?.error ?? "기록하지 못했습니다.");
        return;
      }
      setComplaintSummary("");
      await loadData();
    } catch {
      setComplaintError("기록하지 못했습니다.");
    } finally {
      setComplaintSaving(false);
    }
  }

  /** 불만 기록을 처리 완료로 표시한다. 보내는 값은 어떤 기록인지뿐이다. */
  async function handleMarkComplaintHandled(complaintRecordId: string) {
    if (complaintSaving) return;
    setComplaintSaving(true);
    setComplaintError("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markComplaintHandled", complaintRecordId }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setComplaintError(data?.error ?? "처리하지 못했습니다.");
        return;
      }
      await loadData();
    } catch {
      setComplaintError("처리하지 못했습니다.");
    } finally {
      setComplaintSaving(false);
    }
  }

  async function handleUpdateChatStatus(id: string, status: "new" | "in_progress" | "closed") {
    const current = chatThreads.find((item) => item.id === id);
    if (!current || current.status === status || chatStatusSaving) return;
    // 끝난 상담을 다시 열면 고객이 또 메시지를 보낼 수 있게 되므로 한 번 더 묻는다.
    if (current.status === "closed" && status !== "closed") {
      const ok = window.confirm(
        "상담을 다시 진행 상태로 변경하시겠습니까?\n고객이 다시 메시지를 보낼 수 있습니다.",
      );
      if (!ok) return;
    }
    setChatStatusSaving(true);
    setChatDetailError("");
    try {
      const res = await fetch(`/api/admin/chat-inquiries/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await res.json().catch(() => null)) as
        | { inquiry?: AdminChatInquiry; error?: string }
        | null;
      if (!res.ok || !data?.inquiry) {
        setChatDetailError(data?.error ?? "상태를 변경하지 못했습니다.");
        return;
      }
      const next = data.inquiry;
      setChatThreads((list) => list.map((item) => (item.id === next.id ? { ...item, ...next } : item)));
    } catch {
      setChatDetailError("상태를 변경하지 못했습니다.");
    } finally {
      setChatStatusSaving(false);
    }
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
  const chatItems = inquiries.filter((item) => item.product === CHAT_INQUIRY_PRODUCT);
  const inquiryItems = inquiries.filter(
    (item) => !isEventInquiry(item) && item.product !== CHAT_INQUIRY_PRODUCT,
  );
  const codeUses = adminCodeUses(orders, consultations);
  const currentCodeUses = codeUses.filter((item) => item.code === adminPromo?.code);
  // 탈퇴한 회원은 이름과 개인정보만 비운 채 행이 남는다. 숫자에서는 빼고 목록에는 그대로 둔다.
  const activeUsers = users.filter((user) => !user.withdrawnAt);
  const counts: Record<Exclude<TabId, "schedule">, number> = {
    users: activeUsers.length,
    points: activeUsers.length,
    coupons: activeUsers.length,
    codes: codeUses.length,
    orders: orders.length,
    consultations: consultations.length,
    refunds: refundRequests.items.length,
    reviews: reviews.length,
    events: eventItems.length,
    inquiries: inquiryItems.length,
    // 새 문의방 + 기존 legacy 문의. 목록을 아직 부르기 전에는 chatThreads가 빈 배열이라
    // legacy 수만 보이고, 조회가 끝나면 늘어난다. 0으로 깜빡이지 않는다.
    chat: chatThreads.length + chatItems.length,
  };

  const selectedChatThread = chatThreads.find((item) => item.id === selectedChatId) ?? null;

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
                onClick={() => {
                  setTab(item.id);
                  // 챗봇 문의 탭을 처음 열 때만 문의방 목록을 부른다. 주기적으로 다시 부르지 않는다.
                  if (item.id === "chat" && !chatLoaded && !chatLoading) loadChatThreads();
                }}
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

      {paymentReview.stale.length > 0 || paymentReview.unlinked.length > 0 ? (
        <section className="px-4 pt-5">
          <p className="text-[16px] font-bold text-[#403A49]">결제 확인 필요</p>
          <div className="mt-2 space-y-3">
            {paymentReview.stale.map((item) => (
              <article
                key={`stale-${item.merchantOrderId}`}
                className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[16px] font-bold text-[#403A49]">
                    {item.goodsName ?? "결제 건"}
                  </p>
                  <span className="shrink-0 rounded-full bg-[#f5efe6] px-3 py-1 text-[12px] font-semibold text-[#5c3d2e]">
                    결제 결과 확인 필요
                  </span>
                </div>
                <p className="mt-2 text-[14px] text-[#5c3d2e]">
                  {formatAmount(item.requestedAmount)}
                </p>
                <p className="mt-1 text-[13px] text-[#6B6570]">주문번호 {item.merchantOrderId}</p>
                {item.pgTid ? (
                  <p className="mt-1 text-[13px] text-[#6B6570]">PG 거래번호 {item.pgTid}</p>
                ) : null}
                <p className="mt-1 text-[13px] text-[#6B6570]">
                  마지막 변경 {formatDate(item.updatedAt)}
                </p>
                <p className="mt-3 text-[13px] leading-relaxed text-[#6B6570]">
                  결제 승인 여부를 NICEPAY 관리자에서 확인해 주세요.
                </p>
              </article>
            ))}
            {paymentReview.unlinked.map((item) => (
              <article
                key={`unlinked-${item.merchantOrderId}`}
                className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[16px] font-bold text-[#403A49]">
                    {item.goodsName ?? "결제 건"}
                  </p>
                  <span className="shrink-0 rounded-full bg-[#f5efe6] px-3 py-1 text-[12px] font-semibold text-[#5c3d2e]">
                    결제 완료 / 접수 확인 필요
                  </span>
                </div>
                <p className="mt-2 text-[14px] text-[#5c3d2e]">
                  {formatAmount(item.approvedAmount ?? item.requestedAmount)}
                </p>
                <p className="mt-1 text-[13px] text-[#6B6570]">주문번호 {item.merchantOrderId}</p>
                {item.pgTid ? (
                  <p className="mt-1 text-[13px] text-[#6B6570]">PG 거래번호 {item.pgTid}</p>
                ) : null}
                {item.approvedAt ? (
                  <p className="mt-1 text-[13px] text-[#6B6570]">
                    승인 시간 {formatDate(item.approvedAt)}
                  </p>
                ) : null}
                <p className="mt-3 text-[13px] leading-relaxed text-[#6B6570]">
                  결제는 완료되었으나 주문 접수가 완료되지 않았습니다.
                </p>
                <button
                  type="button"
                  onClick={() => handleRecommit(item.merchantOrderId)}
                  disabled={recommitting === item.merchantOrderId}
                  className="mt-3 h-11 w-full rounded-xl bg-[#403A49] text-[15px] font-semibold text-white disabled:opacity-50"
                >
                  {recommitting === item.merchantOrderId ? "처리 중..." : "재접수"}
                </button>
                {recommitMessage[item.merchantOrderId] ? (
                  <p className="mt-2 text-[13px] leading-relaxed text-[#5c3d2e]">
                    {recommitMessage[item.merchantOrderId]}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="space-y-3 px-4 py-5">
        {tab === "users"
          ? users.map((user) => (
              <article key={user.id} className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
                <p className="text-[16px] font-bold text-[#403A49]">{userLabel(user)}</p>
                <p className="mt-1 text-[14px] text-[#5c3d2e]">{contactLabel(user)}</p>
                {/*
                  추천인 코드는 휴대폰 본인확인을 마친 회원에게만 표시한다.
                  코드는 user.id만으로 만들어져 가입 즉시 값이 생기지만, 서버가 미인증
                  회원을 추천인으로 인정하지 않는다(applyOrder의 applyReferral).
                  표시해 두면 운영자가 쓸 수 없는 코드를 고객에게 안내할 수 있다.
                  판정은 회원 MY 화면과 같은 hasVerifiedPhone 하나를 쓴다.
                */}
                {hasVerifiedPhone(user) ? (
                  <p className="mt-2 text-[13px] text-[#6B6570]">
                    추천인 코드 {referralCodeFor(user)}
                  </p>
                ) : (
                  <p className="mt-2 text-[13px] text-[#6B6570]">추천인 코드 — 본인확인 전</p>
                )}
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
              /*
               * 환불이 끝난 건인지는 이미 받은 환불 문의 목록만 보고 정한다(추가 조회 없음).
               * 버튼을 잠그는 것은 편의일 뿐이고, 실제 관문은 서버의 409 잠금이다.
               */
              const refunded = hasCompletedRefund(refundRequests.items, order.id);
              return (
                <article key={order.id} className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[16px] font-bold text-[#403A49]">{order.title}</p>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                      {/* 진행 상태는 이력으로 그대로 두고, 환불 사실을 함께 보여 준다. */}
                      {refunded ? (
                        <span className="rounded-full bg-[#403A49] px-3 py-1 text-[12px] font-semibold text-white">
                          환불 완료
                        </span>
                      ) : null}
                      <span className="rounded-full bg-[#f5efe6] px-3 py-1 text-[12px] font-semibold text-[#5c3d2e]">
                        {order.status}
                      </span>
                    </div>
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
                          disabled={refunded}
                          title={
                            refunded ? "환불이 완료된 건은 진행 상태를 변경할 수 없습니다." : undefined
                          }
                          className={`min-h-10 rounded-lg px-3 text-[13px] font-semibold ${
                            active
                              ? "bg-[#5c3d2e] text-white"
                              : "border border-[#d4c8ba] bg-white text-[#5c3d2e]"
                          } disabled:opacity-50`}
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
              /*
               * 상담과 결제 귀속 주문은 같은 id를 쓰므로(applyOrder.ts) 그 id로 찾는다.
               * 짝이 되는 주문이 없는 옛 상담에는 환불 문의도 없어 기존 동작이 유지된다.
               */
              const refunded = hasCompletedRefund(refundRequests.items, item.id);
              return (
                <article key={item.id} className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[16px] font-bold text-[#403A49]">{item.teacher}</p>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                      {refunded ? (
                        <span className="rounded-full bg-[#403A49] px-3 py-1 text-[12px] font-semibold text-white">
                          환불 완료
                        </span>
                      ) : null}
                      <span className="rounded-full bg-[#f5efe6] px-3 py-1 text-[12px] font-semibold text-[#5c3d2e]">
                        {item.status}
                      </span>
                    </div>
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
                          disabled={refunded}
                          title={
                            refunded ? "환불이 완료된 건은 진행 상태를 변경할 수 없습니다." : undefined
                          }
                          className={`min-h-10 rounded-lg px-3 text-[13px] font-semibold ${
                            active
                              ? "bg-[#5c3d2e] text-white"
                              : "border border-[#d4c8ba] bg-white text-[#5c3d2e]"
                          } disabled:opacity-50`}
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

        {tab === "refunds" ? (
          refundRequests.items.length ? (
            refundRequests.items.map((item) => {
              const member = userMap.get(item.userId);
              const isConsultation = item.order.product === "consultation";
              const busy = refundBusy === item.id;
              // 어떤 버튼을 보일지는 서버가 준 요약으로만 정한다. 화면이 결제 상태를
              // 다시 해석하지 않으며, 두 버튼이 함께 나오는 조합은 없다.
              const actions = refundCardActions(item.status, item.refundExecution);
              // 적립금 복원 영역은 completed에서만 보인다. 위 두 버튼은 approved에서만
              // 나오므로 두 영역이 같은 카드에 함께 뜨는 조합은 없다.
              const pointsView = pointsRestoreCardView(item.status, item.hasPointsRestoreRecord);
              return (
                <article key={item.id} className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-[16px] font-bold text-[#403A49]">{item.order.title}</p>
                    <span className="shrink-0 rounded-full bg-[#f5efe6] px-3 py-1 text-[12px] font-semibold text-[#5c3d2e]">
                      {REFUND_STATUS_LABEL[item.status]}
                    </span>
                  </div>
                  <p className="mt-2 text-[14px] text-[#5c3d2e]">
                    {member ? userLabel(member) : "회원 정보 없음"} ·{" "}
                    {formatAmount(item.order.amount)}
                  </p>
                  <p className="mt-1 text-[13px] text-[#6B6570]">
                    {item.order.product} · 접수 {formatDate(item.requestedAt)}
                  </p>
                  <p className="mt-1 text-[13px] text-[#6B6570]">주문 진행 {item.order.status}</p>

                  <p className="mt-3 text-[13px] font-semibold text-[#6B6570]">고객 사유</p>
                  <p className="mt-1 text-[14px] text-[#403A49]">
                    {REFUND_REASON_LABEL[item.reason]}
                  </p>
                  {item.message ? (
                    <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-[#403A49]">
                      {item.message}
                    </p>
                  ) : null}

                  {/*
                    접수 당시 값과 지금 값을 다른 상자에 담는다. 두 값이 다른 것 자체가
                    판단 근거라서 한 줄로 합치지 않는다.
                  */}
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl bg-[#f5efe6] p-3">
                      <p className="text-[12px] font-bold text-[#5c3d2e]">접수 당시 기록</p>
                      {isConsultation ? (
                        <>
                          <p className="mt-1 text-[13px] text-[#403A49]">
                            예약 {item.scheduledAtSnapshot ? formatDate(item.scheduledAtSnapshot) : "기록 없음"}
                          </p>
                          <p className="mt-1 text-[13px] text-[#403A49]">
                            {cancelWindowLabel(item.cancelWindowSnapshot)}
                          </p>
                          <p className="mt-1 text-[12px] text-[#6B6570]">
                            판정 기준 {item.cancelWindowPolicyVersion ?? "기록 없음"}
                          </p>
                        </>
                      ) : (
                        <p className="mt-1 text-[13px] text-[#403A49]">
                          제작 착수{" "}
                          {item.productionStartedAtSnapshot
                            ? formatDate(item.productionStartedAtSnapshot)
                            : "기록 없음"}
                        </p>
                      )}
                    </div>
                    <div className="rounded-xl border border-[#d4c8ba] bg-white p-3">
                      <p className="text-[12px] font-bold text-[#5c3d2e]">현재 값</p>
                      {isConsultation ? (
                        <>
                          <p className="mt-1 text-[13px] text-[#403A49]">
                            예약{" "}
                            {item.consultation?.scheduledAt
                              ? formatDate(item.consultation.scheduledAt)
                              : "기록 없음"}
                          </p>
                          <p className="mt-1 text-[13px] text-[#403A49]">
                            상담 진행 {item.consultation?.status ?? "상담 기록 없음"}
                          </p>
                        </>
                      ) : (
                        <p className="mt-1 text-[13px] text-[#403A49]">
                          제작 착수{" "}
                          {item.order.productionStartedAt
                            ? formatDate(item.order.productionStartedAt)
                            : "기록 없음"}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-[#6B6570]">
                    기록 없음은 &ldquo;제작 전&rdquo;이 아니라 기록이 남지 않았다는 뜻입니다. 위 값은
                    판단에 참고할 기록이며 환불 가능 여부를 서버가 정한 것이 아닙니다.
                  </p>

                  {item.decidedAt || item.handledBy ? (
                    <p className="mt-2 text-[12px] text-[#6B6570]">
                      처리 {item.decidedAt ? formatDate(item.decidedAt) : "-"} ·{" "}
                      {item.handledBy ?? "-"}
                    </p>
                  ) : null}

                  {item.status === "requested" || item.status === "reviewing" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.status === "requested" ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            handleTransitionRefund(
                              item,
                              "reviewing",
                              "이 환불 문의를 검토 중으로 바꾸시겠습니까?",
                            )
                          }
                          className="min-h-11 rounded-lg border border-[#d4c8ba] bg-white px-4 text-[14px] font-semibold text-[#5c3d2e] disabled:opacity-50"
                        >
                          검토 시작
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            handleTransitionRefund(
                              item,
                              "approved",
                              "환불을 승인하시겠습니까?\n\n승인 후 실제 결제 취소는 별도 처리됩니다. 이 버튼만으로는 돈이 돌아가지 않습니다.",
                            )
                          }
                          className="min-h-11 rounded-lg bg-[#5c3d2e] px-4 text-[14px] font-semibold text-white disabled:opacity-50"
                        >
                          환불 승인
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          handleTransitionRefund(
                            item,
                            "rejected",
                            "이 환불 문의를 거절하시겠습니까?\n\n거절한 뒤에는 되돌릴 수 없습니다.",
                          )
                        }
                        className="min-h-11 rounded-lg border border-[#d4c8ba] bg-white px-4 text-[14px] font-semibold text-[#5c3d2e] disabled:opacity-50"
                      >
                        거절
                      </button>
                    </div>
                  ) : null}
                  {item.status === "approved" ? (
                    <>
                      <p className="mt-3 rounded-xl bg-[#f5efe6] p-3 text-[13px] leading-relaxed text-[#5c3d2e]">
                        환불이 승인되었습니다. 실제 결제 취소는 아직 처리되지 않았으며 별도로
                        진행해야 합니다.
                      </p>
                      {actions.execute ? (
                        <div className="mt-3">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleExecuteRefund(item)}
                            className="min-h-11 rounded-lg bg-[#5c3d2e] px-4 text-[14px] font-semibold text-white disabled:opacity-50"
                          >
                            {busy ? "실행 중..." : "실제 환불 실행"}
                          </button>
                          <p className="mt-2 text-[12px] leading-relaxed text-[#6B6570]">
                            결제사에 전액취소를 요청합니다. 되돌릴 수 없습니다.
                          </p>
                        </div>
                      ) : null}
                      {actions.recover ? (
                        <div className="mt-3">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleRecoverRefund(item)}
                            className="min-h-11 rounded-lg border border-[#d4c8ba] bg-white px-4 text-[14px] font-semibold text-[#5c3d2e] disabled:opacity-50"
                          >
                            {busy ? "확인 중..." : "결제 상태 확인"}
                          </button>
                          <p className="mt-2 text-[12px] leading-relaxed text-[#6B6570]">
                            결제사에 취소를 다시 요청하지 않습니다. 지금 거래 상태만 조회해 기록을
                            맞춥니다.
                          </p>
                        </div>
                      ) : null}
                      {actions.notice ? (
                        <p className="mt-3 text-[13px] leading-relaxed text-[#8a5a3b]">
                          {actions.notice}
                        </p>
                      ) : null}
                    </>
                  ) : null}
                  {pointsView.visible ? (
                    <div className="mt-3 rounded-xl bg-[#f5efe6] p-3">
                      <p className="text-[13px] font-semibold text-[#5c3d2e]">{pointsView.label}</p>
                      {pointsView.retry ? (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleRestorePoints(item)}
                            className="mt-2 min-h-11 rounded-lg border border-[#d4c8ba] bg-white px-4 text-[14px] font-semibold text-[#5c3d2e] disabled:opacity-50"
                          >
                            {busy ? "복원 중..." : "적립금 복원 재시도"}
                          </button>
                          <p className="mt-2 text-[12px] leading-relaxed text-[#6B6570]">
                            기록이 없다고 해서 복원이 필요한 주문은 아닙니다. 적립금을 쓰지 않은
                            주문일 수도 있습니다. 눌러도 결제사에 환불을 다시 요청하지 않습니다.
                          </p>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                  {refundMessage[item.id] ? (
                    <p className="mt-2 text-[13px] text-[#8a5a3b]">{refundMessage[item.id]}</p>
                  ) : null}
                </article>
              );
            })
          ) : refundRequests.loaded ? (
            <p className="rounded-2xl bg-white p-4 text-[14px] leading-relaxed text-[#6B6570] ring-1 ring-[#ebe3d8]">
              접수된 환불 문의가 없습니다.
            </p>
          ) : (
            /* 읽지 못한 것을 0건처럼 보여주지 않는다. */
            <p className="rounded-2xl bg-white p-4 text-[14px] leading-relaxed text-[#8a5a3b] ring-1 ring-[#ebe3d8]">
              환불 문의를 불러오지 못했습니다. 새로고침 후 다시 확인해 주세요.
            </p>
          )
        ) : null}

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

        {tab === "chat" ? (
          <div className="space-y-3">
            {chatLoading ? (
              <p className="text-[14px] text-[#6B6570]">문의 목록을 불러오는 중...</p>
            ) : null}
            {chatError ? (
              <div className="rounded-2xl bg-[#fdf2f2] px-4 py-3 text-[14px] text-[#b42318]">
                {chatError}
              </div>
            ) : null}

            {selectedChatThread ? (
              // 상세. 폭이 좁은 관리자 셸이라 목록 대신 대화만 보여 준다.
              <section className="space-y-3">
                <button
                  type="button"
                  onClick={() => setSelectedChatId("")}
                  className="text-[14px] font-medium text-[#6B6570]"
                >
                  ← 문의 목록
                </button>

                <div className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
                  <p className="text-[16px] font-bold text-[#403A49]">
                    {selectedChatThread.name || "이름 없음"}
                  </p>
                  <p className="mt-1 text-[14px] text-[#5c3d2e]">
                    {selectedChatThread.phone || "-"} · {selectedChatThread.contactMethod}
                  </p>
                  <p className="mt-1 text-[13px] text-[#6B6570]">
                    {chatStatusLabel(selectedChatThread.status)} · 최근 대화{" "}
                    {formatDate(selectedChatThread.lastMessageAt)}
                  </p>

                  <div className="mt-3 flex gap-2">
                    {CHAT_STATUS_OPTIONS.map((option) => {
                      const active = selectedChatThread.status === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          disabled={active || chatStatusSaving}
                          onClick={() => handleUpdateChatStatus(selectedChatThread.id, option.value)}
                          className={`h-10 flex-1 rounded-xl border text-[14px] font-medium disabled:opacity-60 ${
                            active
                              ? "border-[#403A49] bg-[#403A49] text-white"
                              : "border-[#d4c8ba] bg-white text-[#5c3d2e]"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 불만으로 기록. 대화 내용을 옮겨 적지 않고 상담원이 요지만 정리한다. */}
                <div className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
                  <p className="text-[15px] font-bold text-[#403A49]">불만으로 기록</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-[#6B6570]">
                    실제 불만·분쟁으로 판단한 경우에만 남깁니다. 대화 전문이 아니라 요지만 적어 주세요.
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {COMPLAINT_CATEGORY_OPTIONS.map((option) => {
                      const active = complaintCategory === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setComplaintCategory(option.value)}
                          aria-pressed={active}
                          className={`h-10 rounded-xl border text-[14px] font-medium ${
                            active
                              ? "border-[#403A49] bg-[#403A49] text-white"
                              : "border-[#d4c8ba] bg-white text-[#5c3d2e]"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <textarea
                    value={complaintSummary}
                    maxLength={COMPLAINT_SUMMARY_MAX}
                    onChange={(event) => setComplaintSummary(event.target.value)}
                    rows={3}
                    placeholder="어떤 요구가 있었고 어떻게 처리할지 요지만 적어 주세요"
                    className="mt-3 w-full resize-none rounded-xl border border-[#d4c8ba] bg-white px-3 py-2 text-[15px] leading-relaxed text-[#3d2b1f] outline-none focus:border-[#5c3d2e]"
                  />
                  <p className="mt-1 text-right text-[12px] text-[#6B6570]">
                    {complaintSummary.length}/{COMPLAINT_SUMMARY_MAX}
                  </p>
                  {complaintError ? (
                    <p className="mt-2 text-[14px] text-[#b42318]">{complaintError}</p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleCreateComplaint("chat", null)}
                    disabled={complaintSummary.trim().length === 0 || complaintSaving}
                    className="mt-3 h-11 w-full rounded-xl border border-[#403A49] bg-white text-[15px] font-semibold text-[#403A49] disabled:opacity-40"
                  >
                    {complaintSaving ? "기록 중…" : "불만으로 기록"}
                  </button>
                </div>

                <div className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
                  {chatDetailLoading ? (
                    <p className="text-[14px] text-[#6B6570]">대화를 불러오는 중...</p>
                  ) : null}
                  {chatDetailError ? (
                    <p className="text-[14px] text-[#b42318]">{chatDetailError}</p>
                  ) : null}
                  {!chatDetailLoading && !chatDetailError && selectedChatMessages.length === 0 ? (
                    <p className="text-[14px] text-[#6B6570]">아직 메시지가 없습니다.</p>
                  ) : null}

                  {selectedChatMessages.map((message) =>
                    message.sender === "agent" ? (
                      <div key={message.id} className="flex flex-col items-end">
                        <p className="text-[12px] font-bold text-[#6B6570]">👤 사주로그 상담원</p>
                        <p className="mt-1 max-w-[85%] whitespace-pre-line rounded-2xl rounded-tr-md bg-[#403A49] px-4 py-3 text-[15px] leading-relaxed text-white [overflow-wrap:anywhere]">
                          {message.body}
                        </p>
                        <p className="mt-1 text-[12px] text-[#6B6570]">
                          {formatDate(message.createdAt)}
                        </p>
                      </div>
                    ) : (
                      <div key={message.id} className="flex flex-col items-start">
                        <p className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-tl-md bg-[#f5efe6] px-4 py-3 text-[15px] leading-relaxed text-[#403A49] [overflow-wrap:anywhere]">
                          {message.body}
                        </p>
                        <p className="mt-1 text-[12px] text-[#6B6570]">
                          {formatDate(message.createdAt)}
                        </p>
                      </div>
                    ),
                  )}
                </div>

                {selectedChatThread.status === "closed" ? (
                  <div className="rounded-2xl bg-[#f5efe6] px-4 py-4 text-[14px] leading-relaxed text-[#8b6f5c]">
                    상담이 종료된 문의입니다.
                    <br />
                    답변하려면 위에서 상태를 &ldquo;상담 중&rdquo;으로 먼저 변경해 주세요.
                  </div>
                ) : (
                  <div className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
                    <textarea
                      value={chatReply}
                      maxLength={1000}
                      onChange={(event) => setChatReply(event.target.value)}
                      rows={3}
                      placeholder="고객에게 보낼 답변을 입력하세요"
                      className="w-full resize-none rounded-xl border border-[#d4c8ba] bg-white px-3 py-2 text-[15px] leading-relaxed text-[#3d2b1f] outline-none focus:border-[#5c3d2e]"
                    />
                    {chatReplyError ? (
                      <p className="mt-2 text-[14px] text-[#b42318]">{chatReplyError}</p>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleSendChatReply}
                      disabled={chatReply.trim().length === 0 || chatReplySending}
                      className="mt-3 h-11 w-full rounded-xl bg-[#403A49] text-[15px] font-semibold text-white disabled:opacity-40"
                    >
                      {chatReplySending ? "전송 중…" : "답변 보내기"}
                    </button>
                  </div>
                )}
              </section>
            ) : (
              <>
                {chatThreads.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openChatThread(item.id)}
                    className="w-full rounded-2xl bg-white p-4 text-left ring-1 ring-[#ebe3d8]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[16px] font-bold text-[#403A49]">
                        {item.name || "이름 없음"}
                      </p>
                      <span className="shrink-0 rounded-full bg-[#f5efe6] px-2 py-1 text-[12px] font-medium text-[#5c3d2e]">
                        {chatStatusLabel(item.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-[14px] text-[#5c3d2e]">
                      {item.phone || "-"} · {item.contactMethod}
                    </p>
                    {item.lastMessageBody ? (
                      <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-[#5c3d2e]">
                        {item.lastMessageSender === "agent" ? "상담원: " : ""}
                        {item.lastMessageBody}
                      </p>
                    ) : null}
                    <p className="mt-2 text-[13px] text-[#6B6570]">
                      {formatDate(item.lastMessageAt)}
                    </p>
                  </button>
                ))}

                {chatItems.length > 0 ? (
                  <>
                    <p className="pt-2 text-[13px] font-semibold text-[#6B6570]">
                      이전 문의 (읽기 전용)
                    </p>
                    {chatItems.map((item) => {
                      const member = userMap.get(item.userId ?? "");
                      return (
                        <article
                          key={item.id}
                          className="rounded-2xl bg-[#faf8f5] p-4 ring-1 ring-[#ebe3d8]"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[16px] font-bold text-[#403A49]">
                              {item.name || member?.name || "이름 없음"}
                            </p>
                            <span className="shrink-0 rounded-full bg-[#ebe3d8] px-2 py-1 text-[12px] font-medium text-[#6B6570]">
                              읽기 전용
                            </span>
                          </div>
                          <p className="mt-1 text-[14px] text-[#5c3d2e]">
                            {item.phone || member?.phone || "-"} · {item.method}
                          </p>
                          <p className="mt-2 text-[14px] leading-relaxed text-[#5c3d2e]">
                            {item.message}
                          </p>
                          <p className="mt-2 text-[13px] text-[#6B6570]">
                            {item.product} · {formatDate(item.createdAt)}
                          </p>
                        </article>
                      );
                    })}
                  </>
                ) : null}
              </>
            )}

            {/* 불만·분쟁 기록. 이름·연락처·대화 전문·금액은 담지 않는다. */}
            <section className="space-y-2 pt-2">
              <p className="text-[13px] font-semibold text-[#6B6570]">불만·분쟁 기록</p>
              {!complaintRecords.loaded ? (
                <p className="rounded-2xl bg-[#fdf2f2] px-4 py-3 text-[14px] text-[#b42318]">
                  기록을 불러오지 못했습니다. 새로고침 후 다시 확인해 주세요.
                </p>
              ) : complaintRecords.items.length === 0 ? (
                <p className="rounded-2xl bg-white px-4 py-3 text-[14px] text-[#6B6570] ring-1 ring-[#ebe3d8]">
                  아직 기록이 없습니다.
                </p>
              ) : (
                complaintRecords.items.map((item) => (
                  <article key={item.id} className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[15px] font-bold text-[#403A49]">
                        {complaintCategoryLabel(item.category)}
                      </p>
                      <span className="shrink-0 rounded-full bg-[#f5efe6] px-2 py-1 text-[12px] font-medium text-[#5c3d2e]">
                        {item.status === "handled" ? "처리 완료" : "처리 중"}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-[#5c3d2e]">
                      {item.summary}
                    </p>
                    <p className="mt-2 text-[13px] text-[#6B6570]">
                      {item.sourceType} · 접수 {formatDate(item.createdAt)}
                      {item.handledAt ? ` · 완료 ${formatDate(item.handledAt)}` : ""}
                    </p>
                    {item.status === "open" ? (
                      <button
                        type="button"
                        onClick={() => handleMarkComplaintHandled(item.id)}
                        disabled={complaintSaving}
                        className="mt-3 h-10 w-full rounded-xl border border-[#d4c8ba] bg-white text-[14px] font-semibold text-[#5c3d2e] disabled:opacity-40"
                      >
                        처리 완료
                      </button>
                    ) : null}
                  </article>
                ))
              )}
            </section>
          </div>
        ) : null}

        {tab === "schedule" ? (
          <>
            {teachers.length > 0 ? (
              <div className="mb-3 grid grid-cols-3 gap-2">
                {teachers.map((item) => {
                  const active = teacher === item.name;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTeacher(item.name)}
                      aria-pressed={active}
                      className={`h-11 rounded-xl px-2 text-[13px] font-semibold ${
                        active
                          ? "bg-[#5c3d2e] text-white"
                          : "border border-[#d4c8ba] bg-white text-[#5c3d2e]"
                      }`}
                    >
                      {item.name}
                    </button>
                  );
                })}
              </div>
            ) : null}
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
