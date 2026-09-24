/**
 * NICEPAY 거래조회 client 테스트 (NICEPAY-Payment-Inquiry-Client-1).
 *
 * 실행: node --test src/lib/server/nicepayPaymentInquiry.test.ts
 *
 * 실제 NICEPAY를 부르지 않는다. fetch를 대신 넣어 응답만 흉내 낸다.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_NICEPAY_CLIENT_KEY = "test-client-key";
process.env.NICEPAY_SECRET_KEY = "test-secret-key";

const { inquireNicepayPayment, NicepayInquiryInputError } = await import(
  "./nicepayPaymentInquiry.ts"
);

function fakeFetch(handler: () => Promise<Response> | Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return handler();
  }) as unknown as typeof fetch;
  return { impl, calls };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const INPUT = { tid: "tid-123" };

test("정상 조회면 found", async () => {
  const { impl } = fakeFetch(() =>
    jsonResponse({
      resultCode: "0000",
      resultMsg: "조회성공",
      tid: "tid-123",
      orderId: "is-abc",
      status: "paid",
      amount: 100000,
      cancelledAmt: 0,
      balanceAmt: 100000,
      approvedAt: "2026-08-12T00:00:00+09:00",
    }),
  );
  const outcome = await inquireNicepayPayment(INPUT, impl);
  assert.equal(outcome.kind, "found");
  if (outcome.kind !== "found") return;
  // 대조에 쓸 값이 그대로 남아 있어야 한다.
  assert.equal(outcome.result.tid, "tid-123");
  assert.equal(outcome.result.orderId, "is-abc");
  assert.equal(outcome.result.status, "paid");
  assert.equal(outcome.result.amount, 100000);
  assert.equal(outcome.result.cancelledAmt, 0);
  assert.equal(outcome.result.balanceAmt, 100000);
  assert.equal(outcome.result.approvedAt, "2026-08-12T00:00:00+09:00");
  assert.equal(outcome.raw.resultCode, "0000");
});

test("found는 취소되었다는 뜻이 아니다", async () => {
  // 같은 found 안에서 status가 다르게 온다. 판단은 대조 단계의 몫이다.
  const { impl } = fakeFetch(() =>
    jsonResponse({
      resultCode: "0000",
      tid: "tid-123",
      status: "cancelled",
      amount: 100000,
      cancelledAmt: 100000,
      balanceAmt: 0,
      cancelledAt: "2026-09-17T00:00:00+09:00",
    }),
  );
  const outcome = await inquireNicepayPayment(INPUT, impl);
  assert.equal(outcome.kind, "found");
  if (outcome.kind !== "found") return;
  assert.equal(outcome.result.status, "cancelled");
  assert.equal(outcome.result.cancelledAmt, 100000);
  assert.equal(outcome.result.balanceAmt, 0);
  // 이 client는 결론 칸을 만들지 않는다.
  assert.equal("cancelled" in outcome, false);
  assert.equal("shouldComplete" in outcome, false);
});

test("거래가 없다고 분명히 답하면 not-found", async () => {
  const { impl } = fakeFetch(() => jsonResponse({ resultMsg: "거래 없음" }, 404));
  const outcome = await inquireNicepayPayment(INPUT, impl);
  assert.equal(outcome.kind, "not-found");
  if (outcome.kind !== "not-found") return;
  assert.equal(outcome.httpStatus, 404);
});

test("네트워크 오류면 unknown", async () => {
  const { impl } = fakeFetch(() => {
    throw new TypeError("fetch failed");
  });
  const outcome = await inquireNicepayPayment(INPUT, impl);
  assert.equal(outcome.kind, "unknown");
  if (outcome.kind !== "unknown") return;
  assert.equal(outcome.httpStatus, null);
  assert.equal(outcome.raw, null);
});

test("요청이 중단되어도(AbortError) unknown", async () => {
  const { impl } = fakeFetch(() => {
    const error = new Error("The operation was aborted.");
    error.name = "AbortError";
    throw error;
  });
  assert.equal((await inquireNicepayPayment(INPUT, impl)).kind, "unknown");
});

test("5xx면 unknown", async () => {
  const { impl } = fakeFetch(() => jsonResponse({ resultCode: "0000", tid: "tid-123" }, 503));
  const outcome = await inquireNicepayPayment(INPUT, impl);
  assert.equal(outcome.kind, "unknown");
  if (outcome.kind !== "unknown") return;
  assert.equal(outcome.httpStatus, 503);
});

test("본문을 읽을 수 없으면 unknown", async () => {
  const { impl } = fakeFetch(() => new Response("<html>error</html>", { status: 200 }));
  assert.equal((await inquireNicepayPayment(INPUT, impl)).kind, "unknown");
});

test("뜻을 확정할 수 없는 응답은 unknown", async () => {
  const cases: unknown[] = [
    // 결과코드가 성공이 아니다. 무슨 뜻인지 코드 목록 없이 단정하지 않는다.
    { resultCode: "9999", resultMsg: "알 수 없음", tid: "tid-123" },
    // 결과코드는 성공인데 어떤 거래인지 알아볼 수 없다.
    { resultCode: "0000", resultMsg: "조회성공" },
    { resultCode: "0000", tid: "   " },
    {},
  ];
  for (const body of cases) {
    const { impl } = fakeFetch(() => jsonResponse(body));
    const outcome = await inquireNicepayPayment(INPUT, impl);
    assert.equal(outcome.kind, "unknown", JSON.stringify(body));
  }
});

test("빈 tid면 요청을 보내지 않는다", async () => {
  for (const bad of ["", "   ", "\t\n"]) {
    const { impl, calls } = fakeFetch(() => jsonResponse({ resultCode: "0000", tid: "x" }));
    await assert.rejects(() => inquireNicepayPayment({ tid: bad }, impl), NicepayInquiryInputError);
    assert.equal(calls.length, 0, "요청을 보내면 안 된다");
  }
});

test("규격대로 조회한다", async () => {
  const { impl, calls } = fakeFetch(() => jsonResponse({ resultCode: "0000", tid: "tid/특수" }));
  await inquireNicepayPayment({ tid: "tid/특수" }, impl);

  assert.equal(calls.length, 1, "한 번만 부른다");
  const [call] = calls;
  assert.equal(
    call.url,
    `https://api.nicepay.co.kr/v1/payments/${encodeURIComponent("tid/특수")}`,
  );
  assert.equal(call.init.method, "GET");
  // 조회는 본문을 보내지 않는다.
  assert.equal(call.init.body, undefined);

  // 인증은 승인·취소 client와 같은 Basic base64(clientKey:secretKey) 방식이다.
  const headers = call.init.headers as Record<string, string>;
  const expected = Buffer.from("test-client-key:test-secret-key", "utf8").toString("base64");
  assert.equal(headers.Authorization, `Basic ${expected}`);
});

test("결과 어디에도 secret이 담기지 않는다", async () => {
  const { impl } = fakeFetch(() =>
    jsonResponse({ resultCode: "0000", tid: "tid-123", status: "paid" }),
  );
  const outcome = await inquireNicepayPayment(INPUT, impl);
  const dumped = JSON.stringify(outcome);
  assert.equal(dumped.includes("test-secret-key"), false);
  assert.equal(dumped.includes("Basic "), false);
});

test("확인하지 못해도 다시 부르지 않는다", async () => {
  const { impl, calls } = fakeFetch(() => {
    throw new Error("network down");
  });
  const outcome = await inquireNicepayPayment(INPUT, impl);
  assert.equal(outcome.kind, "unknown");
  assert.equal(calls.length, 1);
});
