/**
 * 보관 만료 scrub 테스트 (Privacy-Retention-Scrub-1).
 *
 * 실행: node --test src/lib/server/retentionScrub.test.ts
 *
 * 순수 함수라 DB도 시각도 필요 없다. 이 테스트는 아무것도 지우지 않는다.
 * "무엇이 남고 무엇이 빠지는가"만 본다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  RETENTION_KEPT_DETAIL_KEYS,
  isRetentionKeptDetailKey,
  pickRetentionDetails,
  scrubConsultationForRetention,
  scrubOrderForRetention,
  stripPaymentSnapshotDetails,
} from "./retentionScrub.ts";
import type { Consultation, Order } from "@/lib/types/app";

/** 보관 만료 뒤에 빠져야 하는 details 키. 값은 전부 사람이 적은 내용이다. */
const REMOVED_DETAILS: Record<string, string> = {
  // 직접 식별정보
  name: "홍길동",
  phone: "010-1234-5678",
  // 사주 정보
  birth: "1990-01-01",
  birthTime: "9:30",
  unknownTime: "1",
  calendar: "음력",
  gender: "여성",
  bloodType: "A형",
  // 상대방(궁합) 정보. 이 사람의 정보는 다른 어디에도 사본이 없다.
  counterpartName: "김철수",
  counterpartBirth: "1988-05-05",
  counterpartBirthTime: "14:00",
  counterpartUnknownTime: "1",
  // 사연·이야기
  free: "하고 싶은 말",
  memory: "가장 기억에 남는 순간",
  message: "꼭 전하고 싶은 말",
  image: "기억하고 싶은 모습",
  story: "당신의 이야기",
  content: "가장 궁금한 내용",
  // 노래 취향
  moods: "따뜻한 / 잔잔한",
  customMood: "직접 적은 분위기",
  songs: "가수 A - 노래 1\n가수 B - 노래 2",
  // 상담 목적
  purpose: "재물·금전 / 직업·사업 고민",
  // 주인공 표시 문구. "기타"를 고르면 자유 입력이 그대로 들어온다.
  protagonist: "옆집 친구 영희",
  // 제3자 회원 식별자
  referrerId: "u-referrer-1",
  // 신청 단계 동의 플래그. 실제 증빙은 Order.refundConsent다.
  applyConsent: "1",
};

/** 보관 만료 뒤에도 남아야 하는 details 키. 거래·정산 구조정보뿐이다. */
const KEPT_DETAILS: Record<string, string> = {
  protagonistId: "parents",
  subject: "self",
  teacher: "유비 선생",
  datetime: "8월 12일(화) 오전 10:00",
  scheduledDate: "2026-08-12",
  method: "카카오톡 상담",
  option: "상담 기록 요약 리포트",
  optionIds: "ai-mv,photo-mv",
  options: "내 얼굴 AI 뮤직비디오, 추억사진 영상 제작",
  videoStyle: "AI 실사 영상풍",
  report: "1",
  extraPerson: "1",
  couponId: "cp-1",
  couponTitle: "첫 신청 무료 쿠폰",
  couponFree: "1",
  referralCode: "IS12AB34",
  referralDiscount: "10000",
  referralType: "admin",
  referralPercent: "20",
  usePoints: "1",
  pointsUsed: "10000",
};

/** 클라이언트가 임의로 섞어 보낼 수 있는 키. 목록에 없으므로 전부 빠진다. */
const UNKNOWN_DETAILS: Record<string, string> = {
  nickname: "별명",
  memo2: "임의로 늘어난 입력칸",
  counterpartMemo: "상대방에 대한 메모",
  __proto__polluted: "x",
  "": "빈 키",
};

