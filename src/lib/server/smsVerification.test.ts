/**
 * 인증번호 SMS 발송 제한·검증 원자화 (P1-06 1단계).
 * 실행: npx tsx --test src/lib/server/smsVerification.test.ts
 *
 * DB 없이 본다.
 * - verification_codes: 문장 하나를 한 번에 처리하는 메모리 대역(실제 DB의 행 잠금처럼 문장 단위 원자).
 *   대역이 흉내 내는 조건이 실제 SQL에 있는지는 아래 구조 테스트가 소스로 고정한다.
 * - 횟수 제한 카운터: loginAttemptStoreFor와 같은 고정 창 의미의 메모리 저장소.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { verifyCodeWith } from "./verificationCodes.ts";
import type { VerificationSql } from "./verificationCodes.ts";
import {
  gateSmsSend,
  runSendCode,
  SMS_SEND_LIMITS,
  smsIpHourKey,
  smsPhoneDayKey,
  smsPhoneHourKey,
  smsRateLimitedMessage,
  smsSendBlock,
  SMS_RATE_LIMITED_MESSAGE,
} from "./smsVerification.ts";
import type { SendCodeDeps } from "./smsVerification.ts";
import type { LoginAttemptStore } from "./loginRateLimit.ts";

const MAX = 5;
const COOLDOWN_MS = 60 * 1000;
const TTL_MS = 5 * 60 * 1000;
const KEY = "code:signup:01012345678";

/* ── verification_codes 대역 ─────────────────────────── */

interface Row {
  code: string;
  expiresAt: number;
  attempts: number;
  sentAt: number | null;
}

function fakeTable(clock: { now: number }) {
  const rows = new Map<string, Row>();
  /** 코드를 실제로 대조할 수 있었던(시도권을 받은) 횟수. */
  let claims = 0;
  const sql: VerificationSql = {
    query: async (text, params) => {
      // 다른 요청이 사이에 끼어들 수 있게 한 박자 쉰 뒤, 문장 하나는 한 번에 처리한다.
      await Promise.resolve();
      const key = params[0] as string;
      const row = rows.get(key);
      const live = row && row.expiresAt > clock.now;
      if (text.includes("SET attempts = attempts + 1")) {
        if (!live || row.attempts >= (params[1] as number)) return [];
        row.attempts += 1;
        claims += 1;
        return [{ code: row.code, attempts: row.attempts }];
      }
      if (text.includes("SELECT attempts FROM verification_codes")) {
        return live ? [{ attempts: row.attempts }] : [];
      }
      if (text.includes("DELETE FROM verification_codes")) {
        if (!live || row.code !== params[1]) return [];
        rows.delete(key);
        return [{ storage_key: key }];
      }
      throw new Error(`unexpected sql: ${text}`);
    },
  };
  /** 기존 issueCode의 UPSERT 의미: 쿨다운이 지났거나 행이 없을 때만 새로 쓴다(attempts = 0). */
  function issue(code: string): boolean {
    const row = rows.get(KEY);
    if (row && row.sentAt !== null && row.sentAt > clock.now - COOLDOWN_MS) return false;
    rows.set(KEY, { code, expiresAt: clock.now + TTL_MS, attempts: 0, sentAt: clock.now });
    return true;
  }
  function cooldownLeft(): number {
    const row = rows.get(KEY);
    if (!row || row.expiresAt <= clock.now || !row.sentAt) return 0;
    const left = row.sentAt + COOLDOWN_MS - clock.now;
    return left > 0 ? Math.ceil(left / 1000) : 0;
  }
  return { sql, rows, issue, cooldownLeft, claims: () => claims };
}

const verify = (sql: VerificationSql, input: string) =>
  verifyCodeWith(sql, { storageKey: KEY, input, maxAttempts: MAX });

/* ── 횟수 제한 카운터 대역 ───────────────────────────── */

