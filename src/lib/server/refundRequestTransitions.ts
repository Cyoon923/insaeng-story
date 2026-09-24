/**
 * 환불 문의의 관리자 상태 전이 규칙 (Refund-Request-Status-Machine-1).
 *
 * 규칙만 담는 순수 모듈이다. 저장도, 시각 생성도, 권한 확인도 하지 않는다.
 * 실제 전이는 refundRequests.ts의 transitionRefundRequestByAdmin이 하고,
 * 마지막 관문은 DB의 조건부 UPDATE(CAS)다. 이 파일은 그 앞단의 규칙이다.
 *
 * 상태 의미
 * - requested : 고객이 접수했다.
 * - reviewing : 관리자가 검토 중이다.
 * - approved  : 관리자가 환불하기로 했다. PG 환불은 아직 끝나지 않았다.
 * - rejected  : 관리자가 거절했다. 끝난 상태다.
 * - completed : 실제 환불 성공을 확인했다. 끝난 상태다.
 *
 * approved → completed는 여기에 없다. 사람이 누르는 전이가 아니라 PG 환불이
 * 성공했을 때만 일어나야 하므로, NICEPAY 경로에서 따로 만든다.
 */
import type { RefundRequestStatus } from "@/lib/types/app";

/**
 * 관리자가 할 수 있는 전이. 여기에 없는 조합은 모두 거부한다.
 *
 * 특히 requested → approved는 없다. 검토 단계를 건너뛰고 승인되는 길을 두지 않는다.
 * 끝난 상태(rejected·completed)에서 나가는 길도, 같은 상태로 다시 가는 길도 없다.
 */
export const ADMIN_REFUND_TRANSITIONS = {
  requested: ["reviewing", "rejected"],
  reviewing: ["approved", "rejected"],
  approved: [],
  rejected: [],
  completed: [],
} as const satisfies Record<RefundRequestStatus, readonly RefundRequestStatus[]>;

/**
 * 저장할 수 있는 상태인지. 전이표의 키가 곧 전체 상태 목록이라 따로 적지 않는다
 * (표는 satisfies로 다섯 상태를 모두 담도록 강제되어 있다).
 */
export function isRefundRequestStatus(value: unknown): value is RefundRequestStatus {
  return typeof value === "string" && value in ADMIN_REFUND_TRANSITIONS;
}

export function isAllowedAdminTransition(
  from: RefundRequestStatus,
  to: RefundRequestStatus,
): boolean {
  return (ADMIN_REFUND_TRANSITIONS[from] as readonly RefundRequestStatus[]).includes(to);
}

/**
 * 이 전이가 "결론"인지. 결론이 난 순간만 decidedAt을 남긴다.
 *
 * reviewing은 검토를 시작했다는 뜻이지 결론이 아니므로 decidedAt을 만들지 않는다.
 * approved·rejected는 결론이므로 그 시각을 남긴다.
 */
export function isDecisionStatus(status: RefundRequestStatus): boolean {
  return status === "approved" || status === "rejected";
}

/**
 * 이 전이에서 새로 남길 결론 시각. 결론이 아니면 null이다.
 *
 * now는 호출부(서버)가 만든 값이다. 이 함수 안에서 new Date()를 부르지 않고,
 * 클라이언트가 보낸 시각도 받지 않는다.
 */
export function decidedAtFor(status: RefundRequestStatus, now: Date): string | null {
  return isDecisionStatus(status) ? now.toISOString() : null;
}
