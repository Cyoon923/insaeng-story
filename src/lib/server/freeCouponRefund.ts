/**
 * 무료 쿠폰 0원 주문·상담의 결제 없는 취소 완료 (Refund-Free-Coupon-Zero-Complete-1).
 *
 * 대상은 하나뿐이다. "무료 쿠폰으로 최종 금액이 0원이 된 Order 또는 Consultation."
 * 적립금 전액 사용 0원, 추천인·기타 조합 0원, 오픈 이벤트 주문은 대상이 아니다.
 *
 * 흐름은 기존 환불과 같다. requested → reviewing → approved를 사람이 거친 건만
 * 여기서 approved → completed로 올린다. 승인 정책·상담 취소창 기록은 그대로다.
 *
 * 이 파일이 하지 않는 일
 * - NICEPAY 취소·조회. 관련 모듈을 import하지 않는다.
 * - Payment 생성·변경.
 * - 쿠폰 사용 해제·복원·재발급. 원래 쿠폰은 사용 완료 그대로 남는다.
 *   필요하면 운영자가 기존 giveCoupon으로 새 쿠폰을 따로 준다.
 * - 적립금 복원. 적립금을 쓴 0원 주문은 애초에 대상에서 빠진다.
 * - Order·Consultation 진행 상태 변경. 유료 환불 완료와 같이 completed 환불 문의만 남긴다.
 *
 * 판정은 서버에 저장된 값만 쓴다. 관리자 화면이나 요청 본문의 금액·상태를 받지 않는다.
 * 조금이라도 모자라거나 어긋나면 ineligible이고, 그 건은 기존 담당자 확인 흐름에 남는다.
 *
 * 순수 판정(decideFreeCouponRefund)은 DB도 가격표도 import하지 않는다. 그래야
 * Node 내장 테스트 러너로 그 자체를 확인할 수 있다. 저장·가격 모듈은 아래 함수들이
 * 필요할 때만 읽는다.
 */
import type { Order } from "@/lib/types/app";

/** settledPayment가 무료 쿠폰 0원 주문에 남기는 결제수단 문구. */
export const FREE_COUPON_PAYMENT = "무료 쿠폰";

/** 판정에 쓰는 주문 값. 모두 orders 테이블에 저장된 값이다. */
export type FreeCouponRefundOrder = Pick<
  Order,
  "id" | "product" | "amount" | "baseAmount" | "payment" | "details"
>;

export interface FreeCouponRefundFacts {
  order: FreeCouponRefundOrder | null;
  /** 이 주문 id에 연결된 결제 행 수. 상태로 거르지 않은 전체 건수다. */
  linkedPaymentCount: number;
  /** 서버 가격표로 다시 계산한 할인 전 금액. 계산할 수 없으면 null. */
  recalculatedBaseAmount: number | null;
}

export type FreeCouponRefundDecision =
  | { kind: "eligible"; orderId: string; couponId: string; baseAmount: number }
  | { kind: "ineligible"; reason: string };

function no(reason: string): FreeCouponRefundDecision {
  return { kind: "ineligible", reason };
}

function filled(value: string | undefined): boolean {
  return (value ?? "").trim() !== "";
}

/**
 * 결제 흐름이 만든 주문 id인지(orderIdForPayment·consultationIdForPayment, merchant는 "is-").
 *
 * 이런 주문은 결제 행이 유실·미연결이어도 유료 결제에서 나온 건이다. 0원이더라도
 * 여기로 들이지 않는다. 무료 신청은 nowId() / c-nowId()를 쓴다.
 */
function isPaymentDerivedOrderId(id: string): boolean {
  return /^[oc]-is-/.test(id);
}

/**
 * 저장된 옵션 id 목록. 키가 없으면 null이다(옛 주문일 수 있어 추정하지 않는다).
 * 빈 문자열은 "옵션 없음"이다.
 */
export function storedOptionIds(order: Pick<Order, "details">): string[] | null {
  const raw = order.details?.optionIds;
  if (typeof raw !== "string") return null;
  return raw.split(",").map((item) => item.trim()).filter((item) => item !== "");
}

/**
 * 정상 무료 쿠폰 0원 건인지 판정한다. 순수 함수이며 fail-closed다.
 *
 * 하나라도 어긋나면 그 자리에서 ineligible이다. 결제 행이 없다는 사실만으로
 * 0원 주문이라 보지 않는다. 저장된 쿠폰 증거와 재계산 금액이 함께 맞아야 한다.
 */
