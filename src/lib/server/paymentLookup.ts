/**
 * 주문에 귀속된 결제를 고르는 규칙 (Refund-Payment-Cancel-Foundation-1).
 *
 * 순수 함수만 있다. DB도, PG도, 시각도 건드리지 않는다.
 * 실제 조회는 store.ts의 findPaidPaymentForOrder가 하고, 판정만 여기서 한다.
 *
 * 왜 따로 두었나: 이 판정이 틀리면 엉뚱한 결제를 취소하게 된다. DB 없이 그 자체로
 * 확인할 수 있어야 해서 떼어 두었다.
 */
import type { Payment } from "@/lib/types/app";

/**
 * 한 주문의 결제 조회 결과.
 *
 * - no-payment          : 승인된 결제가 없다. 오류가 아니다. 쿠폰·적립금으로 0원이 된
 *                         주문은 애초에 결제 행이 만들어지지 않는다(preparePayment가
 *                         amount <= 0이면 결제를 만들지 않고 끝낸다).
 * - single-paid-payment : 승인된 결제가 정확히 하나다. 취소를 생각할 수 있는 유일한 경우다.
 * - ambiguous           : 승인된 결제가 둘 이상이다. 지금 코드 경로에서는 생기지 않아야
 *                         하지만 payments.order_id에 UNIQUE 제약이 없어 DB가 막지는
 *                         못한다. 이때는 자동으로 하나를 고르지 않고 사람이 확인한다.
 */
export type OrderPaymentLookup =
  | { kind: "no-payment" }
  | { kind: "single-paid-payment"; payment: Payment }
  | { kind: "ambiguous"; payments: Payment[] };

/**
 * 승인된 결제만 추려 세 갈래로 나눈다.
 *
 * 최신순으로 하나를 고르는 일을 하지 않는다. 어느 쪽이 진짜인지 모르는 상태에서
 * 하나를 골라 취소하면 잘못된 거래에 돈이 나간다.
 *
 * pg_tid가 없는 승인 건도 숨기지 않고 그대로 돌려준다. 취소에 쓸 거래 식별자가
 * 없다는 사실은 호출부가 보고 막아야 할 문제이지, 여기서 감출 일이 아니다.
 *
 * 질의가 이미 status = 'paid'로 거르지만 여기서도 한 번 더 거른다. 두 곳 중 한쪽만
 * 고쳐도 승인되지 않은 결제가 취소 대상이 되지 않게 하기 위해서다.
 */
export function classifyPaidPayments(payments: Payment[]): OrderPaymentLookup {
  const paid = payments.filter((payment) => payment.status === "paid");
  if (paid.length === 0) return { kind: "no-payment" };
  if (paid.length === 1) return { kind: "single-paid-payment", payment: paid[0] };
  return { kind: "ambiguous", payments: paid };
}
