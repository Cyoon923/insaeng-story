/**
 * 관리자 환불 상태 확인·복구 API의 입출력 규칙 (Refund-Payment-Admin-Recovery-API-1).
 *
 * 이 API는 돈을 새로 취소하는 API가 아니다. 이미 실행된 환불의 현재 상태를
 * **NICEPAY 거래조회로 확인해서** 내부 기록을 맞추는 API다.
 *
 * 흐름은 한 요청 안에서 끝난다.
 *   1) authorizeRefundExecution(refundRequestId) — 지금 이 순간의 DB 사실로 권한 판정
 *   2) allowed면 gate가 읽어 준 orderId로 현재 결제를 찾아 실행 단계를 본다
 *   3) 실행 단계에 맞는 조회 전용 복구 흐름을 **하나만** 부른다
 *        unknown / processing → runRefundPaymentRecovery
 *        succeeded            → runRefundPaymentSucceededRecovery
 *        declined / 없음      → 아무것도 부르지 않는다(사람 확인)
 *   관리자가 실행 단계나 복구 경로를 고르지 않는다. 서버가 DB를 보고 정한다.
 *
 * 이 파일이 부르지 않는 것
 * - cancelNicepayPayment / executeRefundPaymentCancellation /
 *   claimPaymentCancellation / runRefundPaymentNormalFinalize
 * deps에 있는 바깥 기능은 gate·결제 조회·복구 둘뿐이고, 어떤 결과에서도 다른 복구를
 * 대신 부르는 fallback이 없다.
 *
 * 응답에는 pgTid·금액·PG 원문·reconciliation 상세·내부 userId·DB 진단을 담지 않는다.
 */
import type { RefundExecutionGateResult } from "./refundExecutionGate.ts";
import type { OrderPaymentLookup } from "./paymentLookup.ts";
import type { RefundPaymentRecoveryResult } from "./refundPaymentRecovery.ts";
import type { RefundPaymentSucceededRecoveryResult } from "./refundPaymentSucceededRecovery.ts";

/** 이 흐름이 쓰는 바깥 기능. 취소·선점·정상 완결 흐름은 여기에 없다. */
export interface RecoverApprovedRefundDeps {
  authorize: (refundRequestId: string) => Promise<RefundExecutionGateResult>;
  /** 실행 단계를 보기 위한 조회. 복구 함수가 안에서 다시 찾는 것은 그대로 둔다. */
  findPaidPaymentForOrder: (orderId: string) => Promise<OrderPaymentLookup>;
  /** cancelExecutionStatus가 unknown / processing인 건. */
  recoverPending: (orderId: string) => Promise<RefundPaymentRecoveryResult>;
  /** cancelExecutionStatus가 succeeded인 건. */
  recoverSucceeded: (orderId: string) => Promise<RefundPaymentSucceededRecoveryResult>;
}

/** 관리자에게 돌려줄 안전한 상태값. 내부 kind를 그대로 내보내지 않는다. */
export type RecoverApprovedRefundStatus =
  | "completed"
  | "verification-pending"
  | "manual-review-required";

export interface RecoverApprovedRefundResponse {
  status: number;
  body:
    | { ok: true; status: "completed" }
    | { ok: false; status: RecoverApprovedRefundStatus; message: string }
    | { ok: false; error: string };
}

/**
 * body에서 쓸 값만 고른다.
 *
 * refundRequestId 하나뿐이다. orderId·paymentId·tid·금액·실행 단계·복구 경로를
 * 읽지 않으므로, 그런 이름을 함께 보내도 판단에 닿지 않는다.
 */
export function readRecoverApprovedRefundBody(
  body: Record<string, unknown>,
): { ok: true; refundRequestId: string } | { ok: false; error: string; status: number } {
  const refundRequestId =
    typeof body.refundRequestId === "string" ? body.refundRequestId.trim() : "";
  if (!refundRequestId) {
    return { ok: false, error: "환불 문의를 확인해 주세요.", status: 400 };
  }
  return { ok: true, refundRequestId };
}

/** 실행 권한이 없을 때의 응답. 어떤 회원의 어떤 주문인지 드러내지 않는다. */
function gateFailureResponse(
  gate: Exclude<RefundExecutionGateResult, { kind: "allowed" }>,
): RecoverApprovedRefundResponse {
  switch (gate.kind) {
    case "not-found":
      return { status: 404, body: { ok: false, error: "환불 문의를 찾을 수 없습니다." } };
    case "not-approved":
      return {
        status: 409,
        body: { ok: false, error: "승인된 환불 문의만 확인할 수 있습니다. 현재 상태를 확인해 주세요." },
      };
    case "order-not-found":
      return {
        status: 409,
        body: { ok: false, error: "연결된 주문을 확인할 수 없습니다. 담당자 확인이 필요합니다." },
      };
    case "ownership-mismatch":
      return {
        status: 409,
        body: { ok: false, error: "문의와 주문의 회원 정보가 맞지 않습니다. 담당자 확인이 필요합니다." },
      };
    case "ambiguous-active-request":
      return {
        status: 409,
        body: { ok: false, error: "같은 주문에 진행 중인 환불 문의가 여러 건입니다. 담당자 확인이 필요합니다." },
      };
  }
}

/** 사람이 확인해야 하는 상태. 재실행을 권하지 않는다. */
function manualReview(message: string): RecoverApprovedRefundResponse {
  return { status: 409, body: { ok: false, status: "manual-review-required", message } };
}

const VERIFICATION_PENDING: RecoverApprovedRefundResponse = {
  status: 202,
  body: {
    ok: false,
    status: "verification-pending",
    message: "환불 처리 결과를 확인 중입니다. 다시 실행하지 말고 잠시 후 상태를 확인해 주세요.",
  },
};

