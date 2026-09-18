/**
 * PG 응답 원문 보유 현황 (Privacy-Payment-Raw-Presence-1, -5에서 스키마 대응).
 *
 * 하는 일은 하나다. "payments의 raw와 cancel_response_raw에 지금 값이 남아 있는가,
 * 몇 건이고 언제 것인가"를 숫자와 시각으로만 돌려준다.
 *
 * ── 왜 필요한가 ──
 *
 * 두 열을 읽는 Production 코드는 없다(승인·취소·환불·복구 어느 경로도 보지 않는다).
 * 새로 채우는 경로도 없다. 그런데 열과 과거 행은 그대로 남아 있고, 그 안에 무엇이
 * 들어 있는지는 코드로 알 수 없다. 무엇을 결정하기 전에 규모부터 알아야 한다.
 *
 * 이 파일은 규모만 센다. 무엇을 지울지도, 언제까지 둘지도 정하지 않는다.
 *
 * ── 두 열의 처지가 다르다 (-5) ──
 *
 * raw는 payments를 처음 만들 때부터 있던 열이다. 언제나 셀 수 있다.
 * cancel_response_raw는 나중에 더해질 열이고, 지금 배포된 코드에는 그 열을 만드는
 * 문장이 없다. 즉 **없는 것이 현재의 정상 상태**다.
 *
 * 그래서 열이 없다는 사실을 오류로 다루지 않는다. 있는 그대로 적어 돌려주고,
 * 있는 쪽(raw)은 그대로 센다. 한쪽이 없다고 답 전체를 버리면, 원래 알고 싶었던
 * raw의 규모마저 영영 알 수 없다.
 *
 * 다만 "열이 없다"와 "열은 있고 0건이다"는 절대 같은 값으로 적지 않는다.
 * 앞의 경우 건수 칸은 0이 아니라 null이고, columnExists가 그 뜻을 못 박는다.
 * 0으로 적으면 없는 근거로 무언가를 정하게 된다.
 *
 * ── 없는 열을 문장에 담지 않는다 ──
 *
 * 열이 없을 때 보내는 질의에는 cancel_response_raw라는 이름이 아예 없다.
 * "있으면 세고 없으면 null"을 한 문장 안에서 처리할 방법이 없기 때문이다
 * (없는 열을 고르면 질의가 통째로 죽는다). 그래서 문장을 둘로 나눠 두고
 * 확인 결과에 따라 **하나만** 보낸다.
 *
 * ── 왜 별도 파일인가 ──
 *
 * 기존 결제 조회 함수들은 앞에 ensureTable·ensurePaymentsMigration을 깔고 있다
 * (store.ts). 그 두 줄은 CREATE와 ALTER를 보내고, ALTER는 바꿀 것이 없어도 테이블
 * 잠금을 잡는다. 현황을 보기만 하려고 Production 결제 테이블에 잠금을 걸 수 없다.
 * 그래서 저장소를 아는 파일을 import하지 않는다. 쓸 수 없게 해 두면 나중에도
 * 이 자리에서 스키마를 건드릴 수 없다. 특히 이 파일은 없는 열을 발견해도
 * 만들지 않는다. 확인하는 자리가 바꾸는 자리를 겸하지 않는다.
 *
 * 복구 현황(admin/payments/recovery-aggregate)과도 합치지 않는다. 그쪽은
 * order_id가 비어 있는 결제만 보는 좁은 질문이고, 이쪽은 결제 전체가 대상이다.
 * 한 질의에 넣으면 그쪽의 좁은 경계가 풀린다. 그 경계는 자기 파일만 참조된다는
 * 검사로 고정되어 있어서, 이 파일은 그 모듈 이름을 글자로도 담지 않는다.
 *
 * ── 돌려주는 값 ──
 *
 * 건수와 시각뿐이다. 두 열의 **값**은 물론이고 결제 id·주문번호·PG 거래번호·
 * 주문 id·회원 id·신청 정보도 SELECT 목록에 없다. 고르지 않으면 내보낼 수도 없다.
 * 내용이 비었는지(emptyish)는 DB 안에서 참·거짓으로만 판정하고 값은 나오지 않는다.
 *
 * 행을 돌려주지 않는다. 상태별로도 연결 여부로도 가르지 않는다. 그렇게 가르면
 * 답에 기여하지 않는 정보만 늘고, 작은 집단이 드러난다. 언제나 한 행이다.
 *
 * import 경로가 없는 이유는 다른 순수 모듈들과 같다(Node 내장 테스트 러너로 직접 실행).
 */