export function decideFreeCouponRefund(facts: FreeCouponRefundFacts): FreeCouponRefundDecision {
  const { order } = facts;
  if (!order) return no("order-not-found");
  if (!order.id || isPaymentDerivedOrderId(order.id)) return no("payment-derived-order");
  if (order.amount !== 0) return no("amount-not-zero");
  if (!Number.isSafeInteger(facts.linkedPaymentCount) || facts.linkedPaymentCount !== 0) {
    return no("payment-exists");
  }

  const details = order.details ?? {};
  const couponId = (details.couponId ?? "").trim();
  if (!couponId) return no("coupon-id-missing");
  if (details.couponFree !== "1") return no("coupon-free-missing");
  if (order.payment !== FREE_COUPON_PAYMENT) return no("payment-label-mismatch");

  // 오픈 이벤트는 무료 쿠폰과 겹칠 수 없다. 흔적이 있으면 모순이다.
  if (filled(details.promotion)) return no("promotion-order");
  // 적립금을 실제로 쓴 주문은 이번 경로에서 뺀다(적립금 0원은 별도 설계).
  if (filled(details.pointsUsed)) return no("points-used");
  // 추천인·관리자 코드는 쿠폰이 0원을 만든 뒤에는 적용되지 않는다. 흔적이 있으면 모순이다.
  if (filled(details.referralCode) || filled(details.referralDiscount) || filled(details.referrerId)) {
    return no("referral-present");
  }

  // 할인 전 금액이 없는 옛 주문은 교차검증할 수 없다. 담당자 확인으로 남긴다.
  const baseAmount = order.baseAmount;
  if (baseAmount === undefined || !Number.isSafeInteger(baseAmount) || baseAmount <= 0) {
    return no("base-amount-missing");
  }
  if (facts.recalculatedBaseAmount === null) return no("base-amount-unverifiable");
  if (facts.recalculatedBaseAmount !== baseAmount) return no("base-amount-mismatch");

  return { kind: "eligible", orderId: order.id, couponId, baseAmount };
}

/**
 * 저장된 상품·옵션으로 할인 전 금액을 서버 가격표에서 다시 계산한다.
 *
 * 프로모션은 넘기지 않는다. 오픈 이벤트는 대상이 아니므로 정가 기준만 본다
 * (이벤트 전용 옵션이 있으면 calcOrderAmount가 null을 준다).
 * 상담은 기존 calcConsultationAmount의 옵션 구조(report·extraPerson)를 그대로 쓴다.
 */
export async function recalculateBaseAmount(
  order: Pick<Order, "product" | "details">,
): Promise<number | null> {
  const optionIds = storedOptionIds(order);
  if (optionIds === null) return null;
  const pricing = await import("@/lib/server/pricing");
  if (order.product === "consultation") {
    const known = new Set<string>(Object.keys(pricing.CONSULT_OPTION_PRICES));
    if (optionIds.some((id) => !known.has(id))) return null;
    return pricing.calcConsultationAmount({
      report: optionIds.includes("report") ? "1" : "",
      extraPerson: optionIds.includes("extraPerson") ? "1" : "",
    }).amount;
  }
  return pricing.calcOrderAmount(order.product, optionIds)?.amount ?? null;
}

/** 저장된 주문과 결제 건수로 판정한다. 관리자 목록과 실행이 같은 함수를 쓴다. */
export async function evaluateFreeCouponRefund(
  order: FreeCouponRefundOrder | null,
  linkedPaymentCount: number,
): Promise<FreeCouponRefundDecision> {
  // 금액이 0원이 아니면 가격표를 볼 것도 없다.
  if (!order || order.amount !== 0) {
    return decideFreeCouponRefund({ order, linkedPaymentCount, recalculatedBaseAmount: null });
  }
  return decideFreeCouponRefund({
    order,
    linkedPaymentCount,
    recalculatedBaseAmount: await recalculateBaseAmount(order),
  });
}

export type FreeCouponRefundResult =
  /** 정상 무료 쿠폰 0원 건이 아니다. 기존 실행 흐름이 그대로 맡는다. */
  | { kind: "not-applicable"; reason: string }
  /** PG 호출 없이 completed로 저장했다. alreadyCompleted는 동시 실행에서 이미 끝나 있던 경우다. */
  | { kind: "completed"; alreadyCompleted: boolean }
  /** 판정은 통과했지만 저장 시점 조건이 맞지 않았다. 사람이 본다. */
  | { kind: "not-completed" };

