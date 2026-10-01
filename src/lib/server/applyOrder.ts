/**
 * 주문·상담 확정 로직. /api/app 의 createOrder / createConsultation 안에 있던 코드를
 * 그대로 옮겨 온 것이고, 규칙은 하나도 바꾸지 않았다.
 *
 * 여기로 옮긴 이유는 NICEPAY 승인 경로가 같은 로직을 써야 하기 때문이다.
 * 승인 callback에는 로그인 세션이 없으므로(NICEPAY가 보내는 크로스사이트 POST)
 * 이 파일의 함수들은 요청·세션·쿠키를 전혀 모르고, 필요한 값을 인자로만 받는다.
 */
import { calcConsultationAmount, calcOrderAmount } from "@/lib/server/pricing";
import type { PromotionId } from "@/lib/constants/promotions";
import {
  isSlotAvailable,
  parseDatetime,
  resolveConfirmedScheduledAt,
  resolveScheduledAt,
} from "@/lib/server/consultationSlots";
import {
  buildCopyrightConsent,
  buildOrderConsent,
  checkCopyrightConsent,
  checkOrderConsent,
} from "@/lib/server/consents";
import { hasVerifiedPhone } from "@/lib/phoneVerification";
import { nowId, writeData, writeDataWithOrder } from "@/lib/server/store";
import { prepareEventConsultation } from "@/lib/server/eventConsultation";
import type { EventConsultationFacts, EventConsultationInput, EventConsultationResult } from "@/lib/server/eventConsultation";
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
  /**
   * 추천인으로 인정하는 것은 휴대폰 본인확인을 마친 회원뿐이다.
   *
   * 추천인 코드는 user.id만으로 만들어지므로(위 referralCodeFor) 회원이 생기는 즉시
   * 유효한 코드를 갖는다. 본인확인 전 회원까지 인정하면 그 회원은 아무 행동을 하지
   * 않았는데도 포인트가 쌓이고, 남의 주문 details에 referrerId로 id가 영구히 남는다.
   * 나중에 그 회원을 같은 번호의 기존 회원으로 합칠 때 옮기거나 되돌릴 수 없는 값이다.
   *
   * 코드 만드는 규칙(referralCodeFor)은 그대로 두고, 인정하는 대상만 좁힌다.
   * 이 판정은 탈퇴 회원도 함께 걸러 낸다(hasVerifiedPhone이 withdrawnAt을 본다).
   * 탈퇴 비식별화는 id를 바꾸지 않아 코드가 그대로 살아 있었다.
   */
  const referrer = data.users.find(
    (item) => hasVerifiedPhone(item) && referralCodeFor(item) === code,
  );
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

/**
 * 이벤트가 주문에 할인·차감을 겹쳐 쓰려 할 때 쓰는 문구.
 *
 * 어떤 수단이 걸렸는지 나누지 않는다. 쓸 수 없다는 사실이 같고, 나누면
 * "무엇을 빼면 통과하는지"를 하나씩 알려 주는 안내가 된다.
 */
export const PROMOTION_DISCOUNT_ERROR =
  "오픈 이벤트 상품에는 추가 할인이나 포인트를 사용할 수 없습니다.";

/**
 * 이벤트가 주문에 할인·차감 수단이 함께 들어왔는지. 걸리면 문구를, 아니면 undefined.
 *
 * 프로모션은 상품의 기본가 자체를 낮추는 값이라(PROMOTION_PRICES) 그 자체가 최종
 * 할인가다. 여기에 쿠폰·추천인·관리자 코드·적립금을 더하면 이벤트 상품이 거의 0원이 된다.
 * 옵션을 붙여 금액이 올라가도 기본가가 이벤트가인 것은 그대로이므로 옵션을 보지 않는다.
 *
 * 특정 이벤트 id를 적지 않는다. 프로모션은 모두 "기본가를 낮춘 가격"이라는 뜻이 같아,
 * 새 이벤트가 생길 때마다 이 자리를 고치지 않아도 같은 규칙이 걸린다.
 *
 * ★ promotion은 반드시 서버 가격표를 통과한 값이어야 한다(checkPromotionEntry의 결과이거나
 * calcOrderAmount의 PriceResult.promotion). 클라이언트가 보낸 문자열을 그대로 넘기면
 * 아무 값이나 실어 보내는 것만으로 이 판정을 흔들 수 있다.
 *
 * 관리자 코드(adminPromo)는 따로 보지 않는다. 그 코드는 referralCode 칸으로 들어와
 * applyReferral이 판정하므로(이 파일 위쪽), referralCode 하나로 두 수단이 함께 걸린다.
 */
