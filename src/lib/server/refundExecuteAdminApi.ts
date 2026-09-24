/**
 * 관리자 환불 실행 API의 입출력 규칙 (Refund-Payment-Admin-Execute-API-1).
 *
 * route.ts에서 이 부분만 떼어 둔 이유는 Next 요청 객체 없이 확인하기 위해서다.
 * 인증은 route가 먼저 하고, 여기서는 "무엇을 받고, 무엇을 부르고, 무엇을 돌려주는가"만 정한다.
 *
 * 흐름은 한 요청 안에서 끝난다.
 *   1) authorizeRefundExecution(refundRequestId)  — 지금 이 순간의 DB 사실로 실행 권한 판정
 *   2) allowed면 gate가 DB에서 읽어 준 orderId로 runRefundPaymentNormalFinalize 1회
 * gate 결과를 응답에 실어 두었다가 나중에 실행하는 구조를 만들지 않는다.
 * 권한 판정과 실행 사이에 사람의 조작이 끼어들 자리를 두지 않기 위해서다.
 *
 * 이 파일이 부르지 않는 것
 * - cancelNicepayPayment / claimPaymentCancellation / executeRefundPaymentCancellation
 * - runRefundPaymentRecovery (복구는 자동으로 돌리지 않는다)
 * - Payment / RefundRequest 직접 UPDATE
 * 부를 수 있는 바깥 기능은 deps의 gate와 normal orchestration 둘뿐이고, 어떤 결과에서도
 * 같은 요청 안에서 다시 부르지 않는다.
 *
 * TODO(다음 단계): Payment.cancelExecutionStatus='succeeded' + Payment.status='paid' +
 * RefundRequest.status='approved'로 남은 건(취소는 성공했으나 조회·최종화가 끝나지 않음)은
 * 아직 자동 복구 경로가 없다. 그 건에서 이 API를 다시 눌러도 선점(claim) 조건 때문에
 * PG를 다시 부르지 않고 already-executing으로 끝난다(재취소가 일어나지 않는다).
 * 복구는 거래조회 기반으로 별도 단계에서 만든다. 여기서 임시로 열어 두지 않는다.
 *
 * 응답에는 pgTid·금액·PG 원문·내부 userId·DB 진단을 담지 않는다.
 * 관리자에게 필요한 것은 "지금 어떤 상태인가"와 "무엇을 해야 하는가"뿐이다.
 */
import type { RefundExecutionGateResult } from "./refundExecutionGate.ts";
import type { RefundPaymentNormalFinalizeResult } from "./refundPaymentNormalFinalize.ts";

/** 이 흐름이 쓰는 바깥 기능. 취소·복구·선점 함수는 여기에 없다. */
export interface ExecuteApprovedRefundDeps {
  authorize: (refundRequestId: string) => Promise<RefundExecutionGateResult>;
  /** 정상 환불 완결 흐름. 한 요청에서 많아야 1회 부른다. */
  execute: (orderId: string) => Promise<RefundPaymentNormalFinalizeResult>;
}

/** 관리자에게 돌려줄 안전한 상태값. 내부 kind를 그대로 내보내지 않는다. */
export type ExecuteApprovedRefundStatus =
  /** 전액환불이 확인되었고 내부 반영까지 끝났다. */
  | "completed"
  /** 이미 실행 중이거나 이전 실행 결과를 확인해야 한다. 다시 누를 일이 아니다. */
  | "already-executing"
  /** PG가 취소를 거절했다. */
  | "cancel-declined"
  /** 아직 확정되지 않았다. 실패가 아니며 재실행 대상도 아니다. */
  | "verification-pending"
  /** 사람이 거래를 확인해야 한다. */
  | "manual-review-required";

export interface ExecuteApprovedRefundResponse {
  status: number;
  body:
    | { ok: true; status: "completed"; message?: string }
    | { ok: false; status: ExecuteApprovedRefundStatus; message: string }
    | { ok: false; error: string };
}

