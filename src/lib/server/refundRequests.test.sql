-- refund_requests 저장 모델 테스트 (Refund-Request-Data-1 / Refund-Request-Evidence-Data-1).
--
-- 검증 대상이 부분 UNIQUE 인덱스와 그 술어 교체라서 JavaScript로는 확인할 수 없다.
-- 그래서 lib/server/refundRequests.ts가 보내는 것과 같은 DDL·INSERT 문을
-- 실제 PostgreSQL에 실행해 정책을 확인한다.
--
-- 입력 검증과 Evidence 계산은 DB 없이 볼 수 있어
-- refundRequestEvidence.test.ts(node --test)에서 따로 본다.
--
-- 실행:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f src/lib/server/refundRequests.test.sql
--
-- 이 스크립트는 트랜잭션 안에서 돌고 마지막에 ROLLBACK 하므로 데이터를 남기지 않는다.
-- (다만 운영 DB가 아니라 일회용 로컬/테스트 DB에서 돌리는 것을 전제로 한다.)
BEGIN;

-- orders는 이미 있는 테이블이다. 없는 환경에서도 돌도록 최소 형태만 만든다.
-- 실제 컬럼 구성은 lib/server/store.ts의 createTables가 정의한다.
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  product TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  amount INTEGER NOT NULL,
  base_amount INTEGER,
  payment TEXT NOT NULL DEFAULT '',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- store.ts의 runOrdersMigration이 더하는 열. 관리자 조회가 현재 제작 착수 시각을 읽는다.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS production_started_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_consent JSONB;

-- ══════════════════════════════════════════════════════════════
-- 0. 예전 모양으로 테이블과 인덱스를 먼저 만든다.
--    (Refund-Request-Data-1 시절: 컬럼 5개, 활성 술어는 requested·reviewing)
--    이렇게 해야 아래 마이그레이션이 "이미 있는 것을 고치는" 실제 상황이 된다.
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS refund_requests (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS refund_requests_active_order_key
  ON refund_requests (order_id)
  WHERE status IN ('requested', 'reviewing');

INSERT INTO orders (id, user_id, product, title, status, amount)
VALUES
  ('o-test-1', 'u-1', 'story', '이야기로 만드는 인생곡', '신청접수', 100000),
  ('o-test-2', 'u-1', 'consultation', '1:1 사주상담', '신청접수', 100000),
  ('o-test-3', 'u-2', 'story', '이야기로 만드는 인생곡', '신청접수', 100000);
-- 위 주문에는 refund_consent·production_started_at 컬럼조차 없다.
-- 과거 주문이라도 요청 저장이 막히지 않아야 한다.

-- 마이그레이션 전에 만들어진 행 1건. 새 컬럼은 NULL로 남아야 한다.
INSERT INTO refund_requests (id, order_id, user_id, status, requested_at)
VALUES ('r-old', 'o-test-3', 'u-2', 'completed', now() - interval '10 days');

-- ══════════════════════════════════════════════════════════════
-- 1. 여기부터가 refundRequests.ts의 runRefundRequestsMigration과 같은 문장이다.
--    (CREATE TABLE IF NOT EXISTS는 위에서 이미 만들어 두어 아무 일도 하지 않는다)
-- ══════════════════════════════════════════════════════════════
ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS production_started_at_snapshot TIMESTAMPTZ;
ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS scheduled_at_snapshot TIMESTAMPTZ;
ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS cancel_window_snapshot JSONB;
ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS cancel_window_policy_version TEXT;
ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ;
ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS handled_by TEXT;
DO $mig$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'refund_requests_status_check') THEN
    ALTER TABLE refund_requests
      ADD CONSTRAINT refund_requests_status_check
      CHECK (status IN ('requested', 'reviewing', 'approved', 'rejected', 'completed'))
      NOT VALID;
  END IF;
END $mig$;

-- 새 술어의 인덱스를 먼저 만들고,
CREATE UNIQUE INDEX IF NOT EXISTS refund_requests_active_order_v2_key
  ON refund_requests (order_id)
  WHERE status IN ('requested', 'reviewing', 'approved');
-- 그다음에 옛 인덱스를 지운다. 보호가 없는 순간이 생기지 않는다.
DROP INDEX IF EXISTS refund_requests_active_order_key;

CREATE INDEX IF NOT EXISTS refund_requests_order_requested_idx
  ON refund_requests (order_id, requested_at DESC);
-- 주문 1건당 고객 웹 접수 1회. 끝난 요청까지 세는 완전 UNIQUE다.
-- 앱에서는 본 마이그레이션 트랜잭션 밖에서 따로 만든다(중복 데이터가 있으면 만들지 않는다).
CREATE UNIQUE INDEX IF NOT EXISTS refund_requests_order_once_key
  ON refund_requests (order_id);
-- ══════════════════════════════════════════════════════════════

/**
 * createRefundRequest가 보내는 것과 같은 문장.
 * 접수 시각·사유·Evidence는 모두 서버가 만들어 인자로 넘긴다.
 */
