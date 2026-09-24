-- 전액취소 최종화 테스트 (Refund-Payment-Finalization-1).
--
-- store.ts finalizeRefundPaymentCancel이 보내는 것과 같은 한 문장을 실제 PostgreSQL에
-- 실행해, 결제와 환불 문의가 함께 바뀌거나 함께 안 바뀌는지 확인한다.
--
-- 실행:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f src/lib/server/refundPaymentFinalization.test.sql
--
-- BEGIN ~ ROLLBACK 으로 감싸 데이터를 남기지 않는다(일회용 DB 전제).
-- 동시 실행 검증은 연결이 둘 필요해 refundPaymentFinalizationConcurrency.test.sql에서 한다.
BEGIN;

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  product TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id),
  provider TEXT NOT NULL DEFAULT 'nicepay',
  merchant_order_id TEXT NOT NULL,
  pg_tid TEXT,
  requested_amount INTEGER NOT NULL,
  approved_amount INTEGER,
  cancelled_amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  approved_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  raw JSONB,
  cancel_attempted_at TIMESTAMPTZ,
  cancel_result_kind TEXT,
  cancel_result_code TEXT,
  cancel_result_message TEXT,
  cancel_response_raw JSONB,
  cancel_execution_status TEXT,
  cancel_claimed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refund_requests (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT,
  message TEXT,
  decided_at TIMESTAMPTZ,
  handled_by TEXT,
  -- 종결한 서버 시각. 승인 시각(decided_at)·PG 취소 시각과 다른 칸이다.
  completed_at TIMESTAMPTZ
);

