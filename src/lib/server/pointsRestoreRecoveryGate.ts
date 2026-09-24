/**
 * 적립금 복원 재시도 권한 확인 (Refund-Points-Restore-Recovery-Entrypoint-1).
 *
 * 묻는 것은 하나다. "이 환불 문의는 환불이 끝난 건인가, 그리고 어느 주문인가."
 * 답은 DB 사실로만 정한다. 호출자는 refundRequestId 하나만 준다.
 * orderId·userId·paymentId·금액·적립금을 바깥에서 받지 않는다. 받으면 그 값을
 * 고르는 쪽이 누구에게 적립금을 돌려줄지 정하게 된다.
 *
 * 왜 refundExecutionGate를 쓰지 않는가 — 저쪽과 묻는 것이 정반대다.
 * authorizeRefundExecution은 "아직 환불하지 않은 건(approved)"만 통과시킨다.
 * completed는 "이미 환불된 건이라 다시 실행 대상이 되어서는 안 된다"는 이유로
 * 일부러 막혀 있고, 그 규칙은 PG 재취소를 막는 안전장치다. 여기서 쓰려고 그 문을
 * 열면 그 안전장치가 느슨해진다. 그래서 저 파일을 건드리지 않고 따로 둔다.
 *
 * 활성 문의 건수(activeCount)도 보지 않는다. 이 동작은 PG를 부르지 않아 실행권
 * 경쟁이 없고, 중복 복원은 원장의 UNIQUE (order_id, type)가 막는다. 같은 주문에
 * completed 문의가 여럿인 옛 자료가 있어도 복원은 주문당 1회로 수렴한다.
 *
 * 하지 않는 일
 * - NICEPAY 호출 0회. 관련 모듈을 import하지 않는다.
 * - 어떤 쓰기도 하지 않는다. refund_requests·orders 모두 읽기만 한다.
 * - 적립금 금액 판정. 그것은 decidePointsRestore의 몫이고 여기서 복제하지 않는다.
 *
 * 중요한 경계: 이 함수의 결과는 권한 토큰이 아니다. 조회 시점의 snapshot이다.
 * 최종 안전장치는 이 판정이 아니라 store.restoreOrderPointsOnce의 한 문장
 * (주문 행에서 user_id를 다시 읽는 조건과 원장 UNIQUE)이다.
 */

/**
 * 판정에 쓰는 사실 묶음. 한 번의 질의로 함께 읽은 값이라야 한다.
 *
 * 문의를 읽고 주문을 따로 읽으면 그 사이에 달라진 상태를 서로 다른 시점의 사실로
 * 섞어 판단하게 된다. 기존 gate가 한 문장으로 읽는 것과 같은 이유다.
 */
export interface PointsRestoreRecoverySnapshot {
  refundRequestId: string;
  status: string;
  /** refund_requests.order_id. 이 값이 복원 대상 주문을 정한다. */
  orderId: string;
  /** refund_requests.user_id. */
  requestUserId: string;
  /** 조인된 주문이 없으면 null. */
  orderUserId: string | null;
}

export type PointsRestoreRecoveryGateResult =
  /** 환불이 끝난 건이고, 이 주문의 적립금 복원을 시도할 수 있다. */
  | { kind: "authorized"; refundRequestId: string; orderId: string }
  /** 그런 환불 문의가 없다. */
  | { kind: "not-found" }
  /**
   * 환불이 끝난 건이 아니다.
   * requested·reviewing은 아직 결정 전, rejected는 환불 자체가 없었던 건이다.
   * approved도 여기서 막힌다. 아직 PG 취소가 끝나지 않았는데 적립금을 먼저
   * 돌려주면, 환불이 끝내 실패했을 때 돌려준 적립금을 회수할 방법이 없다.
   */
  | { kind: "not-completed" }
  /** 문의는 있는데 연결된 주문을 찾을 수 없다. */
  | { kind: "order-not-found" }
  /** 문의의 회원과 주문의 회원이 다르다. 고치지 않고 사람이 확인한다. */
  | { kind: "ownership-mismatch" };

