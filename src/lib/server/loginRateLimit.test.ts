/**
 * 로그인 반복 시도 제한 테스트. 실행: node --test src/lib/server/loginRateLimit.test.ts
 *
 * DB 없이 UPSERT와 같은 규칙(창 안 +1, 창이 끝나면 1부터)을 따르는 가짜 저장소로 본다.
 * route는 DB 드라이버를 불러오므로 원문으로 확인한다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  accountAttemptKey,
  adminAttemptKey,
  clientIp,
  gateAdminLogin,
  gatePasswordLogin,
  ipAttemptKey,
  LOGIN_LIMITS,
  loginAttemptStoreFor,
} from "./loginRateLimit.ts";
import type { LoginAttemptStore } from "./loginRateLimit.ts";

const IP = "203.0.113.7";

/** verification_codes UPSERT와 같은 규칙의 메모리 저장소. now를 옮겨 창 만료를 흉내 낸다. */
function fakeStore() {
  const rows = new Map<string, { attempts: number; expiresAt: number }>();
  let now = 0;
  const store: LoginAttemptStore = {
    hit: async (key, windowMs) => {
      const row = rows.get(key);
      if (!row || row.expiresAt <= now) {
        rows.set(key, { attempts: 1, expiresAt: now + windowMs });
        return 1;
      }
      row.attempts += 1;
      return row.attempts;
    },
    clear: async (key) => {
      rows.delete(key);
    },
  };
  return {
    store,
    rows,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

async function tryLogin(store: LoginAttemptStore, loginId: string, ip = IP) {
  return gatePasswordLogin(store, loginId, ip);
}

test("일반: 계정+IP 10회까지 통과, 11번째 차단", async () => {
  const h = fakeStore();
  for (let i = 1; i <= LOGIN_LIMITS.account.max; i += 1) {
    assert.equal((await tryLogin(h.store, "hong")).ok, true, `${i}회째`);
  }
  assert.equal((await tryLogin(h.store, "hong")).ok, false);
  // 같은 IP의 다른 아이디는 계정 키가 달라 아직 통과한다(IP 전체는 11회라 한도 안).
  assert.equal((await tryLogin(h.store, "kim")).ok, true);
});

test("일반: IP 전체 50회까지 통과, 51번째 차단(아이디를 바꿔도)", async () => {
  const h = fakeStore();
  for (let i = 1; i <= LOGIN_LIMITS.ip.max; i += 1) {
    assert.equal((await tryLogin(h.store, `user${i}`)).ok, true, `${i}회째`);
  }
  assert.equal((await tryLogin(h.store, "brand-new")).ok, false);
  // 다른 IP는 영향 없음
  assert.equal((await tryLogin(h.store, "brand-new", "198.51.100.9")).ok, true);
});

test("일반: 창(15분)이 끝나면 1부터 다시 센다", async () => {
  const h = fakeStore();
  for (let i = 0; i <= LOGIN_LIMITS.account.max; i += 1) await tryLogin(h.store, "hong");
  assert.equal((await tryLogin(h.store, "hong")).ok, false);
  h.advance(LOGIN_LIMITS.account.windowMs);
  assert.equal((await tryLogin(h.store, "hong")).ok, true);
  assert.equal(h.rows.get(accountAttemptKey("hong", IP))?.attempts, 1);
});

test("일반: 없는 아이디도 같은 규칙으로 센다(존재 여부와 무관한 키)", async () => {
  const h = fakeStore();
  for (let i = 0; i < LOGIN_LIMITS.account.max; i += 1) await tryLogin(h.store, "no-such-user");
  assert.equal((await tryLogin(h.store, "no-such-user")).ok, false);
  // 관문은 회원 목록을 받지 않는다. 입력 아이디와 IP만으로 판정한다.
  assert.equal(gatePasswordLogin.length, 3);
});

test("일반: 성공 뒤 계정+IP만 지우고 IP 전체 기록은 남긴다", async () => {
  const h = fakeStore();
  for (let i = 0; i < 5; i += 1) await tryLogin(h.store, "hong");
  const gate = await tryLogin(h.store, "hong");
  assert.ok(gate.ok);
  await h.store.clear(gate.accountKey);
  assert.equal(h.rows.has(accountAttemptKey("hong", IP)), false);
  assert.equal(h.rows.get(ipAttemptKey(IP))?.attempts, 6);
});

test("관리자: IP 5회까지 통과, 6번째 차단, 성공 뒤 clear로 초기화", async () => {
  const h = fakeStore();
  for (let i = 1; i <= LOGIN_LIMITS.admin.max; i += 1) {
    assert.equal((await gateAdminLogin(h.store, IP)).ok, true, `${i}회째`);
  }
  assert.equal((await gateAdminLogin(h.store, IP)).ok, false);
  h.advance(LOGIN_LIMITS.admin.windowMs);
  const gate = await gateAdminLogin(h.store, IP);
  assert.ok(gate.ok);
  await h.store.clear(gate.adminKey);
  assert.equal(h.rows.has(adminAttemptKey(IP)), false);
  // 관리자 키와 일반 로그인 키는 섞이지 않는다.
  assert.notEqual(adminAttemptKey(IP), ipAttemptKey(IP));
});

test("storage key에 아이디·IP 원문이 없다(해시만)", () => {
  for (const key of [accountAttemptKey("hong-gildong", IP), ipAttemptKey(IP), adminAttemptKey(IP)]) {
    assert.match(key, /^loginrl:(acct|ip|admin):[0-9a-f]{64}$/);
    assert.equal(key.includes("hong"), false);
    assert.equal(key.includes("203.0.113"), false);
  }
  // 아이디가 다르거나 IP가 다르면 다른 키
  assert.notEqual(accountAttemptKey("a", IP), accountAttemptKey("b", IP));
  assert.notEqual(accountAttemptKey("a", IP), accountAttemptKey("a", "198.51.100.9"));
});

function headers(values: Record<string, string>) {
  return new Headers(values);
}

test("IP: Vercel에서만 헤더를 믿고, x-forwarded-for 첫 값 → x-real-ip 순", () => {
  assert.equal(clientIp(headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }), true), "203.0.113.7");
  assert.equal(clientIp(headers({ "x-real-ip": "198.51.100.9" }), true), "198.51.100.9");
  assert.equal(clientIp(headers({ "x-forwarded-for": "2001:db8::1" }), true), "2001:db8::1");
  // Vercel 밖에서는 헤더를 무시한다(위조 가능).
  assert.equal(clientIp(headers({ "x-forwarded-for": "203.0.113.7" }), false), "unknown");
  // 형식이 아니면 unknown
  assert.equal(clientIp(headers({ "x-forwarded-for": "not-an-ip" }), true), "unknown");
  assert.equal(clientIp(headers({ "x-forwarded-for": "' OR 1=1 --" }), true), "unknown");
  assert.equal(clientIp(headers({}), true), "unknown");
});

