/**
 * 보관 만료 후보 찾기 테스트 (Privacy-Retention-Discovery-1).
 *
 * 실행: node --test src/lib/server/retentionDiscovery.test.ts
 *
 * 저장소를 넘겨받는 구조라 DB가 필요 없다. 이 테스트는 아무것도 저장하지 않고
 * 아무것도 지우지 않는다. 후보를 고르는 규칙만 본다.
 *
 * store.ts가 이 규칙에 무엇을 넘기는지는 retentionDiscoverySource.test.ts가 본다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  findRetentionCandidates,
  type DiscoveryOrderRow,
  type RetentionDiscoveryInput,
} from "./retentionDiscovery.ts";
import type { Consultation } from "@/lib/types/app";

const DONE = "2025-09-01T00:00:00.000Z";
/** 위 시각의 만료 시점. 달력 기준 +1년. */
const ELIGIBLE_AT = "2026-09-01T00:00:00.000Z";

function row(overrides: Partial<DiscoveryOrderRow> = {}): DiscoveryOrderRow {
  return { id: "o-1", product: "story", deliveredAt: DONE, ...overrides };
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
    amount: 120000,
    details: { name: "홍길동", phone: "010-1234-5678", content: "고민" },
    createdAt: "2025-08-01T00:00:00.000Z",
    completedAt: DONE,
    ...overrides,
  };
}

/** 짝 주문이 어디에도 없는 기본 상태. */
function input(overrides: Partial<RetentionDiscoveryInput> = {}): RetentionDiscoveryInput {
  return {
    orders: [],
    appStoreOrderIds: new Set<string>(),
    consultations: [],
    sqlOrderIds: new Set<string>(),
    ...overrides,
  };
}

/* ── 인생곡 주문 후보 ───────────────────────────────── */

test("보관 기간이 끝난 인생곡 주문은 후보가 된다", () => {
  for (const product of ["story", "saju-song", "premium"] as const) {
    const found = findRetentionCandidates(
      input({ orders: [row({ id: `o-${product}`, product })] }),
      ELIGIBLE_AT,
    );
    assert.deepEqual(found, [{ kind: "order", id: `o-${product}` }], product);
  }
});

test("아직 1년이 되지 않은 주문은 후보가 아니다", () => {
  const justBefore = new Date(Date.parse(ELIGIBLE_AT) - 1).toISOString();
  assert.deepEqual(findRetentionCandidates(input({ orders: [row()] }), justBefore), []);
});

test("전달 기록이 없거나 읽을 수 없으면 후보가 아니다", () => {
  for (const deliveredAt of [null, undefined, "", "   ", "언젠가", "2026-13-45T00:00:00Z", "0000"]) {
    assert.deepEqual(
      findRetentionCandidates(
        input({ orders: [row({ deliveredAt })] }),
        "2030-01-01T00:00:00.000Z",
      ),
      [],
      JSON.stringify(deliveredAt),
    );
  }
});

test("현재 시각을 읽을 수 없으면 후보가 하나도 없다", () => {
  const found = findRetentionCandidates(
    input({ orders: [row()], consultations: [consultation()] }),
    "지금",
  );
  assert.deepEqual(found, []);
});

test("정리 대상이 아닌 상품은 후보가 아니다", () => {
  const odd = { id: "o-9", product: "gift" as never, deliveredAt: DONE };
  assert.deepEqual(findRetentionCandidates(input({ orders: [odd] }), ELIGIBLE_AT), []);
});

/* ── 이미 처리된 건 ────────────────────────────────── */

test("이미 정리한 주문은 후보가 아니다", () => {
  const done = row({ retentionScrubbedAt: "2026-09-02T00:00:00.000Z" });
  assert.deepEqual(findRetentionCandidates(input({ orders: [done] }), ELIGIBLE_AT), []);
});

test("정리한 시각을 만료 판정에 쓰지 않는다", () => {
  /*
   * retentionScrubbedAt은 "지운 시각"이지 "서비스가 끝난 시각"이 아니다.
   * 전달 기록이 없는 주문에 그 값만 있어도 후보가 되면 안 된다.
   */
  const odd = row({ deliveredAt: null, retentionScrubbedAt: "2000-01-01T00:00:00.000Z" });
  assert.deepEqual(findRetentionCandidates(input({ orders: [odd] }), "2030-01-01T00:00:00.000Z"), []);
});

/* ── 상담 주문은 completedAt을 본다 ────────────────── */

