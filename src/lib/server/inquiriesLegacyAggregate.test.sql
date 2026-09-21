-- 문의 잔존 현황 질의 테스트 (Privacy-Inquiries-Chat-Diagnostic-2).
--
-- inquiriesLegacyAggregate.ts의 두 상수와 **같은 문장**을 실제 PostgreSQL에 실행해,
-- 문의 한 건·메시지 한 행이 어느 칸으로 분류되는지를 본다.
--
-- JavaScript로는 볼 수 없다. 분류가 코드가 아니라 JSONB 연산과 LEFT JOIN의 결과에서
-- 나오기 때문이다. 문장이 어떤 조건을 담았는지는 inquiriesLegacyAggregate.test.ts가
-- 따로 본다. 그 테스트는 아래 표식 사이의 문장이 TS 상수와 같은지도 함께 본다
-- (복사본 어긋남 방지).
--
-- 실행 (Production이 아니라 **이번 테스트 전용 임시 DB**에서만):
--   psql "<임시 로컬 DB URL>" -v ON_ERROR_STOP=1 -f src/lib/server/inquiriesLegacyAggregate.test.sql
--
-- $DATABASE_URL을 쓰지 않는다. 이 파일은 표를 만들고 값을 넣으므로 실제 저장소를
-- 가리키면 안 된다. BEGIN ~ ROLLBACK으로 감싸 아무것도 남기지 않는다.
BEGIN;

CREATE TABLE IF NOT EXISTS app_store (
  id INTEGER PRIMARY KEY,
  data JSONB NOT NULL,
  version BIGINT NOT NULL DEFAULT 0
);

