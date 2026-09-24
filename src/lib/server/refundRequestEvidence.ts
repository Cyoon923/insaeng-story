/**
 * 환불 문의의 입력 검증과 접수 당시 Evidence 만들기 (Refund-Request-Evidence-Data-1).
 *
 * 저장(refundRequests.ts)에서 이 부분만 떼어 둔 이유는 두 가지다.
 * - DB 없이 그 자체로 검증할 수 있다. 값 규칙과 snapshot 규칙은 정확성이 중요하다.
 * - 데이터베이스 접근 없이 순수 함수로 유지해 부수효과가 섞이지 않는다.
 *
 * 이 파일은 아무것도 저장하지 않는다.
 *
 * import 경로만 상대경로인 이유: 같은 폴더의 판정 모듈과 함께 Node 내장 테스트
 * 러너로 직접 실행하기 위해서다(별도 러너를 설치하지 않는다).
 */
import {
  CONSULTATION_CANCEL_WINDOW_POLICY_VERSION,
  evaluateConsultationCancelWindowAt,
} from "./consultationCancelWindow.ts";
import type { ConsultationCancelWindow } from "./consultationCancelWindow.ts";
import type {
  Consultation,
  Order,
  RefundRequestCancelWindowSnapshot,
  RefundRequestReason,
} from "@/lib/types/app";

/**
 * 저장할 수 있는 사유 목록. RefundRequestReason과 한 글자도 어긋나면 안 되므로
 * satisfies로 컴파일 때 맞춰 둔다(값이 빠지면 아래 검사에서 걸린다).
 */
export const REFUND_REQUEST_REASONS = [
  "change-of-mind",
  "schedule",
  "service-issue",
  "duplicate-payment",
  "other",
] as const satisfies readonly RefundRequestReason[];

/** 목록에서 빠진 사유가 없는지 컴파일 때 확인한다. 값은 만들지 않는다. */
type MissingReason = Exclude<RefundRequestReason, (typeof REFUND_REQUEST_REASONS)[number]>;
const _allReasonsListed: MissingReason[] = [];
void _allReasonsListed;

/** 저장된 판정 결과가 판정 함수의 반환값과 같은 모양인지 컴파일 때 확인한다. */
const _snapshotShapeMatches: (value: ConsultationCancelWindow) => RefundRequestCancelWindowSnapshot =
  (value) => value;
void _snapshotShapeMatches;

/** 상세 내용 길이 상한. 신청 화면들의 자유 작성란과 같은 기준이다. */
export const REFUND_REQUEST_MESSAGE_MAX = 500;

export function isRefundRequestReason(value: unknown): value is RefundRequestReason {
  return (REFUND_REQUEST_REASONS as readonly string[]).includes(String(value));
}

/** 검증을 통과한 고객 입력. 저장에는 이 값만 쓴다. */
export interface RefundRequestInput {
  reason: RefundRequestReason;
  /** 적지 않았으면 null이다. 빈 문자열을 저장하지 않는다. */
  message: string | null;
}

export type RefundRequestInputResult =
  | { ok: true; input: RefundRequestInput }
  | { ok: false; reason: "invalid-reason" | "message-required" | "message-too-long" };

/**
 * 고객이 보낸 값만 받아 검증한다.
 *
 * 규칙
 * - reason은 목록에 있는 값만 받는다. 자유 문자열을 저장하지 않는다.
 * - message는 앞뒤 공백을 떼고, 남은 것이 없으면 없는 것으로 본다.
 * - reason이 "other"면 message가 반드시 있어야 한다.
 * - 500자를 넘으면 잘라 담지 않고 거절한다. 고객이 쓴 내용을 말없이 바꾸지 않기 위해서다.
 *
 * 화면이 같은 검사를 하더라도 저장 직전에 여기서 다시 본다. 클라이언트는 우회할 수 있다.
 */
export function normalizeRefundRequestInput(raw: {
  reason: unknown;
  message?: unknown;
}): RefundRequestInputResult {
  if (!isRefundRequestReason(raw.reason)) {
    return { ok: false, reason: "invalid-reason" };
  }
  const trimmed = String(raw.message ?? "").trim();
  if (trimmed.length > REFUND_REQUEST_MESSAGE_MAX) {
    return { ok: false, reason: "message-too-long" };
  }
  if (raw.reason === "other" && !trimmed) {
    return { ok: false, reason: "message-required" };
  }
  return { ok: true, input: { reason: raw.reason, message: trimmed ? trimmed : null } };
}

/** 접수 당시에 고정해 두는 사실들. 값이 없으면 null이며 "기록 없음"을 뜻한다. */
export interface RefundRequestEvidence {
  productionStartedAtSnapshot: string | null;
  scheduledAtSnapshot: string | null;
  cancelWindowSnapshot: RefundRequestCancelWindowSnapshot | null;
  cancelWindowPolicyVersion: string | null;
}

/**
 * 접수 시점의 Evidence를 만든다.
 *
 * requestedAt은 호출부(서버)가 만든 접수 순간이며, 이 함수 안에서 new Date()를
 * 따로 부르지 않는다. 그래야 저장되는 requestedAt과 취소창 판정의 기준시각이
 * 같은 순간이 되고, 3시간 경계에서 둘이 어긋나지 않는다.
 *
 * 상담 주문에서만 예약·취소창 값을 만든다. 인생곡 주문에는 해당 개념이 없어 null이다.
 * productionStartedAt은 상품과 무관하게 주문에 있는 값이므로 언제나 그대로 옮긴다.
 * 값이 없을 때 null인 것은 "제작 전"이 아니라 "기록 없음"이라는 뜻이다.
 */
export function buildRefundRequestEvidence(args: {
  order: Pick<Order, "product" | "productionStartedAt">;
  /** 상담 주문일 때 같은 id의 상담. 찾지 못했으면 null. */
  consultation: Pick<Consultation, "scheduledAt"> | null;
  /** 서버가 만든 접수 순간. */
  requestedAt: Date;
}): RefundRequestEvidence {
  const productionStartedAtSnapshot = args.order.productionStartedAt ?? null;
  if (args.order.product !== "consultation") {
    return {
      productionStartedAtSnapshot,
      scheduledAtSnapshot: null,
      cancelWindowSnapshot: null,
      cancelWindowPolicyVersion: null,
    };
  }
  const scheduledAtSnapshot = args.consultation?.scheduledAt ?? null;
  return {
    productionStartedAtSnapshot,
    scheduledAtSnapshot,
    // 기록이 없으면 판정 함수가 manual-review(missing-scheduled-at)를 돌려준다.
    // 여기서 예약 시각을 추론해 만들어 넣지 않는다.
    cancelWindowSnapshot: evaluateConsultationCancelWindowAt(
      scheduledAtSnapshot ?? undefined,
      args.requestedAt,
    ),
    cancelWindowPolicyVersion: CONSULTATION_CANCEL_WINDOW_POLICY_VERSION,
  };
}
