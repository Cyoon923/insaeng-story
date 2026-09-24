/**
 * 관리자 환불 카드 동작 규칙 테스트 (Refund-Payment-Admin-Execute-UI-2).
 *
 * 실행: node --test src/lib/refundCardActions.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { hasCompletedRefund, pointsRestoreCardView, refundCardActions } from "./refundCardActions.ts";
import type { AdminRefundRequestItem, RefundRequestStatus } from "@/lib/types/app";

type Projection = AdminRefundRequestItem["refundExecution"];
const PROJECTIONS: Projection[] = ["executable", "recoverable", "manual-review", "unknown"];

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
