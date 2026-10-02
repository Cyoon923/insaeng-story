/**
 * 관리자 환불 카드 동작 규칙 테스트 (Refund-Payment-Admin-Execute-UI-2).
 *
 * 실행: node --test src/lib/refundCardActions.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { hasCompletedRefund, pointsRestoreCardView, refundCardActions } from "./refundCardActions.ts";
import type { AdminRefundRequestItem, RefundRequestStatus } from "@/lib/types/app";
import { readFileSync } from "node:fs";
import { decideZeroPointsRefund } from "./server/zeroPointsRefund.ts";
import type { ZeroPointsRefundFacts } from "./server/zeroPointsRefund.ts";

type Projection = AdminRefundRequestItem["refundExecution"];
const PROJECTIONS: Projection[] = [
  "executable",
  "recoverable",
  "manual-review",
  "unknown",
  "free-coupon-no-payment",
  "zero-points-no-payment",
];

test("executable → 실제 환불 실행만", () => {
  assert.deepEqual(refundCardActions("approved", "executable"), {
    execute: true,
    recover: false,
    notice: null,
  });
});

test("recoverable → 결제 상태 확인만", () => {
  assert.deepEqual(refundCardActions("approved", "recoverable"), {
    execute: false,
    recover: true,
    notice: null,
  });
});

test("manual-review → 버튼 없이 담당자 확인 안내", () => {
  const actions = refundCardActions("approved", "manual-review");
  assert.equal(actions.execute, false);
  assert.equal(actions.recover, false);
  assert.ok(actions.notice && actions.notice.includes("담당자"));
});

test("unknown → 버튼 없이 판단 불가 안내", () => {
  const actions = refundCardActions("approved", "unknown");
  assert.equal(actions.execute, false);
  assert.equal(actions.recover, false);
  assert.ok(actions.notice && actions.notice.includes("판단할 수 없습니다"));
});

/** 두 버튼이 함께 나오는 조합이 하나도 없다. */
test("어떤 조합에서도 두 버튼이 동시에 나오지 않는다", () => {
  const statuses: RefundRequestStatus[] = [
    "requested",
    "reviewing",
    "approved",
    "rejected",
    "completed",
  ];
  for (const status of statuses) {
    for (const projection of PROJECTIONS) {
      const actions = refundCardActions(status, projection);
      assert.equal(actions.execute && actions.recover, false, `${status}/${projection}`);
      // 버튼이 있으면 안내를 함께 띄우지 않는다.
      if (actions.execute || actions.recover) assert.equal(actions.notice, null);
    }
  }
});

/** 승인 상태가 아니면 이 카드에서 아무 버튼도 보이지 않는다(기존 화면 유지). */
test("approved가 아니면 버튼도 안내도 없다", () => {
  for (const status of ["requested", "reviewing", "rejected", "completed"] as RefundRequestStatus[]) {
    for (const projection of PROJECTIONS) {
      assert.deepEqual(refundCardActions(status, projection), {
        execute: false,
        recover: false,
        notice: null,
      });
    }
  }
});

/* ── 환불 완료 건 식별 (Refund-Completed-Admin-Presentation-1) ── */

type RefundRow = { orderId: string; status: RefundRequestStatus };

const ORDER_ID = "o-1";

test("completed가 있으면 참이다", () => {
  const items: RefundRow[] = [{ orderId: ORDER_ID, status: "completed" }];
  assert.equal(hasCompletedRefund(items, ORDER_ID), true);
});

test("completed가 아닌 상태만 있으면 거짓이다", () => {
  for (const status of ["requested", "reviewing", "approved", "rejected"] as const) {
    assert.equal(hasCompletedRefund([{ orderId: ORDER_ID, status }], ORDER_ID), false, status);
  }
});

test("다른 주문의 completed는 이 주문에 영향을 주지 않는다", () => {
  const items: RefundRow[] = [{ orderId: "o-other", status: "completed" }];
  assert.equal(hasCompletedRefund(items, ORDER_ID), false);
});

test("이력이 여럿이어도 completed가 하나라도 있으면 참이다", () => {
  // 서버 잠금이 EXISTS로 보는 규칙과 같아야 한다.
  const items: RefundRow[] = [
    { orderId: ORDER_ID, status: "rejected" },
    { orderId: ORDER_ID, status: "completed" },
  ];
  assert.equal(hasCompletedRefund(items, ORDER_ID), true);
  assert.equal(hasCompletedRefund([...items].reverse(), ORDER_ID), true);
});

