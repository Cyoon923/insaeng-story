-- 만료 인증값 정리 테스트 (Privacy-Verification-Cleanup-1).
--
-- verificationCodes.ts deleteExpiredVerifications가 보내는 것과 같은 문장을
-- 실제 PostgreSQL에 실행해, 경계(< / = / >)와 "종류를 가리지 않는다"를 본다.
--
-- JavaScript로는 볼 수 없다. 기준이 TIMESTAMPTZ 비교와 한 문장 안의 CTE라서다.
-- 문장이 다는 조건 자체는 verificationCleanupSource.test.ts가 따로 본다.
--
-- 실행:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f src/lib/server/verificationCleanup.test.sql
--
-- BEGIN ~ ROLLBACK으로 감싸 데이터를 남기지 않는다(일회용 DB 전제).
BEGIN;

CREATE TABLE IF NOT EXISTS verification_codes (
  storage_key TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

/*
 * 기준 시각은 2026-09-18T00:00:00Z로 고정한다.
 * 실제 호출부도 now를 인자로 받아 넘기므로 판정 시각이 한 곳뿐이다.
 */

-- 만료된 값. 저장 키 종류를 일부러 모두 섞는다.
INSERT INTO verification_codes (storage_key, code, expires_at, attempts, sent_at, created_at) VALUES
  ('code:signup:01012345678', '123456',
   '2026-09-17T23:55:00Z', 3, '2026-09-17T23:50:00Z', '2026-09-01T00:00:00Z'),
  ('code:reset:01099998888',  '654321',
   '2026-09-17T00:00:00Z', 0, '2026-09-16T23:55:00Z', '2026-09-01T00:00:00Z'),
  ('code:findid:01011112222', '111111',
   '2026-09-10T00:00:00Z', 5, '2026-09-09T23:55:00Z', '2026-09-01T00:00:00Z'),
  ('signup:01012345678', 'tok-signup',
   '2026-09-17T23:00:00Z', 0, NULL, '2026-09-17T22:45:00Z'),
  ('reset:01099998888',  'tok-reset',
   '2026-09-17T23:00:00Z', 0, NULL, '2026-09-17T22:45:00Z'),
  ('setid:01011112222',  'tok-setid',
   '2026-09-17T23:00:00Z', 0, NULL, '2026-09-17T22:45:00Z'),
  ('link:01033334444',   'tok-link',
   '2026-09-17T23:00:00Z', 0, NULL, '2026-09-17T22:45:00Z'),
  -- 소셜 연결 대기 JSON. 아무도 다시 읽지 않아 lazy 삭제가 닿지 못하는 종류다.
  ('sociallink:deadbeef', '{"provider":"kakao","providerUserId":"k-1","nickname":"길동"}',
   '2026-09-17T23:00:00Z', 0, NULL, '2026-09-17T22:45:00Z'),
  -- 탈퇴 재인증 JSON. 접근 토큰이 들어 있어 가장 오래 두면 안 되는 종류다.
  ('withdraw:cafebabe', '{"userId":"u-1","provider":"naver","providerUserId":"n-1","accessToken":"at-xyz","issuedAt":1}',
   '2026-09-17T23:00:00Z', 0, NULL, '2026-09-17T22:45:00Z');

-- 경계: 정확히 기준 시각인 값. 지우지 않는다.
INSERT INTO verification_codes (storage_key, code, expires_at, attempts, sent_at) VALUES
  ('code:signup:01055556666', '222222', '2026-09-18T00:00:00Z', 0, '2026-09-17T23:55:00Z'),
  ('withdraw:exactly',        '{"userId":"u-2"}', '2026-09-18T00:00:00Z', 0, NULL);

-- 아직 살아 있는 값. 지우지 않는다.
INSERT INTO verification_codes (storage_key, code, expires_at, attempts, sent_at) VALUES
  ('code:signup:01077778888', '333333', '2026-09-18T00:05:00Z', 4, '2026-09-18T00:00:00Z'),
  ('sociallink:alive',        '{"provider":"kakao","providerUserId":"k-2"}',
   '2026-09-18T00:15:00Z', 0, NULL),
  -- 아주 오래 전에 만들어졌지만 아직 만료되지 않은 값.
  -- created_at을 기준으로 삼았다면 여기서 잘못 지워진다.
  ('link:01000001111', 'tok-old-but-alive', '2026-09-18T00:10:00Z', 0, NULL);

/**
 * deleteExpiredVerifications가 보내는 것과 같은 문장.
 * 지운 건수는 DB 안에서 세고, RETURNING한 값은 이 문장을 떠나지 않는다.
 */
PREPARE cleanup(timestamptz) AS
WITH removed AS (
  DELETE FROM verification_codes
  WHERE expires_at < $1
  RETURNING 1
)
SELECT count(*)::int AS deleted FROM removed;

-- ── 1) 만료된 값만 지운다 ──
CREATE TEMP TABLE result AS EXECUTE cleanup('2026-09-18T00:00:00Z'::timestamptz);

