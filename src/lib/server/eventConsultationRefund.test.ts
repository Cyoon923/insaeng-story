/**
 * OPEN EVENT 주문 전체 환불 → 이벤트 상담 취소 → 슬롯 해제 테스트.
 *
 * 실행: node --test src/lib/server/eventConsultationRefund.test.ts
 *
 * DB·NICEPAY 없이 순수 함수와 가짜 deps로 본다. route·store는 원문으로 확인한다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  cancelEventConsultationAfterRefund,
  consultationRefundOrderId,
  markEventConsultationCancelled,
  runEventConsultationCleanupSafely,
} from "./eventConsultationRefund.ts";
import type { EventConsultationCleanupDeps } from "./eventConsultationRefund.ts";
import { eventConsultationId } from "./eventConsultation.ts";
import { isSlotAvailable } from "./consultationSlots.ts";
import { attachConsultations } from "./refundRequestAdminView.ts";
import type { AdminRefundRequestBase } from "./refundRequestAdminView.ts";
import { buildRefundRequestEvidence } from "./refundRequestEvidence.ts";
import { runRefundPaymentNormalFinalize } from "./refundPaymentNormalFinalize.ts";
import type { RefundPaymentNormalFinalizeDeps } from "./refundPaymentNormalFinalize.ts";
import { hasCompletedRefund } from "../refundCardActions.ts";
import { buildMyOrderItems, REFUND_COMPLETED_STATUS } from "../myOrders.ts";
import type { AppData, Consultation, Order, Payment } from "@/lib/types/app";

const ORDER_ID = "o-is-ev1";
const CONSULT_ID = eventConsultationId(ORDER_ID);
const NOW = "2026-10-10T00:00:00.000Z";
const LATER = "2026-10-11T00:00:00.000Z";

function consult(overrides: Partial<Consultation> = {}, details: Record<string, string> = {}): Consultation {
  return {
    id: CONSULT_ID,
    userId: "u-1",
    teacher: "유비 선생",
    datetime: "10월 12일(월) 오전 10:00",
    scheduledAt: "2026-10-12T01:00:00.000Z",
    purpose: "직업 · 사업 고민",
    method: "카카오톡 상담",
    option: "없음",
    status: "상담 신청",
    amount: 0,
    details: { eventOrderId: ORDER_ID, ...details },
    createdAt: "2026-10-05T00:00:00.000Z",
    ...overrides,
  };
}

function eventOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: ORDER_ID,
    userId: "u-1",
    product: "saju-song",
    title: "사주 인생곡",
    status: "신청접수",
    amount: 119000,
    payment: "신용/체크카드",
    details: { promotion: "saju-song-open-2026", optionIds: "saju-consultation" },
    createdAt: "2026-10-04T00:00:00.000Z",
    ...overrides,
  };
}

function data(consultations: Consultation[] = [consult()]): AppData {
  return { consultations, blockedSlots: [] } as unknown as AppData;
}

function deps(overrides: Partial<EventConsultationCleanupDeps> & { store?: AppData } = {}) {
  let store = overrides.store ?? data();
  const writes: AppData[] = [];
  const d: EventConsultationCleanupDeps = {
    isRefundCompleted: async () => true,
    getOrder: async () => eventOrder(),
    readData: async () => structuredClone(store),
    writeData: async (next) => {
      writes.push(next);
      store = next;
    },
    isConflict: (error) => error instanceof Error && error.message === "conflict",
    now: () => new Date(NOW),
    ...overrides,
  };
  return { d, writes, get store() { return store; } };
}

/* ── 취소 표시 ─────────────────────────────── */

test("completed 환불 + 연결 이벤트 상담 → cancelledAt 기록", async () => {
  const h = deps();
  const result = await cancelEventConsultationAfterRefund(ORDER_ID, h.d);
  assert.deepEqual(result, { kind: "cancelled", consultationId: CONSULT_ID });
  assert.equal(h.store.consultations[0].cancelledAt, NOW);
  assert.equal(h.writes.length, 1);
  // 상태 문구(ConsultStatus)는 바꾸지 않는다.
  assert.equal(h.store.consultations[0].status, "상담 신청");
});

