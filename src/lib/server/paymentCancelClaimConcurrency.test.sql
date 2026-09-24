-- 취소 실행권 동시 선점 테스트 (Refund-Payment-Cancel-Claim-1).
--
-- 같은 결제에 두 요청이 동시에 들어와도 정확히 하나만 선점해야 한다.
-- 이것은 한 연결 안에서는 확인할 수 없어(같은 트랜잭션이면 경합이 없다)
-- 실제 연결 두 개를 동시에 띄워 확인한다.
--
-- 실행 순서(일회용 DB에서만. 경합을 보려면 두 연결이 같은 커밋된 행을 봐야 하므로
-- 이 스크립트는 롤백하지 않는다):
--   createdb cancel_claim_test
--   psql "<url>/cancel_claim_test" -v ON_ERROR_STOP=1 -f src/lib/server/paymentCancelClaimConcurrency.test.sql
--   psql ... -c "SELECT reset_race()"
--   psql ... -c "SELECT claim_once('c1')" &  psql ... -c "SELECT claim_once('c2')" &  wait
--   psql ... -c "SELECT verify_race()"
--   dropdb cancel_claim_test

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  cancel_execution_status TEXT,
  cancel_claimed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 경합 결과를 각 연결이 남기는 곳.
CREATE TABLE IF NOT EXISTS claim_log (
  who TEXT PRIMARY KEY,
  claimed BOOLEAN NOT NULL
);

/** claimPaymentCancellation과 같은 조건부 UPDATE를 한 번 실행하고 결과를 남긴다. */
CREATE OR REPLACE FUNCTION claim_once(p_who TEXT, p_id TEXT DEFAULT 'pay-race')
RETURNS BOOLEAN
LANGUAGE plpgsql AS $fn$
DECLARE
  hit INTEGER;
BEGIN
  -- 두 연결이 확실히 겹치도록 잠깐 기다렸다가 같은 순간에 친다.
  PERFORM pg_sleep(0.3);
  WITH claimed AS (
    UPDATE payments
    SET cancel_execution_status = 'processing',
        cancel_claimed_at = now(),
        updated_at = now()
    WHERE id = p_id
      AND status = 'paid'
      AND cancel_execution_status IS NULL
    RETURNING id
  )
  SELECT count(*) INTO hit FROM claimed;
  INSERT INTO claim_log (who, claimed) VALUES (p_who, hit = 1)
  ON CONFLICT (who) DO UPDATE SET claimed = EXCLUDED.claimed;
  RETURN hit = 1;
END $fn$;

/** 준비: 승인된 결제 1건을 아직 선점되지 않은 상태로 둔다. */
CREATE OR REPLACE FUNCTION reset_race()
RETURNS VOID
LANGUAGE sql AS $fn$
  DELETE FROM claim_log;
  DELETE FROM payments WHERE id = 'pay-race';
  INSERT INTO payments (id, status) VALUES ('pay-race', 'paid');
$fn$;

/** 확인: 두 연결 중 정확히 하나만 선점했어야 한다. */
CREATE OR REPLACE FUNCTION verify_race()
RETURNS VOID
LANGUAGE plpgsql AS $fn$
DECLARE
  winners INTEGER;
  attempts INTEGER;
  row_status TEXT;
BEGIN
  SELECT count(*) INTO attempts FROM claim_log;
  SELECT count(*) INTO winners FROM claim_log WHERE claimed;
  ASSERT attempts = 2, '동시 시도가 2건이 아니다';
  ASSERT winners = 1, '동시 선점에서 성공이 1건이 아니다';
  SELECT cancel_execution_status INTO row_status FROM payments WHERE id = 'pay-race';
  ASSERT row_status = 'processing', '선점 결과가 남지 않았다';
  RAISE NOTICE '동시 선점 확인: 시도 2건 중 정확히 1건만 성공';
END $fn$;
