/**
 * 탈퇴 판정: 환불·취소가 끝난 주문·상담 (P1-08).
 *
 * 실행: npx tsx --test src/lib/server/withdrawBlockers.test.ts
 *
 * 저장소 조회(주문 목록·대기 결제 수·환불 문의 상태)는 대역으로 넘긴다. 판정 규칙만 본다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { findWithdrawBlockers } from "./withdrawAccount.ts";
import type { WithdrawBlockerDeps } from "./withdrawAccount.ts";
import type { AppData, Consultation, Order, RefundRequestStatus } from "../types/app.ts";

const U = "u-1";

function order(id: string, status: Order["status"], product = "story"): Order {
  return { id, userId: U, product, title: "인생곡", status, amount: 1, payment: "", details: {}, createdAt: "x" } as Order;
}

function consult(id: string, status: Consultation["status"], extra: Partial<Consultation> = {}): Consultation {
  return { id, userId: U, status, details: {}, ...extra } as Consultation;
}

function run(
  input: {
    orders?: Order[];
    consultations?: Consultation[];
    refunds?: [string, RefundRequestStatus][];
    pending?: number;
  },
) {
  const data = { consultations: input.consultations ?? [] } as unknown as AppData;
  const deps: WithdrawBlockerDeps = {
    listOrders: async () => input.orders ?? [],
    countPendingPayments: async () => input.pending ?? 0,
    listRefundStatuses: async () => (input.refunds ?? []).map(([orderId, status]) => ({ orderId, status })),
  };
  return findWithdrawBlockers(data, U, deps);
}

const kinds = async (input: Parameters<typeof run>[0]) => (await run(input)).map((item) => item.kind).sort();

/* ── 허용 ─────────────────────────────────────────── */

test("completed 환불 + 미완료 일반 주문(신청접수·제작중) -> 탈퇴 허용", async () => {
  assert.deepEqual(
    await kinds({
      orders: [order("o-1", "신청접수"), order("o-2", "제작중")],
      refunds: [["o-1", "completed"], ["o-2", "completed"]],
    }),
    [],
  );
});

test("completed 환불 + 미완료 1:1 상담(상담 id 기준) -> 허용", async () => {
  assert.deepEqual(
    await kinds({ consultations: [consult("c-is-1", "상담 신청")], refunds: [["c-is-1", "completed"]] }),
    [],
  );
});

test("OPEN EVENT 상담: 원 이벤트 주문 환불 완료 -> 허용 (consultationRefundOrderId 기준)", async () => {
  assert.deepEqual(
    await kinds({
      consultations: [consult("ce-o-ev", "상담 신청", { details: { eventOrderId: "o-ev" } })],
      refunds: [["o-ev", "completed"]],
    }),
    [],
  );
});

test("cancelledAt이 있는 상담 -> 허용", async () => {
  assert.deepEqual(
    await kinds({ consultations: [consult("ce-o-ev", "상담 신청", { cancelledAt: "2026-10-01T00:00:00Z" })] }),
    [],
  );
});

test("기존 완료 주문 / 상담 완료(환불 없음) -> 허용", async () => {
  assert.deepEqual(
    await kinds({ orders: [order("o-1", "완료")], consultations: [consult("c-1", "상담 완료")] }),
    [],
  );
});

test("상담 결제 귀속 주문(product consultation)은 기존대로 판정에서 제외", async () => {
  assert.deepEqual(await kinds({ orders: [order("c-1", "신청접수", "consultation")] }), []);
});

/* ── 차단 ─────────────────────────────────────────── */

for (const status of ["requested", "reviewing", "approved"] as const) {
  test(`${status} 환불 -> 탈퇴 차단 ("처리 중인 환불이 있습니다.")`, async () => {
    const blockers = await run({ orders: [order("o-1", "신청접수")], refunds: [["o-1", status]] });
    const refund = blockers.find((item) => item.kind === "refund");
    assert.ok(refund);
    assert.equal(refund.reason, "처리 중인 환불이 있습니다.");
    assert.equal(refund.count, 1);
  });
}

test("완료 주문이라도 환불 처리 중이면 차단(주문 사유 없이 환불 사유만)", async () => {
  assert.deepEqual(await kinds({ orders: [order("o-1", "완료")], refunds: [["o-1", "reviewing"]] }), ["refund"]);
});

test("상담 완료라도 환불 처리 중이면 차단", async () => {
  assert.deepEqual(
    await kinds({ consultations: [consult("c-1", "상담 완료")], refunds: [["c-1", "requested"]] }),
    ["refund"],
  );
});

test("rejected 환불 + 미완료 주문 / 상담 -> 기존대로 차단", async () => {
  assert.deepEqual(
    await kinds({
      orders: [order("o-1", "신청접수")],
      consultations: [consult("c-1", "상담 신청")],
      refunds: [["o-1", "rejected"], ["c-1", "rejected"]],
    }),
    ["consultation", "order"],
  );
});

test("processing / 최근 ready 결제(대기 결제 수 > 0) -> 차단 유지", async () => {
  const blockers = await run({ pending: 2 });
  assert.deepEqual(blockers, [{ kind: "payment", count: 2, reason: "진행 중인 결제가 있습니다." }]);
});

test("환불 없는 미완료 주문 / 상담 -> 차단 유지", async () => {
  assert.deepEqual(
    await kinds({ orders: [order("o-1", "제작중")], consultations: [consult("c-1", "선생님과 1:1 상담")] }),
    ["consultation", "order"],
  );
});

test("다른 주문의 completed 환불은 이 주문을 풀어 주지 않는다", async () => {
  assert.deepEqual(
    await kinds({ orders: [order("o-1", "신청접수")], refunds: [["o-2", "completed"]] }),
    ["order"],
  );
});

test("다른 회원의 상담은 판정에 들어가지 않는다", async () => {
  const other = { ...consult("c-x", "상담 신청"), userId: "u-2" };
  assert.deepEqual(await kinds({ consultations: [other] }), []);
});

/* ── 구조 ─────────────────────────────────────────── */

test("route: 사전 판정과 CAS 재시도(lateBlockers)가 같은 findWithdrawBlockers를 기본 저장소로 부른다", () => {
  const ROUTE = readFileSync(new URL("../../app/api/app/route.ts", import.meta.url), "utf8");
  assert.match(ROUTE, /const blockers = await findWithdrawBlockers\(latest, target\.id\);/);
  assert.match(ROUTE, /attempt === 1 \? blockers : await findWithdrawBlockers\(fresh, freshTarget\.id\)/);
});

test("refundRequests: 회원별 조회는 order_id·status만 읽는다(사유·메시지 미조회)", () => {
  const SOURCE = readFileSync(new URL("./refundRequests.ts", import.meta.url), "utf8");
  const body = SOURCE.slice(SOURCE.indexOf("export async function listRefundRequestStatusesByUser("));
  assert.match(body, /SELECT order_id, status FROM refund_requests WHERE user_id = \$1/);
});
