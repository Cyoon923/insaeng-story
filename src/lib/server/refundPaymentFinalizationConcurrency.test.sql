-- 최종화 동시 실행 테스트 (Refund-Payment-Finalization-1).
--
-- 같은 verified 결과로 두 요청이 동시에 최종화를 시도해도
-- 결제 취소와 문의 완료가 각각 한 번만 일어나야 한다.
-- 한 연결 안에서는 경합이 생기지 않아 실제 연결 두 개로 확인한다.
--
-- 실행 순서(일회용 DB에서만. 경합을 보려면 두 연결이 같은 커밋된 행을 봐야 하므로
-- 이 스크립트는 롤백하지 않는다):
--   createdb finalize_race_test
--   psql "<url>/finalize_race_test" -v ON_ERROR_STOP=1 -f src/lib/server/refundPaymentFinalizationConcurrency.test.sql
--   psql ... -c "SELECT reset_finalize_race()"
--   psql ... -c "SELECT finalize_once('c1')" &  psql ... -c "SELECT finalize_once('c2')" &  wait
--   psql ... -c "SELECT verify_finalize_race()"
--   dropdb finalize_race_test

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id),
  pg_tid TEXT,
  approved_amount INTEGER,
  cancelled_amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  cancelled_at TIMESTAMPTZ,
  cancel_execution_status TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refund_requests (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  decided_at TIMESTAMPTZ,
  handled_by TEXT,
  -- 종결한 서버 시각. 승인 시각(decided_at)·PG 취소 시각과 다른 칸이다.
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS finalize_log (
  who TEXT PRIMARY KEY,
  paid_rows BIGINT NOT NULL,
  completed_rows BIGINT NOT NULL
);

/** finalizeRefundPaymentCancel이 보내는 것과 같은 한 문장을 실행하고 결과를 남긴다. */
CREATE OR REPLACE FUNCTION finalize_once(p_who TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql AS $fn$
DECLARE
  paid BIGINT;
  done BIGINT;
BEGIN
  -- 두 연결이 확실히 겹치도록 잠깐 기다렸다가 같은 순간에 친다.
  PERFORM pg_sleep(0.3);
  WITH target_refund AS (
    SELECT id FROM refund_requests
    WHERE order_id = 'o-race' AND status = 'approved'
    FOR UPDATE
  ),
  active_refunds AS (
    SELECT count(*) AS total FROM refund_requests
    WHERE order_id = 'o-race' AND status IN ('requested', 'reviewing', 'approved')
  ),
  paid_cte AS (
    UPDATE payments
    SET status = 'cancelled',
        cancelled_amount = 100000,
        cancelled_at = '2026-09-17T09:00:00+09:00'::timestamptz,
        cancel_execution_status = 'succeeded',
        updated_at = now()
    WHERE id = 'pay-race'
      AND order_id = 'o-race'
      AND pg_tid = 'tid-race'
      AND status = 'paid'
      AND approved_amount = 100000
      AND cancelled_amount = 0
      AND cancel_execution_status = 'succeeded'
      AND (SELECT total FROM active_refunds) = 1
      AND EXISTS (SELECT 1 FROM target_refund)
    RETURNING id
  ),
  completed_cte AS (
    UPDATE refund_requests
    SET status = 'completed',
        -- 실행한 연결이 만든 서버 시각. 이미 있으면 덮어쓰지 않는다.
        completed_at = COALESCE(completed_at, now())
    WHERE id = (SELECT id FROM target_refund)
      AND status = 'approved'
      AND EXISTS (SELECT 1 FROM paid_cte)
    RETURNING id
  )
  SELECT (SELECT count(*) FROM paid_cte), (SELECT count(*) FROM completed_cte)
  INTO paid, done;

  INSERT INTO finalize_log (who, paid_rows, completed_rows) VALUES (p_who, paid, done)
  ON CONFLICT (who) DO UPDATE SET paid_rows = EXCLUDED.paid_rows,
                                  completed_rows = EXCLUDED.completed_rows;
  RETURN paid = 1;
END $fn$;

/** 준비: 최종화 직전 상태를 만든다. */
CREATE OR REPLACE FUNCTION reset_finalize_race()
RETURNS VOID
LANGUAGE sql AS $fn$
  DELETE FROM finalize_log;
  DELETE FROM refund_requests WHERE order_id = 'o-race';
  DELETE FROM payments WHERE id = 'pay-race';
  DELETE FROM orders WHERE id = 'o-race';
  INSERT INTO orders (id, user_id) VALUES ('o-race', 'u-1');
  INSERT INTO payments (id, order_id, pg_tid, approved_amount, status, cancel_execution_status)
  VALUES ('pay-race', 'o-race', 'tid-race', 100000, 'paid', 'succeeded');
  INSERT INTO refund_requests (id, order_id, user_id, status, decided_at, handled_by)
  VALUES ('rr-race', 'o-race', 'u-1', 'approved', now(), 'admin');
$fn$;

/** 확인: 최종화는 정확히 한 번만 일어나야 한다. */
CREATE OR REPLACE FUNCTION verify_finalize_race()
RETURNS VOID
LANGUAGE plpgsql AS $fn$
DECLARE
  attempts INTEGER;
  winners INTEGER;
  p RECORD;
  q RECORD;
BEGIN
  SELECT count(*) INTO attempts FROM finalize_log;
  SELECT count(*) INTO winners FROM finalize_log WHERE paid_rows = 1;
  ASSERT attempts = 2, '동시 시도가 2건이 아니다';
  ASSERT winners = 1, '동시 최종화에서 성공이 1건이 아니다';
  -- 진 쪽은 결제도 문의도 건드리지 못했어야 한다.
  ASSERT (SELECT count(*) FROM finalize_log WHERE completed_rows = 1) = 1,
    '문의 완료가 1건이 아니다';

  SELECT * INTO p FROM payments WHERE id = 'pay-race';
  ASSERT p.status = 'cancelled', '결제가 취소되지 않았다';
  ASSERT p.cancelled_amount = 100000, '취소 금액이 전액이 아니다(중복 반영 의심)';

  SELECT * INTO q FROM refund_requests WHERE id = 'rr-race';
  ASSERT q.status = 'completed', '문의가 완료되지 않았다';
  ASSERT q.handled_by = 'admin' AND q.decided_at IS NOT NULL, '처리 기록이 사라졌다';

  RAISE NOTICE '동시 최종화 확인: 시도 2건 중 정확히 1건만 반영';
END $fn$;
