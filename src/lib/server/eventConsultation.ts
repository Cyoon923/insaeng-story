/**
 * OPEN EVENT에서 이미 결제한 1:1 사주상담 옵션을 Consultation으로 예약하는 규칙.
 *
 * 사주 인생곡 이벤트 주문(19,000원 + "saju-consultation" 옵션)은 결제 한 건에 상담비가
 * 이미 들어 있다. 여기서는 그 주문을 근거로 Consultation 한 건만 만든다.
 * - 새 Order·결제를 만들지 않는다. 금액·쿠폰·추천인·적립금을 계산하지 않는다.
 * - 주문·결제·환불은 서버가 읽은 값만 쓴다. 클라이언트는 주문 id와 예약 선택값만 보낸다.
 * - 슬롯·날짜 규칙은 일반 상담과 같은 consultationSlots 함수를 그대로 쓴다.
 *
 * 순수 함수만 둔다(DB·네트워크 없음). 저장은 applyOrder.ts의 commitEventConsultation이
 * 기존 app_store CAS(writeData)로 한다. 중복 확인과 추가가 같은 CAS 안에 있어,
 * 같은 주문으로 동시에 두 번 들어와도 한 건만 저장된다.
 */
import {
  CONSULT_TEACHERS,
  isSlotAvailable,
  parseDatetime,
  resolveScheduledAt,
} from "./consultationSlots.ts";
import { classifyPaidPayments } from "./paymentLookup.ts";
import type {
  AppData,
  Consultation,
  Order,
  Payment,
  RefundRequestStatus,
  User,
} from "@/lib/types/app";

export const EVENT_CONSULTATION_PROMOTION = "saju-song-open-2026";
export const EVENT_CONSULTATION_OPTION_ID = "saju-consultation";
const CONSULT_METHODS = ["카카오톡 상담", "전화 상담"] as const;
const MAX_CONTENT_LENGTH = 1000;

/** 이벤트 상담 예약 화면이 쓰는 draft 이름. 일반 상담 draft("consultation")와 섞지 않는다. */
export const EVENT_CONSULTATION_DRAFT_FLOW = "event-consultation";

/**
 * 화면에서 "상담 예약하기"를 보일지 정하는 표시용 판정. 서버 저장 주문 값만 본다.
 * 실제 허가는 prepareEventConsultation이 결제·환불까지 다시 확인해 정한다.
 */
export function isEventConsultationOrder(order: Pick<Order, "product" | "details">): boolean {
  const optionIds = (order.details?.optionIds ?? "").split(",").map((id) => id.trim());
  return (
    order.product === "saju-song" &&
    order.details?.promotion === EVENT_CONSULTATION_PROMOTION &&
    optionIds.includes(EVENT_CONSULTATION_OPTION_ID)
  );
}

/** 이 이벤트 주문으로 이미 만든 상담. 없으면 undefined. */
export function findEventConsultation(
  consultations: Consultation[],
  orderId: string,
  userId: string,
): Consultation | undefined {
  return consultations.find(
    (item) => item.userId === userId && (item.id === eventConsultationId(orderId) || item.details?.eventOrderId === orderId),
  );
}

/**
 * 상담의 환불·잠금 판단에 쓸 주문 id. 이벤트 상담은 원 이벤트 주문, 그 밖에는 상담 id
 * (일반 상담은 결제 귀속 주문과 같은 id). 화면 표시와 서버 잠금이 같은 규칙을 쓴다.
 */
export function consultationRefundOrderId(consultation: Pick<Consultation, "id" | "details">): string {
  return consultation.details?.eventOrderId || consultation.id;
}

/** 예약 화면 주소. 일반 상담 1단계를 이벤트 모드로 연다. */
export function eventConsultationBookHref(orderId: string): string {
  return `/apply/consultation/1?eventOrder=${encodeURIComponent(orderId)}`;
}

/** 이벤트 주문 1건에서 만들어지는 상담 id. 같은 주문이면 언제나 같은 값이다. */
export function eventConsultationId(orderId: string): string {
  return `ce-${orderId}`;
}

/** 클라이언트가 고르는 값. 금액·결제·사주정보는 받지 않는다. */
export interface EventConsultationInput {
  orderId: string;
  teacher: string;
  /** "8월 12일(화) 오전 10:00" 형식. 일반 상담과 같다. */
  datetime: string;
  /** "YYYY-MM-DD". resolveScheduledAt이 판매 중인 날짜인지 다시 본다. */
  scheduledDate: string;
  purpose: string;
  method: string;
  content: string;
}

/** 서버가 읽어 온 사실. */
export interface EventConsultationFacts {
  order: Order | null;
  /** 이 주문 id에 연결된 결제 전체(상태 무관). */
  payments: Payment[];
  /** 이 주문의 환불 문의 상태 전체. */
  refundStatuses: RefundRequestStatus[];
}

export type EventConsultationResult =
  | { ok: true; consultation: Consultation }
  | { ok: false; status: number; error: string };

function fail(status: number, error: string): EventConsultationResult {
  return { ok: false, status, error };
}

