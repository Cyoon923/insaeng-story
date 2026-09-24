/**
 * 관리자 적립금 복원 재시도 API의 입출력 규칙
 * (Refund-Points-Restore-Recovery-Entrypoint-1).
 *
 * 이 API는 환불을 다시 실행하는 API가 **아니다**. PG를 부르지 않고, 결제·환불 문의
 * 상태를 바꾸지도 않는다. 환불이 이미 끝난 주문에서 적립금 복원만 누락된 건을
 * 사람이 다시 시도하는 자리다.
 *
 * 왜 필요한가
 * - 정상·복구 세 경로는 복원을 fail-open으로 처리한다. 복원이 실패해도 환불 완료를
 *   실패로 바꾸지 않고 서버 기록만 남긴다(그래야 관리자가 같은 거래를 다시 취소하려
 *   하지 않는다). 그 결과 복원이 빠진 건은 아무도 다시 시도하지 않는다. 이 API가 그 몫이다.
 *
 * 흐름은 한 요청 안에서 끝난다.
 *   1) authorizePointsRestoreRecovery(refundRequestId) — 지금 이 순간의 DB 사실로 판정
 *   2) authorized면 gate가 DB에서 읽어 준 orderId로 runRefundPointsRestore 1회
 * gate 결과를 응답에 실어 두었다가 나중에 실행하는 구조를 만들지 않는다.
 *
 * 이 파일이 부르지 않는 것
 * - cancelNicepayPayment / executeRefundPaymentCancellation / claimPaymentCancellation
 * - runRefundPaymentNormalFinalize / runRefundPaymentRecovery /
 *   runRefundPaymentSucceededRecovery
 * - finalizeRefundPaymentCancel / restoreOrderPointsOnce 직접 호출
 * deps에 있는 바깥 기능은 gate와 복원 흐름 둘뿐이고, 어떤 결과에서도 같은 요청 안에서
 * 다시 부르지 않는다.
 *
 * 적립금 금액 판정을 여기서 다시 하지 않는다. 얼마를 돌려줄 수 있는지는
 * decidePointsRestore가 정하고 runRefundPointsRestore가 그대로 쓴다. 같은 규칙을
 * 두 곳에 두면 한쪽이 허용하고 한쪽이 막는 상태가 생긴다.
 *
 * 응답에는 금액·회원·주문 id·결제 정보·내부 evidence 사유를 담지 않는다.
 * 관리자에게 필요한 것은 "복원되었는가"와 "무엇을 해야 하는가"뿐이다.
 */
import type { PointsRestoreRecoveryGateResult } from "./pointsRestoreRecoveryGate.ts";
import type { RefundPointsRestoreResult } from "./refundPointsRestore.ts";

/** 이 흐름이 쓰는 바깥 기능. 취소·복구·최종화 함수는 여기에 없다. */
export interface RestoreOrderPointsDeps {
  authorize: (refundRequestId: string) => Promise<PointsRestoreRecoveryGateResult>;
  /** 적립금 복원 흐름. 한 요청에서 많아야 1회 부른다. */
  restorePoints: (input: {
    orderId: string;
    refundRequestId: string | null;
  }) => Promise<RefundPointsRestoreResult>;
}

/** 관리자에게 돌려줄 안전한 상태값. 내부 kind·사유를 그대로 내보내지 않는다. */
export type RestoreOrderPointsStatus =
  /** 이번에 돌려주었거나, 이미 돌려준 주문이다. */
  | "restored"
  /** 자동 복원 대상이 아니다. 다시 눌러도 같다. */
  | "not-applicable"
  /** 지금은 못 했지만 다시 누르면 된다. */
  | "retry-later";

export interface RestoreOrderPointsResponse {
  status: number;
  body:
    | { ok: true; status: "restored"; message: string }
    | { ok: false; status: RestoreOrderPointsStatus; message: string }
    | { ok: false; error: string };
}

/**
 * body에서 쓸 값만 고른다.
 *
 * refundRequestId 하나뿐이다. orderId·userId·paymentId·amount·pointsUsed를 읽지
 * 않으므로, 그런 이름을 함께 보내도 복원 대상에 닿지 않는다. 복원 대상 주문은
 * 언제나 gate가 DB에서 읽어 정하고, 금액과 회원은 복원 흐름이 주문·결제 기록에서
 * 다시 읽는다.
 */
