/**
 * 보관 만료 scrub 계획 테스트 (Privacy-Retention-Execution-1).
 *
 * 실행: node --test src/lib/server/retentionScrubPlan.test.ts
 *
 * 순수 함수라 DB가 필요 없다. 현재 시각을 인자로 넣어 경계를 정확히 고정한다.
 * 이 테스트는 아무것도 저장하지 않고 아무것도 지우지 않는다.
 *
 * SQL 원자성·CAS·결제 fail-closed는 JavaScript로 볼 수 없다. 그쪽은
 * retentionScrubSource.test.ts(문장 조건)와 retentionScrub.test.sql(실제 DB)에서 본다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { planRetentionScrub } from "./retentionScrubPlan.ts";
import type { AppData, Consultation, Order } from "@/lib/types/app";

const DELIVERED = "2025-09-01T00:00:00.000Z";
/** 위 시각의 만료 시점. 달력 기준 +1년. */
const ELIGIBLE_AT = "2026-09-01T00:00:00.000Z";

/** 지워야 하는 값과 남겨야 하는 값을 섞어 둔 details. */
const DETAILS: Record<string, string> = {
  name: "홍길동",
  phone: "010-1234-5678",
  birth: "1990-01-01",
  memory: "가장 기억에 남는 순간",
  content: "가장 궁금한 내용",
  counterpartName: "김철수",
  purpose: "재물·금전",
  protagonist: "옆집 친구 영희",
  referrerId: "u-referrer-1",
  applyConsent: "1",
  // 클라이언트가 임의로 섞어 보낼 수 있는 키.
  nickname: "별명",
  // 남아야 하는 값.
  protagonistId: "parents",
  teacher: "유비 선생",
  datetime: "8월 12일(화) 오전 10:00",
  optionIds: "ai-mv",
  referralCode: "IS12AB34",
  pointsUsed: "10000",
};

const KEPT: Record<string, string> = {
  protagonistId: "parents",
  teacher: "유비 선생",
  datetime: "8월 12일(화) 오전 10:00",
  optionIds: "ai-mv",
  referralCode: "IS12AB34",
  pointsUsed: "10000",
};

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: "o-1",
    userId: "u-1",
    product: "story",
    title: "이야기로 만드는 인생곡",
    status: "완료",
    amount: 150000,
    payment: "신용/체크카드",
    details: { ...DETAILS },
    createdAt: "2025-08-01T00:00:00.000Z",
    deliveredAt: DELIVERED,
    ...overrides,
  };
}

function consultation(overrides: Partial<Consultation> = {}): Consultation {
  return {
    id: "c-1",
    userId: "u-1",
    teacher: "유비 선생",
    datetime: "8월 12일(화) 오전 10:00",
    purpose: "재물·금전 / 직업·사업 고민",
    method: "카카오톡 상담",
    option: "없음",
    status: "상담 완료",
    amount: 100000,
    details: { ...DETAILS },
    createdAt: "2025-08-01T00:00:00.000Z",
    completedAt: DELIVERED,
    ...overrides,
  };
}

/** 대상 1건과, 건드리면 안 되는 이웃 1건을 함께 담는다. */
function appData(orders: Order[], consultations: Consultation[] = []): AppData {
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

/* ── 인생곡: deliveredAt 기준 ───────────────────────── */

test("보관 기간이 끝난 인생곡 주문은 계획이 나온다", () => {
  const data = appData([order()]);
  const result = planRetentionScrub(data, "o-1", ELIGIBLE_AT);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.plan.order.id, "o-1");
  assert.equal(result.plan.consultation, null);
  assert.equal(result.plan.consultationDetails, null);
  assert.equal(result.plan.evidenceAt, DELIVERED);
  assert.equal(result.plan.eligibleAt, ELIGIBLE_AT);
  assert.equal(result.plan.scrubbedAt, ELIGIBLE_AT);
});

test("인생곡 계획의 details는 allowlist 결과다", () => {
  const data = appData([order()]);
  const result = planRetentionScrub(data, "o-1", ELIGIBLE_AT);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.plan.orderDetails, KEPT);
  // 모르는 키도 남지 않는다.
  assert.equal("nickname" in result.plan.orderDetails, false);
});

test("아직 1년이 되지 않았으면 계획이 없다", () => {
  const data = appData([order()]);
  const justBefore = new Date(Date.parse(ELIGIBLE_AT) - 1).toISOString();
  assert.deepEqual(planRetentionScrub(data, "o-1", justBefore), {
    ok: false,
    reason: "not-yet",
  });
});

