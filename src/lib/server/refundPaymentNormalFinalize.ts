/**
 * 정상 환불 완결 흐름 (Refund-Payment-Normal-Finalize-Orchestration-1).
 *
 * 이미 만들어 둔 네 조각을 정해진 순서로 엮기만 한다.
 *   1) executeRefundPaymentCancellation  — NICEPAY 전액취소 1회(그 안에서 선점·기록까지)
 *   2) inquireNicepayPayment             — 취소가 성공으로 기록된 건만 거래조회 1회
 *   3) reconcileRefundPaymentCancel      — 내부 기록과 조회 결과 대조(순수 함수)
 *   4) finalizeRefundPaymentCancel       — 결제·환불 문의를 한 문장으로 최종 반영
 *   5) runRefundPointsRestore            — completed가 확정된 뒤에만 적립금 복원 1회 시도
 *
 * 앞 단계가 원하는 답을 주지 않으면 뒤 단계는 실행되지 않는다. 특히 취소 결과가
 * succeeded가 아니면 조회조차 하지 않는다.
 *
 * 이 파일이 하지 않는 일
 * - 취소 API 재호출. 어떤 실패에서도 다시 부르지 않는다.
 * - 거래조회 재시도. 확인하지 못했다는 사실 자체가 사람이 봐야 한다는 신호다.
 * - Payment / RefundRequest 직접 UPDATE. 반영은 오직 최종화 함수만 한다.
 * - unknown·stale 복구. 그것은 뒤에 따로 만들 흐름이고 여기서는 막아 둔다.
 * - 관리자 route·UI 연결.
 *
 * completed는 "PG 거래조회로 전액취소를 확인했고, 그 사실을 내부 DB에 원자적으로
 * 반영까지 끝냈다"는 뜻이다. 그 앞 단계는 어느 것도 completed가 아니다.
 */
import {
  executeRefundPaymentCancellation,
  defaultRefundPaymentCancellationDeps,
} from "./refundPaymentCancellation.ts";
import type {
  RefundPaymentCancellationDeps,
  RefundPaymentCancellationResult,
} from "./refundPaymentCancellation.ts";
import { reconcileRefundPaymentCancel } from "./refundPaymentReconciliation.ts";
import type { RefundPaymentReconciliation } from "./refundPaymentReconciliation.ts";
import type { NicepayPaymentInquiryOutcome } from "./nicepayPaymentInquiry.ts";
import type {
  FinalizeRefundPaymentInput,
  FinalizeRefundPaymentResult,
} from "./store.ts";
import type { RefundPointsRestoreResult } from "./refundPointsRestore.ts";

/** 이 흐름이 쓰는 바깥 기능들. 테스트에서 바꿔 끼운다. */
export interface RefundPaymentNormalFinalizeDeps {
  /** 취소 실행. 안에서 선점·NICEPAY 취소 1회·기록까지 끝낸다. */
  executeCancellation: (orderId: string) => Promise<RefundPaymentCancellationResult>;
  /** 거래조회. 읽기 전용이며 이 흐름에서 많아야 1회 부른다. */
  inquirePayment: (input: { tid: string }) => Promise<NicepayPaymentInquiryOutcome>;
  /** 최종 반영. 결제와 환불 문의를 한 문장으로 바꾼다. */
  finalize: (input: FinalizeRefundPaymentInput) => Promise<FinalizeRefundPaymentResult>;
  /**
   * 적립금 복원. completed가 확정된 뒤에만 부른다.
   *
   * 결과는 이 흐름의 반환값을 바꾸지 않는다(아래 tryRestorePoints 참고).
   * 금액도 회원도 넘기지 않는다. 그 값은 복원 흐름이 주문·결제 기록에서 다시 읽는다.
   */
  restorePoints: (input: {
    orderId: string;
    refundRequestId: string | null;
  }) => Promise<RefundPointsRestoreResult>;
}

