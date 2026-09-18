/**
 * 정리 사전 확인 규칙 테스트 (Privacy-Cleanup-Preflight-3).
 *
 * 실행: node --test src/lib/server/cleanupPreflightAdminApi.test.ts
 *
 * 저장소를 부르지 않는다. 부를 수단 자체가 deps에 없다는 것도 함께 본다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  runCleanupPreflight,
  toCleanupPreflightResponse,
} from "./cleanupPreflightAdminApi.ts";
import type { CleanupPreflightDeps } from "./cleanupPreflightAdminApi.ts";

const NOW = "2026-09-18T00:00:00.000Z";

function harness(databaseMode: boolean) {
  const calls: string[] = [];
  const deps: CleanupPreflightDeps = {
    databaseMode: () => {
      calls.push("databaseMode");
      return databaseMode;
    },
  };
  return { deps, calls };
}

/* ── 기준 시각 ──────────────────────────────────────── */

test("받은 기준 시각을 그대로 적는다", () => {
  const { deps } = harness(true);
  assert.equal(runCleanupPreflight(deps, NOW).checkedAt, NOW);
});

/* ── DB 모드 ────────────────────────────────────────── */

test("DB 모드이면 cleanupReady가 참이다", () => {
  const { deps } = harness(true);
  const result = runCleanupPreflight(deps, NOW);
  assert.equal(result.databaseMode, true);
  assert.equal(result.cleanupReady, true);
});

test("DB 모드가 아니면 cleanupReady가 거짓이다", () => {
  const { deps } = harness(false);
  const result = runCleanupPreflight(deps, NOW);
  assert.equal(result.databaseMode, false);
  assert.equal(result.cleanupReady, false);
});

/* ── 바깥 세계 ──────────────────────────────────────── */

test("부르는 바깥 기능은 DB 모드 확인 하나뿐이다", () => {
  const { deps, calls } = harness(true);
  runCleanupPreflight(deps, NOW);
  assert.deepEqual(calls, ["databaseMode"]);
});

test("deps에 저장소를 읽거나 쓸 수단이 없다", () => {
  const { deps } = harness(true);
  assert.deepEqual(Object.keys(deps), ["databaseMode"]);
});

/* ── 응답 ───────────────────────────────────────────── */

test("응답에 담기는 열쇠말이 셋뿐이다", () => {
  const { deps } = harness(true);
  const result = runCleanupPreflight(deps, NOW);
  assert.deepEqual(Object.keys(result).sort(), [
    "checkedAt",
    "cleanupReady",
    "databaseMode",
  ]);
  // 없어진 것이 다시 들어오지 않았는지도 본다.
  assert.equal("retention" in result, false);
  assert.equal("candidateCount" in result, false);
});

test("DATABASE_URL 값이 응답에 담기지 않는다", () => {
  const secret = "postgres://user:password@host/db";
  const original = process.env.DATABASE_URL;
  process.env.DATABASE_URL = secret;
  try {
    const { deps } = harness(true);
    const serialized = JSON.stringify(runCleanupPreflight(deps, NOW));
    assert.equal(serialized.includes(secret), false);
    assert.equal(/postgres:|password|@host/.test(serialized), false);
  } finally {
    if (original === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original;
  }
});

test("확인이 끝났으면 준비되지 않았어도 200이다", () => {
  const { deps } = harness(false);
  const response = toCleanupPreflightResponse(runCleanupPreflight(deps, NOW));
  assert.equal(response.status, 200);
  assert.equal(response.body.cleanupReady, false);
});
