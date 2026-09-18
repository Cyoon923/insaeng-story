/**
 * 서비스 완료 시각 증빙 (Privacy-Retention-Completion-Evidence-1).
 *
 * "이 서비스가 언제 끝났는가"를 한 번만 기록하기 위한 순수 규칙이다.
 * 저장하지 않고 시각을 만들지도 않는다(시각은 호출부가 서버에서 만들어 넘긴다).
 *
 * 왜 따로 두는가
 * - 개인정보 보관 기간의 기산점이 되는 값이라, 어느 상태에서 기록하는지와
 *   "이미 있으면 덮어쓰지 않는다"는 규칙이 한 곳에만 있어야 한다.
 *   주문은 SQL(store.ts)에서, 상담은 JSONB(admin route)에서 반영하는데
 *   규칙이 두 곳에 흩어지면 서로 달라질 수 있다.
 * - DB 없이 그 자체로 확인할 수 있어야 한다.
 *
 * 이 파일이 하지 않는 일
 * - 보관 기간 계산, 삭제 판단, 기존 자료 소급 기록(backfill)
 * - createdAt·updatedAt·productionStartedAt·scheduledAt으로 값을 대신 채우는 일
 *   (전부 다른 뜻의 시각이다)
 */
import type { ConsultStatus, Consultation, OrderStatus } from "@/lib/types/app";

/** 결과물 전달로 보는 주문 상태. 이 값일 때만 전달 시각을 남긴다. */
export const DELIVERED_ORDER_STATUS: OrderStatus = "완성/전달";

/** 상담이 끝난 것으로 보는 상태. 이 값일 때만 완료 시각을 남긴다. */
export const COMPLETED_CONSULT_STATUS: ConsultStatus = "상담 완료";

/**
 * 이번 상태 전환에서 남길 전달 시각. 해당 전환이 아니면 null이다.
 *
 * null을 그대로 저장문에 넘기면 COALESCE가 기존 값을 그대로 둔다.
 * "완료"로 넘어갈 때는 남기지 않는다. 전달 시점은 "완성/전달"이며,
 * 그 뒤 단계로 갔다고 해서 기산점이 뒤로 밀리면 안 되기 때문이다.
 */
export function deliveredAtForStatus(status: OrderStatus, now: string): string | null {
  return status === DELIVERED_ORDER_STATUS ? now : null;
}

/** 이번 상태 전환에서 남길 상담 완료 시각. 해당 전환이 아니면 null이다. */
export function completedAtForStatus(status: ConsultStatus, now: string): string | null {
  return status === COMPLETED_CONSULT_STATUS ? now : null;
}

/**
 * 상담에 완료 시각을 남긴다. 이미 값이 있으면 그대로 두고 아무것도 하지 않는다.
 *
 * 상담은 전용 테이블이 없어 JSONB 객체를 직접 바꾼다. 그래서 "덮어쓰지 않는다"를
 * SQL의 COALESCE가 아니라 이 함수가 맡는다. 상태가 되돌아갔다가 다시 완료가 되어도
 * 처음 시각이 남는다.
 *
 * 값을 남겼으면 true, 아무것도 바꾸지 않았으면 false다.
 */
export function applyConsultationCompletion(
  consultation: Consultation,
  status: ConsultStatus,
  now: string,
): boolean {
  const completedAt = completedAtForStatus(status, now);
  if (!completedAt) return false;
  // 이미 기록이 있으면 최초값을 지킨다.
  if (consultation.completedAt) return false;
  consultation.completedAt = completedAt;
  return true;
}