export type RefundPaymentNormalFinalizeResult =
  /**
   * PG 전액취소를 조회로 확인했고 내부 반영까지 끝났다.
   *
   * alreadyFinalized는 이번 호출이 아무것도 바꾸지 않았고 DB가 이미 그 상태였다는 뜻이다.
   * 최종화 함수의 already-finalized 계약(결제가 cancelled이고 취소 금액이 확인 금액과 같고
   * 완료된 환불 문의가 있음)을 그대로 따른다. 이 조건에서만 완료로 읽는다.
   */
  | { kind: "completed"; paymentId: string; orderId: string; alreadyFinalized: boolean }
  /** 취소가 성공으로 끝나지 않았다. 조회·최종화는 하지 않았다. */
  | { kind: "cancel-not-completed"; cancel: RefundPaymentCancellationResult }
  /**
   * 취소는 성공으로 기록됐지만 전액취소 사실을 확정하지 못했다.
   * PG에서는 이미 환불되었을 수 있다. 재취소 금지, 사람이 확인한다.
   */
  | { kind: "verification-pending"; paymentId: string; orderId: string; reconciliation: RefundPaymentReconciliation }
  /**
   * 확정까지는 됐지만 내부 반영이 되지 않았다.
   * 역시 PG에서는 이미 환불되었을 수 있다. 재취소하지 않는다.
   */
  | { kind: "finalization-failed"; paymentId: string; orderId: string; finalize: FinalizeRefundPaymentResult };

/**
 * completed가 확정된 뒤 적립금 복원을 **한 번만** 시도한다.
 *
 * 이 함수는 어떤 경우에도 던지지 않고 아무것도 돌려주지 않는다. 환불은 이미 끝났고
 * 그 사실은 PG와 DB에 남아 있다. 적립금을 돌려주지 못했다는 이유로 완료된 환불을
 * 실패로 보이게 하면, 관리자가 같은 거래를 다시 취소하려 하게 된다. 그쪽이 훨씬 위험하다.
 *
 * 그래서 복원 결과(applied / already-restored / not-applicable / retry-later)와
 * 예외를 모두 여기서 끝낸다. 돌려주지 못한 건은 기록만 남고, 나중에 복구 경로가 맡는다.
 *
 * 기록에는 주문·결제 식별자와 사유만 남긴다. AppData·결제 원문·회원 정보·금액은 남기지 않는다.
 */
async function tryRestorePoints(
  deps: RefundPaymentNormalFinalizeDeps,
  orderId: string,
  paymentId: string,
): Promise<void> {
  let restored: RefundPointsRestoreResult;
  try {
    /*
     * refundRequestId는 넘기지 않는다(null). 최종화 함수가 완료시킨 문의의 id를
     * 돌려주지 않기 때문이다. 이 값은 원장의 추적용 컬럼일 뿐 멱등 키가 아니라서,
     * 없다고 복원이 막히거나 두 번 되지 않는다. 그 id를 얻으려고 여기서 새 조회를
     * 만들지 않는다.
     */
    restored = await deps.restorePoints({ orderId, refundRequestId: null });
  } catch (error) {
    // 복원 호출 자체가 끊겼다. 다시 부르지 않는다. 완료된 환불은 그대로 완료다.
    console.error("[refund] points restore threw", { orderId, paymentId }, error);
    return;
  }

  // 돌려주었거나, 이미 돌려준 주문이다. 둘 다 정상이다.
  if (restored.kind === "restored" || restored.kind === "already-restored") return;

  /*
   * not-applicable : 자동 복원 대상이 아니다(근거 없음·불일치·0원 등).
   * retry-later    : 저장소가 그사이 바뀌었다. 나중에 다시 하면 된다.
   * 어느 쪽도 여기서 재시도하지 않는다. 재시도는 사람이 누르는 복구가 맡는다.
   */
  console.error("[refund] points restore not applied", {
    orderId,
    paymentId,
    kind: restored.kind,
    reason: restored.reason,
  });
}

/**
 * 주문 1건의 정상 전액환불을 끝까지 진행한다.
 *
 * 입력은 주문 id 하나뿐이다. 어떤 결제를 부를지, 얼마를 취소·확인할지는 모두 서버가 정한다.
 */
