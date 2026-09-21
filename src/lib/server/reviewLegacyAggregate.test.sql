-- 과거 탈퇴 회원 후기 잔존 현황 질의 테스트 (Privacy-Reviews-Legacy-Diagnostic-4).
--
-- reviewLegacyAggregate.ts의 REVIEW_LEGACY_AGGREGATE_SQL과 **같은 문장**을 실제
-- PostgreSQL에 실행해, 후기 한 건이 어느 칸으로 분류되는지를 본다.
--
-- JavaScript로는 볼 수 없다. 분류가 코드가 아니라 JSONB 연산과 LEFT JOIN의 결과에서
-- 나오기 때문이다. 문장이 어떤 조건을 담았는지는 reviewLegacyAggregate.test.ts가 따로 본다.
-- 그 테스트는 아래 표식 사이의 문장이 TS 상수와 같은지도 함께 본다(복사본 어긋남 방지).
--
-- 실행 (Production이 아니라 **이번 테스트 전용 임시 DB**에서만):
--   psql "<임시 로컬 DB URL>" -v ON_ERROR_STOP=1 -f src/lib/server/reviewLegacyAggregate.test.sql
--
-- $DATABASE_URL을 쓰지 않는다. 이 파일은 app_store를 만들고 값을 넣으므로
-- 실제 저장소를 가리키면 안 된다. BEGIN ~ ROLLBACK으로 감싸 아무것도 남기지 않는다.
BEGIN;

CREATE TABLE IF NOT EXISTS app_store (
  id INTEGER PRIMARY KEY,
  data JSONB NOT NULL,
  version BIGINT NOT NULL DEFAULT 0
);

INSERT INTO app_store (id, data, version) VALUES (1, '{}'::jsonb, 0);

/*
 * 질의를 뷰로 걸어 둔다. 자료를 바꿔 가며 여러 번 세기 위해서다.
 * 표식 사이는 TS 상수를 그대로 옮긴 것이다. 한 글자도 바꾸지 않는다.
 */
CREATE TEMP VIEW review_legacy_aggregate AS
-- >>> REVIEW_LEGACY_AGGREGATE_SQL >>>
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
      (r.value->>'name' IS DISTINCT FROM '탈퇴회원') AS name_not_anonymized
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
-- <<< REVIEW_LEGACY_AGGREGATE_SQL <<<
;

-- ── 1) 모든 경우를 한 자료에 담아 센다 ──
--
-- 회원 다섯(활성 둘·탈퇴 셋, 그중 하나는 같은 id가 두 번 들어 있다)과 후기 아홉.
-- 후기 하나하나가 어느 칸으로 가야 하는지 옆에 적어 둔다.
UPDATE app_store SET data = '{
  "users": [
    {"id":"u-active","name":"김채영"},
    {"id":"u-empty","name":"이서준","withdrawnAt":""},
    {"id":"u-gone1","name":"탈퇴회원","withdrawnAt":"2026-01-01T00:00:00.000Z"},
    {"id":"u-gone2","name":"탈퇴회원","withdrawnAt":"2026-02-01T00:00:00.000Z"},
    {"id":"u-dup","name":"탈퇴회원","withdrawnAt":"2026-03-01T00:00:00.000Z"},
    {"id":"u-dup","name":"탈퇴회원","withdrawnAt":"2026-03-01T00:00:00.000Z"}
  ],
  "reviews": [
    {"id":"r1","userId":"u-active","name":"김채영"},
    {"id":"r2","userId":"u-empty","name":"이서준"},
    {"id":"r3","userId":"u-gone1","name":"탈퇴회원"},
    {"id":"r4","userId":"u-gone2","name":"박지훈"},
    {"id":"r5","userId":"u-dup","name":"최유진"},
    {"id":"r6","userId":"u-missing","name":"정하늘"},
    {"id":"r7","name":"한여름"},
    {"id":"r8","userId":"","name":"오세영"},
    {"id":"r9","userId":null,"name":"문지우"}
  ]
}'::jsonb WHERE id = 1;

DO $$
DECLARE agg record;
BEGIN
  SELECT * INTO agg FROM review_legacy_aggregate;

  -- 후기 아홉 건 전부가 한 번씩만 세어진다(중복 회원 id가 건수를 부풀리지 않는다).
  ASSERT agg.total_reviews = 9, format('total_reviews=%s', agg.total_reviews);

  -- r1(활성) + r2(withdrawnAt이 빈 문자열 → 활성으로 본다)
  ASSERT agg.linked_active = 2, format('linked_active=%s', agg.linked_active);

  -- r3(익명화됨) + r4(이름 남음) + r5(중복 id 회원, 한 번만)
  ASSERT agg.linked_withdrawn = 3, format('linked_withdrawn=%s', agg.linked_withdrawn);

  -- r6: users에 없는 userId
  ASSERT agg.linked_unknown = 1, format('linked_unknown=%s', agg.linked_unknown);

  -- r7(키 없음) + r8(빈 문자열) + r9(JSON null)
  ASSERT agg.no_user_id = 3, format('no_user_id=%s', agg.no_user_id);

  -- r4, r5만. r3은 "탈퇴회원"이라 빠지고, r6·r7은 탈퇴 연결분이 아니라 애초에 대상이 아니다.
  ASSERT agg.withdrawn_name_not_anonymized = 2,
    format('withdrawn_name_not_anonymized=%s', agg.withdrawn_name_not_anonymized);

  -- 네 칸은 서로 겹치지 않으며 합이 전체와 같다.
  ASSERT agg.no_user_id + agg.linked_unknown + agg.linked_active + agg.linked_withdrawn
         = agg.total_reviews, '네 칸의 합이 전체와 다르다';

  -- 이름 미익명화는 탈퇴 연결분의 부분집합이다.
  ASSERT agg.withdrawn_name_not_anonymized <= agg.linked_withdrawn,
    '이름 미익명화가 탈퇴 연결분보다 많다';