function fakeStore(clock: { now: number }) {
  const counters = new Map<string, { attempts: number; expiresAt: number }>();
  const hit = (key: string, windowMs: number) => {
    const current = counters.get(key);
    if (!current || current.expiresAt <= clock.now) {
      counters.set(key, { attempts: 1, expiresAt: clock.now + windowMs });
      return 1;
    }
    // 막힌 요청도 횟수만 늘고 창의 끝(expiresAt)은 그대로다.
    current.attempts += 1;
    return current.attempts;
  };
  const store: LoginAttemptStore = {
    hit: async (key, windowMs) => hit(key, windowMs),
    hitWithWait: async (key, windowMs) => {
      const attempts = hit(key, windowMs);
      return { attempts, waitMs: counters.get(key)!.expiresAt - clock.now };
    },
    clear: async (key) => {
      counters.delete(key);
    },
  };
  return {
    store,
    count: (key: string) => counters.get(key)?.attempts ?? 0,
    expiresAt: (key: string) => counters.get(key)?.expiresAt,
  };
}

/* ── 1. 검증 원자화 ──────────────────────────────────── */

test("오답 5회 후에도 행이 남아 즉시 재발송은 쿨다운에 걸린다(우회 차단)", async () => {
  const clock = { now: 1_000_000 };
  const t = fakeTable(clock);
  assert.equal(t.issue("111111"), true);
  for (let i = 0; i < MAX; i += 1) assert.equal((await verify(t.sql, "000000")).ok, false);
  assert.equal(t.rows.get(KEY)?.attempts, MAX);
  assert.ok(t.rows.has(KEY), "소진된 행을 지우지 않는다");
  assert.ok(t.cooldownLeft() > 0);
  assert.equal(t.issue("222222"), false);
});

test("쿨다운이 지나면 새 코드가 attempts 0으로 발급되고 다시 검증된다", async () => {
  const clock = { now: 1_000_000 };
  const t = fakeTable(clock);
  t.issue("111111");
  for (let i = 0; i < MAX; i += 1) await verify(t.sql, "000000");
  clock.now += COOLDOWN_MS;
  assert.equal(t.cooldownLeft(), 0);
  assert.equal(t.issue("222222"), true);
  assert.equal(t.rows.get(KEY)?.attempts, 0);
  assert.deepEqual(await verify(t.sql, "222222"), { ok: true });
});

test("오답을 동시에 20건 보내도 코드 대조는 최대 5회", async () => {
  const t = fakeTable({ now: 1_000_000 });
  t.issue("111111");
  const results = await Promise.all(Array.from({ length: 20 }, () => verify(t.sql, "000000")));
  assert.equal(t.claims(), MAX);
  assert.equal(results.filter((item) => item.ok).length, 0);
  assert.equal(t.rows.get(KEY)?.attempts, MAX);
});

test("정답을 동시에 2건 보내면 1건만 성공한다", async () => {
  const t = fakeTable({ now: 1_000_000 });
  t.issue("111111");
  const results = await Promise.all([verify(t.sql, "111111"), verify(t.sql, "111111")]);
  assert.equal(results.filter((item) => item.ok).length, 1);
  assert.equal(t.rows.has(KEY), false);
});

test("소진 뒤 정답을 넣어도 대조 없이 시도 초과로 실패한다", async () => {
  const t = fakeTable({ now: 1_000_000 });
  t.issue("111111");
  for (let i = 0; i < MAX; i += 1) await verify(t.sql, "000000");
  const claimsBefore = t.claims();
  const result = await verify(t.sql, "111111");
  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.error, /시도 횟수를 초과/);
  assert.equal(t.claims(), claimsBefore);
  assert.ok(t.rows.has(KEY));
});

test("5번째 오답은 시도 초과 문구, 그 전에는 기존 문구", async () => {
  const t = fakeTable({ now: 1_000_000 });
  t.issue("111111");
  for (let i = 1; i < MAX; i += 1) {
    assert.deepEqual(await verify(t.sql, "000000"), { ok: false, error: "인증번호가 올바르지 않습니다." });
  }
  const last = await verify(t.sql, "000000");
  assert.match(last.ok ? "" : last.error, /시도 횟수를 초과/);
});

