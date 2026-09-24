/**
 * 환불 승인 건의 결제 취소 실행 흐름 (Refund-Payment-Cancel-Orchestration-1).
 *
 * 이미 만들어 둔 조각들을 정해진 순서로 엮기만 한다. 조회·선점·HTTP·기록은 각각
 * 기존 함수가 하고, 이 파일은 "언제 무엇을 부르고 언제 멈추는가"만 정한다.
 * 기존 함수는 하나도 고치지 않았다.
 *
 * 순서
 *   1) 주문에 귀속된 승인 결제 찾기
 *   2) 전액취소해도 되는 결제인지 확인
 *   3) 취소 실행권 선점(atomic claim)
 *   4) NICEPAY 전액취소 1회
 *   5) 결과를 취소 감사 기록에 남기기
 * 앞 단계에서 막히면 뒤 단계는 실행되지 않는다. 특히 3)을 통과하지 못하면
 * NICEPAY를 부르지 않는다.
 *
 * 이 단계에서 하지 않는 일
 * - Payment.status / cancelledAmount / cancelledAt 변경
 * - RefundRequest 상태 변경(approved → completed)
 * - 자동 재시도, 선점 되돌리기, 거래조회
 * succeeded는 "NICEPAY가 성공을 답했고 그 사실을 기록까지 했다"는 뜻일 뿐,
 * 결제가 취소 상태가 되었다는 뜻이 아니다.
 */
import type { NicepayCancelOutcome } from "@/lib/server/nicepayCancel";
import type { OrderPaymentLookup } from "@/lib/server/paymentLookup";
import type { Payment, PaymentCancelResultKind } from "@/lib/types/app";

/**
 * NICEPAY에 보내는 취소 사유. 서버가 정한 한 문장만 쓴다.
 *
 * 고객이 적은 글(RefundRequest.message)을 그대로 보내지 않는다. 그 글에는 이름·연락처
 * 같은 개인정보가 섞일 수 있고, 외부 결제사에 보낼 내용은 우리가 정해야 한다.
 * 주문 제목이나 회원 정보도 넣지 않는다.
 */
export const REFUND_CANCEL_REASON = "사주로그 관리자 승인 환불";

/** 이 흐름이 쓰는 바깥 기능들. 테스트에서 바꿔 끼울 수 있도록 인자로 받는다. */
export interface RefundPaymentCancellationDeps {
  findPaidPaymentForOrder: (orderId: string) => Promise<OrderPaymentLookup>;
  claimPaymentCancellation: (
    paymentId: string,
  ) => Promise<{ ok: true; payment: Payment } | { ok: false; reason: "not-claimable" }>;
  cancelNicepayPayment: (input: {
    tid: string;
    orderId: string;
    reason: string;
  }) => Promise<NicepayCancelOutcome>;
  recordPaymentCancelAttempt: (input: {
    paymentId: string;
    kind: PaymentCancelResultKind;
    resultCode?: string | null;
    resultMessage?: string | null;
    raw?: Record<string, unknown> | null;
  }) => Promise<Payment | null>;
}

/** 전액취소를 걸 수 없는 이유. 모두 PG를 부르기 전에 걸러진다. */
export type InvalidPaymentReason =
  /** 취소에 쓸 거래 번호가 없다. 승인은 됐는데 tid가 비어 있는 경우다. */
  | "missing-tid"
  /** 승인 금액이 없거나 0 이하다. 무엇을 돌려줄지 알 수 없다. */
  | "no-approved-amount"
  /** 이미 취소된 금액이 있다. 전액취소로 다룰 수 없어 사람이 확인한다. */
  | "already-cancelled";

export type RefundPaymentCancellationResult =
  /** 결제 기록이 없다. 0원 주문처럼 애초에 결제가 없었던 경우다. */
  | { kind: "no-payment" }
  /** 같은 주문에 승인 결제가 둘 이상이다. 하나를 골라 취소하지 않는다. */
  | { kind: "ambiguous-payment" }
  | { kind: "invalid-payment"; reason: InvalidPaymentReason }
  /** 이미 누군가 취소를 실행했거나 끝난 결제다. 다시 부르지 않는다. */
  | { kind: "not-claimable" }
  /** NICEPAY가 취소 성공을 답했고 그 사실을 기록까지 했다. */
  | { kind: "succeeded"; payment: Payment }
  /** NICEPAY가 분명히 거절했다. */
  | { kind: "declined"; payment: Payment }
  /** 실제 취소 여부를 확정할 수 없다. 자동으로 다시 부르지 않는다. */
  | { kind: "unknown"; payment: Payment }
  /**
   * NICEPAY를 부른 뒤 결과를 남기지 못했다.
   *
   * 이때 PG에서는 이미 취소가 끝났을 수 있다. 그래서 다시 부르지 않고, 선점도
   * 되돌리지 않는다. 사람이 거래를 확인해야 하는 상태다.
   */
  | { kind: "recording-failed" };

