/**
 * 고객 환불 문의 화면이 쓰는 판단 규칙 (Refund-Customer-Song-UI-1).
 *
 * 화면(RefundRequestSection.tsx)에서 이 부분만 떼어 둔 이유는 브라우저 없이
 * 그 자체로 확인하기 위해서다. 여기에는 fetch도, 상태도, 화면 요소도 없다.
 *
 * 이 파일이 하는 일은 두 가지뿐이다.
 * - 서버가 준 { items, loaded }를 화면이 그릴 세 가지 상태 중 하나로 줄인다.
 * - 보내기 전에 입력을 한 번 본다.
 *
 * 입력 검사는 사용자를 돕기 위한 것이고 저장의 근거가 아니다. 실제 판단은 서버의
 * normalizeRefundRequestInput 한 곳에서 다시 한다(클라이언트는 우회할 수 있다).
 * 그래서 여기서 통과해도 서버가 거절할 수 있고, 그때는 서버 문구를 그대로 보여준다.
 *
 * 환불 가능/불가, 제작 착수 여부, 상담 취소창 판정은 여기서 하지 않는다.
 * 서버도 하지 않는 판단이며, 화면이 지어낼 일은 더더욱 아니다.
 */
import type {
  ActiveRefundRequestSummary,
  ActiveRefundRequestsView,
  LatestRefundRequestSummary,
  LatestRefundRequestsView,
  Order,
  RefundRequestReason,
} from "@/lib/types/app";

/**
 * 화면에 보여 줄 사유 5종.
 *
 * 값은 서버의 REFUND_REQUEST_REASONS와 같아야 한다. RefundRequestReason으로
 * 컴파일 때 맞춰 두어, 서버 쪽에 값이 더해지면 여기서도 드러나게 한다.
 */
export const REFUND_REASON_OPTIONS: readonly {
  value: RefundRequestReason;
  label: string;
}[] = [
  { value: "change-of-mind", label: "단순 변심" },
  { value: "schedule", label: "일정 변경·취소" },
  { value: "service-issue", label: "서비스 문제" },
  { value: "duplicate-payment", label: "중복 결제·오결제" },
  { value: "other", label: "기타" },
];

/**
 * 상세 내용 길이 상한.
 *
 * 서버의 REFUND_REQUEST_MESSAGE_MAX와 같은 값이다. 서버 모듈을 화면에서 불러오지
 * 않으려고 값만 맞춰 적었고, 넘는 입력을 잘라 보내지 않는다(서버도 자르지 않고 거절한다).
 */
export const REFUND_MESSAGE_MAX = 500;

/**
 * 화면이 그릴 상태.
 *
 * - unavailable  : 읽지 못했다. "문의 없음"이 아니다. 신청 버튼을 내밀지 않는다.
 * - active       : 지금 처리 중인 문의가 있다(requested·reviewing·approved).
 * - rejected     : 검토가 끝났다. 주문당 접수는 1회이므로 새로 신청하지 않는다.
 * - completed    : 환불 처리가 끝났다. 역시 새로 신청하지 않는다.
 * - inconsistent : 두 목록이 서로 맞지 않는다. 무엇이 맞는지 알 수 없으므로
 *                  아무 결론도 내지 않고 사람이 다시 확인하게 둔다.
 * - none         : 두 조회 모두 성공했고 이 주문에 접수한 적이 없다.
 *
 * 새 문의 버튼을 내밀어도 되는 상태는 none 하나뿐이다.
 */
export type RefundSectionState =
  | { kind: "unavailable" }
  | { kind: "active"; request: ActiveRefundRequestSummary }
  | { kind: "rejected"; request: LatestRefundRequestSummary }
  | { kind: "completed"; request: LatestRefundRequestSummary }
  | { kind: "inconsistent" }
  | { kind: "none" };

/**
 * 두 목록을 함께 보고 이 주문의 상태를 고른다.
 *
 * 왜 둘 다 필요한가. active 목록은 처리 중인 문의만 담고, 끝난 문의는 latest 목록에만
 * 있다. active만 보면 거절된 건과 환불이 끝난 건과 접수한 적 없는 건이 모두 똑같이
 * 비어 보이고, 주문당 1회인 접수 버튼을 다시 내밀게 된다.
 *
 * 읽기 실패를 먼저 본다. 둘 중 하나라도 읽지 못했으면 아무 결론도 내지 않는다.
 * 특히 latest를 읽지 못한 상태는 "끝난 문의가 없다"는 뜻이 아니므로,
 * 그때 신청 버튼을 보여주면 이미 끝난 주문에 다시 접수를 시도하게 된다.
 *
 * 활성 문의는 주문 1건당 많아야 하나이고(부분 UNIQUE 인덱스), 최신 문의도 주문당
 * 하나만 온다(DISTINCT ON). 그래서 각각 처음 찾은 하나만 쓰고 합치지 않는다.
 */
