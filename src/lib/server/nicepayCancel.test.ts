/**
 * NICEPAY 전액취소 client 테스트 (NICEPAY-Cancel-Client-1).
 *
 * 실행: node --test src/lib/server/nicepayCancel.test.ts
 * (기존 단계들과 같은 방식. 새 테스트 framework 없음.)
 *
 * 실제 NICEPAY를 부르지 않는다. fetch를 대신 넣어 응답만 흉내 낸다.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_NICEPAY_CLIENT_KEY = "test-client-key";
process.env.NICEPAY_SECRET_KEY = "test-secret-key";

const { cancelNicepayPayment, NicepayCancelInputError } = await import("./nicepayCancel.ts");

/** 호출 내용을 기록하면서 정해진 응답을 돌려주는 가짜 fetch. */
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

const INPUT = { tid: "tid-123", orderId: "is-abc", reason: "고객 환불 승인" };

test("취소 성공코드 2001 + cancelled 이면 succeeded", async () => {
  const { impl } = fakeFetch(() =>
    jsonResponse({
      resultCode: "2001",
      resultMsg: "취소성공",
      status: "cancelled",
      tid: "tid-123",
      orderId: "is-abc",
      amount: 100000,
      cancelledAmt: 100000,
      balanceAmt: 0,
    }),
  );
  const outcome = await cancelNicepayPayment(INPUT, impl);
  assert.equal(outcome.kind, "succeeded");
  if (outcome.kind !== "succeeded") return;
  // 후속 DB 검증에 쓸 값이 그대로 남아 있어야 한다.
  assert.equal(outcome.result.tid, "tid-123");
  assert.equal(outcome.result.orderId, "is-abc");
  assert.equal(outcome.result.amount, 100000);
  assert.equal(outcome.result.cancelledAmt, 100000);
  assert.equal(outcome.result.balanceAmt, 0);
  assert.equal(outcome.raw.resultCode, "2001");
});

test("환불 성공코드 2211 + cancelled 이면 succeeded", async () => {
  const { impl } = fakeFetch(() =>
    jsonResponse({ resultCode: "2211", resultMsg: "환불성공", status: "cancelled" }),
  );
  const outcome = await cancelNicepayPayment(INPUT, impl);
  assert.equal(outcome.kind, "succeeded");
});

test("성공코드인데 상태가 취소가 아니면 확정하지 않는다", async () => {
  // 돈이 움직였을 수 있으므로 실패로 단정하지 않는다.
  for (const code of ["2001", "2211"]) {
    const { impl } = fakeFetch(() =>
      jsonResponse({ resultCode: code, resultMsg: "성공", status: "paid" }),
    );
    const outcome = await cancelNicepayPayment(INPUT, impl);
    assert.equal(outcome.kind, "unknown", code);
  }
});

test("승인 성공코드 0000은 취소 성공으로 보지 않는다", async () => {
  // 0000이 취소 성공이라는 근거가 repo에 없다. 상태가 cancelled라 실패로도 단정하지 않는다.
  const { impl } = fakeFetch(() =>
    jsonResponse({ resultCode: "0000", resultMsg: "성공", status: "cancelled" }),
  );
  const outcome = await cancelNicepayPayment(INPUT, impl);
  assert.equal(outcome.kind, "unknown");

  // 상태까지 취소가 아니면 분명한 거절이다.
  const other = fakeFetch(() =>
    jsonResponse({ resultCode: "0000", resultMsg: "성공", status: "paid" }),
  );
  assert.equal((await cancelNicepayPayment(INPUT, other.impl)).kind, "declined");
});

test("명확한 취소 실패 코드면 declined", async () => {
  for (const code of ["2003", "3001"]) {
    const { impl } = fakeFetch(() =>
      jsonResponse({ resultCode: code, resultMsg: "취소 불가 거래", status: "paid" }, 400),
    );
    const outcome = await cancelNicepayPayment(INPUT, impl);
    assert.equal(outcome.kind, "declined", code);
    if (outcome.kind !== "declined") return;
    assert.equal(outcome.result.resultCode, code);
    // 사용자에게 보여도 되는 짧은 문구만 담는다. PG 원문을 그대로 쓰지 않는다.
    assert.equal(outcome.message, "결제 취소가 완료되지 않았습니다.");
  }
});

