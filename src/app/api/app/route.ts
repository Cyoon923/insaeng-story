import { NextResponse } from "next/server";
import { clearUserId, getUserId, setUserId } from "@/lib/server/session";
import { formatPhone, normalizePhone, normalizeEmail, isValidEmail, emailCodeKey, nowId, readData, writeData } from "@/lib/server/store";
import { isSlotAvailable, parseDatetime } from "@/lib/server/consultationSlots";
import type { Consultation, Coupon, Inquiry, Order, User } from "@/lib/types/app";

function emptyUser(phone = "", name = "", email = ""): User {
  return {
    id: nowId(),
    phone: phone ? formatPhone(phone) : "",
    email: email ? normalizeEmail(email) : "",
    name,
    gender: "",
    birth: "",
    birthTime: "",
    unknownTime: false,
    calendar: "solar",
    bloodType: "",
    createdAt: new Date().toISOString(),
  };
}

function welcomeCoupon(): Coupon {
  return {
    id: nowId(),
    title: "첫 방문 안내",
    desc: "신청과 상담 진행을 우선 안내해 드립니다.",
    createdAt: new Date().toISOString(),
  };
}

export async function GET() {
  const userId = await getUserId();
  const data = await readData();
  if (!userId) {
    return NextResponse.json({ user: null });
  }
  const user = data.users.find((item) => item.id === userId) ?? null;
  if (!user) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({
    user,
    orders: data.orders.filter((item) => item.userId === userId),
    consultations: data.consultations.filter((item) => item.userId === userId),
    inquiries: (data.inquiries ?? []).filter((item) => item.userId === userId),
    wishlist: data.wishlists[userId] ?? [],
    coupons: data.coupons[userId] ?? [],
    notifications: data.notifications[userId] ?? [],
    notificationSettings: data.notificationSettings[userId] ?? {
      order: true,
      consult: true,
      notice: false,
    },
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const action = String(body.action ?? "");
  const data = await readData();

  if (action === "sendCode") {
    const channel = String(body.channel ?? "phone");
    const code = String(Math.floor(100000 + Math.random() * 900000));

    if (channel === "email") {
      const email = normalizeEmail(String(body.email ?? ""));
      if (!isValidEmail(email)) {
        return NextResponse.json({ error: "이메일을 확인해 주세요." }, { status: 400 });
      }
      data.codes[emailCodeKey(email)] = { code, expiresAt: Date.now() + 5 * 60 * 1000 };
      await writeData(data);
      return NextResponse.json({ ok: true, code });
    }

    const phone = normalizePhone(String(body.phone ?? ""));
    if (phone.length < 10) {
      return NextResponse.json({ error: "연락처를 확인해 주세요." }, { status: 400 });
    }
    data.codes[phone] = { code, expiresAt: Date.now() + 5 * 60 * 1000 };
    await writeData(data);
    return NextResponse.json({ ok: true, code });
  }

  if (action === "login" || action === "kakao" || action === "naver") {
    const channel = String(body.channel ?? "phone");

    if (action === "login" && channel === "email") {
      const email = normalizeEmail(String(body.email ?? ""));
      if (!isValidEmail(email)) {
        return NextResponse.json({ error: "이메일을 입력해 주세요." }, { status: 400 });
      }
      const saved = data.codes[emailCodeKey(email)];
      const code = String(body.code ?? "");
      if (!saved || saved.expiresAt < Date.now() || saved.code !== code) {
        return NextResponse.json({ error: "인증번호가 올바르지 않습니다." }, { status: 400 });
      }
      delete data.codes[emailCodeKey(email)];

      let user = data.users.find((item) => normalizeEmail(item.email) === email);
      if (!user) {
        user = emptyUser("", "", email);
        data.users.push(user);
        data.coupons[user.id] = [welcomeCoupon()];
        data.wishlists[user.id] = [];
        data.notifications[user.id] = [];
        data.notificationSettings[user.id] = { order: true, consult: true, notice: false };
      }
      await writeData(data);
      await setUserId(user.id);
      return NextResponse.json({ ok: true, user });
    }

    const phone = normalizePhone(String(body.phone ?? ""));
    if (phone.length < 10) {
      return NextResponse.json({ error: "연락처를 입력해 주세요." }, { status: 400 });
    }
    if (action === "login") {
      const saved = data.codes[phone];
      const code = String(body.code ?? "");
      if (!saved || saved.expiresAt < Date.now() || saved.code !== code) {
        return NextResponse.json({ error: "인증번호가 올바르지 않습니다." }, { status: 400 });
      }
      delete data.codes[phone];
    }
    let user = data.users.find((item) => normalizePhone(item.phone) === phone);
    if (!user) {
      const socialName =
        action === "kakao" ? "카카오 회원" : action === "naver" ? "네이버 회원" : "";
      user = emptyUser(phone, socialName);
      data.users.push(user);
      data.coupons[user.id] = [welcomeCoupon()];
      data.wishlists[user.id] = [];
      data.notifications[user.id] = [];
      data.notificationSettings[user.id] = { order: true, consult: true, notice: false };
    }
    await writeData(data);
    await setUserId(user.id);
    return NextResponse.json({ ok: true, user });
  }

  if (action === "logout") {
    await clearUserId();
    return NextResponse.json({ ok: true });
  }

  if (action === "ensureUser") {
    const phone = normalizePhone(String(body.phone ?? ""));
    const name = String(body.name ?? "");
    if (phone.length < 10) {
      return NextResponse.json({ error: "연락처를 입력해 주세요." }, { status: 400 });
    }
    let user = data.users.find((item) => normalizePhone(item.phone) === phone);
    if (!user) {
      user = emptyUser(phone, name);
      data.users.push(user);
      data.coupons[user.id] = [welcomeCoupon()];
      data.wishlists[user.id] = [];
      data.notifications[user.id] = [];
      data.notificationSettings[user.id] = { order: true, consult: true, notice: false };
    } else if (name && !user.name) {
      user = { ...user, name };
      data.users = data.users.map((item) => (item.id === user!.id ? user! : item));
    }
    await writeData(data);
    await setUserId(user.id);
    return NextResponse.json({ ok: true, user });
  }

  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const user = data.users.find((item) => item.id === userId);
  if (!user) {
    return NextResponse.json({ error: "회원 정보를 찾을 수 없습니다." }, { status: 401 });
  }

  if (action === "updateProfile") {
    const next = { ...user, ...(body.profile as Partial<User>) };
    data.users = data.users.map((item) => (item.id === userId ? next : item));
    await writeData(data);
    return NextResponse.json({ ok: true, user: next });
  }

  if (action === "createOrder") {
    const order: Order = {
      id: nowId(),
      userId,
      product: body.product as Order["product"],
      title: String(body.title ?? "인생곡"),
      status: "신청접수",
      amount: Number(body.amount ?? 0),
      payment: String(body.payment ?? ""),
      details: (body.details as Record<string, string>) ?? {},
      createdAt: new Date().toISOString(),
    };
    data.orders.unshift(order);
    if (data.notificationSettings[userId]?.order !== false) {
      data.notifications[userId] = [
        {
          id: nowId(),
          title: "신청이 접수되었습니다",
          body: `${order.title} 주문이 신청접수로 등록되었습니다.`,
          createdAt: new Date().toISOString(),
          read: false,
        },
        ...(data.notifications[userId] ?? []),
      ];
    }
    await writeData(data);
    return NextResponse.json({ ok: true, order });
  }

  if (action === "createConsultation") {
    const teacher = String(body.teacher ?? "유비 선생");
    const datetime = String(body.datetime ?? "");
    const parsed = parseDatetime(datetime);
    if (!parsed) {
      return NextResponse.json({ error: "상담 시간을 다시 선택해 주세요." }, { status: 400 });
    }
    if (!isSlotAvailable(data, teacher, parsed.date, parsed.time)) {
      return NextResponse.json(
        { error: "이미 예약되었거나 선택할 수 없는 시간입니다. 다른 시간을 선택해 주세요." },
        { status: 409 },
      );
    }

    const item: Consultation = {
      id: nowId(),
      userId,
      teacher: String(body.teacher ?? "유비 선생"),
      datetime: String(body.datetime ?? ""),
      purpose: String(body.purpose ?? ""),
      method: String(body.method ?? "카카오톡 상담"),
      option: String(body.option ?? "없음"),
      status: "상담 신청",
      amount: Number(body.amount ?? 100000),
      details: (body.details as Record<string, string>) ?? {},
      createdAt: new Date().toISOString(),
    };
    data.consultations.unshift(item);
    if (data.notificationSettings[userId]?.consult !== false) {
      data.notifications[userId] = [
        {
          id: nowId(),
          title: "상담 신청이 접수되었습니다",
          body: `${item.teacher} · ${item.datetime}`,
          createdAt: new Date().toISOString(),
          read: false,
        },
        ...(data.notifications[userId] ?? []),
      ];
    }
    await writeData(data);
    return NextResponse.json({ ok: true, consultation: item });
  }

  if (action === "createInquiry") {
    const item: Inquiry = {
      id: nowId(),
      userId,
      name: String(body.name ?? user.name),
      phone: String(body.phone ?? user.phone),
      method: String(body.method ?? "카카오톡 상담"),
      product: String(body.product ?? ""),
      message: String(body.message ?? ""),
      createdAt: new Date().toISOString(),
    };
    data.inquiries = [item, ...(data.inquiries ?? [])];
    if (data.notificationSettings[userId]?.consult !== false) {
      data.notifications[userId] = [
        {
          id: nowId(),
          title: item.product.startsWith("이벤트")
            ? "이벤트 신청이 접수되었습니다"
            : "무료 상담 문의가 접수되었습니다",
          body: `${item.method}으로 연락드리겠습니다.`,
          createdAt: new Date().toISOString(),
          read: false,
        },
        ...(data.notifications[userId] ?? []),
      ];
    }
    await writeData(data);
    return NextResponse.json({ ok: true, inquiry: item });
  }

  if (action === "toggleWishlist") {
    const productId = String(body.productId ?? "");
    const current = data.wishlists[userId] ?? [];
    data.wishlists[userId] = current.includes(productId)
      ? current.filter((id) => id !== productId)
      : [...current, productId];
    await writeData(data);
    return NextResponse.json({ ok: true, wishlist: data.wishlists[userId] });
  }

  if (action === "updateNotifications") {
    data.notificationSettings[userId] = {
      order: Boolean(body.order),
      consult: Boolean(body.consult),
      notice: Boolean(body.notice),
    };
    await writeData(data);
    return NextResponse.json({ ok: true, notificationSettings: data.notificationSettings[userId] });
  }

  return NextResponse.json({ error: "알 수 없는 요청입니다." }, { status: 400 });
}