test("반복 실행은 멱등이고 cancelledAt 최초값을 유지한다", async () => {
  const h = deps();
  await cancelEventConsultationAfterRefund(ORDER_ID, h.d);
  const again = await cancelEventConsultationAfterRefund(ORDER_ID, { ...h.d, now: () => new Date(LATER) });
  assert.deepEqual(again, { kind: "already-cancelled", consultationId: CONSULT_ID });
  assert.equal(h.store.consultations[0].cancelledAt, NOW);
  assert.equal(h.writes.length, 1);
});

test("연결 상담 없음 → 안전한 no-op(저장 없음)", async () => {
  const h = deps({ store: data([]) });
  assert.deepEqual(await cancelEventConsultationAfterRefund(ORDER_ID, h.d), { kind: "no-consultation" });
  assert.equal(h.writes.length, 0);
});

test("refund completed 아님 → 취소하지 않는다(주문·상담을 읽지도 않음)", async () => {
  let read = 0;
  const h = deps({ isRefundCompleted: async () => false, readData: async () => { read += 1; return data(); } });
  assert.deepEqual(await cancelEventConsultationAfterRefund(ORDER_ID, h.d), { kind: "not-refunded" });
  assert.equal(read, 0);
  assert.equal(h.writes.length, 0);
});

test("이벤트 상담 포함 주문이 아니면 no-op", async () => {
  const h = deps({ getOrder: async () => eventOrder({ details: { optionIds: "saju-consultation" } }) });
  assert.deepEqual(await cancelEventConsultationAfterRefund(ORDER_ID, h.d), { kind: "not-applicable" });
  assert.equal(h.writes.length, 0);
});

test("다른 eventOrderId·다른 회원·일반 상담은 건드리지 않는다", () => {
  const other = consult({ id: eventConsultationId("o-is-other") }, { eventOrderId: "o-is-other" });
  const foreign = consult({ userId: "u-9" });
  const normal = consult({ id: ORDER_ID, amount: 100000, details: {} });
  const d = data([other, foreign, normal]);
  assert.deepEqual(markEventConsultationCancelled(d, eventOrder(), NOW), { kind: "no-consultation" });
  assert.equal(d.consultations.every((item) => !item.cancelledAt), true);
});

test("저장 충돌이면 다시 읽어 재시도, 3회 모두 충돌이면 던진다", async () => {
  let attempts = 0;
  const flaky = deps({
    writeData: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("conflict");
    },
  });
  assert.equal((await cancelEventConsultationAfterRefund(ORDER_ID, flaky.d)).kind, "cancelled");
  assert.equal(attempts, 2);
  const always = deps({ writeData: async () => { throw new Error("conflict"); } });
  await assert.rejects(() => cancelEventConsultationAfterRefund(ORDER_ID, always.d), /conflict/);
});

test("후처리 wrapper는 실패를 삼키고 던지지 않는다", async () => {
  await runEventConsultationCleanupSafely(async () => { throw new Error("boom"); }, ORDER_ID);
  await runEventConsultationCleanupSafely(undefined, ORDER_ID);
});

/* ── 슬롯 ─────────────────────────────── */

test("cancelledAt 상담은 슬롯을 점유하지 않는다 / 일반 상담은 기존대로 점유", () => {
  const cancelled = consult({ cancelledAt: NOW });
  assert.equal(isSlotAvailable(data([cancelled]), "유비 선생", "10월 12일(월)", "오전 10:00"), true);
  const active = consult();
  assert.equal(isSlotAvailable(data([active]), "유비 선생", "10월 12일(월)", "오전 10:00"), false);
  const normal = consult({ id: "c-x", amount: 100000, details: {} });
  assert.equal(isSlotAvailable(data([normal]), "유비 선생", "10월 12일(월)", "오전 10:00"), false);
});

/* ── 잠금·표시 판정 ─────────────────────────────── */

test("환불·잠금 기준 주문 id: 이벤트 상담은 eventOrderId, 일반 상담은 자기 id", () => {
  assert.equal(consultationRefundOrderId(consult()), ORDER_ID);
  assert.equal(consultationRefundOrderId(consult({ id: "c-1", details: {} })), "c-1");
});

