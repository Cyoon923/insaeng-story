/**
 * 서비스 완료 시각 증빙 테스트 (Privacy-Retention-Completion-Evidence-1).
 *
 * 실행: node --test src/lib/server/serviceCompletion.test.ts
 *
 * DB를 부르지 않는다. "어느 상태에서 남기는가"와 "이미 있으면 덮어쓰지 않는가"만 본다.
 * SQL 쪽 반영(delivered_at COALESCE)은 store.ts의 한 문장이 맡는다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  applyConsultationCompletion,
  completedAtForStatus,
  deliveredAtForStatus,
} from "./serviceCompletion.ts";
import type { ConsultStatus, Consultation, OrderStatus } from "@/lib/types/app";

const FIRST = "2026-09-18T00:00:00.000Z";
const LATER = "2026-12-25T10:30:00.000Z";

function consultation(overrides: Partial<Consultation> = {}): Consultation {
  return {
    id: "c-1",
    userId: "u-1",
    teacher: "유비 선생",
    datetime: "8월 12일(화) 오전 10:00",
    purpose: "재물·금전",
    method: "카카오톡 상담",
    option: "없음",
    status: "상담 신청",
    amount: 100000,
    details: {},
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

/* ── 주문: 전달 시각 ────────────────────────────────── */

test("주문 일반 상태 변경에는 전달 시각을 남기지 않는다", () => {
  for (const status of ["신청접수", "상담진행", "제작중"] as OrderStatus[]) {
    assert.equal(deliveredAtForStatus(status, FIRST), null, status);
  }
});

test("주문이 처음 완성/전달이 되면 그 시각을 남긴다", () => {
  assert.equal(deliveredAtForStatus("완성/전달", FIRST), FIRST);
});

test('"완료"로 넘어갈 때는 전달 시각을 남기지 않는다', () => {
  /*
   * 전달 시점은 "완성/전달"이다. 뒤 단계로 갔다고 기산점이 밀리면 안 된다.
   * (이미 기록된 값은 SQL의 COALESCE가 지킨다.)
   */
  assert.equal(deliveredAtForStatus("완료", LATER), null);
});

/* ── 상담: 완료 시각 ────────────────────────────────── */

test("상담 일반 상태 변경에는 완료 시각을 남기지 않는다", () => {
  for (const status of ["상담 신청", "사주정보 입력", "선생님과 1:1 상담"] as ConsultStatus[]) {
    assert.equal(completedAtForStatus(status, FIRST), null, status);
    const item = consultation();
    assert.equal(applyConsultationCompletion(item, status, FIRST), false, status);
    assert.equal(item.completedAt, undefined, status);
  }
});

test("상담이 처음 상담 완료가 되면 그 시각을 남긴다", () => {
  const item = consultation();
  assert.equal(applyConsultationCompletion(item, "상담 완료", FIRST), true);
  assert.equal(item.completedAt, FIRST);
});

test("완료 뒤 다른 상태로 바뀌어도 최초값이 유지된다", () => {
  const item = consultation();
  applyConsultationCompletion(item, "상담 완료", FIRST);
  // 되돌아간 상태에서는 아무것도 하지 않는다.
  assert.equal(applyConsultationCompletion(item, "선생님과 1:1 상담", LATER), false);
  assert.equal(item.completedAt, FIRST);
});

test("다시 상담 완료가 되어도 최초값을 덮어쓰지 않는다", () => {
  const item = consultation();
  applyConsultationCompletion(item, "상담 완료", FIRST);
  assert.equal(applyConsultationCompletion(item, "상담 완료", LATER), false);
  assert.equal(item.completedAt, FIRST);
});

/* ── legacy 자료 ────────────────────────────────────── */

test("기존 자료에 완료 시각을 소급해 만들지 않는다", () => {
  // 이 구조가 생기기 전의 상담. 완료 상태로 저장되어 있어도 값이 없다.
  const legacy = consultation({ status: "상담 완료" });
  assert.equal(legacy.completedAt, undefined);
  // 상태만 읽고 값을 채우는 코드는 없다. 실제 전환이 일어나야 기록된다.
  assert.equal(applyConsultationCompletion(legacy, "선생님과 1:1 상담", LATER), false);
  assert.equal(legacy.completedAt, undefined);
});

test("createdAt을 완료 시각으로 대신 쓰지 않는다", () => {
  const item = consultation();
  applyConsultationCompletion(item, "상담 완료", FIRST);
  // 서버가 넘긴 시각만 들어간다. 신청 시각이 아니다.
  assert.equal(item.completedAt, FIRST);
  assert.notEqual(item.completedAt, item.createdAt);
});

/* ── 입력을 불필요하게 바꾸지 않는다 ─────────────────── */

test("남기지 않는 경우 상담 객체를 바꾸지 않는다", () => {
  const item = consultation();
  const before = JSON.stringify(item);
  applyConsultationCompletion(item, "상담 신청", FIRST);
  assert.equal(JSON.stringify(item), before);
});