CREATE OR REPLACE FUNCTION test_create(
  p_id TEXT,
  p_order TEXT,
  p_user TEXT,
  p_requested_at TIMESTAMPTZ DEFAULT now(),
  p_reason TEXT DEFAULT 'change-of-mind',
  p_message TEXT DEFAULT NULL,
  p_production TIMESTAMPTZ DEFAULT NULL,
  p_scheduled TIMESTAMPTZ DEFAULT NULL,
  p_window JSONB DEFAULT NULL,
  p_policy TEXT DEFAULT NULL
)
RETURNS TABLE (
  id TEXT, order_id TEXT, user_id TEXT, status TEXT, requested_at TIMESTAMPTZ,
  reason TEXT, message TEXT, production_started_at_snapshot TIMESTAMPTZ,
  scheduled_at_snapshot TIMESTAMPTZ, cancel_window_snapshot JSONB,
  cancel_window_policy_version TEXT
)
LANGUAGE sql AS $fn$
  INSERT INTO refund_requests (
    id, order_id, user_id, status, requested_at,
    reason, message, production_started_at_snapshot, scheduled_at_snapshot,
    cancel_window_snapshot, cancel_window_policy_version
  )
  SELECT p_id, o.id, o.user_id, 'requested', p_requested_at,
         p_reason, p_message, p_production, p_scheduled, p_window, p_policy
  FROM orders o
  WHERE o.id = p_order AND o.user_id = p_user
    -- 주문당 고객 웹 접수는 1회다. 끝난 요청까지 세므로 재접수가 막힌다.
    AND NOT EXISTS (SELECT 1 FROM refund_requests r WHERE r.order_id = o.id)
  ON CONFLICT (order_id) WHERE status IN ('requested', 'reviewing', 'approved') DO NOTHING
  RETURNING refund_requests.id, refund_requests.order_id, refund_requests.user_id,
            refund_requests.status, refund_requests.requested_at, refund_requests.reason,
            refund_requests.message, refund_requests.production_started_at_snapshot,
            refund_requests.scheduled_at_snapshot, refund_requests.cancel_window_snapshot,
            refund_requests.cancel_window_policy_version;
$fn$;

DO $$
DECLARE
  r RECORD;
  n INTEGER;
  ts TIMESTAMPTZ := '2026-08-12T01:00:00Z'::timestamptz - interval '181 minutes';
BEGIN
  -- 1. 마이그레이션이 옛 행을 건드리지 않았다. 새 컬럼은 NULL이다.
  SELECT * INTO r FROM refund_requests WHERE id = 'r-old';
  ASSERT r.reason IS NULL AND r.cancel_window_snapshot IS NULL,
    '1: 옛 행에 값이 소급 생성됐다';

  -- 2. 인덱스 교체 결과: 새 이름만 남고 술어에 approved가 포함된다.
  SELECT count(*) INTO n FROM pg_indexes
    WHERE tablename = 'refund_requests' AND indexname = 'refund_requests_active_order_key';
  ASSERT n = 0, '2: 옛 인덱스가 남아 있다';
  SELECT count(*) INTO n FROM pg_indexes
    WHERE tablename = 'refund_requests'
      AND indexname = 'refund_requests_active_order_v2_key'
      AND indexdef LIKE '%approved%';
  ASSERT n = 1, '2: 새 인덱스 술어에 approved가 없다';

  -- 3. 정상 생성 → status는 언제나 requested, user_id는 주문에서 온다.
  SELECT * INTO r FROM test_create('r-1', 'o-test-1', 'u-1', ts, 'service-issue', '내용');
  ASSERT r.status = 'requested', '3: 초기 상태가 requested가 아니다';
  ASSERT r.user_id = 'u-1', '3: user_id가 주문 소유자가 아니다';
  ASSERT r.reason = 'service-issue' AND r.message = '내용', '3: 고객 입력이 저장되지 않았다';
  ASSERT r.requested_at = ts, '3: 서버가 넘긴 접수 시각이 그대로 저장되지 않았다';

  -- 4. 상담 Evidence가 그대로 저장된다(계산은 TS 쪽 테스트에서 본다).
  SELECT * INTO r FROM test_create(
    'r-2', 'o-test-2', 'u-1', ts, 'schedule', NULL,
    NULL, '2026-08-12T01:00:00Z'::timestamptz,
    '{"kind":"normal-request","remainingMinutes":181}'::jsonb,
    'consult-cancel-window-3h-v1'
  );
  ASSERT r.scheduled_at_snapshot = '2026-08-12T01:00:00Z'::timestamptz, '4: scheduledAt 미저장';
  ASSERT r.cancel_window_snapshot->>'kind' = 'normal-request', '4: 판정 결과 미저장';
  ASSERT (r.cancel_window_snapshot->>'remainingMinutes')::int = 181, '4: 남은 분 미저장';
  ASSERT r.cancel_window_policy_version = 'consult-cancel-window-3h-v1', '4: 정책 버전 미저장';
  ASSERT r.production_started_at_snapshot IS NULL, '4: 없는 값이 채워졌다';
  ASSERT r.message IS NULL, '4: 빈 상세 내용이 빈 문자열로 들어갔다';

  -- 5. 같은 주문에 두 번째 requested → 부분 UNIQUE 인덱스가 막는다(0행).
  SELECT count(*) INTO n FROM test_create('r-3', 'o-test-1', 'u-1');
  ASSERT n = 0, '5: 활성 요청이 2건 생겼다';
  SELECT count(*) INTO n FROM refund_requests WHERE order_id = 'o-test-1';
  ASSERT n = 1, '5: 행이 더 쌓였다';

  -- 6. reviewing으로 바뀌어도 여전히 활성 1건이다.
  UPDATE refund_requests SET status = 'reviewing' WHERE id = 'r-1';
  SELECT count(*) INTO n FROM test_create('r-4', 'o-test-1', 'u-1');
  ASSERT n = 0, '6: reviewing이 있는데 requested가 추가됐다';

  -- 7. ★ approved도 활성이다. 승인 후 실제 환불 전에는 새 요청이 들어올 수 없다.
  UPDATE refund_requests SET status = 'approved' WHERE id = 'r-1';
  SELECT count(*) INTO n FROM test_create('r-5', 'o-test-1', 'u-1');
  ASSERT n = 0, '7: approved 상태인데 새 requested가 들어갔다';

  -- 8. ★ rejected가 되어도 새 요청을 넣지 못한다(주문당 웹 접수 1회).
  UPDATE refund_requests SET status = 'rejected' WHERE id = 'r-1';
  SELECT count(*) INTO n FROM test_create('r-6', 'o-test-1', 'u-1');
  ASSERT n = 0, '8: rejected 이후 재접수가 들어갔다';

  -- 9. ★ completed도 같다. 끝난 뒤에도 웹 재접수는 없다.
  UPDATE refund_requests SET status = 'completed' WHERE id = 'r-1';
  SELECT count(*) INTO n FROM test_create('r-7', 'o-test-1', 'u-1');
  ASSERT n = 0, '9: completed 이후 재접수가 들어갔다';
  SELECT count(*) INTO n FROM refund_requests WHERE order_id = 'o-test-1';
  ASSERT n = 1, '9: 주문당 1건이 아니다';

  -- 10. 다른 주문은 자기 요청을 따로 가진다(주문 사이에는 영향이 없다).
  SELECT count(*) INTO n FROM refund_requests
    WHERE status IN ('requested', 'reviewing', 'approved');
  ASSERT n = 1, '10: 활성 요청 수가 맞지 않는다(o-test-2의 1건)';
  SELECT count(*) INTO n FROM refund_requests WHERE order_id = 'o-test-2';
  ASSERT n = 1, '10: o-test-2의 요청이 사라졌다';

  -- 11. 남의 주문에는 넣을 수 없다(소유자 검증이 같은 문장 안에 있다).
  SELECT count(*) INTO n FROM test_create('r-8', 'o-test-3', 'u-1');
  ASSERT n = 0, '11: 남의 주문에 요청이 들어갔다';

  -- 12. 없는 주문도 들어가지 않는다(FK 위반 오류가 아니라 0행으로 끝난다).
  SELECT count(*) INTO n FROM test_create('r-9', 'o-없음', 'u-1');
  ASSERT n = 0, '12: 없는 주문에 요청이 들어갔다';

  RAISE NOTICE 'refund_requests 정책 테스트 12건 통과(주문당 1회 정책 포함)';
