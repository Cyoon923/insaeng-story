-- 적립금 원장 기반 테스트 (Refund-Points-Ledger-Foundation-1).
--
-- pointTransactions.ts가 만드는 것과 같은 DDL을 실제 PostgreSQL에 실행해
-- 제약이 실제로 막아 주는지 확인한다. JavaScript로는 볼 수 없는 부분이다.
--
-- 이번 단계에서는 원장 행을 만드는 제품 코드가 아직 없다. 그래서 여기서는
-- "그 자리에 들어올 INSERT가 제약에 걸리는가"만 본다. User.points(app_store JSONB)
-- 갱신과 묶는 한 문장은 복원 기능을 만들 때 별도 테스트로 확인한다.
--
-- 실행:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f src/lib/server/pointTransactions.test.sql
--
-- BEGIN ~ ROLLBACK으로 감싸 데이터를 남기지 않는다(일회용 DB 전제).
BEGIN;

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL
);

-- pointTransactions.ts의 DDL과 같은 형태.
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


INSERT INTO orders (id, user_id) VALUES ('o-1', 'u-1'), ('o-2', 'u-1');

DO $$
DECLARE
  r RECORD;
  n INTEGER;
  blocked BOOLEAN;
BEGIN
  -- 1. 정상 기록. 필요한 값만 넣어도 들어간다.
  INSERT INTO point_transactions (id, order_id, type, amount, refund_request_id)
  VALUES ('pt-1', 'o-1', 'refund-restore', 10000, 'rr-1');
  SELECT * INTO r FROM point_transactions WHERE id = 'pt-1';
  ASSERT r.amount = 10000, '1: 금액이 저장되지 않았다';
  ASSERT r.refund_request_id = 'rr-1', '1: 환불 문의 참조가 저장되지 않았다';
  ASSERT r.created_at IS NOT NULL, '1: 기록 시각이 채워지지 않았다';

  -- 2. ★ 같은 주문 + 같은 유형은 두 번 들어가지 않는다(이중 복원 방어).
  blocked := false;
  BEGIN
    INSERT INTO point_transactions (id, order_id, type, amount)
    VALUES ('pt-2', 'o-1', 'refund-restore', 10000);
  EXCEPTION WHEN unique_violation THEN
    blocked := true;
  END;
  ASSERT blocked, '2: 같은 주문에 복원 기록이 두 번 들어갔다';
  SELECT count(*) INTO n FROM point_transactions WHERE order_id = 'o-1';
  ASSERT n = 1, '2: 주문당 1건이 아니다';

  -- 3. 금액이 달라도 마찬가지다. 멱등 키는 (order_id, type)이지 금액이 아니다.
  blocked := false;
  BEGIN
    INSERT INTO point_transactions (id, order_id, type, amount)
    VALUES ('pt-3', 'o-1', 'refund-restore', 5000);
  EXCEPTION WHEN unique_violation THEN
    blocked := true;
  END;
  ASSERT blocked, '3: 금액이 다르면 중복 기록이 허용됐다';

  -- 4. 다른 주문은 각각 기록할 수 있다.
  INSERT INTO point_transactions (id, order_id, type, amount)
  VALUES ('pt-4', 'o-2', 'refund-restore', 3000);
  SELECT count(*) INTO n FROM point_transactions;
  ASSERT n = 2, '4: 다른 주문의 기록이 막혔다';

  -- 5. ON CONFLICT DO NOTHING으로 받으면 오류 없이 0행이 된다(복원 함수가 쓸 방식).
  INSERT INTO point_transactions (id, order_id, type, amount)
  VALUES ('pt-5', 'o-1', 'refund-restore', 10000)
  ON CONFLICT (order_id, type) DO NOTHING;
  SELECT count(*) INTO n FROM point_transactions WHERE order_id = 'o-1';
  ASSERT n = 1, '5: ON CONFLICT로 받았는데 행이 늘었다';

  -- 6. 0원은 기록하지 않는다.
  blocked := false;
  BEGIN
    INSERT INTO point_transactions (id, order_id, type, amount)
    VALUES ('pt-6', 'o-2', 'refund-restore', 0);
  EXCEPTION WHEN check_violation THEN
    blocked := true;
  END;
  ASSERT blocked, '6: 0원 기록이 들어갔다';

  -- 7. 음수도 막는다.
  blocked := false;
  BEGIN
    INSERT INTO point_transactions (id, order_id, type, amount)
    VALUES ('pt-7', 'o-2', 'refund-restore', -100);
  EXCEPTION WHEN check_violation THEN
    blocked := true;
  END;
  ASSERT blocked, '7: 음수 기록이 들어갔다';

  -- 8. 목록에 없는 유형은 저장되지 않는다.
  blocked := false;
  BEGIN
    INSERT INTO point_transactions (id, order_id, type, amount)
    VALUES ('pt-8', 'o-2', 'earn', 100);
  EXCEPTION WHEN check_violation THEN
    blocked := true;
  END;
  ASSERT blocked, '8: 정의되지 않은 유형이 저장됐다';

  -- 9. 없는 주문에는 기록할 수 없다(FK).
  blocked := false;
  BEGIN
    INSERT INTO point_transactions (id, order_id, type, amount)
    VALUES ('pt-9', 'o-없음', 'refund-restore', 100);
  EXCEPTION WHEN foreign_key_violation THEN
    blocked := true;
  END;
  ASSERT blocked, '9: 없는 주문에 기록이 들어갔다';

  -- 10. 환불 문의 참조는 없어도 된다(추적용이며 멱등 키가 아니다).
  SELECT * INTO r FROM point_transactions WHERE id = 'pt-4';
  ASSERT r.refund_request_id IS NULL, '10: 없는 참조가 채워졌다';

  RAISE NOTICE '적립금 원장 제약 10건 통과';
END $$;

-- 11. 인덱스는 주문당 1회 하나뿐이다.
DO $$
DECLARE
  n INTEGER;
BEGIN
  SELECT count(*) INTO n FROM pg_indexes
    WHERE tablename = 'point_transactions'
      AND indexname = 'point_transactions_order_type_key';
  ASSERT n = 1, '11: 주문당 1회 인덱스가 없다';
  -- 회원별 인덱스를 두지 않는다. 회원 식별자를 남겨 둘 이유가 되기 때문이다
  -- (Privacy-PointTransactions-Minimization-1).
  SELECT count(*) INTO n FROM pg_indexes
    WHERE tablename = 'point_transactions'
      AND indexname = 'point_transactions_user_created_idx';
  ASSERT n = 0, '11: 회원별 조회 인덱스가 되살아났다';
  -- 원장에 회원 식별자 열 자체가 없다.
  SELECT count(*) INTO n FROM information_schema.columns
    WHERE table_name = 'point_transactions' AND column_name = 'user_id';
  ASSERT n = 0, '11: 원장에 회원 식별자 열이 남아 있다';
  RAISE NOTICE '적립금 원장 인덱스 확인';
END $$;

ROLLBACK;