/**
 * 읽어 온 사실로 판정한다. DB도 네트워크도 건드리지 않는 순수 함수다.
 *
 * 순서대로 본다. 존재 → 완료 여부 → 주문 존재 → 소유자 일치.
 * 하나라도 어긋나면 거기서 끝이고, 뒤 조건으로 덮어 통과시키지 않는다(fail-closed).
 */
export function decidePointsRestoreRecovery(
  snapshot: PointsRestoreRecoverySnapshot | null,
): PointsRestoreRecoveryGateResult {
  if (!snapshot) return { kind: "not-found" };
  // completed만 통과한다. 환불이 끝났다는 사실이 복원의 유일한 전제다.
  if (snapshot.status !== "completed") return { kind: "not-completed" };
  if (!snapshot.orderId.trim()) return { kind: "order-not-found" };
  if (snapshot.orderUserId === null) return { kind: "order-not-found" };
  if (!snapshot.requestUserId || snapshot.requestUserId !== snapshot.orderUserId) {
    return { kind: "ownership-mismatch" };
  }

  return {
    kind: "authorized",
    refundRequestId: snapshot.refundRequestId,
    // 복원 대상 주문은 언제나 DB의 refund_requests.order_id다. 요청값이 아니다.
    orderId: snapshot.orderId,
  };
}

/**
 * 판정에 필요한 사실을 한 문장으로 읽는다.
 *
 * 주문은 LEFT JOIN으로 붙인다. 없으면 order-not-found로 답해야 하는데, INNER JOIN이면
 * "문의가 없음"과 구분되지 않는다.
 *
 * 고객이 적은 글(message)·사유·PG 응답·금액은 읽지 않는다. 판정에 필요 없고,
 * 오류 반환에 섞여 나갈 경로를 애초에 만들지 않는다.
 */
export async function loadPointsRestoreRecoverySnapshot(
  refundRequestId: string,
): Promise<PointsRestoreRecoverySnapshot | null> {
  /*
   * 저장·환불 문의 모듈은 여기서 필요할 때 읽는다. 그래야 위 판정 함수를 DB 없이
   * 그 자체로 확인할 수 있다(기존 gate와 같은 방식).
   */
  const store = await import("@/lib/server/store");
  const refundRequests = await import("@/lib/server/refundRequests");
  const sql = store.sqlClient();
  if (!sql) {
    throw new Error("적립금 복원 권한 확인은 DATABASE_URL이 설정된 환경에서만 가능합니다.");
  }
  await store.ensureTable(sql);
  await refundRequests.ensureRefundRequests(sql);

  const rows = (await sql.query(
    `
      SELECT
        r.id       AS refund_request_id,
        r.status   AS status,
        r.order_id AS order_id,
        r.user_id  AS request_user_id,
        o.user_id  AS order_user_id
      FROM refund_requests r
      LEFT JOIN orders o ON o.id = r.order_id
      WHERE r.id = $1
    `,
    [refundRequestId],
  )) as {
    refund_request_id: string;
    status: string;
    order_id: string;
    request_user_id: string;
    order_user_id: string | null;
  }[];

  const row = rows[0];
  if (!row) return null;
  return {
    refundRequestId: row.refund_request_id,
    status: row.status,
    orderId: row.order_id,
    requestUserId: row.request_user_id,
    orderUserId: row.order_user_id ?? null,
  };
}

/**
 * 환불 문의 1건의 적립금 복원 재시도 권한을 확인한다.
 *
 * authorized만 실제 복원 흐름으로 넘어갈 수 있다.
 *
 * loadSnapshot은 테스트에서 사실을 흉내 내기 위한 자리다. 제품 코드에서는 넘기지 않는다.
 */
export async function authorizePointsRestoreRecovery(
  refundRequestId: string,
  loadSnapshot: (
    id: string,
  ) => Promise<PointsRestoreRecoverySnapshot | null> = loadPointsRestoreRecoverySnapshot,
): Promise<PointsRestoreRecoveryGateResult> {
  const id = refundRequestId.trim();
  if (!id) return { kind: "not-found" };
  return decidePointsRestoreRecovery(await loadSnapshot(id));
}
