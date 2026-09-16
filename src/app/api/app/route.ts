import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sendVerificationSms } from "@/lib/server/sms";
import { clearUserId, getUserId, setUserId } from "@/lib/server/session";
import { writeDataWithVerificationConsumes, isAppStoreConflict, normalizePhone, normalizeEmail, isValidEmail, emailCodeKey, nowId, createPayment, readData, writeData, listOrdersByUser, getOrderById, hashPassword, verifyPassword, emptyUser, registerUser, welcomeCoupon, scrubPaymentSnapshotDetailsByUser, scrubOrderDetailsByUser } from "@/lib/server/store";
import {
  clearSocialLinkCookie,
  readSocialLinkPendingForCommit,
} from "@/lib/server/socialLink";
import {
  anonymizeWithdrawnUser,
  findWithdrawBlockers,
  getActiveUserId,
  isActiveUser,
  KEPT_DETAIL_KEYS,
  scrubUserRecords,
  WITHDRAWN_NAME,
} from "@/lib/server/withdrawAccount";
import { consumeWithdrawVerification } from "@/lib/server/withdrawVerification";
import { scrubChatInquiriesByUser } from "@/lib/server/chatInquiries";
import {
  checkCode,
  consumeVerification,
  deleteIssuedCode,
  issueCode,
  putToken,
  readVerification,
} from "@/lib/server/verificationCodes";
import type { VerificationSource } from "@/lib/server/verificationCodes";
import type { VerificationConsume } from "@/lib/server/store";
import { unlinkKakao } from "@/lib/server/kakaoUnlink";
import { unlinkNaver } from "@/lib/server/naverUnlink";
import { LOGIN_DEFAULT_PATH, LOGIN_NEXT_COOKIE, safeNextPath } from "@/lib/loginRedirect";
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

/** 챗봇 상담원 문의를 다른 접수와 구분하는 값. 관리자 "문의" 탭에 그대로 보인다. */
const CHAT_INQUIRY_PRODUCT = "챗봇 상담원 문의";

/** 챗봇에서 고를 수 있는 연락 방법. 챗봇 문의에만 적용하고 다른 접수는 그대로 둔다. */
const CHAT_INQUIRY_METHODS = ["카카오톡", "문자"];
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
const VERIFY_PURPOSES = ["signup", "reset", "link"] as const;
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
 * 회원 변경과 함께 지울 인증 목록을 만든다.
 *
 * 새 테이블에 있는 값은 저장 문장에 함께 묶어 보내고,
 * 전환 이전에 발급되어 app_store.codes에 남아 있는 값은 여기서 바로 지운다.
 * 후자는 어차피 같은 JSONB 안에 있어서 저장 한 번이면 함께 확정된다.
 */
function consumeList(
  data: AppData,
  key: string,
  code: string | null,
  source: VerificationSource,
): VerificationConsume[] {
  if (source === "legacy") {
    delete data.codes[key];
    return [];
  }
  return [{ storageKey: key, code }];
}

