/**
 * 적립금 전액 사용 0원 주문·상담의 판정 (P1-09 1단계).
 *
 * 대상은 하나뿐이다. "적립금으로 최종 금액이 0원이 된 Order 또는 Consultation."
 * 무료 쿠폰 0원(freeCouponRefund.ts), 적립금 일부 + PG 결제(기존 PG 환불 흐름),
 * 오픈 이벤트(promotion) 주문은 대상이 아니다.
 *
 * 이 파일이 하는 일은 판정뿐이다. 저장·환불 완료·적립금 복원·PG 호출을 하지 않는다.
 * 그 일은 다음 단계에서 이 판정 결과(eligible)를 받는 저장 함수가 한 문장으로 한다.
 *
 * ── 왜 재계산이 필요한가 ──
 *
 * commitOrder는 클라이언트가 보낸 details를 그대로 이어 쓴다. pointsUsed는 applyPoints가
 * 실제로 돌았을 때만 서버 값으로 덮인다. 금액이 적립금 차감 전에 이미 0원이면
 * (예: 100% 관리자 코드) applyPoints가 돌지 않아 클라이언트가 넣은 pointsUsed가
 * 그대로 남고 결제수단 표시도 "적립금"이 된다. 그 값을 믿고 돌려주면 쓰지 않은 적립금이 생긴다.
 *
 * 그래서 "적립금 차감 직전 금액"을 서버 값으로 다시 세운다.
 *   차감 직전 금액 = 서버 가격표 재계산 금액 − referralDiscount
 * referralDiscount는 referralCode가 있을 때만 applyReferral이 서버 값으로 쓴다.
 * 코드가 없는데 값이 있으면 클라이언트가 넣은 것이므로 모순으로 본다.
 * applyPoints는 금액 > 0일 때만 돌고 0원이 되면 used = 그 금액이다. 따라서 정상 건은
 * pointsUsed === 차감 직전 금액 > 0 이다. 하나라도 어긋나면 ineligible(fail-closed)이다.
 *
 * 순수 판정(decideZeroPointsRefund)은 DB도 가격표도 import하지 않는다. 가격표는
 * evaluateZeroPointsRefund가 필요할 때만 읽는다(freeCouponRefund.ts와 같은 방식).
 */
import { recalculateBaseAmount } from "./freeCouponRefund.ts";
import type { Order } from "@/lib/types/app";

/** settledPayment가 적립금 전액 사용 0원 주문에 남기는 결제수단 문구. */
export const ZERO_POINTS_PAYMENT = "적립금";

/** 판정에 쓰는 주문 값. 모두 orders 테이블에 저장된 값이다. */
export type ZeroPointsRefundOrder = Pick<
  Order,
  "id" | "product" | "amount" | "baseAmount" | "payment" | "details"
>;

export interface ZeroPointsRefundFacts {
  order: ZeroPointsRefundOrder | null;
  /** 이 주문 id에 연결된 결제 행 수. 상태로 거르지 않은 전체 건수다. */
  linkedPaymentCount: number;
  /** 서버 가격표로 다시 계산한 할인 전 금액. 계산할 수 없으면 null. */
  recalculatedBaseAmount: number | null;
}

export type ZeroPointsRefundIneligibleReason =
  | "order-not-found"
  | "payment-derived-order"
  | "amount-not-zero"
  | "payment-exists"
  | "payment-label-mismatch"
  | "coupon-present"
  | "promotion-order"
  | "use-points-missing"
  | "points-used-invalid"
  | "referral-inconsistent"
  | "base-amount-missing"
  | "base-amount-unverifiable"
  | "base-amount-mismatch"
  | "points-amount-mismatch";

export type ZeroPointsRefundDecision =
  | {
      kind: "eligible";
      orderId: string;
      /** 돌려줄 적립금. 서버 재계산 금액으로 검증된 값이다. */
      pointsUsed: number;
      baseAmount: number;
      /** 적용된 추천인·관리자 할인. 코드가 없으면 0. */
      referralDiscount: number;
    }
  | { kind: "ineligible"; reason: ZeroPointsRefundIneligibleReason };

function no(reason: ZeroPointsRefundIneligibleReason): ZeroPointsRefundDecision {
  return { kind: "ineligible", reason };
}

