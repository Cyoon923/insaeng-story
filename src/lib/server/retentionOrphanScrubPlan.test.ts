/**
 * 짝 없는 상담 scrub 계획 테스트 (Privacy-Retention-Orphan-1).
 *
 * 실행: node --test src/lib/server/retentionOrphanScrubPlan.test.ts
 *
 * 순수 함수라 DB가 필요 없다. orders 테이블 조회 결과는 evidence로 넣어 고정한다.
 * 이 테스트는 아무것도 저장하지 않고 아무것도 지우지 않는다.
 *
 * "orders/payments를 건드리지 않는다"는 문장 차원의 보장은
 * retentionOrphanScrubSource.test.ts에서 따로 본다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { planOrphanConsultationScrub } from "./retentionOrphanScrubPlan.ts";
import type { AppData, Consultation, Order } from "@/lib/types/app";

const COMPLETED = "2025-09-01T00:00:00.000Z";
/** 위 시각의 만료 시점. 달력 기준 +1년. */
const ELIGIBLE_AT = "2026-09-01T00:00:00.000Z";

/** 지워야 하는 값과 남겨야 하는 값을 섞어 둔 details. */
const DETAILS: Record<string, string> = {
  name: "홍길동",
  phone: "010-1234-5678",
  birth: "1990-01-01",
  content: "가장 궁금한 내용",
  counterpartName: "김철수",
  counterpartBirth: "1988-05-05",
  purpose: "재물·금전",
  referrerId: "u-referrer-1",
  applyConsent: "1",
  nickname: "임의로 섞인 키",
  // 남아야 하는 값.
  teacher: "유비 선생",
  datetime: "8월 12일(화) 오전 10:00",
  method: "카카오톡 상담",
  option: "없음",
  pointsUsed: "10000",
};

const KEPT: Record<string, string> = {
  teacher: "유비 선생",
  datetime: "8월 12일(화) 오전 10:00",
  method: "카카오톡 상담",
  option: "없음",
  pointsUsed: "10000",
};

function consultation(overrides: Partial<Consultation> = {}): Consultation {
  return {
    id: "c-1",
    userId: "u-1",
    teacher: "유비 선생",
    datetime: "8월 12일(화) 오전 10:00",
    purpose: "재물·금전 / 직업·사업 고민",
    method: "카카오톡 상담",
    option: "상담 기록 요약 리포트",
    status: "상담 완료",
    amount: 120000,
    details: { ...DETAILS },
    createdAt: "2025-08-01T00:00:00.000Z",
    completedAt: COMPLETED,
    ...overrides,
  };
}

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: "c-1",
    userId: "u-1",
    product: "consultation",
    title: "1:1 사주상담",
    status: "신청접수",
    amount: 120000,
    payment: "신용/체크카드",
    details: { name: "홍길동" },
    createdAt: "2025-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function appData(consultations: Consultation[], orders: Order[] = []): AppData {
  return {
    users: [],
    orders,
    consultations,
    inquiries: [],
    reviews: [],
    wishlists: {},
    coupons: {},
    notifications: {},
    notificationSettings: {},
    codes: {},
    blockedSlots: [],
    adminPromo: null,
  };
}

/** 짝 주문이 orders 테이블에도 없는 경우. 대부분의 테스트가 쓰는 기본값이다. */
const NO_SQL_ORDER = { pairedOrderInSql: false };

/* ── 대상이 되는 경우 ───────────────────────────────── */

test("보관 기간이 끝난 짝 없는 상담은 계획이 나온다", () => {
  const data = appData([consultation()]);
  const result = planOrphanConsultationScrub(data, "c-1", ELIGIBLE_AT, NO_SQL_ORDER);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.plan.index, 0);
  assert.equal(result.plan.evidenceAt, COMPLETED);
  assert.equal(result.plan.eligibleAt, ELIGIBLE_AT);
  assert.equal(result.plan.scrubbedAt, ELIGIBLE_AT);
});

test("정확히 1년이 된 순간부터 대상이다", () => {
  const data = appData([consultation()]);
  assert.equal(planOrphanConsultationScrub(data, "c-1", ELIGIBLE_AT, NO_SQL_ORDER).ok, true);
});

