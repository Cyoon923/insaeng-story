-- 별도 승인 후 테스트 DB부터 수동 적용한다. 일반 요청에서는 실행하지 않는다.
-- 기존 테이블이 없으면 실패한다. DEFAULT·백필·인덱스·데이터 삭제 없음.
BEGIN;
ALTER TABLE chat_inquiries ADD COLUMN IF NOT EXISTS retention JSONB;
ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS retention JSONB;
COMMIT;