END $$;

-- 13. 동시 요청 방어. 인덱스가 최종 방어선인지 ON CONFLICT 없이 직접 확인한다.
--     (앱은 ON CONFLICT DO NOTHING으로 받지만, 그 아래에는 제약이 있어야 한다)
DO $$
DECLARE
  failed BOOLEAN := false;
BEGIN
  BEGIN
    INSERT INTO refund_requests (id, order_id, user_id, status, requested_at, reason)
    VALUES ('r-race', 'o-test-2', 'u-1', 'requested', now(), 'change-of-mind');
  EXCEPTION WHEN unique_violation THEN
    failed := true;
  END;
  ASSERT failed, '13: 활성 요청이 있는데 UNIQUE 제약이 막지 않았다';
  RAISE NOTICE '동시 요청 UNIQUE 방어 확인';
END $$;

-- 14. 마이그레이션 안전성. 이미 approved + requested가 함께 있는 운영 데이터라면
--     새 인덱스 생성이 실패하고, 옛 인덱스가 그대로 남는다.
--     (조용히 보호를 없애지 않는다. 데이터를 고쳐 통과시키지도 않는다.)
DO $$
DECLARE
  failed BOOLEAN := false;
  n INTEGER;
BEGIN
  CREATE TEMP TABLE legacy_orders (id TEXT PRIMARY KEY) ON COMMIT DROP;
  INSERT INTO legacy_orders VALUES ('o-legacy');
  CREATE TEMP TABLE legacy_refunds (
    id TEXT PRIMARY KEY,
    order_id TEXT REFERENCES legacy_orders(id),
    status TEXT
  ) ON COMMIT DROP;
  CREATE UNIQUE INDEX legacy_active_key ON legacy_refunds (order_id)
    WHERE status IN ('requested', 'reviewing');
  INSERT INTO legacy_refunds VALUES ('a', 'o-legacy', 'approved'), ('b', 'o-legacy', 'requested');

  BEGIN
    CREATE UNIQUE INDEX legacy_active_v2_key ON legacy_refunds (order_id)
      WHERE status IN ('requested', 'reviewing', 'approved');
  EXCEPTION WHEN unique_violation THEN
    failed := true;
  END;
  ASSERT failed, '14: 충돌 데이터가 있는데 새 인덱스가 만들어졌다';

  SELECT count(*) INTO n FROM pg_indexes WHERE indexname = 'legacy_active_key';
  ASSERT n = 1, '14: 생성 실패 후 옛 인덱스가 사라졌다';
  RAISE NOTICE '마이그레이션 안전성 확인(실패 시 옛 인덱스 유지)';
END $$;

-- ══════════════════════════════════════════════════════════════
-- 15. listActiveRefundRequestsByUser가 보내는 것과 같은 조회.
--     주문 수와 상관없이 질의는 한 번이다(주문마다 부르지 않는다).
--     소유 관계는 refund_requests.user_id가 아니라 orders와의 조인으로 본다.
-- ══════════════════════════════════════════════════════════════
DO $$
DECLARE
  r RECORD;
  n INTEGER;
