/**
 * 승인 processing 결제의 관리자 수동 확인 (P1-02).
 * 실행: node --test src/lib/server/processingPaymentInquiry.test.ts
 *
 * DB·NICEPAY 없이 deps 대역으로 본다. 조회·전환 호출 횟수를 세어
 * "검증이 끝난 paid만 claim 1회, 나머지는 0회"를 확인한다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  orderDateCandidates,
  runProcessingPaymentInquiry,
} from "./processingPaymentInquiry.ts";
import type { ProcessingInquiryDeps } from "./processingPaymentInquiry.ts";
import type { NicepayPaymentInquiryOutcome } from "./nicepayPaymentInquiry.ts";
import type { Payment } from "../types/app.ts";
import { holdReleaseDecision, runAdminHoldRelease } from "./consultationHold.ts";

const MOID = "is-abc";
const AMOUNT = 89000;
// 2026-10-01 10:00 KST에 준비, 같은 날 10:01 KST에 승인 시도(processing).
const CREATED = "2026-10-01T01:00:00.000Z";
const UPDATED = "2026-10-01T01:01:00.000Z";
const NOW = new Date("2026-10-01T02:00:00.000Z");

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "p-1",
    orderId: null,
    provider: "nicepay",
    merchantOrderId: MOID,
    pgTid: null,
    requestedAmount: AMOUNT,
    approvedAmount: null,
    cancelledAmount: 0,
    status: "processing",
    method: "card",
    approvedAt: null,
    cancelledAt: null,
    orderSnapshot: { kind: "order", userId: "u-1", amount: AMOUNT },
    raw: null,
    createdAt: CREATED,
    updatedAt: UPDATED,
    ...overrides,
  };
}

const PAID = {
  resultCode: "0000",
  tid: "tid-pg",
  orderId: MOID,
  status: "paid",
  amount: AMOUNT,
  balanceAmt: AMOUNT,
  paidAt: "2026-10-01T10:01:30.000+0900",
  payMethod: "card",
};

function found(result: Record<string, unknown>): NicepayPaymentInquiryOutcome {
  return { kind: "found", result, raw: result, httpStatus: 200 };
}
const NOT_FOUND: NicepayPaymentInquiryOutcome = { kind: "not-found", raw: null, httpStatus: 404 };
const UNKNOWN: NicepayPaymentInquiryOutcome = {
  kind: "unknown",
  message: "x",
  raw: null,
  httpStatus: 502,
};

function harness(
  p: Payment | null,
  outcomes: NicepayPaymentInquiryOutcome[],
  claimResult: Payment | null = payment({ status: "paid" }),
  failResult: Payment | null = payment({ status: "failed" }),
) {
  const inquiries: { orderId: string; orderDate: string }[] = [];
  const tidInquiries: string[] = [];
  const claims: Parameters<ProcessingInquiryDeps["claimApproved"]>[0][] = [];
  const fails: string[] = [];
  const deps: ProcessingInquiryDeps = {
    getPayment: async () => p,
    inquireByOrderId: async (input) => {
      inquiries.push(input);
      return outcomes[inquiries.length - 1] ?? UNKNOWN;
    },
    inquireByTid: async ({ tid }) => {
      tidInquiries.push(tid);
      return outcomes[tidInquiries.length - 1] ?? UNKNOWN;
    },
    claimApproved: async (input) => {
      claims.push(input);
      return claimResult;
    },
    markFailed: async ({ merchantOrderId }) => {
      fails.push(merchantOrderId);
      return failResult;
    },
    now: () => NOW,
  };
  return { deps, inquiries, tidInquiries, claims, fails };
}

/* ── 주문일자 후보 ─────────────────────────────────── */

test("주문일자 후보: KST 날짜, 같은 날이면 하나", () => {
  assert.deepEqual(orderDateCandidates(CREATED, UPDATED), ["20261001"]);
});

test("주문일자 후보: KST 자정 경계를 넘으면 두 개(준비일이 먼저)", () => {
  // 2026-10-01 23:59 KST 준비, 2026-10-02 00:00 KST 승인 시도
  assert.deepEqual(
    orderDateCandidates("2026-10-01T14:59:00.000Z", "2026-10-01T15:00:00.000Z"),
    ["20261001", "20261002"],
  );
});