function filled(value: string | undefined): boolean {
  return (value ?? "").trim() !== "";
}

/** 결제 흐름이 만든 주문 id인지(freeCouponRefund.ts와 같은 규칙, merchant는 "is-"). */
function isPaymentDerivedOrderId(id: string): boolean {
  return /^[oc]-is-/.test(id);
}

/**
 * 서버가 String(정수)로 저장한 원 단위 값만 읽는다. 앞자리 0·부호·소수·공백 섞임은 null.
 * 서버가 쓴 값은 언제나 이 모양이므로 다른 모양은 손으로 넣은 값으로 본다.
 */
function readWon(value: string | undefined): number | null {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

/**
 * 정상 적립금 전액 사용 0원 건인지 판정한다. 순수 함수이며 fail-closed다.
 * 결제 행이 없다는 사실만으로 0원 주문이라 보지 않는다. 재계산 금액과 함께 맞아야 한다.
 */
export function decideZeroPointsRefund(facts: ZeroPointsRefundFacts): ZeroPointsRefundDecision {
  const { order } = facts;
  if (!order) return no("order-not-found");
  if (!order.id || isPaymentDerivedOrderId(order.id)) return no("payment-derived-order");
  if (order.amount !== 0) return no("amount-not-zero");
  if (!Number.isSafeInteger(facts.linkedPaymentCount) || facts.linkedPaymentCount !== 0) {
    return no("payment-exists");
  }
  if (order.payment !== ZERO_POINTS_PAYMENT) return no("payment-label-mismatch");

  const details = order.details ?? {};
  // 무료 쿠폰 0원은 별도 흐름이다. 흔적이 하나라도 있으면 이쪽에서 다루지 않는다.
  if (filled(details.couponId) || filled(details.couponFree)) return no("coupon-present");
  // 오픈 이벤트에는 적립금을 쓸 수 없다. 흔적이 있으면 모순이다.
  if (filled(details.promotion)) return no("promotion-order");
  if (details.usePoints !== "1") return no("use-points-missing");

  const pointsUsed = readWon(details.pointsUsed);
  if (pointsUsed === null || pointsUsed <= 0) return no("points-used-invalid");

  // referralDiscount·referrerId는 referralCode가 있을 때만 서버가 쓴다.
  let referralDiscount = 0;
  if (filled(details.referralCode)) {
    const discount = readWon(details.referralDiscount);
    if (discount === null) return no("referral-inconsistent");
    referralDiscount = discount;
  } else if (filled(details.referralDiscount) || filled(details.referrerId)) {
    return no("referral-inconsistent");
  }

  // 할인 전 금액이 없는 옛 주문은 교차검증할 수 없다. 담당자 확인으로 남긴다.
  const baseAmount = order.baseAmount;
  if (baseAmount === undefined || !Number.isSafeInteger(baseAmount) || baseAmount <= 0) {
    return no("base-amount-missing");
  }
  if (facts.recalculatedBaseAmount === null) return no("base-amount-unverifiable");
  if (facts.recalculatedBaseAmount !== baseAmount) return no("base-amount-mismatch");

  // 적립금 차감 직전 금액. 0 이하이면 applyPoints가 돌지 않은 주문이다(100% 할인 등).
  if (pointsUsed !== facts.recalculatedBaseAmount - referralDiscount) {
    return no("points-amount-mismatch");
  }

  return { kind: "eligible", orderId: order.id, pointsUsed, baseAmount, referralDiscount };
}

/** 저장된 주문과 결제 건수로 판정한다. 관리자 목록과 실행이 같은 함수를 쓰게 둔다. */
export async function evaluateZeroPointsRefund(
  order: ZeroPointsRefundOrder | null,
  linkedPaymentCount: number,
): Promise<ZeroPointsRefundDecision> {
  // 금액이 0원이 아니면 가격표를 볼 것도 없다.
  if (!order || order.amount !== 0) {
    return decideZeroPointsRefund({ order, linkedPaymentCount, recalculatedBaseAmount: null });
  }
  return decideZeroPointsRefund({
    order,
    linkedPaymentCount,
    recalculatedBaseAmount: await recalculateBaseAmount(order),
  });
}
