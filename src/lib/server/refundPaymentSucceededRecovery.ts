/**
 * 취소 성공 뒤 끊긴 건의 복구 흐름 (Refund-Payment-Succeeded-Recovery-1).
 *
 * NICEPAY 취소가 성공으로 기록되었는데 그 뒤(거래조회·대조·최종화)가 끝나지 않아
 * 내부가 이렇게 남은 건을 정리한다.
 *   Payment.status = 'paid'
 *   Payment.cancelExecutionStatus = 'succeeded'
 *   RefundRequest.status = 'approved'
 * 정상 완결 흐름(runRefundPaymentNormalFinalize)은 이 상태를 다시 다룰 수 없다.
 * 그 흐름은 취소 실행부터 시작하는데, 선점(claim) 조건이 IS NULL이라 통과하지
 * 못하기 때문이다. 그래서 취소 없이 조회만 하는 이 경로를 따로 둔다.
 *
 *   1) findPaidPaymentForOrder   — 주문에 귀속된 승인 결제 1건 찾기
 *   2) 사전검증                   — 실행 단계·식별자·금액이 갖춰졌는지
 *   3) inquireNicepayPayment     — 읽기 전용 거래조회 1회
 *   4) reconcileRefundPaymentCancel — 내부 기록과 조회 결과 대조(순수 함수)
 *   5) finalizeRefundPaymentCancel  — 확인된 경우에만 원자적 반영
 *   6) runRefundPointsRestore      — completed가 확정된 뒤에만 적립금 복원 1회 시도
 *
 * 이 파일이 쓰지 않는 것(구조적으로 부를 방법이 없다)
 * - cancelNicepayPayment / executeRefundPaymentCancellation /
 *   claimPaymentCancellation / runRefundPaymentNormalFinalize : import하지 않는다.
 * deps에 있는 바깥 기능은 결제 조회·거래조회·최종화 셋뿐이다.
 *
 * 그 밖에 하지 않는 일
 * - cancel_execution_status 되돌리기, 자동 재시도, Payment/RefundRequest 직접 UPDATE
 * - route·UI 연결
 *
 * 기존 복구 흐름과의 경계
 * - runRefundPaymentRecovery : cancelExecutionStatus가 unknown / processing인 건
 * - 이 파일                  : cancelExecutionStatus가 succeeded인 건
 * 세 값은 겹치지 않으므로 한 결제가 두 경로의 대상이 되는 일은 없다.
 * 형태만 맞추고 두 모듈을 억지로 합치지 않았다.
 */
import { reconcileRefundPaymentCancel } from "./refundPaymentReconciliation.ts";
import type { RefundPaymentReconciliation } from "./refundPaymentReconciliation.ts";
import type { NicepayPaymentInquiryOutcome } from "./nicepayPaymentInquiry.ts";
import type { OrderPaymentLookup } from "./paymentLookup.ts";
import type { FinalizeRefundPaymentInput, FinalizeRefundPaymentResult } from "./store.ts";
import type { RefundPointsRestoreResult } from "./refundPointsRestore.ts";

/** 이 흐름이 쓰는 바깥 기능들. 취소·선점 함수는 없다. */
export interface RefundPaymentSucceededRecoveryDeps {
  findPaidPaymentForOrder: (orderId: string) => Promise<OrderPaymentLookup>;
  inquirePayment: (input: { tid: string }) => Promise<NicepayPaymentInquiryOutcome>;
  finalize: (input: FinalizeRefundPaymentInput) => Promise<FinalizeRefundPaymentResult>;
  /**
   * 적립금 복원. completed가 확정된 뒤에만 부른다.
   *
   * 결과는 이 흐름의 반환값을 바꾸지 않는다(tryRestorePoints 참고).
   * 금액도 회원도 넘기지 않는다. 그 값은 복원 흐름이 주문·결제 기록에서 다시 읽는다.
   */
  restorePoints: (input: {
    orderId: string;
    refundRequestId: string | null;
  }) => Promise<RefundPointsRestoreResult>;
  /**
   * 대조. 기본값은 기존 순수 함수이며 제품 코드에서는 넘기지 않는다.
   * 실행 단계와 확정 경로가 어긋난 상황을 테스트로 고정하기 위한 자리다.
   */
  reconcile?: typeof reconcileRefundPaymentCancel;
}