test("주문일자 후보: 읽을 수 없는 시각은 뺀다", () => {
  assert.deepEqual(orderDateCandidates("bad", UPDATED), ["20261001"]);
  assert.deepEqual(orderDateCandidates("bad", "bad"), []);
});

/* ── 정상 전환 ─────────────────────────────────────── */

test("paid + 전부 일치 → claimPaymentApproved 1회", async () => {
  const { deps, inquiries, claims } = harness(payment(), [found(PAID)]);
  const result = await runProcessingPaymentInquiry(MOID, deps);
  assert.equal(result.status, "paid-confirmed");
  assert.equal(result.nextAction, "recommit");
  assert.equal(result.message, "결제가 확인되었습니다. 재접수를 눌러 주문을 접수해 주세요.");
  assert.deepEqual(inquiries, [{ orderId: MOID, orderDate: "20261001" }]);
  assert.deepEqual(claims, [
    {
      merchantOrderId: MOID,
      pgTid: "tid-pg",
      approvedAmount: AMOUNT,
      method: "card",
      approvedAt: "2026-10-01T10:01:30.000+0900",
    },
  ]);
});

test("paid: 숫자 문자열 금액과 balanceAmt 없음도 받는다, payMethod·paidAt 없으면 null", async () => {
  const body = { ...PAID, amount: "089000" } as Record<string, unknown>;
  delete body.balanceAmt;
  delete body.payMethod;
  delete body.paidAt;
  const { deps, claims } = harness(payment(), [found(body)]);
  assert.equal((await runProcessingPaymentInquiry(MOID, deps)).status, "paid-confirmed");
  assert.equal(claims[0].method, null);
  assert.equal(claims[0].approvedAt, null);
});

test("claim이 null이면(동시 상태 변경) 안전하게 끝낸다", async () => {
  const { deps, claims } = harness(payment(), [found(PAID)], null);
  const result = await runProcessingPaymentInquiry(MOID, deps);
  assert.equal(claims.length, 1);
  assert.equal(result.status, "concurrent-change");
  assert.equal(result.nextAction, "manual");
});

/* ── 조회 결과 불일치·누락 → claim 0 ─────────────────── */

const withoutKey = (key: string) => {
  const copy: Record<string, unknown> = { ...PAID };
  delete copy[key];
  return copy;
};

for (const [name, body] of [
  ["tid 누락", withoutKey("tid")],
  ["tid 빈 값", { ...PAID, tid: " " }],
  ["orderId 불일치", { ...PAID, orderId: "is-other" }],
  ["orderId 누락", withoutKey("orderId")],
  ["amount 불일치", { ...PAID, amount: 1000 }],
  ["amount 누락", withoutKey("amount")],
  ["amount 형식 오류", { ...PAID, amount: "89,000" }],
  ["balanceAmt ≠ amount", { ...PAID, balanceAmt: 0 }],
  ["balanceAmt 형식 오류", { ...PAID, balanceAmt: "x" }],
  ["status 누락", withoutKey("status")],
  ["알 수 없는 status", { ...PAID, status: "approved" }],
] as const) {
  test(`${name} → mismatch, claim 0`, async () => {
    const { deps, claims } = harness(payment(), [found(body)]);
    const result = await runProcessingPaymentInquiry(MOID, deps);
    assert.equal(result.status, "mismatch");
    assert.equal(result.nextAction, "manual");
    assert.equal(claims.length, 0);
  });
}

/* ── paid 외 상태 → 표시만, claim 0 ─────────────────── */

for (const [pgStatus, expected] of [
  ["ready", "pg-ready"],
  ["cancelled", "pg-cancelled"],
  ["partialCancelled", "pg-partial-cancelled"],
] as const) {
  test(`NICEPAY ${pgStatus} → ${expected}, 표시만(claim 0, failed 확정 0, 상태 변경 없음)`, async () => {
    const { deps, claims, fails } = harness(payment(), [found({ ...PAID, status: pgStatus })]);
    const result = await runProcessingPaymentInquiry(MOID, deps);
    assert.equal(result.status, expected);
    assert.equal(result.nextAction, "manual");
    assert.equal(result.changed, false);
    assert.equal(claims.length, 0);
    assert.deepEqual(fails, []);
  });
}

