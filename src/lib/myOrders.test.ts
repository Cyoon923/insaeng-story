/**
 * MY 통합 구매 목록 규칙 테스트 (MY-Unified-Orders-1).
 *
 * 실행: node --test src/lib/myOrders.test.ts
 *
 * 순수 함수라 화면도 DB도 필요 없다. 여기서 보는 것은 하나다.
 * "같은 구매가 두 장으로 보이지 않으면서, 어느 것도 목록에서 사라지지 않는가."
 */
import assert from "node:assert/strict";
import test from "node:test";
import { buildMyOrderItems, filterMyOrderItems } from "./myOrders.ts";
import type { Consultation, Order } from "@/lib/types/app";

/** 결제일. 정렬을 보기 위해 날짜만 다르게 준다. */
function at(day: number): string {
  return `2026-09-${String(day).padStart(2, "0")}T00:00:00.000Z`;
}

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: "o-song-1",
    userId: "u-1",
    product: "story",
    title: "이야기로 만드는 인생곡",
    status: "제작중",
    amount: 150000,
    payment: "신용/체크카드",
    details: {},
    createdAt: at(10),
    ...overrides,
  };
}

/** 상담 결제로 함께 만들어지는 주문. 상담과 같은 id·시각을 쓴다. */
function consultOrder(overrides: Partial<Order> = {}): Order {
  return order({
    id: "c-1",
    product: "consultation",
    title: "1:1 사주상담",
    // 결제 귀속용이라 진행 상태가 "신청접수"로 고정되어 있다.
    status: "신청접수",
    amount: 100000,
    createdAt: at(12),
    ...overrides,
  });
}

function consultation(overrides: Partial<Consultation> = {}): Consultation {
  return {
    id: "c-1",
    userId: "u-1",
    teacher: "유비 선생",
    datetime: "8월 12일(화) 오전 10:00",
    purpose: "재물·금전",
    method: "전화 상담",
    option: "",
    status: "선생님과 1:1 상담",
    amount: 100000,
    details: {},
    createdAt: at(12),
    ...overrides,
  };
}

/* ── 인생곡 ─────────────────────────────────────────── */

test("인생곡 주문은 카드 1장이 된다", () => {
  const items = buildMyOrderItems([order()], []);
  assert.equal(items.length, 1);
  assert.deepEqual(
    { kind: items[0].kind, status: items[0].status, href: items[0].href, amount: items[0].amount },
    { kind: "song", status: "제작중", href: "/my/orders/o-song-1", amount: 150000 },
  );
  // 상담에만 있는 값은 만들지 않는다.
  assert.equal(items[0].teacher, undefined);
  assert.equal(items[0].datetime, undefined);
});

/* ── 상담 병합 ──────────────────────────────────────── */

test("같은 id의 상담 주문과 상담은 한 장으로 합쳐진다", () => {
  const items = buildMyOrderItems([consultOrder()], [consultation()]);
  // 두 배열을 그냥 합치면 두 장이 된다. 그렇게 되지 않는 것이 이 함수의 핵심이다.
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, "consultation");
  assert.equal(items[0].id, "c-1");
});

test("상담 카드는 상담의 진행 상태를 쓴다", () => {
  const items = buildMyOrderItems([consultOrder()], [consultation()]);
  // 결제 귀속 주문의 "신청접수"가 아니라 상담이 관리하는 상태여야 한다.
  assert.equal(items[0].status, "선생님과 1:1 상담");
  assert.notEqual(items[0].status, consultOrder().status);
});

test("상담 카드는 상담 상세로 연결된다", () => {
  const items = buildMyOrderItems([consultOrder()], [consultation()]);
  assert.equal(items[0].href, "/my/consultations/c-1");
});

test("상담 카드에 선생님과 예약 일시가 담긴다", () => {
  const items = buildMyOrderItems([consultOrder()], [consultation()]);
  assert.equal(items[0].teacher, "유비 선생");
  assert.equal(items[0].datetime, "8월 12일(화) 오전 10:00");
});

test("상담 금액은 짝이 되는 주문의 결제 금액을 쓴다", () => {
  // 할인으로 실제 결제액이 달라진 경우. 상담에 적힌 금액이 아니라 주문 금액이 맞다.
  const items = buildMyOrderItems(
    [consultOrder({ amount: 80000 })],
    [consultation({ amount: 100000 })],
  );
  assert.equal(items[0].amount, 80000);
});

/* ── 짝이 없는 상담 ─────────────────────────────────── */

test("짝이 되는 주문이 없는 상담도 목록에서 빠지지 않는다", () => {
  const orphan = consultation({ id: "c-orphan", teacher: "옛 선생", createdAt: at(5) });
  const items = buildMyOrderItems([order()], [orphan]);
  assert.equal(items.length, 2);
  const found = items.find((item) => item.id === "c-orphan");
  assert.equal(found?.kind, "consultation");
  assert.equal(found?.href, "/my/consultations/c-orphan");
  assert.equal(found?.status, "선생님과 1:1 상담");
  assert.equal(found?.amount, 100000);
});

test("주문과 짝이 된 상담은 뒤에서 다시 더해지지 않는다", () => {
  const items = buildMyOrderItems(
    [consultOrder(), order()],
    [consultation(), consultation({ id: "c-orphan", createdAt: at(5) })],
  );
  // 인생곡 1 + 병합된 상담 1 + 짝 없는 상담 1
  assert.equal(items.length, 3);
  assert.equal(items.filter((item) => item.id === "c-1").length, 1);
});

/* ── 정렬 ───────────────────────────────────────────── */

test("구매 시각 최신순으로 정렬한다", () => {
  const items = buildMyOrderItems(
    [order({ id: "o-old", createdAt: at(8) }), order({ id: "o-new", createdAt: at(10) }), consultOrder()],
    [consultation(), consultation({ id: "c-orphan", createdAt: at(5) })],
  );
  assert.deepEqual(
    items.map((item) => item.id),
    ["c-1", "o-new", "o-old", "c-orphan"],
  );
});

/* ── 필터 ───────────────────────────────────────────── */

test("전체·인생곡·사주상담 필터가 각각 걸린다", () => {
  const items = buildMyOrderItems(
    [order(), consultOrder()],
    [consultation(), consultation({ id: "c-orphan", createdAt: at(5) })],
  );
  assert.equal(filterMyOrderItems(items, "all").length, 3);
  assert.deepEqual(
    filterMyOrderItems(items, "song").map((item) => item.id),
    ["o-song-1"],
  );
  assert.deepEqual(
    filterMyOrderItems(items, "consultation").map((item) => item.id),
    ["c-1", "c-orphan"],
  );
});

test("필터는 원래 목록을 바꾸지 않는다", () => {
  const items = buildMyOrderItems([order(), consultOrder()], [consultation()]);
  const before = items.map((item) => item.id);
  filterMyOrderItems(items, "song");
  assert.deepEqual(
    items.map((item) => item.id),
    before,
  );
  // "all"은 그대로 돌려준다.
  assert.equal(filterMyOrderItems(items, "all").length, items.length);
});

test("아무것도 없으면 빈 목록이다", () => {
  assert.deepEqual(buildMyOrderItems([], []), []);
});
