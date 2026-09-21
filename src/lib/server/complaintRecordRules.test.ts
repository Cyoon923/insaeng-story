/**
 * 불만·분쟁 기록 규칙 테스트 (Privacy-Complaint-Implementation-1, Step 1).
 *
 * 실행: node --test src/lib/server/complaintRecordRules.test.ts
 *
 * DB도 API도 없다. 값 규칙과 전이 규칙만 본다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  COMPLAINT_SUMMARY_MAX,
  ComplaintRecordError,
  canEditComplaintEvidence,
  canTransitionComplaint,
  isComplaintCategory,
  isComplaintSourceType,
  isComplaintStatus,
  normalizeComplaintSummary,
  requireComplaintCategory,
  requireComplaintEvidenceEditable,
  requireComplaintSourceType,
  requireComplaintTransition,
} from "./complaintRecordRules.ts";

/* ── 분류 ────────────────────────────────────────── */

test("정해진 sourceType만 통과한다", () => {
  for (const value of ["chat", "inquiry", "other"]) {
    assert.equal(isComplaintSourceType(value), true);
    assert.equal(requireComplaintSourceType(value), value);
  }
  for (const value of ["Chat", "sms", "", null, undefined, 1, {}]) {
    assert.equal(isComplaintSourceType(value), false);
    assert.throws(() => requireComplaintSourceType(value), ComplaintRecordError);
  }
});

test("정해진 category만 통과한다", () => {
  for (const value of ["service", "payment", "consultation", "delivery", "privacy", "other"]) {
    assert.equal(isComplaintCategory(value), true);
    assert.equal(requireComplaintCategory(value), value);
  }
  for (const value of ["refund", "SERVICE", "", null, 0, []]) {
    assert.equal(isComplaintCategory(value), false);
    assert.throws(() => requireComplaintCategory(value), ComplaintRecordError);
  }
});

test("정해진 status만 인정한다", () => {
  assert.equal(isComplaintStatus("open"), true);
  assert.equal(isComplaintStatus("handled"), true);
  assert.equal(isComplaintStatus("closed"), false);
  assert.equal(isComplaintStatus(null), false);
});

/* ── 요지 ────────────────────────────────────────── */

test("요지는 앞뒤 공백을 덜어 낸다", () => {
  assert.equal(normalizeComplaintSummary("  환불 지연 불만  "), "환불 지연 불만");
});

test("빈 요지와 공백뿐인 요지를 거절한다", () => {
  for (const value of ["", "   ", "\n\t "]) {
    assert.throws(() => normalizeComplaintSummary(value), ComplaintRecordError);
  }
});

test("문자열이 아닌 요지를 거절한다", () => {
  for (const value of [null, undefined, 5, {}, ["a"]]) {
    assert.throws(() => normalizeComplaintSummary(value), ComplaintRecordError);
  }
});

test("500자는 통과하고 501자는 거절한다", () => {
  const max = "가".repeat(COMPLAINT_SUMMARY_MAX);
  assert.equal(normalizeComplaintSummary(max).length, COMPLAINT_SUMMARY_MAX);
  // 잘라 담지 않는다. 뒤가 잘린 기록이 증빙으로 남지 않게 한다.
  assert.throws(
    () => normalizeComplaintSummary("가".repeat(COMPLAINT_SUMMARY_MAX + 1)),
    ComplaintRecordError,
  );
  // 공백을 덜어 낸 뒤의 길이로 센다.
  assert.equal(normalizeComplaintSummary(`  ${max}  `).length, COMPLAINT_SUMMARY_MAX);
});

/* ── 전이 ────────────────────────────────────────── */

test("open에서 handled로만 갈 수 있다", () => {
  assert.equal(canTransitionComplaint("open", "handled"), true);
  assert.equal(requireComplaintTransition("open", "handled"), "handled");
});

test("같은 상태로 가거나 되돌아가는 전이를 거절한다", () => {
  for (const [from, to] of [
    ["open", "open"],
    ["handled", "handled"],
    ["handled", "open"],
  ] as const) {
    assert.equal(canTransitionComplaint(from, to), false);
    assert.throws(() => requireComplaintTransition(from, to), ComplaintRecordError);
  }
});

test("처리 완료된 기록은 다시 처리할 수 없다", () => {
  assert.throws(() => requireComplaintTransition("handled", "handled"), ComplaintRecordError);
});

test("알 수 없는 상태값을 거절한다", () => {
  assert.throws(() => requireComplaintTransition("closed", "handled"), ComplaintRecordError);
  assert.throws(() => requireComplaintTransition("open", "done"), ComplaintRecordError);
});

/* ── 증빙 수정 ───────────────────────────────────── */

test("증빙 수정은 open에서만 허용한다", () => {
  assert.equal(canEditComplaintEvidence("open"), true);
  assert.equal(requireComplaintEvidenceEditable("open"), "open");
});

test("handled 기록의 증빙 수정을 거절한다", () => {
  assert.equal(canEditComplaintEvidence("handled"), false);
  assert.throws(() => requireComplaintEvidenceEditable("handled"), ComplaintRecordError);
  assert.throws(() => requireComplaintEvidenceEditable("unknown"), ComplaintRecordError);
});
