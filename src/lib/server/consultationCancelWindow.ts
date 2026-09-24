/**
 * 상담 취소·환불 문의의 "3시간 기준" 판정 (Consult-Cancel-Window-1).
 *
 * 이 파일은 판정만 한다. 실제 취소, 환불, NICEPAY cancel, status 변경,
 * 화면 버튼은 이 단계에서 만들지 않는다. DB write는 0이며 부수효과가 없다.
 *
 * 정책
 * - 기준선은 상담 시작 3시간 전이다.
 * - 3시간보다 많이 남았으면 normal-request. 일반 취소·환불 문의로 받는다.
 * - 정확히 3시간 남은 순간도 normal-request로 본다(경계는 고객에게 유리하게).
 * - 3시간 미만이면 manual-review. 자동으로 취소·환불하지 않고 관리자가 개별 확인한다.
 * - 상담 시작 시각 이후(시작 정각 포함)도 manual-review.
 * - scheduledAt이 없으면 manual-review. Consultation.datetime은 사람이 읽는
 *   표시 문구라 연도·시각을 추론해 만들어 쓰지 않는다.
 * - scheduledAt이 ISO로 해석되지 않으면 manual-review.
 *
 * 시각 기준
 * - 판정은 항상 서버 현재시각으로 한다. 클라이언트가 보낸 now는 받지 않는다.
 * - 한국시간 표시 여부와 무관하게 scheduledAt(UTC ISO)끼리의 절대시각으로만
 *   비교하므로 날짜 변경·연말 경계에 영향을 받지 않는다.
 */

/** 기준선: 상담 시작 3시간 전. */
export const CONSULTATION_CANCEL_WINDOW_MINUTES = 180;

/**
 * 이 판정 규칙만 가리키는 내부 버전 식별자.
 *
 * 환불 문의를 접수할 때 "어떤 규칙으로 판정했는지"를 함께 남기기 위한 값이다.
 * 기준선(180분)이나 경계 처리 방식이 바뀌면 이 값도 함께 올린다. 규칙이 그대로면
 * 문구·화면이 바뀌어도 그대로 둔다.
 *
 * 약관·동의 문구 버전(lib/constants/legal.ts의 ORDER_CONSENT_VERSION)과는
 * 완전히 별개의 축이며 섞어 쓰지 않는다. 한쪽이 확정되어도 다른 쪽은 영향받지 않는다.
 */
export const CONSULTATION_CANCEL_WINDOW_POLICY_VERSION = "consult-cancel-window-3h-v1";

const MS_PER_MINUTE = 60_000;

/** manual-review로 보내는 사유. 관리자 화면·문의 UI에서 그대로 분기해 쓸 수 있다. */
export type ConsultationCancelManualReason =
  /** 상담 시작까지 3시간 미만 남았다. */
  | "within-window"
  /** 상담 시작 시각이 지났다(시작 정각 포함). */
  | "after-start"
  /** 예약 절대시각 기록이 없는 과거 예약이다. */
  | "missing-scheduled-at"
  /** scheduledAt이 ISO 시각으로 해석되지 않는다. */
  | "invalid-scheduled-at";

export type ConsultationCancelWindow =
  | {
      kind: "normal-request";
      /** 상담 시작까지 남은 분(내림). 항상 기준선 이상이다. */
      remainingMinutes: number;
    }
  | {
      kind: "manual-review";
      reason: ConsultationCancelManualReason;
      /**
       * 상담 시작까지 남은 분(내림). 시작 이후면 0 이하가 된다.
       * scheduledAt을 읽을 수 없는 사유에서는 없다.
       */
      remainingMinutes?: number;
    };

/**
 * 서버 현재시각 기준으로 판정한다. 제품 코드에서 쓰는 함수는 이것 하나다.
 *
 * now를 인자로 받지 않는다. 호출부가 클라이언트 시각을 흘려보낼 구조를
 * 애초에 만들지 않기 위해서다.
 */
export function evaluateConsultationCancelWindow(
  scheduledAt: string | undefined,
): ConsultationCancelWindow {
  return evaluateConsultationCancelWindowAt(scheduledAt, new Date());
}

/**
 * now를 주입하는 판정 함수.
 *
 * 쓸 수 있는 경우는 두 가지뿐이다.
 * - 테스트.
 * - 서버가 이미 만들어 둔 "그 순간"의 시각으로 판정해야 할 때. 예를 들어 환불 문의
 *   접수는 requestedAt과 취소창 판정이 논리적으로 같은 순간이어야 하는데,
 *   new Date()를 두 번 부르면 경계에서 둘이 어긋날 수 있다. 그런 곳에서는 서버가
 *   만든 Date 하나를 여기로 넘겨 두 기록이 같은 기준을 쓰게 한다.
 *
 * 어느 경우든 now는 반드시 서버가 만든 값이어야 한다. 요청 본문이나 쿼리에서 온
 * 값으로 부르면 클라이언트가 기준시각을 정하게 되므로 그렇게 쓰지 않는다.
 * 그 밖의 평범한 판정에는 evaluateConsultationCancelWindow를 쓴다.
 */
export function evaluateConsultationCancelWindowAt(
  scheduledAt: string | undefined,
  now: Date,
): ConsultationCancelWindow {
  if (!scheduledAt) {
    return { kind: "manual-review", reason: "missing-scheduled-at" };
  }

  const startedMs = Date.parse(scheduledAt);
  if (!Number.isFinite(startedMs)) {
    return { kind: "manual-review", reason: "invalid-scheduled-at" };
  }

  const remainingMs = startedMs - now.getTime();
  const remainingMinutes = Math.floor(remainingMs / MS_PER_MINUTE);

  if (remainingMs <= 0) {
    return { kind: "manual-review", reason: "after-start", remainingMinutes };
  }

  if (remainingMs < CONSULTATION_CANCEL_WINDOW_MINUTES * MS_PER_MINUTE) {
    return { kind: "manual-review", reason: "within-window", remainingMinutes };
  }

  return { kind: "normal-request", remainingMinutes };
}