DO $$
BEGIN
  ASSERT (SELECT deleted FROM result) = 9,
    '만료된 9건이 지워지지 않았다';

  -- 경계: 정확히 기준 시각인 값은 남는다(< 이므로).
  ASSERT EXISTS (SELECT 1 FROM verification_codes WHERE storage_key = 'code:signup:01055556666'),
    'expires_at = now 인 값이 지워졌다';
  ASSERT EXISTS (SELECT 1 FROM verification_codes WHERE storage_key = 'withdraw:exactly'),
    'expires_at = now 인 값이 지워졌다';

  -- 아직 살아 있는 값은 남는다.
  ASSERT EXISTS (SELECT 1 FROM verification_codes WHERE storage_key = 'code:signup:01077778888'),
    '살아 있는 인증번호가 지워졌다';
  ASSERT EXISTS (SELECT 1 FROM verification_codes WHERE storage_key = 'sociallink:alive'),
    '살아 있는 소셜 대기 상태가 지워졌다';
  ASSERT EXISTS (SELECT 1 FROM verification_codes WHERE storage_key = 'link:01000001111'),
    'created_at이 오래되었다는 이유로 살아 있는 값이 지워졌다';

  -- 종류를 가리지 않는다. 만료된 것은 전부 사라졌다.
  ASSERT NOT EXISTS (SELECT 1 FROM verification_codes WHERE storage_key LIKE 'code:%'
                       AND expires_at < '2026-09-18T00:00:00Z'::timestamptz),
    '만료된 인증번호가 남았다';
  ASSERT NOT EXISTS (SELECT 1 FROM verification_codes WHERE storage_key = 'sociallink:deadbeef'),
    '만료된 소셜 대기 상태가 남았다';
  ASSERT NOT EXISTS (SELECT 1 FROM verification_codes WHERE storage_key = 'withdraw:cafebabe'),
    '만료된 탈퇴 재인증(접근 토큰 포함)이 남았다';
  ASSERT NOT EXISTS (SELECT 1 FROM verification_codes WHERE storage_key IN
      ('signup:01012345678','reset:01099998888','setid:01011112222','link:01033334444')),
    '만료된 단기 토큰이 남았다';

  -- attempts가 많은 값도, 0인 값도 똑같이 다뤄진다(attempts는 조건이 아니다).
  ASSERT (SELECT count(*) FROM verification_codes) = 5,
    '남은 건수가 5건이 아니다';
END $$;

-- ── 2) 다시 실행하면 지울 것이 없다 ──
DROP TABLE result;
CREATE TEMP TABLE result AS EXECUTE cleanup('2026-09-18T00:00:00Z'::timestamptz);

DO $$
BEGIN
  ASSERT (SELECT deleted FROM result) = 0, '두 번째 실행에서 무언가 지워졌다';
  ASSERT (SELECT count(*) FROM verification_codes) = 5, '두 번째 실행이 행을 건드렸다';
END $$;

-- ── 3) 기준 시각을 옮기면 경계가 함께 옮겨 간다 ──
DROP TABLE result;
CREATE TEMP TABLE result AS EXECUTE cleanup('2026-09-18T00:05:00Z'::timestamptz);

DO $$
BEGIN
  -- 이제 00:00:00 두 건이 만료다. 00:05:00 건은 여전히 경계(=)라 남는다.
  ASSERT (SELECT deleted FROM result) = 2, '옮긴 기준 시각으로 2건이 지워지지 않았다';
  ASSERT EXISTS (SELECT 1 FROM verification_codes WHERE storage_key = 'code:signup:01077778888'),
    'expires_at = now 인 값이 지워졌다';
  ASSERT (SELECT count(*) FROM verification_codes) = 3, '남은 건수가 3건이 아니다';
END $$;

DROP TABLE result;
DEALLOCATE cleanup;
ROLLBACK;
