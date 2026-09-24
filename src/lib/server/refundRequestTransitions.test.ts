/**
 * 관리자 상태 전이 규칙 테스트 (Refund-Request-Status-Machine-1).
 *
 * 실행: node --test src/lib/server/refundRequestTransitions.test.ts
 *
 * 실제 전이(CAS UPDATE·동시성·감사 열 저장)는 refundRequests.test.sql에서 본다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_REFUND_TRANSITIONS,
  decidedAtFor,
  isAllowedAdminTransition,
  isDecisionStatus,
} from "./refundRequestTransitions.ts";
import type { RefundRequestStatus } from "@/lib/types/app";

const ALL: RefundRequestStatus[] = [
  "requested",
  "reviewing",
  "approved",
  "rejected",
  "completed",
];

const ALLOWED: [RefundRequestStatus, RefundRequestStatus][] = [
  ["requested", "reviewing"],
  ["requested", "rejected"],
  ["reviewing", "approved"],
  ["reviewing", "rejected"],
];

test("허용된 관리자 전이는 네 가지뿐이다", () => {
  for (const [from, to] of ALLOWED) {
    assert.equal(isAllowedAdminTransition(from, to), true, `${from}->${to}`);
  }
  // 전체 조합 25가지 중 위 넷을 뺀 나머지는 모두 거부여야 한다.
  let allowedCount = 0;
  for (const from of ALL) {
    for (const to of ALL) {
      if (isAllowedAdminTransition(from, to)) allowedCount += 1;
    }
  }
  assert.equal(allowedCount, ALLOWED.length);
});

test("검토를 건너뛴 승인은 막는다", () => {
  assert.equal(isAllowedAdminTransition("requested", "approved"), false);
});

test("승인 뒤에는 되돌릴 수 없다", () => {
  for (const to of ALL) {
    assert.equal(isAllowedAdminTransition("approved", to), false, `approved->${to}`);
  }
  // approved → completed도 관리자 전이가 아니다(PG 성공 경로에서만 일어난다).
  assert.equal(isAllowedAdminTransition("approved", "completed"), false);
});

test("끝난 상태에서는 어디로도 갈 수 없다", () => {
  for (const from of ["rejected", "completed"] as RefundRequestStatus[]) {
    for (const to of ALL) {
      assert.equal(isAllowedAdminTransition(from, to), false, `${from}->${to}`);
    }
  }
});

test("같은 상태로 다시 가는 전이는 없다", () => {
  for (const status of ALL) {
    assert.equal(isAllowedAdminTransition(status, status), false, status);
  }
});

test("결론이 난 전이에서만 시각을 남긴다", () => {
  const now = new Date("2026-09-17T00:00:00.000Z");
  assert.equal(isDecisionStatus("approved"), true);
  assert.equal(isDecisionStatus("rejected"), true);
  assert.equal(isDecisionStatus("reviewing"), false);

  assert.equal(decidedAtFor("approved", now), "2026-09-17T00:00:00.000Z");
  assert.equal(decidedAtFor("rejected", now), "2026-09-17T00:00:00.000Z");
  // 검토 시작은 결론이 아니므로 시각을 만들지 않는다.
  assert.equal(decidedAtFor("reviewing", now), null);
});

test("전이표는 다섯 상태를 모두 담고 있다", () => {
  assert.deepEqual(Object.keys(ADMIN_REFUND_TRANSITIONS).sort(), [...ALL].sort());
});