-- store.ts의 정의를 그대로 옮긴다. 특히 FK와 ON DELETE CASCADE를 그대로 둔다.
-- orphan을 만들려고 FK를 빼면, 실제 스키마가 아닌 다른 것을 검증하게 된다.
CREATE TABLE IF NOT EXISTS chat_inquiries (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  guest_token_hash TEXT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  contact_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_inquiry_messages (
  id TEXT PRIMARY KEY,
  inquiry_id TEXT NOT NULL REFERENCES chat_inquiries(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO app_store (id, data, version) VALUES (1, '{}'::jsonb, 0);

/*
 * 질의를 뷰로 걸어 둔다. 자료를 바꿔 가며 여러 번 세기 위해서다.
 * 표식 사이는 TS 상수를 그대로 옮긴 것이다. 한 글자도 바꾸지 않는다.
 */
CREATE TEMP VIEW legacy_inquiries_aggregate AS
-- >>> LEGACY_INQUIRIES_AGGREGATE_SQL >>>
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
  inquiry AS (
    SELECT
      NULLIF(i.value->>'userId', '') AS user_id,
      (i.value->>'name' IS DISTINCT FROM '탈퇴회원') AS name_not_anonymized,
      NULLIF(i.value->>'name', '') IS NOT NULL AS name_present,
      NULLIF(i.value->>'phone', '') IS NOT NULL AS phone_present,
      NULLIF(i.value->>'message', '') IS NOT NULL AS message_present
    FROM src, LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(src.data->'inquiries') = 'array'
           THEN src.data->'inquiries' ELSE '[]'::jsonb END
    ) AS i
  ),
  joined AS (
    SELECT
      inquiry.user_id IS NOT NULL AS linked,
      member.id IS NOT NULL AS known,
      COALESCE(member.withdrawn, false) AS withdrawn,
      inquiry.name_not_anonymized,
      inquiry.name_present,
      inquiry.phone_present,
      inquiry.message_present
    FROM inquiry LEFT JOIN member ON member.id = inquiry.user_id
  )
  SELECT
    count(*)::int AS total,
    count(*) FILTER (WHERE linked AND known AND NOT withdrawn)::int AS member_linked_active,
    count(*) FILTER (WHERE linked AND known AND withdrawn)::int AS member_linked_withdrawn,
    count(*) FILTER (WHERE linked AND NOT known)::int AS member_linked_unknown,
    count(*) FILTER (WHERE NOT linked)::int AS guest_no_user_id,
    count(*) FILTER (
      WHERE linked AND known AND withdrawn AND name_not_anonymized
    )::int AS withdrawn_name_not_anonymized,
    count(*) FILTER (
      WHERE linked AND known AND withdrawn AND phone_present
    )::int AS withdrawn_phone_not_cleared,
    count(*) FILTER (
      WHERE linked AND known AND withdrawn AND message_present
    )::int AS withdrawn_message_present,
    count(*) FILTER (
      WHERE linked AND known AND withdrawn
    )::int AS withdrawn_user_id_present,
    count(*) FILTER (WHERE NOT linked AND name_present)::int AS guest_name_present,
    count(*) FILTER (WHERE NOT linked AND phone_present)::int AS guest_phone_present,
    count(*) FILTER (WHERE NOT linked AND message_present)::int AS guest_message_present
  FROM joined
-- <<< LEGACY_INQUIRIES_AGGREGATE_SQL <<<
;

CREATE TEMP VIEW chat_inquiries_aggregate AS
-- >>> CHAT_INQUIRIES_AGGREGATE_SQL >>>
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
  inquiry AS (
    SELECT
      c.id AS inquiry_id,
      NULLIF(c.user_id, '') IS NOT NULL AS linked,
      NULLIF(c.guest_token_hash, '') IS NOT NULL AS tokened,
      member.id IS NOT NULL AS known,
      COALESCE(member.withdrawn, false) AS withdrawn,
      (c.name IS DISTINCT FROM '탈퇴회원') AS name_not_anonymized,
      NULLIF(c.name, '') IS NOT NULL AS name_present,
      NULLIF(c.phone, '') IS NOT NULL AS phone_present
    FROM chat_inquiries c
    LEFT JOIN member ON member.id = NULLIF(c.user_id, '')
  ),
  inquiry_counts AS (
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE linked AND known AND NOT withdrawn)::int AS member_linked_active,
      count(*) FILTER (WHERE linked AND known AND withdrawn)::int AS member_linked_withdrawn,
      count(*) FILTER (WHERE linked AND NOT known)::int AS member_linked_unknown,
      count(*) FILTER (WHERE NOT linked AND tokened)::int AS guest_with_token,
      count(*) FILTER (WHERE NOT linked AND NOT tokened)::int AS unlinked_no_user_no_guest_token,
      count(*) FILTER (
        WHERE linked AND known AND withdrawn AND name_not_anonymized
      )::int AS withdrawn_name_not_anonymized,
      count(*) FILTER (
        WHERE linked AND known AND withdrawn AND phone_present
      )::int AS withdrawn_phone_not_cleared,
      count(*) FILTER (
        WHERE linked AND known AND withdrawn
      )::int AS withdrawn_user_id_present,
      count(*) FILTER (WHERE NOT linked AND tokened AND name_present)::int AS guest_name_present,
      count(*) FILTER (WHERE NOT linked AND tokened AND phone_present)::int AS guest_phone_present
    FROM inquiry
  ),
  message_counts AS (
    SELECT
      count(*)::int AS total_messages,
      count(*) FILTER (
        WHERE inquiry.linked AND inquiry.known AND NOT inquiry.withdrawn
      )::int AS messages_for_active_member_inquiry,
      count(*) FILTER (
        WHERE inquiry.linked AND inquiry.known AND inquiry.withdrawn
      )::int AS messages_for_withdrawn_member_inquiry,
      count(*) FILTER (
        WHERE inquiry.linked AND NOT inquiry.known
      )::int AS messages_for_unknown_member_inquiry,
      count(*) FILTER (
        WHERE NOT inquiry.linked AND inquiry.tokened
      )::int AS messages_for_guest_inquiry,
      count(*) FILTER (
        WHERE NOT inquiry.linked AND NOT inquiry.tokened
      )::int AS messages_for_unlinked_inquiry,
      count(*) FILTER (WHERE inquiry.inquiry_id IS NULL)::int AS orphan_messages,
      count(*) FILTER (
        WHERE inquiry.linked AND inquiry.known AND inquiry.withdrawn
          AND NULLIF(m.body, '') IS NOT NULL
      )::int AS withdrawn_message_body_present,
      count(*) FILTER (
        WHERE NOT inquiry.linked AND inquiry.tokened
          AND NULLIF(m.body, '') IS NOT NULL
      )::int AS guest_message_body_present
    FROM chat_inquiry_messages m
    LEFT JOIN inquiry ON inquiry.inquiry_id = m.inquiry_id
  )
  SELECT
    inquiry_counts.total,
    inquiry_counts.member_linked_active,
    inquiry_counts.member_linked_withdrawn,
    inquiry_counts.member_linked_unknown,
    inquiry_counts.guest_with_token,
    inquiry_counts.unlinked_no_user_no_guest_token,
    inquiry_counts.withdrawn_name_not_anonymized,
    inquiry_counts.withdrawn_phone_not_cleared,
    inquiry_counts.withdrawn_user_id_present,
    inquiry_counts.guest_name_present,
    inquiry_counts.guest_phone_present,
    message_counts.total_messages,
    message_counts.messages_for_active_member_inquiry,
    message_counts.messages_for_withdrawn_member_inquiry,
    message_counts.messages_for_unknown_member_inquiry,
    message_counts.messages_for_guest_inquiry,
    message_counts.messages_for_unlinked_inquiry,
    message_counts.orphan_messages,
    message_counts.withdrawn_message_body_present,
    message_counts.guest_message_body_present
  FROM inquiry_counts, message_counts
-- <<< CHAT_INQUIRIES_AGGREGATE_SQL <<<
;

-- ══════════════════════════════════════════════════════
-- [A] app_store.data.inquiries[]
-- ══════════════════════════════════════════════════════

-- ── A-1) 모든 경우를 한 자료에 담아 센다 ──
--
-- 회원 다섯(활성 둘·탈퇴 셋, 그중 하나는 같은 id가 두 번 들어 있다)과 문의 열.
UPDATE app_store SET data = '{
  "users": [
    {"id":"u-active","name":"김채영"},
    {"id":"u-empty","name":"이서준","withdrawnAt":""},
    {"id":"u-gone1","name":"탈퇴회원","withdrawnAt":"2026-01-01T00:00:00.000Z"},
    {"id":"u-gone2","name":"탈퇴회원","withdrawnAt":"2026-02-01T00:00:00.000Z"},
    {"id":"u-dup","name":"탈퇴회원","withdrawnAt":"2026-03-01T00:00:00.000Z"},
    {"id":"u-dup","name":"탈퇴회원","withdrawnAt":"2026-03-01T00:00:00.000Z"}
  ],
  "inquiries": [
    {"id":"q1","userId":"u-active","name":"김채영","phone":"01011112222","message":"문의합니다"},
    {"id":"q2","userId":"u-empty","name":"이서준","phone":"01022223333","message":"문의합니다"},
    {"id":"q3","userId":"u-gone1","name":"탈퇴회원","phone":"","message":"문의합니다"},
    {"id":"q4","userId":"u-gone2","name":"박지훈","phone":"01033334444","message":"문의합니다"},
    {"id":"q5","userId":"u-dup","name":"탈퇴회원","phone":"","message":""},
    {"id":"q6","userId":"u-missing","name":"정하늘","phone":"01044445555","message":"문의합니다"},
    {"id":"q7","name":"한여름","phone":"01055556666","message":"문의합니다"},
    {"id":"q8","userId":"","name":"오세영","phone":"","message":"문의합니다"},
    {"id":"q9","userId":null,"name":"","phone":"01077778888","message":null},
    12345
  ]
}'::jsonb WHERE id = 1;