test("DB 없는 환경(파일 모드): 세지도 막지도 않는다", async () => {
  const store = loginAttemptStoreFor(null);
  for (let i = 0; i < 100; i += 1) {
    assert.equal((await gatePasswordLogin(store, "hong", IP)).ok, true);
    assert.equal((await gateAdminLogin(store, IP)).ok, true);
  }
});

test("DB 저장소: 원자적 UPSERT(창 만료 시 1) + RETURNING, clear는 정확한 키 삭제", async () => {
  const calls: { text: string; params: unknown[] }[] = [];
  let ensured = 0;
  const store = loginAttemptStoreFor(
    {
      query: async (text, params) => {
        calls.push({ text, params });
        return [{ attempts: "3" }];
      },
    },
    async () => {
      ensured += 1;
    },
  );
  assert.equal(await store.hit("loginrl:ip:abc", 900000), 3);
  await store.clear("loginrl:ip:abc");
  assert.equal(ensured, 2);
  assert.match(calls[0].text, /INSERT INTO verification_codes/);
  assert.match(calls[0].text, /ON CONFLICT \(storage_key\) DO UPDATE/);
  assert.match(calls[0].text, /WHEN verification_codes\.expires_at <= now\(\) THEN 1/);
  assert.match(calls[0].text, /RETURNING attempts/);
  assert.deepEqual(calls[0].params, ["loginrl:ip:abc", 900000]);
  assert.match(calls[1].text, /DELETE FROM verification_codes WHERE storage_key = \$1/);
  assert.deepEqual(calls[1].params, ["loginrl:ip:abc"]);
});

