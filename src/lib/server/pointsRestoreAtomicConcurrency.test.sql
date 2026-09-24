-- 적립금 복원 동시 실행 테스트 (Refund-Points-Restore-Atomic-1).
--
-- 같은 주문의 복원이 두 연결에서 동시에 들어와도 잔액은 정확히 한 번만 늘고
-- 원장도 1행이어야 한다. 한 연결 안에서는 경합이 생기지 않아 실제 연결 두 개로 확인한다.
--
-- 실행 순서(일회용 DB에서만. 경합을 보려면 두 연결이 같은 커밋된 행을 봐야 하므로
-- 이 스크립트는 롤백하지 않는다):
--   createdb points_race_test
--   psql "<url>/points_race_test" -v ON_ERROR_STOP=1 -f src/lib/server/pointsRestoreAtomicConcurrency.test.sql
--   psql ... -c "SELECT reset_points_race()"
--   psql ... -c "SELECT restore_once('c1')" &  psql ... -c "SELECT restore_once('c2')" &  wait
--   psql ... -c "SELECT verify_points_race()"
--   dropdb points_race_test

CREATE TABLE IF NOT EXISTS app_store (
  id INTEGER PRIMARY KEY,
  data JSONB NOT NULL,
  version BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS point_transactions (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  refund_request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT point_transactions_amount_check CHECK (amount > 0),
  CONSTRAINT point_transactions_type_check CHECK (type IN ('refund-restore'))
);

CREATE UNIQUE INDEX IF NOT EXISTS point_transactions_order_type_key
  ON point_transactions (order_id, type);

/** 매 회차 같은 출발점으로 되돌린다. 잔액 500, 원장 없음. */
CREATE OR REPLACE FUNCTION reset_points_race() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM point_transactions;
  DELETE FROM orders;
  DELETE FROM app_store;
  INSERT INTO orders (id, user_id) VALUES ('o-race', 'u-1');
  INSERT INTO app_store (id, data, version)
  VALUES (1, '{"users":[{"id":"u-1","points":500}]}'::jsonb, 0);
END $$;

/**
 * restoreOrderPointsOnce가 보내는 것과 같은 문장.
 *
 * 두 연결 모두 같은 기준 version(0)을 읽고 같은 결과(잔액 10500)를 저장하려 한다.
 * 실제 서버에서도 각 요청이 자기가 읽은 AppData에 잔액을 올려 직렬화하므로 같은 모양이다.
 * 성공(잔액을 올렸다)이면 true다.
 */
CREATE OR REPLACE FUNCTION restore_once(tag TEXT) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
  v BIGINT;
  ins BIGINT;
BEGIN
  WITH cas AS (
    UPDATE app_store SET data = '{"users":[{"id":"u-1","points":10500}]}'::jsonb,
                         version = version + 1
    WHERE id = 1 AND version = 0
      AND NOT EXISTS (
        SELECT 1 FROM point_transactions WHERE order_id = 'o-race' AND type = 'refund-restore'
      )
    RETURNING version
  ),
  inserted AS (
    INSERT INTO point_transactions (id, order_id, type, amount, refund_request_id)
    SELECT 'pt-' || tag, o.id, 'refund-restore', 10000, 'rr-race'
    FROM orders o
    WHERE o.id = 'o-race' AND o.user_id = 'u-1'
      AND EXISTS (SELECT 1 FROM cas)
    ON CONFLICT (order_id, type) DO NOTHING
    RETURNING id
  )
  SELECT
    (SELECT version FROM cas),
    (SELECT count(*) FROM inserted),
    CASE
      WHEN (SELECT count(*) FROM cas) = 1 AND (SELECT count(*) FROM inserted) = 0
      THEN 1 / (SELECT count(*)::int FROM inserted)
      ELSE 0
    END
  INTO v, ins;
  RETURN v IS NOT NULL AND ins = 1;
END $$;

/** 동시에 들어와도 잔액은 한 번만 늘고 원장은 1행이어야 한다. */
CREATE OR REPLACE FUNCTION verify_points_race() RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  a RECORD;
  n INTEGER;
BEGIN
  SELECT * INTO a FROM app_store WHERE id = 1;
  ASSERT (a.data->'users'->0->>'points')::int = 10500, '잔액이 한 번만 늘지 않았다';
  ASSERT a.version = 1, 'app_store가 두 번 갱신됐다';
  SELECT count(*) INTO n FROM point_transactions WHERE order_id = 'o-race';
  ASSERT n = 1, '원장이 1행이 아니다';
  RAISE NOTICE '동시 복원 확인: 잔액 1회 증가, 원장 1행';
END $$;