/* ── 질의 ───────────────────────────────────────────── */

/**
 * cancel_response_raw 열이 실제로 있는지 본다.
 *
 * 확인도 SELECT 하나이고 스키마를 바꾸지 않는다. 없으면 만들지 않는다.
 * 이 확인이 실패하는 것과, 확인해 보니 열이 없는 것은 다른 사실이다.
 * 앞은 아무것도 답할 수 없는 상태이고, 뒤는 그 자체가 답이다.
 */
export const PAYMENT_RAW_COLUMN_SQL = `
  SELECT count(*)::int AS found
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'payments'
    AND column_name = 'cancel_response_raw'
`;

/**
 * 어느 질의에나 들어가는 부분. 결제 총수와 raw의 현황이다.
 *
 * present는 SQL NULL이 아닌 행이고, emptyish는 그중 내용이 없는 것이다.
 * 둘을 나누는 이유는 저장 경로가 빈 객체를 만들 수 있기 때문이다
 * (store.ts의 writer가 `값 ? JSON.stringify(값) : null`이라 {}는 truthy로 저장된다).
 * present만 세면 "열은 차 있는데 내용은 없는" 경우가 보유로 잡힌다.
 * 객체가 아닌 값(문자열·숫자·배열·JSON null)도 같은 칸에 담는다. 정상 경로로는
 * 만들어지지 않지만 과거 데이터에 대해서는 단정할 수 없고, 어느 쪽이든
 * "읽을 내용이 없다"는 뜻은 같다.
 *
 * 시각은 created_at 하나만 본다. 그 값이 언제 저장됐는지는 기록이 없어 알 수 없다.
 * 결제가 만들어진 시각으로 규모의 시간 범위만 가늠한다.
 */
const RAW_SELECT = `
    count(*)::int AS total_payments,

    count(*) FILTER (WHERE raw IS NOT NULL)::int AS raw_present,
    count(*) FILTER (
      WHERE raw IS NOT NULL
        AND (jsonb_typeof(raw) <> 'object' OR raw = '{}'::jsonb)
    )::int AS raw_emptyish,
    min(created_at) FILTER (WHERE raw IS NOT NULL) AS raw_oldest,
    max(created_at) FILTER (WHERE raw IS NOT NULL) AS raw_newest`;

/** 열이 있을 때만 더하는 부분. 규칙은 raw 쪽과 같다. */
const CANCEL_SELECT = `,

    count(*) FILTER (WHERE cancel_response_raw IS NOT NULL)::int AS cancel_raw_present,
    count(*) FILTER (
      WHERE cancel_response_raw IS NOT NULL
        AND (
          jsonb_typeof(cancel_response_raw) <> 'object'
          OR cancel_response_raw = '{}'::jsonb
        )
    )::int AS cancel_raw_emptyish,
    min(created_at) FILTER (WHERE cancel_response_raw IS NOT NULL) AS cancel_raw_oldest,
    max(created_at) FILTER (WHERE cancel_response_raw IS NOT NULL) AS cancel_raw_newest`;

/**
 * cancel_response_raw 열이 없을 때 보내는 질의.
 *
 * 그 이름이 문장 어디에도 나오지 않는다. 없는 열을 고르면 질의가 통째로 죽고,
 * 그러면 있는 쪽(raw)의 현황까지 잃는다.
 *
 * WHERE가 없다. 결제 전체가 대상이기 때문이다. 상태나 연결 여부로 가르지 않는다.
 * 매개변수도 없다. 바깥에서 들어오는 값이 질의에 섞이지 않는다.
 */
export const PAYMENT_RAW_PRESENCE_SQL = `
  SELECT${RAW_SELECT}
  FROM payments
`;

/** cancel_response_raw 열이 있을 때 보내는 질의. 위에 취소 쪽만 더한 것이다. */
export const PAYMENT_RAW_PRESENCE_WITH_CANCEL_SQL = `
  SELECT${RAW_SELECT}${CANCEL_SELECT}
  FROM payments
`;

/* ── 바깥 세계 ──────────────────────────────────────── */