const ALL_DETAILS: Record<string, string> = {
  ...REMOVED_DETAILS,
  ...KEPT_DETAILS,
  ...UNKNOWN_DETAILS,
};

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: "o-1",
    userId: "u-1",
    product: "story",
    title: "이야기로 만드는 인생곡",
    status: "완료",
    amount: 140000,
    baseAmount: 150000,
    payment: "신용/체크카드",
    details: { ...ALL_DETAILS },
    createdAt: "2025-08-01T00:00:00.000Z",
    deliveredAt: "2025-09-01T00:00:00.000Z",
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
    option: "상담 기록 요약 리포트",
    status: "상담 완료",
    amount: 120000,
    details: { ...ALL_DETAILS },
    createdAt: "2025-08-01T00:00:00.000Z",
    completedAt: "2025-08-12T02:00:00.000Z",
    ...overrides,
  };
}

/* ── allowlist 자체 ─────────────────────────────────── */

test("남기는 목록과 지우는 목록이 겹치지 않는다", () => {
  for (const key of Object.keys(REMOVED_DETAILS)) {
    assert.equal(isRetentionKeptDetailKey(key), false, key);
  }
  for (const key of Object.keys(KEPT_DETAILS)) {
    assert.equal(isRetentionKeptDetailKey(key), true, key);
  }
});

test("남기는 목록에 중복이 없다", () => {
  const keys = [...RETENTION_KEPT_DETAIL_KEYS];
  assert.equal(new Set(keys).size, keys.length);
});

/* ── details 정리 ───────────────────────────────────── */

test("지워야 하는 키가 하나도 남지 않는다", () => {
  const kept = pickRetentionDetails(ALL_DETAILS);
  for (const key of Object.keys(REMOVED_DETAILS)) {
    assert.equal(key in kept, false, key);
  }
});

test("남겨야 하는 키는 값까지 그대로 남는다", () => {
  const kept = pickRetentionDetails(ALL_DETAILS);
  for (const [key, value] of Object.entries(KEPT_DETAILS)) {
    assert.equal(kept[key], value, key);
  }
});

test("모르는 키는 남기지 않는다", () => {
  // denylist였다면 입력칸이 하나 늘 때마다 개인정보가 새어 남는다.
  const kept = pickRetentionDetails(ALL_DETAILS);
  for (const key of Object.keys(UNKNOWN_DETAILS)) {
    assert.equal(key in kept, false, key);
  }
  assert.deepEqual(Object.keys(kept).sort(), Object.keys(KEPT_DETAILS).sort());
});

test("자유 입력 주인공 문구는 남기지 않는다", () => {
  // "기타"를 고르면 사람 이름이 그대로 들어올 수 있다. 코드값만 남긴다.
  const kept = pickRetentionDetails({ protagonistId: "other", protagonist: "옆집 친구 영희" });
  assert.deepEqual(kept, { protagonistId: "other" });
});

test("상담 목적은 details에서도 빠진다", () => {
  const kept = pickRetentionDetails({ purpose: "재물·금전", teacher: "유비 선생" });
  assert.deepEqual(kept, { teacher: "유비 선생" });
});

test("상대방 정보는 모두 빠진다", () => {
  const kept = pickRetentionDetails({
    counterpartName: "김철수",
    counterpartBirth: "1988-05-05",
    counterpartBirthTime: "14:00",
    counterpartUnknownTime: "1",
    extraPerson: "1",
  });
  // 추가 인원을 선택했다는 사실(extraPerson)만 남고 그 사람의 정보는 남지 않는다.
  assert.deepEqual(kept, { extraPerson: "1" });
});

test("적립금 사용 기록은 남는다", () => {
  // 환불 적립금 복원 판정이 이 값을 근거로 쓴다(pointsRestoreDecision).
  const kept = pickRetentionDetails({ usePoints: "1", pointsUsed: "10000", name: "홍길동" });
  assert.deepEqual(kept, { usePoints: "1", pointsUsed: "10000" });
});

