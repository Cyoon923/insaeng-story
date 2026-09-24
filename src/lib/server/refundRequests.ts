/**
 * 환불 문의 저장 모델 (Refund-Request-Data-1).
 *
 * 이 파일은 저장만 한다. 고객 화면, 관리자 처리, GET /api/app·/api/admin 연결,
 * Order/Payment 상태 변경, 실제 취소·환불, NICEPAY cancel은 이 단계에서 만들지 않는다.
 *
 * 저장 위치
 * - PostgreSQL 전용 refund_requests 테이블이다. app_store JSONB에 미러를 두지 않는다.
 *   단일 행 CAS를 쓰는 JSONB와 달리 행 단위 잠금과 UNIQUE 제약을 쓸 수 있어서다.
 * - DATABASE_URL이 없는 환경에서는 저장할 수 없다(결제 기록과 같은 규칙).
 *
 * 귀속
 * - 언제나 Order.id에 건다. 1:1 사주상담도 같은 id의 주문이 함께 만들어지므로
 *   (applyOrder.ts commitConsultation) 이 한 경로로 인생곡과 상담을 모두 가리킨다.
 * - 주문 없이 남아 있는 과거 상담은 이 구조의 대상이 아니다(다음 단계에서 다룬다).
 *
 * 과거 주문 호환
 * - refundConsent·productionStartedAt이 없는 과거 주문이라도 요청 저장 자체는 막지 않는다.
 *   두 값은 "기록 없음(판정 불가)"이며, 판단은 후속 manual-review 단계의 몫이다.
 *   여기서 소급 생성(backfill)은 하지 않는다.
 */
import { attachConsultations } from "@/lib/server/refundRequestAdminView";
import type { AdminRefundRequestBase } from "@/lib/server/refundRequestAdminView";
import { projectRefundExecution } from "@/lib/server/refundExecutionProjection";
import { buildRefundRequestEvidence, normalizeRefundRequestInput } from "@/lib/server/refundRequestEvidence";
import { decidedAtFor, isAllowedAdminTransition } from "@/lib/server/refundRequestTransitions";
import { ensureTable, getOrderById, listPaidPaymentsByOrderIds, nowId, readData, sqlClient } from "@/lib/server/store";
import { listRefundRestoredOrderIds } from "@/lib/server/pointTransactions";
import type {
  ActiveRefundRequestSummary,
  AdminRefundRequestItem,
  Consultation,
  LatestRefundRequestSummary,
  OrderStatus,
  OrderProduct,
  Payment,
  RefundRequest,
  RefundRequestCancelWindowSnapshot,
  RefundRequestReason,
  RefundRequestStatus,
} from "@/lib/types/app";

/**
 * 아직 끝나지 않은 상태. 한 주문에 이 상태의 요청은 합쳐서 최대 1건이다
 * (requested 1건 + reviewing 1건처럼 서로 다른 활성 상태의 조합도 허용하지 않는다).
 *
 * approved가 여기에 들어가는 이유는, 관리자가 환불하기로 결정했더라도 실제 환급이
 * 끝나기 전까지는 종결이 아니기 때문이다. 그 사이에 같은 주문으로 새 요청이 들어오면
 * 처리 중인 건과 겹친다. 끝난 상태는 rejected와 completed뿐이고, 그 뒤에는 새 요청을
 * 넣을 수 있다.
 *
 * 이 목록은 아래 부분 UNIQUE 인덱스의 WHERE 절과 반드시 같아야 한다.
 * 한쪽만 바꾸면 DB 방어선과 코드의 판단이 갈라진다.
 */
export const ACTIVE_REFUND_REQUEST_STATUSES = ["requested", "reviewing", "approved"] as const;

/** 인덱스 술어에 쓰는 SQL 조각. 위 목록과 한 곳에서 같이 만든다. */
const ACTIVE_STATUS_SQL = ACTIVE_REFUND_REQUEST_STATUSES.map((status) => `'${status}'`).join(", ");
const ACTIVE_PREDICATE = `status IN (${ACTIVE_STATUS_SQL})`;

/**
 * 테이블 별칭을 붙인 같은 술어. orders에도 status 열이 있어, 조인 질의에서는
 * 어느 쪽 status인지 밝혀야 한다.
 */
function activePredicateFor(alias: string) {
  return `${alias}.${ACTIVE_PREDICATE}`;
}

export function isActiveRefundRequestStatus(status: RefundRequestStatus): boolean {
  return (ACTIVE_REFUND_REQUEST_STATUSES as readonly string[]).includes(status);
}

/** 결제 기록과 같은 규칙. 환불 문의도 DATABASE_URL이 있는 환경에서만 다룬다. */
function refundClient() {
  const sql = sqlClient();
  if (!sql) {
    throw new Error("환불 문의는 DATABASE_URL이 설정된 환경에서만 저장할 수 있습니다.");
  }
  return sql;
}

/** 활성 인덱스 이름. 술어가 바뀌면 이름도 함께 올려 새 인덱스로 갈아탄다. */
const ACTIVE_INDEX_NAME = "refund_requests_active_order_v2_key";

/** 술어가 requested·reviewing뿐이던 시절의 인덱스 이름. */
const LEGACY_ACTIVE_INDEX_NAME = "refund_requests_active_order_key";

