/**
 * 결제 복구 현황 집계 (Privacy-Payment-Recovery-Aggregate-1).
 *
 * 하는 일은 하나다. "주문이 연결되지 않은 결제가 상태별로 몇 건이고, 가장 오래된 것과
 * 가장 새로운 것이 언제인가"를 숫자와 시각으로만 돌려준다.
 *
 * ── 왜 별도 파일인가 ──
 *
 * 기존 결제 조회 함수들은 모두 앞에 ensureTable·ensurePaymentsMigration을 깔고 있다
 * (store.ts). 그 두 줄은 CREATE와 ALTER를 보내고, ALTER는 바꿀 것이 없어도 테이블
 * 잠금을 잡는다. 현황을 "보기만" 하려고 Production 결제 테이블에 잠금을 걸 수는 없다.
 *
 * 그래서 이 파일은 저장소를 아는 파일을 import하지 않는다. 쓸 수 없게 해 두면
 * 나중에도 이 자리에서 스키마를 건드릴 수 없다. 읽는 컬럼 넷(status·order_id·
 * created_at·updated_at)은 모두 payments의 최초 정의에 있는 값이라 준비할 것이 없다.
 *
 * ── 돌려주는 값 ──
 *
 * 건수와 시각뿐이다. merchant_order_id·결제 id·pg_tid·order_snapshot·raw·
 * cancel_response_raw·회원 id는 SELECT 목록에 아예 없다. 조회하지 않으면 내보낼 수도 없다.
 * order_id는 `IS NULL` 조건으로만 쓰고 값으로 꺼내지 않는다.
 *
 * 행을 돌려주지 않는다. GROUP BY를 쓰지 않고 FILTER로 한 행에 모아 세므로,
 * 결제 1건이 응답에 드러나는 모양 자체가 만들어지지 않는다.
 *
 * ── 바꾸지 않는다 ──
 *
 * SELECT 하나뿐이다. 이 파일에는 바꾸는 문장이 없고, 여러 번 불러도 저장소는 그대로다.
 *
 * import 경로가 없는 이유는 다른 순수 모듈들과 같다(Node 내장 테스트 러너로 직접 실행).
 */

/* ── 기준 ───────────────────────────────────────────── */

/**
 * processing이 "밀렸다"고 보는 기준.
 *
 * 새로 정하지 않고 기존 운영 목록(store.ts listPaymentsNeedingReview)이 쓰는 값을
 * 그대로 쓴다. 같은 현황을 두 기준으로 세면 두 화면이 다른 말을 하게 된다.
 * 이 값은 노출 기준일 뿐이며 복구 가능 여부를 정하지 않는다.
 */
export const PROCESSING_STALE_INTERVAL = "10 minutes";

/**
 * 집계 질의. 이 파일에 있는 유일한 SQL이며 SELECT 하나다.
 *
 * WHERE가 order_id IS NULL 하나뿐인 이유는 이 집계가 "주문이 연결되지 않은 결제"만
 * 보기 때문이다. 상태별 구분은 FILTER가 한다. 상태를 WHERE에 넣어 질의를 넷으로
 * 나누면 네 번의 스캔이 서로 다른 순간을 보게 되어, 합이 맞지 않는 현황이 나온다.
 *
 * 매개변수가 없다. 바깥에서 들어오는 값이 질의에 섞이지 않는다.
 */
export const PAYMENT_RECOVERY_AGGREGATE_SQL = `
  SELECT
    count(*) FILTER (WHERE status = 'ready')::int AS ready_count,
    min(created_at) FILTER (WHERE status = 'ready') AS ready_oldest,
    max(created_at) FILTER (WHERE status = 'ready') AS ready_newest,

    count(*) FILTER (WHERE status = 'processing')::int AS processing_count,
    min(created_at) FILTER (WHERE status = 'processing') AS processing_oldest,
    max(created_at) FILTER (WHERE status = 'processing') AS processing_newest,
    count(*) FILTER (
      WHERE status = 'processing'
        AND updated_at < now() - interval '${PROCESSING_STALE_INTERVAL}'
    )::int AS processing_stale_count,
    min(updated_at) FILTER (WHERE status = 'processing') AS processing_oldest_touched,

    count(*) FILTER (WHERE status = 'paid')::int AS paid_count,
    min(created_at) FILTER (WHERE status = 'paid') AS paid_oldest,
    max(created_at) FILTER (WHERE status = 'paid') AS paid_newest,

    count(*) FILTER (WHERE status = 'failed')::int AS failed_count,
    min(created_at) FILTER (WHERE status = 'failed') AS failed_oldest,
    max(created_at) FILTER (WHERE status = 'failed') AS failed_newest
  FROM payments
  WHERE order_id IS NULL
`;

