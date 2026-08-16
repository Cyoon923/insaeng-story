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
    const title = String(body.title ?? "").trim();
    const desc = String(body.desc ?? "").trim();
    if (!userId) {
      return NextResponse.json({ error: "회원을 확인해 주세요." }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: "쿠폰 이름을 입력해 주세요." }, { status: 400 });
    }
    const data = await readData();
    const user = data.users.find((item) => item.id === userId);
    if (!user) {
      return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
    }
    const next = [
      {
        id: nowId(),
        title,
        desc,
        createdAt: new Date().toISOString(),
      },
      ...(data.coupons[userId] ?? []),
    ];
    data.coupons[userId] = next;
    await writeData(data);
    return NextResponse.json({ ok: true, userId, coupons: next });
  }

  return NextResponse.json({ error: "알 수 없는 요청입니다." }, { status: 400 });
}
