import { NextResponse } from "next/server";
import {
  clearAdminSession,
  getAdminPassword,
  isAdminAuthenticated,
  setAdminAuthenticated,
} from "@/lib/server/adminSession";
import { nowId, readData, writeData } from "@/lib/server/store";
import {
  DEFAULT_TEACHER,
  CONSULT_TIMES,
  toggleBlockedSlot,
  upcomingConsultDates,
  listSlotStatuses,
} from "@/lib/server/consultationSlots";
import type { ConsultStatus, OrderStatus } from "@/lib/types/app";

const ORDER_STATUSES: OrderStatus[] = ["신청접수", "상담진행", "제작중", "완성/전달", "완료"];
const CONSULT_STATUSES: ConsultStatus[] = ["상담 신청", "사주정보 입력", "선생님과 1:1 상담", "상담 완료"];

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  const data = await readData();
  return NextResponse.json({
    users: data.users,
    orders: data.orders,
    consultations: data.consultations,
    inquiries: data.inquiries ?? [],
    reviews: data.reviews ?? [],
    blockedSlots: data.blockedSlots ?? [],
    dates: upcomingConsultDates(),
    times: CONSULT_TIMES,
    teacher: DEFAULT_TEACHER,
    adminPromo: data.adminPromo ?? null,
    coupons: data.coupons ?? {},
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const action = String(body.action ?? "");

  if (action === "login") {
    const password = String(body.password ?? "");
    if (password !== getAdminPassword()) {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
    }
    await setAdminAuthenticated();
    return NextResponse.json({ ok: true });
  }

  if (action === "logout") {
    await clearAdminSession();
    return NextResponse.json({ ok: true });
  }

  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  if (action === "toggleBlockSlot") {
    const data = await readData();
    const teacher = String(body.teacher ?? DEFAULT_TEACHER);
    const date = String(body.date ?? "");
    const time = String(body.time ?? "");
    if (!date || !CONSULT_TIMES.includes(time)) {
      return NextResponse.json({ error: "날짜와 시간을 확인해 주세요." }, { status: 400 });
    }
    data.blockedSlots = toggleBlockedSlot(data, teacher, date, time);
    await writeData(data);
    return NextResponse.json({
      ok: true,
      slots: listSlotStatuses(data, teacher, date),
    });
  }

  if (action === "generateAdminPromo") {
    const percent = Math.floor(Number(body.percent));
    if (!Number.isFinite(percent) || percent < 1 || percent > 90) {
      return NextResponse.json({ error: "할인율은 1%부터 90%까지 선택할 수 있습니다." }, { status: 400 });
    }
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let tail = "";
    for (let i = 0; i < 6; i += 1) {
      tail += chars[Math.floor(Math.random() * chars.length)];
    }
    const data = await readData();
    data.adminPromo = {
      code: `AD${tail}`,
      percent,
      createdAt: new Date().toISOString(),
    };
    await writeData(data);
    return NextResponse.json({ ok: true, adminPromo: data.adminPromo });
  }

  if (action === "adjustPoints") {
    const userId = String(body.userId ?? "");
    const amount = Math.floor(Number(body.amount));
    const direction = String(body.direction ?? "");
    if (!userId) {
      return NextResponse.json({ error: "회원을 확인해 주세요." }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount < 1 || amount > 10000000) {
      return NextResponse.json({ error: "적립금 금액을 확인해 주세요." }, { status: 400 });
    }
    if (direction !== "add" && direction !== "subtract") {
      return NextResponse.json({ error: "지급 또는 차감을 선택해 주세요." }, { status: 400 });
    }
    const data = await readData();
    const user = data.users.find((item) => item.id === userId);
    if (!user) {
      return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
    }
    const current = user.points ?? 0;
    user.points = direction === "add" ? current + amount : Math.max(0, current - amount);
    await writeData(data);
    return NextResponse.json({ ok: true, user });
  }

  if (action === "giveCoupon") {
    const userId = String(body.userId ?? "");
    const product = String(body.product ?? "") as
      | "story"
      | "premium"
      | "saju-song"
      | "consultation";
    const titles: Record<typeof product, string> = {
      story: "이야기로 만드는 인생곡",
      premium: "프리미엄 인생곡",
      "saju-song": "사주 인생곡",
      consultation: "1:1 사주상담",
    };
    if (!userId) {
      return NextResponse.json({ error: "회원을 확인해 주세요." }, { status: 400 });
    }
    if (!titles[product]) {
      return NextResponse.json({ error: "무료로 줄 상품을 선택해 주세요." }, { status: 400 });
    }
    const data = await readData();
    const user = data.users.find((item) => item.id === userId);
    if (!user) {
      return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
    }
    const productTitle = titles[product];
    const next = [
      {
        id: nowId(),
        title: `${productTitle} 무료 쿠폰`,
        desc: `이 쿠폰으로 ${productTitle}을 무료로 신청할 수 있습니다.`,
        product,
        createdAt: new Date().toISOString(),
      },
      ...(data.coupons[userId] ?? []),
    ];
    data.coupons[userId] = next;
    data.notifications[userId] = [
      {
        id: nowId(),
        title: "무료 쿠폰이 도착했습니다",
        body: `이 쿠폰으로 ${productTitle}을 무료로 신청할 수 있습니다. MY 쿠폰함에서 확인해 주세요.`,
        createdAt: new Date().toISOString(),
        read: false,
        kind: "coupon",
      },
      ...(data.notifications[userId] ?? []),
    ];
    await writeData(data);
    return NextResponse.json({ ok: true, userId, coupons: next });
  }

  if (action === "notifyPromoCode") {
    const userId = String(body.userId ?? "");
    if (!userId) {
      return NextResponse.json({ error: "회원을 확인해 주세요." }, { status: 400 });
    }
    const data = await readData();
    const user = data.users.find((item) => item.id === userId);
    if (!user) {
      return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
    }
    if (!data.adminPromo?.code) {
      return NextResponse.json({ error: "먼저 코드를 만들어 주세요." }, { status: 400 });
    }
    data.notifications[userId] = [
      {
        id: nowId(),
        title: "할인 코드가 도착했습니다",
        body: `결제할 때 ${data.adminPromo.code}를 넣으면 ${data.adminPromo.percent}% 할인됩니다.`,
        createdAt: new Date().toISOString(),
        read: false,
        kind: "promo",
      },
      ...(data.notifications[userId] ?? []),
    ];
    await writeData(data);
    return NextResponse.json({ ok: true });
  }

  if (action === "updateOrderStatus") {
    const id = String(body.id ?? "");
    const status = String(body.status ?? "") as OrderStatus;
    if (!id) {
      return NextResponse.json({ error: "주문을 확인해 주세요." }, { status: 400 });
    }
    if (!ORDER_STATUSES.includes(status)) {
      return NextResponse.json({ error: "진행 상태를 확인해 주세요." }, { status: 400 });
    }
    const data = await readData();
    const order = data.orders.find((item) => item.id === id);
    if (!order) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }
    order.status = status;
    if (data.notificationSettings[order.userId]?.order !== false) {
      data.notifications[order.userId] = [
        {
          id: nowId(),
          title: `주문 상태가 ${status}로 바뀌었습니다`,
          body:
            status === "완성/전달" || status === "완료"
              ? `${order.title} 진행이 ${status}입니다. MY에서 후기를 남기실 수 있습니다.`
              : `${order.title} 진행이 ${status}입니다.`,
          createdAt: new Date().toISOString(),
          read: false,
        },
        ...(data.notifications[order.userId] ?? []),
      ];
    }
    await writeData(data);
    return NextResponse.json({ ok: true, order });
  }

  if (action === "updateConsultationStatus") {
    const id = String(body.id ?? "");
    const status = String(body.status ?? "") as ConsultStatus;
    if (!id) {
      return NextResponse.json({ error: "사주상담을 확인해 주세요." }, { status: 400 });
    }
    if (!CONSULT_STATUSES.includes(status)) {
      return NextResponse.json({ error: "진행 상태를 확인해 주세요." }, { status: 400 });
    }
    const data = await readData();
    const item = data.consultations.find((consult) => consult.id === id);
    if (!item) {
      return NextResponse.json({ error: "사주상담을 찾을 수 없습니다." }, { status: 404 });
    }
    item.status = status;
    if (data.notificationSettings[item.userId]?.consult !== false) {
      data.notifications[item.userId] = [
        {
          id: nowId(),
          title: `사주상담 상태가 ${status}로 바뀌었습니다`,
          body:
            status === "상담 완료"
              ? `${item.teacher} · ${item.datetime}. MY에서 후기를 남기실 수 있습니다.`
              : `${item.teacher} · ${item.datetime}`,
          createdAt: new Date().toISOString(),
          read: false,
        },
        ...(data.notifications[item.userId] ?? []),
      ];
    }
    await writeData(data);
    return NextResponse.json({ ok: true, consultation: item });
  }

  if (action === "toggleReviewVisible") {
    const id = String(body.id ?? "");
    const visible = Boolean(body.visible);
    if (!id) {
      return NextResponse.json({ error: "후기를 확인해 주세요." }, { status: 400 });
    }
    const data = await readData();
    const review = (data.reviews ?? []).find((item) => item.id === id);
    if (!review) {
      return NextResponse.json({ error: "후기를 찾을 수 없습니다." }, { status: 404 });
    }
    review.visible = visible;
    await writeData(data);
    return NextResponse.json({ ok: true, review });
  }

  return NextResponse.json({ error: "알 수 없는 요청입니다." }, { status: 400 });
}
