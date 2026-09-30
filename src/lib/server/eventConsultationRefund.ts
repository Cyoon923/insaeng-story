/**
 * OPEN EVENT 주문 전체 환불이 끝난 뒤, 그 주문으로 예약한 상담을 취소 표시한다.
 *
 * 돈의 환불 확정(finalizeRefundPaymentCancel)과 같은 트랜잭션으로 묶지 않는다.
 * 환불 확정은 SQL 한 문장이고 상담은 app_store JSONB라서, 묶으면 상담 저장 충돌만으로
 * 이미 성공한 PG 환불이 DB에 반영되지 못하는 일이 생긴다. 그래서 완료가 확정된 뒤
 * 따로 한 번 시도하고, 실패해도 환불 완료는 그대로 둔다(적립금 복원과 같은 방식).
 * 빠진 건은 관리자가 재시도한다.
 *
 * - 대상은 이벤트 상담(ce-{주문 id}, details.eventOrderId === 주문 id, 같은 회원) 한 건뿐이다.
 * - 기록은 cancelledAt 하나이며 최초값을 유지한다. 몇 번을 불러도 결과가 같다.
 * - 일반 1:1 상담은 아래 cancelRefundedConsultation이 같은 방식으로 따로 맡는다.
 * - 취소 표시된 상담은 consultationSlots.isBooked에서 빠져 슬롯이 다시 열린다.
 *
 * 순수 판정과 흐름만 둔다. 저장·조회 모듈은 기본 deps가 필요할 때만 읽는다.
 */
import { eventConsultationId, isEventConsultationOrder } from "./eventConsultation.ts";
export { consultationRefundOrderId } from "./eventConsultation.ts";
import type { AppData, Order } from "@/lib/types/app";

export type EventConsultationCleanupResult =
  /** 이번에 취소 표시를 남겼다. */
  | { kind: "cancelled"; consultationId: string }
  /** 이미 취소 표시가 있다. 아무것도 바꾸지 않았다. */
  | { kind: "already-cancelled"; consultationId: string }
  /** 이 주문으로 예약한 상담이 없다. 할 일이 없다. */
  | { kind: "no-consultation" }
  /** 이 주문의 환불이 끝나지 않았다. 취소하지 않는다. */
  | { kind: "not-refunded" }
  /** 이벤트 상담 포함 주문이 아니다. 할 일이 없다. */
  | { kind: "not-applicable" };

/**
 * data 안에서 이 주문의 이벤트 상담에 취소 표시를 남긴다. 저장은 호출부가 한다.
 * 원 주문의 id·회원과 모두 맞는 상담만 건드린다.
 */
export function markEventConsultationCancelled(
  data: AppData,
  order: Pick<Order, "id" | "userId">,
  nowIso: string,
): Exclude<EventConsultationCleanupResult, { kind: "not-refunded" } | { kind: "not-applicable" }> {
  const id = eventConsultationId(order.id);
  const target = data.consultations.find(
    (item) => item.id === id && item.details?.eventOrderId === order.id && item.userId === order.userId,
  );
  if (!target) return { kind: "no-consultation" };
  if (target.cancelledAt) return { kind: "already-cancelled", consultationId: target.id };
  target.cancelledAt = nowIso;
  return { kind: "cancelled", consultationId: target.id };
}

export interface EventConsultationCleanupDeps {
  isRefundCompleted: (orderId: string) => Promise<boolean>;
  getOrder: (orderId: string) => Promise<Order | null>;
  readData: () => Promise<AppData>;
  writeData: (data: AppData) => Promise<void>;
  isConflict: (error: unknown) => boolean;
  now?: () => Date;
}

const SAVE_ATTEMPTS = 3;

/**
 * 환불이 끝난 이벤트 주문의 상담을 취소 표시한다. 멱등이다.
 *
 * 환불 완료가 확인된 주문만 다룬다. 저장이 다른 요청과 겹치면 다시 읽어 최대 3번 시도한다.
 */
export async function cancelEventConsultationAfterRefund(
  orderId: string,
  deps: EventConsultationCleanupDeps,
): Promise<EventConsultationCleanupResult> {
  const id = orderId.trim();
  if (!id || !(await deps.isRefundCompleted(id))) return { kind: "not-refunded" };
  const order = await deps.getOrder(id);
  if (!order || !isEventConsultationOrder(order)) return { kind: "not-applicable" };

  for (let attempt = 1; ; attempt += 1) {
    const data = await deps.readData();
    const result = markEventConsultationCancelled(data, order, (deps.now?.() ?? new Date()).toISOString());
    if (result.kind !== "cancelled") return result;
    try {
      await deps.writeData(data);
      return result;
    } catch (error) {
      if (!deps.isConflict(error) || attempt >= SAVE_ATTEMPTS) throw error;
    }
  }
}

