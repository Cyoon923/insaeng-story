-- 보관 만료 정리 원자성 테스트 (Privacy-Retention-Execution-1).
--
-- store.ts scrubOrderForRetentionOnce가 보내는 것과 같은 한 문장을 실제 PostgreSQL에
-- 실행해, app_store JSONB·orders·payments가 **함께 성립하거나 함께 없는지** 본다.
--
-- JavaScript로는 볼 수 없다. 보장이 코드의 순서가 아니라 한 문장 안의 데이터 의존
-- 관계에서 나오기 때문이다. 문장이 다는 조건 자체는
-- retentionScrubSource.test.ts가 따로 본다.
--
-- 실행:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f src/lib/server/retentionScrub.test.sql
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
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  delivered_at TIMESTAMPTZ,
  retention_scrubbed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id),
  order_snapshot JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 대상 주문 1건과, 건드리면 안 되는 이웃 주문 1건.
INSERT INTO orders (id, details, delivered_at) VALUES
  ('o-1',
   '{"name":"홍길동","phone":"010-1234-5678","memory":"사연","nickname":"별명",
     "protagonistId":"parents","pointsUsed":"10000"}'::jsonb,
   '2025-09-01T00:00:00Z'),
  ('o-2',
   '{"name":"김철수","protagonistId":"self"}'::jsonb,
   '2025-09-01T00:00:00Z');

-- 결제 여러 건. 연결된 것(상담·인생곡), request 모양이 제각각인 것,
-- 연결되지 않은 것, 다른 주문의 것.
INSERT INTO payments (id, order_id, order_snapshot) VALUES
  -- 상담 결제. request.purpose가 이번에 함께 빠져야 하는 값이다.
  ('p-linked',     'o-1',
   '{"version":1,"kind":"consultation","userId":"u-1","goodsName":"1:1 사주상담","amount":150000,
     "request":{"title":"1:1 사주상담","teacher":"유비 선생","datetime":"8월 12일(화) 오전 10:00",
                "purpose":"재물·금전","method":"카카오톡 상담","option":"없음"},
     "discount":{"usePoints":10000},"preparedAt":"2025-08-01T00:00:00Z",
     "details":{"name":"홍길동"}}'::jsonb),
  -- 상담이 아닌 결제. purpose가 없어도 안전해야 한다.
  ('p-nopurpose',  'o-1',
   '{"userId":"u-1","request":{"product":"story","title":"인생곡"},
     "discount":{"usePoints":0},"details":{"name":"홍길동"}}'::jsonb),
  -- request 자체가 없는 예전 결제.
  ('p-norequest',  'o-1',
   '{"userId":"u-1","discount":{"usePoints":0},"details":{"name":"홍길동"}}'::jsonb),
  -- request가 객체가 아닌 망가진 값. 여기서 멈추면 안 된다.
  ('p-badrequest', 'o-1',
   '{"userId":"u-1","request":"story","discount":{"usePoints":0},"details":{"name":"홍길동"}}'::jsonb),
  -- ★ 연결되지 않은 결제. details도 purpose도 그대로 남아야 한다(recommit 입력).
  ('p-unlinked',   NULL,
   '{"userId":"u-1","request":{"product":"story","purpose":"연애·인연"},
     "discount":{"usePoints":0},"details":{"name":"홍길동"}}'::jsonb),
  -- 다른 주문의 결제.
  ('p-other',      'o-2',
   '{"userId":"u-1","request":{"product":"story"},"discount":{"usePoints":0},
     "details":{"name":"김철수"}}'::jsonb),
  -- details는 없고 purpose만 있는 결제. WHERE가 이 행도 골라야 한다.
  ('p-purposeonly','o-2',
   '{"userId":"u-1","request":{"product":"story","purpose":"가족"},
     "discount":{"usePoints":0}}'::jsonb);

INSERT INTO app_store (id, data, version)
VALUES (1, '{"orders":[{"id":"o-1","details":{"name":"홍길동"}}]}'::jsonb, 3);