test("관리자 환불 표시: 이벤트 상담은 원 주문의 completed로 판단, 일반 상담은 기존대로", () => {
  const items = [{ orderId: ORDER_ID, status: "completed" as const }];
  assert.equal(hasCompletedRefund(items, consultationRefundOrderId(consult())), true);
  assert.equal(hasCompletedRefund(items, consultationRefundOrderId(consult({ id: "c-1", details: {} }))), false);
});

test("MY 목록: 짝 주문 없는 이벤트 상담은 원 주문 환불 완료면 환불 완료로 보인다", () => {
  const latest = { loaded: true, items: [{ id: "rr-1", orderId: ORDER_ID, status: "completed" as const, requestedAt: NOW }] };
  const [item] = buildMyOrderItems([], [consult()], latest);
  assert.equal(item.refundCompleted, true);
  assert.equal(item.displayStatus, REFUND_COMPLETED_STATUS);
  // 일반(짝 없는 옛) 상담은 기존대로 환불 완료로 추정하지 않는다.
  const [plain] = buildMyOrderItems([], [consult({ id: "c-old", details: {} })], latest);
  assert.equal(plain.refundCompleted, false);
});

test("관리자 환불 카드: 이벤트 주문 문의에 연결 상담의 지금 예약 시각·상태가 붙는다", () => {
  const base = { id: "rr-1", orderId: ORDER_ID, userId: "u-1", order: { product: "saju-song" } } as unknown as AdminRefundRequestBase;
  const plain = { ...base, id: "rr-2", orderId: "o-is-plain" } as AdminRefundRequestBase;
  const [withConsult, withoutConsult] = attachConsultations([base, plain], [consult({ status: "상담 완료" })]);
  assert.deepEqual(withConsult.consultation, { scheduledAt: "2026-10-12T01:00:00.000Z", status: "상담 완료" });
  assert.equal(withoutConsult.consultation, null);
  // 다른 회원의 상담은 붙지 않는다.
  const [foreign] = attachConsultations([{ ...base, userId: "u-9" } as AdminRefundRequestBase], [consult()]);
  assert.equal(foreign.consultation, null);
});

test("환불 evidence: OPEN EVENT 주문에 연결 상담이 있으면 예약 시각·취소창을 남긴다", () => {
  const evidence = buildRefundRequestEvidence({
    order: { product: "saju-song", productionStartedAt: undefined },
    consultation: { scheduledAt: "2026-10-12T01:00:00.000Z" },
    requestedAt: new Date("2026-10-11T00:00:00.000Z"),
  });
  assert.equal(evidence.scheduledAtSnapshot, "2026-10-12T01:00:00.000Z");
  assert.ok(evidence.cancelWindowSnapshot);
  assert.ok(evidence.cancelWindowPolicyVersion);
  // 연결 상담이 없는 인생곡 주문은 기존과 같다.
  const plain = buildRefundRequestEvidence({ order: { product: "saju-song" }, consultation: null, requestedAt: new Date(NOW) });
  assert.equal(plain.scheduledAtSnapshot, null);
  assert.equal(plain.cancelWindowSnapshot, null);
});

