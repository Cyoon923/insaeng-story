/**
 * 관리자 목록에서 "지금 상담 정보"를 붙이는 순수 함수 (Refund-Request-Admin-Read-1).
 *
 * 환불 문의와 주문은 같은 DB에 있어 한 번의 JOIN으로 가져오지만, 상담은 아직
 * app_store JSONB에 있어 같은 질의로 묶을 수 없다. 그래서 상담 목록을 한 번만 읽고
 * 여기서 메모리로 이어 붙인다. 문의마다 상담을 따로 찾아 읽지 않는다.
 *
 * 이 파일은 아무것도 읽거나 쓰지 않는다. 받은 값만 이어 붙인다.
 *
 * import 경로가 상대경로인 이유는 다른 단계들과 같다(Node 내장 테스트 러너로 직접 실행).
 */
import type {
  AdminRefundRequestConsultationView,
  AdminRefundRequestItem,
  AdminRefundRequestsView,
  Consultation,
} from "@/lib/types/app";

/** 상담을 붙이기 전의 문의 1건. DB 질의가 그대로 채우는 부분이다. */
export type AdminRefundRequestBase = Omit<AdminRefundRequestItem, "consultation">;

/**
 * 상담 주문에만 지금 상담 정보를 붙인다.
 *
 * 상담과 결제 귀속 주문은 같은 id를 쓰므로(applyOrder.ts commitConsultation)
 * orderId로 찾는다. 찾지 못하면(주문만 남은 옛 자료 등) null로 둔다.
 * 표시 문구(Consultation.datetime)에서 예약 시각을 추론해 만들지 않는다.
 *
 * 상담 목록을 Map으로 한 번만 훑으므로 문의 수 × 상담 수로 커지지 않는다.
 */
export function attachConsultations(
  items: AdminRefundRequestBase[],
  consultations: Consultation[],
): AdminRefundRequestItem[] {
  const byId = new Map(consultations.map((item) => [item.id, item]));
  return items.map((item) => ({
    ...item,
    consultation:
      item.order.product === "consultation" ? view(byId.get(item.orderId)) : null,
  }));
}

function view(consultation: Consultation | undefined): AdminRefundRequestConsultationView | null {
  if (!consultation) return null;
  return {
    // 값이 없으면 "기록 없음"이라는 뜻의 null을 유지한다.
    scheduledAt: consultation.scheduledAt ?? null,
    status: consultation.status,
  };
}

/**
 * 조회에 성공했을 때의 묶음. items가 비어 있으면 "문의가 없다"는 뜻이다.
 * 고객 쪽 loadedRefundRequests와 같은 모양이며, 담는 항목만 관리자용으로 다르다.
 */
export function loadedAdminRefundRequests(
  items: AdminRefundRequestItem[],
): AdminRefundRequestsView {
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
export function unavailableAdminRefundRequests(): AdminRefundRequestsView {
  return { items: [], loaded: false };
}
