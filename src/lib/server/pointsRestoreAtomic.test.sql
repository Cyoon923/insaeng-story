-- 적립금 복원 원자성 테스트 (Refund-Points-Restore-Atomic-1).
--
-- store.ts restoreOrderPointsOnce가 보내는 것과 같은 한 문장을 실제 PostgreSQL에 실행해,
-- 잔액(app_store JSONB)과 원장(point_transactions)이 **함께 성립하거나 함께 없는지** 본다.
--
-- JavaScript로는 볼 수 없다. 보장이 코드의 순서가 아니라 한 문장 안의 데이터 의존
-- 관계와 제약에서 나오기 때문이다.
--
-- 실행:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f src/lib/server/pointsRestoreAtomic.test.sql
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

INSERT INTO orders (id, user_id) VALUES ('o-1', 'u-1'), ('o-2', 'u-1'), ('o-other', 'u-2');
INSERT INTO app_store (id, data, version)
VALUES (1, '{"users":[{"id":"u-1","points":500}]}'::jsonb, 3);

/**
 * restoreOrderPointsOnce가 보내는 것과 같은 문장.
 *
 * p_data는 호출부가 잔액을 올려 둔 뒤 직렬화한 JSONB다. 이 문장은 그 data를
 * "원장이 새로 들어갈 수 있을 때만" 저장한다.
 */
CREATE OR REPLACE FUNCTION test_restore(
  p_data JSONB,
  p_expected BIGINT,
  p_tx_id TEXT,
  p_order TEXT,
  p_user TEXT,
  p_amount INTEGER,
  p_refund TEXT DEFAULT NULL
)
RETURNS TABLE (version BIGINT, inserted BIGINT, existing BIGINT, guard INTEGER)
LANGUAGE sql AS $fn$
  WITH cas AS (
    UPDATE app_store SET data = p_data, version = version + 1
    WHERE id = 1 AND version = p_expected
      AND NOT EXISTS (
        SELECT 1 FROM point_transactions
        WHERE order_id = p_order AND type = 'refund-restore'
      )
    RETURNING version
  ),
  inserted AS (
    INSERT INTO point_transactions (id, order_id, type, amount, refund_request_id)
    SELECT p_tx_id, o.id, 'refund-restore', p_amount, p_refund
    FROM orders o
    WHERE o.id = p_order AND o.user_id = p_user
      AND EXISTS (SELECT 1 FROM cas)
    ON CONFLICT (order_id, type) DO NOTHING
    RETURNING id
  )
  SELECT
    (SELECT version FROM cas),
    (SELECT count(*) FROM inserted),
    (SELECT count(*) FROM point_transactions
       WHERE order_id = p_order AND type = 'refund-restore'),
    -- 잔액만 늘고 원장이 남지 않는 경우를 문장 실패로 만든다.
    -- 분모를 상수 0으로 두면 계획 단계에서 접혀 언제나 실패하므로, 실제 기록 수를 쓴다.
    CASE
      WHEN (SELECT count(*) FROM cas) = 1 AND (SELECT count(*) FROM inserted) = 0
      THEN 1 / (SELECT count(*)::int FROM inserted)
      ELSE 0
    END;
$fn$;

DO $$
DECLARE
  r RECORD;
  a RECORD;
  n INTEGER;
  failed BOOLEAN;
