-- 결제 취소 기반 테스트 (Refund-Payment-Cancel-Foundation-1).
--
-- lib/server/store.ts가 보내는 것과 같은 DDL·질의·UPDATE를 실제 PostgreSQL에 실행해
-- 다음을 확인한다.
--   · 주문 1건에 귀속된 승인 결제를 고르는 질의
--   · 취소 시도 감사 열이 승인 기록을 건드리지 않는다는 점
--
-- 실행:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f src/lib/server/paymentCancelFoundation.test.sql
--
-- BEGIN ~ ROLLBACK 으로 감싸 데이터를 남기지 않는다.
-- (운영 DB가 아니라 일회용 로컬/테스트 DB에서 돌리는 것을 전제로 한다.)
BEGIN;

-- store.ts createTables가 만드는 것과 같은 형태(필요한 열만).
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  product TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id),
  provider TEXT NOT NULL,
  merchant_order_id TEXT NOT NULL,
  pg_tid TEXT,
  requested_amount INTEGER NOT NULL,
  approved_amount INTEGER,
  cancelled_amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  method TEXT,
  approved_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  order_snapshot JSONB,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_order_created_idx
  ON payments (order_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS payments_merchant_order_id_key
  ON payments (merchant_order_id);

-- 마이그레이션 전에 만들어진 결제 1건. 새 열이 NULL로 남아야 한다.
INSERT INTO orders (id, user_id, product, title, status, amount)
VALUES
  ('o-pay-1', 'u-1', 'story', '이야기로 만드는 인생곡', '신청접수', 100000),
  ('o-pay-2', 'u-1', 'story', '이야기로 만드는 인생곡', '신청접수', 100000),
  ('o-free',  'u-1', 'story', '이야기로 만드는 인생곡', '신청접수', 0),
  ('o-mixed', 'u-1', 'story', '이야기로 만드는 인생곡', '신청접수', 100000);

INSERT INTO payments (id, order_id, provider, merchant_order_id, pg_tid,
                      requested_amount, approved_amount, status, method, approved_at, raw)
VALUES ('pay-old', 'o-pay-1', 'nicepay', 'is-old', 'tid-old',
        100000, 100000, 'paid', 'card', now() - interval '3 days',
        '{"resultCode":"0000","status":"paid"}'::jsonb);

-- ▼ store.ts runPaymentsMigration이 더하는 취소 감사 열.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS cancel_attempted_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS cancel_result_kind TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS cancel_result_code TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS cancel_result_message TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS cancel_response_raw JSONB;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS cancel_execution_status TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS cancel_claimed_at TIMESTAMPTZ;
-- ▲

/** findPaidPaymentForOrder가 보내는 것과 같은 질의. */
CREATE OR REPLACE FUNCTION test_find_paid(p_order TEXT)
RETURNS TABLE (id TEXT, pg_tid TEXT, approved_amount INTEGER, cancelled_amount INTEGER, status TEXT)
LANGUAGE sql AS $fn$
  SELECT p.id, p.pg_tid, p.approved_amount, p.cancelled_amount, p.status
  FROM payments p
  WHERE p.order_id = p_order AND p.status = 'paid'
  ORDER BY p.created_at DESC, p.id DESC;
$fn$;

/** claimPaymentCancellation이 보내는 것과 같은 조건부 UPDATE. */
CREATE OR REPLACE FUNCTION test_claim_cancel(p_id TEXT)
RETURNS TABLE (
  id TEXT, status TEXT, cancel_execution_status TEXT, cancel_claimed_at TIMESTAMPTZ,
  cancel_attempted_at TIMESTAMPTZ, cancel_result_kind TEXT, cancel_response_raw JSONB,
  cancelled_amount INTEGER, cancelled_at TIMESTAMPTZ
)
LANGUAGE sql AS $fn$
  UPDATE payments
  SET cancel_execution_status = 'processing',
      cancel_claimed_at = now(),
      updated_at = now()
  WHERE payments.id = p_id
    AND payments.status = 'paid'
    AND payments.cancel_execution_status IS NULL
  RETURNING payments.id, payments.status, payments.cancel_execution_status,
            payments.cancel_claimed_at, payments.cancel_attempted_at,
            payments.cancel_result_kind, payments.cancel_response_raw,
            payments.cancelled_amount, payments.cancelled_at;
$fn$;

/** recordPaymentCancelAttempt가 보내는 것과 같은 UPDATE. */
CREATE OR REPLACE FUNCTION test_record_cancel(
  p_id TEXT, p_kind TEXT, p_code TEXT, p_message TEXT, p_raw JSONB
)
RETURNS TABLE (
  id TEXT, status TEXT, cancelled_amount INTEGER, cancelled_at TIMESTAMPTZ,
  approved_amount INTEGER, approved_at TIMESTAMPTZ, raw JSONB,
  cancel_attempted_at TIMESTAMPTZ, cancel_result_kind TEXT,
  cancel_result_code TEXT, cancel_result_message TEXT, cancel_response_raw JSONB
)
LANGUAGE sql AS $fn$
  UPDATE payments
  SET cancel_attempted_at = now(),
      cancel_result_kind = p_kind,
      cancel_execution_status = p_kind,
      cancel_result_code = p_code,
      cancel_result_message = p_message,
      cancel_response_raw = p_raw,
      updated_at = now()
  WHERE payments.id = p_id
    AND payments.status = 'paid'
    AND payments.cancel_execution_status = 'processing'
  RETURNING payments.id, payments.status, payments.cancelled_amount, payments.cancelled_at,
            payments.approved_amount, payments.approved_at, payments.raw,
            payments.cancel_attempted_at, payments.cancel_result_kind,
            payments.cancel_result_code, payments.cancel_result_message,
            payments.cancel_response_raw;
$fn$;

DO $$
DECLARE
  r RECORD;
  n INTEGER;
BEGIN
  -- 1. 마이그레이션이 옛 결제를 건드리지 않았다.
  SELECT * INTO r FROM payments WHERE id = 'pay-old';
  ASSERT r.cancel_attempted_at IS NULL AND r.cancel_result_kind IS NULL
     AND r.cancel_response_raw IS NULL, '1: 옛 결제에 취소 기록이 소급 생성됐다';
  ASSERT r.raw->>'resultCode' = '0000', '1: 승인 응답이 바뀌었다';

  -- 2. 승인 결제가 정확히 하나인 주문 → 1행.
  SELECT count(*) INTO n FROM test_find_paid('o-pay-1');
  ASSERT n = 1, '2: 승인 결제 1건을 찾지 못했다';
  SELECT * INTO r FROM test_find_paid('o-pay-1');
  ASSERT r.pg_tid = 'tid-old', '2: 거래 식별자가 함께 나오지 않았다';
  ASSERT r.approved_amount = 100000 AND r.cancelled_amount = 0, '2: 금액이 함께 나오지 않았다';

  -- 3. 결제 기록이 없는 주문(0원 주문) → 0행.
  SELECT count(*) INTO n FROM test_find_paid('o-free');
  ASSERT n = 0, '3: 결제가 없는 주문에서 행이 나왔다';

  -- 4. 같은 주문에 승인 결제가 둘이면 둘 다 나온다(하나로 좁히지 않는다).
  --    payments.order_id에는 UNIQUE 제약이 없어 DB가 막지 못한다는 점도 함께 확인한다.
  INSERT INTO payments (id, order_id, provider, merchant_order_id, requested_amount,
                        approved_amount, status, approved_at)
  VALUES ('pay-a', 'o-pay-2', 'nicepay', 'is-a', 100000, 100000, 'paid', now()),
         ('pay-b', 'o-pay-2', 'nicepay', 'is-b', 100000, 100000, 'paid', now());
  SELECT count(*) INTO n FROM test_find_paid('o-pay-2');
  ASSERT n = 2, '4: 승인 결제 2건이 모두 나오지 않았다';

  -- 5. 승인되지 않은 상태가 섞여 있어도 승인 건만 대상이 된다.
  INSERT INTO payments (id, order_id, provider, merchant_order_id, requested_amount,
                        approved_amount, status)
  VALUES ('pay-ready', 'o-mixed', 'nicepay', 'is-ready', 100000, NULL, 'ready'),
         ('pay-proc',  'o-mixed', 'nicepay', 'is-proc',  100000, NULL, 'processing'),
         ('pay-fail',  'o-mixed', 'nicepay', 'is-fail',  100000, NULL, 'failed');
  SELECT count(*) INTO n FROM test_find_paid('o-mixed');
  ASSERT n = 0, '5: 승인되지 않은 결제가 대상이 됐다';

  -- 6. 거래 식별자가 없는 승인 건도 숨기지 않는다(호출부가 보고 막아야 할 문제다).
  INSERT INTO payments (id, order_id, provider, merchant_order_id, pg_tid,
                        requested_amount, approved_amount, status)
  VALUES ('pay-notid', 'o-mixed', 'nicepay', 'is-notid', NULL, 100000, 100000, 'paid');
  SELECT * INTO r FROM test_find_paid('o-mixed');
  ASSERT r.id = 'pay-notid' AND r.pg_tid IS NULL, '6: pg_tid 없는 승인 건이 빠졌다';

  RAISE NOTICE '주문 기준 결제 조회 6건 통과';
END $$;

DO $$
DECLARE
  r RECORD;
  n INTEGER;
BEGIN
  -- 7. 선점하지 않은 결제에는 결과를 남길 수 없다.
  SELECT count(*) INTO n FROM test_record_cancel(
    'pay-old', 'succeeded', '2001', '취소되었습니다.', NULL
  );
  ASSERT n = 0, '7: 선점 없이 결과가 기록됐다';
  SELECT * INTO r FROM payments WHERE id = 'pay-old';
  ASSERT r.cancel_result_kind IS NULL AND r.cancel_attempted_at IS NULL,
    '7: 실패한 기록이 값을 남겼다';

  -- 8. 승인된 결제이고 아직 시작 전이면 선점에 성공한다.
  SELECT * INTO r FROM test_claim_cancel('pay-old');
  ASSERT r.cancel_execution_status = 'processing', '8: 선점하지 못했다';
  ASSERT r.cancel_claimed_at IS NOT NULL, '8: 선점 시각이 서버에서 생성되지 않았다';
  -- 선점은 "실행권을 잡았다"는 뜻일 뿐이라 PG 관련 값은 아직 비어 있어야 한다.
  ASSERT r.cancel_attempted_at IS NULL, '8: 아직 보내지도 않았는데 시도 시각이 생겼다';
  ASSERT r.cancel_result_kind IS NULL AND r.cancel_response_raw IS NULL,
    '8: 선점 단계에서 결과가 기록됐다';
  -- 결제 사실 축은 그대로다.
  ASSERT r.status = 'paid', '8: 선점이 결제 상태를 바꿨다';
  ASSERT r.cancelled_amount = 0 AND r.cancelled_at IS NULL, '8: 선점이 취소 금액·시각을 바꿨다';

  -- 9. 같은 결제를 두 번째로 선점할 수 없다.
  SELECT count(*) INTO n FROM test_claim_cancel('pay-old');
  ASSERT n = 0, '9: 같은 결제를 두 번 선점했다';

  -- 10. 승인되지 않은 결제는 선점되지 않는다.
  SELECT count(*) INTO n FROM test_claim_cancel('pay-ready');
  ASSERT n = 0, '10: ready 결제가 선점됐다';
  SELECT count(*) INTO n FROM test_claim_cancel('pay-proc');
  ASSERT n = 0, '10: processing 결제가 선점됐다';
  SELECT count(*) INTO n FROM test_claim_cancel('pay-fail');
  ASSERT n = 0, '10: failed 결제가 선점됐다';

  -- 11. 선점한 요청은 결과를 남길 수 있고, 결과 종류와 실행 단계가 함께 기록된다.
  SELECT * INTO r FROM test_record_cancel(
    'pay-old', 'unknown', NULL, '결과를 확인하는 중입니다.', '{"http":504}'::jsonb
  );
  ASSERT r.cancel_result_kind = 'unknown', '11: 취소 결과 종류가 저장되지 않았다';
  ASSERT r.cancel_attempted_at IS NOT NULL, '11: 시도 시각이 서버에서 생성되지 않았다';
  ASSERT r.cancel_response_raw->>'http' = '504', '11: 취소 응답 원문이 저장되지 않았다';
  SELECT cancel_execution_status INTO r FROM payments WHERE id = 'pay-old';
  ASSERT r.cancel_execution_status = 'unknown', '11: 실행 단계가 결과와 함께 바뀌지 않았다';

  -- 12. 결과 기록이 승인 기록을 덮지 않고 결제 사실도 바꾸지 않는다.
  SELECT * INTO r FROM payments WHERE id = 'pay-old';
  ASSERT r.raw->>'resultCode' = '0000', '12: 승인 응답이 취소 응답으로 덮였다';
  ASSERT r.approved_amount = 100000 AND r.approved_at IS NOT NULL, '12: 승인 금액·시각이 바뀌었다';
  ASSERT r.status = 'paid', '12: 결제 상태가 바뀌었다';
  ASSERT r.cancelled_amount = 0 AND r.cancelled_at IS NULL, '12: 취소 금액·시각이 바뀌었다';

  -- 13. unknown은 다시 선점할 수 없다(자동 재시도 금지).
  SELECT count(*) INTO n FROM test_claim_cancel('pay-old');
  ASSERT n = 0, '13: unknown 결제가 다시 선점됐다';
  -- 결과도 다시 쓸 수 없다(이미 processing이 아니다).
  SELECT count(*) INTO n FROM test_record_cancel('pay-old', 'succeeded', '2001', 'ok', NULL);
  ASSERT n = 0, '13: 끝난 결제에 결과가 다시 기록됐다';

  -- 14. succeeded·declined도 같은 자리에 기록되고, 그 뒤 다시 선점할 수 없다.
  INSERT INTO payments (id, order_id, provider, merchant_order_id, pg_tid,
                        requested_amount, approved_amount, status, approved_at, raw)
  VALUES ('pay-ok', 'o-pay-1', 'nicepay', 'is-ok', 'tid-ok', 100000, 100000, 'paid', now(),
          '{"resultCode":"0000"}'::jsonb),
         ('pay-no', 'o-pay-1', 'nicepay', 'is-no', 'tid-no', 100000, 100000, 'paid', now(),
          '{"resultCode":"0000"}'::jsonb);

  PERFORM test_claim_cancel('pay-ok');
  SELECT * INTO r FROM test_record_cancel(
    'pay-ok', 'succeeded', '2001', '취소되었습니다.', '{"resultCode":"2001"}'::jsonb
  );
  ASSERT r.cancel_result_kind = 'succeeded', '14: succeeded 미저장';
  -- 성공을 기록해도 이 단계에서는 결제 상태를 바꾸지 않는다.
  ASSERT r.status = 'paid' AND r.cancelled_amount = 0 AND r.cancelled_at IS NULL,
    '14: succeeded 기록만으로 결제가 취소 처리됐다';
  SELECT count(*) INTO n FROM test_claim_cancel('pay-ok');
  ASSERT n = 0, '14: succeeded 결제가 다시 선점됐다';

  PERFORM test_claim_cancel('pay-no');
  SELECT * INTO r FROM test_record_cancel(
    'pay-no', 'declined', '2003', '취소할 수 없는 거래입니다.', '{"resultCode":"2003"}'::jsonb
  );
  ASSERT r.cancel_result_kind = 'declined' AND r.cancel_result_code = '2003', '14: declined 미저장';
  ASSERT r.status = 'paid' AND r.cancelled_amount = 0, '14: declined인데 결제가 바뀌었다';
  SELECT count(*) INTO n FROM test_claim_cancel('pay-no');
  ASSERT n = 0, '14: declined 결제가 다시 선점됐다';

  RAISE NOTICE '취소 실행권 선점·결과 기록 8건 통과';
END $$;

ROLLBACK;
