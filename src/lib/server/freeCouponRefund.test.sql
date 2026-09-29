-- 무료 쿠폰 0원 건 결제 없는 완료 저장 테스트 (Refund-Free-Coupon-Zero-Complete-1).
--
-- freeCouponRefund.ts saveFreeCouponRefundCompleted가 보내는 것과 같은 한 문장을 실제
-- PostgreSQL에 실행해, 조건이 맞을 때만 approved → completed가 되는지 확인한다.
--
-- 실행:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f src/lib/server/freeCouponRefund.test.sql
--
-- BEGIN ~ ROLLBACK 으로 감싸 데이터를 남기지 않는다(일회용 DB 전제).
BEGIN;

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id),
  provider TEXT NOT NULL DEFAULT 'nicepay',
  merchant_order_id TEXT NOT NULL,
  requested_amount INTEGER NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS refund_requests (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  handled_by TEXT,
  completed_at TIMESTAMPTZ
);

/** saveFreeCouponRefundCompleted가 보내는 것과 같은 한 문장. */
CREATE OR REPLACE FUNCTION test_complete_free(
  p_order TEXT, p_base INTEGER, p_coupon TEXT, p_completed_at TIMESTAMPTZ
)
RETURNS BIGINT
LANGUAGE sql AS $fn$
  WITH target_refund AS (
    SELECT id FROM refund_requests
    WHERE order_id = p_order AND status = 'approved'
    FOR UPDATE
  ),
  active_refunds AS (
    SELECT count(*) AS total FROM refund_requests
    WHERE order_id = p_order AND status IN ('requested', 'reviewing', 'approved')
  ),
  free_order AS (
    SELECT id FROM orders
    WHERE id = p_order
      AND amount = 0
      AND base_amount = p_base
      AND payment = '무료 쿠폰'
      AND details->>'couponFree' = '1'
      AND details->>'couponId' = p_coupon
      AND COALESCE(details->>'pointsUsed', '') = ''
      AND COALESCE(details->>'promotion', '') = ''
      AND NOT EXISTS (SELECT 1 FROM payments WHERE order_id = p_order)
  ),
  completed AS (
    UPDATE refund_requests
    SET status = 'completed',
        completed_at = COALESCE(completed_at, p_completed_at)
    WHERE id = (SELECT id FROM target_refund)
      AND status = 'approved'
      AND (SELECT total FROM active_refunds) = 1
      AND EXISTS (SELECT 1 FROM free_order)
    RETURNING id
  )
  SELECT (SELECT count(*) FROM completed);
$fn$;

CREATE OR REPLACE FUNCTION seed_free(
  p_id TEXT, p_refund_status TEXT DEFAULT 'approved', p_details JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE sql AS $fn$
  INSERT INTO orders (id, user_id, product, title, status, amount, base_amount, payment, details)
  VALUES (p_id, 'u-1', 'story', '인생곡', '신청접수', 0, 149000, '무료 쿠폰',
          COALESCE(p_details, '{"couponId":"cp-1","couponFree":"1","optionIds":""}'::jsonb));
  INSERT INTO refund_requests (id, order_id, user_id, status, decided_at, handled_by)
  VALUES ('rr-' || p_id, p_id, 'u-1', p_refund_status, '2026-09-17T00:00:00Z', 'admin');
$fn$;

DO $$
DECLARE
  first_time TIMESTAMPTZ := '2026-09-18T12:00:00Z';
  later_time TIMESTAMPTZ := '2026-09-19T12:00:00Z';
  n BIGINT;
  r RECORD;
  o RECORD;
BEGIN
  -- 정상: approved → completed, completed_at 기록, 주문은 그대로.
  PERFORM seed_free('f1');
  n := test_complete_free('f1', 149000, 'cp-1', first_time);
  ASSERT n = 1, 'eligible should complete';
  SELECT * INTO r FROM refund_requests WHERE id = 'rr-f1';
  ASSERT r.status = 'completed', 'status completed';
  ASSERT r.completed_at = first_time, 'completed_at recorded';
  ASSERT r.decided_at = '2026-09-17T00:00:00Z' AND r.handled_by = 'admin', 'decision kept';
  SELECT * INTO o FROM orders WHERE id = 'f1';
  ASSERT o.status = '신청접수' AND o.amount = 0 AND o.details->>'couponId' = 'cp-1', 'order untouched';
  ASSERT (SELECT count(*) FROM payments WHERE order_id = 'f1') = 0, 'no payment created';

  -- M/N: 반복 실행은 0행, completed_at 최초값 유지.
  n := test_complete_free('f1', 149000, 'cp-1', later_time);
  ASSERT n = 0, 'second run must not complete again';
  SELECT * INTO r FROM refund_requests WHERE id = 'rr-f1';
  ASSERT r.completed_at = first_time, 'completed_at keeps first value';

  -- O: 저장 직전 결제 행이 생기면 완료되지 않는다.
  PERFORM seed_free('f2');
  INSERT INTO payments (id, order_id, merchant_order_id, requested_amount, status)
  VALUES ('pay-f2', 'f2', 'is-f2', 1000, 'ready');
  n := test_complete_free('f2', 149000, 'cp-1', first_time);
  ASSERT n = 0, 'payment row blocks completion';
  ASSERT (SELECT status FROM refund_requests WHERE id = 'rr-f2') = 'approved', 'stays approved';

  -- L: approved가 아니면 완료되지 않는다.
  PERFORM seed_free('f3', 'reviewing');
  n := test_complete_free('f3', 149000, 'cp-1', first_time);
  ASSERT n = 0, 'reviewing must not complete';
  ASSERT (SELECT status FROM refund_requests WHERE id = 'rr-f3') = 'reviewing', 'stays reviewing';

  -- 판정 뒤 주문 값이 달라졌으면(쿠폰·금액·적립금·이벤트) 완료되지 않는다.
  PERFORM seed_free('f4');
  n := test_complete_free('f4', 159000, 'cp-1', first_time);
  ASSERT n = 0, 'base amount mismatch';
  n := test_complete_free('f4', 149000, 'cp-other', first_time);
  ASSERT n = 0, 'coupon mismatch';
  PERFORM seed_free('f5', 'approved', '{"couponId":"cp-1","couponFree":"1","pointsUsed":"5000"}');
  ASSERT test_complete_free('f5', 149000, 'cp-1', first_time) = 0, 'points used';
  PERFORM seed_free('f6', 'approved', '{"couponId":"cp-1","couponFree":"1","promotion":"saju-song-open-2026"}');
  ASSERT test_complete_free('f6', 149000, 'cp-1', first_time) = 0, 'promotion';
  UPDATE orders SET amount = 1000 WHERE id = 'f4';
  ASSERT test_complete_free('f4', 149000, 'cp-1', first_time) = 0, 'amount not zero';

  -- 활성 문의가 둘이면 완료되지 않는다(인덱스 이전 자료 가정).
  PERFORM seed_free('f7');
  INSERT INTO refund_requests (id, order_id, user_id, status) VALUES ('rr-f7b', 'f7', 'u-1', 'requested');
  ASSERT test_complete_free('f7', 149000, 'cp-1', first_time) = 0, 'ambiguous active';

  RAISE NOTICE 'freeCouponRefund.test.sql: all assertions passed';
END $$;

ROLLBACK;