/**
 * "주문 1건당 고객 웹 환불 문의 1회"를 DB에서 보장하는 인덱스 이름.
 *
 * 술어가 없는 완전 UNIQUE라서 끝난 요청(rejected·completed)까지 센다.
 * 활성 인덱스와 함께 둔다. 활성 인덱스를 지우지 않는 이유는 아래 두 가지다.
 * - 이 인덱스를 만들지 못하는 운영 데이터가 있어도 활성 중복 방어는 남아야 한다.
 * - INSERT의 ON CONFLICT가 활성 인덱스를 가리키고 있어, 그 보호를 그대로 쓴다.
 */
const ORDER_ONCE_INDEX_NAME = "refund_requests_order_once_key";

/**
 * refund_requests 테이블과 인덱스를 보장한다. 여러 번 실행해도 안전하다.
 * orders를 참조하므로 호출부는 반드시 ensureTable(orders 생성)을 먼저 지나야 한다.
 *
 * 기존 ensurePaymentsMigration·ensureOrdersMigration과 같은 방식으로
 * 서버 인스턴스당 한 번만 실행한다. 실패하면 기억을 지워 다음 요청이 다시 시도한다.
 *
 * 활성 인덱스 술어 교체에 대하여
 * - CREATE UNIQUE INDEX IF NOT EXISTS는 이름만 보므로, 이미 있는 인덱스의 술어를
 *   바꾸지 못한다. 그래서 술어가 바뀔 때는 이름을 올려 새 인덱스를 만들고
 *   옛 인덱스를 지운다.
 * - 순서가 중요하다. 새 인덱스를 먼저 만들고 그다음에 옛 인덱스를 지우므로,
 *   보호가 없는 순간이 생기지 않는다.
 * - 두 문장이 한 트랜잭션 안에 있다. 새 인덱스 생성이 실패하면 DROP도 일어나지 않고
 *   옛 인덱스가 그대로 남는다.
 * - 새 술어는 옛 술어를 포함하기만 하므로(approved가 더해졌을 뿐) 보호 범위가
 *   좁아지는 일은 없다. 다만 더 엄격해졌기 때문에, 이미 같은 주문에
 *   approved 1건과 requested 1건이 함께 저장되어 있는 운영 데이터가 있다면
 *   생성이 실패한다. 그때는 이 마이그레이션이 조용히 넘어가지 않고 오류를 내며,
 *   기억을 지웠으므로 데이터를 정리한 뒤 다음 요청에서 다시 시도된다.
 *   (데이터를 지우거나 상태를 바꿔 통과시키는 일은 하지 않는다.)
 */
async function runRefundRequestsMigration(sql: NonNullable<ReturnType<typeof sqlClient>>) {
  await sql.transaction((txn) => [
    txn.query(`
      CREATE TABLE IF NOT EXISTS refund_requests (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL REFERENCES orders(id),
        -- 주문 행에서 읽은 소유자. 요청자가 보낸 값을 그대로 담지 않는다.
        user_id TEXT NOT NULL,
        status TEXT NOT NULL,
        requested_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `),
    /*
     * 고객 입력과 접수 당시 Evidence.
     *
     * 이미 만들어진 테이블에도 같은 열이 생기도록 ALTER로 더한다. NOT NULL을 걸지
     * 않는 이유는 열을 더하는 시점에 이미 있는 행을 되살릴 값이 없기 때문이다.
     * 저장은 언제나 createRefundRequest를 거치고 그 함수가 reason을 반드시 채운다.
     * 값이 없는 행을 소급해 채우지 않는다.
     */
    txn.query(`ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS reason TEXT`),
    txn.query(`ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS message TEXT`),
    txn.query(`
      ALTER TABLE refund_requests
        ADD COLUMN IF NOT EXISTS production_started_at_snapshot TIMESTAMPTZ
    `),
    txn.query(`
      ALTER TABLE refund_requests
        ADD COLUMN IF NOT EXISTS scheduled_at_snapshot TIMESTAMPTZ
    `),
    txn.query(`
      ALTER TABLE refund_requests
        ADD COLUMN IF NOT EXISTS cancel_window_snapshot JSONB
    `),
    txn.query(`
      ALTER TABLE refund_requests
        ADD COLUMN IF NOT EXISTS cancel_window_policy_version TEXT
    `),
    /*
     * 관리자 처리 기록. 기존 행은 NULL로 남는다("아직 아무도 손대지 않음").
     * 값을 소급해 만들지 않는다.
     */
    txn.query(`ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ`),
    txn.query(`ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS handled_by TEXT`),
    /*
     * 종결 시각. 승인 시각(decided_at)과 다른 칸이다.
     *
     * 이 열에 값이 있다는 것은 "확인된 환불 성공을 반영해 이 문의를 그 순간
     * completed로 종결했다"는 뜻이다. 사람이 승인한 순간도(decided_at),
     * PG가 환급을 처리한 순간도(payments.cancelled_at) 아니다.
     *
     * NOT NULL을 걸지 않는다. 아직 종결되지 않은 문의가 정상적으로 존재하고,
     * 이 열이 생기기 전 행을 되살릴 값도 없다. 소급해 채우지 않는다.
     * 쓰는 곳은 최종화 한 문장뿐이다(store.ts finalizeRefundPaymentCancel).
     */
    txn.query(`ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ`),
    /*
     * status 값 제약.
     *
     * NOT VALID로 더한다. 새로 들어오거나 바뀌는 행에는 곧바로 적용되지만
     * 이미 저장된 행을 훑지 않는다. 그래서
     * - 큰 테이블을 잠그며 전수 검사하지 않고,
     * - 뜻밖의 값이 이미 들어 있어도 마이그레이션이 통째로 실패하지 않으며,
     * - 그런 행을 자동으로 고치거나 지우지도 않는다(사람이 확인할 몫으로 남긴다).
     *
     * ALTER TABLE ... ADD CONSTRAINT에는 IF NOT EXISTS가 없어 pg_constraint를 보고
     * 없을 때만 더한다. 여러 번 실행해도 안전하다.
     *
     * 이것은 마지막 그물일 뿐이고, 전이 규칙 검증은 서버가 반드시 따로 한다
     * (refundRequestTransitions.ts + 아래 CAS UPDATE).
     */
    txn.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'refund_requests_status_check'
        ) THEN
          ALTER TABLE refund_requests
            ADD CONSTRAINT refund_requests_status_check
            CHECK (status IN ('requested', 'reviewing', 'approved', 'rejected', 'completed'))
            NOT VALID;
        END IF;
      END $$;
    `),
    // 한 주문의 활성 요청을 1건으로 묶는 최종 방어선.
    // 동시 요청이 겹쳐도 두 번째 INSERT는 이 인덱스에서 걸린다.
    txn.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ${ACTIVE_INDEX_NAME}
        ON refund_requests (order_id)
        WHERE ${ACTIVE_PREDICATE}
    `),
    // 위 생성이 끝난 뒤에만 옛 인덱스를 지운다(같은 트랜잭션).
    txn.query(`DROP INDEX IF EXISTS ${LEGACY_ACTIVE_INDEX_NAME}`),
    txn.query(`
      CREATE INDEX IF NOT EXISTS refund_requests_order_requested_idx
        ON refund_requests (order_id, requested_at DESC)
    `),
  ]);

  // 위 트랜잭션이 끝난 뒤에 따로 시도한다. 실패해도 여기까지는 그대로 남는다.
  await ensureOrderOnceIndex(sql);
}

