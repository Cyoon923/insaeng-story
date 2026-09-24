/**
 * 환불 문의 접수 API가 쓰는 입출력 규칙 (Refund-Request-API-1).
 *
 * route.ts에서 이 부분만 떼어 둔 이유는 Next 요청 객체 없이 그 자체로 검증하기
 * 위해서다. 여기에는 저장도, 세션 읽기도, 소유권 판단도 없다. 그런 판단은 모두
 * lib/server/refundRequests.ts의 createRefundRequest가 한다.
 *
 * 이 파일이 하는 일은 세 가지뿐이다.
 * - 클라이언트가 보낸 body에서 쓸 값만 골라낸다.
 * - 저장 계층의 실패 사유를 사용자 문구와 상태 코드로 바꾼다.
 * - 성공 응답에 내보낼 값만 남긴다.
 */
import type { CreateRefundRequestResult } from "@/lib/server/refundRequests";
import type {
  ActiveRefundRequestSummary,
  ActiveRefundRequestsView,
  LatestRefundRequestSummary,
  LatestRefundRequestsView,
  RefundRequest,
  RefundRequestStatus,
} from "@/lib/types/app";

/** 저장 계층이 실패로 돌려주는 사유들. 성공 분기를 뺀 나머지다. */
type RefundRequestFailure = Extract<CreateRefundRequestResult, { ok: false }>["reason"];

/**
 * 클라이언트가 정할 수 있는 값. 이 세 가지가 전부다.
 *
 * body에 userId·status·requestedAt·snapshot 같은 서버 전용 이름을 섞어 보내도
 * 여기서 걸러지므로 저장에 닿지 않는다.
 */
export interface CreateRefundRequestBody {
  orderId: string;
  /** 검증하지 않고 그대로 넘긴다. 사유 판단은 저장 계층 한 곳에서만 한다. */
  reason: unknown;
  message: unknown;
}

export type CreateRefundRequestBodyResult =
  | { ok: true; body: CreateRefundRequestBody }
  | { ok: false; error: string; status: number };

/**
 * body에서 쓸 값만 고른다.
 *
 * orderId는 문자열인지 보고 앞뒤 공백을 뗀 뒤 비어 있으면 거절한다.
 * 형식(접두사 o-/c- 등)은 여기서 보지 않는다. 주문 id를 만드는 규칙은
 * applyOrder.ts가 갖고 있고, 실제 확인은 저장 계층이 orders 테이블을 보고 한다.
 * 이곳에 따로 만든 형식 규칙을 두면 두 곳이 갈라진다.
 *
 * reason·message는 손대지 않고 그대로 넘긴다. 같은 검사를 두 곳에 두지 않기 위해서다.
 */
export function readCreateRefundRequestBody(
  body: Record<string, unknown>,
): CreateRefundRequestBodyResult {
  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  if (!orderId) {
    return { ok: false, error: "주문을 확인해 주세요.", status: 400 };
  }
  return { ok: true, body: { orderId, reason: body.reason, message: body.message } };
}

/**
 * 저장 계층의 실패 사유를 사용자 문구로 바꾼다.
 *
 * order-not-found는 "없는 주문"과 "남의 주문"이 모두 여기로 온다. 저장 계층이
 * 두 경우를 구분하지 않고 같은 값을 돌려주며, 이 문구도 하나뿐이라 응답만 보고는
 * 어느 쪽인지 알 수 없다. 남의 주문이 있는지 떠보는 것을 막기 위해서다.
 */
export function refundRequestFailureResponse(reason: RefundRequestFailure): {
  error: string;
  status: number;
} {
  switch (reason) {
    case "order-not-found":
      return { error: "주문을 찾을 수 없습니다.", status: 404 };
    case "active-exists":
      return {
        error: "이미 접수된 환불 문의가 있습니다. 처리 결과를 기다려 주세요.",
        status: 409,
      };
    /*
     * 끝난 문의가 있는 주문이다. 주문당 웹 접수는 1회이므로 다시 받지 않는다.
     * 어떤 상태로 끝났는지(거절인지 환불 완료인지)는 문구에 담지 않는다.
     * 그 사실은 상태 조회로 확인할 몫이고, 실패 응답이 내부 상태를 알리는 자리가 아니다.
     */
    case "closed-exists":
      return {
        error:
          "이미 처리된 환불 문의가 있습니다. 추가로 확인하실 내용은 상담원에게 문의해 주세요.",
        status: 409,
      };
    case "invalid-reason":
      return { error: "환불 문의 사유를 선택해 주세요.", status: 400 };
    case "message-required":
      return { error: "자세한 내용을 적어 주세요.", status: 400 };
    case "message-too-long":
      return { error: "자세한 내용은 500자까지 입력할 수 있습니다.", status: 400 };
  }
}

/** 접수 성공 시 고객에게 돌려주는 값. */
export interface CreateRefundRequestResponse {
  ok: true;
  id: string;
  status: RefundRequestStatus;
  requestedAt: string;
}

/**
 * 고객에게 돌려줄 값만 남긴다.
 *
 * RefundRequest를 통째로 내보내지 않는다. userId와 접수 당시 Evidence
 * (productionStartedAtSnapshot·scheduledAtSnapshot·cancelWindowSnapshot·
 *  cancelWindowPolicyVersion)는 환불 판단에 쓰는 내부 기록이라 화면에 내보내지 않는다.
 * 필드를 하나씩 적어 옮기므로, 나중에 저장 구조에 값이 더해져도 저절로 새어 나가지 않는다.
 */
export function toCreateRefundRequestResponse(
  request: RefundRequest,
): CreateRefundRequestResponse {
  return {
    ok: true,
    id: request.id,
    status: request.status,
    requestedAt: request.requestedAt,
  };
}

/**
 * 조회에 성공했을 때의 묶음. items가 비어 있으면 "문의가 없다"는 뜻이다.
 */
export function loadedRefundRequests(
  items: ActiveRefundRequestSummary[],
): ActiveRefundRequestsView {
  return { items, loaded: true };
}

/**
 * 조회하지 못했을 때의 묶음.
 *
 * items는 비어 있지만 "문의 없음"이 아니다. 화면은 loaded를 보고 두 경우를 갈라야 한다.
 * 실패 사유는 담지 않는다. 내부 오류는 서버 기록에만 남긴다.
 *
 * 호출부가 돌려받은 객체를 고쳐 쓰지 못하도록 매번 새로 만든다.
 */
export function unavailableRefundRequests(): ActiveRefundRequestsView {
  return { items: [], loaded: false };
}

/**
 * 최신 문의 조회에 성공했을 때의 묶음.
 *
 * items에 없는 주문은 정말로 접수한 적이 없는 것이다. 활성 묶음과 같은 규칙이며,
 * 담는 범위만 다르다(끝난 문의까지 포함).
 */
export function loadedLatestRefundRequests(
  items: LatestRefundRequestSummary[],
): LatestRefundRequestsView {
  return { items, loaded: true };
}

/**
 * 최신 문의를 읽지 못했을 때의 묶음.
 *
 * items는 비어 있지만 "이력 없음"이 아니다. 화면은 loaded를 보고 두 경우를 갈라야 한다.
 * 실패 사유는 담지 않는다. 내부 오류는 서버 기록에만 남긴다.
 *
 * 호출부가 돌려받은 객체를 고쳐 쓰지 못하도록 매번 새로 만든다.
 */
export function unavailableLatestRefundRequests(): LatestRefundRequestsView {
  return { items: [], loaded: false };
}
