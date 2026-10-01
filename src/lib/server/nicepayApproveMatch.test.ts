/**
 * NICEPAY 승인 응답의 거래 일치 검증 (P1-01).
 * 실행: node --test src/lib/server/nicepayApproveMatch.test.ts
 *
 * 실제 approveNicepayPayment를 부르고 fetch만 메모리 응답으로 바꾼다. 키는 더미 값이며
 * 네트워크를 쓰지 않는다. return route는 Next 요청과 저장소에 얽혀 있어 순서를 원문으로 확인한다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

process.env.NEXT_PUBLIC_NICEPAY_CLIENT_KEY = "test-client";
process.env.NICEPAY_SECRET_KEY = "test-secret";

const { approveNicepayPayment } = await import("./nicepayApprove.ts");

const TID = "TID-REQUESTED";
const MERCHANT_ORDER_ID = "is-123";
const AMOUNT = 89000;
const NORMAL: Record<string, unknown> = {
  resultCode: "0000",
  resultMsg: "정상 처리되었습니다.",
  status: "paid",
  tid: TID,
  orderId: MERCHANT_ORDER_ID,
  amount: AMOUNT,
  payMethod: "card",
  paidAt: "2026-10-01T00:00:00.000+0900",
};

async function approveWith(body: Record<string, unknown>) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;
  try {
    return await approveNicepayPayment({ tid: TID, amount: AMOUNT, merchantOrderId: MERCHANT_ORDER_ID });
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function without(key: string): Record<string, unknown> {
  const copy = { ...NORMAL };
  delete copy[key];
  return copy;
}

test("tid·orderId·amount가 모두 일치하면 approved", async () => {
  const outcome = await approveWith(NORMAL);
  assert.equal(outcome.kind, "approved");
  assert.equal(outcome.ok, true);
});

test("zero-padded 숫자 문자열 금액도 같은 금액이면 approved", async () => {
  assert.equal((await approveWith({ ...NORMAL, amount: "000000089000" })).kind, "approved");
  assert.equal((await approveWith({ ...NORMAL, amount: "89000" })).kind, "approved");
});

const BLOCKED: [string, Record<string, unknown>][] = [
  ["tid 불일치", { ...NORMAL, tid: "TID-OTHER" }],
  ["tid 누락", without("tid")],
  ["tid 형식 오류", { ...NORMAL, tid: 123 }],
  ["orderId 불일치", { ...NORMAL, orderId: "is-999" }],
  ["orderId 누락", without("orderId")],
  ["amount 불일치", { ...NORMAL, amount: 1000 }],
  ["amount 누락", without("amount")],
  ["amount 소수", { ...NORMAL, amount: 89000.5 }],
  ["amount 음수", { ...NORMAL, amount: -89000 }],
  ["amount 숫자 아닌 문자열", { ...NORMAL, amount: "89,000" }],
  ["amount null", { ...NORMAL, amount: null }],
];

for (const [name, body] of BLOCKED) {
  test(`${name} → approved가 아니라 unknown (declined로 확정하지 않는다)`, async () => {
    const outcome = await approveWith(body);
    assert.equal(outcome.kind, "unknown");
    assert.equal(outcome.ok, false);
    assert.equal(outcome.result, null);
  });
}

test("성공 코드가 아니면 기존처럼 declined", async () => {
  assert.equal((await approveWith({ ...NORMAL, resultCode: "3011" })).kind, "declined");
  assert.equal((await approveWith({ ...NORMAL, status: "ready" })).kind, "declined");
});

const ROUTE = readFileSync(
  new URL("../../app/api/payments/nicepay/return/route.ts", import.meta.url),
  "utf8",
);

test("return route는 기대 거래 세 값을 넘겨 승인한다", () => {
  assert.match(
    ROUTE,
    /approveNicepayPayment\(\{ tid, amount: recalculated, merchantOrderId \}\)/,
  );
});

test("unknown이면 claimPaymentApproved·주문/상담 확정 전에 pending으로 끝난다", () => {
  const approve = ROUTE.indexOf("await approveNicepayPayment(");
  const unknown = ROUTE.indexOf('if (outcome.kind === "unknown")', approve);
  const claim = ROUTE.indexOf("await claimPaymentApproved(", approve);
  const commitOrderAt = ROUTE.indexOf("await commitOrder(", approve);
  const commitConsultAt = ROUTE.indexOf("await commitConsultation(", approve);
  assert.ok(approve > 0 && unknown > approve);
  assert.ok(unknown < claim && claim < commitOrderAt && claim < commitConsultAt);
  assert.match(
    ROUTE.slice(unknown, ROUTE.indexOf("\n  }", unknown)),
    /return pending\(/,
  );
});

test("paid 기록은 검증한 요청 tid와 서버 계산 금액을 쓴다", () => {
  const claim = ROUTE.slice(
    ROUTE.indexOf("await claimPaymentApproved("),
    ROUTE.indexOf("});", ROUTE.indexOf("await claimPaymentApproved(")),
  );
  assert.match(claim, /pgTid: tid,/);
  assert.match(claim, /approvedAmount: recalculated,/);
  assert.doesNotMatch(claim, /outcome\.result\?\.tid/);
});