DO $$
DECLARE agg record;
BEGIN
  SELECT * INTO agg FROM legacy_inquiries_aggregate;

  -- 열 건 전부가 한 번씩만 세어진다(중복 회원 id가 건수를 부풀리지 않는다).
  -- 마지막 원소 12345는 객체가 아니지만 질의가 죽지 않고 "userId 없음"으로 센다.
  ASSERT agg.total = 10, format('total=%s', agg.total);

  -- q1(활성) + q2(withdrawnAt이 빈 문자열 → 활성으로 본다)
  ASSERT agg.member_linked_active = 2, format('active=%s', agg.member_linked_active);

  -- q3 + q4 + q5(중복 id 회원, 한 번만)
  ASSERT agg.member_linked_withdrawn = 3, format('withdrawn=%s', agg.member_linked_withdrawn);

  -- q6: users에 없는 userId
  ASSERT agg.member_linked_unknown = 1, format('unknown=%s', agg.member_linked_unknown);

  -- q7(키 없음) + q8(빈 문자열) + q9(JSON null) + 12345(객체 아님)
  ASSERT agg.guest_no_user_id = 4, format('guest=%s', agg.guest_no_user_id);

  -- 네 칸은 서로 겹치지 않으며 합이 전체와 같다.
  ASSERT agg.member_linked_active + agg.member_linked_withdrawn
       + agg.member_linked_unknown + agg.guest_no_user_id = agg.total,
    '[A] 네 칸의 합이 전체와 다르다';

  -- q4만. q3·q5는 "탈퇴회원"이라 빠진다.
  ASSERT agg.withdrawn_name_not_anonymized = 1,
    format('name_not_anon=%s', agg.withdrawn_name_not_anonymized);

  -- q4만. q3·q5는 phone이 비었다.
  ASSERT agg.withdrawn_phone_not_cleared = 1,
    format('phone_not_cleared=%s', agg.withdrawn_phone_not_cleared);

  -- q3 + q4. q5는 message가 빈 문자열이다.
  ASSERT agg.withdrawn_message_present = 2,
    format('message_present=%s', agg.withdrawn_message_present);

  -- 현재 비식별화는 userId를 지우지 않는다. 탈퇴 연결분 전부와 같아야 한다.
  ASSERT agg.withdrawn_user_id_present = agg.member_linked_withdrawn,
    format('userid_present=%s', agg.withdrawn_user_id_present);

  -- q7 + q8. q9는 이름이 빈 문자열, 12345는 이름 자체가 없다.
  ASSERT agg.guest_name_present = 2, format('guest_name=%s', agg.guest_name_present);

  -- q7 + q9. q8은 phone이 빈 문자열이다.
  ASSERT agg.guest_phone_present = 2, format('guest_phone=%s', agg.guest_phone_present);

  -- q7 + q8. q9는 message가 JSON null이다.
  ASSERT agg.guest_message_present = 2, format('guest_message=%s', agg.guest_message_present);

  -- 부분집합 관계가 지켜진다.
  ASSERT agg.withdrawn_name_not_anonymized <= agg.member_linked_withdrawn
     AND agg.withdrawn_phone_not_cleared <= agg.member_linked_withdrawn
     AND agg.withdrawn_message_present <= agg.member_linked_withdrawn
     AND agg.guest_name_present <= agg.guest_no_user_id
     AND agg.guest_phone_present <= agg.guest_no_user_id
     AND agg.guest_message_present <= agg.guest_no_user_id,
    '[A] 부분집합이 모집단보다 많다';