/* ── 바깥 세계 ──────────────────────────────────────── */

/**
 * 집계에 필요한 바깥 세계.
 *
 * 접속 문자열을 받지 않는다. DB 모드인지는 참/거짓 하나로만 받고, 질의는 넘겨받은
 * 함수로만 보낸다. 이 모듈이 스스로 저장소에 닿는 수단을 두지 않는다.
 *
 * query는 문자열을 받지 않는다. 보낼 질의가 위 상수 하나로 정해져 있어서, 호출부가
 * 다른 문장을 끼워 넣을 자리를 만들지 않는다.
 */
export interface PaymentRecoveryAggregateDeps {
  /** DB 모드인지. 참/거짓만 받는다. */
  databaseMode: () => boolean;
  /** PAYMENT_RECOVERY_AGGREGATE_SQL을 보내고 결과 행을 돌려준다. */
  query: () => Promise<readonly Record<string, unknown>[]>;
}

/* ── 응답 ───────────────────────────────────────────── */

/** 한 상태의 현황. 숫자와 시각뿐이다. */
export interface PaymentRecoveryGroup {
  count: number;
  /** 가장 오래된 준비 시각(ISO). 0건이면 null이다. */
  oldestCreatedAt: string | null;
  /** 가장 새로운 준비 시각(ISO). 0건이면 null이다. */
  newestCreatedAt: string | null;
}

/**
 * processing만 두 값을 더 본다.
 *
 * 승인 여부를 확정하지 못한 채 남은 상태라 "얼마나 오래 그대로인지"가 따로 필요하다.
 * staleCount는 기준 시각을 넘긴 건수이고, oldestUpdatedAt은 마지막으로 바뀐 시각 중
 * 가장 이른 것이다. 준비 시각(created_at)과 뜻이 다르므로 칸을 나눠 담는다.
 */
export interface ProcessingRecoveryGroup extends PaymentRecoveryGroup {
  staleCount: number;
  oldestUpdatedAt: string | null;
}

/** 관리자에게 돌려줄 현황. 배열도, 자유 키도 없다. */
export interface PaymentRecoveryAggregateBody {
  action: "payment-recovery-aggregate";
  /** 기준 시각(ISO). 이 현황이 언제의 사실인지를 적어 둔다. */
  checkedAt: string;
  /** 기준으로 삼은 지연 판정 값. 숫자가 아니라 무엇을 썼는지의 기록이다. */
  staleInterval: string;
  groups: {
    readyUnlinked: PaymentRecoveryGroup;
    processingUnlinked: ProcessingRecoveryGroup;
    paidUnlinked: PaymentRecoveryGroup;
    failedUnlinked: PaymentRecoveryGroup;
  };
}

/** 거절 사유. 고정 코드와 고정 문구뿐이다. 받은 오류도 질의도 담지 않는다. */
export const PAYMENT_RECOVERY_AGGREGATE_ERRORS = {
  DATABASE_MODE_REQUIRED: "데이터베이스 모드에서만 확인할 수 있습니다.",
  AGGREGATE_FAILED: "결제 현황을 확인하지 못했습니다.",
} as const;

export type PaymentRecoveryAggregateErrorCode =
  keyof typeof PAYMENT_RECOVERY_AGGREGATE_ERRORS;

export interface PaymentRecoveryAggregateErrorBody {
  error: PaymentRecoveryAggregateErrorCode;
  message: string;
}

export interface PaymentRecoveryAggregateResponse {
  status: number;
  body: PaymentRecoveryAggregateBody | PaymentRecoveryAggregateErrorBody;
}