/**
 * scrubOrderForRetentionOnce가 보내는 것과 같은 문장.
 *
 * p_data는 호출부가 details를 정리한 뒤 직렬화한 JSONB다.
 * p_kept는 RETENTION_KEPT_DETAIL_KEYS를 그대로 넘긴 배열이다(SQL에 목록을 적지 않는다).
 */
PREPARE scrub(jsonb, bigint, text, text[], timestamptz) AS
WITH cas AS (
  UPDATE app_store SET data = $1, version = version + 1
  WHERE id = 1 AND version = $2
  RETURNING version
),
scrubbed_order AS (
  UPDATE orders
  SET details = COALESCE(
        (
          SELECT jsonb_object_agg(kept.key, kept.value)
          FROM jsonb_each(orders.details) AS kept
          WHERE kept.key = ANY($4)
        ),
        '{}'::jsonb
      ),
      retention_scrubbed_at = COALESCE(retention_scrubbed_at, $5),
      updated_at = now()
  WHERE id = $3 AND EXISTS (SELECT 1 FROM cas)
),
scrubbed_payment AS (
  UPDATE payments
  SET order_snapshot = CASE
        WHEN jsonb_typeof(order_snapshot -> 'request') = 'object'
          THEN jsonb_set(
                 order_snapshot - 'details',
                 '{request}',
                 (order_snapshot -> 'request') - 'purpose'
               )
        ELSE order_snapshot - 'details'
      END,
      updated_at = now()
  WHERE order_id = $3
    AND (
      order_snapshot ? 'details'
      OR (
        jsonb_typeof(order_snapshot -> 'request') = 'object'
        AND (order_snapshot -> 'request') ? 'purpose'
      )
    )
    AND EXISTS (SELECT 1 FROM cas)
)
SELECT version FROM cas;

-- ── 1) version이 어긋나면 어느 저장소도 바뀌지 않는다 ──
EXECUTE scrub(
  '{"orders":[{"id":"o-1","details":{}}]}'::jsonb,
  999,                       -- 틀린 version
  'o-1',
  ARRAY['protagonistId','pointsUsed'],
  '2026-09-01T00:00:00Z'
);

DO $$
BEGIN
  ASSERT (SELECT version FROM app_store WHERE id = 1) = 3,
    'CAS 실패인데 app_store가 바뀌었다';
  ASSERT (SELECT details->>'name' FROM orders WHERE id = 'o-1') = '홍길동',
    'CAS 실패인데 orders가 바뀌었다';
  ASSERT (SELECT retention_scrubbed_at FROM orders WHERE id = 'o-1') IS NULL,
    'CAS 실패인데 완료 증빙이 기록되었다';
  ASSERT (SELECT order_snapshot ? 'details' FROM payments WHERE id = 'p-linked'),
    'CAS 실패인데 결제 스냅샷이 바뀌었다';
  ASSERT (SELECT (order_snapshot -> 'request') ? 'purpose' FROM payments WHERE id = 'p-linked'),
    'CAS 실패인데 상담 목적 사본이 지워졌다';
END $$;

-- ── 2) version이 맞으면 네 가지가 함께 성립한다 ──
EXECUTE scrub(
  '{"orders":[{"id":"o-1","details":{"protagonistId":"parents","pointsUsed":"10000"}}]}'::jsonb,
  3,
  'o-1',
  ARRAY['protagonistId','pointsUsed'],
  '2026-09-01T00:00:00Z'
);