test("만료된 코드는 정답이어도 실패하고 소비하지 않는다", async () => {
  const clock = { now: 1_000_000 };
  const t = fakeTable(clock);
  t.issue("111111");
  clock.now += TTL_MS;
  assert.deepEqual(await verify(t.sql, "111111"), { ok: false, error: "인증번호가 올바르지 않습니다." });
  assert.equal(t.claims(), 0);
});

test("빈 입력·없는 키는 실패", async () => {
  const t = fakeTable({ now: 1_000_000 });
  assert.equal((await verify(t.sql, "111111")).ok, false);
  t.issue("111111");
  assert.equal((await verify(t.sql, "")).ok, false);
});

/* ── 2. 발송 제한 ────────────────────────────────────── */

function sendHarness(clock: { now: number }, overrides: Partial<SendCodeDeps> = {}) {
  const { store, count } = fakeStore(clock);
  const calls = { issue: 0, send: 0, deleteIssued: 0 };
  const deps: SendCodeDeps = {
    cooldownLeft: async () => 0,
    store,
    issueCode: async () => {
      calls.issue += 1;
      return { ok: true };
    },
    send: async () => {
      calls.send += 1;
    },
    deleteIssued: async () => {
      calls.deleteIssued += 1;
    },
    ...overrides,
  };
  return { deps, calls, count };
}

const PHONE = "01012345678";
const IP = "203.0.113.7";

test("목적을 바꿔 가며 보내도 같은 번호는 1시간 5회에서 막힌다(발송·저장 없음)", async () => {
  const clock = { now: 1_000_000 };
  const h = sendHarness(clock);
  // 목적별 키는 다르지만 번호 카운터는 하나다(쿨다운은 목적별이라 매번 0).
  for (let i = 0; i < SMS_SEND_LIMITS.phoneHour.max; i += 1) {
    assert.equal((await runSendCode({ phone: PHONE, ip: IP }, h.deps)).kind, "sent");
  }
  assert.equal((await runSendCode({ phone: PHONE, ip: IP }, h.deps)).kind, "rate-limited");
  assert.equal(h.calls.issue, SMS_SEND_LIMITS.phoneHour.max);
  assert.equal(h.calls.send, SMS_SEND_LIMITS.phoneHour.max);
});

test("같은 번호는 24시간 10회에서 막힌다", async () => {
  const clock = { now: 1_000_000 };
  const h = sendHarness(clock);
  let sent = 0;
  for (let hour = 0; hour < 3; hour += 1) {
    for (let i = 0; i < SMS_SEND_LIMITS.phoneHour.max; i += 1) {
      if ((await runSendCode({ phone: PHONE, ip: IP }, h.deps)).kind === "sent") sent += 1;
    }
    clock.now += 60 * 60 * 1000;
  }
  assert.equal(sent, SMS_SEND_LIMITS.phoneDay.max);
  assert.equal(h.calls.send, SMS_SEND_LIMITS.phoneDay.max);
});

test("번호를 바꿔도 같은 IP는 1시간 20회에서 막힌다", async () => {
  const h = sendHarness({ now: 1_000_000 });
  const kinds: string[] = [];
  for (let i = 0; i < SMS_SEND_LIMITS.ipHour.max + 3; i += 1) {
    kinds.push((await runSendCode({ phone: `0101000${String(i).padStart(4, "0")}`, ip: IP }, h.deps)).kind);
  }
  assert.equal(kinds.filter((kind) => kind === "sent").length, SMS_SEND_LIMITS.ipHour.max);
  assert.deepEqual(kinds.slice(SMS_SEND_LIMITS.ipHour.max), ["rate-limited", "rate-limited", "rate-limited"]);
  assert.equal(h.calls.send, SMS_SEND_LIMITS.ipHour.max);
});