BEGIN
  -- 준비: u-1의 주문 2건에 활성 문의를 하나씩, u-2의 주문에도 하나 둔다.
  DELETE FROM refund_requests;
  INSERT INTO refund_requests (id, order_id, user_id, status, requested_at, reason, message,
                               production_started_at_snapshot, scheduled_at_snapshot,
                               cancel_window_snapshot, cancel_window_policy_version)
  VALUES
    ('a-1', 'o-test-1', 'u-1', 'requested', now() - interval '3 minutes', 'schedule', '내용',
     now(), now(), '{"kind":"normal-request","remainingMinutes":181}'::jsonb, 'consult-cancel-window-3h-v1'),
    ('a-2', 'o-test-2', 'u-1', 'reviewing', now() - interval '2 minutes', 'other', '내용', NULL, NULL, NULL, NULL),
    ('a-3', 'o-test-3', 'u-2', 'requested', now() - interval '1 minutes', 'change-of-mind', NULL, NULL, NULL, NULL, NULL);

  -- 15-1. 같은 회원의 여러 주문에 걸린 활성 문의를 모두 돌려준다.
  SELECT count(*) INTO n FROM (
    SELECT r2.id FROM refund_requests r2
    JOIN orders o ON o.id = r2.order_id
    WHERE o.user_id = 'u-1' AND r2.status IN ('requested', 'reviewing', 'approved')
  ) q;
  ASSERT n = 2, '15-1: 활성 문의 2건이 모두 나오지 않았다';

  -- 15-2. 다른 회원(u-2)의 문의는 섞이지 않는다.
  SELECT count(*) INTO n FROM (
    SELECT r2.id FROM refund_requests r2
    JOIN orders o ON o.id = r2.order_id
    WHERE o.user_id = 'u-1' AND r2.status IN ('requested', 'reviewing', 'approved')
      AND r2.id = 'a-3'
  ) q;
  ASSERT n = 0, '15-2: 다른 회원의 문의가 섞였다';

  -- 15-3. approved도 활성이라 나온다.
  UPDATE refund_requests SET status = 'approved' WHERE id = 'a-2';
  SELECT count(*) INTO n FROM (
    SELECT r2.id FROM refund_requests r2
    JOIN orders o ON o.id = r2.order_id
    WHERE o.user_id = 'u-1' AND r2.status IN ('requested', 'reviewing', 'approved')
  ) q;
  ASSERT n = 2, '15-3: approved가 빠졌다';

  -- 15-4. rejected·completed는 빠진다.
  UPDATE refund_requests SET status = 'rejected' WHERE id = 'a-1';
  UPDATE refund_requests SET status = 'completed' WHERE id = 'a-2';
  SELECT count(*) INTO n FROM (
    SELECT r2.id FROM refund_requests r2
    JOIN orders o ON o.id = r2.order_id
    WHERE o.user_id = 'u-1' AND r2.status IN ('requested', 'reviewing', 'approved')
  ) q;
  ASSERT n = 0, '15-4: 끝난 문의가 나왔다(빈 목록이어야 한다)';

  -- 15-5. 소유 관계는 orders를 기준으로 본다.
  --       refund_requests.user_id가 어긋나 있어도 주문 소유자가 기준이다.
  UPDATE refund_requests SET status = 'requested', user_id = 'u-침입자' WHERE id = 'a-1';
  SELECT count(*) INTO n FROM (
    SELECT r2.id FROM refund_requests r2
    JOIN orders o ON o.id = r2.order_id
    WHERE o.user_id = 'u-침입자' AND r2.status IN ('requested', 'reviewing', 'approved')
  ) q;
  ASSERT n = 0, '15-5: refund_requests.user_id만 믿고 남의 문의를 내줬다';
  SELECT count(*) INTO n FROM (
    SELECT r2.id FROM refund_requests r2
    JOIN orders o ON o.id = r2.order_id
    WHERE o.user_id = 'u-1' AND r2.status IN ('requested', 'reviewing', 'approved')
  ) q;
  ASSERT n = 1, '15-5: 주문 소유자 기준 조회가 비었다';

  -- 15-6. 돌려주는 열은 네 개뿐이다. Evidence 열은 읽지도 않는다.
  SELECT r2.id, r2.order_id, r2.status, r2.requested_at INTO r
  FROM refund_requests r2
  JOIN orders o ON o.id = r2.order_id
  WHERE o.user_id = 'u-1' AND r2.status IN ('requested', 'reviewing', 'approved');
  ASSERT r.id IS NOT NULL AND r.order_id IS NOT NULL
     AND r.status IS NOT NULL AND r.requested_at IS NOT NULL,
    '15-6: 고객에게 줄 네 값이 비었다';

  -- 15-7. 주문이 없는 회원은 빈 목록이다.
  SELECT count(*) INTO n FROM (
    SELECT r2.id FROM refund_requests r2
    JOIN orders o ON o.id = r2.order_id
    WHERE o.user_id = 'u-주문없음' AND r2.status IN ('requested', 'reviewing', 'approved')
  ) q;
  ASSERT n = 0, '15-7: 주문 없는 회원에게 값이 나왔다';

  RAISE NOTICE '회원 기준 활성 문의 조회 7건 통과';
END $$;

-- ══════════════════════════════════════════════════════════════
-- 16. listRefundRequestsForAdmin이 보내는 것과 같은 조회.
--     전체 이력(5개 status)을 최신순으로, 주문 정보와 함께 한 번의 JOIN으로 가져온다.
-- ══════════════════════════════════════════════════════════════
DO $$
DECLARE
  r RECORD;
  n INTEGER;
  ids TEXT[];
