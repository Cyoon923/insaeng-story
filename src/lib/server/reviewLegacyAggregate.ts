/**
 * 과거 탈퇴 회원 후기 잔존 현황 (Privacy-Reviews-Legacy-Diagnostic-2).
 *
 * 하는 일은 하나다. "탈퇴한 회원을 가리키는 후기가 지금 몇 건 남아 있는가"를
 * 숫자로만 돌려준다. 아무것도 바꾸지 않고, 아무 값도 내보내지 않는다.
 *
 * ── 왜 필요한가 ──
 *
 * 탈퇴 비식별화는 이제 후기의 작성자 표시를 지운다(withdrawAccount.scrubUserRecords).
 * 그러나 그 구현 이전에 탈퇴한 회원의 후기에는 userId와 그때의 이름이 그대로 남아 있다.
 * 코드로는 그 규모를 알 수 없다. 무엇을 할지 정하기 전에 규모부터 알아야 한다.
 *
 * 이 파일은 규모만 센다. 무엇을 지울지도, 언제 지울지도 정하지 않는다.
 *
 * ── 탈퇴 판정은 withdrawnAt 하나다 ──
 *
 * User.withdrawnAt에 값이 있으면 탈퇴한 회원이다(types/app.ts, isActiveUser).
 * 이름이 "탈퇴회원"인지, 연락처가 비었는지는 판정에 쓰지 않는다. 그것들은
 * 비식별화의 부수 효과일 뿐이고, 정본은 withdrawnAt 하나뿐이다.
 * 빈 문자열은 값이 없는 것으로 본다(코드의 truthy 판정과 같게 맞춘다).
 *
 * ── 왜 DB 안에서 세는가 ──
 *
 * 후기도 회원도 app_store.data JSONB(id = 1) 한 행 안에 있다. 그 행을 통째로
 * 읽어 오면 회원 전체의 개인정보가 애플리케이션 메모리에 올라온다. 숫자 여섯 개를
 * 얻자고 그렇게 할 이유가 없다. 그래서 집계를 DB 안에서 끝내고, 돌려받는 것은
 * 건수뿐이다. SELECT 목록에 값이 없으면 내보낼 수도 없다.
 *
 * readData()를 쓰지 않는 이유는 또 있다. 그 경로는 ensureTable·ensureAppStoreVersion을
 * 먼저 부르고, 그 둘은 CREATE와 ALTER를 보낸다(store.ts). 현황을 보기만 하려고
 * Production 저장소의 스키마를 건드릴 수 없다. 확인하는 자리가 바꾸는 자리를 겸하지 않는다.
 * 이 파일은 저장소 모듈을 import하지 않는다. 쓸 수 없게 해 두면 나중에도 그럴 수 없다.
 *
 * ── 세는 칸이 서로 겹치지 않는다 ──
 *
 * 후기 한 건은 아래 넷 중 정확히 하나에 들어간다. 합은 언제나 totalReviews다.
 *   noUserId        userId가 없다(이미 비식별화됐거나 애초에 없던 예전 자료)
 *   linkedUnknown   userId는 있으나 그 id의 회원이 users에 없다
 *   linkedActive    userId가 탈퇴하지 않은 회원을 가리킨다
 *   linkedWithdrawn userId가 탈퇴한 회원을 가리킨다  ← 이번에 알고 싶은 값
 *
 * withdrawnNameNotAnonymized는 linkedWithdrawn의 부분집합이다.
 * **실명이 남아 있는 건수가 아니다.** 이름은 작성자가 자유로 적는 값이라
 * 실명인지 코드로 판정할 수 없다. 이 값은 "익명화 표식이 아직 없는 건수",
 * 곧 상한값으로만 읽어야 한다.
 *
 * ── 돌려주는 값 ──
 *
 * 건수와 시각뿐이다. userId·이름·후기 본문·대상(targetKey)·회원 정보는 SELECT 목록에
 * 아예 없다. 행을 돌려주지도 않고, 상품별·기간별로 쪼개지도 않는다. 쪼개면 답에
 * 기여하지 않는 정보만 늘고 작은 집단이 드러난다. 언제나 한 행이다.
 *
 * import 경로가 없는 이유는 다른 순수 모듈들과 같다(Node 내장 테스트 러너로 직접 실행).
 */

/* ── 질의 ───────────────────────────────────────────── */

/** 비식별화된 후기의 이름 자리에 남는 값. withdrawAccount.WITHDRAWN_NAME과 같아야 한다. */
export const REVIEW_ANONYMIZED_NAME = "탈퇴회원";

