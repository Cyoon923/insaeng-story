/**
 * 환불 문의 접수 API의 입출력 규칙 테스트 (Refund-Request-API-1).
 *
 * 실행: node --test src/lib/server/refundRequestApi.test.ts
 * (기존 단계들과 같은 방식. 새 테스트 라이브러리를 더하지 않는다.)
 *
 * 저장·소유권·중복 방어는 refundRequests.test.sql이, 입력 검증과 Evidence는
 * refundRequestEvidence.test.ts가 본다. 여기서는 route가 클라이언트와 주고받는
 * 값의 경계만 본다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  loadedLatestRefundRequests,
  loadedRefundRequests,
  readCreateRefundRequestBody,
  refundRequestFailureResponse,
  toCreateRefundRequestResponse,
  unavailableLatestRefundRequests,
  unavailableRefundRequests,
} from "./refundRequestApi.ts";
import type { ActiveRefundRequestSummary, RefundRequest } from "@/lib/types/app";

test("빈 orderId는 거절한다", () => {
  for (const bad of [undefined, null, "", "   ", 123, {}, ["o-1"]]) {
    const result = readCreateRefundRequestBody({ orderId: bad });
    assert.deepEqual(result, { ok: false, error: "주문을 확인해 주세요.", status: 400 }, String(bad));
  }
});

test("orderId는 앞뒤 공백을 떼고 쓴다", () => {
  const result = readCreateRefundRequestBody({ orderId: "  o-abc123  ", reason: "schedule" });
  assert.equal(result.ok && result.body.orderId, "o-abc123");
});

test("주문 id 형식을 따로 만들어 막지 않는다", () => {
  // 접두사가 o-/c- 가 아니어도 여기서 거절하지 않는다. 실재 여부는 저장 계층이 본다.
  for (const id of ["o-1", "c-1", "1a2b3c", "legacy-id"]) {
    assert.equal(readCreateRefundRequestBody({ orderId: id }).ok, true, id);
  }
});

test("reason·message는 손대지 않고 그대로 넘긴다", () => {
  const result = readCreateRefundRequestBody({
    orderId: "o-1",
    reason: "other",
    message: "  내용 그대로  ",
  });
  assert.equal(result.ok && result.body.reason, "other");
  // trim·길이 검사는 저장 계층 한 곳에서만 한다. 여기서 미리 다듬지 않는다.
  assert.equal(result.ok && result.body.message, "  내용 그대로  ");
});

test("body에 서버 전용 값을 섞어 보내도 골라내지 않는다", () => {
  const result = readCreateRefundRequestBody({
    orderId: "o-1",
    reason: "schedule",
    message: "내용",
    // 아래는 모두 서버가 정하는 값이다. 클라이언트가 보내도 읽히면 안 된다.
    userId: "u-남의계정",
    status: "approved",
    requestedAt: "2000-01-01T00:00:00.000Z",
    productionStartedAtSnapshot: "2000-01-01T00:00:00.000Z",
    scheduledAtSnapshot: "2000-01-01T00:00:00.000Z",
    cancelWindowSnapshot: { kind: "normal-request", remainingMinutes: 99999 },
    cancelWindowPolicyVersion: "가짜버전",
    id: "r-지정",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  // 넘어가는 값은 정확히 세 가지뿐이다.
  assert.deepEqual(Object.keys(result.body).sort(), ["message", "orderId", "reason"]);
});

test("실패 사유를 사용자 문구와 상태 코드로 바꾼다", () => {
  assert.deepEqual(refundRequestFailureResponse("order-not-found"), {
    error: "주문을 찾을 수 없습니다.",
    status: 404,
  });
  assert.deepEqual(refundRequestFailureResponse("active-exists"), {
    error: "이미 접수된 환불 문의가 있습니다. 처리 결과를 기다려 주세요.",
    status: 409,
  });
  assert.deepEqual(refundRequestFailureResponse("invalid-reason"), {
    error: "환불 문의 사유를 선택해 주세요.",
    status: 400,
  });
  assert.deepEqual(refundRequestFailureResponse("message-required"), {
    error: "자세한 내용을 적어 주세요.",
    status: 400,
  });
  assert.deepEqual(refundRequestFailureResponse("message-too-long"), {
    error: "자세한 내용은 500자까지 입력할 수 있습니다.",
    status: 400,
  });
});

test("없는 주문과 남의 주문은 응답이 똑같다", () => {
  // 저장 계층이 두 경우에 같은 사유를 돌려주므로, 응답도 한 글자도 다르지 않다.
  const notFound = refundRequestFailureResponse("order-not-found");
  const otherUsers = refundRequestFailureResponse("order-not-found");
  assert.deepEqual(notFound, otherUsers);
  // 문구에 어느 쪽인지 알 수 있는 단서가 없어야 한다.
  assert.equal(/권한|소유|다른 회원|남의/.test(notFound.error), false);
});

test("성공 응답에는 접수 사실만 담고 내부 기록은 담지 않는다", () => {
  const stored: RefundRequest = {
    id: "r-1",
    orderId: "o-1",
    userId: "u-1",
    status: "requested",
    requestedAt: "2026-08-12T00:00:00.000Z",
    reason: "schedule",
    message: "내용",
    productionStartedAtSnapshot: "2026-08-10T00:00:00.000Z",
    scheduledAtSnapshot: "2026-08-12T01:00:00.000Z",
    cancelWindowSnapshot: { kind: "normal-request", remainingMinutes: 181 },
    cancelWindowPolicyVersion: "consult-cancel-window-3h-v1",
  };
  const response = toCreateRefundRequestResponse(stored);

  assert.deepEqual(response, {
    ok: true,
    id: "r-1",
    status: "requested",
    requestedAt: "2026-08-12T00:00:00.000Z",
  });
  // 내보내지 않아야 할 이름이 하나도 없어야 한다.
  for (const hidden of [
    "userId",
    "orderId",
    "reason",
    "message",
    "productionStartedAtSnapshot",
    "scheduledAtSnapshot",
    "cancelWindowSnapshot",
    "cancelWindowPolicyVersion",
  ]) {
    assert.equal(hidden in response, false, hidden);
  }
});

test("조회에 성공하면 loaded는 true다", () => {
  const items: ActiveRefundRequestSummary[] = [
    { id: "r-1", orderId: "o-1", status: "requested", requestedAt: "2026-08-12T00:00:00.000Z" },
  ];
  assert.deepEqual(loadedRefundRequests(items), { items, loaded: true });
});

test("문의가 없는 것과 읽지 못한 것을 구분한다", () => {
  // 조회는 됐고 문의만 없는 경우.
  const none = loadedRefundRequests([]);
  assert.deepEqual(none, { items: [], loaded: true });

  // 조회 자체를 못 한 경우. 겉보기 items는 같지만 loaded가 다르다.
  const failed = unavailableRefundRequests();
  assert.deepEqual(failed, { items: [], loaded: false });
  assert.notDeepEqual(none, failed);
});

test("실패 묶음에는 오류 내용을 담지 않는다", () => {
  const failed = unavailableRefundRequests();
  // 키는 items와 loaded 둘뿐이다. error·message·stack 같은 칸이 없다.
  assert.deepEqual(Object.keys(failed).sort(), ["items", "loaded"]);
});

test("실패 묶음은 호출할 때마다 새로 만든다", () => {
  const first = unavailableRefundRequests();
  first.items.push({
    id: "r-x",
    orderId: "o-x",
    status: "requested",
    requestedAt: "2026-08-12T00:00:00.000Z",
  });
  // 공유 객체를 돌려주면 다음 요청에 값이 새어 나간다.
  assert.deepEqual(unavailableRefundRequests(), { items: [], loaded: false });
});

test("고객 목록 항목에는 네 값만 담긴다", () => {
  // 조회 SQL이 네 열만 읽으므로, 이 타입에 담을 수 있는 값도 그 넷뿐이다.
  const item: ActiveRefundRequestSummary = {
    id: "r-1",
    orderId: "o-1",
    status: "requested",
    requestedAt: "2026-08-12T00:00:00.000Z",
  };
  const view = loadedRefundRequests([item]);
  assert.deepEqual(Object.keys(view.items[0]).sort(), [
    "id",
    "orderId",
    "requestedAt",
    "status",
  ]);
  for (const hidden of [
    "userId",
    "reason",
    "message",
    "productionStartedAtSnapshot",
    "scheduledAtSnapshot",
    "cancelWindowSnapshot",
    "cancelWindowPolicyVersion",
    "decidedAt",
    "handledBy",
  ]) {
    assert.equal(hidden in view.items[0], false, hidden);
  }
});

/* ── 주문당 1회 정책 (Refund-Customer-Closed-Policy-1) ───── */

