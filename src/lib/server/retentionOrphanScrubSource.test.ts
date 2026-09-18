/**
 * 짝 없는 상담 정리 경로의 저장 범위 테스트 (Privacy-Retention-Orphan-1).
 *
 * 실행: node --test src/lib/server/retentionOrphanScrubSource.test.ts
 *
 * retentionStore.ts의 scrubOrphanConsultationForRetentionOnce가 **무엇을 저장하지 않는지**를 본다.
 * 여기서 retentionStore.ts를 import하지 않는다. 그쪽은 DB 드라이버를 불러오기 때문이다.
 * 대신 원문을 글자로 읽는다. 금지한 저장이 생기면 이 테스트가 먼저 깨진다.
 *
 * 판정 규칙 자체는 retentionOrphanScrubPlan.test.ts에서 본다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const SOURCE = readFileSync(new URL("./retentionStore.ts", import.meta.url), "utf8");

/** 이 기능의 본문만 잘라 본다. 다른 store 함수의 문장과 섞이지 않게 한다. */
const FUNCTION_SOURCE = (() => {
  const start = SOURCE.indexOf("export async function scrubOrphanConsultationForRetentionOnce");
  assert.notEqual(start, -1, "scrubOrphanConsultationForRetentionOnce가 retentionStore.ts에 없다");
  // 다음 export 또는 다음 구역 구분선 중 먼저 오는 자리에서 끊는다.
  const bounds = ["\nexport ", "\n/* ---"]
    .map((mark) => SOURCE.indexOf(mark, start + 1))
    .filter((at) => at !== -1);
  const end = bounds.length ? Math.min(...bounds) : SOURCE.length;
  return SOURCE.slice(start, end);
})();

/** 주석을 걷어낸 실행 코드. 설명에 적힌 낱말이 검사에 걸리지 않게 한다. */
const CODE = FUNCTION_SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("결제를 조회하지도 수정하지도 않는다", () => {
  /*
   * 주문이 없다는 사실은 "결제도 없다"는 뜻이 아니다. order_id가 NULL인 결제의
   * order_snapshot.details는 recommit이 주문을 되살리는 유일한 입력이다.
   */
  assert.equal(/payments/i.test(CODE), false, "payments를 건드리는 문장이 있다");
  assert.equal(/order_snapshot/.test(CODE), false);
  assert.equal(/merchant_order_id|merchantOrderId/.test(CODE), false);
});

test("주문 테이블에 쓰지 않는다", () => {
  // orders는 존재 확인만 한다. UPDATE/INSERT/DELETE가 있으면 안 된다.
  assert.equal(/UPDATE orders/i.test(CODE), false);
  assert.equal(/INSERT INTO orders/i.test(CODE), false);
  assert.equal(/DELETE FROM/i.test(CODE), false);
});

test("주문 조회는 같은 id 한 건의 존재 확인뿐이다", () => {
  assert.match(CODE, /SELECT 1 AS found FROM orders WHERE id = \$1 LIMIT 1/);
  // userId나 접두사로 넓혀 찾지 않는다.
  assert.equal(/user_id/.test(CODE), false);
  assert.equal(/LIKE/i.test(CODE), false);
});

test("주문 조회에 실패하면 진행하지 않는다", () => {
  // 모르면 "짝이 있다"로 본다(fail-closed). 확인하지 못한 채 지우지 않는다.
  assert.match(CODE, /catch\s*\{\s*pairedOrderInSql = true;\s*\}/);
});

test("저장은 app_store 전체 blob CAS 하나뿐이다", () => {
  // writeData가 casHead/commitVersion을 거쳐 충돌 시 AppStoreConflictError를 던진다.
  assert.match(CODE, /await writeData\(data\)/);
  const writes = CODE.match(/await write[A-Za-z]*\(/g) ?? [];
  assert.deepEqual(writes, ["await writeData("], "저장 지점이 하나가 아니다");
  // 직접 SQL을 보내는 저장 문장이 없다.
  assert.equal(/casHead|sql\.transaction/.test(CODE), false);
});

test("저장에 실패하면 상담을 되돌리고 오류를 그대로 올린다", () => {
  // 충돌이면 scrub도 완료 증빙도 남지 않아야 한다.
  assert.match(CODE, /data\.consultations\[index\] = consultation;/);
  assert.match(CODE, /throw error;/);
});

test("완료 증빙은 최초값을 덮어쓰지 않는다", () => {
  assert.match(CODE, /alreadyScrubbed\s*\?\s*consultation\.retentionScrubbedAt\s*:\s*scrubbedAt/);
});

test("완료 증빙과 기산점을 지우지 않는다", () => {
  // completedAt은 판정 근거라 남아야 한다. 이 함수가 건드리는 흔적이 없어야 한다.
  assert.equal(/completedAt\s*=/.test(CODE), false);
  assert.equal(/delete .*completedAt/.test(CODE), false);
});

test("판정을 거치지 않고 저장으로 갈 수 없다", () => {
  const planAt = CODE.indexOf("planOrphanConsultationScrub(data, id, now");
  const guardAt = CODE.indexOf("if (!planned.ok) return");
  const writeAt = CODE.indexOf("await writeData(data)");
  assert.notEqual(planAt, -1);
  assert.equal(planAt < guardAt && guardAt < writeAt, true);
});

test("정리 규칙을 이 경로가 따로 만들지 않는다", () => {
  // details allowlist와 purpose 제거는 순수 함수(scrubConsultationForRetention)가 정한다.
  assert.equal(/RETENTION_KEPT_DETAIL_KEYS/.test(CODE), false);
  assert.equal(/delete .*purpose/.test(CODE), false);
  assert.match(CODE, /nextConsultation/);
});

test("정상 경로의 primitive와 섞이지 않는다", () => {
  // 주문이 있는 상담은 scrubOrderForRetentionOnce가 다룬다. 여기서 부르지 않는다.
  assert.equal(/scrubOrderForRetentionOnce/.test(CODE), false);
  assert.equal(/planRetentionScrub\(/.test(CODE), false);
});
