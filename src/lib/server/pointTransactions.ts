/**
 * 적립금 원장 기반 (Refund-Points-Ledger-Foundation-1).
 *
 * 지금 이 파일이 하는 일은 두 가지뿐이다. 테이블을 보장하고, 이미 복원했는지 읽는다.
 * **적립금을 늘리거나 원장에 쓰지 않는다.**
 *
 * 왜 아직 쓰지 않는가
 * - 실제 잔액(User.points)은 app_store JSONB 안에 있고, 원장은 PostgreSQL 테이블이다.
 *   둘은 한 문장으로 함께 써야 "원장만 남고 잔액은 그대로" 같은 어긋남이 생기지 않는다.
 *   그 한 문장(잔액 갱신 + 원장 기록)은 복원 기능을 만들 때 store.ts에서 함께 만든다.
 *   여기서 원장에만 먼저 쓸 수 있게 열어 두면, 돌려주지도 않은 적립금이 원장에 남는다.
 *
 * 왜 원장이 필요한가
 * - User.points는 잔액 하나뿐이라 "이미 복원했는지"를 알 방법이 없다. 두 번 더하면
 *   두 번 늘어난다. 원장 행의 존재 자체가 그 사실이 되고, UNIQUE 제약이 두 번째를 막는다.
 *
 * 이 파일은 기존 테이블의 뜻을 바꾸지 않는다. 옛 자료를 소급해 채우지도 않는다
 * (backfill 없음). 원장에 없는 과거 주문은 "복원한 적 없음"이 아니라 "이 구조가
 * 생기기 전"이며, 자동 복원 여부는 별도 판정(pointsRestoreDecision)이 따로 정한다.
 */
import { ensureTable, sqlClient } from "@/lib/server/store";

/**
 * 지금 쓸 수 있는 유일한 거래 유형.
 *
 * 환불이 확정된 주문의 사용 적립금을 돌려주는 기록이다. 적립·차감·관리자 가감 같은
 * 다른 유형은 필요해질 때 더한다. 값을 미리 만들어 두지 않는다.
 */
export const POINT_TRANSACTION_TYPES = ["refund-restore"] as const;
export type PointTransactionType = (typeof POINT_TRANSACTION_TYPES)[number];

const TYPE_SQL = POINT_TRANSACTION_TYPES.map((type) => `'${type}'`).join(", ");

/** 적립금은 DATABASE_URL이 있는 환경에서만 다룬다. 결제·환불 기록과 같은 규칙이다. */
function pointsClient() {
  const sql = sqlClient();
  if (!sql) {
    throw new Error("적립금 원장은 DATABASE_URL이 설정된 환경에서만 다룰 수 있습니다.");
  }
  return sql;
}

/**
 * point_transactions 테이블을 보장한다. 여러 번 실행해도 안전하다.
 *
 * orders를 참조하므로 호출부는 반드시 ensureTable(orders 생성)을 먼저 지나야 한다.
 * 기존 ensure* 들과 같은 방식으로 서버 인스턴스당 한 번만 실행하고,
 * 실패하면 기억을 지워 다음 요청이 다시 시도한다.
 *
 * 회원별 인덱스를 두지 않는 이유
 * - 지금 이 표를 읽는 질의는 전부 (order_id, type) 조건이다. 쓰지 않는 인덱스는
 *   쓰기마다 비용만 들고, 회원 식별자를 남겨 둘 이유가 되어 버린다.
 *   회원별 적립금 내역이 필요해지면 그때 orders를 이어 붙여 만든다.
 *
 * 제약을 코드가 아니라 DB에 두는 이유
 * - UNIQUE (order_id, type) : "한 주문의 환불 복원은 한 번뿐"을 마지막에 DB가 막는다.
 *   동시에 두 요청이 들어와도 두 번째 INSERT가 여기서 걸린다.
 * - CHECK (amount > 0)      : 돌려줄 것이 없는 기록을 남기지 않는다. 0·음수는 애초에
 *   복원 대상이 아니며(pointsRestoreDecision), 그 판단이 뚫려도 여기서 막힌다.
 * - type CHECK              : 지어낸 유형이 저장되지 않게 한다. 위 목록과 같은 값이다.
 */