END $$;

-- ── A-2) users가 없으면 연결된 문의가 전부 unknown이 된다 ──
--
-- 회원 목록을 읽지 못한 것을 "탈퇴자 없음"으로 읽으면 안 된다.
UPDATE app_store SET data = '{
  "inquiries": [
    {"id":"q1","userId":"u-gone1","name":"박지훈","phone":"01011112222","message":"m"},
    {"id":"q2","name":"한여름","phone":"01022223333","message":"m"}
  ]
}'::jsonb WHERE id = 1;

DO $$
DECLARE agg record;
BEGIN
  SELECT * INTO agg FROM legacy_inquiries_aggregate;
  ASSERT agg.total = 2, format('total=%s', agg.total);
  ASSERT agg.member_linked_unknown = 1, format('unknown=%s', agg.member_linked_unknown);
  ASSERT agg.guest_no_user_id = 1, format('guest=%s', agg.guest_no_user_id);
  ASSERT agg.member_linked_withdrawn = 0, format('withdrawn=%s', agg.member_linked_withdrawn);
  ASSERT agg.withdrawn_name_not_anonymized = 0, '탈퇴 연결분이 없는데 이름 칸이 찼다';
END $$;

-- ── A-3) 문의 목록이 없으면 0건이다(질의가 죽지 않는다) ──
UPDATE app_store SET data = '{"users":[{"id":"u-1"}]}'::jsonb WHERE id = 1;

