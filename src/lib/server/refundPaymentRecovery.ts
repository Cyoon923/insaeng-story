/**
 * 끊긴 취소 건 복구 흐름 (Refund-Payment-Recovery-Orchestration-1).
 *
 * 취소를 시도했지만 우리 기록이 끊겨 완료로 정리하지 못한 결제를, **다시 취소하지 않고**
 * 거래조회 사실만으로 정리한다.
 *
 *   1) findPaidPaymentForOrder   — 주문에 귀속된 승인 결제 1건 찾기
 *   2) 복구 대상인지 확인         — cancelExecutionStatus가 unknown / processing인 경우만
 *   3) inquireNicepayPayment     — 읽기 전용 거래조회 1회
 *   4) reconcileRefundPaymentCancel — 내부 기록과 조회 결과 대조(순수 함수)
 *   5) finalizeRefundPaymentCancel  — 확인된 경우에만 원자적 반영
 *   6) runRefundPointsRestore      — completed가 확정된 뒤에만 적립금 복원 1회 시도
 *
 * 이 파일이 쓰지 않는 것(구조적으로 부를 방법이 없다)
 * - cancelNicepayPayment            : import하지 않는다.
 * - executeRefundPaymentCancellation: import하지 않는다.
 * - claimPaymentCancellation        : import하지 않고 deps에도 없다.
 * deps에 있는 바깥 기능은 결제 조회·거래조회·최종화 셋뿐이라, 이 흐름에서 취소나
 * 선점이 일어날 수 있는 경로 자체가 없다.
 *
 * 그 밖에 하지 않는 일
 * - cancel_execution_status 되돌리기, 선점 해제, 자동 재시도
 * - Payment / RefundRequest 직접 UPDATE
 * - 시간이 오래 지났다는 이유만으로 무언가를 허용하는 판단
 * - 관리자 route·UI 연결
 */
import { reconcileRefundPaymentCancel } from "./refundPaymentReconciliation.ts";
import type { RefundPaymentReconciliation } from "./refundPaymentReconciliation.ts";
import type { NicepayPaymentInquiryOutcome } from "./nicepayPaymentInquiry.ts";
import type { OrderPaymentLookup } from "./paymentLookup.ts";
import type { FinalizeRefundPaymentInput, FinalizeRefundPaymentResult } from "./store.ts";
import type { RefundPointsRestoreResult } from "./refundPointsRestore.ts";

/**
 * 이 흐름이 쓰는 바깥 기능들. 여기에 취소·선점 함수는 없다.
 *
 * findPaidPaymentForOrder는 status='paid'인 결제만 찾는다(질의와 classifyPaidPayments가
 * 모두 그렇게 되어 있다). 복구 대상도 아직 결제 행이 승인 상태로 남아 있는 건이라
 * 그대로 재사용할 수 있고, 복구 전용 조회를 따로 만들지 않았다.
 */
export interface RefundPaymentRecoveryDeps {
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
  deps: RefundPaymentRecoveryDeps,
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
    console.error("[refund] recovery points restore threw", { orderId, paymentId }, error);
    return;
  }

  // 돌려주었거나, 이미 돌려준 주문이다. 둘 다 정상이다.
  if (restored.kind === "restored" || restored.kind === "already-restored") return;

  /*
   * not-applicable : 자동 복원 대상이 아니다(근거 없음·불일치·0원 등).
   * retry-later    : 저장소가 그사이 바뀌었다. 나중에 다시 하면 된다.
   * 어느 쪽도 여기서 재시도하지 않는다.
   */
  console.error("[refund] recovery points restore not applied", {
    orderId,
    paymentId,
    kind: restored.kind,
    reason: restored.reason,
  });
}