/**
 * approved → completed를 한 문장으로 저장한다.
 *
 * finalizeRefundPaymentCancel과 같은 방식이다. 조건을 전부 UPDATE의 WHERE에 넣고
 * 먼저 읽은 값을 믿지 않는다.
 * - 대상 환불 문의는 status='approved'이며 FOR UPDATE로 잠근다.
 * - 같은 주문의 활성 문의가 정확히 1건이어야 한다.
 * - 저장 순간에도 이 주문 id의 결제 행이 0건이어야 한다(NOT EXISTS).
 * - 주문 행이 판정 때의 무료 쿠폰 증거와 그대로 같아야 한다.
 * - completed_at은 COALESCE로 최초값만 남긴다.
 * 두 번째 실행은 status='approved' 조건에서 0행이 되어 다시 완료되지 않는다.
 *
 * 결제·쿠폰·적립금·주문 상태는 이 문장에 없다. 바뀌는 것은 환불 문의 한 행뿐이다.
 */
export async function saveFreeCouponRefundCompleted(
  decision: Extract<FreeCouponRefundDecision, { kind: "eligible" }>,
): Promise<{ kind: "completed"; alreadyCompleted: boolean } | { kind: "not-completed" }> {
  const store = await import("@/lib/server/store");
  const refundRequests = await import("@/lib/server/refundRequests");
  const sql = store.sqlClient();
  if (!sql) {
    throw new Error("환불 완료 저장은 DATABASE_URL이 설정된 환경에서만 가능합니다.");
  }
  await store.ensureTable(sql);
  await refundRequests.ensureRefundRequests(sql);
  const activeStatusSql = refundRequests.ACTIVE_REFUND_REQUEST_STATUSES.map(
    (status) => `'${status}'`,
  ).join(", ");
  // 종결 서버 시각. 이미 값이 있으면 덮어쓰지 않는다.
  const completedAt = new Date().toISOString();

  const rows = (await sql.query(
    `
      WITH target_refund AS (
        SELECT id FROM refund_requests
        WHERE order_id = $1 AND status = 'approved'
        FOR UPDATE
      ),
      active_refunds AS (
        SELECT count(*) AS total FROM refund_requests
        WHERE order_id = $1 AND status IN (${activeStatusSql})
      ),
      free_order AS (
        SELECT id FROM orders
        WHERE id = $1
          AND amount = 0
          AND base_amount = $2
          AND payment = $3
          AND details->>'couponFree' = '1'
          AND details->>'couponId' = $4
          AND COALESCE(details->>'pointsUsed', '') = ''
          AND COALESCE(details->>'promotion', '') = ''
          -- 저장 순간에도 결제 행이 없어야 한다.
          AND NOT EXISTS (SELECT 1 FROM payments WHERE order_id = $1)
      ),
      completed AS (
        UPDATE refund_requests
        SET status = 'completed',
            completed_at = COALESCE(completed_at, $5::timestamptz)
        WHERE id = (SELECT id FROM target_refund)
          AND status = 'approved'
          AND (SELECT total FROM active_refunds) = 1
          AND EXISTS (SELECT 1 FROM free_order)
        RETURNING id
      )
      SELECT (SELECT count(*) FROM completed) AS completed_rows
    `,
    [decision.orderId, decision.baseAmount, FREE_COUPON_PAYMENT, decision.couponId, completedAt],
  )) as { completed_rows: string | number }[];

  if (Number(rows[0]?.completed_rows ?? 0) === 1) {
    return { kind: "completed", alreadyCompleted: false };
  }

  /*
   * 0행이다. 동시에 들어온 다른 실행이 먼저 끝냈는지만 가린다. 안내용 읽기이며
   * 안전장치는 위 조건이다. 활성 문의가 남아 있지 않고 completed가 있을 때만 완료로 읽는다.
   */
  const statuses = (await sql.query(`SELECT status FROM refund_requests WHERE order_id = $1`, [
    decision.orderId,
  ])) as { status: string }[];
  const active = statuses.filter((row) =>
    (refundRequests.ACTIVE_REFUND_REQUEST_STATUSES as readonly string[]).includes(row.status),
  ).length;
  if (active === 0 && statuses.some((row) => row.status === "completed")) {
    return { kind: "completed", alreadyCompleted: true };
  }
  return { kind: "not-completed" };
}

/**
 * 주문 1건을 서버 값으로 다시 판정하고, 정상 무료 쿠폰 0원 건이면 완료를 저장한다.
 *
 * 입력은 gate가 DB에서 읽어 준 주문 id뿐이다.
 */
export async function completeFreeCouponRefund(orderId: string): Promise<FreeCouponRefundResult> {
  const store = await import("@/lib/server/store");
  const order = await store.getOrderById(orderId);
  const summary = (await store.summarizeOrderPaymentStatuses([orderId])).get(orderId);
  const decision = await evaluateFreeCouponRefund(order, summary?.totalCount ?? 0);
  if (decision.kind !== "eligible") return { kind: "not-applicable", reason: decision.reason };
  return saveFreeCouponRefundCompleted(decision);
}
