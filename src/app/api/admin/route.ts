import { NextResponse } from "next/server";
import {
  clearAdminSession,
  getAdminPassword,
  isAdminAuthenticated,
  setAdminAuthenticated,
} from "@/lib/server/adminSession";
import {
  isAppStoreConflict,
  nowId,
  readData,
  writeData,
  writeDataWithOrderStatus,
  listAllOrders,
  listPaymentsNeedingReview,
  getOrderById,
} from "@/lib/server/store";
import {
  DEFAULT_TEACHER,
  CONSULT_TEACHERS,
  CONSULT_TIMES,
  toggleBlockedSlot,
  upcomingConsultDates,
  listSlotStatuses,
} from "@/lib/server/consultationSlots";
import {
  applyConsultationCompletion,
  deliveredAtForStatus,
} from "@/lib/server/serviceCompletion";
import type { ConsultStatus, OrderStatus } from "@/lib/types/app";

const ORDER_STATUSES: OrderStatus[] = ["신청접수", "상담진행", "제작중", "완성/전달", "완료"];
const CONSULT_STATUSES: ConsultStatus[] = ["상담 신청", "사주정보 입력", "선생님과 1:1 상담", "상담 완료"];

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  const data = await readData();
  // 결제 기록은 DATABASE_URL이 있어야 읽을 수 있다. 없으면 관리자 화면 전체가
  // 깨지지 않도록 빈 목록으로 둔다. 조회 전용이라 실패해도 부작용이 없다.
  let paymentsNeedingReview: Awaited<ReturnType<typeof listPaymentsNeedingReview>> = {
    stale: [],
    unlinked: [],
  };
  try {
    paymentsNeedingReview = await listPaymentsNeedingReview();
  } catch {
    paymentsNeedingReview = { stale: [], unlinked: [] };
  }

  return NextResponse.json({
    users: data.users,
    paymentsNeedingReview,
    orders: await listAllOrders(),
    consultations: data.consultations,
    inquiries: data.inquiries ?? [],
    reviews: data.reviews ?? [],
    blockedSlots: data.blockedSlots ?? [],
    dates: upcomingConsultDates(),
    times: CONSULT_TIMES,
    teacher: DEFAULT_TEACHER,
    // 일정 화면에서 선생님을 고를 수 있도록 목록도 함께 내려준다.
    // 기존 teacher 필드는 그대로 두어 지금 화면이 그대로 동작한다.
    teachers: CONSULT_TEACHERS,
    adminPromo: data.adminPromo ?? null,
    coupons: data.coupons ?? {},
  });
}

export async function POST(request: Request) {
  try {
    return await handlePost(request);
  } catch (error) {
    // 다른 요청과 겹쳐 저장되지 않은 경우. 관리자가 적용 여부를 오해하지 않도록 분명히 알린다.
    if (isAppStoreConflict(error)) {
      console.warn("[admin] store conflict");
      return NextResponse.json(
        { error: "다른 요청과 겹쳐 변경사항이 적용되지 않았습니다. 다시 시도해 주세요." },
        { status: 409 },
      );
    }
    throw error;
  }
}

async function handlePost(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const action = String(body.action ?? "");

  if (action === "login") {
    // ADMIN_PASSWORD가 설정되어 있지 않으면 기본 비밀번호로 대체하지 않고 거부한다.
    const adminPassword = getAdminPassword();
    if (!adminPassword) {
      return NextResponse.json({ error: "관리자 로그인을 사용할 수 없습니다." }, { status: 503 });
    }
    const password = String(body.password ?? "");
    if (password !== adminPassword) {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
    }
    if (!(await setAdminAuthenticated())) {
      return NextResponse.json({ error: "관리자 로그인을 사용할 수 없습니다." }, { status: 503 });
    }
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
    // 조회 기준은 목록(listAllOrders)과 같은 orders 테이블로 통일한다.
    // JSONB에만 남아 있던 주문 때문에 목록에는 보이는데 404가 나던 문제를 막는다.
    const found = await getOrderById(id);
    if (!found) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }
    const order = { ...found, status };

    const data = await readData();
    // 이중 기록(dual-write)을 유지한다. JSONB에도 같은 주문이 있으면 함께 맞춰 둔다.
    const mirrored = data.orders.find((item) => item.id === id);
    if (mirrored) {
      mirrored.status = status;
      /*
       * 결과물을 처음 전달한 시각을 남긴다 (Privacy-Retention-Completion-Evidence-1).
       *
       * 개인정보 보관 기간의 기산점이라 한 번만 기록하고 절대 덮어쓰지 않는다.
       * 상태가 "완료"로 더 간다고 해서 기산점이 뒤로 밀리면 안 된다.
       * 어느 상태에서 남기는지는 serviceCompletion 한 곳이 정한다.
       *
       * JSONB에만 남긴다. orders 테이블에 같은 뜻의 열을 만들지 않는다.
       * 만들면 일반 주문 조회 경로가 그 열을 읽게 되고, 관리자가 정리를 부르기도
       * 전에 스키마 변경이 일반 요청에서 일어난다.
       */
      const deliveredAt = deliveredAtForStatus(status, new Date().toISOString());
      if (deliveredAt && !mirrored.deliveredAt) mirrored.deliveredAt = deliveredAt;
    }
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
    await writeDataWithOrderStatus(data, order.id, status);
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
    /*
     * 상담이 끝난 시각을 남긴다 (Privacy-Retention-Completion-Evidence-1).
     * 최초 1회만 기록하고 덮어쓰지 않는다. 규칙은 serviceCompletion 한 곳이 정한다.
     * 상담은 전용 테이블이 없어 원래 JSONB만 쓴다. 새 열을 만들지 않는다.
     */
    applyConsultationCompletion(item, status, new Date().toISOString());
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
