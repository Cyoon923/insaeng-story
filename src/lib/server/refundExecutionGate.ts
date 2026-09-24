/**
 * 환불 실행 권한 확인 (Refund-Payment-Execution-Gate-1).
 *
 * 묻는 것은 하나다. "이 환불 문의가 지금 어떤 주문의 환불 실행 권한을 갖는가."
 * 답은 DB 사실로만 정한다. 호출자는 refundRequestId 하나만 준다.
 * orderId·userId·paymentId·tid·금액·상태를 바깥에서 받지 않는다. 받으면 그 값을
 * 고르는 쪽이 어떤 주문을 환불할지 정하게 된다.
 *
 * 하지 않는 일
 * - NICEPAY 호출(취소·조회) 0회. 관련 모듈을 import하지 않는다.
 * - 취소 실행/복구 orchestration 호출 0회.
 * - 어떤 쓰기도 하지 않는다. refund_requests·payments·orders 모두 읽기만 한다.
 * - 상태 backfill·정정·자동 재시도.
 * - route·UI 연결.
 *
 * 중요한 경계: 이 함수의 결과는 권한 토큰이 아니다.
 * 판정은 조회 시점의 snapshot이고, 그 뒤에 관리자가 상태를 바꾸거나 다른 실행이
 * 끼어들 수 있다. allowed를 받아 두었다는 이유로 나중에 취소를 실행해서는 안 된다.
 * 실제 실행 단계는 실행 직전에 approved 여부를 DB에서 다시 확인해야 하며, 최종
 * 안전장치는 이 gate가 아니라 실행·최종화 함수의 조건부 UPDATE다
 * (claimPaymentCancellation의 atomic claim, finalizeRefundPaymentCancel의 WHERE 조건).
 */
/**
 * 판정에 쓰는 사실 묶음. 한 번의 질의로 함께 읽은 값이라야 한다.
 *
 * 문의를 읽고 주문을 따로 읽고 활성 건수를 또 따로 세면, 그 사이에 달라진 상태를
 * 서로 다른 시점의 사실로 섞어 판단하게 된다.
 */
export interface RefundExecutionSnapshot {
  refundRequestId: string;
  status: string;
  /** refund_requests.order_id. 이 값이 실행 대상 주문을 정한다. */
  orderId: string;
  /** refund_requests.user_id. */
  requestUserId: string;
  /** 조인된 주문이 없으면 null. */
  orderUserId: string | null;
  /** 같은 주문의 requested/reviewing/approved 건수. */
  activeCount: number;
}

export type RefundExecutionGateResult =
  /** 이 문의가 이 주문의 환불을 실행할 수 있다. 지금 이 순간의 판단이다. */
  | { kind: "allowed"; refundRequestId: string; orderId: string; userId: string }
  /** 그런 환불 문의가 없다. */
  | { kind: "not-found" }
  /**
   * 승인 상태가 아니다.
   * requested·reviewing은 아직 결정 전이고, rejected·completed는 이미 끝난 건이다.
   * 특히 completed는 "이미 환불된 건"이라 다시 실행 대상이 되어서는 안 된다.
   */
  | { kind: "not-approved" }
  /** 문의는 있는데 연결된 주문을 찾을 수 없다. */
  | { kind: "order-not-found" }
  /** 문의의 회원과 주문의 회원이 다르다. 고치지 않고 사람이 확인한다. */
  | { kind: "ownership-mismatch" }
  /** 같은 주문에 활성 문의가 둘 이상이다. 하나를 골라 실행하지 않는다. */
  | { kind: "ambiguous-active-request" };

/**
 * 읽어 온 사실로 판정한다. DB도 네트워크도 건드리지 않는 순수 함수다.
 *
 * 순서대로 본다. 승인 여부 → 주문 존재 → 소유자 일치 → 활성 건수.
 * 하나라도 어긋나면 거기서 끝이고, 뒤 조건으로 덮어 통과시키지 않는다.
 */
