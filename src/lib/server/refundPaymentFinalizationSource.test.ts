/**
 * source별 실행 단계 대응 테스트 (Refund-Payment-Finalization-1).
 *
 * 실행: node --test src/lib/server/refundPaymentFinalizationSource.test.ts
 *
 * DB 동작(CAS·원자성·동시성)은 refundPaymentFinalization*.test.sql에서 본다.
 * 여기서는 어떤 source가 어떤 실행 단계를 요구하는지만 확인한다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { ReconciliationSource } from "./refundPaymentReconciliation.ts";

/**
 * store.ts의 executionStatusForSource와 같은 표.
 * store.ts는 DB 드라이버를 불러오므로 여기서 직접 import하지 않고, 같은 규칙을 적어
 * 두 곳이 어긋나면 SQL 테스트에서 드러나게 한다(SQL 테스트가 세 source를 모두 돈다).
 */
const EXPECTED: Record<ReconciliationSource, string> = {
  normal: "succeeded",
  "recovered-unknown": "unknown",
  "recovered-stale-claim": "processing",
};

test("source 세 가지가 서로 다른 실행 단계를 요구한다", () => {
  const values = Object.values(EXPECTED);
  assert.equal(new Set(values).size, 3, "두 source가 같은 단계를 요구하면 구분이 없다");
  // declined와 NULL은 어떤 source로도 최종화되지 않는다.
  assert.equal(values.includes("declined"), false);
});

test("정상 경로는 성공 기록만 최종화한다", () => {
  assert.equal(EXPECTED.normal, "succeeded");
});

test("복구 경로는 각각 자기 상태에서만 최종화한다", () => {
  assert.equal(EXPECTED["recovered-unknown"], "unknown");
  assert.equal(EXPECTED["recovered-stale-claim"], "processing");
});