test("쿨다운 중 재요청은 카운터를 세지 않고 저장·발송도 하지 않는다", async () => {
  const h = sendHarness({ now: 1_000_000 }, { cooldownLeft: async () => 42 });
  for (let i = 0; i < 10; i += 1) {
    assert.deepEqual(await runSendCode({ phone: PHONE, ip: IP }, h.deps), { kind: "cooldown", waitSeconds: 42 });
  }
  assert.equal(h.count(smsPhoneHourKey(PHONE)), 0);
  assert.equal(h.count(smsPhoneDayKey(PHONE)), 0);
  assert.equal(h.count(smsIpHourKey(IP)), 0);
  assert.deepEqual(h.calls, { issue: 0, send: 0, deleteIssued: 0 });
});

test("issueCode가 동시 요청에 져서 쿨다운이면 발송하지 않는다", async () => {
  const h = sendHarness({ now: 1_000_000 }, { issueCode: async () => ({ ok: false, waitSeconds: 59 }) });
  assert.deepEqual(await runSendCode({ phone: PHONE, ip: IP }, h.deps), { kind: "cooldown", waitSeconds: 59 });
  assert.equal(h.calls.send, 0);
});

test("SMS 발송 실패 → 방금 저장한 코드만 지우고 카운터는 그대로", async () => {
  const h = sendHarness({ now: 1_000_000 }, {
    send: async () => {
      throw new Error("solapi");
    },
  });
  assert.deepEqual(await runSendCode({ phone: PHONE, ip: IP }, h.deps), { kind: "send-failed" });
  assert.equal(h.calls.deleteIssued, 1);
  assert.equal(h.count(smsPhoneHourKey(PHONE)), 1);
  assert.equal(h.count(smsIpHourKey(IP)), 1);
});

test("IP를 알 수 없으면 IP 제한은 생략하고 번호 제한만 적용한다", async () => {
  const h = sendHarness({ now: 1_000_000 });
  for (let i = 0; i < SMS_SEND_LIMITS.ipHour.max + 5; i += 1) {
    assert.equal(
      (await runSendCode({ phone: `0102000${String(i).padStart(4, "0")}`, ip: "unknown" }, h.deps)).kind,
      "sent",
    );
  }
  assert.equal(h.count(smsIpHourKey("unknown")), 0);
  for (let i = 0; i < SMS_SEND_LIMITS.phoneHour.max; i += 1) {
    await runSendCode({ phone: PHONE, ip: "unknown" }, h.deps);
  }
  assert.equal((await runSendCode({ phone: PHONE, ip: "unknown" }, h.deps)).kind, "rate-limited");
});

test("개발 환경(send = null)은 발송 없이 sent", async () => {
  const h = sendHarness({ now: 1_000_000 }, { send: null });
  assert.equal((await runSendCode({ phone: PHONE, ip: IP }, h.deps)).kind, "sent");
  assert.equal(h.calls.issue, 1);
});

test("저장소가 없으면(파일 모드) 제한하지 않는다", async () => {
  const none: LoginAttemptStore = { hit: async () => null, clear: async () => {} };
  for (let i = 0; i < 30; i += 1) assert.equal(await gateSmsSend(none, PHONE, IP), true);
});

test("카운터 키에 번호·IP 원문이 들어가지 않는다", () => {
  for (const key of [smsPhoneHourKey(PHONE), smsPhoneDayKey(PHONE), smsIpHourKey(IP)]) {
    assert.match(key, /^smsrl:(phone:h|phone:d|ip:h):[0-9a-f]{64}$/);
    assert.equal(key.includes(PHONE) || key.includes(IP), false);
  }
});

/* ── 3. 구조(실제 SQL·route 연결) ─────────────────────── */

const CODES = readFileSync(new URL("./verificationCodes.ts", import.meta.url), "utf8");
const ROUTE = readFileSync(new URL("../../app/api/app/route.ts", import.meta.url), "utf8");
const squash = (text: string) => text.replace(/\s+/g, " ");