/**
 * 후기 잔존 현황을 세는 질의. SELECT 하나이고 매개변수가 없다.
 *
 * 읽는 것은 app_store 한 행의 data JSONB뿐이다. 그 안에서 users와 reviews를
 * 펼쳐 맞춰 보고, 밖으로 나가는 것은 count 여섯 개다. data 자체도,
 * 펼친 원소도 SELECT 목록에 없다.
 *
 * users를 id로 한 번 묶는(GROUP BY) 이유는 같은 id가 두 번 들어 있는 과거 자료가
 * 있어도 후기 건수가 부풀지 않게 하기 위해서다. 묶지 않으면 join이 행을 늘린다.
 *
 * 값이 없는 경우를 문자열로 가른다. ->> 는 JSON null에도 SQL NULL을 주고,
 * NULLIF(...,'')가 빈 문자열까지 같은 자리로 모은다. 코드가 truthy로 판정하는 것과
 * 같은 경계다(빈 값은 "없음"이다).
 *
 * GROUP BY가 없어 결과는 언제나 한 행이다. app_store 행이 아직 없어도 마찬가지이며,
 * 그때는 여섯 칸이 전부 0이다(reviewLegacyAggregate.test.sql에서 실제로 확인했다).
 * 즉 이 문장만으로는 "저장된 것이 없다"와 "후기가 0건이다"를 구분하지 않는다.
 * 지금 질문에서는 그 구분이 답을 바꾸지 않는다. 어느 쪽이든 지울 후기가 없다는 뜻이다.
 */
export const REVIEW_LEGACY_AGGREGATE_SQL = `
  WITH src AS (
    SELECT data FROM app_store WHERE id = 1
  ),
  member AS (
    SELECT
      u.value->>'id' AS id,
      bool_or(NULLIF(u.value->>'withdrawnAt', '') IS NOT NULL) AS withdrawn
    FROM src, LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(src.data->'users') = 'array'
           THEN src.data->'users' ELSE '[]'::jsonb END
    ) AS u
    WHERE NULLIF(u.value->>'id', '') IS NOT NULL
    GROUP BY u.value->>'id'
  ),
  review AS (
    SELECT
      NULLIF(r.value->>'userId', '') AS user_id,
      (r.value->>'name' IS DISTINCT FROM '${REVIEW_ANONYMIZED_NAME}') AS name_not_anonymized
    FROM src, LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(src.data->'reviews') = 'array'
           THEN src.data->'reviews' ELSE '[]'::jsonb END
    ) AS r
  ),
  joined AS (
    SELECT
      review.user_id IS NOT NULL AS linked,
      member.id IS NOT NULL AS known,
      COALESCE(member.withdrawn, false) AS withdrawn,
      review.name_not_anonymized
    FROM review LEFT JOIN member ON member.id = review.user_id
  )
  SELECT
    count(*)::int AS total_reviews,
    count(*) FILTER (WHERE NOT linked)::int AS no_user_id,
    count(*) FILTER (WHERE linked AND NOT known)::int AS linked_unknown,
    count(*) FILTER (WHERE linked AND known AND NOT withdrawn)::int AS linked_active,
    count(*) FILTER (WHERE linked AND known AND withdrawn)::int AS linked_withdrawn,
    count(*) FILTER (
      WHERE linked AND known AND withdrawn AND name_not_anonymized
    )::int AS withdrawn_name_not_anonymized
  FROM joined
`;

/* ── 바깥 세계 ──────────────────────────────────────── */

/**
 * 집계에 필요한 바깥 세계.
 *
 * 접속 문자열을 받지 않는다. DB 모드인지는 참·거짓 하나로만 받고, 질의는 넘겨받은
 * 함수로 보낸다. 그 함수는 인자를 받지 않는다. 보낼 문장이 위 상수 하나로 정해져
 * 있어서, 호출부가 다른 문장을 끼워 넣을 자리를 만들지 않는다.
 */
export interface ReviewLegacyAggregateDeps {
  /** DB 모드인지. 참·거짓만 받는다. */
  databaseMode: () => boolean;
  /** REVIEW_LEGACY_AGGREGATE_SQL을 보내고 결과 행을 돌려준다. */
  queryAggregate: () => Promise<readonly Record<string, unknown>[]>;
}

/* ── 응답 ───────────────────────────────────────────── */

/** 관리자에게 돌려줄 현황. 배열도, 자유 키도, 값도 없다. */
export interface ReviewLegacyAggregateBody {
  action: "review-legacy-aggregate";
  /** 기준 시각(ISO). 이 현황이 언제의 사실인지를 적어 둔다. */
  checkedAt: string;
  /** DB 모드에서 센 결과라는 표시. 이 본문에서는 언제나 true다. */
  databaseMode: true;
  /** 후기 전체 건수. 아래 네 칸의 합과 같다. */
  totalReviews: number;
  /** userId가 탈퇴하지 않은 회원을 가리키는 후기 수. */
  linkedActive: number;
  /** userId가 탈퇴한 회원을 가리키는 후기 수. 이번에 알고 싶은 값이다. */
  linkedWithdrawn: number;
  /** userId는 있으나 그 회원이 users에 없는 후기 수. */
  linkedUnknown: number;
  /** userId가 없는 후기 수(이미 비식별화됐거나 애초에 없던 예전 자료). */
  noUserId: number;
  /**
   * linkedWithdrawn 중 이름이 "탈퇴회원"이 아닌 후기 수.
   * 실명 잔존 수가 아니라 익명화 표식 미적용 수다(상한값).
   */
  withdrawnNameNotAnonymized: number;
}