test("목록이 비었거나 주문 id가 비어 있으면 거짓이다", () => {
  assert.equal(hasCompletedRefund([], ORDER_ID), false);
  assert.equal(hasCompletedRefund([{ orderId: ORDER_ID, status: "completed" }], "  "), false);
});

/* ── 적립금 복원 영역 (Refund-Points-Restore-Admin-UI-1) ───────────── */

test("completed + 원장 없음 → 기록 없음 표시와 재시도 버튼", () => {
  assert.deepEqual(pointsRestoreCardView("completed", false), {
    visible: true,
    label: "적립금 복원 기록 없음",
    retry: true,
  });
});

test("completed + 원장 있음 → 기록 있음 표시, 버튼 없음", () => {
  assert.deepEqual(pointsRestoreCardView("completed", true), {
    visible: true,
    label: "적립금 복원 기록 있음",
    retry: false,
  });
});

test("completed가 아니면 영역 자체가 보이지 않는다", () => {
  for (const status of ["requested", "reviewing", "approved", "rejected"] as const) {
    for (const hasRecord of [true, false]) {
      assert.deepEqual(
        pointsRestoreCardView(status, hasRecord),
        { visible: false, label: null, retry: false },
        `${status}/${hasRecord}`,
      );
    }
  }
});

test("환불 실행 버튼과 적립금 복원 버튼은 함께 나오지 않는다", () => {
  /*
   * 두 규칙이 보는 상태가 겹치지 않는지 확인한다.
   * refundCardActions는 approved에서만, 적립금 영역은 completed에서만 무언가를 낸다.
   */
  for (const status of ["requested", "reviewing", "approved", "rejected", "completed"] as const) {
    const actions = refundCardActions(status, "executable");
    const recoverable = refundCardActions(status, "recoverable");
    const points = pointsRestoreCardView(status, false);
    const refundButtonShown = actions.execute || actions.recover || recoverable.recover;
    assert.ok(!(refundButtonShown && points.retry), status);
  }
});

test("표시 문구에 환불 재실행으로 읽힐 말을 넣지 않는다", () => {
  for (const hasRecord of [true, false]) {
    const label = pointsRestoreCardView("completed", hasRecord).label ?? "";
    assert.ok(!label.includes("환불"), label);
    // 기록 없음을 "누락"·"오류"·"필요"로 단정하지 않는다.
    for (const word of ["누락", "오류", "필요", "실패"]) {
      assert.ok(!label.includes(word), `${label} / ${word}`);
    }
  }
});

/* ── 적립금 전액 사용 0원 (P1-09 4단계) ────────────────────── */

test("zero-points-no-payment + approved → 실행 버튼(적립금 0원 표시), 복구 버튼·안내 없음", () => {
  assert.deepEqual(refundCardActions("approved", "zero-points-no-payment"), {
    execute: true,
    recover: false,
    notice: null,
    zeroPoints: true,
  });
});

test("무료 쿠폰·일반 PG 표시는 그대로이고 적립금 0원 표시가 섞이지 않는다", () => {
  assert.deepEqual(refundCardActions("approved", "free-coupon-no-payment"), {
    execute: true,
    recover: false,
    notice: null,
    freeCoupon: true,
  });
  assert.deepEqual(refundCardActions("approved", "executable"), {
    execute: true,
    recover: false,
    notice: null,
  });
});

test("requested·reviewing·rejected·completed에는 적립금 0원 실행 버튼이 없다", () => {
  for (const status of ["requested", "reviewing", "rejected", "completed"] as RefundRequestStatus[]) {
    assert.deepEqual(refundCardActions(status, "zero-points-no-payment"), {
      execute: false,
      recover: false,
      notice: null,
    });
  }
});

/**
 * 관리자 목록이 정하는 표시값의 모형. listRefundRequestsForAdmin의 순서와 같다
 * (무료 쿠폰 먼저 → 적립금 0원 → 결제 요약). 결제 행이 없는 0원 건의 결제 요약은 unknown이다.
 * 아래 원문 테스트가 실제 목록이 이 순서를 따르는지 고정한다.
 */
