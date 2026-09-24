-- 환불 완료와 진행 상태 변경의 동시 실행 (Refund-Completed-Progress-Lock-1).
--
-- 한 연결 안에서는 경합이 생기지 않아 실제 연결 두 개로 확인한다.
--
-- 확인하는 것은 두 가지다.
--   · 환불 완료가 커밋된 뒤에 시작한 진행 상태 변경은 반드시 막힌다.
--   · 같은 주문에 진행 상태 변경이 동시에 둘 들어와도, 환불이 끝난 뒤라면 둘 다 막힌다.
--
-- 확인하지 못하는 것(구조상 남는 경합)은 파일 끝 주석에 적어 두었다.
--
-- 실행 순서(일회용 DB에서만. 경합을 보려면 두 연결이 같은 커밋된 행을 봐야 하므로
-- 이 스크립트는 롤백하지 않는다):
--   createdb lock_race_test
--   psql "<url>/lock_race_test" -v ON_ERROR_STOP=1 -f src/lib/server/orderStatusRefundLockConcurrency.test.sql
--   psql ... -c "SELECT reset_lock_race()"
--   psql ... -c "SELECT status_once('c1')" &  psql ... -c "SELECT status_once('c2')" &  wait
--   psql ... -c "SELECT verify_lock_race()"
--   dropdb lock_race_test

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
  status TEXT NOT NULL
);

/** 매 회차 같은 출발점으로 되돌린다. 환불은 이미 완료된 상태로 둔다. */
CREATE OR REPLACE FUNCTION reset_lock_race() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM refund_requests;
  DELETE FROM orders;
  DELETE FROM app_store;
  INSERT INTO app_store (id, data, version) VALUES (1, '{"v":0}'::jsonb, 0);
  INSERT INTO orders (id, user_id, status) VALUES ('o-race', 'u-1', '제작중');
  INSERT INTO refund_requests (id, order_id, user_id, status)
  VALUES ('rr-race', 'o-race', 'u-1', 'completed');
END $$;

/**
 * writeDataWithOrderStatus와 같은 문장. 성공(=진행 상태를 바꿨다)이면 true다.
 * 환불이 끝난 주문이라 막히면 false다.
 */
CREATE OR REPLACE FUNCTION status_once(tag TEXT) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
  locked BOOLEAN;
  v BIGINT;
  expected BIGINT;
BEGIN
  SELECT version INTO expected FROM app_store WHERE id = 1;
  WITH locked_cte AS (
    SELECT EXISTS (
      SELECT 1 FROM refund_requests WHERE order_id = 'o-race' AND status = 'completed'
    ) AS yes
  ),
  cas AS (
    UPDATE app_store SET data = jsonb_build_object('by', tag), version = version + 1
    WHERE id = 1 AND version = expected AND NOT (SELECT yes FROM locked_cte)
    RETURNING version
  ),
  touched AS (
    UPDATE orders SET status = '완료', updated_at = now()
    WHERE id = 'o-race' AND EXISTS (SELECT 1 FROM cas)
  )
  SELECT (SELECT yes FROM locked_cte), (SELECT version FROM cas) INTO locked, v;
  RETURN NOT locked AND v IS NOT NULL;
END $$;

/** 환불이 끝난 뒤에는 동시에 들어와도 둘 다 막혀야 한다. */
CREATE OR REPLACE FUNCTION verify_lock_race() RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  o RECORD;
  a RECORD;
BEGIN
  SELECT * INTO o FROM orders WHERE id = 'o-race';
  ASSERT o.status = '제작중', '동시 요청 중 하나가 진행 상태를 바꿨다';
  SELECT * INTO a FROM app_store WHERE id = 1;
  ASSERT a.version = 0, 'app_store가 갱신됐다(알림·사본이 저장됐다는 뜻)';
  ASSERT a.data->>'by' IS NULL, '막힌 요청의 data가 저장됐다';
  RAISE NOTICE '동시 진행 상태 변경 확인: 환불 완료 뒤 2건 모두 막힘';
END $$;

/*
 * ── 이 구조에서 남는 경합(정확히 적어 둔다) ──
 *
 * 진행 상태 변경 문장이 EXISTS를 읽는 시점보다 **뒤에** 환불 완료가 커밋되면,
 * 그 변경은 막히지 않고 통과한다. 두 작업이 서로 다른 행을 잠그기 때문이다
 * (환불 최종화는 payments와 refund_requests를, 상태 변경은 orders와 app_store를 잡는다).
 *
 * 즉 보장되는 것은 "환불 완료가 보이는 순간부터 그 뒤의 모든 변경은 막힌다"이고,
 * 보장되지 않는 것은 "환불 완료와 같은 순간에 진행 중이던 변경 1건"이다.
 * 그 1건을 막으려면 최종화가 orders 행까지 잠가야 하는데, 그것은 환불 최종화
 * 구조를 바꾸는 일이라 여기서 하지 않는다(요청 범위 밖).
 */