DO $$
DECLARE agg record;
BEGIN
  SELECT * INTO agg FROM legacy_inquiries_aggregate;
  ASSERT agg.total = 0, format('total=%s', agg.total);
END $$;

-- ── A-4) users·inquiries가 배열이 아니어도 죽지 않는다 ──
--
-- 정상 경로로는 만들어지지 않지만 예전 자료에 대해서는 단정할 수 없다.
-- 여기서 질의가 죽으면 알고 싶었던 규모를 영영 알 수 없다.
UPDATE app_store SET data = '{"users": 5, "inquiries": {"a": 1}}'::jsonb WHERE id = 1;

DO $$
DECLARE agg record;
BEGIN
  SELECT * INTO agg FROM legacy_inquiries_aggregate;
  ASSERT agg.total = 0, format('total=%s', agg.total);
END $$;

-- ── A-5) 두 키가 아예 없어도 한 행이 나온다 ──
UPDATE app_store SET data = '{}'::jsonb WHERE id = 1;

DO $$
DECLARE rows int;
DECLARE agg record;
BEGIN
  SELECT count(*) INTO rows FROM legacy_inquiries_aggregate;
  ASSERT rows = 1, format('행 수=%s', rows);
  SELECT * INTO agg FROM legacy_inquiries_aggregate;
  ASSERT agg.total = 0, format('total=%s', agg.total);
END $$;

-- ══════════════════════════════════════════════════════
-- [B]+[C] chat_inquiries / chat_inquiry_messages
-- ══════════════════════════════════════════════════════

-- ── B-1) 문의방이 하나도 없어도 한 행이 나온다. 전부 0이다 ──
--
-- app_store 행이 없을 때도 같다. 여기서 먼저 지우고 확인한다.
DELETE FROM app_store WHERE id = 1;

DO $$
DECLARE rows int;
DECLARE agg record;
BEGIN
  SELECT count(*) INTO rows FROM chat_inquiries_aggregate;
  ASSERT rows = 1, format('행 수=%s', rows);
  SELECT * INTO agg FROM chat_inquiries_aggregate;
  ASSERT agg.total = 0 AND agg.total_messages = 0, '문의방이 없는데 어떤 칸이 찼다';
END $$;

INSERT INTO app_store (id, data, version) VALUES (1, '{}'::jsonb, 0);

-- ── B-2) 다섯 갈래를 모두 담아 센다 ──
UPDATE app_store SET data = '{
  "users": [
    {"id":"u-active","name":"김채영"},
    {"id":"u-gone1","name":"탈퇴회원","withdrawnAt":"2026-01-01T00:00:00.000Z"},
    {"id":"u-dup","name":"탈퇴회원","withdrawnAt":"2026-03-01T00:00:00.000Z"},
    {"id":"u-dup","name":"탈퇴회원","withdrawnAt":"2026-03-01T00:00:00.000Z"}
  ]
}'::jsonb WHERE id = 1;

INSERT INTO chat_inquiries (id, user_id, guest_token_hash, name, phone, contact_method) VALUES
  -- 회원 · 활성
  ('c-active', 'u-active', NULL, '김채영', '01011112222', '카카오톡'),
  -- 회원 · 탈퇴 · 비식별화 완료(이름 익명, 연락처 빈 문자열)
  ('c-gone-clean', 'u-gone1', NULL, '탈퇴회원', '', '카카오톡'),
  -- 회원 · 탈퇴 · 비식별화 미적용(중복 회원 id를 가리킨다. 한 번만 세어져야 한다)
  ('c-gone-dirty', 'u-dup', NULL, '박지훈', '01033334444', '문자'),
  -- 회원 · users에 없는 id
  ('c-unknown', 'u-missing', NULL, '정하늘', '01044445555', '문자'),
  -- 비회원 · 토큰 있음
  ('c-guest', NULL, 'a1b2c3', '한여름', '01055556666', '카카오톡'),
  -- 비회원 · 토큰 빈 문자열 → 미연결
  ('c-unlinked-empty', NULL, '', '오세영', '01066667777', '문자'),
  -- user_id가 빈 문자열이고 토큰도 NULL → 미연결(스키마가 막지 않는 경계)
  ('c-unlinked-null', '', NULL, '', '', '문자');