test("상담 완료여도 환불 접수를 새로 막지 않는다(상태로 거절하는 코드 없음)", () => {
  const src = readFileSync(new URL("./refundRequests.ts", import.meta.url), "utf8");
  const fn = src.slice(src.indexOf("export async function createRefundRequest"), src.indexOf("export async function getActiveRefundRequestByOrderId"));
  assert.match(fn, /findEventConsultation\(/);
  assert.equal(/상담 완료|cancelledAt|\.status ===/.test(fn), false);
});

/* ── 환불 흐름 연결 ─────────────────────────────── */

function payment(): Payment {
  return {
    id: "pay-1", orderId: ORDER_ID, provider: "nicepay", merchantOrderId: "is-ev1", pgTid: "tid-1",
    requestedAmount: 119000, approvedAmount: 119000, cancelledAmount: 0, status: "paid", method: "card",
    approvedAt: NOW, cancelledAt: null, orderSnapshot: null, raw: null, createdAt: NOW, updatedAt: NOW,
    cancelAttemptedAt: NOW, cancelResultKind: "succeeded", cancelResultCode: "2001", cancelResultMessage: null,
    cancelResponseRaw: null, cancelExecutionStatus: "succeeded", cancelClaimedAt: NOW,
  };
}

function normalDeps(finalized: "finalized" | "already-finalized", cleanup: () => Promise<unknown>) {
  const calls: string[] = [];
  const d: RefundPaymentNormalFinalizeDeps = {
    executeCancellation: async () => { calls.push("cancel"); return { kind: "succeeded", payment: payment() }; },
    inquirePayment: async () => {
      calls.push("inquiry");
      return {
        kind: "found",
        result: { resultCode: "0000", tid: "tid-1", orderId: "is-ev1", status: "cancelled", amount: 119000, cancelledAmt: 119000, balanceAmt: 0, cancelledAt: NOW },
        raw: {}, httpStatus: 200,
      };
    },
    finalize: async () => {
      calls.push("finalize");
      return finalized === "finalized" ? { ok: true, kind: "finalized" } : { ok: false, kind: "already-finalized" };
    },
    restorePoints: async () => { calls.push("points"); return { kind: "not-applicable", reason: "no-points" } as never; },
    cleanupEventConsultation: async () => { calls.push("cleanup"); return cleanup(); },
  };
  return { d, calls };
}

test("정상 경로: 완료 뒤 상담 정리 1회, PG 취소는 1회뿐", async () => {
  const h = normalDeps("finalized", async () => ({ kind: "cancelled" }));
  const result = await runRefundPaymentNormalFinalize(ORDER_ID, h.d);
  assert.equal(result.kind, "completed");
  assert.deepEqual(h.calls, ["cancel", "inquiry", "finalize", "cleanup", "points"]);
});

test("정상 경로(already-finalized)도 정리를 부르고, 정리가 던져도 completed는 그대로", async () => {
  const h = normalDeps("already-finalized", async () => { throw new Error("boom"); });
  const result = await runRefundPaymentNormalFinalize(ORDER_ID, h.d);
  assert.equal(result.kind, "completed");
  assert.equal(h.calls.filter((c) => c === "cancel").length, 1);
  assert.equal(h.calls.filter((c) => c === "cleanup").length, 1);
});

test("복구 두 경로도 같은 완료 후처리를 쓰고 기본 deps에 연결되어 있다", () => {
  for (const file of ["./refundPaymentRecovery.ts", "./refundPaymentSucceededRecovery.ts", "./refundPaymentNormalFinalize.ts"]) {
    const src = readFileSync(new URL(file, import.meta.url), "utf8");
    const fn = src.slice(src.indexOf("async function tryRestorePoints"), src.indexOf("async function tryRestorePoints") + 400);
    assert.match(fn, /runEventConsultationCleanupSafely\(deps\.cleanupEventConsultation, orderId\)/, file);
    assert.match(src, /cleanupEventConsultation: async \(orderId\) =>/, file);
    // 완료 지점은 기존처럼 tryRestorePoints 2곳(finalized, already-finalized)뿐이다.
    assert.equal((src.match(/await tryRestorePoints\(deps, orderId, paymentId\);/g) ?? []).length, 2, file);
  }
});

test("관리자: 상태 변경 잠금은 consultationRefundOrderId, 재시도는 completed 관문 + PG 미호출", () => {
  const route = readFileSync(new URL("../../app/api/admin/route.ts", import.meta.url), "utf8");
  assert.match(route, /hasCompletedRefundRequestForOrder\(consultationRefundOrderId\(item\)\)/);
  const start = route.indexOf('if (action === "retryEventConsultationCancel")');
  const block = route.slice(start, route.indexOf("\n  if (action ===", start + 10));
  assert.match(block, /authorizePointsRestoreRecovery\(refundRequestId\)/);
  assert.match(block, /cleanupEventConsultationAfterRefund\(gate\.orderId\)/);
  for (const name of ["executeApprovedRefund", "runRefundPaymentNormalFinalize", "cancelNicepayPayment", "runRefundPaymentRecovery"]) {
    assert.equal(block.includes(name), false, name);
  }
});
