import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { sendVerificationSms } from "@/lib/server/sms";
import { clearUserId, getUserId, setUserId } from "@/lib/server/session";
import { normalizePhone, normalizeEmail, isValidEmail, emailCodeKey, nowId, createPayment, readData, writeData, listOrdersByUser, getOrderById, hashPassword, verifyPassword, emptyUser, welcomeCoupon } from "@/lib/server/store";
import { isSlotAvailable, parseDatetime } from "@/lib/server/consultationSlots";
import { calcConsultationAmount, calcOrderAmount } from "@/lib/server/pricing";
import {
  applyFreeCoupon,
  applyPoints,
  applyReferral,
  commitConsultation,
  commitOrder,
} from "@/lib/server/applyOrder";
import { maskName } from "@/lib/constants/reviews";
import type {
  AppData,
  CouponProduct,
  Inquiry,
  Order,
  Review,
  User,
  VerificationCode,
} from "@/lib/types/app";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * 개발용 인증번호. 외부 SMS/이메일 연동이 없는 동안 화면에 표시되는 값과
 * 서버가 검증하는 값을 같게 맞추기 위해 고정한다. 운영에서는 사용하지 않는다.
 */
const DEV_CODE = IS_PRODUCTION ? null : "123456";

/** 인증번호 유효시간 5분, 재발송 쿨다운 60초, 코드별 검증 시도 5회. */
const CODE_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

/** 실제 사용 중인 verifyCode 목적만 허용한다. */
const VERIFY_PURPOSES = ["signup", "reset"] as const;
type VerifyPurpose = (typeof VERIFY_PURPOSES)[number];

function isVerifyPurpose(value: string): value is VerifyPurpose {
  return (VERIFY_PURPOSES as readonly string[]).includes(value);
}

/** 예측 가능한 Math.random 대신 crypto 기반으로 6자리 인증번호를 만든다. */
function generateCode(): string {
  return String(randomInt(0, 1000000)).padStart(6, "0");
}

/** 회원가입·재설정 단기 토큰도 같은 방식으로 안전하게 만든다. */
function generateToken(): string {
  return randomInt(0, 1000000000).toString(36) + randomInt(0, 1000000000).toString(36);
}

/** 남은 쿨다운(초). 0이면 재발송 가능. */
function cooldownLeft(saved: VerificationCode | undefined): number {
  if (!saved?.sentAt) return 0;
  const left = saved.sentAt + RESEND_COOLDOWN_MS - Date.now();
  return left > 0 ? Math.ceil(left / 1000) : 0;
}

/**
 * 인증번호 검증 결과. 실패 시 시도 횟수를 올리고, 5회를 넘기면 코드를 폐기한다.
 * 저장은 호출한 쪽에서 writeData로 마무리한다.
 */
function checkCode(data: AppData, key: string, input: string): { ok: boolean; error?: string } {
  const saved = data.codes[key];
  if (!saved || saved.expiresAt < Date.now()) {
    delete data.codes[key];
    return { ok: false, error: "인증번호가 올바르지 않습니다." };
  }
  if (saved.code === input && input.length > 0) {
    delete data.codes[key];
    return { ok: true };
  }
  const attempts = (saved.attempts ?? 0) + 1;
  if (attempts >= MAX_VERIFY_ATTEMPTS) {
    delete data.codes[key];
    return {
      ok: false,
      error: "인증 시도 횟수를 초과했습니다. 인증번호를 다시 받아주세요.",
    };
  }
  saved.attempts = attempts;
  return { ok: false, error: "인증번호가 올바르지 않습니다." };
}

/**
 * 내가 쓴 후기. 본인에게만 내려주며, 승인 대기 중인 후기도 포함한다.
 * 다른 회원의 후기나 userId는 여기에 담기지 않는다.
 * targetKey가 없던 예전 후기는 빈 문자열로 채워 화면이 깨지지 않게 한다.
 */
function myReviews(data: AppData, userId: string) {
  return (data.reviews ?? [])
    .filter((item) => item.userId === userId)
    .map((item) => ({
      id: item.id,
      targetKey: item.targetKey ?? "",
      kind: item.kind,
      title: item.title,
      rating: item.rating,
      text: item.text,
      createdAt: item.createdAt,
      visible: item.visible,
    }));
}

