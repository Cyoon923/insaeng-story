/**
 * Consult-Cancel-Window-1 판정 테스트.
 *
 * 실행: node --test src/lib/server/consultationCancelWindow.test.ts
 * (Node 22+ 내장 테스트 러너와 TypeScript 타입 제거 기능만 쓴다. 새 라이브러리 없음.)
 *
 * now 주입은 이 테스트 전용 함수(evaluateConsultationCancelWindowAt)로만 한다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateConsultationCancelWindowAt,
  type ConsultationCancelWindow,
} from "./consultationCancelWindow.ts";

/** 상담 시작 시각(UTC ISO)에서 minutes 분 전의 시각을 만든다. */
function minutesBefore(scheduledAt: string, minutes: number): Date {
  return new Date(Date.parse(scheduledAt) - minutes * 60_000);
}

const START = "2026-08-12T01:00:00.000Z"; // 한국 8월 12일 오전 10:00

test("3시간 1분 전이면 normal-request", () => {
  const result = evaluateConsultationCancelWindowAt(START, minutesBefore(START, 181));
  assert.deepEqual(result, { kind: "normal-request", remainingMinutes: 181 });
});

test("정확히 3시간 전이면 normal-request (경계 포함)", () => {
  const result = evaluateConsultationCancelWindowAt(START, minutesBefore(START, 180));
  assert.deepEqual(result, { kind: "normal-request", remainingMinutes: 180 });
});

test("2시간 59분 전이면 manual-review(within-window)", () => {
  const result = evaluateConsultationCancelWindowAt(START, minutesBefore(START, 179));
  assert.deepEqual(result, {
    kind: "manual-review",
    reason: "within-window",
    remainingMinutes: 179,
  });
});

test("상담 시작 정각이면 manual-review(after-start)", () => {
  const result = evaluateConsultationCancelWindowAt(START, new Date(START));
  assert.deepEqual(result, { kind: "manual-review", reason: "after-start", remainingMinutes: 0 });
});

test("상담 시작 이후면 manual-review(after-start)", () => {
  const result = evaluateConsultationCancelWindowAt(START, minutesBefore(START, -30));
  assert.deepEqual(result, { kind: "manual-review", reason: "after-start", remainingMinutes: -30 });
});

test("scheduledAt이 없으면 manual-review(missing-scheduled-at)", () => {
  const result = evaluateConsultationCancelWindowAt(undefined, new Date(START));
  assert.deepEqual(result, { kind: "manual-review", reason: "missing-scheduled-at" });
  assert.equal("remainingMinutes" in result, false);
});

test("빈 문자열도 기록 없음으로 본다", () => {
  const result = evaluateConsultationCancelWindowAt("", new Date(START));
  assert.deepEqual(result, { kind: "manual-review", reason: "missing-scheduled-at" });
});

test("해석되지 않는 scheduledAt이면 manual-review(invalid-scheduled-at)", () => {
  for (const bad of ["8월 12일(화) 오전 10:00", "not-an-iso", "2026-13-40T99:99:99Z"]) {
    const result = evaluateConsultationCancelWindowAt(bad, new Date(START));
    assert.deepEqual(result, { kind: "manual-review", reason: "invalid-scheduled-at" }, bad);
  }
});

test("연말·날짜 변경 경계에서도 UTC 절대시각으로만 비교한다", () => {
  // 한국 2027년 1월 1일 오전 9시 = 2026-12-31T00:00:00Z.
  const newYear = "2027-01-01T00:00:00.000Z";

  // 달력 날짜도 해도 다르지만 남은 시간은 3시간 1분이므로 normal-request.
  assert.deepEqual(
    evaluateConsultationCancelWindowAt(newYear, new Date("2026-12-31T20:59:00.000Z")),
    { kind: "normal-request", remainingMinutes: 181 },
  );

  // 같은 해 경계에서 2시간 59분 남은 경우는 manual-review.
  assert.deepEqual(
    evaluateConsultationCancelWindowAt(newYear, new Date("2026-12-31T21:01:00.000Z")),
    { kind: "manual-review", reason: "within-window", remainingMinutes: 179 },
  );

  // 오프셋 표기가 달라도(+09:00) 같은 절대시각이면 같은 판정이다.
  const kstSpelling = "2027-01-01T09:00:00+09:00";
  const a: ConsultationCancelWindow = evaluateConsultationCancelWindowAt(
    kstSpelling,
    new Date("2026-12-31T20:59:00.000Z"),
  );
  assert.deepEqual(a, { kind: "normal-request", remainingMinutes: 181 });
});