BEGIN
  -- 1. 정상 복원. 잔액은 정확히 +amount, 원장 1행.
  SELECT * INTO r FROM test_restore(
    '{"users":[{"id":"u-1","points":10500}]}'::jsonb, 3, 'pt-1', 'o-1', 'u-1', 10000, 'rr-1');
  ASSERT r.version = 4, '1: app_store가 갱신되지 않았다';
  ASSERT r.inserted = 1, '1: 원장에 기록되지 않았다';
  SELECT * INTO a FROM app_store WHERE id = 1;
  ASSERT (a.data->'users'->0->>'points')::int = 10500, '1: 잔액이 반영되지 않았다';
  SELECT count(*) INTO n FROM point_transactions WHERE order_id = 'o-1';
  ASSERT n = 1, '1: 원장 행이 1건이 아니다';

  -- 2. ★ 같은 주문 재실행. 잔액도 원장도 더 늘지 않는다.
  SELECT * INTO r FROM test_restore(
    '{"users":[{"id":"u-1","points":20500}]}'::jsonb, 4, 'pt-2', 'o-1', 'u-1', 10000, 'rr-1');
  ASSERT r.version IS NULL, '2: 재실행인데 app_store가 갱신됐다';
  ASSERT r.inserted = 0, '2: 원장이 또 들어갔다';
  ASSERT r.existing = 1, '2: 기존 원장 행을 보지 못했다';
  SELECT * INTO a FROM app_store WHERE id = 1;
  ASSERT (a.data->'users'->0->>'points')::int = 10500, '2: 잔액이 또 늘었다';
  ASSERT a.version = 4, '2: version이 올라갔다';
  SELECT count(*) INTO n FROM point_transactions WHERE order_id = 'o-1';
  ASSERT n = 1, '2: 원장 행이 늘었다';

  -- 3. ★ CAS version 불일치. 잔액도 원장도 그대로다.
  SELECT * INTO r FROM test_restore(
    '{"users":[{"id":"u-1","points":13500}]}'::jsonb, 99, 'pt-3', 'o-2', 'u-1', 3000);
  ASSERT r.version IS NULL, '3: version이 틀린데 갱신됐다';
  ASSERT r.inserted = 0, '3: version이 틀린데 원장이 들어갔다';
  SELECT * INTO a FROM app_store WHERE id = 1;
  ASSERT (a.data->'users'->0->>'points')::int = 10500, '3: 잔액이 바뀌었다';
  SELECT count(*) INTO n FROM point_transactions WHERE order_id = 'o-2';
  ASSERT n = 0, '3: 원장이 남았다';

  -- 4. 다른 주문은 각각 복원된다.
  SELECT * INTO r FROM test_restore(
    '{"users":[{"id":"u-1","points":13500}]}'::jsonb, 4, 'pt-4', 'o-2', 'u-1', 3000, 'rr-2');
  ASSERT r.version = 5, '4: 다른 주문의 복원이 막혔다';
  ASSERT r.inserted = 1, '4: 다른 주문의 원장이 없다';
  SELECT * INTO a FROM app_store WHERE id = 1;
  ASSERT (a.data->'users'->0->>'points')::int = 13500, '4: 잔액이 반영되지 않았다';

  -- 5. ★ 원장을 남길 수 없으면 잔액도 늘지 않는다(주문 소유자 불일치 → 문장 실패).
  failed := false;
  BEGIN
    PERFORM test_restore(
      '{"users":[{"id":"u-1","points":99999}]}'::jsonb, 5, 'pt-5', 'o-other', 'u-1', 1000);
  EXCEPTION WHEN division_by_zero THEN
    failed := true;
  END;
  ASSERT failed, '5: 소유자가 달라도 통과했다';
  SELECT * INTO a FROM app_store WHERE id = 1;
  ASSERT (a.data->'users'->0->>'points')::int = 13500, '5: 잔액만 늘었다';
  ASSERT a.version = 5, '5: version이 올라갔다';
  SELECT count(*) INTO n FROM point_transactions WHERE order_id = 'o-other';
  ASSERT n = 0, '5: 남의 주문에 원장이 들어갔다';

  -- 6. 없는 주문도 같다. 잔액만 늘어나는 일이 없다.
  failed := false;
  BEGIN
    PERFORM test_restore(
      '{"users":[{"id":"u-1","points":99999}]}'::jsonb, 5, 'pt-6', 'o-없음', 'u-1', 1000);
  EXCEPTION WHEN division_by_zero THEN
    failed := true;
  END;
  ASSERT failed, '6: 없는 주문인데 통과했다';
  SELECT * INTO a FROM app_store WHERE id = 1;
  ASSERT (a.data->'users'->0->>'points')::int = 13500, '6: 잔액이 바뀌었다';

  -- 7. 금액 제약도 그대로 살아 있다(0원은 원장이 막고, 그래서 잔액도 안 바뀐다).
  failed := false;
  BEGIN
    PERFORM test_restore(
      '{"users":[{"id":"u-1","points":13500}]}'::jsonb, 5, 'pt-7', 'o-1', 'u-1', 0);
  EXCEPTION WHEN check_violation OR division_by_zero THEN
    failed := true;
  END;
  SELECT * INTO a FROM app_store WHERE id = 1;
  ASSERT (a.data->'users'->0->>'points')::int = 13500, '7: 잔액이 바뀌었다';

  RAISE NOTICE '적립금 복원 원자성 7건 통과';
END $$;

ROLLBACK;