/** 조회조차 하지 않고 멈추는 이유. 전부 PG를 부르기 전에 걸러진다. */
export type RecoveryNotRecoverableReason =
  /** 승인된 결제가 없다. 0원 주문처럼 애초에 결제가 없던 경우다. */
  | "no-payment"
  /** 승인 결제가 둘 이상이다. 하나를 골라 복구하지 않는다. */
  | "ambiguous-payment"
  /** 취소를 시도한 기록이 없다. 복구할 대상이 아니다. */
  | "no-cancel-attempt"
  /** PG가 분명히 거절한 건이다. 자동으로 완료로 만들지 않는다. */
  | "cancel-declined"
  /** 이미 성공으로 기록된 건이다. 정상 흐름의 경계라 여기서 임의로 다루지 않는다. */
  | "cancel-succeeded"
  /** 조회에 쓸 거래 번호가 없다. */
  | "missing-tid"
  /** 승인 금액이 없거나 정상적인 금액이 아니다. */
  | "invalid-approved-amount"
  /** 대조가 사람 확인이 필요하다고 판정했다. */
  | "reconciliation-manual-review"
  /** 확인된 취소의 경로가 이 결제의 실행 단계와 맞지 않는다. */
  | "source-mismatch";

export type RefundPaymentRecoveryResult =
  /**
   * 거래조회로 전액취소를 확인했고 내부 반영까지 끝났다.
   *
   * alreadyFinalized는 이번 호출이 아무것도 바꾸지 않았고 DB가 이미 완료 상태였다는
   * 뜻이다(최종화 함수의 already-finalized 계약을 그대로 따른다).
   */
  | {
      kind: "recovered-completed";
      paymentId: string;
      orderId: string;
      source: "recovered-unknown" | "recovered-stale-claim";
      alreadyFinalized: boolean;
    }
  /**
   * 복구 대상이 아니거나, 조회 사실이 전액취소와 어긋난다.
   * manualReview가 true면 사람이 거래를 확인해야 하는 상태다.
   */
  | {
      kind: "not-recoverable";
      reason: RecoveryNotRecoverableReason;
      manualReview: boolean;
      paymentId: string | null;
      orderId: string;
      reconciliation?: RefundPaymentReconciliation;
    }
  /**
   * 지금은 확인하지 못했다. 취소되지 않았다는 뜻이 아니다.
   * 다시 조회하지 않고, 어떤 경우에도 다시 취소하지 않는다.
   */
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

/** 복구를 시도할 수 있는 실행 단계. 이 둘만 조회 대상이다. */
export type RecoverableExecutionStatus = "unknown" | "processing";

/** 실행 단계별로 허용되는 확정 경로. 이 짝이 맞을 때만 최종화한다. */
const ALLOWED_SOURCE: Record<RecoverableExecutionStatus, "recovered-unknown" | "recovered-stale-claim"> = {
  unknown: "recovered-unknown",
  processing: "recovered-stale-claim",
};

/**
 * 주문 1건의 끊긴 취소를 조회로 복구한다.
 *
 * 입력은 주문 id 하나뿐이다. 어떤 결제인지, 거래 번호가 무엇인지, 금액이 얼마인지,
 * 어떤 복구 경로인지는 모두 지금 DB에 있는 결제에서 서버가 읽는다. 바깥에서 고르게
 * 하지 않는다.
 */