/**
 * completed가 확정된 뒤 적립금 복원을 **한 번만** 시도한다.
 *
 * 어떤 경우에도 던지지 않고 아무것도 돌려주지 않는다. 환불은 이미 끝났고 그 사실은
 * PG와 DB에 남아 있다. 적립금을 돌려주지 못했다는 이유로 완료된 환불을 실패로 보이게
 * 하면, 관리자가 같은 거래를 다시 취소하려 하게 된다. 그쪽이 훨씬 위험하다.
 *
 * 정상 완결 흐름(refundPaymentNormalFinalize)과 같은 원칙이다. 두 파일을 억지로
 * 합치지 않은 것도 기존 복구 흐름들과 같은 이유다(경계가 다르고 결과 타입도 다르다).
 *
 * 기록에는 주문·결제 식별자와 사유만 남긴다. AppData·결제 원문·회원 정보·잔액·금액은 남기지 않는다.
 */
async function tryRestorePoints(
  deps: RefundPaymentSucceededRecoveryDeps,
  orderId: string,
  paymentId: string,
): Promise<void> {
  let restored: RefundPointsRestoreResult;
  try {
    /*
     * refundRequestId는 넘기지 않는다(null). 최종화 함수가 완료시킨 문의의 id를
     * 돌려주지 않기 때문이다. 이 값은 원장의 추적용 컬럼일 뿐 멱등 키가 아니라서
     * (멱등은 UNIQUE(order_id, type)가 맡는다), 없다고 복원이 막히거나 두 번 되지 않는다.
     * 그 id를 얻으려고 여기서 새 조회를 만들거나 최종화 반환 타입을 바꾸지 않는다.
     */
    restored = await deps.restorePoints({ orderId, refundRequestId: null });
  } catch (error) {
    // 복원 호출 자체가 끊겼다. 다시 부르지 않는다. 복구된 환불은 그대로 완료다.
    console.error("[refund] succeeded-recovery points restore threw", { orderId, paymentId }, error);
    return;
  }

  // 돌려주었거나, 이미 돌려준 주문이다. 둘 다 정상이다.
  if (restored.kind === "restored" || restored.kind === "already-restored") return;

  /*
   * not-applicable : 자동 복원 대상이 아니다(근거 없음·불일치·0원 등).
   * retry-later    : 저장소가 그사이 바뀌었다. 나중에 다시 하면 된다.
   * 어느 쪽도 여기서 재시도하지 않는다.
   */
  console.error("[refund] succeeded-recovery points restore not applied", {
    orderId,
    paymentId,
    kind: restored.kind,
    reason: restored.reason,
  });
}

/** 조회조차 하지 않고 멈추는 이유. 전부 PG를 부르기 전에 걸러진다. */
export type SucceededRecoveryNotRecoverableReason =
  /** 승인된 결제가 없다. */
  | "no-payment"
  /** 승인 결제가 둘 이상이다. 하나를 골라 복구하지 않는다. */
  | "ambiguous-payment"
  /** 취소 실행 단계가 succeeded가 아니다. 이 경로의 대상이 아니다. */
  | "not-succeeded-execution"
  /** 결제에 적힌 주문과 요청한 주문이 다르다. */
  | "order-id-mismatch"
  /** 조회에 쓸 거래 번호가 없다. */
  | "missing-tid"
  /** 승인 금액이 없거나 정상적인 금액이 아니다. */
  | "invalid-approved-amount"
  /** 이미 취소 금액이 적혀 있다. 전액취소로 다룰 수 없다. */
  | "already-cancelled"
  /** 대조가 사람 확인이 필요하다고 판정했다. */
  | "reconciliation-manual-review"
  /** 확인된 취소의 경로가 이 결제의 실행 단계와 맞지 않는다. */
  | "source-mismatch";