/**
 * 주문 1건의 결제를 전액취소한다.
 *
 * 입력은 주문 id 하나뿐이다. 어떤 결제를 부를지, 얼마를 취소할지, 어떤 사유를 보낼지는
 * 모두 서버가 정한다. 결제 식별자나 금액을 바깥에서 고르게 하지 않는다.
 *
 * NICEPAY는 많아야 한 번 부른다. 어떤 결과에서도 이 함수 안에서 다시 부르지 않는다.
 */
export async function executeRefundPaymentCancellation(
  orderId: string,
  deps: RefundPaymentCancellationDeps,
): Promise<RefundPaymentCancellationResult> {
  // 1) 이 주문에 귀속된 승인 결제를 찾는다.
  const lookup = await deps.findPaidPaymentForOrder(orderId);
  if (lookup.kind === "no-payment") return { kind: "no-payment" };
  if (lookup.kind === "ambiguous") return { kind: "ambiguous-payment" };

  // 2) 전액취소해도 되는 결제인지 본다. 하나라도 어긋나면 PG를 부르지 않는다.
  const payment = lookup.payment;
  const tid = (payment.pgTid ?? "").trim();
  if (!tid) return { kind: "invalid-payment", reason: "missing-tid" };
  if (!payment.approvedAmount || payment.approvedAmount <= 0) {
    return { kind: "invalid-payment", reason: "no-approved-amount" };
  }
  // 부분취소 흔적이 있으면 전액취소가 맞는지 확정할 수 없다. 여기서 멈춘다.
  if (payment.cancelledAmount !== 0) {
    return { kind: "invalid-payment", reason: "already-cancelled" };
  }

  // 3) 실행권 선점. 통과한 요청만 PG를 부른다. 실패해도 되돌리거나 다시 시도하지 않는다.
  const claim = await deps.claimPaymentCancellation(payment.id);
  if (!claim.ok) return { kind: "not-claimable" };

  /*
   * 4)~5) 여기부터는 선점을 잡은 상태다.
   *
   * 무슨 일이 생겨도 선점을 NULL로 되돌리지 않는다. PG 요청을 보낸 직후에 끊겼는지
   * 보내기 전에 끊겼는지 우리 쪽 기록만으로는 구분할 수 없고, 되돌렸다가 다시 부르면
   * 같은 거래를 두 번 취소할 수 있다. processing으로 남겨 사람이 확인하게 둔다.
   */
  let outcome: NicepayCancelOutcome;
  try {
    outcome = await deps.cancelNicepayPayment({
      tid,
      orderId,
      reason: REFUND_CANCEL_REASON,
    });
  } catch (error) {
    // 부르는 중에 끊겼다. 다시 부르지 않는다. 내부 식별자만 남긴다.
    console.error("[refund] cancel call failed", { orderId, paymentId: payment.id }, error);
    return { kind: "recording-failed" };
  }

  /*
   * 남기는 것은 결과 종류와 PG가 준 코드·문구뿐이다. 취소 응답 전문은 담지 않는다.
   * 전문에는 우리가 보내지 않은 값까지 섞여 올 수 있고, 취소 여부 판정과 복구는
   * 이 구조화된 값과 거래조회만으로 이루어진다.
   */
  const record =
    outcome.kind === "unknown"
      ? { kind: "unknown" as const, resultCode: null, resultMessage: outcome.message }
      : {
          kind: outcome.kind,
          resultCode: outcome.result.resultCode ?? null,
          resultMessage: outcome.result.resultMsg ?? null,
        };

  let saved: Payment | null;
  try {
    saved = await deps.recordPaymentCancelAttempt({
      paymentId: payment.id,
      kind: record.kind,
      resultCode: record.resultCode,
      resultMessage: record.resultMessage,
      // raw는 넘기지 않는다. 저장 함수는 값이 없으면 그 열을 비워 둔다.
    });
  } catch (error) {
    // 기록에 실패했어도 PG에서는 이미 취소가 끝났을 수 있다. 다시 부르지 않는다.
    console.error("[refund] cancel record failed", { orderId, paymentId: payment.id }, error);
    return { kind: "recording-failed" };
  }
  if (!saved) {
    console.error("[refund] cancel record not applied", { orderId, paymentId: payment.id });
    return { kind: "recording-failed" };
  }

  return { kind: record.kind, payment: saved };
}

/**
 * 제품 코드에서 쓸 실제 구현들.
 *
 * 저장·HTTP 모듈을 이 파일 맨 위에서 바로 불러오지 않고 여기서 필요할 때 읽는다.
 * 그래야 위 흐름을 DB나 네트워크 없이 그 자체로 확인할 수 있다.
 */
export async function defaultRefundPaymentCancellationDeps(): Promise<RefundPaymentCancellationDeps> {
  const store = await import("@/lib/server/store");
  const nicepay = await import("@/lib/server/nicepayCancel");
  return {
    findPaidPaymentForOrder: store.findPaidPaymentForOrder,
    claimPaymentCancellation: store.claimPaymentCancellation,
    cancelNicepayPayment: (input) => nicepay.cancelNicepayPayment(input),
    recordPaymentCancelAttempt: store.recordPaymentCancelAttempt,
  };
}
