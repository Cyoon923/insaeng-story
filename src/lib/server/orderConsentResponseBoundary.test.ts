/**
 * 신청 동의 증빙의 응답 경계 (Order-Consent-Response-Boundary-1).
 *
 * 실행: node --test src/lib/server/orderConsentResponseBoundary.test.ts
 *
 * refundConsent·copyrightConsent는 서버 내부 증빙이다.
 * 일반 사용자 응답(/api/app)에서는 빠지고, 분쟁·환불 판정이 보는
 * 관리자 응답(/api/admin)에는 남는다. 저장 구조는 어느 쪽도 바꾸지 않는다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

function read(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

const ROUTE = read("../../app/api/app/route.ts");
const ADMIN_ROUTE = read("../../app/api/admin/route.ts");

/** 주석을 지운 코드. "담지 않는다" 같은 설명이 단언에 잡히지 않게 한다. */
const ROUTE_CODE = ROUTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const ADMIN_CODE = ADMIN_ROUTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/* ── 공개 사본 ─────────────────────────────────────── */

test("공개 사본이 두 증빙만 지운다", () => {
  const fn = ROUTE_CODE.match(/function toPublicOrder\(order: Order\): Order \{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.notEqual(fn, "", "toPublicOrder를 찾지 못했다");
  assert.match(fn, /delete result\.refundConsent;/);
  assert.match(fn, /delete result\.copyrightConsent;/);
  // 저장소의 객체를 건드리지 않도록 사본으로 만든다(toPublicUser와 같은 이유).
  assert.match(fn, /const result: Order = \{ \.\.\.order \};/);
  // 그 밖의 필드는 이번에 바꾸지 않았다.
  const deletes = fn.match(/delete result\.\w+;/g) ?? [];
  assert.deepEqual(deletes, [
    "delete result.refundConsent;",
    "delete result.copyrightConsent;",
  ]);
});

test("두 증빙을 같은 정책으로 다룬다", () => {
  // 한쪽만 지우면 "왜 한쪽만 보이는가"를 설명할 근거가 코드에 없어진다.
  const fn = ROUTE_CODE.match(/function toPublicOrder[\s\S]*?\n\}/)?.[0] ?? "";
  assert.equal(
    fn.includes("refundConsent") && fn.includes("copyrightConsent"),
    true,
  );
});

/* ── 일반 사용자 응답 ──────────────────────────────── */

test("본인 주문 목록에 공개 사본을 쓴다", () => {
  assert.match(ROUTE_CODE, /orders: \(await listOrdersByUser\(userId\)\)\.map\(toPublicOrder\),/);
  // 거르지 않고 그대로 내보내는 옛 형태가 남아 있지 않다.
  assert.equal(ROUTE_CODE.includes("orders: await listOrdersByUser(userId),"), false);
});

test("주문 생성 응답에도 공개 사본을 쓴다", () => {
  assert.match(ROUTE_CODE, /order: toPublicOrder\(result\.order\)/);
  assert.equal(ROUTE_CODE.includes("order: result.order }"), false);
});

test("일반 사용자 응답에 증빙을 실어 보내는 자리가 없다", () => {
  // Order를 내보내는 곳은 위 두 곳뿐이다. 새로 생기면 여기서 걸린다.
  const exposures = ROUTE_CODE.match(/listOrdersByUser\(userId\)/g) ?? [];
  assert.equal(exposures.length, 1);
  assert.equal(/result\.order[,}\s]/.test(ROUTE_CODE.replace(/toPublicOrder\(result\.order\)/g, "")), false);
});

/* ── 관리자 경계 유지 ──────────────────────────────── */

test("관리자 응답은 그대로 둔다", () => {
  assert.match(ADMIN_CODE, /orders: await listAllOrders\(\),/);
  // 관리자 쪽에 공개 사본을 끌어다 쓰지 않는다.
  assert.equal(ADMIN_CODE.includes("toPublicOrder"), false);
});

test("관리자 상태 변경 응답도 그대로 둔다", () => {
  assert.match(ADMIN_CODE, /return NextResponse\.json\(\{ ok: true, order \}\);/);
});

/* ── 저장·생성 로직 무변경 ─────────────────────────── */

test("공개 사본이 저장 경로에 끼어들지 않는다", () => {
  // 저장은 commit*/store가 한다. 응답을 만드는 함수가 그 앞에 서면 안 된다.
  const store = read("./store.ts");
  const applyOrder = read("./applyOrder.ts");
  const retentionScrub = read("./retentionScrub.ts");
  for (const [name, source] of [
    ["store", store],
    ["applyOrder", applyOrder],
    ["retentionScrub", retentionScrub],
  ] as const) {
    assert.equal(source.includes("toPublicOrder"), false, name);
  }
  // 저장 쪽 배선은 그대로다.
  assert.match(store, /order\.refundConsent \? JSON\.stringify\(order\.refundConsent\) : null/);
  assert.match(store, /order\.copyrightConsent \? JSON\.stringify\(order\.copyrightConsent\) : null/);
});

test("Order 타입은 바뀌지 않았다", () => {
  const types = read("../types/app.ts");
  assert.match(types, /refundConsent\?: ConsentRecord;/);
  assert.match(types, /copyrightConsent\?: ConsentRecord;/);
});