export type RefundPaymentSucceededRecoveryResult =
  /**
   * 거래조회로 전액취소를 확인했고 내부 반영까지 끝났다.
   * alreadyFinalized는 이번 호출이 아무것도 바꾸지 않았고 DB가 이미 완료 상태였다는 뜻이다.
   */
  | { kind: "recovered-completed"; paymentId: string; orderId: string; alreadyFinalized: boolean }
  /** 복구 대상이 아니거나, 조회 사실이 전액취소와 어긋난다. */
  | {
      kind: "not-recoverable";
      reason: SucceededRecoveryNotRecoverableReason;
      manualReview: boolean;
      paymentId: string | null;
      orderId: string;
      reconciliation?: RefundPaymentReconciliation;
    }
  /** 지금은 확인하지 못했다. 취소되지 않았다는 뜻이 아니다. 다시 취소하지 않는다. */
  | {
      kind: "verification-pending";
      paymentId: string;
      orderId: string;
      reconciliation: RefundPaymentReconciliation;
    }
  /** 확인은 됐지만 내부 반영이 되지 않았다. PG에서는 이미 환불이 끝났을 수 있다. */
  | {
      kind: "recovery-failed";
      paymentId: string;
      orderId: string;
      finalize?: FinalizeRefundPaymentResult;
    };

/**
 * 취소 성공 기록만 남고 끝나지 않은 주문 1건을 조회로 정리한다.
 *
 * 입력은 주문 id 하나뿐이다. 결제·거래 번호·금액·확정 경로는 모두 지금 DB에 있는
 * 결제에서 서버가 읽는다.
 */
