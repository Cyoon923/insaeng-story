/**
 * 관리자 날짜 표시 테스트. 실행: node --test src/lib/adminDate.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { formatAdminDate } from "./adminDate.ts";

test("UTC ISO를 한국 시각으로 보여 준다", () => {
  assert.equal(formatAdminDate("2026-09-01T01:00:00.000Z"), "2026.09.01 10:00");
  assert.equal(formatAdminDate("2026-09-20T03:00:00.000Z"), "2026.09.20 12:00");
  // 날짜가 넘어가는 경계: UTC 10-31 15:00 = 한국 11-01 00:00
  assert.equal(formatAdminDate("2026-10-31T15:00:00Z"), "2026.11.01 00:00");
  assert.equal(formatAdminDate("2026-10-31T14:59:59.999Z"), "2026.10.31 23:59");
  // 시간대가 붙은 값도 같은 순간으로 읽는다.
  assert.equal(formatAdminDate("2026-09-01T10:00:00+09:00"), "2026.09.01 10:00");
});

test("값이 없거나 시간대가 없는 값은 추측하지 않는다", () => {
  assert.equal(formatAdminDate(""), "-");
  assert.equal(formatAdminDate(null), "-");
  assert.equal(formatAdminDate(undefined), "-");
  assert.equal(formatAdminDate("2026-10-04"), "2026.10.04");
  assert.equal(formatAdminDate("2026-09-01T10:00"), "2026.09.01 10:00");
});
