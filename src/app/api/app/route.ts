import { NextResponse } from "next/server";
import { clearUserId, getUserId, setUserId } from "@/lib/server/session";
import { formatPhone, normalizePhone, normalizeEmail, isValidEmail, emailCodeKey, nowId, readData, writeData } from "@/lib/server/store";
import { isSlotAvailable, parseDatetime } from "@/lib/server/consultationSlots";
import type { AppData, Consultation, Coupon, CouponProduct, Inquiry, Order, Review, User } from "@/lib/types/app";

const REFERRAL_DISCOUNT = 10000;
const REFERRAL_POINTS = 10000;

function referralCodeFor(user: User): string {
  const raw = user.id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const tail = (raw.slice(-6) || "HOME").padStart(6, "0");
  return `IS${tail}`;
}

function applyReferral(
  data: AppData,
  buyerUserId: string,
  details: Record<string, string>,
  amount: number,
): { amount: number; details: Record<string, string>; error?: string } {
  const code = (details.referralCode ?? "").trim().toUpperCase();
  if (!code) return { amount, details };
  if (code === data.adminPromo?.code) {
    const percent = data.adminPromo.percent;
    const discount = Math.round(amount * (percent / 100));
    return {
      amount: Math.max(0, amount - discount),
      details: {
        ...details,
        referralCode: code,
        referralDiscount: String(discount),
        referralType: "admin",
        referralPercent: String(percent),
      },
    };
  }
  const buyer = data.users.find((item) => item.id === buyerUserId);
  if (buyer && referralCodeFor(buyer) === code) {
    return { amount, details, error: "본인 코드는 사용할 수 없습니다." };
  }
  const referrer = data.users.find((item) => referralCodeFor(item) === code);
  if (!referrer) {
    return { amount, details, error: "추천인 코드를 확인해 주세요." };
  }
  referrer.points = (referrer.points ?? 0) + REFERRAL_POINTS;
  return {
    amount: Math.max(0, amount - REFERRAL_DISCOUNT),
    details: {
      ...details,
      referralCode: code,
      referralDiscount: String(REFERRAL_DISCOUNT),
      referrerId: referrer.id,
    },
  };
}

function applyFreeCoupon(
  data: AppData,
  userId: string,
  details: Record<string, string>,
  amount: number,
  product: CouponProduct,
): { amount: number; details: Record<string, string>; error?: string } {
  const couponId = (details.couponId ?? "").trim();
  if (!couponId) return { amount, details };
  const list = data.coupons[userId] ?? [];
  const coupon = list.find((item) => item.id === couponId);
  if (!coupon) {
    return { amount, details, error: "쿠폰을 확인해 주세요." };
  }
  if (coupon.usedAt) {
    return { amount, details, error: "이미 사용한 쿠폰입니다." };
  }
  if (!coupon.product || coupon.product !== product) {
    return { amount, details, error: "이 상품에 사용할 수 없는 쿠폰입니다." };
  }
  coupon.usedAt = new Date().toISOString();
  return {
    amount: 0,
    details: {
      ...details,
      couponId: coupon.id,
      couponTitle: coupon.title,
      couponFree: "1",
    },
  };
}

function applyPoints(
  user: User,
  details: Record<string, string>,
  amount: number,
): { amount: number; details: Record<string, string> } {
  if (amount <= 0 || details.usePoints !== "1") return { amount, details };
  const available = Math.max(0, Math.floor(user.points ?? 0));
  const used = Math.min(available, amount);
  if (used <= 0) return { amount, details };
  user.points = available - used;
  return {
    amount: amount - used,
    details: {
      ...details,
      usePoints: "1",
      pointsUsed: String(used),
    },
  };
}

function settledPayment(amount: number, details: Record<string, string>, fallback: string) {
  if (amount > 0) return fallback;
  if (details.couponFree === "1") return "무료 쿠폰";
  if (details.pointsUsed) return "적립금";
  return fallback;
}

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
    points: 0,
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

function publicReviews(data: AppData) {
  return (data.reviews ?? [])
    .filter((item) => item.visible)
    .map((item) => ({
      id: item.id,
      name: item.name,
      rating: item.rating,
      text: item.text,
      kind: item.kind,
      title: item.title,
    }));
}

