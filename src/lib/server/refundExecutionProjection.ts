/**
 * 관리자 목록에 실을 결제 실행 상태 요약 (Refund-Payment-Admin-Execution-Projection-1).
 *
 * 순수 함수 하나뿐이다. DB도 PG도 건드리지 않는다.
 *
 * 새 판정 규칙을 만들지 않는다. 승인 결제가 몇 건인지는 기존
 * classifyPaidPayments가 정하고(이 파일이 그 함수를 그대로 부른다), 실행 단계의
 * 의미는 Payment.cancelExecutionStatus의 기존 정의를 그대로 쓴다.
 *
 * 이 값은 표시용이다. 실행 허가가 아니다. executable이 보이더라도 실제 실행은
 * 서버의 gate와 결제 선점(claim, cancel_execution_status IS NULL) 조건이 다시 판단하며,
 * 그 사이 상태가 바뀌었다면 서버가 막는다.
 */
import { classifyPaidPayments } from "./paymentLookup.ts";
import type { OrderPaymentLookup } from "./paymentLookup.ts";
import type { Payment, RefundExecutionProjection } from "@/lib/types/app";

/**
 * 이미 분류된 조회 결과를 네 갈래로 줄인다.
 *
 * 분류 자체를 여기서 다시 하지 않는다. 실행·복구 경로가 쓰는 것과 같은 결과를 받는다.
 */
export function projectRefundExecutionFromLookup(
  lookup: OrderPaymentLookup,
): RefundExecutionProjection {
  // 승인 결제가 없다. 환불이 끝난 것인지 애초에 결제가 없던 주문인지 구분할 수 없다.
  if (lookup.kind === "no-payment") return "unknown";
  // 승인 결제가 여럿이다. 어느 것을 볼지 고르지 않는다.
  if (lookup.kind === "ambiguous") return "manual-review";

  switch (lookup.payment.cancelExecutionStatus ?? null) {
    case null:
      // 취소 실행을 시작한 적이 없다. 선점이 가능한 유일한 상태다.
      return "executable";
    case "processing":
    case "unknown":
    case "succeeded":
      // 이미 실행이 시작·기록되었다. 다시 선점할 수 없고 거래조회로 확인할 대상이다.
      return "recoverable";
    case "declined":
      // PG가 분명히 거절했다. 두 복구 흐름 모두 자동 처리 대상에서 제외한다.
      return "manual-review";
  }
}

/**
 * 한 주문의 결제 목록에서 곧바로 요약한다.
 *
 * 몇 건인지 세는 일은 classifyPaidPayments가 한다. 승인 결제만 세는 규칙도 그 안에 있다.
 */
export function projectRefundExecution(payments: Payment[]): RefundExecutionProjection {
  return projectRefundExecutionFromLookup(classifyPaidPayments(payments));
}