/** 거절 사유. 고정 코드와 고정 문구뿐이다. 받은 오류도 질의도 담지 않는다. */
export const REVIEW_LEGACY_AGGREGATE_ERRORS = {
  DATABASE_MODE_REQUIRED: "데이터베이스 모드에서만 확인할 수 있습니다.",
  AGGREGATE_FAILED: "후기 현황을 확인하지 못했습니다.",
} as const;

export type ReviewLegacyAggregateErrorCode = keyof typeof REVIEW_LEGACY_AGGREGATE_ERRORS;

export interface ReviewLegacyAggregateErrorBody {
  error: ReviewLegacyAggregateErrorCode;
  message: string;
  checkedAt: string;
  databaseMode: boolean;
}

export interface ReviewLegacyAggregateResponse {
  status: number;
  body: ReviewLegacyAggregateBody | ReviewLegacyAggregateErrorBody;
}

function refuse(
  code: ReviewLegacyAggregateErrorCode,
  now: string,
  databaseMode: boolean,
): ReviewLegacyAggregateResponse {
  return {
    status: code === "DATABASE_MODE_REQUIRED" ? 409 : 500,
    body: {
      error: code,
      message: REVIEW_LEGACY_AGGREGATE_ERRORS[code],
      checkedAt: now,
      databaseMode,
    },
  };
}

/* ── 값 읽기 ────────────────────────────────────────── */

/**
 * 건수로 읽는다. 읽을 수 없으면 0이 아니라 null이고, 위에서 실패로 다룬다.
 *
 * 드라이버가 숫자로 줄 수도 문자열로 줄 수도 있어 둘 다 받는다. 0은 정상적인
 * 답이라 그대로 통과시키고, 읽지 못한 것과 구분한다. 읽지 못한 값을 0으로 적으면
 * "세어 보니 없었다"로 읽히기 때문이다.
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

/* ── 실행 ───────────────────────────────────────────── */

/**
 * 현황을 한 번 센다.
 *
 * now는 밖에서 받는다. 요청 처리 시작 시각 하나를 그대로 적기 위해서다.
 *
 * 차례는 DB 모드 → 집계 → 읽기다. 앞에서 걸리면 질의를 한 번도 보내지 않는다.
 *
 * 받은 오류는 버린다. 문장·인자·접속 정보가 섞여 있을 수 있어 밖으로 내보내지 않고
 * 따로 기록하지도 않는다. 돌려주는 것은 정해 둔 코드 하나다.
 *
 * 여섯 칸 중 하나라도 읽지 못하면 전부 실패로 다룬다. 일부만 채워 돌려주면
 * 보는 쪽이 빠진 칸을 0으로 읽는다.
 */
export async function runReviewLegacyAggregate(
  deps: ReviewLegacyAggregateDeps,
  now: string,
): Promise<ReviewLegacyAggregateResponse> {
  if (!deps.databaseMode()) return refuse("DATABASE_MODE_REQUIRED", now, false);

  let rows: readonly Record<string, unknown>[];
  try {
    rows = await deps.queryAggregate();
  } catch {
    return refuse("AGGREGATE_FAILED", now, true);
  }

  // 이 문장은 언제나 한 행을 준다(집계에 GROUP BY가 없다). 행이 없다면 문장이 바뀌었거나
  // 드라이버가 결과를 주지 못한 것이다. 그때는 0건으로 적지 않고 세지 못한 것으로 다룬다.
  const row = rows[0];
  if (!row) return refuse("AGGREGATE_FAILED", now, true);

  const totalReviews = readCount(row.total_reviews);
  const linkedActive = readCount(row.linked_active);
  const linkedWithdrawn = readCount(row.linked_withdrawn);
  const linkedUnknown = readCount(row.linked_unknown);
  const noUserId = readCount(row.no_user_id);
  const withdrawnNameNotAnonymized = readCount(row.withdrawn_name_not_anonymized);

  if (
    totalReviews === null ||
    linkedActive === null ||
    linkedWithdrawn === null ||
    linkedUnknown === null ||
    noUserId === null ||
    withdrawnNameNotAnonymized === null
  ) {
    return refuse("AGGREGATE_FAILED", now, true);
  }

  return {
    status: 200,
    body: {
      action: "review-legacy-aggregate",
      checkedAt: now,
      databaseMode: true,
      totalReviews,
      linkedActive,
      linkedWithdrawn,
      linkedUnknown,
      noUserId,
      withdrawnNameNotAnonymized,
    },
  };
}