export function promotionDiscountConflict(
  details: Record<string, string>,
  promotion?: PromotionId,
): string | undefined {
  if (!promotion) return undefined;
  const wantsDiscount =
    Boolean((details.couponId ?? "").trim()) ||
    Boolean((details.referralCode ?? "").trim()) ||
    details.usePoints === "1";
  return wantsDiscount ? PROMOTION_DISCOUNT_ERROR : undefined;
}

export function applyFreeCoupon(
  data: AppData,
  userId: string,
  details: Record<string, string>,
  amount: number,
  product: CouponProduct,
  /**
   * 이 주문에 실제로 적용된 프로모션. 가격표를 통과한 값만 넘어온다
   * (calcOrderAmount의 PriceResult.promotion / checkPromotionEntry의 결과).
   *
   * 클라이언트가 보낸 문자열을 그대로 넘기지 않는다. 그랬다면 아무 값이나 실어
   * 보내는 것만으로 이 판정을 흔들 수 있다. 상담에는 프로모션이 없어 넘기지 않는다.
   */
  promotion?: PromotionId,
): { amount: number; details: Record<string, string>; error?: string } {
  const couponId = (details.couponId ?? "").trim();
  if (!couponId) return { amount, details };
  /*
   * 이벤트가로 사는 주문에는 무료 쿠폰을 겹쳐 쓸 수 없다.
   *
   * 프로모션은 상품의 기본가 자체를 낮추는 값이라(PROMOTION_PRICES) 이미 할인된
   * 가격이다. 거기에 무료 쿠폰까지 얹으면 이벤트 상품을 0원에 가져가게 된다.
   * 옵션을 붙여 금액이 올라가도 기본가가 이벤트가인 것은 그대로이므로 옵션 유무를
   * 보지 않는다.
   *
   * 특정 이벤트 id를 적지 않는다. 프로모션은 모두 "기본가를 낮춘 가격"이라는 뜻이
   * 같아서, 새 이벤트가 생길 때마다 이 자리를 고치지 않아도 같은 규칙이 걸린다.
   */
  if (promotion) {
    return { amount, details, error: PROMOTION_DISCOUNT_ERROR };
  }
  const list = data.coupons[userId] ?? [];
  const coupon = list.find((item) => item.id === couponId);
  if (!coupon) {
    return { amount, details, error: "쿠폰을 확인해 주세요." };
  }
  if (coupon.usedAt) {
    return { amount, details, error: "이미 사용한 쿠폰입니다." };
  }
  /*
   * 사용기한. 회원 쿠폰에 복사되어 있는 값만 본다.
   *
   * 코드 원본(AppData.couponCodes)은 조회하지 않는다. 원본의 active와 기한은
   * "지금 새로 등록을 받는가"를 정하는 값이고, 이미 받아 둔 쿠폰의 사용 조건은
   * 등록 시점에 복사된 이 값이다. 원본을 다시 보면 관리자가 코드를 닫는 순간
   * 이미 나간 쿠폰까지 함께 막혀 버린다.
   *
   * 값이 없으면 "기한 없음"이다. 기존 쿠폰과 관리자가 직접 지급한 무료 쿠폰이
   * 여기에 해당하며, 기한을 지어내지 않는다.
   *
   * 경계는 expiresAt까지 포함이다(now <= expiresAt이면 쓸 수 있다). 저장된 값이
   * 그 날 한국 시각 23:59:59이므로, 그 순간을 지났을 때만 만료로 본다.
   *
   * 값이 있는데 읽을 수 없으면 쓰지 못하게 막는다. 기한이 적혀 있다는 것은 조건이
   * 붙은 쿠폰이라는 뜻이고, 그 조건을 확인할 수 없는 채로 무료 처리하면 기한이
   * 지난 쿠폰을 그냥 받아 주는 것과 같아진다. 만료와는 원인이 다르므로 문구도 나눈다.
   */
  if (coupon.expiresAt) {
    const expiresAt = new Date(coupon.expiresAt).getTime();
    if (Number.isNaN(expiresAt)) {
      return { amount, details, error: "쿠폰 사용기한 정보를 확인할 수 없습니다." };
    }
    if (Date.now() > expiresAt) {
      return { amount, details, error: "사용기한이 지난 쿠폰입니다." };
    }
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
  /**
   * 프로모션 식별자. 실제 상품 옵션(options)과 다른 축이라 따로 받는다.
   *
   * 기간 검증은 여기서 하지 않는다. 최초 요청에서 checkPromotionEntry가 이미 했고,
   * 승인·복구 경로는 snapshot에 고정된 값을 그대로 넘긴다(그래서 날짜를 다시 보면 안 된다).
   * 가격표에 없는 값이면 아래 calcOrderAmount가 null을 돌려주어 주문이 만들어지지 않는다.
   */
  promotion?: unknown;
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
 * 확정 모드. 돈을 받아야 하는 건을 받지 않고 확정하는 일을 막는다.
 *
 * free-only    서버가 계산한 최종금액이 0원일 때만 확정한다. 기본값이다.
 * paid-approved 결제 승인이 끝난 뒤에만 쓴다. 유료 금액도 확정한다.
 *
 * 이 값은 서버 코드에서만 넘긴다. 요청 본문에서 읽지 않는다.
 * 기본값을 free-only로 둔 이유는, 앞으로 새 호출부가 생겨도 모드를 잊으면
 * 유료 건이 통과되는 쪽이 아니라 막히는 쪽으로 기울게 하기 위해서다.
 */
export type CommitMode = "free-only" | "paid-approved";

/** 승인 없이 유료 건을 확정하려 할 때의 응답. 화면 문구가 아니라 서버 경고다. */
const PAYMENT_REQUIRED = {
  ok: false as const,
  error: "결제 승인이 확인되지 않아 신청을 확정할 수 없습니다.",
  status: 402,
};

/**
 * 저장 직전의 마지막 관문.
 * 최종금액이 0원이면 어느 모드에서나 통과하고, 1원이라도 남으면 승인 경로만 통과한다.
 * 금액은 쿠폰·추천인·적립금을 모두 적용한 뒤의 서버 계산값이어야 한다.
 */
function paidCommitAllowed(amount: number, mode: CommitMode): boolean {
  return amount <= 0 || mode === "paid-approved";
}

/** 승인 금액과 확정 금액이 다를 때의 응답. 아무것도 저장하지 않은 채 돌려준다. */
const APPROVED_AMOUNT_MISMATCH = {
  ok: false as const,
  error: "결제 승인 금액과 신청 금액이 일치하지 않아 신청을 확정할 수 없습니다.",
  status: 409,
};

/**
 * paid-approved 확정의 금액 불변조건. 최종금액(적립금까지 적용)이 PG 승인 금액과 같아야 한다.
 *
 * 승인 경로는 승인 뒤 저장소를 다시 읽어 확정하므로, 그사이 적립금 잔액이 바뀌면
 * applyPoints가 다른 금액을 만든다. 그 금액으로 주문을 남기면 받은 돈과 주문 금액,
 * 실제 차감 적립금이 어긋난다. 다르면 저장하지 않고 결제를 paid + order_id NULL로
 * 남겨 기존 복구(recommit)·수동 처리로 넘긴다.
 *
 * 승인 금액을 넘기지 않은 paid-approved 호출도 막는다(fail-closed).
 * free-only는 0원만 통과하므로 여기서 보지 않는다.
 */
function approvedAmountMatches(amount: number, mode: CommitMode, approvedAmount?: number): boolean {
  if (mode !== "paid-approved") return true;
  return typeof approvedAmount === "number" && amount === approvedAmount;
}

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
  options: {
    orderId?: string;
    write?: CommitWriter;
    mode?: CommitMode;
    /** PG가 실제로 승인한 금액. mode가 paid-approved면 반드시 넘긴다. */
    approvedAmount?: number;
    /**
     * 신청 단계 [필수] 동의를 반드시 받아야 하는지. 기본값 true다.
     *
     * false는 "이미 승인이 끝난 결제를 복구하는 경우"에만 쓴다. 이 기능이
     * 생기기 전에 준비된 결제의 snapshot에는 동의 값이 없는데, 승인이 끝난 뒤에
     * 막으면 결제만 되고 주문은 없는 상태가 된다. 그쪽이 더 나쁘다.
     */
    requireConsent?: boolean;
    /**
     * 서버가 이 신청의 [필수] 동의를 **최초로 검증한** 시각(UTC ISO).
     *
     * 카드결제는 preparePayment가 검증 직후 만들어 결제 스냅샷에 담고,
     * 승인 경로가 그 값을 여기로 넘긴다. 그래야 증빙에 남는 시각이
     * "NICEPAY 승인이 끝난 시각"이 아니라 "동의를 확인한 시각"이 된다.
     *
     * 넘기지 않으면 검증이 이 요청 안에서 처음 일어난 것으로 보고 지금 시각을 쓴다
     * (0원 신청). 단 requireConsent:false인 복구 경로에서는 검증이 여기서
     * 일어나지 않으므로 시각을 만들지 않는다. 아래 consentedAt 참고.
     */
    consentedAt?: string;
  } = {},
): Promise<CommitResult<{ order: Order }>> {
  const mode: CommitMode = options.mode ?? "free-only";
  const requireConsent = options.requireConsent ?? true;
  const userId = user.id;
  const details = input.details;

  /**
   * 신청 단계 [필수] 동의. details의 문자열 "1"만 동의로 본다.
   * 취소·환불과 저작권은 화면에서 체크박스가 따로 있고 따로 눌리므로 따로 본다.
   * 시각과 버전은 서버가 채운다. 클라이언트 값은 쓰지 않는다.
   */
  const consentAgreed = String(details.applyConsent ?? "") === "1";
  const consentCheck = checkOrderConsent(consentAgreed);
  if (!consentCheck.ok && requireConsent) {
    return { ok: false, error: consentCheck.error, status: 400 };
  }
  /**
   * 저작권·창작물 이용 [필수] 동의. 인생곡 3종에만 있는 항목이다
   * (상담은 commitConsultation이 맡고 이 동의를 요구하지 않는다).
   * 화면 버튼이 이미 막고 있지만, API를 직접 부르는 경우까지 여기서 막는다.
   */
  const copyrightAgreed = String(details.copyrightConsent ?? "") === "1";
  const copyrightCheck = checkCopyrightConsent(copyrightAgreed);
  if (!copyrightCheck.ok && requireConsent) {
    return { ok: false, error: copyrightCheck.error, status: 400 };
  }
  /**
   * 증빙에 남길 동의시각.
   *
   * 넘어온 값이 있으면 그것이 서버가 최초로 검증한 시각이다(카드결제).
   * 없고 이 요청이 검증을 했다면(requireConsent) 그 시각은 지금이다(0원 신청).
   * 없고 검증도 하지 않았다면(복구 경로) 시각을 모른다. 이때는 만들지 않는다.
   * createdAt이나 지금 시각으로 추정해 채우면 모르는 값을 아는 것처럼 기록하게 된다.
   */
  const consentedAt =
    options.consentedAt ?? (requireConsent ? new Date().toISOString() : undefined);
  const refundConsent = consentAgreed ? buildOrderConsent(consentedAt) : undefined;
  // 두 레코드는 같은 시각을 나눠 쓰지만 동의 여부는 각자의 플래그로만 정해진다.
  const copyrightConsent = copyrightAgreed ? buildCopyrightConsent(consentedAt) : undefined;

  // 금액은 클라이언트 값을 쓰지 않고 서버 가격표로 다시 계산한다.
  const priced = calcOrderAmount(input.product, input.options, input.promotion);
  if (!priced) {
    return { ok: false, error: "신청 내용을 다시 확인해 주세요.", status: 400 };
  }
  const product = input.product as Order["product"];
  details.optionIds = priced.optionIds.join(",");
  /*
   * 프로모션 증빙. 서버 가격표를 통과한 값만 남긴다.
   *
   * 클라이언트가 details에 실어 보낸 promotion은 읽지 않고 먼저 지운다. details는
   * 임의 키를 섞을 수 있는 값이라, 남겨 두면 할인되지 않은 주문에 할인 흔적만 남는다.
   * 기록 목적은 하나다. 나중에 이 주문이 왜 그 금액이었는지 설명하는 것이다.
   */
  delete details.promotion;
  if (priced.promotion) details.promotion = priced.promotion;
  /*
   * 이벤트가 주문에는 할인·차감을 겹쳐 쓸 수 없다. 쿠폰만이 아니라 추천인 코드·
   * 관리자 코드·적립금까지 한자리에서 함께 막는다. 아래 apply*가 하나라도 실행되면
   * 쿠폰이 소모되거나 추천인에게 적립이 들어가므로, 그 앞에서 끝낸다.
   */
  const discountConflict = promotionDiscountConflict(details, priced.promotion);
  if (discountConflict) {
    return { ok: false, error: discountConflict, status: 400 };
  }
  const couponed = applyFreeCoupon(data, userId, details, priced.amount, product, priced.promotion);
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

  // 돈이 남아 있는데 승인 경로가 아니면 여기서 끝낸다.
  // 위 apply*가 사본이 아닌 data와 user를 직접 바꾸지만 아직 아무것도 저장하지 않았고,
  // 아래 주문·알림 추가와 write도 실행되지 않으므로 이 요청은 흔적을 남기지 않는다.
  if (!paidCommitAllowed(pointed.amount, mode)) {
    return PAYMENT_REQUIRED;
  }
  // 승인 금액과 다르면 여기서 끝낸다. 위와 같이 아직 아무것도 저장하지 않았다.
  if (!approvedAmountMatches(pointed.amount, mode, options.approvedAmount)) {
    return APPROVED_AMOUNT_MISMATCH;
  }

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
    // 동의가 확인된 경우에만 담는다. 복구 경로에서 값이 없으면 키를 만들지 않는다.
    ...(refundConsent ? { refundConsent } : {}),
    ...(copyrightConsent ? { copyrightConsent } : {}),
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
  options: {
    consultationId?: string;
    write?: CommitWriter;
    mode?: CommitMode;
    /** PG가 실제로 승인한 금액. mode가 paid-approved면 반드시 넘긴다. */
    approvedAmount?: number;
    /**
     * 예약 절대시각(scheduledAt)을 반드시 만들 수 있어야 하는지.
     *
     * 기본값 true다. 새 상담은 유효한 scheduledDate 없이 만들어지지 않는다.
     *
     * false는 "이미 승인이 끝난 결제를 복구하는 경우"에만 쓴다. 이 기능이
     * 생기기 전에 준비된 결제의 snapshot에는 scheduledDate가 없는데,
     * 승인이 끝난 뒤에 막으면 결제만 되고 상담은 없는 상태가 된다.
     * 그쪽이 더 나쁘므로 복구 경로는 값이 없으면 그냥 넘어간다.
     * (값이 있는데 검증에 실패하면 false에서도 막는다)
     */
    requireSchedule?: boolean;
    /**
     * 예약 날짜를 "지금 판매 중인 날짜 목록"으로 다시 확인할지.
     *
     * 기본값 true다. 새 예약은 언제나 지금 판매 중인 날짜여야 한다.
     *
     * false는 "이미 승인이 끝난 결제를 확정하는 경우"에만 쓴다. 그 예약은
     * preparePayment에서 이미 같은 규칙으로 검증되어 결제 snapshot에 고정되었다.
     * 판매 가능 목록은 한국 날짜 기준으로 매일 앞으로 밀리므로, 결제 준비와 승인
     * 사이에 자정이 지나면 같은 예약이 목록에서 빠진다. 그때 여기서 막으면
     * 결제만 되고 상담이 없는 상태가 된다.
     *
     * false여도 검증을 그만두는 것이 아니다. 날짜 형식·실재 여부, 표시 문구와의
     * 짝, 시각 문구, 슬롯 충돌은 그대로 본다(resolveConfirmedScheduledAt 주석 참고).
     * requireSchedule과는 다른 축이다. 저쪽은 "값이 없어도 되는가"이고,
     * 이쪽은 "있는 값을 어느 기준으로 보는가"다.
     */
    verifyOfferedDate?: boolean;
    /** 신청 단계 [필수] 동의를 반드시 받아야 하는지. 기본값 true. (commitOrder와 같다) */
    requireConsent?: boolean;
    /** 서버가 동의를 최초로 검증한 시각(UTC ISO). commitOrder와 같은 뜻이다. */
    consentedAt?: string;
    /**
     * 이 상담 결제의 merchantOrderId (P1-04 슬롯 확보).
     *
     * 주면 그 결제가 승인 전에 확보한 hold는 슬롯 판정에서 점유로 보지 않고, 확정할 때
     * 같은 data에서 그 hold를 지운다. 지우기와 상담 생성은 아래 write 한 번(CAS)에 함께
     * 저장되므로, 저장이 밀리면 둘 다 일어나지 않는다. 승인 경로와 recommit만 넘긴다.
     */
    holdOwnerMerchantOrderId?: string;
  } = {},
): Promise<CommitResult<{ consultation: Consultation; order: Order }>> {
  const mode: CommitMode = options.mode ?? "free-only";
  const requireSchedule = options.requireSchedule ?? true;
  const verifyOfferedDate = options.verifyOfferedDate ?? true;
  const requireConsent = options.requireConsent ?? true;
  const userId = user.id;
  const teacher = String(input.teacher ?? "유비 선생");
  const datetime = String(input.datetime ?? "");
  const parsed = parseDatetime(datetime);
  if (!parsed) {
    return { ok: false, error: "상담 시간을 다시 선택해 주세요.", status: 400 };
  }
  if (
    !isSlotAvailable(data, teacher, parsed.date, parsed.time, {
      ownerMerchantOrderId: options.holdOwnerMerchantOrderId,
    })
  ) {
    return {
      ok: false,
      error: "이미 예약되었거나 선택할 수 없는 시간입니다. 다른 시간을 선택해 주세요.",
      status: 409,
    };
  }

  const details = input.details;

  // 신청 단계 [필수] 동의. 상담 화면의 "취소·환불 규정에 동의합니다"가 이 값이다.
  const consentAgreed = String(details.applyConsent ?? "") === "1";
  const consentCheck = checkOrderConsent(consentAgreed);
  if (!consentCheck.ok && requireConsent) {
    return { ok: false, error: consentCheck.error, status: 400 };
  }
  /*
   * 저작권 동의는 상담에서 요구하지도, 만들지도 않는다. 상담에는 그 체크박스가
   * 없어 동의 행위 자체가 일어나지 않고, 저작권 문구의 대상은 인생곡 제작물이다.
   * details에 copyrightConsent가 섞여 와도 읽지 않는다.
   */
  const consentedAt =
    options.consentedAt ?? (requireConsent ? new Date().toISOString() : undefined);
  const refundConsent = consentAgreed ? buildOrderConsent(consentedAt) : undefined;

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

  // 주문과 같은 관문. 상담을 만들기 전에 막으므로 슬롯도 점유되지 않는다.
  if (!paidCommitAllowed(pointed.amount, mode)) {
    return PAYMENT_REQUIRED;
  }
  // 주문과 같은 금액 불변조건. 상담을 만들기 전이라 슬롯도 점유되지 않는다.
  if (!approvedAmountMatches(pointed.amount, mode, options.approvedAmount)) {
    return APPROVED_AMOUNT_MISMATCH;
  }

  // 상담과 결제 귀속용 주문이 같은 건임을 알 수 있도록 id와 시각을 공유한다.
  const id = options.consultationId ?? `c-${nowId()}`;
  const createdAt = new Date().toISOString();
  const consultTeacher = teacher;
  const consultDatetime = datetime;
  /**
   * 예약 절대시각. 화면이 함께 보낸 한국 날짜("YYYY-MM-DD")를 쓴다.
   *
   * details는 클라이언트가 임의 키를 섞을 수 있는 값이라 그대로 믿지 않는다.
   * isOfferedDate로 "지금 서버가 내주는 날짜 목록에 있고 표시 문구와도 짝이 맞는"
   * 값만 통과시킨 뒤, toScheduledAt이 +09:00을 명시해 UTC ISO로 바꾼다.
   *
   * 검증을 통과하지 못하면 상담을 만들지 않고 400으로 끝낸다. 표시 문구에서
   * 연도를 추론해 만들어 넣지 않는다. 예외는 requireSchedule=false인
   * 복구 경로에서 값이 아예 없는 경우뿐이다.
   *
   * 승인 후 확정(verifyOfferedDate=false)에서는 "지금 판매 중인 날짜"인지만 보지
   * 않는다. 나머지 검증은 같다. 왜 그런지는 위 verifyOfferedDate 주석에 적어 두었다.
   */
  const scheduledDate = String(details.scheduledDate ?? "").trim();
  const scheduledAt =
    (verifyOfferedDate
      ? resolveScheduledAt(scheduledDate, parsed.date, parsed.time)
      : resolveConfirmedScheduledAt(scheduledDate, parsed.date, parsed.time)) ?? undefined;
  // 값이 없어도 되는 경우는 복구 경로뿐이다(위 requireSchedule 주석 참고).
  // 값이 들어왔다면 복구 경로에서도 유효해야 한다.
  if (!scheduledAt && (requireSchedule || scheduledDate)) {
    return { ok: false, error: "상담 시간을 다시 선택해 주세요.", status: 400 };
  }

  const consultPurpose = String(input.purpose ?? "");
  const consultMethod = String(input.method ?? "카카오톡 상담");
  const consultOption = String(input.option ?? "없음");

  const item: Consultation = {
    id,
    userId,
    teacher: consultTeacher,
    datetime: consultDatetime,
    // 위 검증을 통과한 값만 담긴다. 복구 경로에서 값이 없을 때만 키가 빠진다.
    ...(scheduledAt ? { scheduledAt } : {}),
    purpose: consultPurpose,
    method: consultMethod,
    option: consultOption,
    status: "상담 신청",
    amount: pointed.amount,
    details: pointed.details,
    createdAt,
  };
  // 이 결제가 확보해 둔 hold를 실제 상담으로 바꾼다. 다른 결제의 hold는 건드리지 않는다.
  const holdOwner = options.holdOwnerMerchantOrderId;
  if (holdOwner && data.consultationHolds) {
    data.consultationHolds = data.consultationHolds.filter(
      (hold) =>
        !(
          hold.merchantOrderId === holdOwner &&
          hold.teacher === teacher &&
          hold.date === parsed.date &&
          hold.time === parsed.time
        ),
    );
  }
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
    // 상담 동의도 이 주문 1곳에만 남긴다. Consultation과 id가 같아 중복 저장이 필요없다.
    ...(refundConsent ? { refundConsent } : {}),
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

/**
 * OPEN EVENT 주문에 포함된 1:1 사주상담을 예약한다. Consultation 1건만 만든다.
 *
 * commitConsultation과 달리 금액을 계산하지 않고 결제 귀속 Order도 만들지 않는다.
 * 상담비는 이벤트 주문(facts.order) 결제에 이미 들어 있다. 검사 규칙은
 * eventConsultation.ts prepareEventConsultation 한 곳에 있다.
 *
 * 저장은 app_store CAS(writeData) 한 번이다. 중복·슬롯 확인과 추가가 같은 읽기 위에서
 * 일어나므로, 겹친 요청은 CAS 충돌로 저장되지 않는다(route 최상위가 409로 돌려준다).
 */
export async function commitEventConsultation(
  data: AppData,
  user: User,
  input: EventConsultationInput,
  facts: EventConsultationFacts,
  options: { write?: (data: AppData) => Promise<void> } = {},
): Promise<EventConsultationResult> {
  const result = prepareEventConsultation(data, user, input, facts);
  if (!result.ok) return result;
  await (options.write ?? writeData)(data);
  return result;
}