test("1년이 되기 1밀리초 전은 아직 대상이 아니다", () => {
  const data = appData([consultation()]);
  const justBefore = new Date(Date.parse(ELIGIBLE_AT) - 1).toISOString();
  assert.deepEqual(planOrphanConsultationScrub(data, "c-1", justBefore, NO_SQL_ORDER), {
    ok: false,
    reason: "not-yet",
  });
});

/* ── 정리 결과 ──────────────────────────────────────── */

test("개인정보와 상담 목적이 모두 빠진다", () => {
  const data = appData([consultation()]);
  const result = planOrphanConsultationScrub(data, "c-1", ELIGIBLE_AT, NO_SQL_ORDER);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const next = result.plan.nextConsultation;

  assert.equal("purpose" in next, false);
  assert.deepEqual(next.details, KEPT);
  for (const key of ["name", "phone", "birth", "content", "counterpartName", "nickname"]) {
    assert.equal(key in next.details, false, key);
  }
});

test("완료 증빙과 일정·거래 정보는 그대로다", () => {
  const before = consultation();
  const result = planOrphanConsultationScrub(appData([before]), "c-1", ELIGIBLE_AT, NO_SQL_ORDER);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const next = result.plan.nextConsultation;

  assert.equal(next.completedAt, COMPLETED);
  assert.equal(next.id, before.id);
  assert.equal(next.userId, before.userId);
  assert.equal(next.teacher, before.teacher);
  assert.equal(next.datetime, before.datetime);
  assert.equal(next.method, before.method);
  assert.equal(next.option, before.option);
  assert.equal(next.status, before.status);
  assert.equal(next.amount, before.amount);
  assert.equal(next.createdAt, before.createdAt);
});

/* ── 짝이 있으면 하지 않는다 ────────────────────────── */

test("app_store에 짝 주문이 있으면 대상이 아니다", () => {
  const data = appData([consultation()], [order()]);
  assert.deepEqual(planOrphanConsultationScrub(data, "c-1", ELIGIBLE_AT, NO_SQL_ORDER), {
    ok: false,
    reason: "paired-order-exists",
  });
});

test("orders 테이블에 짝 주문이 있으면 대상이 아니다", () => {
  // app_store에는 없지만 테이블 쪽에만 남아 있는 경우. 두 저장소는 어긋날 수 있다.
  const data = appData([consultation()]);
  assert.deepEqual(
    planOrphanConsultationScrub(data, "c-1", ELIGIBLE_AT, { pairedOrderInSql: true }),
    { ok: false, reason: "paired-order-exists" },
  );
});

test("한쪽에만 있어도 막는다", () => {
  // 양쪽에 있는 경우도 당연히 막힌다. 어느 조합이든 결과가 같다.
  const both = appData([consultation()], [order()]);
  assert.equal(
    planOrphanConsultationScrub(both, "c-1", ELIGIBLE_AT, { pairedOrderInSql: true }).ok,
    false,
  );
});

test("다른 id의 주문은 짝이 아니다", () => {
  const data = appData([consultation()], [order({ id: "o-다른건" })]);
  assert.equal(planOrphanConsultationScrub(data, "c-1", ELIGIBLE_AT, NO_SQL_ORDER).ok, true);
});

test("짝 판정은 id 접두사와 무관하다", () => {
  /*
   * "c-"로 시작하지 않는 상담도 짝이 없으면 대상이고,
   * "c-"로 시작해도 같은 id의 주문이 있으면 대상이 아니다.
   */
  const oddId = appData([consultation({ id: "legacy-42" })]);
  assert.equal(planOrphanConsultationScrub(oddId, "legacy-42", ELIGIBLE_AT, NO_SQL_ORDER).ok, true);

  const paired = appData([consultation({ id: "c-9" })], [order({ id: "c-9", product: "story" })]);
  assert.deepEqual(planOrphanConsultationScrub(paired, "c-9", ELIGIBLE_AT, NO_SQL_ORDER), {
    ok: false,
    reason: "paired-order-exists",
  });
});

/* ── 증빙이 없거나 읽히지 않는 경우 ────────────────── */

test("완료 기록이 없으면 대상이 아니다", () => {
  const legacy = consultation();
  delete legacy.completedAt;
  assert.deepEqual(
    planOrphanConsultationScrub(appData([legacy]), "c-1", "2030-01-01T00:00:00.000Z", NO_SQL_ORDER),
    { ok: false, reason: "missing-evidence" },
  );
});