BEGIN
  DELETE FROM refund_requests;
  /*
   * 주문당 1회 정책이 생기기 전에 저장된 자료를 흉내 내기 위해 완전 UNIQUE 인덱스를
   * 이 블록 동안만 내린다(아래 19에서 되돌린다). 관리자 목록은 그런 옛 자료도
   * 빠짐없이 보여 줘야 하므로, 행을 지워서 조건을 맞추지 않는다.
   */
  DROP INDEX IF EXISTS refund_requests_order_once_key;
  INSERT INTO refund_requests (id, order_id, user_id, status, requested_at, reason, message,
                               production_started_at_snapshot, scheduled_at_snapshot,
                               cancel_window_snapshot, cancel_window_policy_version)
  VALUES
    -- 활성 상태(requested/reviewing/approved)는 주문당 1건이라 서로 다른 주문에 둔다.
    ('m-1', 'o-test-1', 'u-1', 'requested', now() - interval '5 minutes', 'change-of-mind', NULL,
     NULL, NULL, NULL, NULL),
    ('m-2', 'o-test-3', 'u-2', 'reviewing', now() - interval '4 minutes', 'schedule', '내용2',
     NULL, NULL, NULL, NULL),
    ('m-3', 'o-test-2', 'u-1', 'approved', now() - interval '3 minutes', 'service-issue', NULL,
     NULL, '2026-08-12T01:00:00Z'::timestamptz,
     '{"kind":"normal-request","remainingMinutes":181}'::jsonb, 'consult-cancel-window-3h-v1'),
    -- 옛 자료에서만 나올 수 있는 모양: 같은 주문에 끝난 요청이 함께 쌓여 있다.
    ('m-4', 'o-test-1', 'u-1', 'rejected', now() - interval '2 minutes', 'duplicate-payment', NULL,
     NULL, NULL, NULL, NULL),
    ('m-5', 'o-test-3', 'u-2', 'completed', now() - interval '1 minutes', 'other', '남의 주문 문의',
     NULL, NULL, NULL, NULL);

  -- 접수 뒤에 제작이 시작된 상황을 만든다(현재 값과 snapshot이 달라야 한다).
  UPDATE orders SET production_started_at = now() WHERE id = 'o-test-1';

  -- 16-1. 5개 status가 모두 나온다(활성만 거르지 않는다).
  SELECT count(*) INTO n FROM (
    SELECT r2.id FROM refund_requests r2 JOIN orders o ON o.id = r2.order_id
  ) q;
  ASSERT n = 5, '16-1: 전체 이력이 나오지 않았다';
  SELECT count(DISTINCT r2.status) INTO n FROM refund_requests r2;
  ASSERT n = 5, '16-1: status 5종이 모두 들어 있지 않다';

  -- 16-2. 최신순 정렬. 같은 시각이면 id 내림차순으로 순서가 고정된다.
  SELECT array_agg(q.id ORDER BY q.ord) INTO ids FROM (
    SELECT r2.id, row_number() OVER (ORDER BY r2.requested_at DESC, r2.id DESC) AS ord
    FROM refund_requests r2 JOIN orders o ON o.id = r2.order_id
  ) q;
  ASSERT ids = ARRAY['m-5','m-4','m-3','m-2','m-1'], '16-2: 최신순 정렬이 아니다';

  -- 16-3. 주문 정보가 함께 붙는다(질의 한 번).
  SELECT r2.id, r2.reason, r2.message, r2.production_started_at_snapshot,
         o.product, o.title, o.amount, o.status AS order_status,
         o.production_started_at AS order_production_started_at
  INTO r
  FROM refund_requests r2 JOIN orders o ON o.id = r2.order_id
  WHERE r2.id = 'm-1';
  ASSERT r.product = 'story' AND r.title = '이야기로 만드는 인생곡' AND r.amount = 100000,
    '16-3: 주문 정보가 붙지 않았다';
  ASSERT r.order_status = '신청접수', '16-3: 현재 주문 상태가 없다';
  ASSERT r.reason = 'change-of-mind', '16-3: 고객 사유가 연결되지 않았다';

  -- 16-4. 맞춤상품: 접수 당시 snapshot(없음)과 현재 값(있음)이 따로 나온다.
  ASSERT r.production_started_at_snapshot IS NULL, '16-4: snapshot이 현재 값으로 덮였다';
  ASSERT r.order_production_started_at IS NOT NULL, '16-4: 현재 제작 착수 시각이 없다';

  -- 16-5. 고객 입력 message가 연결된다.
  SELECT r2.message INTO r FROM refund_requests r2 JOIN orders o ON o.id = r2.order_id
  WHERE r2.id = 'm-2';
  ASSERT r.message = '내용2', '16-5: 고객 상세 내용이 연결되지 않았다';

  -- 16-6. 상담 Evidence 3종이 그대로 나온다.
  SELECT r2.scheduled_at_snapshot, r2.cancel_window_snapshot, r2.cancel_window_policy_version
  INTO r FROM refund_requests r2 JOIN orders o ON o.id = r2.order_id WHERE r2.id = 'm-3';
  ASSERT r.scheduled_at_snapshot IS NOT NULL, '16-6: 접수 당시 예약 시각이 없다';
  ASSERT r.cancel_window_snapshot->>'kind' = 'normal-request', '16-6: 취소창 판정이 없다';
  ASSERT r.cancel_window_policy_version = 'consult-cancel-window-3h-v1', '16-6: 정책 버전이 없다';

  -- 16-7. 관리자는 다른 회원(u-2)의 문의도 본다(고객 조회와 달리 회원으로 거르지 않는다).
  SELECT count(*) INTO n FROM (
    SELECT r2.id FROM refund_requests r2 JOIN orders o ON o.id = r2.order_id
    WHERE r2.user_id = 'u-2'
  ) q;
  ASSERT n = 2, '16-7: 다른 회원의 문의가 관리자 목록에서 빠졌다';

  RAISE NOTICE '관리자 목록 조회 7건 통과';
END $$;