test("추천인 할인 근거는 남는다", () => {
  // 관리자 화면이 admin 코드 집계에 쓴다. referrerId(제3자 회원 id)는 남기지 않는다.
  const kept = pickRetentionDetails({
    referralCode: "IS12AB34",
    referralDiscount: "10000",
    referralType: "admin",
    referralPercent: "20",
    referrerId: "u-referrer-1",
  });
  assert.deepEqual(kept, {
    referralCode: "IS12AB34",
    referralDiscount: "10000",
    referralType: "admin",
    referralPercent: "20",
  });
});

/* ── 예전 자료 / 빈 값 ──────────────────────────────── */

test("details가 비어 있거나 없어도 빈 객체로 끝난다", () => {
  assert.deepEqual(pickRetentionDetails({}), {});
  assert.deepEqual(pickRetentionDetails(undefined), {});
  assert.deepEqual(pickRetentionDetails(null), {});
});

test("지울 것만 있는 details는 빈 객체가 된다", () => {
  assert.deepEqual(pickRetentionDetails({ name: "홍길동", content: "고민" }), {});
});

test("빈 문자열 값도 목록에 있으면 그대로 남긴다", () => {
  // 값이 비었다는 사실 자체가 기록이다. 없는 키와 구분해 둔다.
  assert.deepEqual(pickRetentionDetails({ videoStyle: "", name: "" }), { videoStyle: "" });
});

/* ── 주문 ───────────────────────────────────────────── */

test("주문은 details만 바뀌고 거래정보는 그대로다", () => {
  const before = order();
  const after = scrubOrderForRetention(before);

  assert.equal(after.id, before.id);
  assert.equal(after.userId, before.userId);
  assert.equal(after.product, before.product);
  assert.equal(after.title, before.title);
  assert.equal(after.status, before.status);
  assert.equal(after.amount, before.amount);
  assert.equal(after.baseAmount, before.baseAmount);
  assert.equal(after.payment, before.payment);
  assert.equal(after.createdAt, before.createdAt);
});

test("주문의 완료 증빙은 지우지 않는다", () => {
  const after = scrubOrderForRetention(order());
  // 이 값이 없어지면 같은 건을 다시 판정할 수 없게 된다.
  assert.equal(after.deliveredAt, "2025-09-01T00:00:00.000Z");
});

test("주문 details에 개인정보가 남지 않는다", () => {
  const after = scrubOrderForRetention(order());
  for (const key of Object.keys(REMOVED_DETAILS)) {
    assert.equal(key in after.details, false, key);
  }
  assert.deepEqual(after.details, KEPT_DETAILS);
});

test("details가 비어 있는 예전 주문도 그대로 처리된다", () => {
  const after = scrubOrderForRetention(order({ details: {} }));
  assert.deepEqual(after.details, {});
});

test("증빙이 없는 예전 주문도 키를 만들어 내지 않는다", () => {
  const legacy = order({ details: { name: "홍길동" } });
  delete legacy.deliveredAt;
  delete legacy.baseAmount;
  const after = scrubOrderForRetention(legacy);
  assert.equal("deliveredAt" in after, false);
  assert.equal("baseAmount" in after, false);
});

/* ── 상담 ───────────────────────────────────────────── */

test("상담 본체의 purpose는 키까지 사라진다", () => {
  const after = scrubConsultationForRetention(consultation());
  // 빈 문자열이나 "삭제됨" 같은 값을 넣지 않는다. 기록 없음으로 남긴다.
  assert.equal("purpose" in after, false);
  assert.equal(after.purpose, undefined);
});

test("상담 일정·구성과 거래정보는 그대로다", () => {
  const before = consultation();
  const after = scrubConsultationForRetention(before);

  assert.equal(after.id, before.id);
  assert.equal(after.userId, before.userId);
  assert.equal(after.teacher, before.teacher);
  assert.equal(after.datetime, before.datetime);
  assert.equal(after.method, before.method);
  assert.equal(after.option, before.option);
  assert.equal(after.status, before.status);
  assert.equal(after.amount, before.amount);
  assert.equal(after.createdAt, before.createdAt);
});