test("상담 주문은 전달 기록이 있어도 완료 기록이 없으면 후보가 아니다", () => {
  const notDone = consultation();
  delete notDone.completedAt;
  const found = findRetentionCandidates(
    input({
      // 주문에는 아주 오래된 전달 기록이 있다. 그래도 기준이 아니다.
      orders: [row({ id: "c-1", product: "consultation", deliveredAt: "2000-01-01T00:00:00.000Z" })],
      appStoreOrderIds: new Set(["c-1"]),
      consultations: [notDone],
    }),
    ELIGIBLE_AT,
  );
  assert.deepEqual(found, []);
});

test("상담 주문은 상담의 완료 기록으로 후보가 된다", () => {
  const found = findRetentionCandidates(
    input({
      // 주문에는 전달 기록이 아예 없다. 상담 쪽 기록만으로 판단한다.
      orders: [row({ id: "c-1", product: "consultation", deliveredAt: null })],
      appStoreOrderIds: new Set(["c-1"]),
      consultations: [consultation()],
    }),
    ELIGIBLE_AT,
  );
  assert.deepEqual(found, [{ kind: "order", id: "c-1" }]);
});

test("짝 상담을 찾지 못한 상담 주문은 후보가 아니다", () => {
  // 기산점을 읽을 수 없다. 주문의 전달 기록으로 대신하지 않는다.
  const found = findRetentionCandidates(
    input({
      orders: [row({ id: "c-없음", product: "consultation", deliveredAt: "2000-01-01T00:00:00.000Z" })],
      appStoreOrderIds: new Set(["c-없음"]),
    }),
    ELIGIBLE_AT,
  );
  assert.deepEqual(found, []);
});

test("아직 끝나지 않은 상담 주문은 후보가 아니다", () => {
  const justBefore = new Date(Date.parse(ELIGIBLE_AT) - 1).toISOString();
  const found = findRetentionCandidates(
    input({
      orders: [row({ id: "c-1", product: "consultation", deliveredAt: null })],
      appStoreOrderIds: new Set(["c-1"]),
      consultations: [consultation()],
    }),
    justBefore,
  );
  assert.deepEqual(found, []);
});

/* ── orphan 상담 후보 ──────────────────────────────── */

test("짝 없는 상담은 orphan 후보가 된다", () => {
  const found = findRetentionCandidates(input({ consultations: [consultation()] }), ELIGIBLE_AT);
  assert.deepEqual(found, [{ kind: "orphan-consultation", id: "c-1" }]);
});

test("app_store에 짝 주문이 있으면 orphan 후보가 아니다", () => {
  const found = findRetentionCandidates(
    input({ consultations: [consultation()], appStoreOrderIds: new Set(["c-1"]) }),
    ELIGIBLE_AT,
  );
  assert.deepEqual(found, []);
});

test("orders 테이블에 짝 주문이 있으면 orphan 후보가 아니다", () => {
  const found = findRetentionCandidates(
    input({ consultations: [consultation()], sqlOrderIds: new Set(["c-1"]) }),
    ELIGIBLE_AT,
  );
  assert.deepEqual(found, []);
});

test("주문 테이블을 확인하지 못하면 orphan 후보를 내지 않는다", () => {
  // 짝이 없다고 단정할 수 없다(fail-closed).
  const found = findRetentionCandidates(
    input({ consultations: [consultation()], sqlOrderIds: null }),
    ELIGIBLE_AT,
  );
  assert.deepEqual(found, []);
});

test("확인 실패는 orphan만 막고 주문 후보는 그대로다", () => {
  // 주문 후보는 짝 확인과 상관이 없다. 읽어 온 행이 있으면 그대로 판단한다.
  const found = findRetentionCandidates(
    input({ orders: [row()], consultations: [consultation()], sqlOrderIds: null }),
    ELIGIBLE_AT,
  );
  assert.deepEqual(found, [{ kind: "order", id: "o-1" }]);
});

test("완료 기록이 없거나 읽을 수 없는 상담은 orphan 후보가 아니다", () => {
  for (const completedAt of [undefined, "", "   ", "언젠가", "2026-13-45T00:00:00Z"]) {
    const item = consultation({ completedAt });
    if (completedAt === undefined) delete item.completedAt;
    assert.deepEqual(
      findRetentionCandidates(input({ consultations: [item] }), "2030-01-01T00:00:00.000Z"),
      [],
      JSON.stringify(completedAt),
    );
  }
});