test("DB 저장소 hitWithWait: hit과 같은 UPSERT에 DB 시계 기준 남은 시간(ms)을 함께 돌려준다", async () => {
  const calls: { text: string; params: unknown[] }[] = [];
  const store = loginAttemptStoreFor({
    query: async (text, params) => {
      calls.push({ text, params });
      return [{ attempts: "6", wait_ms: "2832000" }];
    },
  });
  await store.hit("smsrl:phone:h:abc", 3600000);
  assert.deepEqual(await store.hitWithWait!("smsrl:phone:h:abc", 3600000), { attempts: 6, waitMs: 2832000 });
  // RETURNING 앞의 UPSERT(고정 창 의미)는 hit과 글자 하나 다르지 않다.
  const [hitUpsert, waitUpsert] = calls.map((call) => call.text.split("RETURNING")[0]);
  assert.equal(waitUpsert, hitUpsert);
  assert.match(calls[1].text, /RETURNING attempts, GREATEST\(0, CEIL\(EXTRACT\(EPOCH FROM \(expires_at - now\(\)\)\) \* 1000\)\)::bigint AS wait_ms/);
  assert.deepEqual(calls[1].params, ["smsrl:phone:h:abc", 3600000]);
  assert.equal(await loginAttemptStoreFor(null).hitWithWait!("k", 1000), null);
});

const APP = readFileSync(new URL("../../app/api/app/route.ts", import.meta.url), "utf8");
const ADMIN = readFileSync(new URL("../../app/api/admin/route.ts", import.meta.url), "utf8");

function block(src: string, marker: string): string {
  const start = src.indexOf(marker);
  assert.ok(start >= 0, marker);
  return src.slice(start, src.indexOf("\n  if (action ===", start + marker.length));
}

test("passwordLogin: 관문이 비밀번호 확인보다 앞, 429 같은 문구, 성공 때 계정 키만 clear", () => {
  const b = block(APP, 'if (action === "passwordLogin")');
  assert.ok(b.indexOf("gatePasswordLogin(") < b.indexOf("verifyPassword("));
  assert.match(b, /\{ error: LOGIN_RATE_LIMITED_MESSAGE \}, \{ status: 429 \}/);
  // 기존 실패 문구 하나(아이디 없음·비밀번호 틀림 구분 없음)는 그대로다.
  assert.equal((b.match(/아이디 또는 비밀번호가 올바르지 않습니다\./g) ?? []).length, 1);
  assert.match(b, /loginAttempts\.clear\(loginGate\.accountKey\)/);
  assert.ok(b.indexOf("loginAttempts.clear(") < b.indexOf("setUserId("));
  assert.equal(/ipAttemptKey|clear\(ipAttemptKey/.test(b), false);
});

test("관리자 login: 관문이 비밀번호 비교보다 앞, 성공 때 IP 키 clear", () => {
  const b = block(ADMIN, 'if (action === "login")');
  assert.ok(b.indexOf("gateAdminLogin(") < b.indexOf("password !== adminPassword"));
  assert.match(b, /\{ error: LOGIN_RATE_LIMITED_MESSAGE \}, \{ status: 429 \}/);
  assert.ok(b.indexOf("loginAttempts.clear(loginGate.adminKey)") > b.indexOf("setAdminAuthenticated()"));
  // 기존 실패·미설정 응답은 그대로
  assert.match(b, /비밀번호가 올바르지 않습니다\." \}, \{ status: 401 \}/);
  assert.match(b, /관리자 로그인을 사용할 수 없습니다\." \}, \{ status: 503 \}/);
});

test("소셜(카카오·네이버) 로그인에는 적용하지 않았다", () => {
  for (const file of ["../../app/api/auth/kakao/callback/route.ts", "../../app/api/auth/naver/callback/route.ts"]) {
    const src = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.equal(src.includes("loginRateLimit"), false, file);
  }
});