export function refundSectionState(
  active: ActiveRefundRequestsView | null | undefined,
  latest: LatestRefundRequestsView | null | undefined,
  orderId: string,
): RefundSectionState {
  if (!active || !active.loaded) return { kind: "unavailable" };
  if (!latest || !latest.loaded) return { kind: "unavailable" };

  const id = orderId.trim();
  if (!id) return { kind: "unavailable" };

  // 1) 처리 중인 문의가 있으면 그 상태가 먼저다. 기존 표시를 그대로 쓴다.
  const activeRequest = active.items.find((item) => item.orderId === id);
  if (activeRequest) return { kind: "active", request: activeRequest };

  // 2) 처리 중인 문의가 없다면 끝난 문의가 있는지 본다.
  const latestRequest = latest.items.find((item) => item.orderId === id);
  if (!latestRequest) return { kind: "none" };
  if (latestRequest.status === "rejected") return { kind: "rejected", request: latestRequest };
  if (latestRequest.status === "completed") return { kind: "completed", request: latestRequest };

  /*
   * 3) 여기까지 왔다는 것은 latest가 처리 중 상태(requested·reviewing·approved)인데
   *    active 목록에는 같은 요청이 없다는 뜻이다. 두 조회 사이에 상태가 바뀌었거나
   *    한쪽이 낡은 값일 수 있다. 어느 쪽이 맞는지 화면이 고를 수 없으므로
   *    "문의 없음"으로 읽지 않는다. 그렇게 읽으면 처리 중인 건에 새 접수를 시도하게 된다.
   */
  return { kind: "inconsistent" };
}

/**
 * 활성 상태별 안내 문구.
 *
 * approved는 "관리자가 승인했다"는 뜻이지 돈이 돌아왔다는 뜻이 아니다.
 * 실제 취소는 별도 실행 단계에서 일어나므로 "환불 완료"라고 적지 않는다.
 *
 * rejected·completed는 서버가 활성 목록에 담지 않으므로 여기에도 없다.
 * 목록에서 사라졌다는 사실만으로 완료를 추론하지 않는다.
 */
export const REFUND_ACTIVE_MESSAGE: Record<
  ActiveRefundRequestSummary["status"],
  string
> = {
  requested: "환불 문의가 접수되었습니다.",
  reviewing: "환불 문의를 확인하고 있습니다.",
  approved: "환불이 승인되어 처리 중입니다.",
  // 아래 둘은 활성이 아니라 이 자리에 오지 않는다. 끝난 상태의 문구는 따로 둔다.
  rejected: "환불 문의 처리가 끝났습니다. 자세한 내용은 문의해 주세요.",
  completed: "환불 문의 처리가 끝났습니다. 자세한 내용은 문의해 주세요.",
};

/**
 * 검토가 끝난(rejected) 문의에 보여 줄 안내.
 *
 * "환불 불가"라고 적지 않는다. 검토가 끝났다는 사실과 다음에 할 일만 알린다.
 * 거절 사유는 응답에 담기지도 않으므로 화면이 추측해 적지 않는다.
 */
export const REFUND_REJECTED_MESSAGE = "환불 문의 검토가 종료되었습니다.";
export const REFUND_REJECTED_GUIDE = "추가로 확인하실 내용은 상담원에게 문의해 주세요.";

/**
 * 환불이 끝난(completed) 문의에 보여 줄 안내.
 *
 * completed는 PG 전액취소를 확인하고 내부 기록까지 반영이 끝난 상태다.
 * approved의 "처리 중"과 같은 말로 적지 않는다.
 * 카드사 반영 시점에 대한 안내는 정책 문구의 몫이라 여기서 만들지 않는다.
 */
export const REFUND_COMPLETED_MESSAGE = "환불 처리가 완료되었습니다.";