test("verifyCodeWith: 대조 전 선점 UPDATE에 만료·시도 한도 조건이 있다", () => {
  const body = squash(CODES.slice(CODES.indexOf("export async function verifyCodeWith(")));
  assert.match(
    body,
    /UPDATE verification_codes SET attempts = attempts \+ 1 WHERE storage_key = \$1 AND expires_at > now\(\) AND attempts < \$2 RETURNING code, attempts/,
  );
  assert.match(body, /DELETE FROM verification_codes WHERE storage_key = \$1 AND code = \$2 AND expires_at > now\(\) RETURNING storage_key/);
  // 소비에 성공한 경우에만 ok
  assert.match(body, /return consumed\[0\] \? \{ ok: true \}/);
  // 소진된 행을 지우는 문장이 없다(쿨다운 근거 유지)
  const beforeConsume = body.slice(0, body.indexOf("// consumeVerification과 같은 조건의 소비"));
  assert.ok(beforeConsume.length > 0);
  assert.doesNotMatch(beforeConsume, /DELETE FROM verification_codes/);
});

test("issueCode는 재발송 때 attempts를 0으로 되돌리고 쿨다운 조건은 그대로다", () => {
  const body = squash(CODES.slice(CODES.indexOf("export async function issueCode("), CODES.indexOf("export async function putToken(")));
  assert.match(body, /attempts = 0, sent_at = EXCLUDED\.sent_at WHERE verification_codes\.sent_at IS NULL OR verification_codes\.sent_at <= to_timestamp\(\$5\)/);
});

test("route: verifyCode는 DB 모드에서 원자 검증을 먼저 쓰고, 파일 모드만 checkCode로 간다", () => {
  const body = ROUTE.slice(ROUTE.indexOf('if (action === "verifyCode")'));
  const atomic = body.indexOf("verifyCodeInTable(");
  const legacy = body.indexOf("checkCode(");
  assert.ok(atomic > 0 && legacy > atomic);
  assert.ok(body.indexOf("if (!verified) {") < legacy);
  assert.match(body, /else if \(!\(await consumeVerification\(codeKey, verifyInput\)\)\)/);
});