export function readRestoreOrderPointsBody(
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
 * 권한이 없을 때의 응답.
 *
 * 어떤 회원의 어떤 주문인지 드러내지 않는다. 관리자 목록 화면이 근거를 이미 준다.
 */
function gateFailureResponse(
  gate: Exclude<PointsRestoreRecoveryGateResult, { kind: "authorized" }>,
): RestoreOrderPointsResponse {
  switch (gate.kind) {
    case "not-found":
      return { status: 404, body: { ok: false, error: "환불 문의를 찾을 수 없습니다." } };
    case "not-completed":
      /*
       * 환불이 끝나지 않은 건이다. 여기서 "환불을 먼저 실행하라"고 안내하지 않는다.
       * 이 화면의 행위는 적립금 복원이며, 환불 실행은 별도 동작이다.
       */
      return {
        status: 409,
        body: {
          ok: false,
          error: "환불이 완료된 문의만 적립금을 복원할 수 있습니다. 현재 상태를 확인해 주세요.",
        },
      };
    case "order-not-found":
      return {
        status: 409,
        body: { ok: false, error: "연결된 주문을 확인할 수 없습니다. 담당자 확인이 필요합니다." },
      };
    case "ownership-mismatch":
      // 어느 회원끼리 어긋났는지 말하지 않는다. 사람이 볼 일이라는 사실만 전한다.
      return {
        status: 409,
        body: { ok: false, error: "문의와 주문의 회원 정보가 맞지 않습니다. 담당자 확인이 필요합니다." },
      };
  }
}

/**
 * 복원 흐름 결과를 관리자 응답으로 바꾼다.
 *
 * not-applicable의 내부 사유(missing-payment-evidence·evidence-mismatch 등)는
 * 담지 않는다. 내부 저장 구조를 그대로 드러내는 값이고, 관리자가 그 값으로 할 수
 * 있는 일도 없다. 사유는 서버 기록에만 남는다(복원 흐름과 세 실행 경로가 남긴다).
 */
export function toRestoreOrderPointsResponse(
  result: RefundPointsRestoreResult,
): RestoreOrderPointsResponse {
  switch (result.kind) {
    case "restored":
      return {
        status: 200,
        body: { ok: true, status: "restored", message: "적립금을 복원했습니다." },
      };
    case "already-restored":
      /*
       * 이미 돌려준 주문이다. 오류가 아니다. 두 번 눌러도 같은 답이 나온다
       * (멱등성은 원장의 UNIQUE (order_id, type)가 보장한다).
       */
      return {
        status: 200,
        body: { ok: true, status: "restored", message: "이미 적립금이 복원된 주문입니다." },
      };
    case "not-applicable":
      return {
        status: 409,
        body: {
          ok: false,
          status: "not-applicable",
          message: "자동으로 복원할 수 있는 주문이 아닙니다. 담당자 확인이 필요합니다.",
        },
      };
    case "retry-later":
      // 저장소가 그사이 바뀌었을 뿐이다. 실패로 단정하지 않는다.
      return {
        status: 202,
        body: {
          ok: false,
          status: "retry-later",
          message: "지금은 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        },
      };
  }
}

/**
 * 환불이 끝난 문의 1건의 적립금 복원을 다시 시도한다.
 *
 * 입력은 refundRequestId 하나뿐이다. 복원 대상 주문은 gate가 DB에서 읽어 준 값만 쓴다.
 * gate가 authorized가 아니면 복원 흐름에 들어가지 않는다.
 *
 * 예외 처리가 세 실행 경로와 다른 이유
 * - normal·recovery는 이미 끝난 환불의 **뒤처리**라 복원 실패를 삼킨다(fail-open).
 *   거기서 오류를 내면 관리자가 환불이 실패한 줄 알고 같은 거래를 다시 취소하려 한다.
 * - 이 API는 관리자가 **적립금 복원만을 목적으로** 누른 요청이다. 실패를 삼켜
 *   성공처럼 보이면 돌려주지 않은 적립금을 돌려준 것으로 오해하게 된다.
 *   그래서 여기서는 감추지 않고 다시 시도할 수 있는 오류로 답한다.
 */
export async function restoreOrderPointsByAdmin(
  refundRequestId: string,
  deps: RestoreOrderPointsDeps,
): Promise<RestoreOrderPointsResponse> {
  let gate: PointsRestoreRecoveryGateResult;
  try {
    gate = await deps.authorize(refundRequestId);
  } catch (error) {
    // 권한 판정 자체가 실패했다. 복원은 시도하지 않았다. 사유는 서버 기록에만 남긴다.
    console.error("[admin] points restore authorize failed", { refundRequestId }, error);
    return {
      status: 500,
      body: { ok: false, error: "처리하지 못했습니다. 잠시 후 다시 시도해 주세요." },
    };
  }
  if (gate.kind !== "authorized") return gateFailureResponse(gate);

  let result: RefundPointsRestoreResult;
  try {
    /*
     * 주문 id는 gate가 DB에서 읽어 준 값이다. 요청 body의 값을 쓰지 않는다.
     * refundRequestId는 completed 검증을 통과한 실제 문의 id라, 원장의 추적 컬럼에
     * 그대로 남긴다(세 실행 경로는 최종화 함수가 그 id를 돌려주지 않아 null을 남긴다).
     * 이 값은 추적용이며 멱등 키가 아니다. 멱등은 UNIQUE (order_id, type)가 맡는다.
     */
    result = await deps.restorePoints({
      orderId: gate.orderId,
      refundRequestId: gate.refundRequestId,
    });
  } catch (error) {
    /*
     * 복원 도중 끊겼다. 여기서 다시 부르지 않는다. PG도 환불 문의도 건드리지 않았고,
     * 적립금은 한 문장으로 반영되므로 잔액만 늘어난 중간 상태도 남지 않는다.
     * 관리자가 다시 누르면 된다.
     */
    console.error("[admin] points restore failed", { refundRequestId, orderId: gate.orderId }, error);
    return {
      status: 500,
      body: { ok: false, error: "적립금 복원에 실패했습니다. 잠시 후 다시 시도해 주세요." },
    };
  }
  return toRestoreOrderPointsResponse(result);
}

/**
 * 제품 코드에서 쓸 실제 구현들.
 *
 * gate와 복원 흐름만 읽는다. 취소 client·환불 실행/복구 흐름은 읽지 않는다.
 */
export async function defaultRestoreOrderPointsDeps(): Promise<RestoreOrderPointsDeps> {
  const gate = await import("@/lib/server/pointsRestoreRecoveryGate");
  const points = await import("@/lib/server/refundPointsRestore");
  return {
    authorize: (refundRequestId) => gate.authorizePointsRestoreRecovery(refundRequestId),
    restorePoints: async (input) =>
      points.runRefundPointsRestore(input, await points.defaultRefundPointsRestoreDeps()),
  };
}
