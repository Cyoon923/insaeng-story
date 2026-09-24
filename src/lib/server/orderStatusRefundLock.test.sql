-- 환불 완료 주문의 진행 상태 잠금 테스트 (Refund-Completed-Progress-Lock-1).
--
-- store.ts writeDataWithOrderStatus가 보내는 것과 같은 한 문장을 실제 PostgreSQL에
-- 실행해, completed 환불 문의가 있는 주문에서는 orders와 app_store 어느 쪽도
-- 바뀌지 않는지 확인한다.
--
-- JavaScript로 볼 수 없는 이유: 잠금이 조회 결과가 아니라 저장 문장 안의 조건이라서,
-- 실제로 두 갱신이 함께 막히는지는 DB에서만 확인할 수 있다.
--
-- 실행:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f src/lib/server/orderStatusRefundLock.test.sql
--
-- BEGIN ~ ROLLBACK으로 감싸 데이터를 남기지 않는다(일회용 DB 전제).
BEGIN;

CREATE TABLE IF NOT EXISTS app_store (
  id INTEGER PRIMARY KEY,
  data JSONB NOT NULL,
  version BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  production_started_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refund_requests (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO app_store (id, data, version) VALUES (1, '{"orders":[]}'::jsonb, 5);
INSERT INTO orders (id, user_id, status) VALUES
  ('o-lock-1', 'u-1', '제작중'),
  ('o-lock-2', 'u-1', '제작중'),
  ('o-lock-3', 'u-1', '제작중');

/**
 * writeDataWithOrderStatus가 보내는 것과 같은 문장(CAS UPDATE 경로).
 * data·expected_version·주문 id·상태·제작 착수 시각을 그대로 받는다.
 */
CREATE OR REPLACE FUNCTION test_write_status(
  p_data JSONB,
  p_expected BIGINT,
  p_order TEXT,
  p_status TEXT,
  p_started TIMESTAMPTZ
)
RETURNS TABLE (locked BOOLEAN, version BIGINT)
LANGUAGE sql AS $fn$
  WITH locked AS (
    SELECT EXISTS (
      SELECT 1 FROM refund_requests WHERE order_id = p_order AND status = 'completed'
    ) AS yes
  ),
  cas AS (
    UPDATE app_store SET data = p_data, version = version + 1
    WHERE id = 1 AND version = p_expected AND NOT (SELECT yes FROM locked)
    RETURNING version
  ),
  touched AS (
    UPDATE orders
    SET status = p_status,
        production_started_at = COALESCE(production_started_at, p_started),
        updated_at = now()
    WHERE id = p_order AND EXISTS (SELECT 1 FROM cas)
  )
  SELECT (SELECT yes FROM locked), (SELECT version FROM cas);
$fn$;

DO $$
DECLARE
  r RECORD;
  o RECORD;
  a RECORD;
BEGIN
  -- 1. 환불 문의가 없으면 기존대로 바뀐다.
  SELECT * INTO r FROM test_write_status('{"v":1}'::jsonb, 5, 'o-lock-1', '완성/전달', NULL);
  ASSERT r.locked = false, '1: 문의가 없는데 잠겼다';
  ASSERT r.version = 6, '1: app_store가 갱신되지 않았다';
  SELECT * INTO o FROM orders WHERE id = 'o-lock-1';
  ASSERT o.status = '완성/전달', '1: 주문 상태가 바뀌지 않았다';

  -- 2. ★ 활성 상태(requested/reviewing/approved)와 rejected는 막지 않는다.
  --    이번 규칙의 대상은 completed 하나뿐이다.
  INSERT INTO refund_requests (id, order_id, user_id, status)
  VALUES ('rr-a', 'o-lock-2', 'u-1', 'requested');
  SELECT * INTO r FROM test_write_status('{"v":2}'::jsonb, 6, 'o-lock-2', '완성/전달', NULL);
  ASSERT r.locked = false, '2: requested인데 잠겼다';
  SELECT * INTO o FROM orders WHERE id = 'o-lock-2';
  ASSERT o.status = '완성/전달', '2: requested인데 상태 변경이 막혔다';

  UPDATE refund_requests SET status = 'reviewing' WHERE id = 'rr-a';
  SELECT * INTO r FROM test_write_status('{"v":3}'::jsonb, 7, 'o-lock-2', '완료', NULL);
  ASSERT r.locked = false, '2: reviewing인데 잠겼다';

  UPDATE refund_requests SET status = 'approved' WHERE id = 'rr-a';
  SELECT * INTO r FROM test_write_status('{"v":4}'::jsonb, 8, 'o-lock-2', '제작중', NULL);
  ASSERT r.locked = false, '2: approved인데 잠겼다';

  UPDATE refund_requests SET status = 'rejected' WHERE id = 'rr-a';
  SELECT * INTO r FROM test_write_status('{"v":5}'::jsonb, 9, 'o-lock-2', '완료', NULL);
  ASSERT r.locked = false, '2: rejected인데 잠겼다';
  SELECT * INTO o FROM orders WHERE id = 'o-lock-2';
  ASSERT o.status = '완료', '2: rejected인데 상태 변경이 막혔다';

  -- 3. ★ completed면 막힌다. 주문도 app_store도 하나도 바뀌지 않는다.
  INSERT INTO refund_requests (id, order_id, user_id, status)
  VALUES ('rr-c', 'o-lock-3', 'u-1', 'completed');
  SELECT version INTO a FROM app_store WHERE id = 1;
  SELECT * INTO r FROM test_write_status('{"v":9}'::jsonb, a.version, 'o-lock-3', '완료', NULL);
  ASSERT r.locked = true, '3: completed인데 잠기지 않았다';
  ASSERT r.version IS NULL, '3: 막혔는데 app_store가 갱신됐다';
  SELECT * INTO o FROM orders WHERE id = 'o-lock-3';
  ASSERT o.status = '제작중', '3: 막혔는데 주문 상태가 바뀌었다';
  SELECT * INTO a FROM app_store WHERE id = 1;
  ASSERT a.data->>'v' IS DISTINCT FROM '9', '3: 막혔는데 app_store data가 덮였다';

  -- 4. 막힌 요청은 제작 착수 시각도 남기지 않는다.
  SELECT version INTO a FROM app_store WHERE id = 1;
  SELECT * INTO r FROM test_write_status('{"v":10}'::jsonb, a.version, 'o-lock-3', '제작중', now());
  ASSERT r.locked = true, '4: completed인데 잠기지 않았다';
  SELECT * INTO o FROM orders WHERE id = 'o-lock-3';
  ASSERT o.production_started_at IS NULL, '4: 막혔는데 제작 착수 시각이 생겼다';

  -- 5. 환불이 끝나도 기존 진행 상태는 그대로 보존된다(자동으로 바꾸지 않는다).
  ASSERT o.status = '제작중', '5: 환불 완료가 진행 상태를 바꿨다';

  -- 6. 다른 주문에는 영향이 없다.
  SELECT version INTO a FROM app_store WHERE id = 1;
  SELECT * INTO r FROM test_write_status('{"v":11}'::jsonb, a.version, 'o-lock-1', '완료', NULL);
  ASSERT r.locked = false, '6: 다른 주문까지 잠겼다';
  SELECT * INTO o FROM orders WHERE id = 'o-lock-1';
  ASSERT o.status = '완료', '6: 다른 주문의 상태 변경이 막혔다';

  RAISE NOTICE '환불 완료 주문 진행 상태 잠금 6건 통과';
END $$;

-- 7. 잠금은 상태 문자열이 아니라 환불 문의를 본다.
--    같은 주문에 completed가 하나라도 있으면 막힌다(이력이 여럿인 옛 자료 대비).
DO $$
DECLARE
  r RECORD;
  a RECORD;
BEGIN
  DELETE FROM refund_requests;
  INSERT INTO refund_requests (id, order_id, user_id, status)
  VALUES ('rr-h1', 'o-lock-1', 'u-1', 'rejected'),
         ('rr-h2', 'o-lock-1', 'u-1', 'completed');
  SELECT version INTO a FROM app_store WHERE id = 1;
  SELECT * INTO r FROM test_write_status('{"v":12}'::jsonb, a.version, 'o-lock-1', '제작중', NULL);
  ASSERT r.locked = true, '7: completed가 섞여 있는데 잠기지 않았다';
  RAISE NOTICE '이력이 여럿인 경우에도 completed면 잠김 확인';
END $$;

ROLLBACK;
