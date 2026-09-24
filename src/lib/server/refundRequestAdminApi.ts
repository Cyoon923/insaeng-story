/**
 * 관리자 상태 전이 API의 입출력 규칙 (Refund-Request-Admin-Transition-API-1).
 *
 * route.ts에서 이 부분만 떼어 둔 이유는 Next 요청 객체 없이 검증하기 위해서다.
 * 여기에는 저장도, 인증도, 전이 허용 여부 판단도 없다. 허용 여부는
 * refundRequests.ts의 transitionRefundRequestByAdmin이 최종적으로 판단한다.
 *
 * 하는 일은 세 가지뿐이다.
 * - body에서 쓸 값만 골라낸다.
 * - 전이 실패 사유를 관리자 문구와 상태 코드로 바꾼다.
 * - 성공 응답에 내보낼 값만 남긴다.
 */
import { isRefundRequestStatus } from "./refundRequestTransitions.ts";
import type { TransitionRefundRequestResult } from "@/lib/server/refundRequests";
import type { RefundRequest, RefundRequestStatus } from "@/lib/types/app";

/** 저장 계층이 실패로 돌려주는 사유들. */
type TransitionFailure = Extract<TransitionRefundRequestResult, { ok: false }>["reason"];

/**
 * 관리자가 정할 수 있는 값. 이 세 가지가 전부다.
 *
 * handledBy·decidedAt은 받지 않는다. 실행자는 서버 상수(CURRENT_ADMIN_ACTOR),
 * 결론 시각은 전이 함수가 만든 서버 시각만 쓴다. body에 그런 이름을 섞어 보내도
 * 여기서 걸러지므로 저장에 닿지 않는다.
 */
export interface TransitionRefundRequestBody {
  refundRequestId: string;
  expectedCurrentStatus: RefundRequestStatus;
  targetStatus: RefundRequestStatus;
}

export type TransitionRefundRequestBodyResult =
  | { ok: true; body: TransitionRefundRequestBody }
  | { ok: false; error: string; status: number };

/**
 * body에서 쓸 값만 고른다.
 *
 * id는 문자열인지 보고 공백을 뗀 뒤 비어 있으면 거절한다. 형식 규칙을 여기서
 * 새로 만들지 않는다. 실재 여부는 저장 계층이 본다.
 *
 * 두 상태는 저장할 수 있는 다섯 값 중 하나인지만 본다. "이 전이가 허용되는가"는
 * 여기서 판단하지 않는다. 규칙을 두 곳에 두면 갈라지기 때문이다.
 */
export function readTransitionRefundRequestBody(
  body: Record<string, unknown>,
): TransitionRefundRequestBodyResult {
  const refundRequestId =
    typeof body.refundRequestId === "string" ? body.refundRequestId.trim() : "";
  if (!refundRequestId) {
    return { ok: false, error: "환불 문의를 확인해 주세요.", status: 400 };
  }
  if (!isRefundRequestStatus(body.expectedCurrentStatus)) {
    return { ok: false, error: "현재 상태를 확인해 주세요.", status: 400 };
  }
  if (!isRefundRequestStatus(body.targetStatus)) {
    return { ok: false, error: "바꿀 상태를 확인해 주세요.", status: 400 };
  }
  return {
    ok: true,
    body: {
      refundRequestId,
      expectedCurrentStatus: body.expectedCurrentStatus,
      targetStatus: body.targetStatus,
    },
  };
}

/** 전이 실패 사유를 관리자 문구와 상태 코드로 바꾼다. */
export function transitionFailureResponse(reason: TransitionFailure): {
  error: string;
  status: number;
} {
  switch (reason) {
    case "not-found":
      return { error: "환불 문의를 찾을 수 없습니다.", status: 404 };
    case "stale-status":
      // 다른 관리자가 먼저 처리했거나 화면이 오래된 경우다.
      // 다시 불러와 지금 상태를 보고 판단하라는 뜻이 드러나게 적는다.
      return {
        error: "그 사이 상태가 바뀌었습니다. 새로고침 후 현재 상태를 확인해 주세요.",
        status: 409,
      };
    case "invalid-transition":
      return { error: "지금 상태에서 할 수 없는 처리입니다.", status: 400 };
  }
}

/** 전이 성공 시 관리자에게 돌려주는 값. */
export interface TransitionRefundRequestResponse {
  ok: true;
  refundRequest: {
    id: string;
    status: RefundRequestStatus;
    decidedAt: string | null;
    handledBy: string | null;
  };
}

/**
 * 바뀐 결과만 남긴다.
 *
 * RefundRequest를 통째로 내보내지 않는다. 관리자 목록(GET /api/admin)이 이미 근거를
 * 모두 주므로, 전이 응답은 "무엇이 어떻게 바뀌었는지"만 있으면 된다.
 * 필드를 하나씩 적어 옮기므로 저장 구조에 값이 더해져도 저절로 새어 나가지 않는다.
 */
export function toTransitionRefundRequestResponse(
  request: RefundRequest,
): TransitionRefundRequestResponse {
  return {
    ok: true,
    refundRequest: {
      id: request.id,
      status: request.status,
      decidedAt: request.decidedAt ?? null,
      handledBy: request.handledBy ?? null,
    },
  };
}

/**
 * 환불이 끝난 건의 진행 상태 변경을 막을 때 쓰는 응답 (Refund-Completed-Progress-Lock-1).
 *
 * 409를 쓰는 이유는 요청이 잘못된 것이 아니라 지금 상태와 맞지 않기 때문이다.
 * 문구에 내부 사정(문의 id·결제·PG 정보)을 담지 않는다. 관리자에게 필요한 것은
 * 왜 막혔는지 한 줄뿐이다.
 *
 * 이 응답이 나가는 경우 진행 상태도 알림도 만들어지지 않는다.
 */
export function progressLockedByRefundResponse(kind: "order" | "consultation"): {
  error: string;
  status: number;
} {
  return {
    error:
      kind === "order"
        ? "환불이 완료된 주문은 진행 상태를 변경할 수 없습니다."
        : "환불이 완료된 상담은 진행 상태를 변경할 수 없습니다.",
    status: 409,
  };
}