test("네트워크 오류면 unknown", async () => {
  const { impl } = fakeFetch(() => {
    throw new TypeError("fetch failed");
  });
  const outcome = await cancelNicepayPayment(INPUT, impl);
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
  const outcome = await cancelNicepayPayment(INPUT, impl);
  assert.equal(outcome.kind, "unknown");
});

test("5xx면 unknown", async () => {
  const { impl } = fakeFetch(() => jsonResponse({ resultCode: "9999" }, 503));
  const outcome = await cancelNicepayPayment(INPUT, impl);
  assert.equal(outcome.kind, "unknown");
  if (outcome.kind !== "unknown") return;
  assert.equal(outcome.httpStatus, 503);
});

test("본문을 읽을 수 없으면 unknown", async () => {
  const { impl } = fakeFetch(() => new Response("<html>error</html>", { status: 200 }));
  const outcome = await cancelNicepayPayment(INPUT, impl);
  assert.equal(outcome.kind, "unknown");
});

test("HTTP 상태만 보고 실패로 단정하지 않는다", async () => {
  // 4xx라도 본문이 성공을 말하면 성공으로 읽는다(반대로 200이어도 본문이 기준이다).
  const { impl } = fakeFetch(() =>
    jsonResponse({ resultCode: "2001", status: "cancelled", tid: "tid-123" }, 400),
  );
  const outcome = await cancelNicepayPayment(INPUT, impl);
  assert.equal(outcome.kind, "succeeded");
});

test("빈 값은 HTTP 요청 전에 막는다", async () => {
  for (const bad of [
    { ...INPUT, tid: "  " },
    { ...INPUT, orderId: "" },
    { ...INPUT, reason: "\t\n" },
  ]) {
    const { impl, calls } = fakeFetch(() => jsonResponse({ resultCode: "2001" }));
    await assert.rejects(() => cancelNicepayPayment(bad, impl), NicepayCancelInputError);
    assert.equal(calls.length, 0, "요청을 보내면 안 된다");
  }
});

test("전액취소 규격대로 호출한다", async () => {
  const { impl, calls } = fakeFetch(() =>
    jsonResponse({ resultCode: "2001", status: "cancelled" }),
  );
  await cancelNicepayPayment({ ...INPUT, tid: "tid/특수" }, impl);

  assert.equal(calls.length, 1, "한 번만 부른다");
  const [call] = calls;
  // endpoint는 /v1/payments/{tid}/cancel 이고 tid는 경로에 안전하게 넣는다.
  assert.equal(
    call.url,
    `https://api.nicepay.co.kr/v1/payments/${encodeURIComponent("tid/특수")}/cancel`,
  );
  assert.equal(call.init.method, "POST");

  const body = JSON.parse(String(call.init.body)) as Record<string, unknown>;
  // 보내는 값은 reason과 orderId 둘뿐이다. cancelAmt를 넣지 않는 것이 전액취소다.
  assert.deepEqual(Object.keys(body).sort(), ["orderId", "reason"]);
  assert.equal("cancelAmt" in body, false);
  assert.equal(body.reason, "고객 환불 승인");
  assert.equal(body.orderId, "is-abc");

  // 인증은 승인 client와 같은 Basic base64(clientKey:secretKey) 방식이다.
  const headers = call.init.headers as Record<string, string>;
  const expected = Buffer.from("test-client-key:test-secret-key", "utf8").toString("base64");
  assert.equal(headers.Authorization, `Basic ${expected}`);
  assert.equal(headers["Content-Type"], "application/json");
});

test("결과 어디에도 secret이 담기지 않는다", async () => {
  const { impl } = fakeFetch(() =>
    jsonResponse({ resultCode: "2001", status: "cancelled", tid: "tid-123" }),
  );
  const outcome = await cancelNicepayPayment(INPUT, impl);
  const dumped = JSON.stringify(outcome);
  assert.equal(dumped.includes("test-secret-key"), false);
  assert.equal(dumped.includes("Basic "), false);
});

test("unknown이어도 안에서 다시 부르지 않는다", async () => {
  const { impl, calls } = fakeFetch(() => {
    throw new Error("network down");
  });
  const outcome = await cancelNicepayPayment(INPUT, impl);
  assert.equal(outcome.kind, "unknown");
  // 자동 재시도가 있으면 이중 취소가 된다. 호출은 정확히 한 번이어야 한다.
  assert.equal(calls.length, 1);
});