/* ── 조회 전 대상 확인 → 조회·claim 0 ───────────────── */

for (const [name, p, expected] of [
  ["결제 없음", null, "not-eligible"],
  ["nicepay 아님", payment({ provider: "other" }), "not-eligible"],
  ["processing 아님(paid)", payment({ status: "paid" }), "not-eligible"],
  ["processing 아님(ready)", payment({ status: "ready" }), "not-eligible"],
  ["order_id 있음", payment({ orderId: "o-is-abc" }), "not-eligible"],
  ["snapshot amount 불일치", payment({ orderSnapshot: { amount: 99000 } }), "not-eligible"],
  ["snapshot amount 없음", payment({ orderSnapshot: {} }), "not-eligible"],
  ["requestedAmount 0", payment({ requestedAmount: 0, orderSnapshot: { amount: 0 } }), "not-eligible"],
  ["10분 미경과", payment({ updatedAt: "2026-10-01T01:55:00.000Z" }), "too-recent"],
] as const) {
  test(`${name} → ${expected}, 조회·claim 0`, async () => {
    const { deps, inquiries, claims } = harness(p, [found(PAID)]);
    const result = await runProcessingPaymentInquiry(MOID, deps);
    assert.equal(result.status, expected);
    assert.equal(inquiries.length, 0);
    assert.equal(claims.length, 0);
  });
}

/* ── 날짜 후보 순회 ─────────────────────────────────── */

const MIDNIGHT = payment({
  createdAt: "2026-10-01T14:59:00.000Z",
  updatedAt: "2026-10-01T15:00:00.000Z",
});
const MIDNIGHT_NOW = new Date("2026-10-01T16:00:00.000Z");

test("첫 날짜 not-found → 두 번째 후보로 조회해 paid 전환", async () => {
  const h = harness(MIDNIGHT, [NOT_FOUND, found(PAID)]);
  h.deps.now = () => MIDNIGHT_NOW;
  const result = await runProcessingPaymentInquiry(MOID, h.deps);
  assert.equal(result.status, "paid-confirmed");
  assert.deepEqual(
    h.inquiries.map((item) => item.orderDate),
    ["20261001", "20261002"],
  );
  assert.equal(h.claims.length, 1);
});

test("모든 후보 not-found → not-found, claim 0", async () => {
  const h = harness(MIDNIGHT, [NOT_FOUND, NOT_FOUND]);
  h.deps.now = () => MIDNIGHT_NOW;
  const result = await runProcessingPaymentInquiry(MOID, h.deps);
  assert.equal(result.status, "not-found");
  assert.equal(h.inquiries.length, 2);
  assert.equal(h.claims.length, 0);
});

test("첫 조회 unknown이면 두 번째 후보를 조회하지 않고 retry", async () => {
  const h = harness(MIDNIGHT, [UNKNOWN, found(PAID)]);
  h.deps.now = () => MIDNIGHT_NOW;
  const result = await runProcessingPaymentInquiry(MOID, h.deps);
  assert.equal(result.status, "retry");
  assert.equal(result.nextAction, "retry");
  assert.equal(h.inquiries.length, 1);
  assert.equal(h.claims.length, 0);
});

test("조회 함수가 예외를 던지면 retry, claim 0", async () => {
  const h = harness(payment(), []);
  h.deps.inquireByOrderId = async () => {
    throw new Error("config");
  };
  const result = await runProcessingPaymentInquiry(MOID, h.deps);
  assert.equal(result.status, "retry");
  assert.equal(h.claims.length, 0);
});

/* ── 구조 ───────────────────────────────────────────── */

const MODULE = readFileSync(new URL("./processingPaymentInquiry.ts", import.meta.url), "utf8");
const ROUTE = readFileSync(
  new URL("../../app/api/admin/payments/processing-inquiry/route.ts", import.meta.url),
  "utf8",
);