/**
 * body에서 쓸 값만 고른다.
 *
 * refundRequestId 하나뿐이다. orderId·paymentId·tid·금액·userId·상태를 읽지 않으므로,
 * 그런 이름을 함께 보내도 실행 대상에 닿지 않는다. 실행 대상 주문은 언제나 gate가
 * DB에서 읽어 정한다.
 */
export function readExecuteApprovedRefundBody(
  body: Record<string, unknown>,
): { ok: true; refundRequestId: string } | { ok: false; error: string; status: number } {
  const refundRequestId =
    typeof body.refundRequestId === "string" ? body.refundRequestId.trim() : "";
  if (!refundRequestId) {
    return { ok: false, error: "환불 문의를 확인해 주세요.", status: 400 };
  }
  return { ok: true, refundRequestId };
}

/**
 * 실행 권한이 없을 때의 응답.
 *
 * 어떤 회원의 어떤 주문인지 드러내지 않는다. 관리자 목록 화면이 근거를 이미 준다.
 */
function gateFailureResponse(
  gate: Exclude<RefundExecutionGateResult, { kind: "allowed" }>,
): ExecuteApprovedRefundResponse {
  switch (gate.kind) {
    case "not-found":
      return { status: 404, body: { ok: false, error: "환불 문의를 찾을 수 없습니다." } };
    case "not-approved":
      return {
        status: 409,
        body: { ok: false, error: "승인된 환불 문의만 실행할 수 있습니다. 현재 상태를 확인해 주세요." },
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

/**
 * 취소가 성공으로 끝나지 않은 경우의 응답.
 *
 * 어느 것도 "다시 실행해 보라"고 안내하지 않는다. PG에서는 이미 환불이 끝났을 수
 * 있고, 재실행을 유도하면 관리자가 같은 거래를 두 번 취소하려 하게 된다.
 */
function cancelNotCompletedResponse(
  cancel: Extract<RefundPaymentNormalFinalizeResult, { kind: "cancel-not-completed" }>["cancel"],
): ExecuteApprovedRefundResponse {
  switch (cancel.kind) {
    case "not-claimable":
      // 다른 실행이 이미 선점했거나 이전 실행 결과가 남아 있다. PG를 부르지 않았다.
      return {
        status: 409,
        body: {
          ok: false,
          status: "already-executing",
          message: "이미 환불 실행이 진행되었거나 이전 실행 상태 확인이 필요합니다.",
        },
      };
    case "declined":
      return {
        status: 409,
        body: {
          ok: false,
          status: "cancel-declined",
          message: "결제사에서 취소가 거절되었습니다. 담당자 확인이 필요합니다.",
        },
      };
    case "succeeded":
      /*
       * 여기 올 수 없다. orchestration은 succeeded를 cancel-not-completed로 넘기지 않는다.
       * 그래도 열어 두지 않는다. 확인되지 않은 상태로 다루고 재실행을 권하지 않는다.
       */
    case "unknown":
    case "recording-failed":
      /*
       * 취소가 실제로 되었는지 지금은 알 수 없다. 실패로 단정하지 않고,
       * 재시도를 권하지도 않는다. 상태 확인이 필요한 상태로 둔다.
       */
      return {
        status: 202,
        body: {
          ok: false,
          status: "verification-pending",
          message: "환불 처리 결과를 확인 중입니다. 다시 실행하지 말고 상태를 확인해 주세요.",
        },
      };
    case "no-payment":
    case "ambiguous-payment":
    case "invalid-payment":
      return {
        status: 409,
        body: {
          ok: false,
          status: "manual-review-required",
          message: "결제 정보를 확인할 수 없어 실행하지 않았습니다. 담당자 확인이 필요합니다.",
        },
      };
  }
}

/** orchestration 결과를 관리자 응답으로 바꾼다. */
export function toExecuteApprovedRefundResponse(
  result: RefundPaymentNormalFinalizeResult,
): ExecuteApprovedRefundResponse {
  switch (result.kind) {
    case "completed":
      /*
       * alreadyFinalized여도 200이다. 최종화 함수가 DB의 완료 상태를 확인한 뒤에만
       * 그 결과를 주므로(already-finalized 계약), 같은 요청을 두 번 눌러도 같은 답이다.
       */
      return { status: 200, body: { ok: true, status: "completed" } };
    case "cancel-not-completed":
      return cancelNotCompletedResponse(result.cancel);
    case "verification-pending":
      // 취소 요청은 성공 응답을 받았고 확인만 남았다. 실패가 아니다.
      return {
        status: 202,
        body: {
          ok: false,
          status: "verification-pending",
          message: "환불 처리 결과를 확인 중입니다. 다시 실행하지 말고 상태를 확인해 주세요.",
        },
      };
    case "finalization-failed":
      // 결제사에서는 이미 환불되었을 수 있다. 재실행을 유도하지 않는다.
      return {
        status: 409,
        body: {
          ok: false,
          status: "manual-review-required",
          message: "환불은 처리되었을 수 있으나 내부 반영이 끝나지 않았습니다. 담당자 확인이 필요합니다.",
        },
      };
  }
}

/**
 * 승인된 환불 문의 1건의 전액환불을 실행한다.
 *
 * 입력은 refundRequestId 하나뿐이다. 실행 대상 주문은 gate가 DB에서 읽어 준 값만 쓴다.
 * gate가 allowed가 아니면 PG 실행 흐름에 들어가지 않는다.
 */
export async function executeApprovedRefund(
  refundRequestId: string,
  deps: ExecuteApprovedRefundDeps,
): Promise<ExecuteApprovedRefundResponse> {
  let gate: RefundExecutionGateResult;
  try {
    gate = await deps.authorize(refundRequestId);
  } catch (error) {
    // 권한 판정 자체가 실패했다. PG는 부르지 않았다. 사유는 서버 기록에만 남긴다.
    console.error("[admin] refund execution authorize failed", { refundRequestId }, error);
    return {
      status: 500,
      body: { ok: false, error: "처리하지 못했습니다. 잠시 후 다시 시도해 주세요." },
    };
  }
  if (gate.kind !== "allowed") return gateFailureResponse(gate);

  let result: RefundPaymentNormalFinalizeResult;
  try {
    // 주문 id는 gate가 DB에서 읽어 준 값이다. 요청 body의 값을 쓰지 않는다.
    result = await deps.execute(gate.orderId);
  } catch (error) {
    /*
     * 실행 도중 끊겼다. 여기서 다시 부르지 않는다. 취소도 복구도 부르지 않는다.
     * PG에서는 이미 환불이 끝났을 수 있어, 자동 재호출은 같은 거래를 두 번 건드릴 위험이 있다.
     */
    console.error(
      "[admin] refund execution failed",
      { refundRequestId, orderId: gate.orderId },
      error,
    );
    return {
      status: 500,
      body: { ok: false, error: "처리하지 못했습니다. 상태를 확인해 주세요." },
    };
  }
  return toExecuteApprovedRefundResponse(result);
}

/**
 * 제품 코드에서 쓸 실제 구현들.
 *
 * gate와 정상 완결 흐름만 읽는다. 취소 client·복구 흐름은 읽지 않는다.
 */
export async function defaultExecuteApprovedRefundDeps(): Promise<ExecuteApprovedRefundDeps> {
  const gate = await import("@/lib/server/refundExecutionGate");
  const normal = await import("@/lib/server/refundPaymentNormalFinalize");
  return {
    authorize: (refundRequestId) => gate.authorizeRefundExecution(refundRequestId),
    execute: async (orderId) =>
      normal.runRefundPaymentNormalFinalize(
        orderId,
        await normal.defaultRefundPaymentNormalFinalizeDeps(),
      ),
  };
}