/**
 * 집계에 필요한 바깥 세계.
 *
 * 접속 문자열을 받지 않는다. DB 모드인지는 참/거짓 하나로만 받고, 질의는 넘겨받은
 * 함수로만 보낸다. 세 함수 모두 인자를 받지 않는다. 보낼 문장이 위 상수들로
 * 정해져 있어서, 호출부가 다른 문장을 끼워 넣을 자리를 만들지 않는다.
 *
 * 집계 함수를 둘로 나눠 받는 이유는, 어느 쪽을 보냈는지가 곧 "없는 열을 건드렸는가"
 * 이기 때문이다. 하나로 합쳐 참/거짓을 넘기면 그 사실이 이 모듈 밖에서 흐려진다.
 */
export interface PaymentRawPresenceDeps {
  /** DB 모드인지. 참/거짓만 받는다. */
  databaseMode: () => boolean;
  /** PAYMENT_RAW_COLUMN_SQL을 보내고 결과 행을 돌려준다. */
  queryColumn: () => Promise<readonly Record<string, unknown>[]>;
  /** PAYMENT_RAW_PRESENCE_SQL을 보낸다(취소 열을 참조하지 않는다). */
  queryRawOnly: () => Promise<readonly Record<string, unknown>[]>;
  /** PAYMENT_RAW_PRESENCE_WITH_CANCEL_SQL을 보낸다. */
  queryWithCancel: () => Promise<readonly Record<string, unknown>[]>;
}

/* ── 응답 ───────────────────────────────────────────── */

/** 언제나 셀 수 있는 열의 현황. */
export interface RawColumnPresence {
  /** SQL NULL이 아닌 행 수. */
  present: number;
  /** 그중 내용이 없는 행 수(빈 객체이거나 객체가 아님). */
  emptyish: number;
  /** 값이 남아 있는 결제 중 가장 이른 준비 시각(ISO). 0건이면 null. */
  oldestCreatedAt: string | null;
  /** 값이 남아 있는 결제 중 가장 늦은 준비 시각(ISO). 0건이면 null. */
  newestCreatedAt: string | null;
}

/**
 * 있을 수도 없을 수도 있는 열의 현황.
 *
 * columnExists가 false면 건수 칸은 전부 null이다. 0이 아니다.
 * 0은 "세어 보니 없었다"는 뜻이고, null은 "셀 대상이 없었다"는 뜻이다.
 * 두 사실을 같은 값으로 적으면 보는 쪽이 구분할 수 없다.
 */
export interface OptionalColumnPresence {
  columnExists: boolean;
  present: number | null;
  emptyish: number | null;
  oldestCreatedAt: string | null;
  newestCreatedAt: string | null;
}

/** 관리자에게 돌려줄 현황. 배열도, 자유 키도 없다. */
export interface PaymentRawPresenceBody {
  action: "payment-raw-presence";
  /** 기준 시각(ISO). 이 현황이 언제의 사실인지를 적어 둔다. */
  checkedAt: string;
  /** 결제 전체 건수. 0건인 것과 세지 못한 것을 구분하는 분모다. */
  totalPayments: number;
  raw: RawColumnPresence;
  cancelResponseRaw: OptionalColumnPresence;
}

/** 거절 사유. 고정 코드와 고정 문구뿐이다. 받은 오류도 질의도 담지 않는다. */
export const PAYMENT_RAW_PRESENCE_ERRORS = {
  DATABASE_MODE_REQUIRED: "데이터베이스 모드에서만 확인할 수 있습니다.",
  SCHEMA_CHECK_FAILED: "결제 기록의 열 구성을 확인하지 못했습니다.",
  PRESENCE_FAILED: "결제 기록 현황을 확인하지 못했습니다.",
} as const;

export type PaymentRawPresenceErrorCode = keyof typeof PAYMENT_RAW_PRESENCE_ERRORS;

export interface PaymentRawPresenceErrorBody {
  error: PaymentRawPresenceErrorCode;
  message: string;
}

export interface PaymentRawPresenceResponse {
  status: number;
  body: PaymentRawPresenceBody | PaymentRawPresenceErrorBody;
}

function refuse(code: PaymentRawPresenceErrorCode): PaymentRawPresenceResponse {
  const status = code === "DATABASE_MODE_REQUIRED" ? 409 : 500;
  return { status, body: { error: code, message: PAYMENT_RAW_PRESENCE_ERRORS[code] } };
}

/* ── 값 읽기 ────────────────────────────────────────── */

