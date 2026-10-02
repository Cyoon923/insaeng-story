/**
 * 신청서 draft 주인 표식 쿠키 (P1-07).
 *
 * 실행: npx tsx --experimental-test-module-mocks --test src/lib/server/sessionDraftOwner.test.ts
 *
 * setUserId가 세션 쿠키와 같은 수명·범위로 표식 쿠키를 심고, clearUserId가 함께 지우는지 본다.
 * 표식 값은 회원별 HMAC이며 userId 원문을 담지 않는다. 서버는 이 쿠키를 읽지 않는다.
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { readFileSync } from "node:fs";

type CookieOptions = Record<string, unknown>;
const sets: { name: string; value: string; options: CookieOptions }[] = [];
const deletes: string[] = [];

mock.module("next/headers", {
  namedExports: {
    cookies: async () => ({
      get: () => undefined,
      set: (name: string, value: string, options: CookieOptions) => {
        sets.push({ name, value, options });
      },
      delete: (name: string) => {
        deletes.push(name);
      },
    }),
  },
});

async function session() {
  return import("./session.ts");
}

const USER = "u-1700000000-abc";

test("setUserId: 세션 쿠키와 같은 정책으로 draft 주인 표식 쿠키를 함께 심는다(httpOnly만 false)", async () => {
  sets.length = 0;
  const { setUserId, __sessionInternals } = await session();
  assert.equal(await setUserId(USER), true);
  const sessionCookie = sets.find((item) => item.name === "insaeng_uid");
  const ownerCookie = sets.find((item) => item.name === __sessionInternals.DRAFT_OWNER_COOKIE);
  assert.ok(sessionCookie && ownerCookie);
  assert.equal(ownerCookie.options.httpOnly, false);
  assert.equal(sessionCookie.options.httpOnly, true);
  for (const key of ["sameSite", "secure", "path", "maxAge"]) {
    assert.equal(ownerCookie.options[key], sessionCookie.options[key], key);
  }
});

test("표식 값은 회원별 HMAC: 같은 회원은 같고, 다른 회원은 다르며, userId 원문을 담지 않는다", async () => {
  sets.length = 0;
  const { setUserId, __sessionInternals } = await session();
  await setUserId(USER);
  await setUserId(USER);
  await setUserId("u-other");
  const owners = sets
    .filter((item) => item.name === __sessionInternals.DRAFT_OWNER_COOKIE)
    .map((item) => item.value);
  assert.equal(owners[0], owners[1]);
  assert.notEqual(owners[0], owners[2]);
  assert.match(owners[0], /^[0-9a-f]{64}$/);
  assert.equal(owners[0].includes(USER), false);
  assert.equal(owners[0].includes(Buffer.from(USER).toString("base64url")), false);
});

test("표식 값은 세션 토큰 서명과 다르다(서명 대상 구분)", async () => {
  sets.length = 0;
  const { setUserId, __sessionInternals } = await session();
  await setUserId(USER);
  const token = sets.find((item) => item.name === "insaeng_uid")?.value ?? "";
  const owner = sets.find((item) => item.name === __sessionInternals.DRAFT_OWNER_COOKIE)?.value ?? "";
  assert.equal(token.includes(owner), false);
});

test("clearUserId: 세션 쿠키와 draft 주인 표식 쿠키를 함께 지운다", async () => {
  deletes.length = 0;
  const { clearUserId, __sessionInternals } = await session();
  await clearUserId();
  assert.deepEqual(deletes.sort(), ["insaeng_draft_owner", "insaeng_uid"].sort());
  assert.equal(__sessionInternals.DRAFT_OWNER_COOKIE, "insaeng_draft_owner");
});

test("서버는 draft 주인 표식 쿠키를 인증에 쓰지 않는다(getUserId는 세션 쿠키만 읽음)", () => {
  const SOURCE = readFileSync(new URL("./session.ts", import.meta.url), "utf8");
  const getUserIdBody = SOURCE.slice(
    SOURCE.indexOf("export async function getUserId("),
    SOURCE.indexOf("export async function setUserId("),
  );
  assert.match(getUserIdBody, /store\.get\(COOKIE\)/);
  assert.doesNotMatch(getUserIdBody, /DRAFT_OWNER_COOKIE/);
  // 표식 쿠키를 읽는 서버 코드가 없다(쓰기·지우기만 있음).
  assert.doesNotMatch(SOURCE, /store\.get\(DRAFT_OWNER_COOKIE\)/);
});

test("클라이언트 api.ts와 서버가 같은 쿠키 이름을 쓴다", () => {
  const API = readFileSync(new URL("../client/api.ts", import.meta.url), "utf8");
  assert.match(API, /const DRAFT_OWNER_COOKIE = "insaeng_draft_owner";/);
  assert.match(API, /const DRAFT_KEY = "insaeng-draft";/);
});