test("복구 모듈과 route는 주문 생성·실패 전환·재승인 기능을 부르지 않는다", () => {
  for (const source of [MODULE, ROUTE]) {
    for (const forbidden of [
      "approveNicepayPayment",
      "commitOrder",
      "commitConsultation",
      "recommit/route",
      "linkPaymentToOrder",
      "writeData",
      // 상담 시간 확보는 이 흐름이 풀지 않는다(관리자가 따로 해제한다, P1-04 Stage 5).
      "releaseConsultationHold",
      "consultationHolds",
    ]) {
      assert.equal(source.includes(forbidden), false, forbidden);
    }
  }
});

test("route는 관리자 확인이 먼저이고 원문·tid·userId를 돌려주지 않는다", () => {
  assert.ok(ROUTE.indexOf("await requireAdmin()") < ROUTE.indexOf("readJsonBody(request)"));
  assert.ok(ROUTE.indexOf("await requireAdmin()") < ROUTE.indexOf("runProcessingPaymentInquiry("));
  const responses = ROUTE.slice(ROUTE.indexOf("NextResponse.json({"));
  for (const leak of ["raw", "pgTid", "tid:", "userId"]) {
    assert.equal(responses.includes(leak), false, leak);
  }
});

/* ── P1-04 Stage 5: 승인 시도 tid로 검증된 failed / expired → 내부 failed 확정 ─────── */

// 승인 시도 tid가 남아 있는 결제. 조회는 이 tid로만 한다.
const attempt = (overrides: Partial<Payment> = {}) => payment({ approveAttemptTid: "tid-pg", ...overrides });

for (const [pgStatus, expected] of [
  ["failed", "pg-failed"],
  ["expired", "pg-expired"],
] as const) {
  test(`processing + NICEPAY ${pgStatus}(같은 거래·금액) → markFailed 1회, 변경됨, 홀드 해제 안내`, async () => {
    const { deps, claims, fails } = harness(attempt(), [found({ ...PAID, status: pgStatus })]);
    const result = await runProcessingPaymentInquiry(MOID, deps);
    assert.equal(result.status, expected);
    assert.equal(result.changed, true);
    assert.equal(result.nextAction, "release-hold");
    assert.match(result.message, /실패로 정리했습니다/);
    assert.deepEqual(fails, [MOID]);
    assert.equal(claims.length, 0);
  });
}

for (const [name, body] of [
  ["orderId 불일치", { ...PAID, status: "failed", orderId: "is-other" }],
  ["tid 누락", { ...PAID, status: "failed", tid: "" }],
  ["amount 불일치", { ...PAID, status: "expired", amount: 1000 }],
  ["amount 누락", (() => { const b: Record<string, unknown> = { ...PAID, status: "expired" }; delete b.amount; return b; })()],
] as const) {
  test(`NICEPAY failed/expired라도 ${name} → mismatch, 상태 변경 없음`, async () => {
    const { deps, fails } = harness(attempt(), [found(body as Record<string, unknown>)]);
    const result = await runProcessingPaymentInquiry(MOID, deps);
    assert.equal(result.status, "mismatch");
    assert.equal(result.changed, false);
    assert.deepEqual(fails, []);
  });
}

test("NICEPAY not-found / unknown → 상태 변경 없음", async () => {
  const notFound = harness(attempt(), [NOT_FOUND]);
  assert.equal((await runProcessingPaymentInquiry(MOID, notFound.deps)).status, "not-found");
  assert.deepEqual(notFound.fails, []);
  const unknown = harness(attempt(), [UNKNOWN]);
  assert.equal((await runProcessingPaymentInquiry(MOID, unknown.deps)).status, "retry");
  assert.deepEqual(unknown.fails, []);
});

test("paid는 기존 paid 전환 그대로(failed 확정 없음)", async () => {
  const { deps, claims, fails } = harness(payment(), [found(PAID)]);
  const result = await runProcessingPaymentInquiry(MOID, deps);
  assert.equal(result.status, "paid-confirmed");
  assert.equal(result.changed, true);
  assert.equal(claims.length, 1);
  assert.deepEqual(fails, []);
});