test("상담의 완료 증빙은 지우지 않는다", () => {
  const after = scrubConsultationForRetention(consultation());
  assert.equal(after.completedAt, "2025-08-12T02:00:00.000Z");
});

test("상담 details도 주문과 같은 목록으로 정리된다", () => {
  const after = scrubConsultationForRetention(consultation());
  assert.deepEqual(after.details, KEPT_DETAILS);
  assert.equal("content" in after.details, false);
  assert.equal("counterpartName" in after.details, false);
});

test("purpose가 없던 상담도 그대로 처리된다", () => {
  const legacy = consultation();
  delete legacy.purpose;
  const after = scrubConsultationForRetention(legacy);
  assert.equal("purpose" in after, false);
});

test("완료 증빙이 없는 예전 상담도 키를 만들어 내지 않는다", () => {
  const legacy = consultation({ details: {} });
  delete legacy.completedAt;
  const after = scrubConsultationForRetention(legacy);
  assert.equal("completedAt" in after, false);
  assert.deepEqual(after.details, {});
});

/* ── 원본을 바꾸지 않는다 ───────────────────────────── */

test("주문 scrub은 원본을 바꾸지 않는다", () => {
  const before = order();
  const snapshot = JSON.stringify(before);
  const after = scrubOrderForRetention(before);
  assert.equal(JSON.stringify(before), snapshot);
  // details도 같은 객체를 공유하지 않는다.
  assert.notEqual(after.details, before.details);
  assert.equal(before.details.name, "홍길동");
});

test("상담 scrub은 원본을 바꾸지 않는다", () => {
  const before = consultation();
  const snapshot = JSON.stringify(before);
  const after = scrubConsultationForRetention(before);
  assert.equal(JSON.stringify(before), snapshot);
  assert.notEqual(after.details, before.details);
  assert.equal(before.purpose, "재물·금전 / 직업·사업 고민");
});

test("details 정리는 인자를 바꾸지 않는다", () => {
  const source = { ...ALL_DETAILS };
  const snapshot = JSON.stringify(source);
  pickRetentionDetails(source);
  assert.equal(JSON.stringify(source), snapshot);
});

/* ── 결제 스냅샷 helper ─────────────────────────────── */

test("스냅샷에서 신청 내용 사본만 빠진다", () => {
  const snapshot = {
    version: 1,
    kind: "order",
    userId: "u-1",
    goodsName: "이야기로 만드는 인생곡",
    baseAmount: 150000,
    amount: 140000,
    request: { product: "story", title: "인생곡", options: ["ai-mv"], payment: "신용/체크카드" },
    discount: { couponId: null, referralCode: "IS12AB34", usePoints: 10000 },
    details: { name: "홍길동", content: "고민" },
    preparedAt: "2025-08-01T00:00:00.000Z",
  };
  const source = JSON.stringify(snapshot);
  const after = stripPaymentSnapshotDetails(snapshot);

  assert.notEqual(after, null);
  assert.equal("details" in (after as Record<string, unknown>), false);
  // 금액 재검증과 귀속에 쓰는 값은 그대로 남는다.
  assert.deepEqual(after, {
    version: 1,
    kind: "order",
    userId: "u-1",
    goodsName: "이야기로 만드는 인생곡",
    baseAmount: 150000,
    amount: 140000,
    request: snapshot.request,
    discount: snapshot.discount,
    preparedAt: "2025-08-01T00:00:00.000Z",
  });
  // 원본은 그대로다.
  assert.equal(JSON.stringify(snapshot), source);
});

test("스냅샷이 없으면 빈 객체를 지어내지 않는다", () => {
  assert.equal(stripPaymentSnapshotDetails(null), null);
  assert.equal(stripPaymentSnapshotDetails(undefined), null);
});

test("details가 없던 스냅샷도 그대로 돌려준다", () => {
  assert.deepEqual(stripPaymentSnapshotDetails({ version: 1, userId: "u-1" }), {
    version: 1,
    userId: "u-1",
  });
});