test("아직 끝나지 않은 상담은 orphan 후보가 아니다", () => {
  const justBefore = new Date(Date.parse(ELIGIBLE_AT) - 1).toISOString();
  assert.deepEqual(findRetentionCandidates(input({ consultations: [consultation()] }), justBefore), []);
});

test("이미 정리한 상담은 orphan 후보가 아니다", () => {
  const done = consultation({ retentionScrubbedAt: "2026-09-02T00:00:00.000Z" });
  assert.deepEqual(findRetentionCandidates(input({ consultations: [done] }), ELIGIBLE_AT), []);
});

/* ── id 접두사와 무관하다 ──────────────────────────── */

test("후보 판정은 id 접두사와 무관하다", () => {
  /*
   * "c-"로 시작해도 product가 story면 전달 기록을 본다.
   * "o-"로 시작해도 product가 consultation이면 상담의 완료 기록을 본다.
   */
  const songWithConsultId = findRetentionCandidates(
    input({ orders: [row({ id: "c-9", product: "story" })] }),
    ELIGIBLE_AT,
  );
  assert.deepEqual(songWithConsultId, [{ kind: "order", id: "c-9" }]);

  const consultWithSongId = findRetentionCandidates(
    input({
      orders: [row({ id: "o-9", product: "consultation", deliveredAt: null })],
      appStoreOrderIds: new Set(["o-9"]),
      consultations: [consultation({ id: "o-9" })],
    }),
    ELIGIBLE_AT,
  );
  assert.deepEqual(consultWithSongId, [{ kind: "order", id: "o-9" }]);

  // 접두사 없는 legacy 상담도 짝이 없으면 orphan 후보다.
  const legacy = findRetentionCandidates(
    input({ consultations: [consultation({ id: "legacy-42" })] }),
    ELIGIBLE_AT,
  );
  assert.deepEqual(legacy, [{ kind: "orphan-consultation", id: "legacy-42" }]);
});

/* ── 결과에 담기는 것 ──────────────────────────────── */

test("결과에는 kind와 id만 담긴다", () => {
  const found = findRetentionCandidates(
    input({
      orders: [row()],
      consultations: [consultation()],
    }),
    ELIGIBLE_AT,
  );
  assert.equal(found.length, 2);
  for (const item of found) {
    assert.deepEqual(Object.keys(item).sort(), ["id", "kind"]);
  }
});

test("결과에 개인정보나 userId가 새어 나오지 않는다", () => {
  const found = findRetentionCandidates(
    input({ orders: [row()], consultations: [consultation()] }),
    ELIGIBLE_AT,
  );
  const dumped = JSON.stringify(found);
  for (const secret of ["홍길동", "010-1234-5678", "고민", "u-1", "유비 선생", "재물"]) {
    assert.equal(dumped.includes(secret), false, secret);
  }
});

test("같은 건이 두 번 담기지 않는다", () => {
  // 같은 주문 행이 겹쳐 들어와도 한 번만 센다.
  const found = findRetentionCandidates(
    input({ orders: [row(), row(), row({ id: "o-2" })] }),
    ELIGIBLE_AT,
  );
  assert.deepEqual(found, [
    { kind: "order", id: "o-1" },
    { kind: "order", id: "o-2" },
  ]);
  assert.equal(new Set(found.map((item) => `${item.kind}:${item.id}`)).size, found.length);
});

test("한 상담이 주문 후보와 orphan 후보로 동시에 나오지 않는다", () => {
  // 짝 주문이 있으면 주문 후보로만, 없으면 orphan 후보로만 나온다.
  const paired = findRetentionCandidates(
    input({
      orders: [row({ id: "c-1", product: "consultation", deliveredAt: null })],
      appStoreOrderIds: new Set(["c-1"]),
      consultations: [consultation()],
    }),
    ELIGIBLE_AT,
  );
  assert.deepEqual(paired, [{ kind: "order", id: "c-1" }]);
});

/* ── 아무것도 바꾸지 않는다 ────────────────────────── */

test("후보를 골라도 넘긴 값은 그대로다", () => {
  const orders = [row(), row({ id: "o-2", deliveredAt: null })];
  const consultations = [consultation(), consultation({ id: "c-2" })];
  const source = input({ orders, consultations });
  const snapshot = JSON.stringify({ orders, consultations });

  findRetentionCandidates(source, ELIGIBLE_AT);

  assert.equal(JSON.stringify({ orders, consultations }), snapshot);
  assert.equal(consultations[0].details.name, "홍길동");
  assert.equal(consultations[0].purpose, "재물·금전");
  assert.equal(orders.length, 2);
});