/**
 * "주문당 1회" 인덱스를 만들 수 있으면 만든다.
 *
 * 본 마이그레이션 트랜잭션 **밖에서** 따로 한다. 이 한 문장이 실패했다고 테이블·열·
 * 활성 인덱스까지 함께 되돌아가면 환불 기능 전체가 멈추기 때문이다.
 *
 * 이미 같은 주문에 요청이 여러 건 저장된 운영 데이터가 있으면 UNIQUE 생성은 실패한다.
 * 그때 이 함수는 **아무것도 지우거나 바꾸지 않는다**. 사람이 봐야 한다는 사실을
 * 서버 기록에 남기고 물러난다. 데이터를 정리해 통과시키는 일은 코드가 할 일이 아니다.
 *
 * 인덱스가 없어도 접수는 막힌다. createRefundRequest의 NOT EXISTS 조건이 같은 규칙을
 * 적용하고, 처음 접수가 동시에 들어오는 경우는 활성 인덱스가 여전히 하나만 통과시킨다.
 * 다만 "끝난 요청이 있는 주문에 동시에 두 번" 같은 경우까지 DB가 막아 주지는 못하므로,
 * 인덱스를 만들지 못한 상태는 정상이 아니라 확인이 필요한 상태다.
 */
async function ensureOrderOnceIndex(sql: NonNullable<ReturnType<typeof sqlClient>>) {
  const duplicates = (await sql.query(`
    SELECT order_id, count(*) AS total
    FROM refund_requests
    GROUP BY order_id
    HAVING count(*) > 1
    LIMIT 5
  `)) as { order_id: string; total: string | number }[];

  if (duplicates.length > 0) {
    // 지우지 않는다. 몇 건인지와 어떤 주문인지만 남겨 사람이 판단하게 한다.
    console.error(
      "[refund] 주문당 1회 인덱스를 만들지 못했습니다. 같은 주문에 요청이 여러 건 있습니다.",
      { orderIds: duplicates.map((row) => row.order_id), shown: duplicates.length },
    );
    return;
  }

  try {
    await sql.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ${ORDER_ONCE_INDEX_NAME}
        ON refund_requests (order_id)
    `);
  } catch (error) {
    // 위 확인과 생성 사이에 행이 들어왔을 수 있다. 이때도 데이터를 건드리지 않는다.
    console.error("[refund] 주문당 1회 인덱스 생성에 실패했습니다.", error);
  }
}

let refundRequestsMigration: Promise<void> | null = null;

/** 다른 저장 함수(결제 최종화)도 이 테이블을 쓰므로 밖에서 부를 수 있게 둔다. */
export function ensureRefundRequests(sql: NonNullable<ReturnType<typeof sqlClient>>): Promise<void> {
  if (!refundRequestsMigration) {
    refundRequestsMigration = runRefundRequestsMigration(sql).catch((error) => {
      refundRequestsMigration = null;
      throw error;
    });
  }
  return refundRequestsMigration;
}

/** 테이블 준비를 한 곳에 모은다. orders가 먼저 있어야 FK를 만들 수 있다. */
async function ready(sql: NonNullable<ReturnType<typeof sqlClient>>) {
  await ensureTable(sql);
  await ensureRefundRequests(sql);
}

interface RefundRequestRow {
  id: string;
  order_id: string;
  user_id: string;
  status: string;
  requested_at: string | Date;
  reason: string | null;
  message: string | null;
  production_started_at_snapshot: string | Date | null;
  scheduled_at_snapshot: string | Date | null;
  cancel_window_snapshot: unknown;
  cancel_window_policy_version: string | null;
  decided_at: string | Date | null;
  handled_by: string | null;
  completed_at: string | Date | null;
}

const REFUND_REQUEST_COLUMNS = `id, order_id, user_id, status, requested_at,
  reason, message, production_started_at_snapshot, scheduled_at_snapshot,
  cancel_window_snapshot, cancel_window_policy_version, decided_at, handled_by,
  completed_at`;

/** TIMESTAMPTZ 열을 ISO 문자열로. 값이 없으면 "기록 없음"이라는 뜻의 null을 유지한다. */
function toIsoOrNull(value: string | Date | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function toRefundRequest(row: RefundRequestRow): RefundRequest {
  const requestedAt =
    row.requested_at instanceof Date ? row.requested_at.toISOString() : String(row.requested_at);
  return {
    id: row.id,
    orderId: row.order_id,
    userId: row.user_id,
    status: row.status as RefundRequestStatus,
    requestedAt,
    // 저장은 createRefundRequest만 하고 그 함수가 언제나 목록 안의 값을 넣는다.
    reason: row.reason as RefundRequestReason,
    // 비어 있으면 키를 만들지 않는다. 빈 문자열과 "적지 않음"을 섞지 않기 위해서다.
    ...(row.message ? { message: row.message } : {}),
    // null은 값이 없다는 기록 자체이므로 키를 지우지 않고 null 그대로 남긴다.
    productionStartedAtSnapshot: toIsoOrNull(row.production_started_at_snapshot),
    scheduledAtSnapshot: toIsoOrNull(row.scheduled_at_snapshot),
    cancelWindowSnapshot:
      (row.cancel_window_snapshot as RefundRequestCancelWindowSnapshot | null) ?? null,
    cancelWindowPolicyVersion: row.cancel_window_policy_version,
    decidedAt: toIsoOrNull(row.decided_at),
    handledBy: row.handled_by,
    // 종결하지 않은 문의는 null이다. 승인 시각으로 대신 채우지 않는다.
    completedAt: toIsoOrNull(row.completed_at),
  };
}

/**
 * 환불 문의 생성 결과.
 *
 * 실패 사유를 문자열로 흘리지 않고 union으로 좁혀, 나중에 API·관리자 화면이
 * 안전하게 분기할 수 있게 한다.
 */
export type CreateRefundRequestResult =
  | { ok: true; request: RefundRequest }
  /** 그런 주문이 없거나, 있어도 이 회원의 주문이 아니다. 둘을 구분해 알려주지 않는다. */
  | { ok: false; reason: "order-not-found" }
  /** 이미 처리 중인 요청이 있다. 활성 요청은 주문당 1건이다. */
  | { ok: false; reason: "active-exists" }
  /**
   * 이 주문에는 이미 끝난 환불 문의가 있다(rejected·completed).
   *
   * 고객 웹 접수는 주문당 1회이므로 끝난 뒤에도 새로 넣지 않는다.
   * active-exists와 나누어 두는 이유는 안내가 다르기 때문이다.
   * 처리 중이면 결과를 기다리면 되지만, 끝난 건은 상담원에게 이어져야 한다.
   */
  | { ok: false; reason: "closed-exists" }
  /** 목록에 없는 사유를 보냈다. */
  | { ok: false; reason: "invalid-reason" }
  /** reason이 "other"인데 상세 내용이 비어 있다. */
  | { ok: false; reason: "message-required" }
  /** 상세 내용이 상한을 넘었다. 잘라 담지 않고 거절한다. */
  | { ok: false; reason: "message-too-long" };

/**
 * 환불 문의 1건을 접수한다.
 *
 * 클라이언트가 정하는 값은 어떤 주문인지(orderId)와 고객이 고른 사유·상세 내용뿐이다.
 * userId·requestedAt·status·snapshot·정책 버전은 모두 서버가 만든다.
 * - 저장되는 user_id는 넘어온 값이 아니라 주문 행의 user_id다.
 * - status는 언제나 "requested"다.
 * - requestedAt은 이 함수가 만든 Date 하나이며, 같은 Date로 취소창 판정도 한다.
 *   new Date()를 두 번 부르지 않으므로 3시간 경계에서 두 기록이 어긋나지 않는다.
 *
 * 주문 존재 확인과 소유자 확인은 INSERT ... SELECT 한 문장 안에서 한다.
 * 먼저 조회하고 나중에 넣는 구조가 아니라서 그사이에 끼어들 틈이 없다.
 * (Evidence를 모으려고 주문을 미리 읽기는 하지만, 그 읽기는 판단 근거를 모으는
 *  용도이고 저장 여부를 가르는 관문은 아래 한 문장이다.)
 * 활성 요청 중복은 부분 UNIQUE 인덱스가 최종적으로 막는다(ON CONFLICT DO NOTHING).
 */
export async function createRefundRequest(input: {
  orderId: string;
  /** 요청한 회원. 주문 소유자와 일치할 때만 접수된다. */
  userId: string;
  /** 고객이 고른 사유. 목록에 없는 값은 거절한다. */
  reason: unknown;
  /** 고객이 적은 상세 내용. reason이 "other"면 반드시 있어야 한다. */
  message?: unknown;
}): Promise<CreateRefundRequestResult> {
  const normalized = normalizeRefundRequestInput({ reason: input.reason, message: input.message });
  if (!normalized.ok) {
    return { ok: false, reason: normalized.reason };
  }

  const sql = refundClient();
  await ready(sql);

  // 접수 순간. 아래 판정과 저장이 모두 이 값 하나를 쓴다.
  const requestedAt = new Date();

  const order = await getOrderById(input.orderId);
  if (!order || order.userId !== input.userId) {
    return { ok: false, reason: "order-not-found" };
  }
  /**
   * 상담 주문이면 같은 id의 상담을 찾는다. 상담은 orders 테이블이 아니라
   * app_store JSONB에 있어 여기서만 따로 읽는다.
   * 찾지 못하면(주문만 남은 옛 자료 등) 예약 시각을 지어내지 않고 null로 둔다.
   */
  const consultation =
    order.product === "consultation"
      ? ((await readData()).consultations.find((item) => item.id === order.id) ?? null)
      : null;
  const evidence = buildRefundRequestEvidence({ order, consultation, requestedAt });

  const rows = (await sql.query(
    `
      INSERT INTO refund_requests (
        id, order_id, user_id, status, requested_at,
        reason, message, production_started_at_snapshot, scheduled_at_snapshot,
        cancel_window_snapshot, cancel_window_policy_version
      )
      SELECT $1, o.id, o.user_id, 'requested', $4::timestamptz,
             $5, $6, $7::timestamptz, $8::timestamptz, $9::jsonb, $10
      FROM orders o
      WHERE o.id = $2 AND o.user_id = $3
        -- 주문당 고객 웹 접수는 1회다. 끝난 요청까지 세므로 재접수가 막힌다.
        AND NOT EXISTS (SELECT 1 FROM refund_requests r WHERE r.order_id = o.id)
      ON CONFLICT (order_id) WHERE ${ACTIVE_PREDICATE} DO NOTHING
      RETURNING ${REFUND_REQUEST_COLUMNS}
    `,
    [
      nowId(),
      input.orderId,
      input.userId,
      requestedAt.toISOString(),
      normalized.input.reason,
      normalized.input.message,
      evidence.productionStartedAtSnapshot,
      evidence.scheduledAtSnapshot,
      evidence.cancelWindowSnapshot ? JSON.stringify(evidence.cancelWindowSnapshot) : null,
      evidence.cancelWindowPolicyVersion,
    ],
  )) as RefundRequestRow[];
  if (rows[0]) {
    return { ok: true, request: toRefundRequest(rows[0]) };
  }
  /*
   * 0행인 이유는 세 가지다.
   *   · 처리 중인 요청이 있다            → active-exists
   *   · 끝난 요청만 있다(재접수 시도)     → closed-exists
   *   · 그 주문이 없거나 남의 주문이다    → order-not-found
   * 있는 요청을 먼저 보고, 없을 때만 주문을 찾지 못한 것으로 본다.
   */
  const active = await getActiveRefundRequestByOrderId(input.orderId);
  if (active) return { ok: false, reason: "active-exists" };
  if (await hasAnyRefundRequestForOrder(input.orderId)) {
    return { ok: false, reason: "closed-exists" };
  }
  return { ok: false, reason: "order-not-found" };
}

/** 주문 1건의 활성 요청. 부분 UNIQUE 인덱스 덕분에 있어도 1건이다. */
export async function getActiveRefundRequestByOrderId(
  orderId: string,
): Promise<RefundRequest | null> {
  const sql = refundClient();
  await ready(sql);
  const rows = (await sql.query(
    `
      SELECT ${REFUND_REQUEST_COLUMNS} FROM refund_requests
      WHERE order_id = $1 AND ${ACTIVE_PREDICATE}
    `,
    [orderId],
  )) as RefundRequestRow[];
  return rows[0] ? toRefundRequest(rows[0]) : null;
}

/** 주문 1건의 환불 문의 이력. 최신 접수가 먼저 온다. */
export async function listRefundRequestsByOrderId(orderId: string): Promise<RefundRequest[]> {
  const sql = refundClient();
  await ready(sql);
  const rows = (await sql.query(
    `
      SELECT ${REFUND_REQUEST_COLUMNS} FROM refund_requests
      WHERE order_id = $1
      ORDER BY requested_at DESC, id DESC
    `,
    [orderId],
  )) as RefundRequestRow[];
  return rows.map(toRefundRequest);
}


/**
 * 지금 로그인한 회원의 주문들에 걸려 있는 활성 환불 문의.
 *
 * 조회는 언제나 회원 한 사람 기준이다. 클라이언트가 주문 id 목록이나 회원 id를
 * 보내 고르는 구조를 만들지 않는다. 호출부는 세션에서 얻은 userId만 넘긴다.
 *
 * 소유 관계는 refund_requests.user_id가 아니라 orders와의 조인으로 확인한다.
 * 저장할 때 주문 행에서 읽어 넣은 값이라 둘이 같지만, 조회에서까지 한 열만 믿기보다
 * 실제 주문 소유자를 매번 확인하는 편이 안전하다.
 *
 * 주문 수와 상관없이 질의는 한 번이다. 주문마다
 * getActiveRefundRequestByOrderId를 부르는 N+1이 되지 않게 이 함수를 따로 둔다.
 *
 * 고객에게 보여 줄 네 값만 SELECT한다. Evidence 열은 아예 읽지 않으므로
 * 화면 쪽으로 새어 나갈 경로가 없다.
 *
 * DATABASE_URL이 없는 환경에서는 저장된 문의 자체가 없으므로 빈 목록을 돌려준다.
 * 쓰기(createRefundRequest)가 오류를 내는 것과 달리 읽기는 이렇게 비켜 간다.
 */
export async function listActiveRefundRequestsByUser(
  userId: string,
): Promise<ActiveRefundRequestSummary[]> {
  const sql = sqlClient();
  if (!sql) return [];
  await ready(sql);
  const rows = (await sql.query(
    `
      SELECT r.id, r.order_id, r.status, r.requested_at
      FROM refund_requests r
      JOIN orders o ON o.id = r.order_id
      WHERE o.user_id = $1 AND ${activePredicateFor("r")}
      ORDER BY r.requested_at DESC, r.id DESC
    `,
    [userId],
  )) as Pick<RefundRequestRow, "id" | "order_id" | "status" | "requested_at">[];
  return rows.map((row) => ({
    id: row.id,
    orderId: row.order_id,
    status: row.status as RefundRequestStatus,
    requestedAt:
      row.requested_at instanceof Date ? row.requested_at.toISOString() : String(row.requested_at),
  }));
}

/**
 * 이 주문에 환불 문의가 한 번이라도 있었는지. 상태를 가리지 않는다.
 *
 * 재접수를 막을 때와 그 이유를 가릴 때만 쓴다. 내용은 읽지 않고 존재 여부만 본다.
 * (접수 여부를 가르는 관문은 INSERT 한 문장의 NOT EXISTS이고, 이 함수는 그 뒤에
 *  "왜 0행이었는지"를 사람이 읽을 수 있는 사유로 바꾸기 위한 조회다.)
 */
export async function hasAnyRefundRequestForOrder(orderId: string): Promise<boolean> {
  const sql = refundClient();
  await ready(sql);
  const rows = (await sql.query(
    `SELECT 1 FROM refund_requests WHERE order_id = $1 LIMIT 1`,
    [orderId],
  )) as unknown[];
  return rows.length > 0;
}

/**
 * 이 주문의 환불이 끝났는지(= completed 문의가 있는지) (Refund-Completed-Progress-Lock-1).
 *
 * 관리자 진행 상태 변경을 막을지 정하는 데만 쓴다. 고객 화면이 쓰는 판정
 * (refundSectionState 등)과 섞지 않는다. 이쪽은 서버 권한 판단이고 저쪽은 표시 규칙이다.
 *
 * completed만 본다. requested·reviewing·approved·rejected는 이 규칙의 대상이 아니다.
 * 승인(approved)은 아직 환불이 끝난 상태가 아니고, 거절(rejected)은 애초에 환불이 없었다.
 *
 * DATABASE_URL이 없는 환경에서는 저장된 문의 자체가 없으므로 false다.
 * (읽기 함수들과 같은 규칙이며, 없는 문의를 있다고 가정해 막지 않는다.)
 *
 * 이 조회는 판단의 근거일 뿐 최종 관문이 아니다. 주문 쪽 최종 관문은
 * store.ts writeDataWithOrderStatus의 한 문장 안에 있는 같은 조건이다.
 */
export async function hasCompletedRefundRequestForOrder(orderId: string): Promise<boolean> {
  const id = orderId.trim();
  if (!id) return false;
  const sql = sqlClient();
  if (!sql) return false;
  await ready(sql);
  const rows = (await sql.query(
    `SELECT 1 FROM refund_requests WHERE order_id = $1 AND status = 'completed' LIMIT 1`,
    [id],
  )) as unknown[];
  return rows.length > 0;
}

/**
 * 고객 화면에 보여 줄, 주문별 **가장 최근** 환불 문의 요약.
 *
 * 활성 목록(listActiveRefundRequestsByUser)과 다른 점은 상태를 가리지 않는다는 것뿐이다.
 * 끝난 요청(rejected·completed)도 담으므로, 고객은 "거절되었다"와 "환불이 끝났다"와
 * "접수한 적이 없다"를 구분할 수 있다. 활성 목록의 의미는 그대로 두고 따로 만든다.
 *
 * 주문 1건에 요청은 1건이지만(주문당 1회 정책), 그 정책이 생기기 전에 저장된 자료에는
 * 여러 건이 있을 수 있다. 그래서 DISTINCT ON으로 주문마다 가장 최근 1건만 고른다.
 * 최신 판정은 requested_at 내림차순이고, 같으면 id 내림차순으로 갈라 언제나 같은 행을 고른다.
 *
 * 고객에게 보여 줄 네 값만 SELECT한다. Evidence 열(접수 당시 snapshot·정책 버전)과
 * 관리자 처리 기록(decided_at·handled_by·completed_at), 결제·PG 정보는 읽지도 않으므로
 * 화면 쪽으로 새어 나갈 경로가 없다.
 *
 * DATABASE_URL이 없는 환경에서는 저장된 문의 자체가 없으므로 빈 목록을 돌려준다
 * (활성 목록 조회와 같은 규칙이다).
 */
export async function listLatestRefundRequestsByUser(
  userId: string,
): Promise<LatestRefundRequestSummary[]> {
  const sql = sqlClient();
  if (!sql) return [];
  await ready(sql);
  const rows = (await sql.query(
    `
      SELECT DISTINCT ON (r.order_id) r.id, r.order_id, r.status, r.requested_at
      FROM refund_requests r
      JOIN orders o ON o.id = r.order_id
      WHERE o.user_id = $1
      ORDER BY r.order_id, r.requested_at DESC, r.id DESC
    `,
    [userId],
  )) as Pick<RefundRequestRow, "id" | "order_id" | "status" | "requested_at">[];
  return rows.map((row) => ({
    id: row.id,
    orderId: row.order_id,
    status: row.status as RefundRequestStatus,
    requestedAt:
      row.requested_at instanceof Date ? row.requested_at.toISOString() : String(row.requested_at),
  }));
}

/** 관리자 목록 질의가 돌려주는 행. 문의 열과 주문 열을 함께 받는다. */
interface AdminRefundRequestRow extends RefundRequestRow {
  product: string;
  title: string;
  amount: number;
  order_status: string;
  order_production_started_at: string | Date | null;
}

/**
 * 관리자 검토용 환불 문의 목록.
 *
 * 범위는 전체 이력이다. 끝난 문의(rejected·completed)도 함께 돌려준다.
 * 지금 규모에서는 목록이 길지 않고, 관리자 화면이 아직 한 페이지라
 * 페이지 나누기·검색·필터는 만들지 않는다.
 *
 * 질의는 한 번이다. refund_requests와 orders를 JOIN으로 함께 읽고, 상담만
 * 호출부가 이미 읽어 둔 목록에서 이어 붙인다(문의마다 따로 읽지 않는다).
 * 상담을 인자로 받는 이유도 같다. 이 함수가 readData()를 다시 부르면
 * 관리자 화면 한 번에 저장소를 두 번 읽게 된다.
 *
 * 정렬은 접수 최신순이며, 같은 시각이면 id 내림차순으로 순서를 고정한다.
 *
 * 여기서 정책 판단을 새로 계산하지 않는다. 접수 당시 값과 지금 값을 나란히
 * 돌려줄 뿐이고, "환불 가능/불가"는 사람이 판단한다.
 */
export async function listRefundRequestsForAdmin(
  consultations: Consultation[],
): Promise<AdminRefundRequestItem[]> {
  const sql = sqlClient();
  if (!sql) return [];
  await ready(sql);
  const rows = (await sql.query(
    `
      SELECT r.id, r.order_id, r.user_id, r.status, r.requested_at,
             r.reason, r.message, r.production_started_at_snapshot,
             r.scheduled_at_snapshot, r.cancel_window_snapshot,
             r.cancel_window_policy_version, r.decided_at, r.handled_by,
             r.completed_at,
             o.product, o.title, o.amount,
             o.status AS order_status,
             o.production_started_at AS order_production_started_at
      FROM refund_requests r
      JOIN orders o ON o.id = r.order_id
      ORDER BY r.requested_at DESC, r.id DESC
    `,
  )) as AdminRefundRequestRow[];

  /*
   * 버튼 노출용 결제 요약. 주문마다 따로 읽지 않고, 목록에 나온 주문 id를 한 번에 넘겨
   * 질의 하나로 읽는다(문의 수와 상관없이 결제 질의는 1회다).
   * 결제 기록을 읽지 못해도 관리자 목록 전체가 비지 않도록 빈 Map으로 둔다.
   */
  let paidByOrder = new Map<string, Payment[]>();
  try {
    paidByOrder = await listPaidPaymentsByOrderIds(rows.map((row) => row.order_id));
  } catch (error) {
    // 읽지 못했다는 사실을 지어내 채우지 않는다. 아래에서 모두 unknown으로 남는다.
    console.error("[admin] refund execution projection failed", error);
    paidByOrder = new Map<string, Payment[]>();
  }

  /*
   * 적립금 복원 원장 유무. 결제 요약과 같은 방식으로 주문 id를 한 번에 넘겨
   * 질의 하나로 읽는다(문의 수와 상관없이 원장 질의는 1회다).
   *
   * 여기서 "복원이 필요한가"를 판단하지 않는다. 기록이 있는지만 읽는다. 금액·근거
   * 판정(decidePointsRestore)을 이 조회에 복제하면 두 규칙이 갈라진다.
   * 읽지 못해도 관리자 목록 전체가 비지 않도록 빈 집합으로 둔다.
   */
  let restoredOrders = new Set<string>();
  try {
    restoredOrders = await listRefundRestoredOrderIds(rows.map((row) => row.order_id));
  } catch (error) {
    console.error("[admin] points restore record lookup failed", error);
    restoredOrders = new Set<string>();
  }

  const base: AdminRefundRequestBase[] = rows.map((row) => {
    const stored = toRefundRequest(row);
    return {
      id: stored.id,
      orderId: stored.orderId,
      userId: stored.userId,
      status: stored.status,
      requestedAt: stored.requestedAt,
      reason: stored.reason,
      // 저장 구조는 값이 없으면 키를 만들지 않지만, 관리자 목록은 칸을 비워 보여 준다.
      message: stored.message ?? null,
      productionStartedAtSnapshot: stored.productionStartedAtSnapshot ?? null,
      scheduledAtSnapshot: stored.scheduledAtSnapshot ?? null,
      cancelWindowSnapshot: stored.cancelWindowSnapshot ?? null,
      cancelWindowPolicyVersion: stored.cancelWindowPolicyVersion ?? null,
      // 표시용 요약. 몇 건인지 세는 규칙은 classifyPaidPayments를 그대로 쓴다.
      refundExecution: projectRefundExecution(paidByOrder.get(stored.orderId) ?? []),
      // 원장이 있는지만. 없다고 해서 복원이 필요하다는 뜻이 아니다(타입 주석 참고).
      hasPointsRestoreRecord: restoredOrders.has(stored.orderId),
      decidedAt: stored.decidedAt ?? null,
      handledBy: stored.handledBy ?? null,
      completedAt: stored.completedAt ?? null,
      order: {
        product: row.product as OrderProduct,
        title: row.title,
        amount: Number(row.amount),
        status: row.order_status as OrderStatus,
        // 지금 기록된 값. 접수 당시 snapshot과 다를 수 있고, 다른 것이 곧 근거다.
        productionStartedAt: toIsoOrNull(row.order_production_started_at),
      },
    };
  });
  return attachConsultations(base, consultations);
}

/**
 * 관리자 상태 전이 결과.
 *
 * stale-status는 "그 문의는 있는데 지금 상태가 관리자가 보고 있던 상태와 다르다"는 뜻이다.
 * 다른 관리자가 먼저 처리했거나 화면이 오래된 경우다.
 */
export type TransitionRefundRequestResult =
  | { ok: true; request: RefundRequest }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "stale-status" }
  | { ok: false; reason: "invalid-transition" };

/**
 * 관리자가 환불 문의 상태를 옮긴다.
 *
 * 두 겹으로 막는다.
 * 1. 규칙: refundRequestTransitions.ts의 허용 목록에 없는 조합은 DB에 가지도 않는다.
 * 2. 경합: UPDATE ... WHERE id = $1 AND status = $2. 관리자가 보고 있던 상태일 때만
 *    바뀐다. 먼저 읽고 나중에 무조건 쓰는 구조가 아니라, 조건이 UPDATE 문 안에 있어
 *    같은 문의에 두 관리자가 동시에 눌러도 한 쪽만 성공한다.
 *    (0행이 나온 뒤에 사유를 가리려고 한 번 더 읽지만, 그 읽기는 안내 문구용이고
 *     안전장치는 위 UPDATE다.)
 *
 * 시각은 서버가 만든다. 클라이언트가 보낸 시각을 쓰지 않는다.
 * - reviewing으로 갈 때는 아직 결론이 아니므로 decided_at을 만들지 않는다.
 *   이미 값이 있다면 지우지도 않는다.
 * - approved·rejected로 갈 때 그 순간을 decided_at에 남긴다.
 * handled_by에는 언제나 이번에 실행한 관리자를 남긴다.
 *
 * approved → completed는 여기서 할 수 없다. 사람이 누르는 전이가 아니라 PG 환불이
 * 성공했을 때만 일어나야 해서, 그 경로에서 따로 만든다.
 */
export async function transitionRefundRequestByAdmin(input: {
  refundRequestId: string;
  /** 관리자가 보고 있던 상태. 지금 상태가 이 값일 때만 바뀐다. */
  expectedCurrentStatus: RefundRequestStatus;
  targetStatus: RefundRequestStatus;
  /** 실행한 관리자. 감사 기록으로 남는다. */
  handledBy: string;
}): Promise<TransitionRefundRequestResult> {
  if (!isAllowedAdminTransition(input.expectedCurrentStatus, input.targetStatus)) {
    return { ok: false, reason: "invalid-transition" };
  }
  const handledBy = input.handledBy.trim();
  if (!handledBy) {
    // 누가 했는지 모르는 처리 기록을 남기지 않는다. 호출부가 관리자 식별자를 준다.
    throw new Error("환불 문의 상태를 바꾸려면 실행한 관리자를 남겨야 합니다.");
  }

  const sql = refundClient();
  await ready(sql);
  const decidedAt = decidedAtFor(input.targetStatus, new Date());

  const rows = (await sql.query(
    `
      UPDATE refund_requests
      SET status = $3,
          -- 결론이 아닐 때는 기존 값을 그대로 둔다. 한 번 남긴 결론 시각을 지우지 않는다.
          decided_at = CASE WHEN $4::timestamptz IS NULL THEN decided_at ELSE $4::timestamptz END,
          handled_by = $5
      WHERE id = $1 AND status = $2
      RETURNING ${REFUND_REQUEST_COLUMNS}
    `,
    [input.refundRequestId, input.expectedCurrentStatus, input.targetStatus, decidedAt, handledBy],
  )) as RefundRequestRow[];
  if (rows[0]) {
    return { ok: true, request: toRefundRequest(rows[0]) };
  }

  // 0행인 이유를 가린다. 문의가 아예 없는지, 있는데 상태가 달라진 것인지.
  const found = (await sql.query(`SELECT id FROM refund_requests WHERE id = $1`, [
    input.refundRequestId,
  ])) as { id: string }[];
  return found[0] ? { ok: false, reason: "stale-status" } : { ok: false, reason: "not-found" };
}