/**
 * 건수로 읽는다. 읽을 수 없으면 0이 아니라 null이고, 위에서 실패로 다룬다.
 *
 * 드라이버가 숫자로 줄 수도 문자열로 줄 수도 있어 둘 다 받는다. 0은 정상적인
 * 답이라 그대로 통과시키고, 읽지 못한 것과 구분한다. 읽지 못한 값을 0으로 적으면
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
 * null은 "그 열에 값이 남은 결제가 없다"는 뜻이다(min/max는 대상이 없으면 null을 준다).
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

/** 열이 없을 때의 현황. 건수 칸이 전부 null인 모양은 이 함수 하나가 만든다. */
function missingColumn(): OptionalColumnPresence {
  return {
    columnExists: false,
    present: null,
    emptyish: null,
    oldestCreatedAt: null,
    newestCreatedAt: null,
  };
}

/* ── 실행 ───────────────────────────────────────────── */

/**
 * 현황을 한 번 센다.
 *
 * now는 밖에서 받는다. 요청 처리 시작 시각 하나를 그대로 적기 위해서다.
 *
 * 차례는 이렇다. DB 모드 → 열 확인 → (열에 맞는) 집계 → 읽기.
 * 앞에서 걸리면 뒤 질의를 **한 번도 보내지 않는다**.
 *
 * 열 확인이 **실패하면** 멈춘다. 어느 문장을 보내야 하는지 모르는 상태라
 * 짐작으로 고르지 않는다. 확인에 성공했고 열이 **없으면** 멈추지 않는다.
 * 그것은 답이지 실패가 아니다.
 *
 * 받은 오류는 버린다. 문장·인자·접속 정보가 섞여 있을 수 있어 밖으로 내보내지 않고
 * 따로 기록하지도 않는다. 돌려주는 것은 정해 둔 코드 하나다.
 */
export async function runPaymentRawPresence(
  deps: PaymentRawPresenceDeps,
  now: string,
): Promise<PaymentRawPresenceResponse> {
  if (!deps.databaseMode()) return refuse("DATABASE_MODE_REQUIRED");

  let columnRows: readonly Record<string, unknown>[];
  try {
    columnRows = await deps.queryColumn();
  } catch {
    return refuse("SCHEMA_CHECK_FAILED");
  }
  const found = readCount(columnRows[0]?.found);
  // 확인 결과를 읽지 못했다. 열이 없다고 단정하지 않는다.
  if (found === null) return refuse("SCHEMA_CHECK_FAILED");
  const columnExists = found > 0;

  let rows: readonly Record<string, unknown>[];
  try {
    // 열이 없으면 그 이름이 없는 문장만 보낸다. 두 문장을 함께 보내지 않는다.
    rows = columnExists ? await deps.queryWithCancel() : await deps.queryRawOnly();
  } catch {
    return refuse("PRESENCE_FAILED");
  }

  const row = rows[0];
  if (!row) return refuse("PRESENCE_FAILED");

  const total = readCount(row.total_payments);
  const rawPresent = readCount(row.raw_present);
  const rawEmptyish = readCount(row.raw_emptyish);
  // 있는 열의 건수를 하나라도 읽지 못하면 현황이 아니다. 일부만 담아 내보내지 않는다.
  if (total === null || rawPresent === null || rawEmptyish === null) {
    return refuse("PRESENCE_FAILED");
  }

  let cancel: OptionalColumnPresence;
  if (!columnExists) {
    cancel = missingColumn();
  } else {
    const cancelPresent = readCount(row.cancel_raw_present);
    const cancelEmptyish = readCount(row.cancel_raw_emptyish);
    // 열이 있다고 했는데 건수를 읽지 못했다. 없음(null)으로 눕히지 않는다.
    if (cancelPresent === null || cancelEmptyish === null) return refuse("PRESENCE_FAILED");
    cancel = {
      columnExists: true,
      present: cancelPresent,
      emptyish: cancelEmptyish,
      oldestCreatedAt: readIso(row.cancel_raw_oldest),
      newestCreatedAt: readIso(row.cancel_raw_newest),
    };
  }

  return {
    status: 200,
    body: {
      action: "payment-raw-presence",
      checkedAt: now,
      totalPayments: total,
      raw: {
        present: rawPresent,
        emptyish: rawEmptyish,
        oldestCreatedAt: readIso(row.raw_oldest),
        newestCreatedAt: readIso(row.raw_newest),
      },
      cancelResponseRaw: cancel,
    },
  };
}