/** 이벤트 주문의 사주 기본정보. 서버에 저장된 주문 details에서만 복사한다. */
const SAJU_DETAIL_KEYS = [
  "name",
  "phone",
  "gender",
  "birth",
  "birthTime",
  "unknownTime",
  "calendar",
  "bloodType",
] as const;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** body에서 쓸 값만 고른다. 금액·결제·userId·사주정보 이름을 섞어 보내도 읽지 않는다. */
export function readEventConsultationInput(body: Record<string, unknown>): EventConsultationInput {
  return {
    orderId: text(body.orderId),
    teacher: text(body.teacher),
    datetime: text(body.datetime),
    scheduledDate: text(body.scheduledDate),
    purpose: text(body.purpose),
    method: text(body.method),
    content: typeof body.content === "string" ? body.content : "",
  };
}

/**
 * 검사하고, 통과하면 data에 Consultation 1건과 알림을 더한다. 저장은 호출부가 한다.
 *
 * 순서대로 보고, 하나라도 어긋나면 거기서 끝낸다(어느 경우에도 data를 바꾸지 않는다).
 */
export function prepareEventConsultation(
  data: AppData,
  user: User,
  input: EventConsultationInput,
  facts: EventConsultationFacts,
  now: Date = new Date(),
): EventConsultationResult {
  const order = facts.order;
  // 1) 주문 존재와 소유자. 다른 회원 주문인지 드러내지 않는다.
  if (!input.orderId || !order || order.id !== input.orderId || order.userId !== user.id) {
    return fail(404, "주문을 찾을 수 없습니다.");
  }
  // 2) OPEN EVENT 사주 인생곡 + 상담 옵션 주문인지. 모두 서버 저장값이다.
  const details = order.details ?? {};
  if (!isEventConsultationOrder(order)) {
    return fail(409, "상담 예약이 포함된 이벤트 주문이 아닙니다.");
  }
  // 3) 결제 완료. 0원 주문은 결제가 없으므로 여기서 함께 막힌다.
  const lookup = classifyPaidPayments(facts.payments);
  if (
    !Number.isSafeInteger(order.amount) ||
    order.amount <= 0 ||
    lookup.kind !== "single-paid-payment" ||
    lookup.payment.orderId !== order.id ||
    lookup.payment.approvedAmount !== order.amount
  ) {
    return fail(409, "결제가 확인된 주문만 상담을 예약할 수 있습니다.");
  }
  // 4) 환불. 끝났거나 진행 중이면 예약하지 않는다.
  if (facts.refundStatuses.includes("completed")) {
    return fail(409, "환불이 완료된 주문입니다.");
  }
  if (facts.refundStatuses.some((status) => status === "requested" || status === "reviewing" || status === "approved")) {
    return fail(409, "환불 문의가 진행 중인 주문입니다.");
  }
  // 5) 같은 주문으로 이미 만든 상담.
  const id = eventConsultationId(order.id);
  if (data.consultations.some((item) => item.id === id || item.details?.eventOrderId === order.id)) {
    return fail(409, "이미 상담을 예약한 주문입니다.");
  }
  // 6) 예약 선택값. 슬롯·날짜 규칙은 일반 상담과 같은 함수다.
  if (!CONSULT_TEACHERS.some((item) => item.name === input.teacher)) {
    return fail(400, "선생님을 다시 선택해 주세요.");
  }
  if (!(CONSULT_METHODS as readonly string[]).includes(input.method)) {
    return fail(400, "상담 방법을 선택해 주세요.");
  }
  if (input.content.length > MAX_CONTENT_LENGTH) {
    return fail(400, "상담 내용을 줄여 주세요.");
  }
  const parsed = parseDatetime(input.datetime);
  if (!parsed) return fail(400, "상담 시간을 다시 선택해 주세요.");
  if (!isSlotAvailable(data, input.teacher, parsed.date, parsed.time)) {
    return fail(409, "이미 예약되었거나 선택할 수 없는 시간입니다. 다른 시간을 선택해 주세요.");
  }
  const scheduledAt = resolveScheduledAt(input.scheduledDate, parsed.date, parsed.time);
  if (!scheduledAt) return fail(400, "상담 시간을 다시 선택해 주세요.");

  const saju: Record<string, string> = {};
  for (const key of SAJU_DETAIL_KEYS) {
    if (typeof details[key] === "string" && details[key] !== "") saju[key] = details[key];
  }
  const createdAt = now.toISOString();
  const consultation: Consultation = {
    id,
    userId: user.id,
    teacher: input.teacher,
    datetime: input.datetime,
    scheduledAt,
    purpose: input.purpose,
    method: input.method,
    // 추가 상담 옵션(리포트·추가 인원)은 없다. 일반 상담의 "없음"과 같은 값이다.
    option: "없음",
    status: "상담 신청",
    // 이 상담으로 새로 받은 돈은 없다. 상담비는 이벤트 주문(eventOrderId) 결제에 들어 있다.
    amount: 0,
    details: {
      ...saju,
      eventOrderId: order.id,
      scheduledDate: input.scheduledDate,
      ...(input.content ? { content: input.content } : {}),
    },
    createdAt,
  };
  data.consultations.unshift(consultation);
  if (data.notificationSettings[user.id]?.consult !== false) {
    data.notifications[user.id] = [
      {
        id: `${id}-n`,
        title: "상담 예약이 접수되었습니다",
        body: `${consultation.teacher} · ${consultation.datetime}`,
        createdAt,
        read: false,
      },
      ...(data.notifications[user.id] ?? []),
    ];
  }
  return { ok: true, consultation };
}
