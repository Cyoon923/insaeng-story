/**
 * 인증번호 재요청 대기시간 countdown (서버 429 Retry-After 기준).
 *
 * 실행: npx tsx --experimental-test-module-mocks --test src/lib/client/useRetryCountdown.test.ts
 *
 * - postApp: 가짜 fetch로 429 + Retry-After 응답을 만들고, 오류에 초가 담기는지 본다.
 * - useRetryCountdown: react 훅만 최소 대역(useState·deps 비교 useEffect·정리)으로 두고,
 *   node:test 가짜 타이머로 1초씩 흘려 보낸다. 실제 시간을 기다리지 않는다.
 * - 문구가 서버 smsRateLimitedMessage와 같은지, 6개 인증 화면이 같은 방식으로 연결됐는지 고정한다.
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { readFileSync } from "node:fs";

type Effect = { deps?: unknown[]; cleanup?: unknown };
let states: unknown[] = [];
let effects: Effect[] = [];
let stateIndex = 0;
let effectIndex = 0;
let pending: (() => void)[] = [];

mock.module("react", {
  namedExports: {
    useState: (init: unknown) => {
      const i = stateIndex++;
      if (!(i in states)) states[i] = init;
      return [
        states[i],
        (value: unknown) => {
          states[i] = typeof value === "function" ? (value as (prev: unknown) => unknown)(states[i]) : value;
        },
      ];
    },
    useEffect: (fn: () => unknown, deps?: unknown[]) => {
      const i = effectIndex++;
      const prev = effects[i];
      if (prev && deps && prev.deps && deps.every((dep, j) => Object.is(dep, prev.deps![j]))) return;
      pending.push(() => {
        if (typeof prev?.cleanup === "function") (prev.cleanup as () => void)();
        effects[i] = { deps, cleanup: fn() };
      });
    },
  },
});

let fetchCalls = 0;
let nextResponse: () => Response = () => new Response("{}");
globalThis.fetch = (async () => {
  fetchCalls += 1;
  return nextResponse();
}) as typeof fetch;

const PHONE = "010-1234-5678";

async function hookModule() {
  return import("./useRetryCountdown.ts");
}

/** 훅을 한 번 그리고 effect를 돌린 결과. */
async function render() {
  // 훅을 테스트 대역 렌더러에서 직접 부른다(이름을 바꿔 둔다).
  const { useRetryCountdown: runHook } = await hookModule();
  stateIndex = 0;
  effectIndex = 0;
  pending = [];
  const hook = runHook();
  const run = pending;
  pending = [];
  for (const fn of run) fn();
  return hook;
}

function reset() {
  for (const effect of effects) {
    if (typeof effect?.cleanup === "function") (effect.cleanup as () => void)();
  }
  states = [];
  effects = [];
}

/** 1초 흘려 보내고 다시 그린다. */
async function tick() {
  mock.timers.tick(1000);
  return render();
}

/** postApp으로 sendCode를 보내 오류를 받는다. */
async function sendCodeError(status: number, headers: Record<string, string>) {
  const { postApp } = await import("./api.ts");
  nextResponse = () =>
    new Response(JSON.stringify({ error: "서버 문구" }), { status, headers });
  try {
    await postApp({ action: "sendCode", purpose: "signup", phone: PHONE });
  } catch (error) {
    return error;
  }
  throw new Error("오류가 나야 한다");
}

test("postApp: 429 + Retry-After는 오류에 초를 담고, 메시지는 서버 문구 그대로다", async () => {
  const { retryAfterSeconds } = await import("./api.ts");
  const error = await sendCodeError(429, { "Retry-After": "338" });
  assert.ok(error instanceof Error);
  assert.equal(error.message, "서버 문구");
  assert.equal(retryAfterSeconds(error), 338);
  // Retry-After가 없거나(쿨다운 등) 429가 아니면 담지 않는다.
  assert.equal(retryAfterSeconds(await sendCodeError(429, {})), null);
  assert.equal(retryAfterSeconds(await sendCodeError(502, { "Retry-After": "30" })), null);
  assert.equal(retryAfterSeconds(await sendCodeError(429, { "Retry-After": "abc" })), null);
});

