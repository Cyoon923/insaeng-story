/**
 * PG 응답 전문을 저장하지 않는지 확인 (Privacy-NICEPAY-Raw-Minimization-1).
 *
 * 실행: node --test src/lib/server/paymentRawMinimization.test.ts
 *
 * 승인 경로는 Next 요청 객체와 외부 호출이 얽혀 있어 함수 단위로 부르기 어렵다.
 * 대신 "응답 전문을 저장 함수로 넘기는 호출이 코드에 없다"를 소스로 고정한다.
 * 저장 함수(claimPaymentApproved / markPaymentFailed / recordPaymentCancelAttempt)는
 * 넘어온 값이 없으면 해당 열을 채우지 않으므로, 넘기지 않는 것이 곧 저장하지 않는 것이다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

function read(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

test("승인 경로가 PG 응답 전문을 저장 함수로 넘기지 않는다", () => {
  const source = read("../../app/api/payments/nicepay/return/route.ts");
  // 주석에는 이름이 나오므로 실제 전달 형태만 본다(승인 성공·거절 모두).
  assert.equal(source.includes("raw: outcome.raw"), false, "승인 경로에서 raw를 넘기고 있다");
  assert.equal(/raw:\s*outcome/.test(source), false, "승인 경로에서 raw를 넘기고 있다");
  // 저장 호출 자체는 그대로 있어야 한다(승인 사실 기록까지 사라지면 안 된다).
  assert.ok(source.includes("claimPaymentApproved({"));
  assert.ok(source.includes("markPaymentFailed({"));
});

test("승인 경로가 구조화된 값은 그대로 기록한다", () => {
  const source = read("../../app/api/payments/nicepay/return/route.ts");
  for (const kept of [
    "pgTid:",
    "approvedAmount: recalculated",
    "method: outcome.result?.payMethod",
    "approvedAt: outcome.result?.paidAt",
  ]) {
    assert.ok(source.includes(kept), `${kept} 기록이 사라졌다`);
  }
});

test("취소 경로가 PG 응답 전문을 저장 함수로 넘기지 않는다", () => {
  const source = read("./refundPaymentCancellation.ts");
  assert.equal(source.includes("raw: outcome.raw"), false, "취소 경로에서 raw를 넘기고 있다");
  assert.equal(source.includes("raw: record.raw"), false, "취소 경로에서 raw를 넘기고 있다");
  // 구조화된 값은 그대로 기록한다.
  for (const kept of ["kind: record.kind", "resultCode: record.resultCode", "resultMessage: record.resultMessage"]) {
    assert.ok(source.includes(kept), `${kept} 기록이 사라졌다`);
  }
});

/**
 * 열과 타입은 그대로 둔다. 과거에 저장된 값을 읽을 수 있어야 하고,
 * 이번 단계에서 마이그레이션이나 삭제를 하지 않기 때문이다.
 */
test("raw 열과 타입은 그대로 남아 있다", () => {
  const store = read("./store.ts");
  assert.ok(store.includes("raw JSONB"));
  assert.ok(store.includes("cancel_response_raw"));
  const types = read("../types/app.ts");
  assert.ok(types.includes("cancelResponseRaw?"));
});