test("전달 기록이 없으면 계획이 없다", () => {
  const legacy = order();
  delete legacy.deliveredAt;
  assert.deepEqual(planRetentionScrub(appData([legacy]), "o-1", "2030-01-01T00:00:00.000Z"), {
    ok: false,
    reason: "missing-evidence",
  });
});

test("읽을 수 없는 전달 기록이면 계획이 없다", () => {
  for (const value of ["언젠가", "2026-13-45T00:00:00Z", "0000", ""]) {
    const bad = order({ deliveredAt: value });
    const result = planRetentionScrub(appData([bad]), "o-1", "2030-01-01T00:00:00.000Z");
    assert.equal(result.ok, false, value);
    if (result.ok) return;
    // 빈 값은 "기록 없음", 그 밖은 "읽을 수 없음"이다. 둘 다 write 0이다.
    assert.equal(
      result.reason === "invalid-evidence" || result.reason === "missing-evidence",
      true,
      value,
    );
  }
});

test("현재 시각을 읽을 수 없으면 계획이 없다", () => {
  assert.deepEqual(planRetentionScrub(appData([order()]), "o-1", "지금"), {
    ok: false,
    reason: "invalid-now",
  });
});

test("없는 주문은 계획이 없다", () => {
  const data = appData([order()]);
  assert.deepEqual(planRetentionScrub(data, "o-없음", ELIGIBLE_AT), {
    ok: false,
    reason: "order-not-found",
  });
  assert.deepEqual(planRetentionScrub(data, "   ", ELIGIBLE_AT), {
    ok: false,
    reason: "order-not-found",
  });
});

test("인생곡은 completedAt 비슷한 값을 보지 않는다", () => {
  /*
   * 상담이 아닌 주문에 상담 완료 시각처럼 생긴 값이 섞여 있어도 기산점이 되지 않는다.
   * 전달 기록이 없으면 그대로 "기록 없음"이다.
   */
  const legacy = order({ status: "완료" });
  delete legacy.deliveredAt;
  const strays = appData([legacy], [consultation({ id: "o-1", completedAt: DELIVERED })]);
  assert.deepEqual(planRetentionScrub(strays, "o-1", "2030-01-01T00:00:00.000Z"), {
    ok: false,
    reason: "missing-evidence",
  });
});

/* ── 상담: completedAt 기준 ─────────────────────────── */

test("보관 기간이 끝난 상담은 계획에 상담이 함께 담긴다", () => {
  const consultOrder = order({ id: "c-1", product: "consultation", title: "1:1 사주상담" });
  delete consultOrder.deliveredAt;
  const data = appData([consultOrder], [consultation()]);
  const result = planRetentionScrub(data, "c-1", ELIGIBLE_AT);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.plan.consultation?.id, "c-1");
  assert.deepEqual(result.plan.orderDetails, KEPT);
  assert.deepEqual(result.plan.consultationDetails, KEPT);
  assert.equal(result.plan.evidenceAt, DELIVERED);
});

test("상담은 주문의 deliveredAt이 아니라 상담의 completedAt을 본다", () => {
  /*
   * 주문에는 1년이 지난 전달 기록이 있고 상담은 아직 끝나지 않았다.
   * 주문 쪽을 보면 eligible이지만 상담 기준이라 아직 대상이 아니다.
   */
  const consultOrder = order({
    id: "c-1",
    product: "consultation",
    deliveredAt: "2000-01-01T00:00:00.000Z",
  });
  const notDone = consultation();
  delete notDone.completedAt;
  assert.deepEqual(planRetentionScrub(appData([consultOrder], [notDone]), "c-1", ELIGIBLE_AT), {
    ok: false,
    reason: "missing-evidence",
  });

  // 반대 방향도 본다. 주문에 전달 기록이 없어도 상담이 끝났으면 대상이다.
  const noDelivery = order({ id: "c-1", product: "consultation" });
  delete noDelivery.deliveredAt;
  const done = planRetentionScrub(appData([noDelivery], [consultation()]), "c-1", ELIGIBLE_AT);
  assert.equal(done.ok, true);
});

test("상담이 아직 끝나지 않았으면 계획이 없다", () => {
  const consultOrder = order({ id: "c-1", product: "consultation" });
  delete consultOrder.deliveredAt;
  const justBefore = new Date(Date.parse(ELIGIBLE_AT) - 1).toISOString();
  assert.deepEqual(
    planRetentionScrub(appData([consultOrder], [consultation()]), "c-1", justBefore),
    { ok: false, reason: "not-yet" },
  );
});