export async function runRefundPaymentSucceededRecovery(
  orderId: string,
  deps: RefundPaymentSucceededRecoveryDeps,
): Promise<RefundPaymentSucceededRecoveryResult> {
  // 1) 주문에 귀속된 승인 결제를 찾는다.
  const lookup = await deps.findPaidPaymentForOrder(orderId);
  if (lookup.kind === "no-payment") {
    return { kind: "not-recoverable", reason: "no-payment", manualReview: false, paymentId: null, orderId };
  }
  if (lookup.kind === "ambiguous") {
    return { kind: "not-recoverable", reason: "ambiguous-payment", manualReview: true, paymentId: null, orderId };
  }

  const payment = lookup.payment;
  const paymentId = payment.id;

  /*
   * 2) 이 경로의 대상은 실행 단계가 succeeded인 건뿐이다.
   * NULL(시도 없음)·declined(거절)은 복구 대상이 아니고,
   * processing·unknown은 runRefundPaymentRecovery가 맡는다. 여기서 끌어다 처리하지 않는다.
   */
  if (payment.cancelExecutionStatus !== "succeeded") {
    return {
      kind: "not-recoverable",
      reason: "not-succeeded-execution",
      manualReview: false,
      paymentId,
      orderId,
    };
  }

  // 3) 사전검증. 하나라도 어긋나면 PG를 부르지 않는다.
  if ((payment.orderId ?? "").trim() !== orderId.trim()) {
    // 결제에 적힌 주문과 요청한 주문이 다르다. 어느 쪽이 맞는지 정하지 않는다.
    return { kind: "not-recoverable", reason: "order-id-mismatch", manualReview: true, paymentId, orderId };
  }
  const tid = (payment.pgTid ?? "").trim();
  if (!tid) {
    return { kind: "not-recoverable", reason: "missing-tid", manualReview: true, paymentId, orderId };
  }
  if (
    payment.approvedAmount === null ||
    !Number.isSafeInteger(payment.approvedAmount) ||
    payment.approvedAmount <= 0
  ) {
    return {
      kind: "not-recoverable",
      reason: "invalid-approved-amount",
      manualReview: true,
      paymentId,
      orderId,
    };
  }
  if (payment.cancelledAmount !== 0) {
    // 부분취소 흔적이 있으면 전액취소로 올릴 수 없다.
    return { kind: "not-recoverable", reason: "already-cancelled", manualReview: true, paymentId, orderId };
  }

  // 4) 거래조회 1회. 읽기만 한다. 실패해도 다시 부르지 않는다.
  let inquiry: NicepayPaymentInquiryOutcome;
  try {
    inquiry = await deps.inquirePayment({ tid });
  } catch (error) {
    // 확인하지 못한 것이지 취소되지 않은 것이 아니다. 내부 식별자만 남긴다.
    console.error("[refund] succeeded-recovery inquiry failed", { orderId, paymentId }, error);
    return {
      kind: "verification-pending",
      paymentId,
      orderId,
      reconciliation: { kind: "not-verified", reason: "inquiry-unknown" },
    };
  }

  // 5) 대조. 저장도 네트워크도 없는 순수 판정이다.
  let reconciliation: RefundPaymentReconciliation;
  try {
    reconciliation = (deps.reconcile ?? reconcileRefundPaymentCancel)(payment, inquiry);
  } catch (error) {
    console.error("[refund] succeeded-recovery reconcile failed", { orderId, paymentId }, error);
    return { kind: "recovery-failed", paymentId, orderId };
  }

  if (reconciliation.kind === "manual-review") {
    return {
      kind: "not-recoverable",
      reason: "reconciliation-manual-review",
      manualReview: true,
      paymentId,
      orderId,
      reconciliation,
    };
  }
  if (reconciliation.kind === "not-verified") {
    /*
     * 부분취소와 금액 근거 없음은 전액취소로 올릴 수 없는 사실 문제라 사람이 본다.
     * 조회 실패(inquiry-unknown)와 아직 취소되지 않음(pg-not-cancelled)은
     * "지금 확인되지 않았다"일 뿐이다. 어느 쪽도 재취소 신호가 아니다.
     */
    if (
      reconciliation.reason === "pg-partial-cancelled" ||
      reconciliation.reason === "missing-amount-evidence"
    ) {
      return {
        kind: "not-recoverable",
        reason: "reconciliation-manual-review",
        manualReview: true,
        paymentId,
        orderId,
        reconciliation,
      };
    }
    return { kind: "verification-pending", paymentId, orderId, reconciliation };
  }

  /*
   * 6) 내부 실행 단계가 succeeded이므로 기존 대조 계약상 확정 경로는 normal이어야 한다.
   * recovered-unknown·recovered-stale-claim이 나왔다면 사실관계가 어긋난 것이므로
   * 반영하지 않는다.
   */
  if (reconciliation.source !== "normal") {
    return {
      kind: "not-recoverable",
      reason: "source-mismatch",
      manualReview: true,
      paymentId,
      orderId,
      reconciliation,
    };
  }

  // 7) 최종 반영. 확인된 사실의 최소 필드만 그대로 넘긴다.
  let finalized: FinalizeRefundPaymentResult;
  try {
    finalized = await deps.finalize({
      paymentId: reconciliation.paymentId,
      orderId: reconciliation.orderId,
      tid: reconciliation.tid,
      approvedAmount: reconciliation.approvedAmount,
      verifiedCancelledAmount: reconciliation.verifiedCancelledAmount,
      pgCancelledAt: reconciliation.pgCancelledAt,
      source: reconciliation.source,
    });
  } catch (error) {
    // 반영 중 끊겼다. 상태를 되돌리지도, 취소를 부르지도 않는다.
    console.error("[refund] succeeded-recovery finalize threw", { orderId, paymentId }, error);
    return { kind: "recovery-failed", paymentId, orderId };
  }

  if (finalized.ok) {
    await tryRestorePoints(deps, orderId, paymentId);
    return { kind: "recovered-completed", paymentId, orderId, alreadyFinalized: false };
  }
  if (finalized.kind === "already-finalized") {
    /*
     * 이번 호출은 아무것도 바꾸지 않았지만 DB는 이미 완료 상태다. 완료로 읽는다.
     * 이 경로에서도 복원을 시도한다. 앞선 시도가 끊겼을 수 있고, 이미 돌려준 주문이면
     * 원장의 UNIQUE가 already-restored로 돌려보낸다. 두 번 늘어나지 않는다.
     */
    await tryRestorePoints(deps, orderId, paymentId);
    return { kind: "recovered-completed", paymentId, orderId, alreadyFinalized: true };
  }
  console.error("[refund] succeeded-recovery finalize failed", { orderId, paymentId, kind: finalized.kind });
  return { kind: "recovery-failed", paymentId, orderId, finalize: finalized };
}

/**
 * 제품 코드에서 쓸 실제 구현들.
 *
 * 저장·조회 모듈은 여기서 필요할 때 읽는다. 취소 client는 읽지 않는다.
 */
export async function defaultRefundPaymentSucceededRecoveryDeps(): Promise<RefundPaymentSucceededRecoveryDeps> {
  const store = await import("@/lib/server/store");
  const inquiry = await import("@/lib/server/nicepayPaymentInquiry");
  const points = await import("@/lib/server/refundPointsRestore");
  return {
    findPaidPaymentForOrder: store.findPaidPaymentForOrder,
    inquirePayment: (input) => inquiry.inquireNicepayPayment(input),
    finalize: (input) => store.finalizeRefundPaymentCancel(input),
    restorePoints: async (input) =>
      points.runRefundPointsRestore(input, await points.defaultRefundPointsRestoreDeps()),
  };
}