test("그사이 paid 등으로 바뀌어 markFailed가 null이면 concurrent-change(덮어쓰지 않음)", async () => {
  const { deps, fails } = harness(attempt(), [found({ ...PAID, status: "failed" })], undefined, null);
  const result = await runProcessingPaymentInquiry(MOID, deps);
  assert.equal(result.status, "concurrent-change");
  assert.equal(result.changed, false);
  assert.deepEqual(fails, [MOID]);
});

test("이미 failed인 결제는 조회 대상이 아니다(조회·변경 없음)", async () => {
  const { deps, inquiries, fails } = harness(payment({ status: "failed" }), [found({ ...PAID, status: "failed" })]);
  assert.equal((await runProcessingPaymentInquiry(MOID, deps)).status, "not-eligible");
  assert.deepEqual(inquiries, []);
  assert.deepEqual(fails, []);
});

test("store.markPaymentFailed는 processing일 때만 바꾸는 조건부 UPDATE다", () => {
  const STORE = readFileSync(new URL("./store.ts", import.meta.url), "utf8");
  const body = STORE.slice(STORE.indexOf("export async function markPaymentFailed("));
  const sql = body.slice(0, body.indexOf("RETURNING")).replace(/\s+/g, " ");
  assert.match(sql, /SET status = 'failed'/);
  assert.match(sql, /WHERE merchant_order_id = \$1 AND status = 'processing'/);
  assert.match(ROUTE, /markFailed: \(input\) => markPaymentFailed\(input\),/);
});

test("failed 확정 뒤 상담 시간 확보는 그대로이고, 관리자 해제가 그때부터 허용된다", async () => {
  // 조회 흐름의 deps에는 app_store 쓰기가 없다. hold는 이 단계에서 바뀌지 않는다.
  const holds = [
    { teacher: "유비 선생", date: "10월 20일(화)", time: "오전 10:00", merchantOrderId: MOID, createdAt: "x" },
  ];
  let paymentNow = attempt();
  const { deps } = harness(paymentNow, [found({ ...PAID, status: "expired" })]);
  deps.markFailed = async () => {
    paymentNow = { ...paymentNow, status: "failed" };
    return paymentNow;
  };
  // 조회 전: processing이라 해제 불가
  assert.equal(holdReleaseDecision(paymentNow).ok, false);
  await runProcessingPaymentInquiry(MOID, deps);
  assert.equal(holds.length, 1);
  assert.equal(holdReleaseDecision(paymentNow).ok, true);
  // 관리자 "홀드 해제" (Stage 4)
  let saved = { consultationHolds: holds } as unknown as Record<string, unknown>;
  const released = await runAdminHoldRelease(MOID, {
    getPayment: async () => paymentNow,
    readData: async () => structuredClone(saved) as never,
    writeData: async (data) => {
      saved = structuredClone(data) as unknown as Record<string, unknown>;
    },
    isConflict: () => false,
  });
  assert.equal(released.ok, true);
  assert.deepEqual(saved.consultationHolds, []);
});

test("hold가 없는 일반 processing 결제도 같은 규칙(failed 확정, 해제 대상 없음)", async () => {
  const { deps, fails } = harness(attempt(), [found({ ...PAID, status: "failed" })]);
  const result = await runProcessingPaymentInquiry(MOID, deps);
  assert.equal(result.status, "pg-failed");
  assert.deepEqual(fails, [MOID]);
});

/* ── 승인 시도 tid 우선 조회 ─────────────────────────── */

test("시도 tid + paid → tid로 1회 조회, 주문번호 조회 0, claim(pgTid = 시도 tid)", async () => {
  const { deps, inquiries, tidInquiries, claims, fails } = harness(attempt(), [found(PAID)]);
  const result = await runProcessingPaymentInquiry(MOID, deps);
  assert.equal(result.status, "paid-confirmed");
  assert.equal(result.changed, true);
  assert.deepEqual(tidInquiries, ["tid-pg"]);
  assert.deepEqual(inquiries, []);
  assert.equal(claims.length, 1);
  assert.equal(claims[0].pgTid, "tid-pg");
  assert.equal(claims[0].approvedAmount, AMOUNT);
  assert.deepEqual(fails, []);
});

