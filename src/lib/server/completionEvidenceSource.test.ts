/**
 * 완료 증빙 기록 경계 테스트 (Privacy-Retention-Completion-Evidence-1 / Store-Split-1).
 *
 * 실행: node --test src/lib/server/completionEvidenceSource.test.ts
 *
 * 규칙 자체(어느 상태에서 남기는가, 이미 있으면 두는가)는 serviceCompletion.test.ts가 본다.
 * 여기서는 관리자 상태 변경 경로가 **어디에 남기고 무엇을 하지 않는지**만 본다.
 *
 * route를 import하지 않는다. 그쪽은 DB 드라이버를 불러오기 때문이다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { applyConsultationCompletion, deliveredAtForStatus } from "./serviceCompletion.ts";
import type { Consultation } from "@/lib/types/app";

const ROUTE = readFileSync(
  new URL("../../app/api/admin/route.ts", import.meta.url),
  "utf8",
);
const CODE = ROUTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const NOW = "2026-09-18T00:00:00.000Z";
const LATER = "2027-01-01T00:00:00.000Z";

/* ── 최초 1회만 남긴다 ─────────────────────────────── */

test("주문은 전달 상태에서만 시각이 나온다", () => {
  assert.equal(deliveredAtForStatus("완성/전달", NOW), NOW);
  for (const status of ["신청접수", "상담진행", "제작중", "완료"] as const) {
    assert.equal(deliveredAtForStatus(status, NOW), null, status);
  }
});

test("상담은 완료 상태에서만 한 번 남고 덮어쓰지 않는다", () => {
  const item = { id: "c-1" } as Consultation;

  assert.equal(applyConsultationCompletion(item, "선생님과 1:1 상담", NOW), false);
  assert.equal(item.completedAt, undefined);

  assert.equal(applyConsultationCompletion(item, "상담 완료", NOW), true);
  assert.equal(item.completedAt, NOW);

  // 되돌아갔다가 다시 완료가 되어도 처음 시각이 남는다.
  assert.equal(applyConsultationCompletion(item, "사주정보 입력", LATER), false);
  assert.equal(applyConsultationCompletion(item, "상담 완료", LATER), false);
  assert.equal(item.completedAt, NOW);
});

/* ── 관리자 경로가 어디에 남기는가 ─────────────────── */

test("주문 전달 시각을 app_store 미러에 한 번만 남긴다", () => {
  assert.match(CODE, /const deliveredAt = deliveredAtForStatus\(status, new Date\(\)\.toISOString\(\)\);/);
  // 이미 값이 있으면 건드리지 않는다.
  assert.match(CODE, /if \(deliveredAt && !mirrored\.deliveredAt\) mirrored\.deliveredAt = deliveredAt;/);
});

test("상담 완료 시각은 순수 규칙에 맡긴다", () => {
  assert.match(CODE, /applyConsultationCompletion\(item, status, new Date\(\)\.toISOString\(\)\);/);
});

test("규칙을 관리자 경로에서 다시 만들지 않는다", () => {
  // 상태 문자열을 직접 비교해 시각을 넣으면 규칙이 두 벌이 된다.
  assert.equal(/status === "완성\/전달"\s*\?\s*new Date/.test(CODE), false);
  assert.equal(/completedAt =\s*new Date/.test(CODE), false);
});

/* ── SQL 열을 만들지도 쓰지도 않는다 ────────────────── */

test("완료 증빙을 orders 테이블에 쓰지 않는다", () => {
  // 열을 만들면 일반 주문 조회 경로가 그 열을 읽게 되고, 관리자가 정리를 부르기도
  // 전에 스키마 변경이 일반 요청에서 일어난다.
  assert.equal(/delivered_at|completed_at/.test(CODE), false);
});

test("상태 변경 경로가 보관 만료 스키마를 건드리지 않는다", () => {
  for (const forbidden of [
    "ensureRetentionSchema",
    "ensureRetentionOrdersColumn",
    "retention_scrubbed_at",
    "retentionStore",
    "ADD COLUMN",
    "ALTER TABLE",
  ]) {
    assert.equal(CODE.includes(forbidden), false, forbidden);
  }
});

test("관리자 경로가 정리를 실행하지 않는다", () => {
  for (const forbidden of [
    "runRetentionCleanupOnce",
    "findRetentionScrubCandidates",
    "scrubOrderForRetention",
    "cleanupLegacyVerificationCodes",
    "deleteExpiredVerifications",
  ]) {
    assert.equal(CODE.includes(forbidden), false, forbidden);
  }
});
