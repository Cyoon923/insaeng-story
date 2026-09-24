/**
 * 환불 문의 입력 검증과 Evidence 생성 테스트 (Refund-Request-Evidence-Data-1).
 *
 * 실행: node --test src/lib/server/refundRequestEvidence.test.ts
 * (Node 내장 테스트 러너와 타입 제거 기능만 쓴다. 새 라이브러리 없음.)
 *
 * DB가 필요한 부분(UNIQUE 인덱스·소유자 검증)은 refundRequests.test.sql에서 본다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRefundRequestEvidence,
  normalizeRefundRequestInput,
  REFUND_REQUEST_MESSAGE_MAX,
  REFUND_REQUEST_REASONS,
} from "./refundRequestEvidence.ts";
import {
  CONSULTATION_CANCEL_WINDOW_POLICY_VERSION,
  evaluateConsultationCancelWindowAt,
} from "./consultationCancelWindow.ts";

const START = "2026-08-12T01:00:00.000Z"; // 한국 8월 12일 오전 10:00

function minutesBefore(scheduledAt: string, minutes: number): Date {
  return new Date(Date.parse(scheduledAt) - minutes * 60_000);
}

test("목록에 있는 사유는 모두 통과한다", () => {
  for (const reason of REFUND_REQUEST_REASONS) {
    const message = reason === "other" ? "직접 적은 사유" : "";
    const result = normalizeRefundRequestInput({ reason, message });
    assert.equal(result.ok, true, reason);
    if (result.ok) assert.equal(result.input.reason, reason);
  }
});

test("목록에 없는 사유는 거절한다", () => {
  for (const bad of ["", "refund", "CHANGE-OF-MIND", undefined, null, 1, {}]) {
    const result = normalizeRefundRequestInput({ reason: bad });
    assert.deepEqual(result, { ok: false, reason: "invalid-reason" }, String(bad));
  }
});

test("other인데 상세 내용이 비면 거절한다", () => {
  assert.deepEqual(normalizeRefundRequestInput({ reason: "other" }), {
    ok: false,
    reason: "message-required",
  });
  // 공백만 적은 것도 적지 않은 것으로 본다.
  assert.deepEqual(normalizeRefundRequestInput({ reason: "other", message: "   \n\t " }), {
    ok: false,
    reason: "message-required",
  });
});

test("other가 아니면 상세 내용이 없어도 된다", () => {
  const result = normalizeRefundRequestInput({ reason: "schedule" });
  assert.deepEqual(result, { ok: true, input: { reason: "schedule", message: null } });
});

test("상세 내용은 앞뒤 공백을 떼고 저장한다", () => {
  const result = normalizeRefundRequestInput({ reason: "service-issue", message: "  내용  " });
  assert.equal(result.ok && result.input.message, "내용");
});

test("빈 상세 내용은 빈 문자열이 아니라 null로 둔다", () => {
  const result = normalizeRefundRequestInput({ reason: "change-of-mind", message: "   " });
  assert.equal(result.ok && result.input.message, null);
});

test("500자까지 받고 그 이상은 잘라 담지 않고 거절한다", () => {
  assert.equal(REFUND_REQUEST_MESSAGE_MAX, 500);
  const ok = normalizeRefundRequestInput({ reason: "other", message: "가".repeat(500) });
  assert.equal(ok.ok && ok.input.message?.length, 500);

  const tooLong = normalizeRefundRequestInput({ reason: "other", message: "가".repeat(501) });
  assert.deepEqual(tooLong, { ok: false, reason: "message-too-long" });

  // 공백을 떼고 난 길이로 본다. 공백이 붙어 501자여도 알맹이가 500자면 통과한다.
  const padded = normalizeRefundRequestInput({ reason: "other", message: ` ${"가".repeat(500)} ` });
  assert.equal(padded.ok, true);
});

test("인생곡 주문: productionStartedAt만 snapshot하고 상담 값은 만들지 않는다", () => {
  const evidence = buildRefundRequestEvidence({
    order: { product: "story", productionStartedAt: "2026-08-10T00:00:00.000Z" },
    consultation: null,
    requestedAt: new Date(START),
  });
  assert.deepEqual(evidence, {
    productionStartedAtSnapshot: "2026-08-10T00:00:00.000Z",
    scheduledAtSnapshot: null,
    cancelWindowSnapshot: null,
    cancelWindowPolicyVersion: null,
  });
});

test("productionStartedAt이 없으면 null이며 '제작 전'으로 바꿔 담지 않는다", () => {
  const evidence = buildRefundRequestEvidence({
    order: { product: "premium" },
    consultation: null,
    requestedAt: new Date(START),
  });
  assert.equal(evidence.productionStartedAtSnapshot, null);
  // 없는 값을 지어내지 않는다. 빈 문자열이나 접수 시각으로 대체하지 않는다.
  assert.notEqual(evidence.productionStartedAtSnapshot, "");
});

test("상담 주문: scheduledAt과 취소창 판정, 정책 버전을 함께 남긴다", () => {
  const requestedAt = minutesBefore(START, 181);
  const evidence = buildRefundRequestEvidence({
    order: { product: "consultation" },
    consultation: { scheduledAt: START },
    requestedAt,
  });
  assert.equal(evidence.scheduledAtSnapshot, START);
  assert.deepEqual(evidence.cancelWindowSnapshot, {
    kind: "normal-request",
    remainingMinutes: 181,
  });
  assert.equal(evidence.cancelWindowPolicyVersion, CONSULTATION_CANCEL_WINDOW_POLICY_VERSION);
  assert.equal(evidence.productionStartedAtSnapshot, null);
});

test("취소창 판정은 접수 기준시각과 정확히 같은 순간으로 계산한다", () => {
  // 경계(정확히 3시간 전)에서 확인한다. 기준시각이 1분만 달라져도 결론이 바뀌는 지점이다.
  const requestedAt = minutesBefore(START, 180);
  const evidence = buildRefundRequestEvidence({
    order: { product: "consultation" },
    consultation: { scheduledAt: START },
    requestedAt,
  });
  // 같은 시각을 넣은 직접 판정과 한 글자도 다르지 않아야 한다.
  assert.deepEqual(evidence.cancelWindowSnapshot, evaluateConsultationCancelWindowAt(START, requestedAt));
  assert.deepEqual(evidence.cancelWindowSnapshot, { kind: "normal-request", remainingMinutes: 180 });

  // 1분 뒤에 접수했다면 manual-review가 되어야 한다(같은 기준시각을 쓰는지 확인).
  const later = buildRefundRequestEvidence({
    order: { product: "consultation" },
    consultation: { scheduledAt: START },
    requestedAt: minutesBefore(START, 179),
  });
  assert.deepEqual(later.cancelWindowSnapshot, {
    kind: "manual-review",
    reason: "within-window",
    remainingMinutes: 179,
  });
});

test("상담인데 예약 시각 기록이 없으면 manual-review로 남긴다", () => {
  const evidence = buildRefundRequestEvidence({
    order: { product: "consultation" },
    consultation: { scheduledAt: undefined },
    requestedAt: new Date(START),
  });
  assert.equal(evidence.scheduledAtSnapshot, null);
  assert.deepEqual(evidence.cancelWindowSnapshot, {
    kind: "manual-review",
    reason: "missing-scheduled-at",
  });
  assert.equal(evidence.cancelWindowPolicyVersion, CONSULTATION_CANCEL_WINDOW_POLICY_VERSION);
});

test("상담을 찾지 못해도 예약 시각을 지어내지 않는다", () => {
  const evidence = buildRefundRequestEvidence({
    order: { product: "consultation" },
    consultation: null,
    requestedAt: new Date(START),
  });
  assert.equal(evidence.scheduledAtSnapshot, null);
  assert.equal(evidence.cancelWindowSnapshot?.kind, "manual-review");
});

test("정책 버전은 동의 문구 버전과 섞이지 않는 독립된 값이다", () => {
  assert.equal(CONSULTATION_CANCEL_WINDOW_POLICY_VERSION, "consult-cancel-window-3h-v1");
  assert.notEqual(CONSULTATION_CANCEL_WINDOW_POLICY_VERSION, "unconfirmed-draft");
});