INSERT INTO chat_inquiry_messages (id, inquiry_id, sender, body) VALUES
  ('m1', 'c-active', 'customer', '안녕하세요'),
  ('m2', 'c-active', 'agent', '네 안녕하세요'),
  ('m3', 'c-gone-clean', 'customer', '문의드립니다'),
  ('m4', 'c-gone-dirty', 'customer', '문의드립니다'),
  ('m5', 'c-gone-dirty', 'agent', '답변드립니다'),
  ('m6', 'c-unknown', 'customer', '문의드립니다'),
  ('m7', 'c-guest', 'customer', '문의드립니다'),
  ('m8', 'c-unlinked-empty', 'customer', '문의드립니다');

DO $$
DECLARE agg record;
BEGIN
  SELECT * INTO agg FROM chat_inquiries_aggregate;

  ASSERT agg.total = 7, format('total=%s', agg.total);
  ASSERT agg.member_linked_active = 1, format('active=%s', agg.member_linked_active);
  ASSERT agg.member_linked_withdrawn = 2, format('withdrawn=%s', agg.member_linked_withdrawn);
  ASSERT agg.member_linked_unknown = 1, format('unknown=%s', agg.member_linked_unknown);
  ASSERT agg.guest_with_token = 1, format('guest=%s', agg.guest_with_token);
  -- c-unlinked-empty(토큰 빈 문자열) + c-unlinked-null(user_id 빈 문자열, 토큰 NULL)
  ASSERT agg.unlinked_no_user_no_guest_token = 2,
    format('unlinked=%s', agg.unlinked_no_user_no_guest_token);

  -- 다섯 칸은 서로 겹치지 않으며 합이 전체와 같다.
  ASSERT agg.member_linked_active + agg.member_linked_withdrawn + agg.member_linked_unknown
       + agg.guest_with_token + agg.unlinked_no_user_no_guest_token = agg.total,
    '[B] 다섯 칸의 합이 전체와 다르다';

  -- c-gone-dirty만. c-gone-clean은 "탈퇴회원"이다.
  ASSERT agg.withdrawn_name_not_anonymized = 1,
    format('name_not_anon=%s', agg.withdrawn_name_not_anonymized);
  ASSERT agg.withdrawn_phone_not_cleared = 1,
    format('phone_not_cleared=%s', agg.withdrawn_phone_not_cleared);
  -- 현재 scrub은 user_id를 지우지 않는다.
  ASSERT agg.withdrawn_user_id_present = agg.member_linked_withdrawn,
    format('userid_present=%s', agg.withdrawn_user_id_present);
  -- 비회원(토큰 있음) 한 건의 이름·연락처가 그대로다. 미연결 행은 이 칸에 들어가지 않는다.
  ASSERT agg.guest_name_present = 1, format('guest_name=%s', agg.guest_name_present);
  ASSERT agg.guest_phone_present = 1, format('guest_phone=%s', agg.guest_phone_present);

  -- [C] 메시지 여덟 행.
  ASSERT agg.total_messages = 8, format('total_messages=%s', agg.total_messages);
  ASSERT agg.messages_for_active_member_inquiry = 2,
    format('msg_active=%s', agg.messages_for_active_member_inquiry);
  ASSERT agg.messages_for_withdrawn_member_inquiry = 3,
    format('msg_withdrawn=%s', agg.messages_for_withdrawn_member_inquiry);
  ASSERT agg.messages_for_unknown_member_inquiry = 1,
    format('msg_unknown=%s', agg.messages_for_unknown_member_inquiry);
  ASSERT agg.messages_for_guest_inquiry = 1,
    format('msg_guest=%s', agg.messages_for_guest_inquiry);
  ASSERT agg.messages_for_unlinked_inquiry = 1,
    format('msg_unlinked=%s', agg.messages_for_unlinked_inquiry);

  -- 여섯 칸은 서로 겹치지 않으며 합이 전체와 같다.
  ASSERT agg.messages_for_active_member_inquiry + agg.messages_for_withdrawn_member_inquiry
       + agg.messages_for_unknown_member_inquiry + agg.messages_for_guest_inquiry
       + agg.messages_for_unlinked_inquiry + agg.orphan_messages = agg.total_messages,
    '[C] 여섯 칸의 합이 전체와 다르다';

  -- 본문은 NOT NULL이고 비어 있지 않으므로 분류 건수와 같다.
  ASSERT agg.withdrawn_message_body_present = agg.messages_for_withdrawn_member_inquiry,
    format('withdrawn_body=%s', agg.withdrawn_message_body_present);
  ASSERT agg.guest_message_body_present = agg.messages_for_guest_inquiry,
    format('guest_body=%s', agg.guest_message_body_present);