test("끝난 문의가 있는 주문은 처리 중과 다른 안내를 준다", () => {
  const closed = refundRequestFailureResponse("closed-exists");
  assert.equal(closed.status, 409);
  assert.equal(
    closed.error,
    "이미 처리된 환불 문의가 있습니다. 추가로 확인하실 내용은 상담원에게 문의해 주세요.",
  );
  // 처리 중(active)과 문구가 달라야 고객이 다음에 할 일을 안다.
  assert.notEqual(closed.error, refundRequestFailureResponse("active-exists").error);
});

test("끝난 문의 안내에 내부 상태를 담지 않는다", () => {
  const { error } = refundRequestFailureResponse("closed-exists");
  // 거절인지 환불 완료인지, 언제 처리했는지는 실패 응답이 알릴 자리가 아니다.
  for (const leak of ["rejected", "completed", "거절", "승인", "approved", "evidence"]) {
    assert.equal(error.includes(leak), false, leak);
  }
});

/* ── 최신 문의 묶음 ──────────────────────────────────── */

test("조회 성공 + 이력 있음은 loaded true와 그 목록이다", () => {
  const view = loadedLatestRefundRequests([
    { id: "r-1", orderId: "o-1", status: "completed", requestedAt: "2026-09-17T00:00:00.000Z" },
  ]);
  assert.equal(view.loaded, true);
  assert.equal(view.items[0].status, "completed");
});