/** 복구 결과를 관리자 응답으로 바꾼다. 두 복구 흐름의 결과 형태가 같아 함께 쓴다. */
export function toRecoverApprovedRefundResponse(
  result: RefundPaymentRecoveryResult | RefundPaymentSucceededRecoveryResult,
): RecoverApprovedRefundResponse {
  switch (result.kind) {
    case "recovered-completed":
      // alreadyFinalized여도 200이다. 최종화 함수가 DB 완료 상태를 확인한 뒤에만 그 결과를 준다.
      return { status: 200, body: { ok: true, status: "completed" } };
    case "verification-pending":
      // 취소되지 않았다는 뜻이 아니다. 실패로 단정하지 않는다.
      return VERIFICATION_PENDING;
    case "not-recoverable":
      return manualReview("자동으로 확인할 수 없는 상태입니다. 담당자 확인이 필요합니다.");
    case "recovery-failed":
      return manualReview(
        "환불은 처리되었을 수 있으나 내부 반영이 끝나지 않았습니다. 담당자 확인이 필요합니다.",
      );
  }
}

/**
 * 승인된 환불 문의 1건의 현재 상태를 확인·복구한다.
 *
 * 복구 경로는 서버가 현재 결제의 cancelExecutionStatus를 보고 하나만 고른다.
 * 고르지 못하면 아무것도 부르지 않고 사람 확인으로 둔다. fallback은 없다.
 */
export async function recoverApprovedRefund(
  refundRequestId: string,
  deps: RecoverApprovedRefundDeps,
): Promise<RecoverApprovedRefundResponse> {
  let gate: RefundExecutionGateResult;
  try {
    gate = await deps.authorize(refundRequestId);
  } catch (error) {
    console.error("[admin] refund recovery authorize failed", { refundRequestId }, error);
    return {
      status: 500,
      body: { ok: false, error: "처리하지 못했습니다. 잠시 후 다시 시도해 주세요." },
    };
  }
  if (gate.kind !== "allowed") return gateFailureResponse(gate);

  const orderId = gate.orderId;
  let lookup: OrderPaymentLookup;
  try {
    lookup = await deps.findPaidPaymentForOrder(orderId);
  } catch (error) {
    console.error("[admin] refund recovery lookup failed", { refundRequestId, orderId }, error);
    return {
      status: 500,
      body: { ok: false, error: "처리하지 못했습니다. 잠시 후 다시 시도해 주세요." },
    };
  }

  if (lookup.kind === "no-payment") {
    /*
     * 승인 상태의 결제가 없다. 환불이 끝나 결제가 cancelled가 되었을 수도 있고,
     * 애초에 결제가 없던 주문일 수도 있다. 둘을 여기서 구분하지 않는다.
     * "환불되지 않았다"고 단정하지도 않고, 그 구분을 위해 새 조회를 만들지도 않는다.
     */
    return manualReview("확인할 결제 정보가 없습니다. 현재 상태를 담당자가 확인해야 합니다.");
  }
  if (lookup.kind === "ambiguous") {
    return manualReview("결제 정보가 여러 건입니다. 담당자 확인이 필요합니다.");
  }

  const execution = lookup.payment.cancelExecutionStatus ?? null;
  /*
   * 여기서 경로를 하나 고른다. 두 복구를 함께 부르거나, 하나가 실패했다고 다른 하나를
   * 대신 부르는 자리는 없다. 각 분기는 곧바로 응답으로 돌아간다.
   */
  try {
    if (execution === "unknown" || execution === "processing") {
      return toRecoverApprovedRefundResponse(await deps.recoverPending(orderId));
    }
    if (execution === "succeeded") {
      return toRecoverApprovedRefundResponse(await deps.recoverSucceeded(orderId));
    }
  } catch (error) {
    // 복구 도중 끊겼다. 다른 복구를 대신 부르지 않는다. 취소는 어차피 부를 수 없다.
    console.error("[admin] refund recovery failed", { refundRequestId, orderId }, error);
    return manualReview("상태를 확인하지 못했습니다. 담당자 확인이 필요합니다.");
  }

  /*
   * declined: PG가 분명히 거절한 건이다. 조회로 완료로 만들지 않는다.
   * 없음(NULL): 취소를 시도한 근거가 없다. 확인할 대상이 아니다.
   * 어느 쪽도 NICEPAY 조회를 부르지 않는다.
   */
  return manualReview("자동으로 확인할 수 있는 상태가 아닙니다. 담당자 확인이 필요합니다.");
}

/**
 * 제품 코드에서 쓸 실제 구현들.
 *
 * gate·결제 조회·두 복구 흐름만 읽는다. 취소 client와 정상 완결 흐름은 읽지 않는다.
 */
export async function defaultRecoverApprovedRefundDeps(): Promise<RecoverApprovedRefundDeps> {
  const gate = await import("@/lib/server/refundExecutionGate");
  const store = await import("@/lib/server/store");
  const pending = await import("@/lib/server/refundPaymentRecovery");
  const succeeded = await import("@/lib/server/refundPaymentSucceededRecovery");
  return {
    authorize: (refundRequestId) => gate.authorizeRefundExecution(refundRequestId),
    findPaidPaymentForOrder: store.findPaidPaymentForOrder,
    recoverPending: async (orderId) =>
      pending.runRefundPaymentRecovery(orderId, await pending.defaultRefundPaymentRecoveryDeps()),
    recoverSucceeded: async (orderId) =>
      succeeded.runRefundPaymentSucceededRecovery(
        orderId,
        await succeeded.defaultRefundPaymentSucceededRecoveryDeps(),
      ),
  };
}