/**
 * 두 목록이 서로 맞지 않을 때 보여 줄 안내.
 *
 * 내부 사정(어떤 목록이 무엇을 담고 있었는지)은 알리지 않는다.
 * 읽지 못했을 때와 같은 말을 쓴다. 고객이 할 일이 같기 때문이다.
 */
export const REFUND_UNAVAILABLE_MESSAGE =
  "환불 문의 상태를 확인하지 못했습니다. 새로고침 후 다시 확인해 주세요.";

export type RefundFormCheck =
  | { ok: true }
  | { ok: false; message: string };

/**
 * 보내기 전 입력 확인. 서버 검증을 대신하지 않는다.
 *
 * 규칙은 서버와 같다. 사유를 골랐는지, "기타"면 내용을 적었는지, 500자를 넘지 않는지.
 * 넘는 내용을 잘라 담지 않는다. 고객이 쓴 글을 말없이 바꾸지 않기 위해서다.
 */
export function checkRefundForm(input: {
  reason: string;
  message: string;
}): RefundFormCheck {
  const reason = input.reason.trim();
  if (!REFUND_REASON_OPTIONS.some((option) => option.value === reason)) {
    return { ok: false, message: "환불 문의 사유를 선택해 주세요." };
  }
  const message = input.message.trim();
  if (message.length > REFUND_MESSAGE_MAX) {
    return { ok: false, message: `자세한 내용은 ${REFUND_MESSAGE_MAX}자까지 입력할 수 있습니다.` };
  }
  if (reason === "other" && !message) {
    return { ok: false, message: "자세한 내용을 적어 주세요." };
  }
  return { ok: true };
}

/**
 * 상담 상세에서 환불 문의 영역을 띄워도 되는지 (Refund-Customer-Consultation-UI-1).
 *
 * 상담은 결제할 때 Consultation 1건과 product가 "consultation"인 Order 1건이 함께
 * 만들어지고 둘은 같은 id를 쓴다(applyOrder.ts commitConsultation). 환불 문의는
 * 주문에 귀속되므로, 그 주문이 실제로 있고 지금 보는 사람의 것일 때만 영역을 띄운다.
 *
 * 화면이 받은 id를 그대로 믿지 않는다. 서버에서 읽어 온 주문 행과 세션의 회원 id를
 * 맞춰 보고, 네 가지가 모두 맞을 때만 true다.
 *   · 주문이 있다
 *   · 그 주문의 주인이 지금 로그인한 회원이다
 *   · 상담 결제 주문이다(product === "consultation")
 *   · 지금 보고 있는 상담과 같은 id다
 *
 * false는 "환불 불가"라는 뜻이 아니다. 이 화면에서 바로 접수할 수 없다는 뜻일 뿐이며,
 * 환불 가능 여부를 여기서 판정하지 않는다. 그 판단은 접수 뒤 담당자가 한다.
 */
export function canRequestConsultationRefund(
  order: Order | null | undefined,
  userId: string,
  consultationId: string,
): boolean {
  if (!order) return false;
  if (!userId.trim() || order.userId !== userId) return false;
  if (order.product !== "consultation") return false;
  return order.id === consultationId;
}

/**
 * 이 주문의 환불이 끝났는지 — 화면 표시용 (Refund-Completed-Detail-Presentation-1).
 *
 * 서버의 hasCompletedRefundRequestForOrder와 섞지 않는다. 저쪽은 DB를 읽어
 * 관리자의 상태 변경을 막을지 정하는 권한 판단이고, 이쪽은 이미 받은 응답만 보고
 * 무엇을 그릴지 정하는 표시 규칙이다. 판단 근거도 시점도 다르다.
 *
 * 읽지 못한 응답(loaded=false)은 false다. 확인하지 못한 것을 "환불이 끝났다"로
 * 추정하면, 아직 진행 중인 주문을 환불된 것처럼 보여주게 된다.
 *
 * completed만 본다. rejected는 결제가 그대로 살아 있어 진행 상태가 계속 유효하고,
 * 처리 중(requested·reviewing·approved)도 아직 환불이 끝난 것이 아니다.
 */
export function hasCompletedRefundForOrder(
  latest: LatestRefundRequestsView | null | undefined,
  orderId: string,
): boolean {
  if (!latest || !latest.loaded) return false;
  const id = orderId.trim();
  if (!id) return false;
  return latest.items.some((item) => item.orderId === id && item.status === "completed");
}