-- ══════════════════════════════════════════════════════════════
-- 17. 관리자 상태 전이. transitionRefundRequestByAdmin이 보내는 것과 같은 CAS UPDATE.
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION test_transition(
  p_id TEXT,
  p_expected TEXT,
  p_target TEXT,
  p_decided TIMESTAMPTZ,
  p_admin TEXT
)
RETURNS TABLE (id TEXT, status TEXT, decided_at TIMESTAMPTZ, handled_by TEXT)
LANGUAGE sql AS $fn$
  UPDATE refund_requests
  SET status = p_target,
      decided_at = CASE WHEN p_decided IS NULL THEN decided_at ELSE p_decided END,
      handled_by = p_admin
  WHERE id = p_id AND status = p_expected
  RETURNING refund_requests.id, refund_requests.status,
            refund_requests.decided_at, refund_requests.handled_by;
$fn$;

DO $$
DECLARE
  r RECORD;
  n INTEGER;
  now_ts TIMESTAMPTZ := now();
BEGIN
  DELETE FROM refund_requests;
  -- 마이그레이션 전에 만들어진 행. decided_at·handled_by가 NULL로 남아야 한다.
  INSERT INTO refund_requests (id, order_id, user_id, status, requested_at, reason)
  VALUES ('t-old', 'o-test-3', 'u-2', 'completed', now() - interval '9 days', 'other');

  -- 17-1. requested → reviewing 성공. 결론이 아니므로 decided_at은 NULL로 남는다.
  INSERT INTO refund_requests (id, order_id, user_id, status, requested_at, reason)
  VALUES ('t-1', 'o-test-1', 'u-1', 'requested', now(), 'schedule');
  SELECT * INTO r FROM test_transition('t-1', 'requested', 'reviewing', NULL, 'admin-A');
  ASSERT r.status = 'reviewing', '17-1: 전이하지 못했다';
  ASSERT r.decided_at IS NULL, '17-1: 검토 시작인데 결론 시각이 생겼다';
  ASSERT r.handled_by = 'admin-A', '17-1: 실행 관리자가 남지 않았다';

  -- 17-2. reviewing → approved 성공. 결론 시각이 서버 값으로 남는다.
  SELECT * INTO r FROM test_transition('t-1', 'reviewing', 'approved', now_ts, 'admin-B');
  ASSERT r.status = 'approved', '17-2: 승인 전이 실패';
  ASSERT r.decided_at = now_ts, '17-2: 결론 시각이 저장되지 않았다';
  ASSERT r.handled_by = 'admin-B', '17-2: 마지막 실행 관리자가 갱신되지 않았다';

  -- 17-3. stale 상태로는 바꿀 수 없다(이미 approved인데 reviewing을 기대).
  SELECT count(*) INTO n FROM test_transition('t-1', 'reviewing', 'rejected', now_ts, 'admin-C');
  ASSERT n = 0, '17-3: 오래된 상태로 전이가 통과했다';
  SELECT status INTO r FROM refund_requests WHERE id = 't-1';
  ASSERT r.status = 'approved', '17-3: 실패했는데 상태가 바뀌었다';

  -- 17-4. 없는 id는 0행이다.
  SELECT count(*) INTO n FROM test_transition('t-없음', 'requested', 'reviewing', NULL, 'admin-A');
  ASSERT n = 0, '17-4: 없는 문의가 전이됐다';

  -- 17-5. requested → rejected 성공(검토를 거치지 않은 거절은 허용된다).
  INSERT INTO refund_requests (id, order_id, user_id, status, requested_at, reason)
  VALUES ('t-2', 'o-test-2', 'u-1', 'requested', now(), 'change-of-mind');
  SELECT * INTO r FROM test_transition('t-2', 'requested', 'rejected', now_ts, 'admin-A');
  ASSERT r.status = 'rejected' AND r.decided_at = now_ts, '17-5: 거절 전이 실패';

  -- 17-6. 동시 전이. 같은 expected 상태로 두 번 시도하면 한 번만 성공한다.
  INSERT INTO refund_requests (id, order_id, user_id, status, requested_at, reason)
  VALUES ('t-3', 'o-test-3', 'u-2', 'requested', now(), 'schedule');
  SELECT count(*) INTO n FROM test_transition('t-3', 'requested', 'reviewing', NULL, 'admin-A');
  ASSERT n = 1, '17-6: 첫 전이가 실패했다';
  SELECT count(*) INTO n FROM test_transition('t-3', 'requested', 'rejected', now_ts, 'admin-B');
  ASSERT n = 0, '17-6: 같은 expected 상태로 두 번째 전이가 통과했다';
  SELECT status, handled_by INTO r FROM refund_requests WHERE id = 't-3';
  ASSERT r.status = 'reviewing' AND r.handled_by = 'admin-A', '17-6: 진 쪽이 기록을 덮었다';

  -- 17-7. 마이그레이션 전 행은 그대로다.
  SELECT decided_at, handled_by INTO r FROM refund_requests WHERE id = 't-old';
  ASSERT r.decided_at IS NULL AND r.handled_by IS NULL, '17-7: 옛 행에 값이 소급 생성됐다';

  -- 17-8. 결론 시각은 이후 전이에서 지워지지 않는다.
  --       (관리자 전이로는 approved를 벗어날 수 없으므로 여기서는 UPDATE로 직접 확인한다)
  PERFORM test_transition('t-1', 'approved', 'approved', NULL, 'admin-D');
  SELECT decided_at INTO r FROM refund_requests WHERE id = 't-1';
  ASSERT r.decided_at = now_ts, '17-8: 결론 시각이 지워졌다';

  RAISE NOTICE '관리자 상태 전이 8건 통과';
END $$;