for (const pgStatus of ["paid", "failed", "expired"] as const) {
  test(`시도 tid와 응답 tid가 다르면(${pgStatus}) mismatch, 상태 변경 없음`, async () => {
    const { deps, inquiries, claims, fails } = harness(attempt(), [
      found({ ...PAID, status: pgStatus, tid: "tid-other" }),
    ]);
    const result = await runProcessingPaymentInquiry(MOID, deps);
    assert.equal(result.status, "mismatch");
    assert.equal(result.changed, false);
    assert.deepEqual(inquiries, []);
    assert.equal(claims.length, 0);
    assert.deepEqual(fails, []);
  });
}

for (const [name, outcome, expected] of [
  ["ready", found({ ...PAID, status: "ready" }), "pg-ready"],
  ["cancelled", found({ ...PAID, status: "cancelled" }), "pg-cancelled"],
  ["partialCancelled", found({ ...PAID, status: "partialCancelled" }), "pg-partial-cancelled"],
  ["not-found", NOT_FOUND, "not-found"],
  ["unknown", UNKNOWN, "retry"],
] as const) {
  test(`시도 tid + ${name} → ${expected}, 주문번호 조회로 넘어가지 않고 상태 변경 없음`, async () => {
    const { deps, inquiries, tidInquiries, claims, fails } = harness(attempt(), [outcome, found(PAID)]);
    const result = await runProcessingPaymentInquiry(MOID, deps);
    assert.equal(result.status, expected);
    assert.equal(result.changed, false);
    assert.equal(tidInquiries.length, 1);
    assert.deepEqual(inquiries, []);
    assert.equal(claims.length, 0);
    assert.deepEqual(fails, []);
  });
}

test("시도 tid 조회가 예외를 던지면 retry, 주문번호 조회·변경 없음", async () => {
  const h = harness(attempt(), [found(PAID)]);
  h.deps.inquireByTid = async () => {
    throw new Error("network");
  };
  const result = await runProcessingPaymentInquiry(MOID, h.deps);
  assert.equal(result.status, "retry");
  assert.deepEqual(h.inquiries, []);
  assert.equal(h.claims.length, 0);
  assert.deepEqual(h.fails, []);
});

test("시도 tid가 공백뿐이면 레거시 경로(주문번호 조회)", async () => {
  const { deps, inquiries, tidInquiries } = harness(attempt({ approveAttemptTid: "  " }), [found(PAID)]);
  assert.equal((await runProcessingPaymentInquiry(MOID, deps)).status, "paid-confirmed");
  assert.deepEqual(tidInquiries, []);
  assert.equal(inquiries.length, 1);
});

/* ── 레거시(approveAttemptTid 없음): paid만 확정 ─────────── */

for (const legacy of [payment(), payment({ approveAttemptTid: null })]) {
  test(`레거시(${String(legacy.approveAttemptTid)}) + paid → 주문번호 조회로 기존 P1-02 paid 전환`, async () => {
    const { deps, inquiries, tidInquiries, claims } = harness(legacy, [found(PAID)]);
    const result = await runProcessingPaymentInquiry(MOID, deps);
    assert.equal(result.status, "paid-confirmed");
    assert.deepEqual(tidInquiries, []);
    assert.equal(inquiries.length, 1);
    assert.equal(claims[0].pgTid, "tid-pg");
  });
}

for (const pgStatus of ["failed", "expired"] as const) {
  test(`레거시 + NICEPAY ${pgStatus} → markFailed 0, processing 유지, 수동 확인 안내`, async () => {
    const { deps, claims, fails } = harness(payment(), [found({ ...PAID, status: pgStatus })]);
    const result = await runProcessingPaymentInquiry(MOID, deps);
    assert.equal(result.status, "pg-failed-unverified");
    assert.equal(result.changed, false);
    assert.equal(result.nextAction, "manual");
    assert.match(result.message, /바꾸지 않았습니다/);
    assert.deepEqual(fails, []);
    assert.equal(claims.length, 0);
  });
}

test("route는 tid 조회를 기존 inquireNicepayPayment로 연결한다", () => {
  assert.match(ROUTE, /inquireByTid: \(input\) => inquireNicepayPayment\(input\),/);
});