export async function GET() {
  const userId = await getUserId();
  const data = await readData();
  const reviews = publicReviews(data);
  if (!userId) {
    return NextResponse.json({ user: null, reviews });
  }
  const user = data.users.find((item) => item.id === userId) ?? null;
  if (!user) {
    return NextResponse.json({ user: null, reviews });
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
    reviews,
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
    const details = (body.details as Record<string, string>) ?? {};
    const product = body.product as Order["product"];
    const couponed = applyFreeCoupon(data, userId, details, Number(body.amount ?? 0), product);
    if (couponed.error) {
      return NextResponse.json({ error: couponed.error }, { status: 400 });
    }
    const referred =
      couponed.amount > 0
        ? applyReferral(data, userId, couponed.details, couponed.amount)
        : couponed;
    if (referred.error) {
      return NextResponse.json({ error: referred.error }, { status: 400 });
    }
    const pointed = applyPoints(user, referred.details, referred.amount);
    const order: Order = {
      id: nowId(),
      userId,
      product,
      title: String(body.title ?? "인생곡"),
      status: "신청접수",
      amount: pointed.amount,
      payment: settledPayment(pointed.amount, pointed.details, String(body.payment ?? "")),
      details: pointed.details,
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

    const details = (body.details as Record<string, string>) ?? {};
    const couponed = applyFreeCoupon(
      data,
      userId,
      details,
      Number(body.amount ?? 100000),
      "consultation",
    );
    if (couponed.error) {
      return NextResponse.json({ error: couponed.error }, { status: 400 });
    }
    const referred =
      couponed.amount > 0
        ? applyReferral(data, userId, couponed.details, couponed.amount)
        : couponed;
    if (referred.error) {
      return NextResponse.json({ error: referred.error }, { status: 400 });
    }
    const pointed = applyPoints(user, referred.details, referred.amount);

    const item: Consultation = {
      id: nowId(),
      userId,
      teacher: String(body.teacher ?? "유비 선생"),
      datetime: String(body.datetime ?? ""),
      purpose: String(body.purpose ?? ""),
      method: String(body.method ?? "카카오톡 상담"),
      option: String(body.option ?? "없음"),
      status: "상담 신청",
      amount: pointed.amount,
      details: pointed.details,
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

  if (action === "createReview") {
    const title = String(body.title ?? "").trim();
    const text = String(body.text ?? "").trim();
    const name = String(body.name ?? user.name).trim();
    const rating = Number(body.rating ?? 0);
    const targetKey = String(body.targetKey ?? "");
    if (targetKey.startsWith("preview:")) {
      return NextResponse.json({ error: "미리보기는 저장되지 않습니다." }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: "받으신 상품을 선택해 주세요." }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "이름을 적어 주세요." }, { status: 400 });
    }
    if (!text) {
      return NextResponse.json({ error: "후기를 적어 주세요." }, { status: 400 });
    }
    if (text.length > 300) {
      return NextResponse.json({ error: "후기는 300자까지 적을 수 있습니다." }, { status: 400 });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "별점을 선택해 주세요." }, { status: 400 });
    }
    let kind: Review["kind"];
    if (targetKey.startsWith("order:")) {
      const order = data.orders.find((item) => item.id === targetKey.slice(6));
      kind = order?.product;
    } else if (targetKey.startsWith("consult:")) {
      kind = "consultation";
    }
    const review: Review = {
      id: nowId(),
      userId,
      name,
      title,
      rating,
      text,
      createdAt: new Date().toISOString(),
      visible: false,
      kind,
    };
    data.reviews = [review, ...(data.reviews ?? [])];
    await writeData(data);
    return NextResponse.json({ ok: true, review });
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

  if (action === "readNotifications") {
    const ids = Array.isArray(body.ids) ? body.ids.map((item) => String(item)) : [];
    data.notifications[userId] = (data.notifications[userId] ?? []).map((item) =>
      ids.includes(item.id) ? { ...item, read: true } : item,
    );
    await writeData(data);
    return NextResponse.json({ ok: true, notifications: data.notifications[userId] });
  }

  return NextResponse.json({ error: "알 수 없는 요청입니다." }, { status: 400 });
}