-- 18. status CHECK 제약(NOT VALID)이 새 값에는 적용된다.
DO $$
DECLARE
  blocked BOOLEAN := false;
  n INTEGER;
BEGIN
  BEGIN
    INSERT INTO refund_requests (id, order_id, user_id, status, requested_at, reason)
    VALUES ('t-bad', 'o-test-1', 'u-1', 'refunded', now(), 'other');
  EXCEPTION WHEN check_violation THEN
    blocked := true;
  END;
  ASSERT blocked, '18: 목록에 없는 status가 저장됐다';

  -- 제약은 NOT VALID로 더해져 기존 행을 훑지 않는다(검증되지 않은 상태로 남는다).
  SELECT count(*) INTO n FROM pg_constraint
    WHERE conname = 'refund_requests_status_check' AND convalidated = false;
  ASSERT n = 1, '18: 제약이 NOT VALID 상태가 아니다(기존 행을 전수 검사했다)';
  RAISE NOTICE 'status CHECK(NOT VALID) 확인';
END $$;

-- 19. 회귀: 어떤 상태로 끝나든 같은 주문에 새 고객 요청은 들어가지 않는다.
--     (active 경계와 closed 경계를 함께 본다. 둘의 뜻은 여전히 다르다.)
DO $$
DECLARE
  n INTEGER;
BEGIN
  DELETE FROM refund_requests;
  -- 16에서 옛 자료를 흉내 내려고 내렸던 인덱스를 여기서 되돌린다(행은 지우지 않는다).
  CREATE UNIQUE INDEX IF NOT EXISTS refund_requests_order_once_key
    ON refund_requests (order_id);
  SELECT count(*) INTO n FROM pg_indexes
    WHERE tablename = 'refund_requests' AND indexname = 'refund_requests_order_once_key';
  ASSERT n = 1, '19: 주문당 1회 인덱스가 되돌아오지 않았다';

  INSERT INTO refund_requests (id, order_id, user_id, status, requested_at, reason)
  VALUES ('g-1', 'o-test-1', 'u-1', 'approved', now(), 'schedule');
  SELECT count(*) INTO n FROM test_create('g-2', 'o-test-1', 'u-1');
  ASSERT n = 0, '19: approved인데 새 요청이 들어갔다';

  UPDATE refund_requests SET status = 'rejected' WHERE id = 'g-1';
  SELECT count(*) INTO n FROM test_create('g-3', 'o-test-1', 'u-1');
  ASSERT n = 0, '19: rejected 이후 재접수가 들어갔다';

  UPDATE refund_requests SET status = 'completed' WHERE id = 'g-1';
  SELECT count(*) INTO n FROM test_create('g-4', 'o-test-1', 'u-1');
  ASSERT n = 0, '19: completed 이후 재접수가 들어갔다';
  RAISE NOTICE '주문당 1회 경계 회귀 확인';
END $$;

-- ══════════════════════════════════════════════════════════════
-- 20. 주문당 1회를 DB가 최종적으로 막는다.
--     앱은 NOT EXISTS로 거르지만, 동시에 들어온 두 요청은 서로를 보지 못한다.
--     그 아래에서 완전 UNIQUE 인덱스가 하나만 통과시켜야 한다.
-- ══════════════════════════════════════════════════════════════
DO $$
DECLARE
  blocked BOOLEAN := false;
  n INTEGER;
BEGIN
  DELETE FROM refund_requests;
  INSERT INTO refund_requests (id, order_id, user_id, status, requested_at, reason)
  VALUES ('u-a', 'o-test-1', 'u-1', 'completed', now(), 'schedule');

  -- 끝난 요청이 있는 주문에 직접 INSERT(= NOT EXISTS를 우회한 동시 요청)
  BEGIN
    INSERT INTO refund_requests (id, order_id, user_id, status, requested_at, reason)
    VALUES ('u-b', 'o-test-1', 'u-1', 'requested', now(), 'other');
  EXCEPTION WHEN unique_violation THEN
    blocked := true;
  END;
  ASSERT blocked, '20: 끝난 요청이 있는데 완전 UNIQUE가 막지 않았다';
  SELECT count(*) INTO n FROM refund_requests WHERE order_id = 'o-test-1';
  ASSERT n = 1, '20: 주문당 1건이 아니다';
  RAISE NOTICE '주문당 1회 UNIQUE 방어 확인';
END $$;

-- ══════════════════════════════════════════════════════════════
-- 21. listLatestRefundRequestsByUser가 보내는 것과 같은 조회.
--     끝난 요청까지 담고, 주문마다 가장 최근 1건만 고른다.
--     고객에게 나가는 네 값 외에는 읽지 않는다.
-- ══════════════════════════════════════════════════════════════
DO $$
DECLARE
  r RECORD;
  n INTEGER;