function zeroPointsProjection(facts: ZeroPointsRefundFacts): Projection {
  return decideZeroPointsRefund(facts).kind === "eligible" ? "zero-points-no-payment" : "unknown";
}

function zeroFacts(
  details: Record<string, string> = {},
  overrides: Partial<NonNullable<ZeroPointsRefundFacts["order"]>> = {},
  rest: Partial<ZeroPointsRefundFacts> = {},
): ZeroPointsRefundFacts {
  return {
    order: {
      id: "mabc123-x1y2z3",
      product: "story",
      amount: 0,
      baseAmount: 149000,
      payment: "적립금",
      details: { optionIds: "", usePoints: "1", pointsUsed: "149000", ...details },
      ...overrides,
    },
    linkedPaymentCount: 0,
    recalculatedBaseAmount: 149000,
    ...rest,
  };
}

test("정상 적립금 0원 approved → 전용 표시 + 실행 버튼", () => {
  const actions = refundCardActions("approved", zeroPointsProjection(zeroFacts()));
  assert.equal(actions.execute, true);
  assert.equal(actions.zeroPoints, true);
});

test("근거가 어긋나면 적립금 0원 버튼이 나오지 않고 기존 unknown 안내로 남는다", () => {
  const cases: [string, ZeroPointsRefundFacts][] = [
    ["payment 존재", zeroFacts({}, {}, { linkedPaymentCount: 1 })],
    ["위조 pointsUsed(100% 할인 뒤)", zeroFacts({ referralCode: "AD9", referralDiscount: "149000" })],
    ["pointsUsed 과다", zeroFacts({ pointsUsed: "500000" })],
    ["baseAmount 불일치", zeroFacts({}, { baseAmount: 159000 })],
    ["재계산 불가", zeroFacts({}, {}, { recalculatedBaseAmount: null })],
    ["promotion", zeroFacts({ promotion: "open-event" })],
    ["coupon 흔적", zeroFacts({ couponId: "cp-1" })],
    ["couponFree 흔적", zeroFacts({ couponFree: "1" })],
  ];
  for (const [name, facts] of cases) {
    const projection = zeroPointsProjection(facts);
    assert.equal(projection, "unknown", name);
    const actions = refundCardActions("approved", projection);
    assert.equal(actions.execute, false, name);
    assert.equal(actions.zeroPoints, undefined, name);
    assert.ok(actions.notice, name);
  }
});

test("관리자 목록: 무료 쿠폰 먼저, 같은 주문 값·결제 전체 건수로 적립금 0원 판정, 실패 시 둘 다 비움", () => {
  const source = readFileSync(new URL("./server/refundRequests.ts", import.meta.url), "utf8");
  const squash = (text: string) => text.replace(/\s+/g, " ");
  const code = squash(source);
  for (const part of [
    "const linkedPaymentCount = paymentCounts.get(row.order_id)?.totalCount ?? 0;",
    "const decision = await evaluateFreeCouponRefund(order, linkedPaymentCount); if (decision.kind === \"eligible\") { freeCouponOrders.add(row.order_id); continue; }",
    "const zero = await evaluateZeroPointsRefund(order, linkedPaymentCount); if (zero.kind === \"eligible\") zeroPointsOrders.add(row.order_id);",
    "freeCouponOrders.clear(); zeroPointsOrders.clear();",
    "refundExecution: freeCouponOrders.has(stored.orderId) ? \"free-coupon-no-payment\" : zeroPointsOrders.has(stored.orderId) ? \"zero-points-no-payment\" : projectRefundExecution(",
  ]) {
    assert.ok(code.includes(part), part);
  }
  // 판정 규칙을 복제하지 않는다. 적립금 0원 판정은 evaluateZeroPointsRefund 한 곳뿐이다.
  assert.equal(code.includes("pointsUsed"), false);
});

test("관리자 화면: 적립금 0원 버튼은 같은 실행 API를 부르고 실제 동작을 알린다", () => {
  const page = readFileSync(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
  assert.ok(page.includes('"결제 없음 — 적립금 복원 후 취소 완료"'));
  assert.ok(page.includes("PG 취소 없이 사용한 적립금을 돌려주고 취소 완료 처리됩니다."));
  // 버튼 종류와 무관하게 실행 요청은 하나뿐이다.
  assert.equal(page.match(/action: "executeApprovedRefund"/g)?.length, 1);
});