function refuse(
  code: PaymentRecoveryAggregateErrorCode,
): PaymentRecoveryAggregateResponse {
  const status = code === "DATABASE_MODE_REQUIRED" ? 409 : 500;
  return { status, body: { error: code, message: PAYMENT_RECOVERY_AGGREGATE_ERRORS[code] } };
}

/* ── 값 읽기 ────────────────────────────────────────── */

/**
 * 건수로 읽는다. 읽을 수 없으면 0이 아니라 null로 보고 위에서 실패로 다룬다.
 *
 * 드라이버가 숫자로 줄 수도 문자열로 줄 수도 있어 둘 다 받는다. 0은 정상적인 답이라
 * 그대로 통과시키고, 읽지 못한 것과 구분한다. 읽지 못한 값을 0으로 적으면
 * "확인했더니 없었다"로 읽히기 때문이다.
 */
export function readCount(value: unknown): number | null {
  if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const parsed = Number(trimmed);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

/**
 * 시각을 ISO 문자열로 읽는다. 값이 없으면 null이다.
 *
 * null은 "그 상태의 결제가 없다"는 뜻이다(min/max는 대상이 없으면 null을 준다).
 * 빈 문자열이나 지금 시각으로 대신 채우지 않는다. 없는 사실을 있는 것처럼 만들지 않는다.
 */
export function readIso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

/* ── 실행 ───────────────────────────────────────────── */

/**
 * 현황을 한 번 센다.
 *
 * now는 밖에서 받는다. 요청 처리 시작 시각 하나를 그대로 적기 위해서다.
 *
 * 차례는 이렇다. DB 모드 → 질의 → 읽기. DB 모드가 아니면 질의를 **한 번도 보내지
 * 않는다**. 0건으로 답하지 않는 이유는, 세지 못한 것과 없는 것이 다른 사실이기 때문이다.
 *
 * 받은 오류는 버린다. 문장·인자·접속 정보가 섞여 있을 수 있어 밖으로 내보내지 않고
 * 따로 기록하지도 않는다. 돌려주는 것은 정해 둔 코드 하나다.
 */
export async function runPaymentRecoveryAggregate(
  deps: PaymentRecoveryAggregateDeps,
  now: string,
): Promise<PaymentRecoveryAggregateResponse> {
  if (!deps.databaseMode()) return refuse("DATABASE_MODE_REQUIRED");

  let rows: readonly Record<string, unknown>[];
  try {
    rows = await deps.query();
  } catch {
    return refuse("AGGREGATE_FAILED");
  }

  const row = rows[0];
  if (!row) return refuse("AGGREGATE_FAILED");

  const readyCount = readCount(row.ready_count);
  const processingCount = readCount(row.processing_count);
  const processingStaleCount = readCount(row.processing_stale_count);
  const paidCount = readCount(row.paid_count);
  const failedCount = readCount(row.failed_count);
  // 건수를 하나라도 읽지 못하면 현황이 아니다. 일부만 담아 내보내지 않는다.
  if (
    readyCount === null ||
    processingCount === null ||
    processingStaleCount === null ||
    paidCount === null ||
    failedCount === null
  ) {
    return refuse("AGGREGATE_FAILED");
  }

  return {
    status: 200,
    body: {
      action: "payment-recovery-aggregate",
      checkedAt: now,
      staleInterval: PROCESSING_STALE_INTERVAL,
      groups: {
        readyUnlinked: {
          count: readyCount,
          oldestCreatedAt: readIso(row.ready_oldest),
          newestCreatedAt: readIso(row.ready_newest),
        },
        processingUnlinked: {
          count: processingCount,
          oldestCreatedAt: readIso(row.processing_oldest),
          newestCreatedAt: readIso(row.processing_newest),
          staleCount: processingStaleCount,
          oldestUpdatedAt: readIso(row.processing_oldest_touched),
        },
        paidUnlinked: {
          count: paidCount,
          oldestCreatedAt: readIso(row.paid_oldest),
          newestCreatedAt: readIso(row.paid_newest),
        },
        failedUnlinked: {
          count: failedCount,
          oldestCreatedAt: readIso(row.failed_oldest),
          newestCreatedAt: readIso(row.failed_newest),
        },
      },
    },
  };
}