export async function runRefundPaymentNormalFinalize(
  orderId: string,
  deps: RefundPaymentNormalFinalizeDeps,
): Promise<RefundPaymentNormalFinalizeResult> {
  // A) 취소 실행. NICEPAY 취소는 여기 안에서 많아야 1회다.
  const cancel = await deps.executeCancellation(orderId);
  /*
   * succeeded가 아니면 여기서 끝이다. declined·unknown·recording-failed·no-payment·
   * ambiguous-payment·invalid-payment·not-claimable 모두 자동으로 다음 단계로 가지 않는다.
   * unknown·recording-failed는 뒤에 만들 복구 흐름의 몫이며 여기서 다루지 않는다.
   */
  if (cancel.kind !== "succeeded") return { kind: "cancel-not-completed", cancel };

  const payment = cancel.payment;
  const paymentId = payment.id;
  const tid = (payment.pgTid ?? "").trim();
  if (!tid) {
    // 취소까지 끝난 결제인데 거래 번호가 없다. 조회할 대상을 지어내지 않는다.
    return {
      kind: "verification-pending",
      paymentId,
      orderId,
      reconciliation: { kind: "manual-review", reason: "missing-internal-tid" },
    };
  }

  // B) 거래조회 1회. 실패해도 다시 부르지 않고, 취소는 절대 다시 부르지 않는다.
  let inquiry: NicepayPaymentInquiryOutcome;
  try {
    inquiry = await deps.inquirePayment({ tid });
  } catch (error) {
    // 조회하지 못한 것이지 취소되지 않은 것이 아니다. 내부 식별자만 남긴다.
    console.error("[refund] inquiry call failed", { orderId, paymentId }, error);
    return {
      kind: "verification-pending",
      paymentId,
      orderId,
      reconciliation: { kind: "not-verified", reason: "inquiry-unknown" },
    };
  }

  // C) 대조. 저장도 네트워크도 없는 순수 판정이다.
  const reconciliation = reconcileRefundPaymentCancel(payment, inquiry);
  /*
   * D) 최종화는 "조회로 전액취소가 확인되었고, 그 경로가 정상 취소"일 때만 한다.
   * recovered-unknown / recovered-stale-claim은 정상 흐름에서 자동으로 반영하지 않는다.
   */
  if (reconciliation.kind !== "verified-full-cancel" || reconciliation.source !== "normal") {
    return { kind: "verification-pending", paymentId, orderId, reconciliation };
  }

  const finalized = await deps.finalize({
    paymentId: reconciliation.paymentId,
    orderId: reconciliation.orderId,
    tid: reconciliation.tid,
    approvedAmount: reconciliation.approvedAmount,
    verifiedCancelledAmount: reconciliation.verifiedCancelledAmount,
    pgCancelledAt: reconciliation.pgCancelledAt,
    source: reconciliation.source,
  });

  // E) 반영 결과.
  if (finalized.ok) {
    await tryRestorePoints(deps, orderId, paymentId);
    return { kind: "completed", paymentId, orderId, alreadyFinalized: false };
  }
  if (finalized.kind === "already-finalized") {
    /*
     * 이번 호출은 아무것도 바꾸지 않았지만 DB는 이미 완료 상태다. 완료로 읽는다.
     * 이 경로에서도 복원을 시도한다. 앞선 시도가 끊겼을 수 있고, 이미 돌려준 주문이면
     * 원장의 UNIQUE가 already-restored로 돌려보낸다. 두 번 늘어나지 않는다.
     */
    await tryRestorePoints(deps, orderId, paymentId);
    return { kind: "completed", paymentId, orderId, alreadyFinalized: true };
  }
  // payment-mismatch / refund-request-mismatch / ambiguous-refund-request / invalid-amount.
  // PG에서는 이미 환불이 끝났을 수 있다. 재취소하지 않고 사람이 본다.
  console.error("[refund] finalize failed", { orderId, paymentId, kind: finalized.kind });
  return { kind: "finalization-failed", paymentId, orderId, finalize: finalized };
}

/**
 * 제품 코드에서 쓸 실제 구현들.
 *
 * 저장·HTTP 모듈은 여기서 필요할 때 읽는다. 그래야 위 흐름을 DB나 네트워크 없이
 * 그 자체로 확인할 수 있다.
 */
export async function defaultRefundPaymentNormalFinalizeDeps(
  cancellationDeps?: RefundPaymentCancellationDeps,
): Promise<RefundPaymentNormalFinalizeDeps> {
  const cancel = cancellationDeps ?? (await defaultRefundPaymentCancellationDeps());
  const inquiry = await import("@/lib/server/nicepayPaymentInquiry");
  const store = await import("@/lib/server/store");
  const points = await import("@/lib/server/refundPointsRestore");
  return {
    executeCancellation: (orderId) => executeRefundPaymentCancellation(orderId, cancel),
    inquirePayment: (input) => inquiry.inquireNicepayPayment(input),
    finalize: (input) => store.finalizeRefundPaymentCancel(input),
    restorePoints: async (input) =>
      points.runRefundPointsRestore(input, await points.defaultRefundPointsRestoreDeps()),
  };
}