export async function runRefundPaymentRecovery(
  orderId: string,
  deps: RefundPaymentRecoveryDeps,
): Promise<RefundPaymentRecoveryResult> {
  // 1) 주문에 귀속된 승인 결제를 찾는다.
  const lookup = await deps.findPaidPaymentForOrder(orderId);
  if (lookup.kind === "no-payment") {
    return { kind: "not-recoverable", reason: "no-payment", manualReview: false, paymentId: null, orderId };
  }
  if (lookup.kind === "ambiguous") {
    // 어느 거래가 진짜인지 모르는 상태다. 조회 대상을 임의로 고르지 않는다.
    return { kind: "not-recoverable", reason: "ambiguous-payment", manualReview: true, paymentId: null, orderId };
  }

  const payment = lookup.payment;
  const paymentId = payment.id;
  const execution = payment.cancelExecutionStatus ?? null;

  // 2) 복구 대상인지. unknown / processing 두 가지만이다.
  if (execution === null) {
    // 취소를 시도한 근거가 없다. 조회로 무언가를 확정할 자리가 아니다.
    return { kind: "not-recoverable", reason: "no-cancel-attempt", manualReview: false, paymentId, orderId };
  }
  if (execution === "declined") {
    return { kind: "not-recoverable", reason: "cancel-declined", manualReview: true, paymentId, orderId };
  }
  if (execution === "succeeded") {
    // 정상 흐름이 다루는 경계다. 여기서 끌어다 처리하지 않는다.
    return { kind: "not-recoverable", reason: "cancel-succeeded", manualReview: false, paymentId, orderId };
  }
  /*
   * processing은 선점만 남고 끊긴 건이다. cancelClaimedAt이 오래되었는지는 사람이
   * 볼 때 참고할 정보일 뿐이며, 여기서 시간을 근거로 무엇을 허용하지 않는다.
   * cancelAttemptedAt이 비어 있어도 "PG 요청 전에 끊겼다"고 단정하지 않는다.
   * 요청을 보낸 직후에 끊겼는지 보내기 전이었는지는 우리 기록만으로 구분할 수 없다.
   * 그래서 이 단계에서 processing에 허용되는 행동은 거래조회뿐이다.
   */
  const recoverable: RecoverableExecutionStatus = execution;

  // 3) identity 사전검사. 하나라도 없으면 PG를 부르지 않는다.
  const tid = (payment.pgTid ?? "").trim();
  if (!tid) {
    return { kind: "not-recoverable", reason: "missing-tid", manualReview: true, paymentId, orderId };
  }
  if (!payment.approvedAmount || payment.approvedAmount <= 0) {
    return {
      kind: "not-recoverable",
      reason: "invalid-approved-amount",
      manualReview: true,
      paymentId,
      orderId,
    };
  }

  // 4) 거래조회 1회. 읽기만 한다. 실패해도 다시 부르지 않는다.
  let inquiry: NicepayPaymentInquiryOutcome;
  try {
    inquiry = await deps.inquirePayment({ tid });
  } catch (error) {
    // 확인하지 못한 것이지 취소되지 않은 것이 아니다. 내부 식별자만 남긴다.
    console.error("[refund] recovery inquiry failed", { orderId, paymentId }, error);
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
    console.error("[refund] recovery reconcile failed", { orderId, paymentId }, error);
    return { kind: "recovery-failed", paymentId, orderId };
  }

  if (reconciliation.kind === "manual-review") {
    // 거래 없음·식별자 불일치·금액 불일치 등. 사람이 확인한다.
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

  // 6) 확정 경로가 이 결제의 실행 단계와 맞아야 한다. 어긋나면 반영하지 않는다.
  if (reconciliation.source !== ALLOWED_SOURCE[recoverable]) {
    return {
      kind: "not-recoverable",
      reason: "source-mismatch",
      manualReview: true,
      paymentId,
      orderId,
      reconciliation,
    };
  }
  const source = reconciliation.source;

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
      source,
    });
  } catch (error) {
    // 반영 중 끊겼다. 상태를 되돌리지도, 취소를 부르지도 않는다.
    console.error("[refund] recovery finalize threw", { orderId, paymentId }, error);
    return { kind: "recovery-failed", paymentId, orderId };
  }

  if (finalized.ok) {
    await tryRestorePoints(deps, orderId, paymentId);
    return { kind: "recovered-completed", paymentId, orderId, source, alreadyFinalized: false };
  }
  if (finalized.kind === "already-finalized") {
    /*
     * 이번 호출은 아무것도 바꾸지 않았지만 DB는 이미 완료 상태다. 완료로 읽는다.
     * 이 경로에서도 복원을 시도한다. 앞선 시도가 끊겼을 수 있고, 이미 돌려준 주문이면
     * 원장의 UNIQUE가 already-restored로 돌려보낸다. 두 번 늘어나지 않는다.
     */
    await tryRestorePoints(deps, orderId, paymentId);
    return { kind: "recovered-completed", paymentId, orderId, source, alreadyFinalized: true };
  }
  // payment-mismatch / refund-request-mismatch / ambiguous-refund-request / invalid-amount.
  console.error("[refund] recovery finalize failed", { orderId, paymentId, kind: finalized.kind });
  return { kind: "recovery-failed", paymentId, orderId, finalize: finalized };
}

/**
 * 제품 코드에서 쓸 실제 구현들.
 *
 * 저장·HTTP 모듈은 여기서 필요할 때 읽는다. 취소 client는 읽지 않는다.
 */
export async function defaultRefundPaymentRecoveryDeps(): Promise<RefundPaymentRecoveryDeps> {
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