DO $$
BEGIN
  ASSERT (SELECT version FROM app_store WHERE id = 1) = 4,
    'app_store가 저장되지 않았다';

  -- allowlist에 없는 키는 전부 빠진다. 모르는 키(nickname)도 함께 빠진다.
  ASSERT (SELECT details FROM orders WHERE id = 'o-1')
         = '{"protagonistId":"parents","pointsUsed":"10000"}'::jsonb,
    'orders.details가 allowlist 결과와 다르다';

  -- 기산점은 그대로 남는다. 다시 판정할 수 있어야 한다.
  ASSERT (SELECT delivered_at FROM orders WHERE id = 'o-1')
         = '2025-09-01T00:00:00Z'::timestamptz,
    '완료 증빙(delivered_at)이 지워졌다';

  ASSERT (SELECT retention_scrubbed_at FROM orders WHERE id = 'o-1')
         = '2026-09-01T00:00:00Z'::timestamptz,
    '완료 증빙이 기록되지 않았다';

  -- 연결된 결제에서는 details와 request.purpose 둘이 빠진다.
  ASSERT NOT (SELECT order_snapshot ? 'details' FROM payments WHERE id = 'p-linked'),
    '연결된 결제의 details가 남아 있다';
  ASSERT NOT (SELECT (order_snapshot -> 'request') ? 'purpose' FROM payments WHERE id = 'p-linked'),
    '연결된 결제의 상담 목적 사본이 남아 있다';

  -- request는 통째로 지우지 않는다. 나머지 키는 그대로 남는다.
  ASSERT (SELECT order_snapshot ? 'request' FROM payments WHERE id = 'p-linked'),
    '재검증 근거(request)가 함께 지워졌다';
  ASSERT (SELECT order_snapshot -> 'request' FROM payments WHERE id = 'p-linked')
         = '{"title":"1:1 사주상담","teacher":"유비 선생","datetime":"8월 12일(화) 오전 10:00","method":"카카오톡 상담","option":"없음"}'::jsonb,
    'request에서 purpose 말고 다른 키가 바뀌었다';

  -- 이번 단계에서 손대지 않기로 한 값들.
  ASSERT (SELECT order_snapshot -> 'discount' FROM payments WHERE id = 'p-linked')
         = '{"usePoints":10000}'::jsonb,
    '할인 근거(discount)가 바뀌었다';
  ASSERT (SELECT order_snapshot->>'userId' FROM payments WHERE id = 'p-linked') = 'u-1',
    '귀속(userId)이 함께 지워졌다';
  ASSERT (SELECT order_snapshot->>'kind' FROM payments WHERE id = 'p-linked') = 'consultation',
    'kind가 함께 지워졌다';
  ASSERT (SELECT order_snapshot->>'goodsName' FROM payments WHERE id = 'p-linked') = '1:1 사주상담',
    'goodsName이 함께 지워졌다';
  ASSERT (SELECT order_snapshot->>'amount' FROM payments WHERE id = 'p-linked') = '150000',
    'amount가 함께 지워졌다';
  ASSERT (SELECT order_snapshot->>'version' FROM payments WHERE id = 'p-linked') = '1',
    'version이 함께 지워졌다';
  ASSERT (SELECT order_snapshot->>'preparedAt' FROM payments WHERE id = 'p-linked')
         = '2025-08-01T00:00:00Z',
    'preparedAt이 함께 지워졌다';

  -- purpose가 없는 결제도 안전하다. details만 빠지고 request는 그대로다.
  ASSERT NOT (SELECT order_snapshot ? 'details' FROM payments WHERE id = 'p-nopurpose'),
    'purpose 없는 결제의 details가 남아 있다';
  ASSERT (SELECT order_snapshot -> 'request' FROM payments WHERE id = 'p-nopurpose')
         = '{"product":"story","title":"인생곡"}'::jsonb,
    'purpose 없는 결제의 request가 바뀌었다';

  -- request가 아예 없는 결제도 안전하다. request 키를 만들지 않는다.
  ASSERT NOT (SELECT order_snapshot ? 'details' FROM payments WHERE id = 'p-norequest'),
    'request 없는 결제의 details가 남아 있다';
  ASSERT NOT (SELECT order_snapshot ? 'request' FROM payments WHERE id = 'p-norequest'),
    'request 없는 결제에 request 키가 생겼다';

  -- request가 객체가 아니어도 멈추지 않는다. details만 빠지고 값은 그대로다.
  ASSERT NOT (SELECT order_snapshot ? 'details' FROM payments WHERE id = 'p-badrequest'),
    'request가 객체가 아닌 결제의 details가 남아 있다';
  ASSERT (SELECT order_snapshot->>'request' FROM payments WHERE id = 'p-badrequest') = 'story',
    'request가 객체가 아닌 값이 바뀌었다';

  -- ★ order_id가 NULL인 결제는 절대 건드리지 않는다(recommit 복구 입력).
  ASSERT (SELECT order_snapshot ? 'details' FROM payments WHERE id = 'p-unlinked'),
    '연결되지 않은 결제의 복구 입력이 지워졌다';
  ASSERT (SELECT (order_snapshot -> 'request') ? 'purpose' FROM payments WHERE id = 'p-unlinked'),
    '연결되지 않은 결제의 상담 목적 사본이 지워졌다';

  -- 다른 주문의 결제도 그대로다.
  ASSERT (SELECT order_snapshot ? 'details' FROM payments WHERE id = 'p-other'),
    '다른 주문의 결제가 바뀌었다';

  -- 이웃 주문도 그대로다.
  ASSERT (SELECT details->>'name' FROM orders WHERE id = 'o-2') = '김철수',
    '대상이 아닌 주문이 바뀌었다';
  ASSERT (SELECT retention_scrubbed_at FROM orders WHERE id = 'o-2') IS NULL,
    '대상이 아닌 주문에 완료 증빙이 기록되었다';
