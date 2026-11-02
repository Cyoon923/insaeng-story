/** 실행: node --test src/lib/server/inquiryRetention.test.ts (DB·외부 API 사용 없음) */
import assert from "node:assert/strict";
import test from "node:test";
import { isInquiryRetentionDecision, prepareInquiryRetentionUpdate, readInquiryRetention } from "./inquiryRetention.ts";
import type { InquiryRetentionDecision } from "../types/inquiryRetention.ts";

const NOW = "2026-11-02T00:00:00.000Z";
const decision: InquiryRetentionDecision = {
  classification: "unclassified", resolvedAt: null, grounds: [],
  hold: { reason: "classification-review", reviewAt: "2026-11-09T00:00:00.000Z" },
  complaintRecordIds: [],
};

test("기존 값 없음과 손상·미지원 버전을 구분한다", () => {
  for (const value of [undefined, null]) assert.deepEqual(readInquiryRetention(value), { kind: "unclassified" });
  for (const value of [{}, { version: 2 }, "bad", []]) assert.deepEqual(readInquiryRetention(value), { kind: "invalid" });
});

test("서버 판정자·시각과 변경 이력을 누적하고 입력 객체는 바꾸지 않는다", () => {
  const first = prepareInquiryRetentionUpdate(null, 0, decision, "admin-1", NOW);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const before = structuredClone(first.value);
  const next = prepareInquiryRetentionUpdate(first.value, 1, { ...decision, classification: "general" }, "admin-2", NOW);
  assert.equal(next.ok, true);
  if (!next.ok) return;
  assert.equal(next.value.revision, 2);
  assert.deepEqual(next.value.history.map((v) => v.actorId), ["admin-1", "admin-2"]);
  assert.equal(next.value.history[0].decision.classification, "unclassified");
  assert.equal(next.value.history[1].decision.classification, "general");
  assert.equal(next.value.scrubbedAt, null);
  assert.deepEqual(first.value, before);
  assert.equal(readInquiryRetention(next.value).kind, "stored");
});

test("JSONB 객체 키 순서가 바뀌어도 현재 판정·이력 일치를 읽는다", () => {
  const first = prepareInquiryRetentionUpdate(null, 0, decision, "admin", NOW);
  assert.ok(first.ok);
  first.value.decision = Object.fromEntries(Object.entries(first.value.decision).reverse()) as unknown as InquiryRetentionDecision;
  assert.equal(readInquiryRetention(first.value).kind, "stored");
  first.value.decision.classification = "mixed";
  assert.equal(readInquiryRetention(first.value).kind, "invalid");
});

test("여러 보존 근거와 불명확한 기준일을 임의 계산하지 않고 보존한다", () => {
  const input: InquiryRetentionDecision = { ...decision, classification: "mixed", grounds: [
    { code: "complaint-record", policyVersion: "review-v1", startsAt: null, endsAt: null },
    { code: "transaction-record", policyVersion: "review-v1", startsAt: "2026-01-01T00:00:00Z", endsAt: "2031-01-01T00:00:00Z" },
  ] };
  const result = prepareInquiryRetentionUpdate(null, 0, input, "admin", NOW);
  assert.ok(result.ok);
  assert.deepEqual(result.value.decision.grounds, input.grounds);
});

test("본문·이력·삭제 완료 시각 주입, 잘못된 날짜와 보류 입력은 거절한다", () => {
  for (const bad of [
    { ...decision, message: "private text" }, { ...decision, history: [] }, { ...decision, scrubbedAt: NOW },
    { ...decision, classification: "unknown" }, { ...decision, resolvedAt: "2026-02-30T00:00:00Z" },
    { ...decision, resolvedAt: "2027-01-01T00:00:00Z" },
    { ...decision, hold: { reason: "free-text", reviewAt: NOW } },
    { ...decision, hold: { reason: "ongoing-dispute", reviewAt: NOW } },
    { ...decision, grounds: [{ code: "transaction-record", policyVersion: "v1", startsAt: null, endsAt: NOW }] },
    { ...decision, complaintRecordIds: ["one", "one"] },
  ]) assert.deepEqual(prepareInquiryRetentionUpdate(null, 0, bad, "admin", NOW), { ok: false, reason: "invalid-input" });
  assert.equal(isInquiryRetentionDecision({ ...decision, hold: null }), true);
});

test("경합·손상 기록은 덮어쓰지 않는다", () => {
  const first = prepareInquiryRetentionUpdate(null, 0, decision, "admin", NOW);
  assert.ok(first.ok);
  assert.deepEqual(prepareInquiryRetentionUpdate(first.value, 0, decision, "admin", NOW), { ok: false, reason: "conflict" });
  assert.deepEqual(prepareInquiryRetentionUpdate({ version: 99 }, 0, decision, "admin", NOW), { ok: false, reason: "invalid-stored-data" });
  first.value.history[0].revision = 7;
  assert.equal(readInquiryRetention(first.value).kind, "invalid");
});