test("읽을 수 없는 완료 기록이면 대상이 아니다", () => {
  for (const value of ["언젠가", "2026-13-45T00:00:00Z", "0000", "   "]) {
    const bad = consultation({ completedAt: value });
    const result = planOrphanConsultationScrub(
      appData([bad]),
      "c-1",
      "2030-01-01T00:00:00.000Z",
      NO_SQL_ORDER,
    );
    assert.equal(result.ok, false, value);
    if (result.ok) return;
    assert.equal(
      result.reason === "invalid-evidence" || result.reason === "missing-evidence",
      true,
      value,
    );
  }
});

test("현재 시각을 읽을 수 없으면 대상이 아니다", () => {
  assert.deepEqual(planOrphanConsultationScrub(appData([consultation()]), "c-1", "지금", NO_SQL_ORDER), {
    ok: false,
    reason: "invalid-now",
  });
});

test("createdAt·datetime·status로 완료 시각을 추정하지 않는다", () => {
  // 오래된 신청 기록과 "상담 완료" 상태가 있어도 증빙이 없으면 대상이 아니다.
  const legacy = consultation({
    createdAt: "2019-01-01T00:00:00.000Z",
    datetime: "1월 5일(토) 오전 10:00",
    status: "상담 완료",
  });
  delete legacy.completedAt;
  assert.deepEqual(
    planOrphanConsultationScrub(appData([legacy]), "c-1", "2030-01-01T00:00:00.000Z", NO_SQL_ORDER),
    { ok: false, reason: "missing-evidence" },
  );
});

test("없는 상담은 대상이 아니다", () => {
  const data = appData([consultation()]);
  assert.deepEqual(planOrphanConsultationScrub(data, "c-없음", ELIGIBLE_AT, NO_SQL_ORDER), {
    ok: false,
    reason: "consultation-not-found",
  });
  assert.deepEqual(planOrphanConsultationScrub(data, "   ", ELIGIBLE_AT, NO_SQL_ORDER), {
    ok: false,
    reason: "consultation-not-found",
  });
});

/* ── 계획은 저장소를 바꾸지 않는다 ─────────────────── */

test("계획을 세워도 저장소는 그대로다", () => {
  const data = appData([consultation()], [order({ id: "o-이웃" })]);
  const snapshot = JSON.stringify(data);
  assert.equal(planOrphanConsultationScrub(data, "c-1", ELIGIBLE_AT, NO_SQL_ORDER).ok, true);
  assert.equal(JSON.stringify(data), snapshot);
  assert.equal(data.consultations[0].details.name, "홍길동");
  assert.equal(data.consultations[0].purpose, "재물·금전 / 직업·사업 고민");
});

test("이웃한 상담·주문은 계획에 들어오지 않는다", () => {
  const target = consultation({ id: "c-1" });
  const neighbour = consultation({ id: "c-2" });
  const data = appData([neighbour, target], [order({ id: "o-이웃" })]);
  const result = planOrphanConsultationScrub(data, "c-1", ELIGIBLE_AT, NO_SQL_ORDER);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  // 자리(index)가 정확해야 반영하는 쪽이 엉뚱한 상담을 덮지 않는다.
  assert.equal(result.plan.index, 1);
  assert.equal(result.plan.consultation, target);
  assert.equal(data.consultations[0], neighbour);
});

/* ── 다시 실행해도 안전하다 ────────────────────────── */

test("이미 정리한 상담도 같은 계획이 다시 나온다", () => {
  // 계획 단계는 멱등이다. 최초값 보존은 반영하는 쪽이 맡는다.
  const done = consultation({
    details: { ...KEPT },
    retentionScrubbedAt: "2026-09-01T00:00:00.000Z",
  });
  delete done.purpose;
  const result = planOrphanConsultationScrub(
    appData([done]),
    "c-1",
    "2027-01-01T00:00:00.000Z",
    NO_SQL_ORDER,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.plan.nextConsultation.details, KEPT);
  assert.equal("purpose" in result.plan.nextConsultation, false);
  assert.equal(result.plan.nextConsultation.completedAt, COMPLETED);
});