async function runPointTransactionsMigration(sql: NonNullable<ReturnType<typeof sqlClient>>) {
  await sql.transaction((txn) => [
    txn.query(`
      CREATE TABLE IF NOT EXISTS point_transactions (
        id TEXT PRIMARY KEY,
        /*
         * 회원 식별자는 두지 않는다 (Privacy-PointTransactions-Minimization-1).
         *
         * 이 원장이 하는 일은 "이 주문의 환불 복원이 이미 있는가"를 말하는 것뿐이고,
         * 그 판정도 중복 방지도 (order_id, type) 하나로 끝난다. 회원은 order_id로
         * orders를 짚으면 언제나 같은 값이 나오므로, 같은 식별자를 한 벌 더 두면
         * 지울 곳만 늘고 두 값이 갈라질 자리가 생긴다.
         * 소유자 확인은 기록할 때 orders 행과 맞춰 보는 조건이 그대로 한다
         * (store.ts restoreOrderPointsOnce의 o.user_id = $n 조건).
         */
        order_id TEXT NOT NULL REFERENCES orders(id),
        type TEXT NOT NULL,
        -- 돌려준 적립금. 원 단위 양의 정수만 들어간다.
        amount INTEGER NOT NULL,
        -- 어느 환불 문의에서 비롯됐는지. 추적용이며 멱등 키는 아래 UNIQUE가 맡는다.
        refund_request_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT point_transactions_amount_check CHECK (amount > 0),
        CONSTRAINT point_transactions_type_check CHECK (type IN (${TYPE_SQL}))
      )
    `),
    // 한 주문의 같은 유형 거래를 1건으로 묶는 최종 방어선.
    txn.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS point_transactions_order_type_key
        ON point_transactions (order_id, type)
    `),
  ]);
}

let pointTransactionsMigration: Promise<void> | null = null;

/** 다른 저장 함수(앞으로 만들 복원 함수)도 이 테이블을 쓰므로 밖에서 부를 수 있게 둔다. */
export function ensurePointTransactions(
  sql: NonNullable<ReturnType<typeof sqlClient>>,
): Promise<void> {
  if (!pointTransactionsMigration) {
    pointTransactionsMigration = runPointTransactionsMigration(sql).catch((error) => {
      pointTransactionsMigration = null;
      throw error;
    });
  }
  return pointTransactionsMigration;
}

/**
 * 이 주문의 환불 복원 기록이 이미 있는지.
 *
 * 읽기만 한다. 이 조회는 판단의 근거일 뿐 최종 관문이 아니다. 조회와 기록 사이에
 * 다른 요청이 끼어들 수 있으므로, 중복을 실제로 막는 것은 UNIQUE 제약이다.
 */
export async function hasRefundRestoreForOrder(orderId: string): Promise<boolean> {
  const id = orderId.trim();
  if (!id) return false;
  const sql = pointsClient();
  await ensureTable(sql);
  await ensurePointTransactions(sql);
  const rows = (await sql.query(
    `SELECT 1 FROM point_transactions WHERE order_id = $1 AND type = 'refund-restore' LIMIT 1`,
    [id],
  )) as unknown[];
  return rows.length > 0;
}

/**
 * 여러 주문의 환불 복원 기록 유무를 한 번에 읽는다 (관리자 목록 표시용, 읽기 전용)
 * (Refund-Points-Restore-Admin-UI-1).
 *
 * 주문마다 hasRefundRestoreForOrder를 부르면 목록 길이만큼 질의가 늘어난다.
 * 목록 화면이 쓰는 조회라 주문 id를 한 번에 받아 질의 1회로 끝낸다
 * (store.listPaidPaymentsByOrderIds와 같은 방식이다).
 *
 * 돌려주는 것은 **원장 행이 있는 주문 id의 집합**뿐이다. 금액도 시각도 읽지 않는다.
 * 목록 화면에 필요한 사실이 "기록이 있는가" 하나뿐이기 때문이다.
 *
 * ★ 없다는 것이 "복원이 필요하다"는 뜻이 아니다.
 * 적립금을 쓰지 않은 주문, 이 구조가 생기기 전의 주문도 똑같이 기록이 없다.
 * 그 구분은 여기서 하지 않는다. pointsUsed·evidence 판정을 이 질의에 넣으면
 * decidePointsRestore를 SQL로 복제하게 되고, 두 규칙이 갈라질 자리가 생긴다.
 * 실제 대상 여부는 관리자가 복원을 눌렀을 때 runRefundPointsRestore가 정한다.
 *
 * DATABASE_URL이 없는 환경에서는 원장 자체가 없으므로 빈 집합이다
 * (다른 목록 조회들과 같은 규칙이며, 없는 기록을 있다고 가정하지 않는다).
 */
export async function listRefundRestoredOrderIds(orderIds: string[]): Promise<Set<string>> {
  const restored = new Set<string>();
  const ids = Array.from(new Set(orderIds.map((id) => id.trim()).filter((id) => id !== "")));
  if (ids.length === 0) return restored;
  const sql = sqlClient();
  if (!sql) return restored;
  await ensureTable(sql);
  await ensurePointTransactions(sql);
  const rows = (await sql.query(
    `
      SELECT DISTINCT order_id FROM point_transactions
      WHERE order_id = ANY($1::text[]) AND type = 'refund-restore'
    `,
    [ids],
  )) as { order_id: string }[];
  for (const row of rows) {
    if (row.order_id) restored.add(row.order_id);
  }
  return restored;
}