test("route: sendCode는 runSendCode를 거치고 IP는 requestIp에서 얻는다", () => {
  const body = ROUTE.slice(ROUTE.indexOf('if (action === "sendCode")'), ROUTE.indexOf('if (action === "verifyCode")'));
  assert.match(body, /runSendCode\(\s*\{ phone, ip: requestIp\(request\) \}/);
  assert.match(body, /store: await defaultLoginAttemptStore\(\)/);
  // 제한 문구는 남은 시간(waitSeconds)으로 만들고, 알면 Retry-After(초)도 단다.
  assert.match(body, /error: smsRateLimitedMessage\(outcome\.waitSeconds\)/);
  assert.match(body, /"Retry-After": String\(outcome\.waitSeconds\)/);
  // SMS 발송은 runSendCode 안(send)에서만 일어난다.
  assert.equal(body.split("sendVerificationSms(").length - 1, 1);
});

test("목적 5개(signup/reset/link/setid/findid)가 같은 sendCode·verifyCode 경로를 탄다", () => {
  assert.match(ROUTE, /const VERIFY_PURPOSES = \["signup", "reset", "link", "setid", "findid"\] as const;/);
});

/* ── 3. 남은 대기시간 ────────────────────────────────── */

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

test("남은 시간 문구: 초 / 분·초 / 시간·분, 모르면 기존 문구", () => {
  assert.equal(smsRateLimitedMessage(42), "인증번호는 42초 후 다시 요청할 수 있습니다.");
  assert.equal(smsRateLimitedMessage(60), "인증번호는 1분 후 다시 요청할 수 있습니다.");
  assert.equal(smsRateLimitedMessage(47 * 60 + 12), "인증번호는 47분 12초 후 다시 요청할 수 있습니다.");
  // 1시간 이상은 분 단위로 올린다(안내보다 일찍 풀리는 쪽이 안전하다).
  assert.equal(smsRateLimitedMessage(2 * 3600 + 5 * 60 + 1), "인증번호는 2시간 6분 후 다시 요청할 수 있습니다.");
  assert.equal(smsRateLimitedMessage(23 * 3600), "인증번호는 23시간 후 다시 요청할 수 있습니다.");
  assert.equal(smsRateLimitedMessage(null), SMS_RATE_LIMITED_MESSAGE);
});

test("1시간 5회 초과: 창 끝까지 남은 시간(60초 이하)을 돌려준다", async () => {
  const clock = { now: 1_000_000 };
  const h = sendHarness(clock);
  for (let i = 0; i < SMS_SEND_LIMITS.phoneHour.max; i += 1) await runSendCode({ phone: PHONE, ip: IP }, h.deps);
  clock.now += HOUR_MS - 42 * 1000;
  assert.deepEqual(await runSendCode({ phone: PHONE, ip: IP }, h.deps), { kind: "rate-limited", waitSeconds: 42 });
});

test("1시간 5회 초과: 분·초 단위 남은 시간", async () => {
  const clock = { now: 1_000_000 };
  const h = sendHarness(clock);
  for (let i = 0; i < SMS_SEND_LIMITS.phoneHour.max; i += 1) await runSendCode({ phone: PHONE, ip: IP }, h.deps);
  clock.now += 12 * MINUTE_MS + 48 * 1000;
  assert.deepEqual(await runSendCode({ phone: PHONE, ip: IP }, h.deps), {
    kind: "rate-limited",
    waitSeconds: 47 * 60 + 12,
  });
});

test("여러 제한에 동시에 걸리면 가장 늦게 풀리는 창을 기준으로 한다", async () => {
  const clock = { now: 1_000_000 };
  const { store, expiresAt } = fakeStore(clock);
  // 24시간 창을 먼저 열어 두고, 1시간 창은 나중에 열리게 한다.
  for (let i = 0; i < SMS_SEND_LIMITS.phoneDay.max; i += 1) {
    await smsSendBlock(store, PHONE, IP);
    if (i === 4) clock.now += HOUR_MS; // 1시간 창이 한 번 끝나고 새로 시작한다.
  }
  const block = await smsSendBlock(store, PHONE, IP);
  assert.equal(block.blocked, true);
  const dayEnd = expiresAt(smsPhoneDayKey(PHONE))!;
  const hourEnd = expiresAt(smsPhoneHourKey(PHONE))!;
  assert.ok(dayEnd > hourEnd, "24시간 창이 더 늦게 끝나는 상황");
  assert.equal(block.blocked && block.waitSeconds, Math.ceil((dayEnd - clock.now) / 1000));
});

test("막힌 요청은 창의 끝을 늘리지 않는다(남은 시간이 그대로 줄어든다)", async () => {
  const clock = { now: 1_000_000 };
  const { store, expiresAt } = fakeStore(clock);
  for (let i = 0; i < SMS_SEND_LIMITS.phoneHour.max; i += 1) await smsSendBlock(store, PHONE, IP);
  const end = expiresAt(smsPhoneHourKey(PHONE));
  const first = await smsSendBlock(store, PHONE, IP);
  clock.now += 10 * MINUTE_MS;
  const second = await smsSendBlock(store, PHONE, IP);
  assert.equal(expiresAt(smsPhoneHourKey(PHONE)), end);
  assert.ok(first.blocked && second.blocked);
  assert.equal(first.blocked && second.blocked && first.waitSeconds! - second.waitSeconds!, 10 * 60);
  // 창이 끝나면 다시 보낼 수 있다(1시간 창만 걸려 있었으므로).
  clock.now = end!;
  assert.equal((await smsSendBlock(store, PHONE, IP)).blocked, false);
});

test("남은 시간을 주지 못하는 저장소(hit만)는 막되 waitSeconds는 null(기존 문구)", async () => {
  const clock = { now: 1_000_000 };
  const { store } = fakeStore(clock);
  const hitOnly: LoginAttemptStore = { hit: store.hit, clear: store.clear };
  for (let i = 0; i < SMS_SEND_LIMITS.phoneHour.max; i += 1) await smsSendBlock(hitOnly, PHONE, IP);
  assert.deepEqual(await smsSendBlock(hitOnly, PHONE, IP), { blocked: true, waitSeconds: null });
  assert.equal(await gateSmsSend(hitOnly, PHONE, IP), false);
});