/**
 * 환불 완료 흐름(정상·복구)에서 부르는 후처리. 어떤 경우에도 던지지 않는다.
 *
 * 환불은 이미 끝났다. 상담 정리에 실패했다는 이유로 완료된 환불을 실패로 보이게 하면
 * 관리자가 같은 거래를 다시 취소하려 할 수 있다. 결과와 예외는 기록만 남긴다.
 */
export async function runEventConsultationCleanupSafely(
  cleanup: ((orderId: string) => Promise<unknown>) | undefined,
  orderId: string,
): Promise<void> {
  if (!cleanup) return;
  try {
    await cleanup(orderId);
  } catch (error) {
    console.error("[refund] event consultation cleanup failed", { orderId }, error);
  }
}

/** 제품 코드에서 쓸 실제 구현들. */
export async function defaultEventConsultationCleanupDeps(): Promise<EventConsultationCleanupDeps> {
  const store = await import("@/lib/server/store");
  const refundRequests = await import("@/lib/server/refundRequests");
  return {
    isRefundCompleted: (orderId) => refundRequests.hasCompletedRefundRequestForOrder(orderId),
    getOrder: (orderId) => store.getOrderById(orderId),
    readData: () => store.readData(),
    writeData: (data) => store.writeData(data),
    isConflict: (error) => store.isAppStoreConflict(error),
  };
}

/** 환불 완료 흐름의 deps에 끼울 기본 후처리. */
export async function cleanupEventConsultationAfterRefund(orderId: string): Promise<EventConsultationCleanupResult> {
  return cancelEventConsultationAfterRefund(orderId, await defaultEventConsultationCleanupDeps());
}

/*
 * ── 일반 1:1 상담 ──────────────────────────────
 *
 * 일반 유료(또는 무료 쿠폰 0원) 상담은 결제 귀속 주문과 상담이 같은 id를 쓴다(applyOrder.ts).
 * 그 주문의 환불이 completed가 된 뒤에만 같은 id 상담에 cancelledAt을 남겨 슬롯을 연다.
 * 이벤트 상담과 같은 규칙(최초값 유지, CAS 재시도, 실패해도 환불 완료는 그대로)이며
 * 위 이벤트 함수는 건드리지 않는다.
 */

/** 일반 상담 취소 표시. 주문과 id·회원이 같은 상담 한 건만 본다. data를 직접 바꾼다. */
export function markRefundedConsultationCancelled(
  data: AppData,
  order: Pick<Order, "id" | "userId">,
  nowIso: string,
): Exclude<EventConsultationCleanupResult, { kind: "not-refunded" } | { kind: "not-applicable" }> {
  const target = data.consultations.find(
    (item) => item.id === order.id && item.userId === order.userId && !item.details?.eventOrderId,
  );
  if (!target) return { kind: "no-consultation" };
  if (target.cancelledAt) return { kind: "already-cancelled", consultationId: target.id };
  target.cancelledAt = nowIso;
  return { kind: "cancelled", consultationId: target.id };
}

/** 일반 상담 주문(product "consultation")의 환불 완료 후처리. 그 밖의 주문은 not-applicable. */
export async function cancelRefundedConsultation(
  orderId: string,
  deps: EventConsultationCleanupDeps,
): Promise<EventConsultationCleanupResult> {
  const id = orderId.trim();
  if (!id || !(await deps.isRefundCompleted(id))) return { kind: "not-refunded" };
  const order = await deps.getOrder(id);
  if (!order || order.id !== id || order.product !== "consultation") return { kind: "not-applicable" };
  for (let attempt = 1; ; attempt += 1) {
    const data = await deps.readData();
    const result = markRefundedConsultationCancelled(data, order, (deps.now?.() ?? new Date()).toISOString());
    if (result.kind !== "cancelled") return result;
    try {
      await deps.writeData(data);
      return result;
    } catch (error) {
      if (!deps.isConflict(error) || attempt >= SAVE_ATTEMPTS) throw error;
    }
  }
}

/**
 * 환불 완료 뒤 상담 정리 진입점. 이벤트 주문이면 기존 이벤트 함수 결과를 그대로 돌려주고,
 * 이벤트 대상이 아닐 때(not-applicable)만 일반 상담을 본다. 인생곡 주문은 둘 다 not-applicable이다.
 */
export async function cancelConsultationAfterRefund(
  orderId: string,
  deps: EventConsultationCleanupDeps,
): Promise<EventConsultationCleanupResult> {
  const event = await cancelEventConsultationAfterRefund(orderId, deps);
  if (event.kind !== "not-applicable") return event;
  return cancelRefundedConsultation(orderId, deps);
}

/** 환불 완료 흐름의 deps에 끼울 기본 후처리(이벤트 + 일반 상담). */
export async function cleanupConsultationAfterRefund(orderId: string): Promise<EventConsultationCleanupResult> {
  return cancelConsultationAfterRefund(orderId, await defaultEventConsultationCleanupDeps());
}
