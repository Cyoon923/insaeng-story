/**
 * 환불이 끝난 주문의 적립금 복원 흐름 (Refund-Points-Restore-Orchestration-1).
 *
 * 이 파일은 순서만 정한다. 판정도 저장도 직접 하지 않고, 이미 만들어 둔 세 가지를 잇는다.
 *   1) 주문·결제 읽기            — 복원 근거를 모은다
 *   2) decidePointsRestore       — 얼마를 돌려줄 수 있는지 순수 판정(fail-closed)
 *   3) restoreOrderPointsOnce    — 잔액과 원장을 한 문장으로 함께 반영(정확히 1회)
 *
 * 하지 않는 일
 * - 환불 문의 상태를 바꾸지 않는다. 이 흐름은 completed가 **이미 확정된 뒤**에 부른다.
 * - 쿠폰은 다루지 않는다. 자동 복원하지 않는다는 전제는 그대로다.
 * - 스스로 다시 부르지 않는다. 재시도는 호출부(완료 직후 1회, 그리고 사람이 누르는 복구)가 정한다.
 *
 * 멱등성은 이 파일이 아니라 DB가 보장한다. 같은 주문으로 몇 번을 불러도
 * point_transactions의 UNIQUE (order_id, type)가 두 번째 반영을 막는다.
 * 그래서 여기서 "이미 했는지"를 미리 조회해 분기하지 않는다. 저장 결과를 그대로 읽는다.
 *
 * deps로 바깥 기능을 받는 이유는 기존 환불 흐름들과 같다. DB·네트워크 없이
 * 이 순서 자체를 확인할 수 있어야 하기 때문이다.
 */
import { decidePointsRestore } from "./pointsRestoreDecision.ts";
import type { PointsRestoreBlockedReason } from "./pointsRestoreDecision.ts";
import type { AppData, Order, Payment } from "@/lib/types/app";
import type { RestoreOrderPointsResult } from "@/lib/server/store";

/** 이 흐름이 쓰는 바깥 기능들. 테스트에서 바꿔 끼울 수 있도록 인자로 받는다. */
export interface RefundPointsRestoreDeps {
  /** 저장소 전체. 잔액이 여기에 있고, 저장은 이 객체 기준의 version CAS로 한다. */
  readData: () => Promise<AppData>;
  getOrderById: (orderId: string) => Promise<Order | null>;
  /** 상태를 가리지 않고 그 주문의 결제를 모두 읽는다(환불 뒤에는 'cancelled'다). */
  listPaymentsForOrder: (orderId: string) => Promise<Payment[]>;
  restorePoints: (
    data: AppData,
    input: { userId: string; orderId: string; refundRequestId: string | null; amount: number },
  ) => Promise<RestoreOrderPointsResult>;
}

/**
 * 결과.
 *
 * - restored        : 이번 호출이 실제로 돌려주었다.
 * - already-restored: 이미 돌려준 주문이다. 아무것도 하지 않았다. 오류가 아니다.
 * - not-applicable  : 자동 복원 대상이 아니다. 다시 불러도 같다(근거 없음·불일치 등).
 * - retry-later     : 지금은 못 했지만 다시 하면 된다(저장소가 그사이 바뀜).
 */
export type RefundPointsRestoreResult =
  | { kind: "restored"; orderId: string; amount: number }
  | { kind: "already-restored"; orderId: string }
  | { kind: "not-applicable"; orderId: string; reason: RefundPointsRestoreSkipReason }
  | { kind: "retry-later"; orderId: string; reason: "cas-conflict" };

/**
 * 자동으로 돌려주지 않는 이유.
 *
 * 앞의 세 가지는 이 파일이 판단하고, 나머지는 순수 판정(decidePointsRestore)이 돌려준 것을
 * 그대로 옮긴다. 여기서 사유를 새로 만들거나 합치지 않는다.
 */
export type RefundPointsRestoreSkipReason =
  /** 그런 주문이 없다. */
  | "order-not-found"
  /** 그 주문에 결제 기록이 없다(0원 주문 등). 이번 범위가 아니다. */
  | "no-payment"
  /** 결제가 둘 이상이다. 어느 것을 근거로 삼을지 고르지 않는다. */
  | "ambiguous-payment"
  /** 저장 직전에 회원을 찾지 못했다. */
  | "user-not-found"
  /** 저장 직전 금액 검증에서 걸렸다. */
  | "invalid-amount"
  /** 주문이 없거나 그 주문의 주인이 아니어서 원장을 남길 수 없었다. */
  | "order-not-matched"
  | PointsRestoreBlockedReason;

/**
 * 주문 1건의 적립금을 복원한다. 많아야 한 번 저장한다.
 *
 * 입력은 주문 id와 어느 환불 문의에서 비롯됐는지 뿐이다. 금액도 회원도 바깥에서 받지 않는다.
 * 금액은 주문·결제 기록에서 서버가 다시 읽고, 회원은 주문 행의 주인을 쓴다.
 */
export async function runRefundPointsRestore(
  input: { orderId: string; refundRequestId: string | null },
  deps: RefundPointsRestoreDeps,
): Promise<RefundPointsRestoreResult> {
  const orderId = input.orderId;

  // 1) 근거 모으기. 주문이 없으면 여기서 끝난다.
  const order = await deps.getOrderById(orderId);
  if (!order) return { kind: "not-applicable", orderId, reason: "order-not-found" };

  const payments = await deps.listPaymentsForOrder(orderId);
  if (payments.length === 0) {
    return { kind: "not-applicable", orderId, reason: "no-payment" };
  }
  if (payments.length > 1) {
    // 자동으로 하나를 고르지 않는다. 결제 취소 쪽 ambiguous와 같은 방침이다.
    return { kind: "not-applicable", orderId, reason: "ambiguous-payment" };
  }

  // 2) 얼마를 돌려줄 수 있는지. 근거 두 개가 정확히 같을 때만 금액이 나온다.
  const decision = decidePointsRestore(order, payments[0]);
  if (decision.kind === "blocked") {
    return { kind: "not-applicable", orderId, reason: decision.reason };
  }

  /*
   * 3) 반영. 회원은 주문 행의 주인을 쓴다(요청값을 그대로 믿지 않는다).
   *    저장 함수 안에서도 주문 행과 한 번 더 맞춰 본다.
   */
  const data = await deps.readData();
  const saved = await deps.restorePoints(data, {
    userId: order.userId,
    orderId,
    refundRequestId: input.refundRequestId,
    amount: decision.amount,
  });

  if (saved.applied) return { kind: "restored", orderId, amount: saved.amount };
  if (saved.reason === "already-restored") return { kind: "already-restored", orderId };
  if (saved.reason === "cas-conflict") return { kind: "retry-later", orderId, reason: "cas-conflict" };
  return { kind: "not-applicable", orderId, reason: saved.reason };
}

/**
 * 제품 코드에서 쓸 실제 구현들.
 *
 * 저장 모듈을 이 파일 맨 위에서 바로 불러오지 않고 여기서 필요할 때 읽는다.
 * 그래야 위 흐름을 DB 없이 그 자체로 확인할 수 있다(기존 환불 흐름들과 같은 방식).
 */
export async function defaultRefundPointsRestoreDeps(): Promise<RefundPointsRestoreDeps> {
  const store = await import("@/lib/server/store");
  return {
    readData: () => store.readData(),
    getOrderById: (orderId) => store.getOrderById(orderId),
    listPaymentsForOrder: (orderId) => store.listPaymentsByOrderId(orderId),
    restorePoints: (data, restoreInput) => store.restoreOrderPointsOnce(data, restoreInput),
  };
}