test("상품 판별은 id 접두사가 아니라 product 값으로 한다", () => {
  /*
   * id가 "c-"로 시작해도 인생곡 주문이면 deliveredAt을 본다.
   * 같은 id의 상담이 없어도 계획이 나온다.
   */
  const songWithConsultLookingId = order({ id: "c-1", product: "saju-song" });
  const result = planRetentionScrub(appData([songWithConsultLookingId]), "c-1", ELIGIBLE_AT);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.plan.consultation, null);

  // 반대로 id가 "o-"여도 product가 consultation이면 상담을 찾는다.
  const consultWithSongLookingId = order({ id: "o-9", product: "consultation" });
  assert.deepEqual(planRetentionScrub(appData([consultWithSongLookingId]), "o-9", ELIGIBLE_AT), {
    ok: false,
    reason: "consultation-not-found",
  });
});

test("짝이 되는 상담이 없으면 주문의 시각으로 대신 판정하지 않는다", () => {
  // deliveredAt이 아주 오래된 값이어도 상담을 찾지 못하면 아무것도 하지 않는다.
  const orphanOrder = order({
    id: "c-1",
    product: "consultation",
    deliveredAt: "2000-01-01T00:00:00.000Z",
  });
  assert.deepEqual(planRetentionScrub(appData([orphanOrder]), "c-1", ELIGIBLE_AT), {
    ok: false,
    reason: "consultation-not-found",
  });
});

/* ── 짝 없는 상담은 이번 단계 대상이 아니다 ────────── */

test("주문이 없는 상담은 계획을 세울 수 없다", () => {
  /*
   * 예전 자료에는 짝이 되는 주문 없이 상담만 남아 있을 수 있다(myOrders 참고).
   * 이번 단계는 주문 id로만 들어오므로 그런 상담에는 닿지 않는다.
   * 처리하기 위해 주문을 지어내지 않는다. 다음 단계에서 상담 id로 다룬다.
   */
  const data = appData([], [consultation({ id: "c-외톨이" })]);
  assert.deepEqual(planRetentionScrub(data, "c-외톨이", ELIGIBLE_AT), {
    ok: false,
    reason: "order-not-found",
  });
});

/* ── 계획은 저장소를 바꾸지 않는다 ─────────────────── */

test("계획을 세워도 저장소는 그대로다", () => {
  const consultOrder = order({ id: "c-1", product: "consultation" });
  const item = consultation();
  const data = appData([consultOrder], [item]);
  const snapshot = JSON.stringify(data);

  const result = planRetentionScrub(data, "c-1", ELIGIBLE_AT);
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(data), snapshot);
  // 지울 값이 아직 그대로 있다.
  assert.equal(data.orders[0].details.name, "홍길동");
  assert.equal(data.consultations[0].purpose, "재물·금전 / 직업·사업 고민");
});

test("계획이 가리키는 주문·상담은 저장소 안의 그 객체다", () => {
  // 반영하는 쪽이 그 자리에서 바꿀 수 있어야 한다(사본이면 저장에 반영되지 않는다).
  const consultOrder = order({ id: "c-1", product: "consultation" });
  const item = consultation();
  const data = appData([consultOrder], [item]);
  const result = planRetentionScrub(data, "c-1", ELIGIBLE_AT);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.plan.order, data.orders[0]);
  assert.equal(result.plan.consultation, data.consultations[0]);
});

test("이웃한 다른 주문·상담은 계획에 들어오지 않는다", () => {
  const target = order({ id: "o-1" });
  const other = order({ id: "o-2" });
  const otherConsult = consultation({ id: "c-9" });
  const data = appData([target, other], [otherConsult]);
  const result = planRetentionScrub(data, "o-1", ELIGIBLE_AT);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.plan.order.id, "o-1");
  assert.equal(result.plan.consultation, null);
});

/* ── 완료 증빙은 판정 근거라 계획에서도 유지된다 ──── */

test("완료 증빙은 계획의 details에 들어가지 않고 본체에 남는다", () => {
  const data = appData([order()]);
  const result = planRetentionScrub(data, "o-1", ELIGIBLE_AT);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  // details는 allowlist 결과뿐이고 증빙은 본체 필드로 그대로 있다.
  assert.equal("deliveredAt" in result.plan.orderDetails, false);
  assert.equal(result.plan.order.deliveredAt, DELIVERED);
});

test("이미 정리한 주문도 같은 계획이 다시 나온다", () => {
  // 계획 단계는 멱등이다. 최초값 보존은 반영하는 쪽(COALESCE)이 맡는다.
  const done = order({
    details: { ...KEPT },
    retentionScrubbedAt: "2026-09-01T00:00:00.000Z",
  });
  const result = planRetentionScrub(appData([done]), "o-1", "2027-01-01T00:00:00.000Z");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.plan.orderDetails, KEPT);
});