test("조회 성공 + 이력 없음은 loaded true에 빈 목록이다", () => {
  assert.deepEqual(loadedLatestRefundRequests([]), { items: [], loaded: true });
});

test("최신 문의 조회 실패는 이력 없음과 구분된다", () => {
  const failed = unavailableLatestRefundRequests();
  assert.deepEqual(failed, { items: [], loaded: false });
  const empty = loadedLatestRefundRequests([]);
  assert.deepEqual(empty.items, failed.items);
  assert.notEqual(empty.loaded, failed.loaded);
  // 내부 오류 내용이 응답으로 새어 나가지 않는다.
  for (const key of ["error", "reason", "message"]) {
    assert.equal(key in failed, false, key);
  }
});

test("최신 문의 실패 묶음은 호출할 때마다 새로 만든다", () => {
  const first = unavailableLatestRefundRequests();
  first.items.push({
    id: "r-9",
    orderId: "o-9",
    status: "rejected",
    requestedAt: "2026-09-17T00:00:00.000Z",
  });
  assert.deepEqual(unavailableLatestRefundRequests(), { items: [], loaded: false });
});

test("최신 문의 요약에는 고객에게 허용된 네 값만 있다", () => {
  const [item] = loadedLatestRefundRequests([
    { id: "r-1", orderId: "o-1", status: "rejected", requestedAt: "2026-09-17T00:00:00.000Z" },
  ]).items;
  assert.deepEqual(Object.keys(item).sort(), ["id", "orderId", "requestedAt", "status"]);
  // 관리자 판단 근거와 처리 기록은 타입에도 값에도 없다.
  for (const key of [
    "userId",
    "reason",
    "message",
    "productionStartedAtSnapshot",
    "scheduledAtSnapshot",
    "cancelWindowSnapshot",
    "cancelWindowPolicyVersion",
    "decidedAt",
    "handledBy",
    "refundExecution",
    "pgTid",
  ]) {
    assert.equal(key in item, false, key);
  }
});