/**
 * 공개 후기. 이름은 여기에서만 가려 내보내고 저장된 원본은 그대로 둔다.
 * 대상 정보(targetKey)는 밖으로 내보내지 않고, 있는지 여부만 verified로 알린다.
 */
function publicReviews(data: AppData) {
  return (data.reviews ?? [])
    .filter((item) => item.visible)
    .map((item) => ({
      id: item.id,
      name: maskName(item.name),
      rating: item.rating,
      text: item.text,
      kind: item.kind,
      title: item.title,
      verified: Boolean(item.targetKey),
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
    orders: await listOrdersByUser(userId),
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
    myReviews: myReviews(data, userId),
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const action = String(body.action ?? "");
  const data = await readData();

  if (action === "sendCode") {
    const channel = String(body.channel ?? "phone");
    // 실제 SMS 연동 전까지는 개발용 고정 코드를 쓴다. 운영에서는 crypto 난수를 쓴다.
    const code = DEV_CODE ?? generateCode();
    const now = Date.now();

    const key =
      channel === "email"
        ? (() => {
            const email = normalizeEmail(String(body.email ?? ""));
            return isValidEmail(email) ? emailCodeKey(email) : null;
          })()
        : (() => {
            const phone = normalizePhone(String(body.phone ?? ""));
            return phone.length >= 10 ? phone : null;
          })();
    if (!key) {
      return NextResponse.json(
        { error: channel === "email" ? "이메일을 확인해 주세요." : "연락처를 확인해 주세요." },
        { status: 400 },
      );
    }

    // 같은 번호(또는 이메일)로의 재발송은 60초 쿨다운을 둔다.
    const wait = cooldownLeft(data.codes[key]);
    if (wait > 0) {
      return NextResponse.json(
        { error: `인증번호는 ${wait}초 후에 다시 요청할 수 있습니다.` },
        { status: 429 },
      );
    }

    data.codes[key] = { code, expiresAt: now + CODE_TTL_MS, attempts: 0, sentAt: now };
    await writeData(data);

    // 운영에서는 휴대폰 인증번호를 실제 SMS로 보낸다.
    // 개발에서는 발송하지 않고 devCode로 확인한다. 이메일 채널은 아직 발송 연동이 없다.
    if (IS_PRODUCTION && channel !== "email") {
      try {
        await sendVerificationSms(String(body.phone ?? ""), code);
      } catch (error) {
        // 임시 진단용 로그. 원인 파악이 끝나면 제거한다.
        // 에러 종류와 메시지만 남기고, SOLAPI 메시지에 수신번호가 섞여 들어오는
        // 경우를 대비해 9자리 이상 숫자열은 마스킹한다.
        if (IS_PRODUCTION && error instanceof Error) {
          console.error(
            "[sendCode] SMS 발송 실패",
            error.name,
            error.message.replace(/\d{9,}/g, "[redacted]"),
          );
        }
        // 발송 실패 시 방금 저장한 코드를 폐기해 쿨다운·시도 횟수가 남지 않게 한다.
        // 단, 그 사이 다른 요청이 같은 key에 새 코드를 저장했을 수 있으므로
        // code와 sentAt이 모두 이번 요청이 저장한 값일 때만 삭제한다.
        // 실패 원인(SOLAPI 응답·키 정보)은 응답에 담지 않는다.
        const current = await readData();
        const saved = current.codes[key];
        if (saved && saved.code === code && saved.sentAt === now) {
          delete current.codes[key];
          await writeData(current);
        }
        return NextResponse.json(
          { error: "인증번호를 보내지 못했습니다. 잠시 후 다시 시도해 주세요." },
          { status: 502 },
        );
      }
    }

    // 운영에서는 인증번호를 응답에 절대 담지 않는다.
    return NextResponse.json(IS_PRODUCTION ? { ok: true } : { ok: true, devCode: code });
  }

  if (action === "login") {
    const channel = String(body.channel ?? "phone");

    if (action === "login" && channel === "email") {
      const email = normalizeEmail(String(body.email ?? ""));
      if (!isValidEmail(email)) {
        return NextResponse.json({ error: "이메일을 입력해 주세요." }, { status: 400 });
      }
      const checked = checkCode(data, emailCodeKey(email), String(body.code ?? ""));
      if (!checked.ok) {
        await writeData(data);
        return NextResponse.json({ error: checked.error }, { status: 400 });
      }

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
      const checked = checkCode(data, phone, String(body.code ?? ""));
      if (!checked.ok) {
        await writeData(data);
        return NextResponse.json({ error: checked.error }, { status: 400 });
      }
    }
    let user = data.users.find((item) => normalizePhone(item.phone) === phone);
    if (!user) {
      user = emptyUser(phone);
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

  if (action === "verifyCode") {
    // 휴대폰 인증 공통 진입점. 인증만 하고, 신규 회원이면 계정을 만들지 않는다.
    const phone = normalizePhone(String(body.phone ?? ""));
    if (phone.length < 10) {
      return NextResponse.json({ error: "연락처를 입력해 주세요." }, { status: 400 });
    }
    // 실제 사용 중인 목적(signup/reset)만 허용한다.
    const purpose = String(body.purpose ?? "");
    if (!isVerifyPurpose(purpose)) {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    const checked = checkCode(data, phone, String(body.code ?? ""));
    if (!checked.ok) {
      await writeData(data);
      return NextResponse.json({ error: checked.error }, { status: 400 });
    }

    const existing = data.users.find((item) => normalizePhone(item.phone) === phone);
    if (existing) {
      if (purpose === "signup") {
        // 회원가입 진입점에서는 기존 회원을 로그인시키지 않고 로그인 화면으로 보낸다.
        await writeData(data);
        return NextResponse.json(
          { error: "이미 가입된 번호입니다. 비밀번호로 로그인해 주세요." },
          { status: 400 },
        );
      }
      if (purpose === "reset") {
        // 비밀번호 재설정: 인증만 확인하고 단기 토큰을 발급한다.
        const resetToken = generateToken();
        data.codes[`reset:${phone}`] = {
          code: resetToken,
          expiresAt: Date.now() + 15 * 60 * 1000,
        };
        await writeData(data);
        return NextResponse.json({ ok: true, isNew: false, resetToken });
      }
    }
    if (purpose === "reset") {
      await writeData(data);
      return NextResponse.json(
        { error: "가입되지 않은 번호입니다. 회원가입을 진행해 주세요." },
        { status: 400 },
      );
    }

    // 신규 회원: 가입 단계에서 인증을 다시 요구하지 않도록 단기 토큰만 발급한다.
    const signupToken = generateToken();
    data.codes[`signup:${phone}`] = {
      code: signupToken,
      expiresAt: Date.now() + 15 * 60 * 1000,
    };
    await writeData(data);
    return NextResponse.json({ ok: true, isNew: true, signupToken });
  }

  if (action === "signupComplete") {
    const phone = normalizePhone(String(body.phone ?? ""));
    const token = String(body.signupToken ?? "");
    const key = `signup:${phone}`;
    const saved = data.codes[key];
    if (!saved || saved.expiresAt < Date.now() || saved.code !== token) {
      return NextResponse.json(
        { error: "인증이 만료되었습니다. 처음부터 다시 진행해 주세요." },
        { status: 400 },
      );
    }
    const name = String(body.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "이름을 입력해 주세요." }, { status: 400 });
    }
    const password = String(body.password ?? "");
    if (password.length < 6) {
      return NextResponse.json(
        { error: "비밀번호는 6자 이상으로 입력해 주세요." },
        { status: 400 },
      );
    }
    const email = String(body.email ?? "").trim();
    if (email && !isValidEmail(email)) {
      return NextResponse.json({ error: "이메일을 확인해 주세요." }, { status: 400 });
    }

    // 인증 사이에 같은 번호로 가입된 경우 중복 생성하지 않는다.
    const existing = data.users.find((item) => normalizePhone(item.phone) === phone);
    if (existing) {
      delete data.codes[key];
      await writeData(data);
      await setUserId(existing.id);
      return NextResponse.json({ ok: true, isNew: false, user: existing });
    }

    const user: User = {
      ...emptyUser(phone, name, email),
      birth: String(body.birth ?? ""),
      passwordHash: hashPassword(password),
      marketingAgreed: Boolean(body.marketingAgreed),
    };
    data.users.push(user);
    data.coupons[user.id] = [welcomeCoupon()];
    data.wishlists[user.id] = [];
    data.notifications[user.id] = [];
    data.notificationSettings[user.id] = { order: true, consult: true, notice: false };
    delete data.codes[key];
    await writeData(data);
    await setUserId(user.id);
    return NextResponse.json({ ok: true, isNew: true, user });
  }

  if (action === "passwordLogin") {
    // 기존 회원 로그인: SMS 없이 휴대폰 번호 + 비밀번호로 확인한다.
    const phone = normalizePhone(String(body.phone ?? ""));
    const password = String(body.password ?? "");
    if (phone.length < 10) {
      return NextResponse.json({ error: "연락처를 입력해 주세요." }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ error: "비밀번호를 입력해 주세요." }, { status: 400 });
    }
    const user = data.users.find((item) => normalizePhone(item.phone) === phone);
    if (!user) {
      return NextResponse.json(
        { error: "가입되지 않은 번호입니다. 회원가입을 진행해 주세요." },
        { status: 400 },
      );
    }
    if (!user.passwordHash) {
      // 비밀번호 이전에 만들어진 계정: 재설정으로 안내한다.
      return NextResponse.json(
        { error: "비밀번호가 설정되어 있지 않습니다. 비밀번호 찾기로 설정해 주세요." },
        { status: 400 },
      );
    }
    if (!verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 400 });
    }
    await setUserId(user.id);
    return NextResponse.json({ ok: true, user });
  }

  if (action === "resetPassword") {
    const phone = normalizePhone(String(body.phone ?? ""));
    const token = String(body.resetToken ?? "");
    const key = `reset:${phone}`;
    const saved = data.codes[key];
    if (!saved || saved.expiresAt < Date.now() || saved.code !== token) {
      return NextResponse.json(
        { error: "인증이 만료되었습니다. 처음부터 다시 진행해 주세요." },
        { status: 400 },
      );
    }
    const password = String(body.password ?? "");
    if (password.length < 6) {
      return NextResponse.json(
        { error: "비밀번호는 6자 이상으로 입력해 주세요." },
        { status: 400 },
      );
    }
    const user = data.users.find((item) => normalizePhone(item.phone) === phone);
    if (!user) {
      return NextResponse.json({ error: "가입되지 않은 번호입니다." }, { status: 400 });
    }
    user.passwordHash = hashPassword(password);
    delete data.codes[key];
    await writeData(data);
    return NextResponse.json({ ok: true });
  }

  if (action === "logout") {
    await clearUserId();
    return NextResponse.json({ ok: true });
  }


  if (action === "createInquiry") {
    // 무료 상담·이벤트는 비회원도 접수한다. 계정을 만들지 않고 문의만 저장한다.
    const sessionUserId = await getUserId();
    const member = sessionUserId
      ? (data.users.find((item) => item.id === sessionUserId) ?? null)
      : null;
    const name = String(body.name ?? member?.name ?? "").trim();
    const phone = String(body.phone ?? member?.phone ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "이름을 입력해 주세요." }, { status: 400 });
    }
    if (normalizePhone(phone).length < 10) {
      return NextResponse.json({ error: "연락처를 입력해 주세요." }, { status: 400 });
    }
    const item: Inquiry = {
      id: nowId(),
      name,
      phone,
      method: String(body.method ?? "카카오톡 상담"),
      product: String(body.product ?? ""),
      message: String(body.message ?? ""),
      createdAt: new Date().toISOString(),
    };
    if (member) {
      item.userId = member.id;
    }
    data.inquiries = [item, ...(data.inquiries ?? [])];
    // 알림은 로그인한 회원에게만 보낸다.
    if (member && data.notificationSettings[member.id]?.consult !== false) {
      data.notifications[member.id] = [
        {
          id: nowId(),
          title: item.product.startsWith("이벤트")
            ? "이벤트 신청이 접수되었습니다"
            : "무료 상담 문의가 접수되었습니다",
          body: `${item.method}으로 연락드리겠습니다.`,
          createdAt: new Date().toISOString(),
          read: false,
        },
        ...(data.notifications[member.id] ?? []),
      ];
    }
    await writeData(data);
    return NextResponse.json({ ok: true, inquiry: item });
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
    const result = await commitOrder(data, user, {
      product: body.product,
      title: body.title,
      options: body.options,
      payment: body.payment,
      details: (body.details as Record<string, string>) ?? {},
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true, order: result.order });
  }

  if (action === "createConsultation") {
    const result = await commitConsultation(data, user, {
      title: body.title,
      report: body.report,
      extraPerson: body.extraPerson,
      payment: body.payment,
      teacher: body.teacher,
      datetime: body.datetime,
      purpose: body.purpose,
      method: body.method,
      option: body.option,
      details: (body.details as Record<string, string>) ?? {},
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true, consultation: result.consultation });
  }

  if (action === "preparePayment") {
    const kind = String(body.kind ?? "");
    if (kind !== "order" && kind !== "consultation") {
      return NextResponse.json({ error: "신청 종류를 확인해 주세요." }, { status: 400 });
    }

    // 기존 applyFreeCoupon/applyReferral/applyPoints는 data와 user를 직접 바꾼다.
    // 규칙을 베껴 쓰지 않고 그대로 재사용하되, 저장하지 않는 사본 위에서만 실행한다.
    // 이 요청은 writeData를 부르지 않으므로 사본의 변경은 어디에도 남지 않는다.
    const draft = structuredClone(data);
    const draftUser = draft.users.find((item) => item.id === userId);
    if (!draftUser) {
      return NextResponse.json({ error: "회원 정보를 찾을 수 없습니다." }, { status: 401 });
    }

    const details = { ...((body.details as Record<string, string>) ?? {}) };
    // 고객이 요청한 할인 수단. 기존 apply* 가 읽는 것과 같은 방식으로 정규화해 둔다.
    // 승인 단계는 이 값을 근거로 "같은 할인 수단"을 다시 검증한다.
    const requestedCouponId = (details.couponId ?? "").trim() || null;
    const requestedReferralCode = (details.referralCode ?? "").trim().toUpperCase() || null;
    let baseAmount = 0;
    let goodsName = "";
    let snapshotRequest: Record<string, unknown>;

    if (kind === "order") {
      // 금액은 클라이언트 값을 쓰지 않고 서버 가격표로 다시 계산한다.
      const priced = calcOrderAmount(body.product, body.options);
      if (!priced) {
        return NextResponse.json({ error: "신청 내용을 다시 확인해 주세요." }, { status: 400 });
      }
      const product = body.product as Order["product"];
      details.optionIds = priced.optionIds.join(",");
      baseAmount = priced.amount;
      goodsName = String(body.title ?? "인생곡");
      snapshotRequest = {
        product,
        title: goodsName,
        options: priced.optionIds,
        payment: String(body.payment ?? ""),
      };
    } else {
      const teacher = String(body.teacher ?? "유비 선생");
      const datetime = String(body.datetime ?? "");
      const parsed = parseDatetime(datetime);
      if (!parsed) {
        return NextResponse.json({ error: "상담 시간을 다시 선택해 주세요." }, { status: 400 });
      }
      // 확인만 한다. 슬롯 점유는 승인 단계에서 다시 검증한 뒤에 이뤄진다.
      if (!isSlotAvailable(data, teacher, parsed.date, parsed.time)) {
        return NextResponse.json(
          { error: "이미 예약되었거나 선택할 수 없는 시간입니다. 다른 시간을 선택해 주세요." },
          { status: 409 },
        );
      }
      // 상담 금액도 서버에서 기본가 + 옵션가로 다시 계산한다.
      const priced = calcConsultationAmount(body);
      details.optionIds = priced.optionIds.join(",");
      baseAmount = priced.amount;
      goodsName = String(body.title ?? "1:1 사주상담");
      snapshotRequest = {
        title: goodsName,
        report: String(body.report ?? "") === "1" ? "1" : "",
        extraPerson: String(body.extraPerson ?? "") === "1" ? "1" : "",
        payment: String(body.payment ?? ""),
        teacher,
        datetime,
        purpose: String(body.purpose ?? ""),
        method: String(body.method ?? "카카오톡 상담"),
        option: String(body.option ?? "없음"),
      };
    }

    const couponProduct: CouponProduct =
      kind === "consultation" ? "consultation" : (body.product as Order["product"]);
    const couponed = applyFreeCoupon(draft, userId, details, baseAmount, couponProduct);
    if (couponed.error) {
      return NextResponse.json({ error: couponed.error }, { status: 400 });
    }
    const referred =
      couponed.amount > 0
        ? applyReferral(draft, userId, couponed.details, couponed.amount)
        : couponed;
    if (referred.error) {
      return NextResponse.json({ error: referred.error }, { status: 400 });
    }
    const pointed = applyPoints(draftUser, referred.details, referred.amount);
    const amount = pointed.amount;
    // 실제로 쓰인 적립금. 클라이언트 값이나 details 문자열이 아니라
    // 서버 계산 결과의 차액이라 위조할 수 없다.
    const pointsUsed = Math.max(0, referred.amount - amount);

    // 무료 쿠폰·적립금으로 0원이 되는 경로는 기존 주문 생성 흐름이 그대로 처리한다.
    // 여기서는 결제가 필요 없다는 사실만 알려주고 payments 행을 만들지 않는다.
    if (amount <= 0) {
      return NextResponse.json({ ok: true, requiresPayment: false, amount: 0, goodsName });
    }

    const merchantOrderId = `is-${nowId()}`;
    const payment = await createPayment({
      provider: "nicepay",
      merchantOrderId,
      requestedAmount: amount,
      status: "ready",
      method: "card",
      orderSnapshot: {
        version: 1,
        kind,
        userId,
        goodsName,
        baseAmount,
        amount,
        request: snapshotRequest,
        // 승인 재검증의 근거. details 문자열은 클라이언트가 임의 키를 섞을 수 있으므로
        // 할인 판단에는 쓰지 않고 이 값만 사용한다.
        discount: {
          couponId: requestedCouponId,
          referralCode: requestedReferralCode,
          usePoints: pointsUsed,
        },
        details: pointed.details,
        preparedAt: new Date().toISOString(),
      },
    });
    // 주문번호가 겹치면 남의 결제 준비를 이어받게 되므로 재사용하지 않고 실패시킨다.
    if (!payment) {
      return NextResponse.json(
        { error: "결제 준비에 실패했습니다. 다시 시도해 주세요." },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      requiresPayment: true,
      merchantOrderId: payment.merchantOrderId,
      amount: payment.requestedAmount,
      goodsName,
    });
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
    // 후기는 실제로 받아 보신 분만 남길 수 있다.
    // 화면(MY 후기 작성)의 대상 목록과 같은 규칙을 서버에서 다시 확인한다.
    let kind: Review["kind"];
    if (targetKey.startsWith("order:")) {
      const order = await getOrderById(targetKey.slice(6));
      if (!order || order.userId !== userId) {
        return NextResponse.json({ error: "후기를 남길 수 있는 신청이 아닙니다." }, { status: 403 });
      }
      if (order.status !== "완성/전달" && order.status !== "완료") {
        return NextResponse.json(
          { error: "아직 완성되지 않은 신청입니다. 완성 후에 후기를 남기실 수 있습니다." },
          { status: 403 },
        );
      }
      kind = order.product;
    } else if (targetKey.startsWith("consult:")) {
      const consultation = data.consultations.find(
        (item) => item.id === targetKey.slice(8) && item.userId === userId,
      );
      if (!consultation) {
        return NextResponse.json({ error: "후기를 남길 수 있는 상담이 아닙니다." }, { status: 403 });
      }
      if (consultation.status !== "상담 완료") {
        return NextResponse.json(
          { error: "아직 끝나지 않은 상담입니다. 상담 후에 후기를 남기실 수 있습니다." },
          { status: 403 },
        );
      }
      kind = "consultation";
    } else {
      // order:/consult: 이외의 값으로는 후기를 만들 수 없다.
      return NextResponse.json({ error: "후기를 남길 대상을 선택해 주세요." }, { status: 400 });
    }
    // 한 주문·상담에는 후기를 하나만 남길 수 있다.
    // 승인 대기(visible:false)나 비공개 처리된 후기도 이미 쓴 것으로 본다.
    // targetKey가 없던 예전 후기는 빈 값으로 취급되어 비교에 걸리지 않는다.
    const already = (data.reviews ?? []).some(
      (item) => item.userId === userId && (item.targetKey ?? "") === targetKey,
    );
    if (already) {
      return NextResponse.json({ error: "이미 후기를 남기셨습니다." }, { status: 409 });
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
      targetKey,
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