END $$;

-- ── 3) 두 번 실행해도 안전하고, 최초 시각이 유지된다 ──
EXECUTE scrub(
  '{"orders":[{"id":"o-1","details":{"protagonistId":"parents","pointsUsed":"10000"}}]}'::jsonb,
  4,
  'o-1',
  ARRAY['protagonistId','pointsUsed'],
  '2027-01-01T00:00:00Z'      -- 나중 시각으로 다시 실행
);

DO $$
BEGIN
  ASSERT (SELECT retention_scrubbed_at FROM orders WHERE id = 'o-1')
         = '2026-09-01T00:00:00Z'::timestamptz,
    'COALESCE가 최초 시각을 지키지 못했다';
  ASSERT (SELECT details FROM orders WHERE id = 'o-1')
         = '{"protagonistId":"parents","pointsUsed":"10000"}'::jsonb,
    '다시 실행한 결과가 처음과 다르다';
  ASSERT (SELECT order_snapshot ? 'details' FROM payments WHERE id = 'p-unlinked'),
    '다시 실행하면서 복구 입력이 지워졌다';
  ASSERT (SELECT (order_snapshot -> 'request') ? 'purpose' FROM payments WHERE id = 'p-unlinked'),
    '다시 실행하면서 연결되지 않은 결제의 목적 사본이 지워졌다';
  ASSERT NOT (SELECT (order_snapshot -> 'request') ? 'purpose' FROM payments WHERE id = 'p-linked'),
    '다시 실행한 결과가 처음과 다르다(목적 사본)';
END $$;

-- ── 4) 남길 것이 하나도 없으면 빈 객체가 된다 ──
EXECUTE scrub(
  '{"orders":[{"id":"o-2","details":{}}]}'::jsonb,
  5,
  'o-2',
  ARRAY['protagonistId','pointsUsed'],
  '2026-09-01T00:00:00Z'
);

DO $$
BEGIN
  ASSERT (SELECT details FROM orders WHERE id = 'o-2') = '{"protagonistId":"self"}'::jsonb,
    'o-2의 allowlist 결과가 다르다';
  ASSERT NOT (SELECT order_snapshot ? 'details' FROM payments WHERE id = 'p-other'),
    'o-2에 연결된 결제가 정리되지 않았다';
  -- details가 없고 purpose만 있는 행도 WHERE에 걸려 정리된다.
  ASSERT NOT (SELECT (order_snapshot -> 'request') ? 'purpose' FROM payments WHERE id = 'p-purposeonly'),
    'details 없이 purpose만 있는 결제가 정리되지 않았다';
  ASSERT (SELECT order_snapshot -> 'request' FROM payments WHERE id = 'p-purposeonly')
         = '{"product":"story"}'::jsonb,
    'purpose만 빼야 하는데 request가 달라졌다';
  ASSERT (SELECT order_snapshot ? 'details' FROM payments WHERE id = 'p-unlinked'),
    '연결되지 않은 결제가 지워졌다';
END $$;

DEALLOCATE scrub;
ROLLBACK;