/** 인증이 그사이 바뀌어 저장하지 못한 경우. 기존 문구를 그대로 쓴다. */
function verificationExpired() {
  return NextResponse.json(
    { error: "인증이 만료되었습니다. 처음부터 다시 진행해 주세요." },
    { status: 400 },
  );
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

/**
 * 클라이언트로 내려보내는 회원 사본. 로그인·재식별에 쓰이는 원본 값
 * (비밀번호 해시, 소셜 계정 id)은 화면에서 쓸 일이 없으므로 빼고 보낸다.
 * 저장소의 User 객체는 그대로 두고 사본에서만 지운다.
 */
function toPublicUser(user: User): User {
  const result: User = { ...user };
  delete result.passwordHash;
  delete result.kakaoId;
  delete result.naverId;
  return result;
}

export async function GET() {
  const userId = await getUserId();
  const data = await readData();
  const reviews = publicReviews(data);
  if (!userId) {
    return NextResponse.json({ user: null, reviews });
  }
  const user = data.users.find((item) => item.id === userId) ?? null;
  // 탈퇴한 회원은 세션 쿠키가 남아 있어도 로그인 상태로 보지 않는다.
  if (!isActiveUser(user)) {
    return NextResponse.json({ user: null, reviews });
  }
  return NextResponse.json({
    user: toPublicUser(user),
    /**
     * 로그인 수단이 무엇인지만 알려준다. 탈퇴 화면이 비밀번호 확인과
     * 소셜 재인증 중 무엇을 보여줄지 고르는 데 쓴다.
     * passwordHash·kakaoId·naverId 같은 실제 값은 담지 않는다.
     */
    authMethods: {
      password: Boolean(user.passwordHash),
      kakao: Boolean(user.kakaoId),
      naver: Boolean(user.naverId),
    },
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
  try {
    return await handlePost(request);
  } catch (error) {
    // 다른 요청과 겹쳐 저장되지 않은 경우. 함께 묶인 주문·결제 변경도 일어나지 않았다.
    // 무엇이 겹쳤는지는 남기지 않는다. 경로와 사실만 남긴다.
    if (isAppStoreConflict(error)) {
      console.warn("[app] store conflict");
      return NextResponse.json(
        { error: "다른 요청과 겹쳤습니다. 잠시 후 다시 시도해 주세요." },
        { status: 409 },
      );
    }
    throw error;
  }
}

async function handlePost(request: Request) {
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
    // 전환 이전에 발급된 값이 남아 있을 수 있어 그쪽 쿨다운도 함께 본다.
    const legacyWait = cooldownLeft(data.codes[key]);
    if (legacyWait > 0) {
      return NextResponse.json(
        { error: `인증번호는 ${legacyWait}초 후에 다시 요청할 수 있습니다.` },
        { status: 429 },
      );
    }

    const issued = await issueCode({
      storageKey: key,
      code,
      expiresAt: now + CODE_TTL_MS,
      sentAt: now,
      cooldownMs: RESEND_COOLDOWN_MS,
    });
    if (!issued.ok) {
      return NextResponse.json(
        { error: `인증번호는 ${issued.waitSeconds}초 후에 다시 요청할 수 있습니다.` },
        { status: 429 },
      );
    }

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
        await deleteIssuedCode({ storageKey: key, code, sentAt: now });
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
      const emailKey = emailCodeKey(email);
      const emailCode = String(body.code ?? "");
      const checked = await checkCode({
        data,
        storageKey: emailKey,
        input: emailCode,
        maxAttempts: MAX_VERIFY_ATTEMPTS,
      });
      if (!checked.ok) {
        // 전환 이전 값의 시도 횟수만 app_store에 있다. 새 값은 이미 테이블에 저장됐다.
        if (checked.source === "legacy") await writeData(data);
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
      // 인증 소비와 회원 생성을 한 문장으로 확정한다.
      const saved = await writeDataWithVerificationConsumes(
        data,
        consumeList(data, emailKey, emailCode, checked.source),
      );
      if (!saved.ok) {
        return NextResponse.json({ error: "인증번호가 올바르지 않습니다." }, { status: 400 });
      }
      await setUserId(user.id);
      return NextResponse.json({ ok: true, user: toPublicUser(user) });
    }

    const phone = normalizePhone(String(body.phone ?? ""));
    if (phone.length < 10) {
      return NextResponse.json({ error: "연락처를 입력해 주세요." }, { status: 400 });
    }
    const loginCode = String(body.code ?? "");
    const checked = await checkCode({
      data,
      storageKey: phone,
      input: loginCode,
      maxAttempts: MAX_VERIFY_ATTEMPTS,
    });
    if (!checked.ok) {
      // 전환 이전 값의 시도 횟수만 app_store에 있다. 새 값은 이미 테이블에 저장됐다.
      if (checked.source === "legacy") await writeData(data);
      return NextResponse.json({ error: checked.error }, { status: 400 });
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
    // 인증 소비와 회원 생성을 한 문장으로 확정한다.
    const saved = await writeDataWithVerificationConsumes(
      data,
      consumeList(data, phone, loginCode, checked.source),
    );
    if (!saved.ok) {
      return NextResponse.json({ error: "인증번호가 올바르지 않습니다." }, { status: 400 });
    }
    await setUserId(user.id);
    return NextResponse.json({ ok: true, user: toPublicUser(user) });
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
    const verifyInput = String(body.code ?? "");
    const checked = await checkCode({
      data,
      storageKey: phone,
      input: verifyInput,
      maxAttempts: MAX_VERIFY_ATTEMPTS,
    });
    if (!checked.ok) {
      // 전환 이전 값의 시도 횟수만 app_store에 있다. 새 값은 이미 테이블에 저장됐다.
      if (checked.source === "legacy") await writeData(data);
      return NextResponse.json({ error: checked.error }, { status: 400 });
    }
    // 인증만 확인하는 단계라 app_store와 묶을 것이 없다. 그 자리에서 소비한다.
    if (checked.source === "legacy") {
      delete data.codes[phone];
      await writeData(data);
    } else {
      await consumeVerification(phone, verifyInput);
    }
    const tokenExpiresAt = Date.now() + 15 * 60 * 1000;

    if (purpose === "link") {
      // 소셜 계정 연결: 이미 가입된 번호도 인증할 수 있어야 한다.
      // 여기서는 본인 확인만 하고, 실제 연결은 completeSocialLink에서 한다.
      const linkToken = generateToken();
      await putToken({ storageKey: `link:${phone}`, code: linkToken, expiresAt: tokenExpiresAt });
      // 소셜 정보는 서버 대기 상태에만 있으므로 토큰 외에는 아무것도 돌려주지 않는다.
      return NextResponse.json({ ok: true, linkToken });
    }

    const existing = data.users.find((item) => normalizePhone(item.phone) === phone);
    if (existing) {
      if (purpose === "signup") {
        // 회원가입 진입점에서는 기존 회원을 로그인시키지 않고 로그인 화면으로 보낸다.
        return NextResponse.json(
          { error: "이미 가입된 번호입니다. 비밀번호로 로그인해 주세요." },
          { status: 400 },
        );
      }
      if (purpose === "reset") {
        // 비밀번호 재설정: 인증만 확인하고 단기 토큰을 발급한다.
        const resetToken = generateToken();
        await putToken({
          storageKey: `reset:${phone}`,
          code: resetToken,
          expiresAt: tokenExpiresAt,
        });
        return NextResponse.json({ ok: true, isNew: false, resetToken });
      }
    }
    if (purpose === "reset") {
      return NextResponse.json(
        { error: "가입되지 않은 번호입니다. 회원가입을 진행해 주세요." },
        { status: 400 },
      );
    }

    // 신규 회원: 가입 단계에서 인증을 다시 요구하지 않도록 단기 토큰만 발급한다.
    const signupToken = generateToken();
    await putToken({
      storageKey: `signup:${phone}`,
      code: signupToken,
      expiresAt: tokenExpiresAt,
    });
    return NextResponse.json({ ok: true, isNew: true, signupToken });
  }

  if (action === "signupComplete") {
    const phone = normalizePhone(String(body.phone ?? ""));
    const token = String(body.signupToken ?? "");
    const key = `signup:${phone}`;
    const saved = await readVerification(key, data);
    if (!saved || saved.code !== token) {
      return verificationExpired();
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
    if (!email) {
      return NextResponse.json({ error: "이메일을 입력해 주세요." }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "이메일을 확인해 주세요." }, { status: 400 });
    }

    // 인증 사이에 같은 번호로 가입된 경우 중복 생성하지 않는다.
    const existing = data.users.find((item) => normalizePhone(item.phone) === phone);
    if (existing) {
      const committed = await writeDataWithVerificationConsumes(
        data,
        consumeList(data, key, token, saved.source),
      );
      if (!committed.ok) return verificationExpired();
      await setUserId(existing.id);
      return NextResponse.json({ ok: true, isNew: false, user: toPublicUser(existing) });
    }

    const user: User = {
      ...emptyUser(phone, name, email),
      passwordHash: hashPassword(password),
      marketingAgreed: Boolean(body.marketingAgreed),
    };
    data.users.push(user);
    data.coupons[user.id] = [welcomeCoupon()];
    data.wishlists[user.id] = [];
    data.notifications[user.id] = [];
    data.notificationSettings[user.id] = { order: true, consult: true, notice: false };
    const committed = await writeDataWithVerificationConsumes(
      data,
      consumeList(data, key, token, saved.source),
    );
    if (!committed.ok) return verificationExpired();
    await setUserId(user.id);
    return NextResponse.json({ ok: true, isNew: true, user: toPublicUser(user) });
  }

  if (action === "completeSocialLink") {
    // SMS 인증을 마친 휴대폰 번호를 기준으로 소셜 계정을 연결한다.
    // provider / providerUserId는 클라이언트에서 받지 않고 서버 대기 상태에서만 읽는다.
    const phone = normalizePhone(String(body.phone ?? ""));
    const linkToken = String(body.linkToken ?? "");
    if (phone.length < 10) {
      return NextResponse.json({ error: "연락처를 입력해 주세요." }, { status: 400 });
    }
    const expired = () =>
      NextResponse.json(
        { error: "인증이 만료되었습니다. 처음부터 다시 진행해 주세요." },
        { status: 400 },
      );

    // A. 휴대폰 인증 토큰 확인.
    const key = `link:${phone}`;
    const saved = await readVerification(key, data);
    if (!linkToken || !saved || saved.code !== linkToken) {
      return expired();
    }

    const socialExpired = () =>
      NextResponse.json(
        { error: "소셜 로그인 정보가 만료되었습니다. 다시 로그인해 주세요." },
        { status: 400 },
      );

    // B. 소셜 정보는 오직 서버 대기 상태에서만 얻는다. 여기서는 읽기만 한다.
    //    먼저 폐기하면 아래 저장이 실패했을 때 대기 상태가 사라져
    //    사용자가 소셜 로그인부터 다시 해야 한다. 폐기는 연결과 같은 저장에서 함께 한다.
    const claimed = await readSocialLinkPendingForCommit(data);
    if (!claimed) {
      return socialExpired();
    }
    const providerKey = claimed.pending.provider === "kakao" ? "kakaoId" : "naverId";
    const providerLabel = claimed.pending.provider === "kakao" ? "카카오" : "네이버";

    // C. 실제 쓰기 직전에 최신 상태를 다시 읽는다.
    //    그 사이 같은 번호나 같은 소셜 ID가 먼저 등록됐을 수 있다.
    const latest = await readData();
    const latestToken = await readVerification(key, latest);
    if (!latestToken || latestToken.code !== linkToken) {
      return expired();
    }
    // 대기 상태도 최신 내용에서 다시 확인한다. 그사이 다른 요청이 소비했을 수 있다.
    const latestClaim = await readSocialLinkPendingForCommit(latest);
    if (!latestClaim || latestClaim.pending.providerUserId !== claimed.pending.providerUserId) {
      return socialExpired();
    }
    const pending = latestClaim.pending;

    // 같은 소셜 ID가 이미 다른 회원에게 붙어 있으면 연결하지 않는다.
    const ownedBySocial = latest.users.find((item) => item[providerKey] === pending.providerUserId);
    // 연결 대상은 인증한 번호의 회원이다. 여기서 phone도 다시 확인된다.
    const target = latest.users.find((item) => normalizePhone(item.phone) === phone);

    if (ownedBySocial && (!target || ownedBySocial.id !== target.id)) {
      return NextResponse.json(
        { error: `이미 다른 계정에 연결된 ${providerLabel} 계정입니다.` },
        { status: 400 },
      );
    }

    let user: User;
    if (target) {
      // D. 기존 회원: id와 이름·비밀번호·포인트·쿠폰·주문은 그대로 두고 소셜 ID만 붙인다.
      const current = target[providerKey];
      if (current && current !== pending.providerUserId) {
        // 이미 다른 소셜 ID가 연결되어 있으면 덮어쓰지 않는다.
        return NextResponse.json(
          { error: `이미 다른 ${providerLabel} 계정이 연결되어 있습니다.` },
          { status: 400 },
        );
      }
      target[providerKey] = pending.providerUserId;
      user = target;
    } else {
      // E. 이 번호의 회원이 정말 없을 때만 신규 회원 1명을 만든다.
      //    웰컴 쿠폰과 딸린 컬렉션 초기화는 registerUser가 여기서 한 번만 수행한다.
      user = {
        ...emptyUser(phone, pending.nickname || `${providerLabel} 회원`),
        [providerKey]: pending.providerUserId,
      };
      registerUser(latest, user);
    }

    // 링크 토큰과 소셜 대기 상태를 연결과 같은 저장 한 문장으로 함께 소비한다.
    // 저장이 실패하면 셋 다 그대로 남아 처음부터 다시 하지 않아도 된다.
    const committed = await writeDataWithVerificationConsumes(latest, [
      ...consumeList(latest, key, linkToken, latestToken.source),
      // 대기 상태는 키 자체가 비밀 토큰이라 값까지 맞춰 볼 필요가 없다.
      ...consumeList(latest, latestClaim.storageKey, null, latestClaim.source),
    ]);
    if (!committed.ok) return expired();

    // 저장이 끝난 뒤에만 대기 상태 쿠키를 지운다.
    await clearSocialLinkCookie();
    await setUserId(user.id);

    // 신청 화면에서 로그인으로 넘어온 경우 그 자리로 되돌려 보낸다.
    const store = await cookies();
    const savedNext = store.get(LOGIN_NEXT_COOKIE)?.value;
    const next = safeNextPath(savedNext ? decodeURIComponent(savedNext) : null);
    store.delete(LOGIN_NEXT_COOKIE);
    return NextResponse.json({ ok: true, redirect: next ?? LOGIN_DEFAULT_PATH });
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
    return NextResponse.json({ ok: true, user: toPublicUser(user) });
  }

  if (action === "resetPassword") {
    const phone = normalizePhone(String(body.phone ?? ""));
    const token = String(body.resetToken ?? "");
    const key = `reset:${phone}`;
    const saved = await readVerification(key, data);
    if (!saved || saved.code !== token) {
      return verificationExpired();
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
    const committed = await writeDataWithVerificationConsumes(
      data,
      consumeList(data, key, token, saved.source),
    );
    if (!committed.ok) return verificationExpired();
    return NextResponse.json({ ok: true });
  }

  if (action === "logout") {
    await clearUserId();
    return NextResponse.json({ ok: true });
  }


  if (action === "createInquiry") {
    // 무료 상담·이벤트는 비회원도 접수한다. 계정을 만들지 않고 문의만 저장한다.
    const sessionUserId = await getActiveUserId();
    const member = sessionUserId
      ? (data.users.find((item) => item.id === sessionUserId) ?? null)
      : null;
    const name = String(body.name ?? member?.name ?? "").trim();
    const phone = String(body.phone ?? member?.phone ?? "").trim();
    const product = String(body.product ?? "").trim();
    const method = String(body.method ?? "카카오톡 상담").trim();
    const message = String(body.message ?? "").trim();
    // 챗봇에서 온 문의만 더 엄격하게 본다. 기존 무료상담·이벤트 접수 조건은 그대로 둔다.
    const fromChat = product === CHAT_INQUIRY_PRODUCT;
    if (!name) {
      return NextResponse.json({ error: "이름을 입력해 주세요." }, { status: 400 });
    }
    if (normalizePhone(phone).length < 10) {
      return NextResponse.json({ error: "연락처를 입력해 주세요." }, { status: 400 });
    }
    if (fromChat) {
      // 연락 방법과 상관없이 휴대폰 번호만 받는다. 카카오톡 아이디는 받지 않는다.
      if (!/^01[016789]\d{7,8}$/.test(normalizePhone(phone))) {
        return NextResponse.json({ error: "휴대폰 번호를 정확히 입력해 주세요." }, { status: 400 });
      }
      if (!CHAT_INQUIRY_METHODS.includes(method)) {
        return NextResponse.json({ error: "연락받을 방법을 선택해 주세요." }, { status: 400 });
      }
      if (!message) {
        return NextResponse.json({ error: "문의 내용을 입력해 주세요." }, { status: 400 });
      }
    }
    const item: Inquiry = {
      id: nowId(),
      // app_store는 한 덩어리로 저장되므로 지나치게 긴 값은 잘라서 담는다.
      name: name.slice(0, 40),
      phone: phone.slice(0, 40),
      method: method.slice(0, 40),
      product: product.slice(0, 120),
      message: message.slice(0, 1000),
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
  // 탈퇴한 회원은 세션 쿠키가 남아 있어도 로그인 상태로 보지 않는다.
  if (!isActiveUser(user)) {
    return NextResponse.json({ error: "회원 정보를 찾을 수 없습니다." }, { status: 401 });
  }

  if (action === "updateProfile") {
    // 회원이 직접 고칠 수 있는 항목만 반영한다. id·points·passwordHash처럼
    // 서버가 관리하는 값은 클라이언트가 보내도 무시한다.
    const profile = (body.profile as Record<string, unknown>) ?? {};
    const next: User = { ...user };
    const has = (key: string) => Object.prototype.hasOwnProperty.call(profile, key);

    if (has("name")) next.name = String(profile.name ?? "");
    if (has("phone")) next.phone = String(profile.phone ?? "");
    if (has("email")) next.email = String(profile.email ?? "");
    if (has("birth")) next.birth = String(profile.birth ?? "");
    if (has("birthTime")) next.birthTime = String(profile.birthTime ?? "");
    if (has("bloodType")) next.bloodType = String(profile.bloodType ?? "");
    if (has("gender")) {
      const value = String(profile.gender ?? "");
      // 저장 형식은 기존 그대로 male / female / 빈 값만 인정한다.
      if (value === "male" || value === "female" || value === "") next.gender = value;
    }
    if (has("calendar")) {
      const value = String(profile.calendar ?? "");
      if (value === "solar" || value === "lunar") next.calendar = value;
    }
    if (has("unknownTime")) next.unknownTime = Boolean(profile.unknownTime);
    if (has("marketingAgreed")) next.marketingAgreed = Boolean(profile.marketingAgreed);

    data.users = data.users.map((item) => (item.id === userId ? next : item));
    await writeData(data);
    return NextResponse.json({ ok: true, user: toPublicUser(next) });
  }

  if (action === "withdrawAccount") {
    /**
     * 회원 탈퇴 실행. 되돌릴 수 없으므로 본인확인 → blocker 재확인을 모두 통과한
     * 요청만 진행한다. 본인확인과 blocker 단계에서는 아무것도 저장하지 않는다.
     *
     * 위에서 getUserId() + isActiveUser()로 활성 회원을 이미 확정했다.
     * (getActiveUserId()와 같은 검사이며, 저장소를 한 번 더 읽지 않으려고 재사용한다.)
     */

    // 1) 본인확인. 실패 메시지는 어떤 단계에서 걸렸는지 알려주지 않는다.
    const verifyFailed = () =>
      NextResponse.json({ error: "본인 확인에 실패했습니다." }, { status: 400 });

    /** 카카오 연결 끊기에 쓸 access token. 비밀번호 회원이거나 네이버면 빈 문자열이다. */
    let kakaoAccessToken = "";
    /** 네이버 연동 해제에 쓸 access token. 비밀번호 회원이거나 카카오면 빈 문자열이다. */
    let naverAccessToken = "";
    /** 네이버 소셜 재인증으로 들어온 탈퇴인지. 토큰이 비어 있어도 해제를 건너뛰지 않기 위해 둔다. */
    let isNaverWithdraw = false;

    if (user.passwordHash) {
      // 비밀번호가 있는 회원은 비밀번호로만 확인한다.
      // 소셜 재인증 토큰을 들고 와도 이 분기로 들어오므로 우회할 수 없다.
      const password = String(body.password ?? "");
      if (!password || !verifyPassword(password, user.passwordHash)) {
        return verifyFailed();
      }
    } else {
      // 소셜 전용 회원. 토큰은 읽는 즉시 폐기되므로 재사용할 수 없다.
      const verification = await consumeWithdrawVerification();
      if (!verification || verification.userId !== user.id) {
        return verifyFailed();
      }
      const providerKey = verification.provider === "kakao" ? "kakaoId" : "naverId";
      // 재인증한 소셜 계정이 지금도 이 회원에 연결되어 있는지 다시 본다.
      if (!user[providerKey] || user[providerKey] !== verification.providerUserId) {
        return verifyFailed();
      }
      // 카카오는 탈퇴 직전에 연결까지 끊는다. 토큰은 이 요청 안에서만 쓰고 남기지 않는다.
      if (verification.provider === "kakao") {
        kakaoAccessToken = verification.accessToken ?? "";
      }
      // 네이버도 같은 원칙으로 탈퇴 직전에 연동을 해제한다.
      if (verification.provider === "naver") {
        isNaverWithdraw = true;
        naverAccessToken = verification.accessToken ?? "";
      }
    }

    /**
     * 2) 최신 상태를 다시 읽는다. 소셜 경로는 토큰을 폐기하면서 저장소를 이미 바꿨고,
     *    본인확인 사이에 새 주문·결제가 생겼을 수도 있다.
     *    여기서 읽은 latest 위에서만 비식별화하고 저장한다.
     *    (위쪽 data로 저장하면 방금 폐기한 토큰이 되살아난다.)
     */
    const latest = await readData();
    const target = latest.users.find((item) => item.id === user.id);
    if (!target) {
      return NextResponse.json({ error: "회원 정보를 찾을 수 없습니다." }, { status: 401 });
    }
    // 이 회원의 탈퇴가 이미 끝나 있으면(같은 요청이 두 번 들어왔거나 앞선 시도가 저장까지 마쳤다면)
    // 실패로 돌려보내지 않는다. 세션만 정리하고 끝난 것으로 안내한다.
    // 대상은 세션 회원 본인(user.id)으로 찾은 행이므로 남의 탈퇴를 성공으로 바꾸지 않는다.
    if (!isActiveUser(target)) {
      await clearUserId();
      return NextResponse.json({
        ok: true,
        withdrawn: true,
        orderDetailsScrubbed: true,
        paymentSnapshotScrubbed: true,
        needsManualCleanup: false,
      });
    }

    // 3) 진행 중인 서비스가 있으면 탈퇴하지 않는다. 여기까지 아무것도 저장하지 않았다.
    const blockers = await findWithdrawBlockers(latest, target.id);
    if (blockers.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "진행 중인 서비스가 있어 탈퇴할 수 없습니다.",
          blockers,
        },
        { status: 409 },
      );
    }

    /**
     * 4) 카카오 연결 끊기. 아직 아무것도 저장하지 않은 지점에서 먼저 처리한다.
     *    탈퇴가 끝나면 kakaoId가 지워져 어떤 계정을 끊어야 하는지 알 수 없게 되므로,
     *    끊지 못하면 데이터를 건드리지 않고 여기서 멈춘다(되돌릴 것이 없다).
     *    이미 끊겨 있던 경우는 목적이 이뤄진 것으로 보고 계속 진행한다.
     */
    // 지난 시도에서 이미 끊고 저장만 실패했을 수 있다. 그때는 끊을 대상이 남아 있지 않으므로
    // 다시 끊으려 하지 않는다. 여기서 막으면 탈퇴가 영원히 끝나지 않는다.
    if (kakaoAccessToken && target.kakaoId) {
      const unlinked = await unlinkKakao(kakaoAccessToken);
      if (unlinked === "failed") {
        return NextResponse.json(
          {
            error:
              "카카오 연결 해제에 실패했습니다. 카카오 본인 확인을 다시 하신 뒤 시도해 주세요.",
          },
          { status: 502 },
        );
      }
    }

    /**
     * 5) 네이버 연동 해제. 카카오와 같은 이유로 아직 아무것도 저장하지 않은 지점에서 처리한다.
     *    탈퇴가 끝나면 naverId가 지워져 어떤 계정을 해제해야 하는지 알 수 없게 된다.
     *    토큰이 없으면 해제 자체가 불가능하므로 진행하지 않고 여기서 멈춘다.
     */
    if (isNaverWithdraw && target.naverId) {
      const revoked = naverAccessToken ? await unlinkNaver(naverAccessToken) : "failed";
      if (revoked === "failed") {
        return NextResponse.json(
          {
            error:
              "네이버 연결 해제에 실패했습니다. 네이버 본인 확인을 다시 하신 뒤 시도해 주세요.",
          },
          { status: 502 },
        );
      }
    }

    /**
     * 6) 개인정보 비식별화 + details 사본 정리. 주문·상담 행과 후기는 지우지 않는다.
     *
     * 여기부터는 되돌릴 수 없는 일(본인확인 토큰 소비, 소셜 연결 해제)이 이미 끝났다.
     * 저장이 다른 요청과 겹쳐 밀리면 사용자는 스스로 다시 탈퇴할 방법이 없으므로
     * 이 저장 구간만 몇 번 다시 시도한다. 위쪽 일들은 이 안에 들어오지 않는다.
     *
     * 매번 최신 내용을 새로 읽어 그 위에 비식별화를 다시 적용한다.
     * 밀린 객체를 그대로 다시 저장하면 그사이 다른 요청이 저장한 내용이 사라진다.
     */
    const WITHDRAW_SAVE_ATTEMPTS = 3;
    /** 저장까지 끝난 회원 id. 아래 SQL 정리와 응답에서 쓴다. */
    let withdrawnUserId = "";
    /** 이미 탈퇴가 끝나 있어 이번 요청이 저장할 것이 없었던 경우. */
    let alreadyWithdrawn = false;
    /** 재시도 중 새 blocker가 생겨 멈춘 경우. 기존 정책 그대로 409로 돌려준다. */
    let lateBlockers: Awaited<ReturnType<typeof findWithdrawBlockers>> = [];
    let saveConflicted = false;

    for (let attempt = 1; attempt <= WITHDRAW_SAVE_ATTEMPTS; attempt += 1) {
      // 첫 회차는 위에서 읽은 latest를 그대로 쓰고, 이후에는 새로 읽는다.
      const fresh = attempt === 1 ? latest : await readData();
      const freshTarget = fresh.users.find((item) => item.id === user.id);
      if (!freshTarget) {
        return NextResponse.json({ error: "회원 정보를 찾을 수 없습니다." }, { status: 401 });
      }
      // 그사이 같은 회원의 탈퇴가 끝났다면 더 저장할 것이 없다.
      if (!isActiveUser(freshTarget)) {
        // 세션 회원 본인의 행이다(위에서 id로 찾았다). 남의 탈퇴를 성공으로 바꾸지 않는다.
        withdrawnUserId = user.id;
        alreadyWithdrawn = true;
        break;
      }

      // 겹친 요청이 새 주문·상담을 만들었을 수 있다. 기존 정책을 최신 내용에 그대로 다시 적용한다.
      const freshBlockers =
        attempt === 1 ? blockers : await findWithdrawBlockers(fresh, freshTarget.id);
      if (freshBlockers.length > 0) {
        lateBlockers = freshBlockers;
        break;
      }

      anonymizeWithdrawnUser(fresh, freshTarget);
      scrubUserRecords(fresh, freshTarget.id);

      try {
        await writeData(fresh);
        withdrawnUserId = freshTarget.id;
        saveConflicted = false;
        break;
      } catch (error) {
        // 겹쳐서 밀린 경우에만 다음 회차로 간다. 그 밖의 오류는 그대로 실패다.
        if (!isAppStoreConflict(error)) {
          return NextResponse.json(
            { error: "탈퇴 처리에 실패했습니다. 잠시 후 다시 시도해 주세요." },
            { status: 500 },
          );
        }
        saveConflicted = true;
        // 개인정보는 남기지 않는다. 몇 번째 시도였는지만 남긴다.
        console.warn(`[withdraw] store conflict on attempt ${attempt}`);
      }
    }

    // 새 blocker가 생겼으면 기존 정책 그대로 탈퇴를 진행하지 않는다.
    if (lateBlockers.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "진행 중인 서비스가 있어 탈퇴할 수 없습니다.",
          blockers: lateBlockers,
        },
        { status: 409 },
      );
    }

    // 정해진 횟수를 모두 겹쳐서 놓쳤다. 소셜 연결 해제는 다시 시도하지 않는다.
    if (!withdrawnUserId) {
      if (saveConflicted) console.warn("[withdraw] store conflict exhausted");
      return NextResponse.json(
        { error: "탈퇴 처리에 실패했습니다. 잠시 후 다시 시도해 주세요." },
        { status: 500 },
      );
    }

    // 이미 끝나 있던 경우에는 아래 SQL 정리를 다시 하지 않고 세션만 정리한다.
    if (alreadyWithdrawn) {
      await clearUserId();
      return NextResponse.json({
        ok: true,
        withdrawn: true,
        orderDetailsScrubbed: true,
        paymentSnapshotScrubbed: true,
        needsManualCleanup: false,
      });
    }

    /**
     * 7) SQL orders 테이블의 details도 같은 allowlist로 정리한다.
     *    JSONB와 달리 이쪽이 운영의 읽기 경로라 여기에 남으면 개인정보가 실제로 조회된다.
     *    실패해도 되돌리지 않는다. 탈퇴는 이미 성립했고 이 함수는 몇 번 실행해도 결과가 같다.
     *    다만 결제 스냅샷보다 중대한 잔존이므로 서버 로그에 남기고 응답에도 표시한다.
     */
    let orderDetailsScrubbed = true;
    try {
      await scrubOrderDetailsByUser(withdrawnUserId, KEPT_DETAIL_KEYS);
    } catch {
      orderDetailsScrubbed = false;
      // 운영자가 같은 함수를 다시 실행해 정리해야 한다. 개인정보는 로그에 남기지 않는다.
      console.error("[withdraw] orders.details scrub failed");
    }

    /**
     * 8) 결제 스냅샷의 신청 내용 사본 제거. 여기서 실패해도 위 저장은 이미 끝났고
     *    회원은 탈퇴한 상태다. 되돌리지 않고 실패 사실만 응답에 남긴다.
     *    (남는 값은 order_snapshot.details 하나뿐이고 운영자가 뒤에 정리할 수 있다.)
     */
    let paymentSnapshotScrubbed = true;
    try {
      await scrubPaymentSnapshotDetailsByUser(withdrawnUserId);
    } catch {
      paymentSnapshotScrubbed = false;
    }

    /**
     * 9) 상담원 문의방의 이름·연락처 익명화. chat_inquiries는 app_store가 아니라
     *    별도 테이블이라 6)의 writeData로는 닿지 않는다.
     *    메시지 본문과 user_id는 건드리지 않는다. 7)·8)과 같이 실패해도 되돌리지 않는다.
     */
    let chatInquiriesScrubbed = true;
    try {
      await scrubChatInquiriesByUser(withdrawnUserId, WITHDRAWN_NAME);
    } catch {
      chatInquiriesScrubbed = false;
      // 운영자가 같은 함수를 다시 실행해 정리해야 한다. 개인정보는 로그에 남기지 않는다.
      console.error("[withdraw] chat_inquiries scrub failed");
    }

    // 10) 마지막으로 세션을 끊는다. 탈퇴 자체는 6)의 writeData에서 이미 확정됐다.
    await clearUserId();
    return NextResponse.json({
      ok: true,
      withdrawn: true,
      orderDetailsScrubbed,
      paymentSnapshotScrubbed,
      // 남은 사본이 있으면 운영자 확인이 필요하다는 사실을 응답에도 남긴다.
      needsManualCleanup:
        !orderDetailsScrubbed || !paymentSnapshotScrubbed || !chatInquiriesScrubbed,
    });
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
