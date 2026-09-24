-- 적립금 복원 원장 묶음 조회 테스트 (Refund-Points-Restore-Admin-UI-1).
--
-- pointTransactions.ts listRefundRestoredOrderIds가 보내는 것과 같은 질의를 실제
-- PostgreSQL에 실행해, 관리자 목록 표시가 읽는 사실이 정확한지 본다.
--
-- 이 조회는 "원장 행이 있는가"만 읽는다. 적립금을 얼마 썼는지, 복원이 필요한지는
-- 보지 않는다. 그 판정을 이 질의에 넣으면 decidePointsRestore를 SQL로 복제하게 된다.
--
-- 실행:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f src/lib/server/pointsRestoreLedgerLookup.test.sql
--
-- BEGIN ~ ROLLBACK으로 감싸 데이터를 남기지 않는다(일회용 DB 전제).
BEGIN;

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
  CONSTRAINT point_transactions_amount_check CHECK (amount > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS point_transactions_order_type_key
  ON point_transactions (order_id, type);

INSERT INTO orders (id, user_id) VALUES
  ('o-복원됨', 'u-1'),
  ('o-기록없음', 'u-1'),
  ('o-다른유형', 'u-2'),
  ('o-목록밖', 'u-3');

INSERT INTO point_transactions (id, order_id, type, amount) VALUES
  ('pt-1', 'o-복원됨', 'refund-restore', 10000),
  -- 목록에 넣지 않을 주문. 섞여 나오면 안 된다.
  ('pt-2', 'o-목록밖', 'refund-restore', 5000),
  -- 다른 유형의 기록. 이 조회의 대상이 아니다(지금은 type CHECK가 하나뿐이라
  -- 제약을 잠시 떼고 넣는다. 앞으로 유형이 늘어도 이 질의가 섞지 않는지 본다).
  ('pt-3', 'o-다른유형', 'earn', 3000);

/** listRefundRestoredOrderIds가 보내는 것과 같은 질의. */
CREATE OR REPLACE FUNCTION test_restored_ids(p_ids TEXT[])
RETURNS TABLE (order_id TEXT)
LANGUAGE sql AS $fn$
  SELECT DISTINCT order_id FROM point_transactions
  WHERE order_id = ANY(p_ids) AND type = 'refund-restore'
$fn$;

DO $$
DECLARE
  n INTEGER;
  found BOOLEAN;
BEGIN
  -- 1. 여러 주문을 한 번에 넘긴다. 기록이 있는 주문만 돌아온다.
  SELECT count(*) INTO n FROM test_restored_ids(
    ARRAY['o-복원됨', 'o-기록없음', 'o-다른유형']);
  ASSERT n = 1, '1: 돌아온 주문 수가 1이 아니다';

  -- 2. 원장이 있는 주문 → 포함된다.
  SELECT EXISTS (
    SELECT 1 FROM test_restored_ids(ARRAY['o-복원됨', 'o-기록없음']) WHERE order_id = 'o-복원됨'
  ) INTO found;
  ASSERT found, '2: 원장이 있는 주문이 빠졌다';

  -- 3. 원장이 없는 주문 → 포함되지 않는다.
  SELECT EXISTS (
    SELECT 1 FROM test_restored_ids(ARRAY['o-복원됨', 'o-기록없음']) WHERE order_id = 'o-기록없음'
  ) INTO found;
  ASSERT NOT found, '3: 원장이 없는 주문이 돌아왔다';

  -- 4. 다른 유형(earn)은 섞이지 않는다.
  SELECT count(*) INTO n FROM test_restored_ids(ARRAY['o-다른유형']);
  ASSERT n = 0, '4: refund-restore가 아닌 기록이 섞였다';

  -- 5. 목록에 없는 주문은 돌아오지 않는다.
  SELECT EXISTS (
    SELECT 1 FROM test_restored_ids(ARRAY['o-복원됨']) WHERE order_id = 'o-목록밖'
  ) INTO found;
  ASSERT NOT found, '5: 넘기지 않은 주문이 돌아왔다';

  -- 6. 빈 목록도 안전하다. 전체를 훑어 돌려주지 않는다.
  SELECT count(*) INTO n FROM test_restored_ids(ARRAY[]::TEXT[]);
  ASSERT n = 0, '6: 빈 목록인데 결과가 있다';

  -- 7. 같은 주문이 여러 번 들어와도 1행이다(DISTINCT).
  SELECT count(*) INTO n FROM test_restored_ids(ARRAY['o-복원됨', 'o-복원됨', 'o-복원됨']);
  ASSERT n = 1, '7: 같은 주문이 여러 행으로 돌아왔다';

  RAISE NOTICE '적립금 원장 묶음 조회 7건 통과';
END $$;

ROLLBACK;
