/**
 * 주문·상담 확정 로직. /api/app 의 createOrder / createConsultation 안에 있던 코드를
 * 그대로 옮겨 온 것이고, 규칙은 하나도 바꾸지 않았다.
 *
 * 여기로 옮긴 이유는 NICEPAY 승인 경로가 같은 로직을 써야 하기 때문이다.
 * 승인 callback에는 로그인 세션이 없으므로(NICEPAY가 보내는 크로스사이트 POST)
 * 이 파일의 함수들은 요청·세션·쿠키를 전혀 모르고, 필요한 값을 인자로만 받는다.
 */
import { calcConsultationAmount, calcOrderAmount } from "@/lib/server/pricing";
import { isSlotAvailable, parseDatetime } from "@/lib/server/consultationSlots";
import { nowId, writeDataWithOrder } from "@/lib/server/store";
import type { AppData, Consultation, CouponProduct, Order, User } from "@/lib/types/app";

export const REFERRAL_DISCOUNT = 10000;
export const REFERRAL_POINTS = 10000;

export function referralCodeFor(user: User): string {
  const raw = user.id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const tail = (raw.slice(-6) || "HOME").padStart(6, "0");
  return `IS${tail}`;
}

export function applyReferral(
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

export function applyFreeCoupon(
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

export function applyPoints(
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

export function settledPayment(
  amount: number,
  details: Record<string, string>,
  fallback: string,
) {
  if (amount > 0) return fallback;
  if (details.couponFree === "1") return "무료 쿠폰";
  if (details.pointsUsed) return "적립금";
  return fallback;
}

/* ------------------------------------------------------------------ *
 * 주문 확정
 * ------------------------------------------------------------------ */

/** 신청 화면과 승인 경로가 함께 쓰는 인생곡 신청 내용. */
export interface OrderInput {
  product: unknown;
  title: unknown;
  options: unknown;
  payment: unknown;
  details: Record<string, string>;
}

/** 신청 화면과 승인 경로가 함께 쓰는 상담 신청 내용. */
export interface ConsultationInput {
  title: unknown;
  report: unknown;
  extraPerson: unknown;
  payment: unknown;
  teacher: unknown;
  datetime: unknown;
  purpose: unknown;
  method: unknown;
  option: unknown;
  details: Record<string, string>;
}

/**
 * 저장 방법. 기본은 지금까지와 같은 writeDataWithOrder다.
 * NICEPAY 승인 경로는 다음 단계에서 payments 갱신까지 한 트랜잭션으로 묶은
 * 다른 저장 함수를 넘길 수 있도록 열어 둔다.
 */
export type CommitWriter = (data: AppData, order: Order) => Promise<void>;

export type CommitResult<T> = ({ ok: true } & T) | { ok: false; error: string; status: number };

/**
 * NICEPAY 승인 경로가 쓸 주문 id. 같은 merchantOrderId면 항상 같은 값이라
 * 승인 callback이 두 번 들어와도 orders의 ON CONFLICT (id) DO NOTHING이 실제로 동작한다.
 * merchantOrderId는 서버(preparePayment)가 만든 값이며 사용자 입력이 아니다.
 */
export function orderIdForPayment(merchantOrderId: string): string {
  return `o-${merchantOrderId}`;
}

/** 상담은 Consultation과 결제 귀속 주문이 같은 id를 쓰므로 접두사만 다르다. */
export function consultationIdForPayment(merchantOrderId: string): string {
  return `c-${merchantOrderId}`;
}

/**
 * 인생곡 주문 확정. data와 user를 직접 바꾸고 저장까지 마친다.
 * orderId를 넘기지 않으면 기존과 같이 nowId()로 만든다.
 */
export async function commitOrder(
  data: AppData,
  user: User,
  input: OrderInput,
  options: { orderId?: string; write?: CommitWriter } = {},
): Promise<CommitResult<{ order: Order }>> {
  const userId = user.id;
  const details = input.details;
  // 금액은 클라이언트 값을 쓰지 않고 서버 가격표로 다시 계산한다.
  const priced = calcOrderAmount(input.product, input.options);
  if (!priced) {
    return { ok: false, error: "신청 내용을 다시 확인해 주세요.", status: 400 };
  }
  const product = input.product as Order["product"];
  details.optionIds = priced.optionIds.join(",");
  const couponed = applyFreeCoupon(data, userId, details, priced.amount, product);
  if (couponed.error) {
    return { ok: false, error: couponed.error, status: 400 };
  }
  const referred =
    couponed.amount > 0
      ? applyReferral(data, userId, couponed.details, couponed.amount)
      : couponed;
  if (referred.error) {
    return { ok: false, error: referred.error, status: 400 };
  }
  const pointed = applyPoints(user, referred.details, referred.amount);
  const order: Order = {
    id: options.orderId ?? nowId(),
    userId,
    product,
    title: String(input.title ?? "인생곡"),
    status: "신청접수",
    amount: pointed.amount,
    baseAmount: priced.amount,
    payment: settledPayment(pointed.amount, pointed.details, String(input.payment ?? "")),
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
  await (options.write ?? writeDataWithOrder)(data, order);
  return { ok: true, order };
}

/**
 * 1:1 사주상담 확정. 상담과 결제 귀속 주문을 함께 만든다.
 * id를 넘기지 않으면 기존과 같이 `c-${nowId()}`를 쓴다.
 */
export async function commitConsultation(
  data: AppData,
  user: User,
  input: ConsultationInput,
  options: { consultationId?: string; write?: CommitWriter } = {},
): Promise<CommitResult<{ consultation: Consultation; order: Order }>> {
  const userId = user.id;
  const teacher = String(input.teacher ?? "유비 선생");
  const datetime = String(input.datetime ?? "");
  const parsed = parseDatetime(datetime);
  if (!parsed) {
    return { ok: false, error: "상담 시간을 다시 선택해 주세요.", status: 400 };
  }
  if (!isSlotAvailable(data, teacher, parsed.date, parsed.time)) {
    return {
      ok: false,
      error: "이미 예약되었거나 선택할 수 없는 시간입니다. 다른 시간을 선택해 주세요.",
      status: 409,
    };
  }

  const details = input.details;
  // 상담 금액도 서버에서 기본가 + 옵션가로 다시 계산한다.
  const priced = calcConsultationAmount({
    report: input.report,
    extraPerson: input.extraPerson,
  });
  details.optionIds = priced.optionIds.join(",");
  const couponed = applyFreeCoupon(data, userId, details, priced.amount, "consultation");
  if (couponed.error) {
    return { ok: false, error: couponed.error, status: 400 };
  }
  const referred =
    couponed.amount > 0
      ? applyReferral(data, userId, couponed.details, couponed.amount)
      : couponed;
  if (referred.error) {
    return { ok: false, error: referred.error, status: 400 };
  }
  const pointed = applyPoints(user, referred.details, referred.amount);

  // 상담과 결제 귀속용 주문이 같은 건임을 알 수 있도록 id와 시각을 공유한다.
  const id = options.consultationId ?? `c-${nowId()}`;
  const createdAt = new Date().toISOString();
  const consultTeacher = teacher;
  const consultDatetime = datetime;
  const consultPurpose = String(input.purpose ?? "");
  const consultMethod = String(input.method ?? "카카오톡 상담");
  const consultOption = String(input.option ?? "없음");

  const item: Consultation = {
    id,
    userId,
    teacher: consultTeacher,
    datetime: consultDatetime,
    purpose: consultPurpose,
    method: consultMethod,
    option: consultOption,
    status: "상담 신청",
    amount: pointed.amount,
    details: pointed.details,
    createdAt,
  };
  data.consultations.unshift(item);

  // 결제는 주문 단위로 귀속시킨다. 상담 진행 상태는 위 Consultation이 계속 관리하므로
  // 이 주문은 "신청접수"로 두고, 할인 계산은 위에서 끝난 값을 그대로 재사용한다.
  const consultOrder: Order = {
    id,
    userId,
    product: "consultation",
    title: "1:1 사주상담",
    status: "신청접수",
    amount: pointed.amount,
    baseAmount: priced.amount,
    payment: settledPayment(pointed.amount, pointed.details, String(input.payment ?? "")),
    details: {
      ...pointed.details,
      teacher: consultTeacher,
      datetime: consultDatetime,
      purpose: consultPurpose,
      method: consultMethod,
      option: consultOption,
    },
    createdAt,
  };
  data.orders.unshift(consultOrder);
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
  await (options.write ?? writeDataWithOrder)(data, consultOrder);
  return { ok: true, consultation: item, order: consultOrder };
}