test("countdown: 시작 → 1초씩 감소 → 0초에 버튼 재활성화, 자동 재요청 없음", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    reset();
    const error = await sendCodeError(429, { "Retry-After": "338" });
    const calls = fetchCalls;
    let hook = await render();
    assert.equal(hook.startFrom(error, PHONE), true);
    hook = await render();
    assert.equal(hook.left(PHONE), 338);
    assert.equal(hook.message(PHONE), "인증번호는 5분 38초 후 다시 요청할 수 있습니다.");
    hook = await tick();
    assert.equal(hook.message(PHONE), "인증번호는 5분 37초 후 다시 요청할 수 있습니다.");
    hook = await tick();
    assert.equal(hook.message(PHONE), "인증번호는 5분 36초 후 다시 요청할 수 있습니다.");
    for (let i = 0; i < 335; i += 1) hook = await tick();
    assert.equal(hook.message(PHONE), "인증번호는 1초 후 다시 요청할 수 있습니다.");
    hook = await tick();
    assert.equal(hook.left(PHONE), 0, "버튼 잠금 해제");
    assert.equal(hook.message(PHONE), "", "안내 문구 제거");
    // 더 흘려도 음수가 되거나 다시 요청하지 않는다.
    for (let i = 0; i < 5; i += 1) hook = await tick();
    assert.equal(hook.left(PHONE), 0);
    assert.equal(fetchCalls, calls, "자동 재요청 없음");
  } finally {
    mock.timers.reset();
  }
});

test("다시 429를 받으면 새 Retry-After로 countdown을 다시 맞춘다", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    reset();
    let hook = await render();
    hook.startFrom(await sendCodeError(429, { "Retry-After": "5" }), PHONE);
    hook = await render();
    hook = await tick();
    assert.equal(hook.left(PHONE), 4);
    hook.startFrom(await sendCodeError(429, { "Retry-After": "2832" }), PHONE);
    hook = await render();
    assert.equal(hook.left(PHONE), 2832);
    assert.equal(hook.message(PHONE), "인증번호는 47분 12초 후 다시 요청할 수 있습니다.");
    hook = await tick();
    assert.equal(hook.left(PHONE), 2831);
  } finally {
    mock.timers.reset();
  }
});

test("Retry-After가 없으면 countdown을 시작하지 않는다(화면은 기존 오류 문구를 쓴다)", async () => {
  reset();
  let hook = await render();
  const error = await sendCodeError(429, {});
  assert.equal(hook.startFrom(error, PHONE), false);
  hook = await render();
  assert.equal(hook.left(PHONE), 0);
  assert.equal(hook.message(PHONE), "");
  assert.equal(hook.startFrom(new Error("네트워크 오류"), PHONE), false);
});

test("제한은 번호별: 다른 번호를 입력하면 잠그지 않는다(같은 번호는 형식이 달라도 같다)", async () => {
  reset();
  let hook = await render();
  hook.startFrom(await sendCodeError(429, { "Retry-After": "60" }), PHONE);
  hook = await render();
  assert.equal(hook.left("01012345678"), 60);
  assert.equal(hook.left("010-9999-8888"), 0);
  assert.equal(hook.message("010-9999-8888"), "");
});

test("문구는 서버 smsRateLimitedMessage와 같다", async () => {
  const { verificationRetryMessage } = await hookModule();
  const { smsRateLimitedMessage } = await import("../server/smsVerification.ts");
  for (const seconds of [1, 42, 59, 60, 61, 338, 2832, 3599, 3600, 3601, 7561, 23 * 3600, 86400]) {
    assert.equal(verificationRetryMessage(seconds), smsRateLimitedMessage(seconds), String(seconds));
  }
});

test("6개 인증번호 요청 흐름이 같은 방식으로 연결되어 있다", () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
  const flows: [string, string][] = [
    ["../../app/signup/page.tsx", "phone"],
    ["../../app/login/page.tsx", "resetPhone"],
    ["../../app/login/page.tsx", "findIdPhone"],
    ["../../app/login/page.tsx", "setIdPhone"],
    ["../../app/social-link/verify-phone/VerifyPhoneForm.tsx", "phone"],
    ["../../app/my/verify-phone/MyVerifyPhoneForm.tsx", "phone"],
  ];
  for (const [path, phone] of flows) {
    const source = read(path);
    assert.match(source, /const retry = useRetryCountdown\(\);/, path);
    // 429 Retry-After면 countdown, 아니면 기존 오류 문구.
    assert.match(source, new RegExp(`if \\(!retry\\.startFrom\\(err, ${phone}\\)\\) \\{`), `${path} ${phone}`);
    // 남은 시간 동안 받기 버튼을 잠근다.
    assert.match(source, new RegExp(`retry\\.left\\(${phone}\\) > 0\\}`), `${path} ${phone}`);
    // 기존 오류가 있으면 그것을, 없으면 countdown 문구를 보인다.
    assert.match(source, new RegExp(`\\{\\w+ \\|\\| retry\\.message\\(${phone}\\)\\}`), `${path} ${phone}`);
  }
});