BEGIN
  DELETE FROM refund_requests;
  /*
   * 주문당 1회 정책이 생기기 전에 저장된 자료를 흉내 낸다.
   * 완전 UNIQUE 인덱스가 막으므로 이 블록에서만 잠시 내렸다가 되돌린다.
   * 행을 지우거나 고쳐서 통과시키지 않는다(옛 자료가 있어도 조회가 맞아야 한다).
   */
  DROP INDEX IF EXISTS refund_requests_order_once_key;
  INSERT INTO refund_requests (id, order_id, user_id, status, requested_at, reason,
                               production_started_at_snapshot, cancel_window_policy_version,
                               decided_at, handled_by)
  VALUES
    ('h-1', 'o-test-1', 'u-1', 'rejected', now() - interval '3 days', 'schedule',
     now(), 'consult-cancel-window-3h-v1', now(), 'admin-1'),
    ('h-2', 'o-test-1', 'u-1', 'completed', now() - interval '1 days', 'other',
     now(), 'consult-cancel-window-3h-v1', now(), 'admin-1'),
    ('h-3', 'o-test-2', 'u-1', 'rejected', now() - interval '2 days', 'change-of-mind',
     NULL, NULL, now(), 'admin-1'),
    ('h-4', 'o-test-3', 'u-2', 'completed', now(), 'change-of-mind', NULL, NULL, now(), 'admin-2');

  -- 21-1. 주문마다 1건만, 가장 최근 것으로 고른다(o-test-1은 h-2).
  SELECT count(*) INTO n FROM (
    SELECT DISTINCT ON (r2.order_id) r2.id FROM refund_requests r2
    JOIN orders o ON o.id = r2.order_id
    WHERE o.user_id = 'u-1'
    ORDER BY r2.order_id, r2.requested_at DESC, r2.id DESC
  ) q;
  ASSERT n = 2, '21-1: 주문 2건의 최신 문의가 나오지 않았다';

  SELECT q.id INTO r FROM (
    SELECT DISTINCT ON (r2.order_id) r2.id, r2.order_id FROM refund_requests r2
    JOIN orders o ON o.id = r2.order_id
    WHERE o.user_id = 'u-1'
    ORDER BY r2.order_id, r2.requested_at DESC, r2.id DESC
  ) q WHERE q.order_id = 'o-test-1';
  ASSERT r.id = 'h-2', '21-1: 옛 이력 중 가장 최근 1건을 고르지 않았다';

  -- 21-2. 끝난 상태도 그대로 담긴다(rejected·completed 모두).
  SELECT count(*) INTO n FROM (
    SELECT DISTINCT ON (r2.order_id) r2.status FROM refund_requests r2
    JOIN orders o ON o.id = r2.order_id
    WHERE o.user_id = 'u-1'
    ORDER BY r2.order_id, r2.requested_at DESC, r2.id DESC
  ) q WHERE q.status IN ('rejected', 'completed');
  ASSERT n = 2, '21-2: 끝난 상태가 빠졌다';

  -- 21-3. 남의 주문은 나오지 않는다(소유는 orders와의 조인으로 본다).
  SELECT count(*) INTO n FROM (
    SELECT DISTINCT ON (r2.order_id) r2.id FROM refund_requests r2
    JOIN orders o ON o.id = r2.order_id
    WHERE o.user_id = 'u-1'
    ORDER BY r2.order_id, r2.requested_at DESC, r2.id DESC
  ) q WHERE q.id = 'h-4';
  ASSERT n = 0, '21-3: 남의 문의가 섞였다';

  -- 이 블록이 직접 넣은 흉내 자료만 거두고, 내렸던 인덱스를 원래대로 되돌린다.
  DELETE FROM refund_requests WHERE id IN ('h-1', 'h-2', 'h-3', 'h-4');
  CREATE UNIQUE INDEX IF NOT EXISTS refund_requests_order_once_key
    ON refund_requests (order_id);
  SELECT count(*) INTO n FROM pg_indexes
    WHERE tablename = 'refund_requests' AND indexname = 'refund_requests_order_once_key';
  ASSERT n = 1, '21: 내렸던 주문당 1회 인덱스가 되돌아오지 않았다';
  RAISE NOTICE '주문별 최신 문의 조회 확인';
END $$;

-- ══════════════════════════════════════════════════════════════
-- 22. 마이그레이션 안전성(주문당 1회 인덱스).
--     같은 주문에 이력이 여러 건인 운영 데이터가 있으면 완전 UNIQUE는 만들어지지 않는다.
--     그때도 행을 지우거나 상태를 바꿔 통과시키지 않고, 활성 인덱스는 그대로 남아야 한다.
-- ══════════════════════════════════════════════════════════════
DO $$
DECLARE
  failed BOOLEAN := false;
  n INTEGER;
  before_rows INTEGER;
BEGIN
  CREATE TEMP TABLE dup_orders (id TEXT PRIMARY KEY) ON COMMIT DROP;
  INSERT INTO dup_orders VALUES ('o-dup');
  CREATE TEMP TABLE dup_refunds (
    id TEXT PRIMARY KEY,
    order_id TEXT REFERENCES dup_orders(id),
    status TEXT
  ) ON COMMIT DROP;
  CREATE UNIQUE INDEX dup_active_key ON dup_refunds (order_id)
    WHERE status IN ('requested', 'reviewing', 'approved');
  -- 옛 정책에서 만들어질 수 있었던 모양: 끝난 요청 2건이 같은 주문에 쌓여 있다.
  INSERT INTO dup_refunds VALUES ('d-1', 'o-dup', 'rejected'), ('d-2', 'o-dup', 'completed');
  SELECT count(*) INTO before_rows FROM dup_refunds;

  BEGIN
    CREATE UNIQUE INDEX dup_once_key ON dup_refunds (order_id);
  EXCEPTION WHEN unique_violation THEN
    failed := true;
  END;
  ASSERT failed, '22: 중복 이력이 있는데 완전 UNIQUE가 만들어졌다';

  SELECT count(*) INTO n FROM dup_refunds;
  ASSERT n = before_rows, '22: 인덱스 생성 실패 과정에서 행이 사라졌다';
  SELECT count(*) INTO n FROM pg_indexes WHERE indexname = 'dup_active_key';
  ASSERT n = 1, '22: 실패 후 활성 인덱스가 사라졌다';
  RAISE NOTICE '주문당 1회 마이그레이션 안전성 확인(실패해도 데이터·활성 인덱스 유지)';
END $$;

ROLLBACK;