/** finalizeRefundPaymentCancel이 보내는 것과 같은 한 문장. */
CREATE OR REPLACE FUNCTION test_finalize(
  p_payment TEXT, p_order TEXT, p_tid TEXT, p_approved INTEGER,
  p_execution TEXT, p_cancelled INTEGER, p_cancelled_at TIMESTAMPTZ,
  -- 서버가 만드는 종결 시각. 제품 코드에서는 finalizeRefundPaymentCancel이 만든다.
  p_completed_at TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (paid_rows BIGINT, completed_rows BIGINT)
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
  paid AS (
    UPDATE payments
    SET status = 'cancelled',
        cancelled_amount = p_cancelled,
        cancelled_at = p_cancelled_at,
        cancel_execution_status = 'succeeded',
        updated_at = now()
    WHERE id = p_payment
      AND order_id = p_order
      AND pg_tid = p_tid
      AND status = 'paid'
      AND approved_amount = p_approved
      AND cancelled_amount = 0
      AND cancel_execution_status = p_execution
      AND (SELECT total FROM active_refunds) = 1
      AND EXISTS (SELECT 1 FROM target_refund)
    RETURNING id
  ),
  completed AS (
    UPDATE refund_requests
    SET status = 'completed',
        completed_at = COALESCE(completed_at, p_completed_at)
    WHERE id = (SELECT id FROM target_refund)
      AND status = 'approved'
      AND EXISTS (SELECT 1 FROM paid)
    RETURNING id
  )
  SELECT (SELECT count(*) FROM paid), (SELECT count(*) FROM completed);
$fn$;

/** 한 건을 깨끗한 상태로 다시 만든다. */
CREATE OR REPLACE FUNCTION seed(
  p_suffix TEXT, p_execution TEXT DEFAULT 'succeeded', p_refund_status TEXT DEFAULT 'approved'
)
RETURNS VOID
LANGUAGE sql AS $fn$
  INSERT INTO orders (id, user_id, product, title, status, amount)
  VALUES ('o-' || p_suffix, 'u-1', 'story', '인생곡', '신청접수', 100000)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO payments (id, order_id, merchant_order_id, pg_tid, requested_amount,
                        approved_amount, status, approved_at, raw,
                        cancel_attempted_at, cancel_result_kind, cancel_result_code,
                        cancel_response_raw, cancel_execution_status, cancel_claimed_at)
  VALUES ('pay-' || p_suffix, 'o-' || p_suffix, 'is-' || p_suffix, 'tid-' || p_suffix,
          100000, 100000, 'paid', now() - interval '3 days',
          '{"resultCode":"0000","status":"paid"}'::jsonb,
          now(), 'succeeded', '2001', '{"resultCode":"2001"}'::jsonb, p_execution, now());

  INSERT INTO refund_requests (id, order_id, user_id, status, reason, decided_at, handled_by)
  VALUES ('rr-' || p_suffix, 'o-' || p_suffix, 'u-1', p_refund_status, 'schedule',
          '2026-09-17T00:00:00Z'::timestamptz, 'admin');
$fn$;

DO $$
DECLARE
  r RECORD;
  p RECORD;
  q RECORD;
  pg_time TIMESTAMPTZ := '2026-09-17T09:00:00+09:00'::timestamptz;
  -- 서버가 만드는 종결 시각. PG 시각과 일부러 다른 값으로 두어 둘이 섞이지 않는지 본다.
  srv_time TIMESTAMPTZ := '2026-09-18T12:34:56Z'::timestamptz;
BEGIN
  -- 1. 정상 성공(normal). 결제와 환불 문의가 함께 바뀐다.
  PERFORM seed('n1', 'succeeded');
  SELECT * INTO r FROM test_finalize('pay-n1', 'o-n1', 'tid-n1', 100000, 'succeeded', 100000,
                                     pg_time, srv_time);
  ASSERT r.paid_rows = 1 AND r.completed_rows = 1, '1: 최종화되지 않았다';

  SELECT * INTO p FROM payments WHERE id = 'pay-n1';
  ASSERT p.status = 'cancelled', '1: 결제가 취소로 바뀌지 않았다';
  ASSERT p.cancelled_amount = 100000, '1: 취소 금액이 전액이 아니다';
  ASSERT p.cancelled_at = pg_time, '1: PG 취소 시각이 저장되지 않았다';
  ASSERT p.cancel_execution_status = 'succeeded', '1: 실행 단계가 정리되지 않았다';
  -- 승인 기록과 취소 시도 기록은 그대로다.
  ASSERT p.raw->>'resultCode' = '0000', '1: 승인 응답이 덮였다';
  ASSERT p.approved_amount = 100000 AND p.approved_at IS NOT NULL, '1: 승인 값이 바뀌었다';
  ASSERT p.cancel_result_kind = 'succeeded' AND p.cancel_result_code = '2001',
    '1: 취소 시도 기록이 덮였다';
  ASSERT p.cancel_response_raw->>'resultCode' = '2001', '1: 취소 응답 원문이 덮였다';

  SELECT * INTO q FROM refund_requests WHERE id = 'rr-n1';
  ASSERT q.status = 'completed', '1: 환불 문의가 완료되지 않았다';
  ASSERT q.decided_at = '2026-09-17T00:00:00Z'::timestamptz, '1: 결정 시각이 바뀌었다';
  ASSERT q.handled_by = 'admin', '1: 처리자가 바뀌었다';
  -- ★ 종결 시각은 서버 시각이며 PG 취소 시각과 같은 값이 아니다.
  ASSERT q.completed_at = srv_time, '1: 종결 시각이 서버 시각으로 남지 않았다';
  ASSERT q.completed_at <> p.cancelled_at, '1: 종결 시각과 PG 취소 시각이 섞였다';

  -- 2. 두 번째 호출은 아무것도 바꾸지 않는다(idempotent).
  SELECT * INTO r FROM test_finalize('pay-n1', 'o-n1', 'tid-n1', 100000, 'succeeded', 100000,
                                     pg_time, '2030-01-01T00:00:00Z'::timestamptz);
  ASSERT r.paid_rows = 0 AND r.completed_rows = 0, '2: 두 번째 호출이 값을 바꿨다';
  SELECT * INTO p FROM payments WHERE id = 'pay-n1';
  ASSERT p.cancelled_amount = 100000, '2: 취소 금액이 또 더해졌다';
  SELECT * INTO q FROM refund_requests WHERE id = 'rr-n1';
  ASSERT q.completed_at = srv_time, '2: 종결 시각이 다시 쓰였다';

  -- 2-1. PG가 취소 시각을 주지 않아도(NULL) 종결과 종결 시각은 그대로 남는다.
  PERFORM seed('p0', 'succeeded');
  SELECT * INTO r FROM test_finalize('pay-p0', 'o-p0', 'tid-p0', 100000, 'succeeded', 100000,
                                     NULL, srv_time);
  ASSERT r.paid_rows = 1 AND r.completed_rows = 1, '2-1: PG 시각이 없어 최종화가 막혔다';
  SELECT * INTO p FROM payments WHERE id = 'pay-p0';
  ASSERT p.cancelled_at IS NULL, '2-1: PG 시각이 없는데 무언가 채워졌다';
  SELECT * INTO q FROM refund_requests WHERE id = 'rr-p0';
  ASSERT q.status = 'completed' AND q.completed_at = srv_time,
    '2-1: PG 시각이 없을 때 종결 시각이 남지 않았다';

  -- 3. 복구 경로 2종도 각자 맞는 실행 단계에서만 최종화된다.
  PERFORM seed('u1', 'unknown');
  SELECT * INTO r FROM test_finalize('pay-u1', 'o-u1', 'tid-u1', 100000, 'unknown', 100000, pg_time);
  ASSERT r.paid_rows = 1 AND r.completed_rows = 1, '3: unknown 복구 최종화 실패';

  PERFORM seed('s1', 'processing');
  SELECT * INTO r FROM test_finalize('pay-s1', 'o-s1', 'tid-s1', 100000, 'processing', 100000, pg_time);
  ASSERT r.paid_rows = 1 AND r.completed_rows = 1, '3: stale 복구 최종화 실패';

  -- 4. source와 DB 실행 단계가 다르면 최종화하지 않는다.
  PERFORM seed('m1', 'unknown');
  SELECT * INTO r FROM test_finalize('pay-m1', 'o-m1', 'tid-m1', 100000, 'succeeded', 100000, pg_time);
  ASSERT r.paid_rows = 0 AND r.completed_rows = 0, '4: 실행 단계가 달라도 통과했다';
  SELECT * INTO q FROM refund_requests WHERE id = 'rr-m1';
  ASSERT q.status = 'approved', '4: 결제가 안 바뀌었는데 문의만 완료됐다';
  ASSERT q.completed_at IS NULL, '4: 최종화 실패인데 종결 시각이 남았다';

  -- 5. 결제 식별 정보가 어긋나면 둘 다 바뀌지 않는다.
  PERFORM seed('x1');
  SELECT * INTO r FROM test_finalize('pay-없음', 'o-x1', 'tid-x1', 100000, 'succeeded', 100000, pg_time);
  ASSERT r.paid_rows = 0 AND r.completed_rows = 0, '5: 없는 결제가 최종화됐다';
  SELECT * INTO r FROM test_finalize('pay-x1', 'o-다름', 'tid-x1', 100000, 'succeeded', 100000, pg_time);
  ASSERT r.paid_rows = 0 AND r.completed_rows = 0, '5: 주문이 달라도 통과했다';
  SELECT * INTO r FROM test_finalize('pay-x1', 'o-x1', 'tid-다름', 100000, 'succeeded', 100000, pg_time);
  ASSERT r.paid_rows = 0 AND r.completed_rows = 0, '5: 거래 번호가 달라도 통과했다';
  SELECT * INTO r FROM test_finalize('pay-x1', 'o-x1', 'tid-x1', 90000, 'succeeded', 90000, pg_time);
  ASSERT r.paid_rows = 0 AND r.completed_rows = 0, '5: 승인 금액이 달라도 통과했다';
  -- ★ 환불 문의는 여전히 approved다(결제 조건 실패 시 문의도 바뀌지 않는다).
  SELECT * INTO q FROM refund_requests WHERE id = 'rr-x1';
  ASSERT q.status = 'approved', '5: 결제 조건 실패인데 문의가 완료됐다';
  ASSERT q.completed_at IS NULL, '5: 결제 조건 실패인데 종결 시각이 남았다';

  -- 6. 이미 취소 금액이 있는 결제는 최종화하지 않는다.
  PERFORM seed('c1');
  UPDATE payments SET cancelled_amount = 50000 WHERE id = 'pay-c1';
  SELECT * INTO r FROM test_finalize('pay-c1', 'o-c1', 'tid-c1', 100000, 'succeeded', 100000, pg_time);
  ASSERT r.paid_rows = 0 AND r.completed_rows = 0, '6: 부분취소 흔적이 있는데 통과했다';

  -- 7. 환불 문의가 승인 상태가 아니면 결제도 바뀌지 않는다(원자성).
  PERFORM seed('r1', 'succeeded', 'reviewing');
  SELECT * INTO r FROM test_finalize('pay-r1', 'o-r1', 'tid-r1', 100000, 'succeeded', 100000, pg_time);
  ASSERT r.paid_rows = 0 AND r.completed_rows = 0, '7: 승인 아닌 문의로 최종화됐다';
  SELECT * INTO p FROM payments WHERE id = 'pay-r1';
  ASSERT p.status = 'paid' AND p.cancelled_amount = 0 AND p.cancelled_at IS NULL,
    '7: 문의 조건 실패인데 결제가 바뀌었다(롤백되지 않았다)';

  -- 8. 환불 문의가 아예 없으면 결제도 바뀌지 않는다.
  INSERT INTO orders (id, user_id, product, title, status, amount)
  VALUES ('o-none', 'u-1', 'story', '인생곡', '신청접수', 100000);
  INSERT INTO payments (id, order_id, merchant_order_id, pg_tid, requested_amount,
                        approved_amount, status, cancel_execution_status)
  VALUES ('pay-none', 'o-none', 'is-none', 'tid-none', 100000, 100000, 'paid', 'succeeded');
  SELECT * INTO r FROM test_finalize('pay-none', 'o-none', 'tid-none', 100000, 'succeeded', 100000, pg_time);
  ASSERT r.paid_rows = 0, '8: 문의가 없는데 결제가 취소됐다';
  SELECT * INTO p FROM payments WHERE id = 'pay-none';
  ASSERT p.status = 'paid', '8: 결제가 바뀌었다';

  -- 9. 승인된 문의가 둘이면 하나를 골라 완료하지 않는다.
  PERFORM seed('d1');
  UPDATE refund_requests SET status = 'completed' WHERE id = 'rr-d1';
  INSERT INTO refund_requests (id, order_id, user_id, status, reason)
  VALUES ('rr-d2', 'o-d1', 'u-1', 'approved', 'schedule'),
         ('rr-d3', 'o-d1', 'u-1', 'approved', 'other');
  SELECT * INTO r FROM test_finalize('pay-d1', 'o-d1', 'tid-d1', 100000, 'succeeded', 100000, pg_time);
  ASSERT r.paid_rows = 0 AND r.completed_rows = 0, '9: 승인 문의가 둘인데 최종화됐다';
  SELECT count(*) INTO r FROM refund_requests WHERE order_id = 'o-d1' AND status = 'approved';
  ASSERT r.count = 2, '9: 문의 상태가 바뀌었다';

  -- 10. PG 취소 시각이 없으면 NULL로 둔다(서버 시각을 지어내지 않는다).
  PERFORM seed('t1');
  SELECT * INTO r FROM test_finalize('pay-t1', 'o-t1', 'tid-t1', 100000, 'succeeded', 100000, NULL);
  ASSERT r.paid_rows = 1, '10: 최종화되지 않았다';
  SELECT * INTO p FROM payments WHERE id = 'pay-t1';
  ASSERT p.cancelled_at IS NULL, '10: 없는 PG 시각을 채워 넣었다';
  ASSERT p.status = 'cancelled' AND p.cancelled_amount = 100000, '10: 나머지 반영이 안 됐다';

  RAISE NOTICE '전액취소 최종화 10건 통과';
END $$;

ROLLBACK;
