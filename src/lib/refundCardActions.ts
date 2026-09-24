/**
 * 관리자 환불 카드에서 무엇을 보일지 정하는 규칙 (Refund-Payment-Admin-Execute-UI-2).
 *
 * 순수 함수다. 화면 밖에서 그 자체로 확인할 수 있도록 떼어 두었다.
 *
 * 여기서 결제 상태를 다시 해석하지 않는다. 서버가 목록에 실어 준 요약
 * (AdminRefundRequestItem.refundExecution)을 그대로 읽어 한 갈래를 고를 뿐이다.
 * 그 값은 표시용이며 실행 허가가 아니다. 실제 허가는 서버의 gate와 결제 선점,
 * 최종화 조건이 정하고, 화면 값이 오래되었다면 서버가 막는다.
 *
 * 두 버튼은 절대 함께 나오지 않는다. 아래 반환값이 한 갈래만 true로 만들고,
 * 화면은 이 값만 보고 그린다.
 */
import type { AdminRefundRequestItem, RefundRequestStatus } from "@/lib/types/app";

export interface RefundCardActions {
  /** "실제 환불 실행" 버튼을 보일지. */
  execute: boolean;
  /** "결제 상태 확인"(복구) 버튼을 보일지. */
  recover: boolean;
  /** 버튼 대신 보여 줄 안내. 버튼이 있으면 null이다. */
  notice: string | null;
}

const NONE: RefundCardActions = { execute: false, recover: false, notice: null };

/**
 * 승인된 환불 문의 카드에서 보일 동작을 정한다.
 *
 * 승인 상태가 아니면 아무 버튼도 없다. 그 상태의 기존 화면은 그대로 둔다.
 */
export function refundCardActions(
  status: RefundRequestStatus,
  refundExecution: AdminRefundRequestItem["refundExecution"],
): RefundCardActions {
  if (status !== "approved") return NONE;
  switch (refundExecution) {
    case "executable":
      // 아직 취소를 실행한 적이 없는 건. 실제 실행만 보인다.
      return { execute: true, recover: false, notice: null };
    case "recoverable":
      // 이미 실행이 시작·기록된 건. 다시 실행하지 않고 상태 확인만 보인다.
      return { execute: false, recover: true, notice: null };
    case "manual-review":
      return {
        execute: false,
        recover: false,
        notice: "자동으로 처리할 수 없는 결제 상태입니다. 담당자가 결제 상태를 직접 확인해 주세요.",
      };
    case "unknown":
      return {
        execute: false,
        recover: false,
        notice: "현재 정보만으로는 결제 상태를 판단할 수 없습니다. 담당자가 확인해 주세요.",
      };
  }
}

/**
 * 이 주문·상담의 환불이 끝났는지 — 관리자 화면 표시용
 * (Refund-Completed-Admin-Presentation-1).
 *
 * 관리자 응답에 이미 실려 온 환불 문의 목록만 본다. 추가 조회를 하지 않는다.
 *
 * 서버 권한 helper(hasCompletedRefundRequestForOrder)와 섞지 않는다. 저쪽은 DB를 읽어
 * 상태 변경을 실제로 막는 관문이고, 이쪽은 이미 받은 목록으로 버튼을 잠글지 정하는
 * 표시 규칙이다. 화면 값이 오래되었더라도 마지막 판단은 언제나 서버가 한다.
 *
 * 같은 주문에 이력이 여럿이어도 completed가 하나라도 있으면 true다.
 * 서버 잠금이 EXISTS로 보는 규칙과 같아야 두 판단이 어긋나지 않는다.
 *
 * completed만 본다. requested·reviewing·approved·rejected는 대상이 아니다
 * (승인은 아직 환불이 끝난 것이 아니고, 거절은 결제가 그대로 살아 있다).
 */
export function hasCompletedRefund(
  items: Pick<AdminRefundRequestItem, "orderId" | "status">[],
  orderId: string,
): boolean {
  const id = orderId.trim();
  if (!id) return false;
  return items.some((item) => item.orderId === id && item.status === "completed");
}

/**
 * 적립금 복원 영역에서 무엇을 보일지 (Refund-Points-Restore-Admin-UI-1).
 *
 * 순수 함수다. 서버가 목록에 실어 준 두 값(status, hasPointsRestoreRecord)만 읽는다.
 * 여기서 결제·적립금을 다시 해석하지 않는다.
 *
 * 환불이 끝난 건(completed)에만 보인다. 그래서 위 refundCardActions가 내보내는
 * 두 버튼(approved에서만 나온다)과 **구조적으로 같은 화면에 함께 뜰 수 없다**.
 * 한쪽은 approved, 한쪽은 completed이고 두 상태는 겹치지 않는다.
 *
 * ★ 기록 없음을 "복원해야 함"·"누락"·"오류"로 읽지 않는다. 적립금을 쓰지 않은
 * 주문과 옛 주문도 똑같이 기록이 없다. 실제 대상인지는 눌렀을 때 서버가 답한다.
 */
export interface PointsRestoreCardView {
  /** 이 카드에 적립금 복원 영역을 보일지. completed에서만 참이다. */
  visible: boolean;
  /** 원장 기록 유무를 그대로 옮긴 표시 문구. */
  label: string | null;
  /** "적립금 복원 재시도" 버튼을 보일지. 기록이 없을 때만 참이다. */
  retry: boolean;
}

const HIDDEN: PointsRestoreCardView = { visible: false, label: null, retry: false };

export function pointsRestoreCardView(
  status: RefundRequestStatus,
  hasPointsRestoreRecord: boolean,
): PointsRestoreCardView {
  // requested·reviewing·approved·rejected는 이 영역의 대상이 아니다.
  if (status !== "completed") return HIDDEN;
  if (hasPointsRestoreRecord) {
    return { visible: true, label: "적립금 복원 기록 있음", retry: false };
  }
  return { visible: true, label: "적립금 복원 기록 없음", retry: true };
}
