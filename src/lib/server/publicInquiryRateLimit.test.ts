/**
 * 공개 문의 반복 요청 제한 (P1-06 Stage 2).
 * 실행: npx tsx --test src/lib/server/publicInquiryRateLimit.test.ts
 *
 * 카운터는 loginAttemptStoreFor와 같은 고정 창 의미의 메모리 대역으로 본다(실제 저장소는
 * SMS 단계에서 실제 PostgreSQL로 검증했다). 세 route의 관문 위치는 소스 순서로 고정한다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  gatePublicInquiry,
  PUBLIC_INQUIRY_LIMITS,
  PUBLIC_INQUIRY_RATE_LIMITED_MESSAGE,
  publicInquiryKey,
} from "./publicInquiryRateLimit.ts";
import type { PublicInquiryScope } from "./publicInquiryRateLimit.ts";
import type { LoginAttemptStore } from "./loginRateLimit.ts";

function fakeStore(clock: { now: number }) {
  const counters = new Map<string, { attempts: number; expiresAt: number }>();
  const store: LoginAttemptStore = {
    hit: async (key, windowMs) => {
      const current = counters.get(key);
      if (!current || current.expiresAt <= clock.now) {
        counters.set(key, { attempts: 1, expiresAt: clock.now + windowMs });
        return 1;
      }
      current.attempts += 1;
      return current.attempts;
    },
    clear: async (key) => {
      counters.delete(key);
    },
  };
  return { store, keys: () => [...counters.keys()] };
}

const IP = "203.0.113.7";

for (const [scope, max] of [
  ["inquiry", 20],
  ["chat", 20],
  ["chatMessage", 60],
] as const) {
  test(`${scope}: IP당 1시간 ${max}회까지 허용, ${max + 1}번째부터 거절, 창이 지나면 다시 허용`, async () => {
    assert.equal(PUBLIC_INQUIRY_LIMITS[scope].max, max);
    const clock = { now: 1_000_000 };
    const { store } = fakeStore(clock);
    for (let i = 0; i < max; i += 1) assert.equal(await gatePublicInquiry(store, scope, IP), true);
    assert.equal(await gatePublicInquiry(store, scope, IP), false);
    assert.equal(await gatePublicInquiry(store, scope, "203.0.113.8"), true, "다른 IP는 따로 센다");
    clock.now += 60 * 60 * 1000;
    assert.equal(await gatePublicInquiry(store, scope, IP), true);
  });
}

test("경로마다 카운터가 따로다", async () => {
  const { store } = fakeStore({ now: 1_000_000 });
  for (let i = 0; i < 20; i += 1) await gatePublicInquiry(store, "inquiry", IP);
  assert.equal(await gatePublicInquiry(store, "inquiry", IP), false);
  assert.equal(await gatePublicInquiry(store, "chat", IP), true);
  assert.equal(await gatePublicInquiry(store, "chatMessage", IP), true);
});

test("IP를 알 수 없으면 세지 않고 허용한다(전역 공유 버킷 없음)", async () => {
  const { store, keys } = fakeStore({ now: 1_000_000 });
  for (let i = 0; i < 100; i += 1) assert.equal(await gatePublicInquiry(store, "chat", "unknown"), true);
  assert.deepEqual(keys(), []);
});

test("저장소가 없으면(파일 모드) 제한하지 않는다", async () => {
  const none: LoginAttemptStore = { hit: async () => null, clear: async () => {} };
  for (let i = 0; i < 100; i += 1) assert.equal(await gatePublicInquiry(none, "inquiry", IP), true);
});

test("키는 경로별 접두어 + IP 해시이고 원문을 담지 않는다", () => {
  for (const scope of ["inquiry", "chat", "chatMessage"] as PublicInquiryScope[]) {
    const key = publicInquiryKey(scope, IP);
    assert.match(key, new RegExp(`^inqrl:${scope}:ip:h:[0-9a-f]{64}$`));
    assert.equal(key.includes(IP), false);
  }
});

test("거절 문구", () => {
  assert.equal(PUBLIC_INQUIRY_RATE_LIMITED_MESSAGE, "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
});

/* ── route 관문 위치(입력 확인 뒤, 저장·쿠키 발급 전) ─────────── */

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const APP = read("../../app/api/app/route.ts");
const CHAT = read("../../app/api/chat-inquiries/route.ts");
const MESSAGES = read("../../app/api/chat-inquiries/me/messages/route.ts");

function order(source: string, ...marks: string[]) {
  const at = marks.map((mark) => source.indexOf(mark));
  for (const [i, value] of at.entries()) assert.ok(value >= 0, `없음: ${marks[i]}`);
  for (let i = 1; i < at.length; i += 1) assert.ok(at[i - 1] < at[i], `순서: ${marks[i - 1]} → ${marks[i]}`);
}

test("createInquiry: 입력 확인 → 관문(429) → 문의 생성·writeData", () => {
  const body = APP.slice(APP.indexOf('if (action === "createInquiry")'));
  order(
    body,
    'error: "문의 내용을 입력해 주세요."',
    'gatePublicInquiry(await defaultLoginAttemptStore(), "inquiry", requestIp(request))',
    "{ error: PUBLIC_INQUIRY_RATE_LIMITED_MESSAGE }, { status: 429 }",
    "const item: Inquiry = {",
    "await writeData(data);",
  );
});

test("POST /api/chat-inquiries: 입력 확인 → 관문(429) → 신원 확인·쿠키 발급·저장", () => {
  order(
    CHAT,
    "normalizeName(name);",
    "normalizeMobilePhone(phone);",
    "isChatContactMethod(contactMethod)",
    "normalizeBody(message);",
    'gatePublicInquiry(await defaultLoginAttemptStore(), "chat", requestIp(request))',
    "{ error: PUBLIC_INQUIRY_RATE_LIMITED_MESSAGE }, { status: 429 }",
    "await getVerifiedUserId();",
    "await ensureGuestTokenHash()",
    "await addCustomerMessage(",
    "await createChatInquiry(",
  );
});

test("POST /api/chat-inquiries/me/messages: 입력·신원 확인 → 관문(429) → 메시지 저장", () => {
  order(
    MESSAGES,
    "if (!inquiryId || message === null)",
    "if (!userId && !guestTokenHash) return notFound();",
    "normalizeBody(message);",
    'gatePublicInquiry(await defaultLoginAttemptStore(), "chatMessage", requestIp(request))',
    "{ error: PUBLIC_INQUIRY_RATE_LIMITED_MESSAGE }, { status: 429 }",
    "await addCustomerMessage(",
  );
});