export function decideRefundExecution(
  snapshot: RefundExecutionSnapshot | null,
): RefundExecutionGateResult {
  if (!snapshot) return { kind: "not-found" };
  // approved는 "관리자가 환불하기로 했고 아직 PG 취소가 끝나지 않은" 상태뿐이다.
  if (snapshot.status !== "approved") return { kind: "not-approved" };
  if (!snapshot.orderId.trim()) return { kind: "order-not-found" };
  if (snapshot.orderUserId === null) return { kind: "order-not-found" };
  if (!snapshot.requestUserId || snapshot.requestUserId !== snapshot.orderUserId) {
    return { kind: "ownership-mismatch" };
  }
  /*
   * 활성 문의는 정확히 1건이어야 한다. 부분 UNIQUE 인덱스가 막고 있지만, 인덱스가
   * 생기기 전에 저장된 행이 남아 있을 수 있어 여기서 다시 센다. 2건 이상이면
   * 어느 건이 진짜인지 모르는 상태이므로 실행 허가를 내지 않는다.
   */
  if (snapshot.activeCount !== 1) return { kind: "ambiguous-active-request" };

  return {
    kind: "allowed",
    refundRequestId: snapshot.refundRequestId,
    // 실행 대상 주문은 언제나 DB의 refund_requests.order_id다.
    orderId: snapshot.orderId,
    userId: snapshot.orderUserId,
  };
}

/**
 * 판정에 필요한 사실을 한 문장으로 읽는다.
 *
 * 주문은 LEFT JOIN으로 붙인다. 없으면 order-not-found로 답해야 하는데, INNER JOIN이면
 * "문의가 없음"과 구분되지 않는다. 활성 건수도 같은 문장 안에서 센다.
 *
 * 고객이 적은 글(message)·사유·PG 응답은 읽지 않는다. 판정에 필요 없고,
 * 오류 반환에 섞여 나갈 경로를 애초에 만들지 않는다.
 */
export async function loadRefundExecutionSnapshot(
  refundRequestId: string,
): Promise<RefundExecutionSnapshot | null> {
  /*
   * 저장·환불 문의 모듈은 여기서 필요할 때 읽는다. 그래야 위 판정 함수를 DB 없이
   * 그 자체로 확인할 수 있다.
   */
  const store = await import("@/lib/server/store");
  const refundRequests = await import("@/lib/server/refundRequests");
  const sql = store.sqlClient();
  if (!sql) {
    throw new Error("환불 실행 권한 확인은 DATABASE_URL이 설정된 환경에서만 가능합니다.");
  }
  // 활성 상태 목록은 refundRequests의 것을 그대로 쓴다. 두 곳에 적지 않는다.
  const activeStatusSql = refundRequests.ACTIVE_REFUND_REQUEST_STATUSES.map(
    (status) => `'${status}'`,
  ).join(", ");
  await store.ensureTable(sql);
  await refundRequests.ensureRefundRequests(sql);

  const rows = (await sql.query(
    `
      SELECT
        r.id            AS refund_request_id,
        r.status        AS status,
        r.order_id      AS order_id,
        r.user_id       AS request_user_id,
        o.user_id       AS order_user_id,
        (
          SELECT count(*) FROM refund_requests a
          WHERE a.order_id = r.order_id
            AND a.status IN (${activeStatusSql})
        ) AS active_count
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
    active_count: string | number;
  }[];

  const row = rows[0];
  if (!row) return null;
  return {
    refundRequestId: row.refund_request_id,
    status: row.status,
    orderId: row.order_id,
    requestUserId: row.request_user_id,
    orderUserId: row.order_user_id ?? null,
    activeCount: Number(row.active_count ?? 0),
  };
}

/**
 * 환불 문의 1건의 실행 권한을 확인한다.
 *
 * allowed만 실제 환불 실행 orchestration으로 넘어갈 수 있다. 그 결과를 들고 있다가
 * 나중에 쓰지 않는다(파일 맨 위 경계 참고).
 *
 * loadSnapshot은 테스트에서 사실을 흉내 내기 위한 자리다. 제품 코드에서는 넘기지 않는다.
 */
export async function authorizeRefundExecution(
  refundRequestId: string,
  loadSnapshot: (id: string) => Promise<RefundExecutionSnapshot | null> = loadRefundExecutionSnapshot,
): Promise<RefundExecutionGateResult> {
  const id = refundRequestId.trim();
  if (!id) return { kind: "not-found" };
  return decideRefundExecution(await loadSnapshot(id));
}
