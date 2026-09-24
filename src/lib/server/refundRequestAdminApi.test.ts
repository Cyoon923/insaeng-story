/**
 * 관리자 상태 전이 API의 입출력 규칙 테스트 (Refund-Request-Admin-Transition-API-1).
 *
 * 실행: node --test src/lib/server/refundRequestAdminApi.test.ts
 * (기존 단계들과 같은 방식. 새 테스트 라이브러리를 더하지 않는다.)
 *
 * 전이 허용 규칙은 refundRequestTransitions.test.ts가, CAS·동시성·감사 열은
 * refundRequests.test.sql이 본다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  progressLockedByRefundResponse,
  readTransitionRefundRequestBody,
  toTransitionRefundRequestResponse,
  transitionFailureResponse,
} from "./refundRequestAdminApi.ts";
import { isAllowedAdminTransition } from "./refundRequestTransitions.ts";
import type { RefundRequest } from "@/lib/types/app";

test("body에서 세 값만 읽는다", () => {
  const result = readTransitionRefundRequestBody({
    refundRequestId: "  r-1  ",
    expectedCurrentStatus: "requested",
    targetStatus: "reviewing",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.body, {
    refundRequestId: "r-1",
    expectedCurrentStatus: "requested",
    targetStatus: "reviewing",
  });
});

test("실행자·시각·내부 값을 섞어 보내도 읽지 않는다", () => {
  const result = readTransitionRefundRequestBody({
    refundRequestId: "r-1",
    expectedCurrentStatus: "requested",
    targetStatus: "reviewing",
    // 아래는 모두 서버가 정하거나 저장 계층이 관리하는 값이다.
    handledBy: "사칭관리자",
    decidedAt: "2000-01-01T00:00:00.000Z",
    requestedAt: "2000-01-01T00:00:00.000Z",
    userId: "u-남의계정",
    status: "completed",
    productionStartedAtSnapshot: "2000-01-01T00:00:00.000Z",
    scheduledAtSnapshot: "2000-01-01T00:00:00.000Z",
    cancelWindowSnapshot: { kind: "normal-request", remainingMinutes: 99999 },
    cancelWindowPolicyVersion: "가짜버전",
    reason: "other",
    message: "내용",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(Object.keys(result.body).sort(), [
    "expectedCurrentStatus",
    "refundRequestId",
    "targetStatus",
  ]);
});

test("빈 refundRequestId는 거절한다", () => {
  for (const bad of [undefined, null, "", "   ", 123, {}]) {
    const result = readTransitionRefundRequestBody({
      refundRequestId: bad,
      expectedCurrentStatus: "requested",
      targetStatus: "reviewing",
    });
    assert.deepEqual(
      result,
      { ok: false, error: "환불 문의를 확인해 주세요.", status: 400 },
      String(bad),
    );
  }
});

test("저장할 수 없는 현재 상태는 거절한다", () => {
  for (const bad of [undefined, "", "REQUESTED", "refunded", "cancelled", 1]) {
    const result = readTransitionRefundRequestBody({
      refundRequestId: "r-1",
      expectedCurrentStatus: bad,
      targetStatus: "reviewing",
    });
    assert.deepEqual(
      result,
      { ok: false, error: "현재 상태를 확인해 주세요.", status: 400 },
      String(bad),
    );
  }
});

test("저장할 수 없는 목표 상태는 거절한다", () => {
  for (const bad of [undefined, "", "APPROVED", "refunded", 1]) {
    const result = readTransitionRefundRequestBody({
      refundRequestId: "r-1",
      expectedCurrentStatus: "requested",
      targetStatus: bad,
    });
    assert.deepEqual(
      result,
      { ok: false, error: "바꿀 상태를 확인해 주세요.", status: 400 },
      String(bad),
    );
  }
});

test("허용 여부는 여기서 판단하지 않고 저장 계층에 맡긴다", () => {
  // 규칙상 막히는 조합이라도 body 읽기 단계는 통과시킨다(규칙을 두 곳에 두지 않는다).
  const result = readTransitionRefundRequestBody({
    refundRequestId: "r-1",
    expectedCurrentStatus: "approved",
    targetStatus: "completed",
  });
  assert.equal(result.ok, true);
  // 그리고 그 조합은 전이 규칙에서 계속 거부된다(회귀 확인).
  assert.equal(isAllowedAdminTransition("approved", "completed"), false);
  assert.equal(isAllowedAdminTransition("requested", "approved"), false);
});

test("실패 사유를 관리자 문구와 상태 코드로 바꾼다", () => {
  assert.deepEqual(transitionFailureResponse("not-found"), {
    error: "환불 문의를 찾을 수 없습니다.",
    status: 404,
  });
  const stale = transitionFailureResponse("stale-status");
  assert.equal(stale.status, 409);
  // 새로고침 후 다시 판단하라는 뜻이 문구에 드러나야 한다.
  assert.equal(/새로고침/.test(stale.error), true);
  assert.deepEqual(transitionFailureResponse("invalid-transition"), {
    error: "지금 상태에서 할 수 없는 처리입니다.",
    status: 400,
  });
});

test("성공 응답에는 바뀐 결과 네 값만 담는다", () => {
  const stored: RefundRequest = {
    id: "r-1",
    orderId: "o-1",
    userId: "u-1",
    status: "approved",
    requestedAt: "2026-08-12T00:00:00.000Z",
    reason: "schedule",
    message: "내용",
    productionStartedAtSnapshot: "2026-08-10T00:00:00.000Z",
    scheduledAtSnapshot: "2026-08-12T01:00:00.000Z",
    cancelWindowSnapshot: { kind: "normal-request", remainingMinutes: 181 },
    cancelWindowPolicyVersion: "consult-cancel-window-3h-v1",
    decidedAt: "2026-09-17T00:00:00.000Z",
    handledBy: "admin",
  };
  const response = toTransitionRefundRequestResponse(stored);

  assert.deepEqual(response, {
    ok: true,
    refundRequest: {
      id: "r-1",
      status: "approved",
      decidedAt: "2026-09-17T00:00:00.000Z",
      handledBy: "admin",
    },
  });
  for (const hidden of [
    "orderId",
    "userId",
    "reason",
    "message",
    "requestedAt",
    "productionStartedAtSnapshot",
    "scheduledAtSnapshot",
    "cancelWindowSnapshot",
    "cancelWindowPolicyVersion",
  ]) {
    assert.equal(hidden in response.refundRequest, false, hidden);
  }
});

test("결론 시각이 없는 전이도 칸을 비워 돌려준다", () => {
  const stored: RefundRequest = {
    id: "r-2",
    orderId: "o-2",
    userId: "u-1",
    status: "reviewing",
    requestedAt: "2026-08-12T00:00:00.000Z",
    reason: "schedule",
    decidedAt: null,
    handledBy: "admin",
  };
  assert.deepEqual(toTransitionRefundRequestResponse(stored).refundRequest, {
    id: "r-2",
    status: "reviewing",
    decidedAt: null,
    handledBy: "admin",
  });
});

/* ── 환불 완료 건 진행 상태 잠금 (Refund-Completed-Progress-Lock-1) ── */

test("환불 완료 주문·상담의 진행 상태 변경은 409로 막는다", () => {
  const order = progressLockedByRefundResponse("order");
  const consultation = progressLockedByRefundResponse("consultation");
  assert.equal(order.status, 409);
  assert.equal(consultation.status, 409);
  assert.equal(order.error, "환불이 완료된 주문은 진행 상태를 변경할 수 없습니다.");
  assert.equal(consultation.error, "환불이 완료된 상담은 진행 상태를 변경할 수 없습니다.");
});

test("잠금 안내에 내부 사정을 담지 않는다", () => {
  for (const kind of ["order", "consultation"] as const) {
    const { error } = progressLockedByRefundResponse(kind);
    for (const leak of ["refund_request", "payment", "pgTid", "tid", "completed", "userId"]) {
      assert.equal(error.includes(leak), false, `${kind}:${leak}`);
    }
  }
});

test("잠금 문구가 제작 완료·상담 완료를 뜻하지 않는다", () => {
  // 환불 완료를 기존 "완료" 상태와 같은 말로 적지 않는다.
  const { error } = progressLockedByRefundResponse("order");
  assert.equal(error.includes("제작이 완료"), false);
  assert.equal(error.includes("완성"), false);
});
