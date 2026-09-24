/**
 * 적립금 복원 재시도 권한 확인 테스트 (Refund-Points-Restore-Recovery-Entrypoint-1).
 *
 * 실행: node --test src/lib/server/pointsRestoreRecoveryGate.test.ts
 *
 * DB를 부르지 않는다. 판정 함수는 순수 함수이고, 권한 함수에는 사실을 흉내 낸
 * loadSnapshot을 끼워 넣는다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizePointsRestoreRecovery,
  decidePointsRestoreRecovery,
} from "./pointsRestoreRecoveryGate.ts";
import type { PointsRestoreRecoverySnapshot } from "./pointsRestoreRecoveryGate.ts";

const REFUND_REQUEST_ID = "rr-1";
const ORDER_ID = "o-1";
const USER_ID = "u-1";

function snapshot(
  overrides: Partial<PointsRestoreRecoverySnapshot> = {},
): PointsRestoreRecoverySnapshot {
  return {
    refundRequestId: REFUND_REQUEST_ID,
    status: "completed",
    orderId: ORDER_ID,
    requestUserId: USER_ID,
    orderUserId: USER_ID,
    ...overrides,
  };
}

/* ── 통과 ───────────────────────────────────────────── */

test("completed + 주문 존재 + 소유자 일치 → authorized", () => {
  assert.deepEqual(decidePointsRestoreRecovery(snapshot()), {
    kind: "authorized",
    refundRequestId: REFUND_REQUEST_ID,
    orderId: ORDER_ID,
  });
});

test("복원 대상 주문은 언제나 DB의 order_id다", () => {
  const result = decidePointsRestoreRecovery(snapshot({ orderId: "o-다른주문" }));
  assert.equal(result.kind, "authorized");
  if (result.kind !== "authorized") return;
  /*
   * 판정 함수는 주문 id를 바깥에서 받지 않는다. 인자가 snapshot 하나뿐이라
   * 클라이언트가 다른 주문을 끼워 넣을 자리 자체가 없다.
   */
  assert.equal(result.orderId, "o-다른주문");
});

/* ── 차단 ───────────────────────────────────────────── */

test("문의가 없으면 not-found", () => {
  assert.deepEqual(decidePointsRestoreRecovery(null), { kind: "not-found" });
});

test("completed가 아닌 모든 상태를 막는다", () => {
  for (const status of ["requested", "reviewing", "approved", "rejected"]) {
    assert.deepEqual(
      decidePointsRestoreRecovery(snapshot({ status })),
      { kind: "not-completed" },
      status,
    );
  }
});

test("알 수 없는 상태도 막는다", () => {
  for (const status of ["", "COMPLETED", "완료", "done"]) {
    assert.deepEqual(
      decidePointsRestoreRecovery(snapshot({ status })),
      { kind: "not-completed" },
      JSON.stringify(status),
    );
  }
});

test("주문을 찾을 수 없으면 order-not-found", () => {
  assert.deepEqual(decidePointsRestoreRecovery(snapshot({ orderUserId: null })), {
    kind: "order-not-found",
  });
  assert.deepEqual(decidePointsRestoreRecovery(snapshot({ orderId: "" })), {
    kind: "order-not-found",
  });
  assert.deepEqual(decidePointsRestoreRecovery(snapshot({ orderId: "   " })), {
    kind: "order-not-found",
  });
});

test("문의와 주문의 회원이 다르면 ownership-mismatch", () => {
  assert.deepEqual(decidePointsRestoreRecovery(snapshot({ orderUserId: "u-다른회원" })), {
    kind: "ownership-mismatch",
  });
  assert.deepEqual(decidePointsRestoreRecovery(snapshot({ requestUserId: "" })), {
    kind: "ownership-mismatch",
  });
});

test("앞 조건이 어긋나면 뒤 조건으로 덮어 통과시키지 않는다", () => {
  // 상태도 아니고 소유자도 어긋난 경우. 먼저 걸린 사유가 나온다.
  assert.deepEqual(
    decidePointsRestoreRecovery(snapshot({ status: "approved", orderUserId: "u-다른회원" })),
    { kind: "not-completed" },
  );
});

/* ── 권한 함수 ──────────────────────────────────────── */

test("빈 id는 조회하지 않고 not-found", async () => {
  let called = 0;
  const result = await authorizePointsRestoreRecovery("   ", async () => {
    called += 1;
    return snapshot();
  });
  assert.deepEqual(result, { kind: "not-found" });
  assert.equal(called, 0);
});

test("id의 앞뒤 공백을 다듬어 조회한다", async () => {
  const ids: string[] = [];
  const result = await authorizePointsRestoreRecovery(`  ${REFUND_REQUEST_ID}  `, async (id) => {
    ids.push(id);
    return snapshot();
  });
  assert.deepEqual(ids, [REFUND_REQUEST_ID]);
  assert.equal(result.kind, "authorized");
});

test("조회 결과를 그대로 판정에 넘긴다", async () => {
  const result = await authorizePointsRestoreRecovery(REFUND_REQUEST_ID, async () =>
    snapshot({ status: "approved" }),
  );
  assert.deepEqual(result, { kind: "not-completed" });
});