END $$;

-- ── 2) users가 없으면 연결된 후기가 전부 unknown이 된다 ──
--
-- 회원 목록을 읽지 못한 것을 "탈퇴자 없음"으로 읽으면 안 된다.
UPDATE app_store SET data = '{
  "reviews": [
    {"id":"r1","userId":"u-gone1","name":"박지훈"},
    {"id":"r2","name":"한여름"}
  ]
}'::jsonb WHERE id = 1;

DO $$
DECLARE agg record;
BEGIN
  SELECT * INTO agg FROM review_legacy_aggregate;
  ASSERT agg.total_reviews = 2, format('total_reviews=%s', agg.total_reviews);
  ASSERT agg.linked_unknown = 1, format('linked_unknown=%s', agg.linked_unknown);
  ASSERT agg.no_user_id = 1, format('no_user_id=%s', agg.no_user_id);
  ASSERT agg.linked_withdrawn = 0, format('linked_withdrawn=%s', agg.linked_withdrawn);
  ASSERT agg.withdrawn_name_not_anonymized = 0, '탈퇴 연결분이 없는데 이름 칸이 찼다';
END $$;

-- ── 3) 후기 목록이 없으면 0건이다(질의가 죽지 않는다) ──
UPDATE app_store SET data = '{"users":[{"id":"u-1"}]}'::jsonb WHERE id = 1;

DO $$
DECLARE agg record;
BEGIN
  SELECT * INTO agg FROM review_legacy_aggregate;
  ASSERT agg.total_reviews = 0, format('total_reviews=%s', agg.total_reviews);
  ASSERT agg.no_user_id = 0 AND agg.linked_unknown = 0
     AND agg.linked_active = 0 AND agg.linked_withdrawn = 0
     AND agg.withdrawn_name_not_anonymized = 0, '후기가 없는데 어떤 칸이 찼다';
END $$;

-- ── 4) users·reviews가 배열이 아니어도 죽지 않는다 ──
--
-- 정상 경로로는 만들어지지 않지만 예전 자료에 대해서는 단정할 수 없다.
-- 여기서 질의가 죽으면 알고 싶었던 규모를 영영 알 수 없다.
UPDATE app_store SET data = '{"users": 5, "reviews": {"a": 1}}'::jsonb WHERE id = 1;

DO $$
DECLARE agg record;
BEGIN
  SELECT * INTO agg FROM review_legacy_aggregate;
  ASSERT agg.total_reviews = 0, format('total_reviews=%s', agg.total_reviews);
END $$;

-- ── 5) 두 키가 아예 없어도 한 행이 나온다 ──
--
-- 0행과 0건은 다른 사실이다. 여기서는 "세어 보니 0건"이 나와야 한다.
UPDATE app_store SET data = '{}'::jsonb WHERE id = 1;

DO $$
DECLARE rows int;
DECLARE agg record;
BEGIN
  SELECT count(*) INTO rows FROM review_legacy_aggregate;
  ASSERT rows = 1, format('행 수=%s', rows);
  SELECT * INTO agg FROM review_legacy_aggregate;
  ASSERT agg.total_reviews = 0, format('total_reviews=%s', agg.total_reviews);
END $$;

-- ── 6) app_store 행이 없어도 한 행이 나온다. 전부 0이다 ──
--
-- GROUP BY 없는 집계는 대상이 하나도 없어도 언제나 한 행을 준다.
-- 따라서 이 질의만으로는 "저장된 것이 없다"와 "후기가 0건이다"를 구분할 수 없다.
-- 구분이 필요해지면 행 존재 여부를 따로 물어야 한다(지금은 그 구분이 답을 바꾸지 않는다.
-- 어느 쪽이든 지울 후기가 없다는 뜻이다).
DELETE FROM app_store WHERE id = 1;

DO $$
DECLARE rows int;
DECLARE agg record;
BEGIN
  SELECT count(*) INTO rows FROM review_legacy_aggregate;
  ASSERT rows = 1, format('한 행이어야 하는데 %s행이다', rows);
  SELECT * INTO agg FROM review_legacy_aggregate;
  ASSERT agg.total_reviews = 0, format('total_reviews=%s', agg.total_reviews);
END $$;

ROLLBACK;