END $$;

-- ── B-3) 빈 본문은 "없음"으로 센다 ──
--
-- 컬럼이 NOT NULL이라 NULL은 들어갈 수 없지만 빈 문자열은 들어갈 수 있다.
-- Present는 구조적 존재 여부이므로 빈 문자열은 없는 것으로 본다.
INSERT INTO chat_inquiry_messages (id, inquiry_id, sender, body) VALUES
  ('m9', 'c-gone-dirty', 'agent', ''),
  ('m10', 'c-guest', 'agent', '');

DO $$
DECLARE agg record;
BEGIN
  SELECT * INTO agg FROM chat_inquiries_aggregate;
  ASSERT agg.total_messages = 10, format('total_messages=%s', agg.total_messages);
  ASSERT agg.messages_for_withdrawn_member_inquiry = 4,
    format('msg_withdrawn=%s', agg.messages_for_withdrawn_member_inquiry);
  ASSERT agg.withdrawn_message_body_present = 3,
    format('withdrawn_body=%s', agg.withdrawn_message_body_present);
  ASSERT agg.messages_for_guest_inquiry = 2,
    format('msg_guest=%s', agg.messages_for_guest_inquiry);
  ASSERT agg.guest_message_body_present = 1,
    format('guest_body=%s', agg.guest_message_body_present);
END $$;

-- ── B-4) orphan은 현재 스키마에서 만들어지지 않는다 ──
--
-- FK와 ON DELETE CASCADE가 막는다. 문의방을 지우면 메시지가 함께 사라지고,
-- 없는 문의방을 가리키는 메시지는 애초에 들어가지 않는다.
-- 검증을 위해 FK를 억지로 깨지 않는다. 그렇게 하면 실제 스키마가 아닌 것을 검증하게 된다.
-- 여기서는 "그 경계에서도 orphan_messages가 0으로 유지된다"를 확인한다.
DO $$
DECLARE failed boolean := false;
DECLARE agg record;
BEGIN
  BEGIN
    INSERT INTO chat_inquiry_messages (id, inquiry_id, sender, body)
    VALUES ('m-orphan', 'c-does-not-exist', 'customer', '본문');
  EXCEPTION WHEN foreign_key_violation THEN
    failed := true;
  END;
  ASSERT failed, 'FK가 없는 문의방을 가리키는 메시지를 막지 못했다';

  -- 문의방을 지우면 그 안의 메시지도 함께 사라진다(남아서 orphan이 되지 않는다).
  DELETE FROM chat_inquiries WHERE id = 'c-guest';
  SELECT * INTO agg FROM chat_inquiries_aggregate;
  ASSERT agg.orphan_messages = 0, format('orphan=%s', agg.orphan_messages);
  ASSERT agg.total = 6, format('total=%s', agg.total);
  ASSERT agg.messages_for_guest_inquiry = 0,
    format('msg_guest=%s', agg.messages_for_guest_inquiry);
  ASSERT agg.total_messages = 8, format('total_messages=%s', agg.total_messages);
END $$;

-- ── B-5) 테이블 존재 확인이 참·거짓만 준다 ──
--
-- 없는 이름에 대해 오류가 아니라 NULL이 나와야 route가 chatTablesPresent=false로 적는다.
DO $$
BEGIN
  ASSERT to_regclass('public.chat_inquiries') IS NOT NULL, 'chat_inquiries가 없다';
  ASSERT to_regclass('public.chat_inquiry_messages') IS NOT NULL, 'chat_inquiry_messages가 없다';
  ASSERT to_regclass('public.chat_inquiries_does_not_exist') IS NULL,
    '없는 테이블에 NULL이 아닌 값이 나왔다';
END $$;

-- 아무것도 남기지 않는다.
ROLLBACK;
