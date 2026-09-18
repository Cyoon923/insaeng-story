/**
 * 보관 만료 판정 테스트 (Privacy-Retention-Eligibility-1).
 *
 * 실행: node --test src/lib/server/retentionEligibility.test.ts
 *
 * 순수 함수라 DB도 시각도 필요 없다. 현재 시각을 인자로 넣어 경계를 정확히 고정한다.
 * 이 테스트는 삭제를 실행하지 않는다. 판정만 본다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  decideConsultationRetention,
  decideOrderRetention,
  decideRetentionEligibility,
  retentionEligibleAt,
} from "./retentionEligibility.ts";
import type { Consultation, Order, OrderProduct, OrderStatus } from "@/lib/types/app";

const DELIVERED = "2026-09-18T00:00:00.000Z";
/** 위 시각의 만료 시점. 달력 기준 +1년. */
const ELIGIBLE_AT = "2027-09-18T00:00:00.000Z";

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: "o-1",
    userId: "u-1",
    product: "story",
    title: "이야기로 만드는 인생곡",
    status: "완성/전달",
    amount: 150000,
    payment: "신용/체크카드",
    details: {},
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function consultation(overrides: Partial<Consultation> = {}): Consultation {
  return {
    id: "c-1",
    userId: "u-1",
    teacher: "유비 선생",
    datetime: "8월 12일(화) 오전 10:00",
    purpose: "재물·금전",
    method: "카카오톡 상담",
    option: "없음",
    status: "상담 완료",
    amount: 100000,
    details: {},
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

/* ── 경계 ───────────────────────────────────────────── */

test("1년이 되기 1밀리초 전은 아직 대상이 아니다", () => {
  const now = new Date(Date.parse(ELIGIBLE_AT) - 1).toISOString();
  const result = decideRetentionEligibility(DELIVERED, now);
  assert.equal(result.kind, "not-yet");
  if (result.kind !== "not-yet") return;
  assert.equal(result.eligibleAt, ELIGIBLE_AT);
});

test("하루 전도 아직 대상이 아니다", () => {
  assert.equal(
    decideRetentionEligibility(DELIVERED, "2027-09-17T00:00:00.000Z").kind,
    "not-yet",
  );
});

test("정확히 1년이 된 순간부터 대상이다", () => {
  const result = decideRetentionEligibility(DELIVERED, ELIGIBLE_AT);
  assert.equal(result.kind, "eligible");
  if (result.kind !== "eligible") return;
  assert.equal(result.evidenceAt, DELIVERED);
  assert.equal(result.eligibleAt, ELIGIBLE_AT);
});

test("1년이 지난 뒤에도 대상이다", () => {
  assert.equal(decideRetentionEligibility(DELIVERED, "2028-01-01T00:00:00.000Z").kind, "eligible");
});

/* ── 윤년 경계 ──────────────────────────────────────── */

test("윤년 2월 29일 증빙은 다음 해 2월 28일 같은 시각부터 대상이다", () => {
  /*
   * 2024-02-29의 1년 뒤에 해당하는 날짜가 2025년에는 없다.
   * 그 달의 마지막 날인 2월 28일로 맞춘다. 3월로 넘기지 않는다.
   * 시·분·초는 증빙과 같다.
   */
  const leap = "2024-02-29T10:00:00.000Z";
  assert.equal(retentionEligibleAt(leap), "2025-02-28T10:00:00.000Z");

  // 그 시각 1밀리초 전은 아직 아니다.
  const justBefore = new Date(Date.parse("2025-02-28T10:00:00.000Z") - 1).toISOString();
  const before = decideRetentionEligibility(leap, justBefore);
  assert.equal(before.kind, "not-yet");
  if (before.kind === "not-yet") {
    assert.equal(before.eligibleAt, "2025-02-28T10:00:00.000Z");
  }

  // 정확히 그 시각부터 대상이다.
  const at = decideRetentionEligibility(leap, "2025-02-28T10:00:00.000Z");
  assert.equal(at.kind, "eligible");
  if (at.kind === "eligible") {
    assert.equal(at.evidenceAt, leap);
    assert.equal(at.eligibleAt, "2025-02-28T10:00:00.000Z");
  }

  // 이후에도 대상이다.
  assert.equal(decideRetentionEligibility(leap, "2025-03-01T00:00:00.000Z").kind, "eligible");
  assert.equal(decideRetentionEligibility(leap, "2026-01-01T00:00:00.000Z").kind, "eligible");
});

test("2월 29일 자정 증빙도 같은 규칙으로 2월 28일 자정이 된다", () => {
  assert.equal(retentionEligibleAt("2024-02-29T00:00:00.000Z"), "2025-02-28T00:00:00.000Z");
});

test("윤년이 아닌 날짜는 같은 월·일이 그대로 쓰인다", () => {
  // 다음 해에 같은 월·일이 있으면 당기지 않는다.
  assert.equal(retentionEligibleAt("2024-02-28T10:00:00.000Z"), "2025-02-28T10:00:00.000Z");
  assert.equal(retentionEligibleAt("2026-09-18T13:45:30.123Z"), "2027-09-18T13:45:30.123Z");
  assert.equal(retentionEligibleAt("2026-12-31T23:59:59.999Z"), "2027-12-31T23:59:59.999Z");
});

test("다음 해가 윤년이어도 2월 28일은 28일 그대로다", () => {
  // 2024는 윤년이지만 없는 날짜가 아니므로 밀지도 당기지도 않는다.
  assert.equal(retentionEligibleAt("2023-02-28T10:00:00.000Z"), "2024-02-28T10:00:00.000Z");
});

test("윤년을 지나는 기간도 달력 기준으로 센다", () => {
  // 2023-03-01 → 2024-03-01. 사이에 2024-02-29가 끼어 366일이지만 달력으로는 1년이다.
  const before = "2023-03-01T00:00:00.000Z";
  assert.equal(retentionEligibleAt(before), "2024-03-01T00:00:00.000Z");
  assert.equal(decideRetentionEligibility(before, "2024-02-29T00:00:00.000Z").kind, "not-yet");
  assert.equal(decideRetentionEligibility(before, "2024-03-01T00:00:00.000Z").kind, "eligible");
});

/* ── 증빙 없음 / 잘못된 값 ──────────────────────────── */

test("증빙이 없으면 대상이 아니다", () => {
  for (const value of [undefined, null, "", "   "]) {
    assert.deepEqual(
      decideRetentionEligibility(value, "2030-01-01T00:00:00.000Z"),
      { kind: "missing-evidence" },
      JSON.stringify(value),
    );
  }
});

test("시각으로 읽을 수 없는 증빙은 대상이 아니다", () => {
  for (const value of ["언젠가", "2026-13-45T00:00:00Z", "not-a-date", "0000"]) {
    assert.deepEqual(
      decideRetentionEligibility(value, "2030-01-01T00:00:00.000Z"),
      { kind: "invalid-evidence" },
      value,
    );
  }
});

test("현재 시각을 읽을 수 없으면 아무것도 판정하지 않는다", () => {
  for (const now of ["", "   ", "지금", "not-a-date"]) {
    assert.deepEqual(
      decideRetentionEligibility(DELIVERED, now),
      { kind: "invalid-now" },
      JSON.stringify(now),
    );
  }
});

test("현재 시각이 잘못되면 증빙이 없어도 invalid-now로 답한다", () => {
  // 판정 자체가 불가능한 상태다. 다른 사유로 덮어 말하지 않는다.
  assert.deepEqual(decideRetentionEligibility(undefined, "언제"), { kind: "invalid-now" });
});

/* ── 미래 증빙 ──────────────────────────────────────── */

test("증빙이 미래 시각이면 아직 대상이 아니다", () => {
  const result = decideRetentionEligibility("2030-01-01T00:00:00.000Z", "2026-09-18T00:00:00.000Z");
  assert.equal(result.kind, "not-yet");
});

/* ── legacy: 상태만 완료인 건 ───────────────────────── */

test("상태가 완료여도 증빙이 없으면 자동 삭제 대상이 아니다", () => {
  const statuses: OrderStatus[] = ["완성/전달", "완료"];
  for (const status of statuses) {
    // 이 구조가 생기기 전의 주문. deliveredAt 키 자체가 없다.
    const legacy = order({ status });
    assert.deepEqual(
      decideOrderRetention(legacy, "2030-01-01T00:00:00.000Z"),
      { kind: "missing-evidence" },
      status,
    );
  }
  const legacyConsult = consultation({ status: "상담 완료" });
  assert.deepEqual(decideConsultationRetention(legacyConsult, "2030-01-01T00:00:00.000Z"), {
    kind: "missing-evidence",
  });
});

test("createdAt·status로 추정하지 않는다", () => {
  // 오래된 신청 기록과 끝난 상태가 있어도 증빙이 없으면 대상이 아니다.
  const legacyOrder = order({
    createdAt: "2020-01-01T00:00:00.000Z",
    status: "완료",
  });
  assert.deepEqual(decideOrderRetention(legacyOrder, "2030-01-01T00:00:00.000Z"), {
    kind: "missing-evidence",
  });

  const legacyConsult = consultation({
    createdAt: "2020-01-01T00:00:00.000Z",
    status: "상담 완료",
  });
  assert.deepEqual(decideConsultationRetention(legacyConsult, "2030-01-01T00:00:00.000Z"), {
    kind: "missing-evidence",
  });
});

/* ── 주문 / 상담 진입점 ─────────────────────────────── */

test("인생곡 세 상품 모두 deliveredAt 하나로 판정한다", () => {
  const products: OrderProduct[] = ["story", "saju-song", "premium"];
  for (const product of products) {
    const item = order({ product, deliveredAt: DELIVERED });
    assert.equal(decideOrderRetention(item, ELIGIBLE_AT).kind, "eligible", product);
    assert.equal(
      decideOrderRetention(item, "2027-09-17T00:00:00.000Z").kind,
      "not-yet",
      product,
    );
  }
});

test("상담은 completedAt으로 같은 경계를 쓴다", () => {
  const item = consultation({ completedAt: DELIVERED });
  const justBefore = new Date(Date.parse(ELIGIBLE_AT) - 1).toISOString();
  assert.equal(decideConsultationRetention(item, justBefore).kind, "not-yet");
  assert.equal(decideConsultationRetention(item, ELIGIBLE_AT).kind, "eligible");
  assert.equal(decideConsultationRetention(item, "2028-01-01T00:00:00.000Z").kind, "eligible");
});

/* ── 입력을 바꾸지 않는다 ───────────────────────────── */

test("판정은 주문·상담을 바꾸지 않는다", () => {
  const item = order({ deliveredAt: DELIVERED });
  const before = JSON.stringify(item);
  decideOrderRetention(item, ELIGIBLE_AT);
  assert.equal(JSON.stringify(item), before);

  const consult = consultation({ completedAt: DELIVERED });
  const consultBefore = JSON.stringify(consult);
  decideConsultationRetention(consult, ELIGIBLE_AT);
  assert.equal(JSON.stringify(consult), consultBefore);
});
