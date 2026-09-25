/**
 * 네이버 회원이름(name)을 User.name의 출처로 쓰는지 확인한다.
 *
 * 실행: node --test src/lib/server/naverRealName.test.ts
 *
 * 네이버 개발자센터 제공항목이 별명에서 회원이름으로 바뀌었다. 콜백이 계속
 * nickname만 읽으면 값이 비어 기본값("네이버 회원")이 저장된다. 실제로 그 상태가
 * 배포되어 MY에 "네이버 회원님"으로 표시됐다.
 *
 * 콜백은 네트워크(토큰 교환·프로필 조회)와 쿠키에 묶여 있어 통째로 부르기 어렵다.
 * 그래서 두 가지를 나눠 본다.
 *   · 읽는 자리와 우선순위는 원문으로 고정한다(아래 1·2).
 *   · 우선순위가 만드는 값과 덮어쓰기 규칙은 같은 식을 옮겨 동작으로 본다(3·4).
 *
 * 카카오는 이번 범위가 아니라 별명을 그대로 쓴다. 그 사실도 함께 고정해,
 * 나중에 두 provider를 한꺼번에 바꿨다가 카카오만 조용히 깨지는 일을 막는다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { User } from "@/lib/types/app";

const read = (path: string) => readFileSync(path, "utf8");

/** 주석을 걷어낸 코드. "읽는다"는 주석 언급이 아니라 실제 코드여야 한다. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const NAVER_CB = read("src/app/api/auth/naver/callback/route.ts");
const NAVER_CODE = codeOnly(NAVER_CB);
const KAKAO_CODE = codeOnly(read("src/app/api/auth/kakao/callback/route.ts"));
const NAVER_LIB = read("src/lib/server/naver.ts");

/* ── 1. 응답에서 회원이름을 읽는가 ───────────────────── */

test("네이버 응답 타입에 회원이름이 있다", () => {
  // 타입에 없으면 profile.response.name 접근 자체가 컴파일되지 않는다.
  assert.match(NAVER_CODE, /response\?:\s*\{[\s\S]*?\bname\?:\s*string;/);
});

test("회원이름을 trim해서 읽는다", () => {
  assert.match(NAVER_CODE, /realName\s*=\s*\(profile\.response\.name\s*\?\?\s*""\)\.trim\(\)/);
});

test("별명 폴백을 지우지 않았다", () => {
  /*
   * 제공항목 설정이나 검수 상태 때문에 회원이름이 빠져 돌아올 수 있다.
   * 그때 폴백이 없으면 이름이 통째로 비어 다시 "네이버 회원"이 된다.
   */
  assert.match(NAVER_CODE, /nickname\s*=\s*\(profile\.response\.nickname\s*\?\?\s*""\)\.trim\(\)/);
});

/* ── 2. 우선순위가 코드에 고정되어 있는가 ─────────────── */

test("displayName은 회원이름을 먼저 본다", () => {
  // 순서가 뒤집히면(nickname || realName) 별명이 있는 회원에게 별명이 남는다.
  assert.match(NAVER_CODE, /const\s+displayName\s*=\s*realName\s*\|\|\s*nickname;/);
  assert.doesNotMatch(NAVER_CODE, /const\s+displayName\s*=\s*nickname\s*\|\|\s*realName;/);
});

test("대기 상태로 넘기는 값은 여전히 displayName 하나다", () => {
  /*
   * socialLink의 저장 구조(nickname 한 칸)는 이번에 바꾸지 않았다.
   * 값의 출처만 바뀌고 슬롯은 그대로여야 completeSocialSignup이 무수정으로 받는다.
   */
  assert.match(NAVER_CODE, /createSocialLinkPending\(\{[\s\S]*?nickname:\s*displayName,/);
});

test("naver.ts 주석이 '별명만 사용'이 아니다", () => {
  assert.ok(!NAVER_LIB.includes("별명만 사용"), "옛 설명이 남아 있다");
  assert.ok(NAVER_LIB.includes("회원이름"), "현재 제공항목을 적어 둔다");
});

/* ── 3. 우선순위가 만드는 값 ─────────────────────────── */

/** 콜백의 displayName 식과 같은 식. 바뀌면 위 2번 테스트가 먼저 깨진다. */
const displayNameOf = (name: string, nickname: string) => name || nickname;

test("회원이름이 있으면 그 값이 쓰인다", () => {
  assert.equal(displayNameOf("정문경", ""), "정문경");
  // 둘 다 있어도 회원이름이 이긴다.
  assert.equal(displayNameOf("정문경", "문경이"), "정문경");
});

test("회원이름이 없을 때만 별명으로 물러선다", () => {
  assert.equal(displayNameOf("", "문경이"), "문경이");
});

test("둘 다 없으면 빈 문자열이고, 그때만 기본값이 쓰인다", () => {
  const displayName = displayNameOf("", "");
  assert.equal(displayName, "");
  // completeSocialSignup의 `pending.nickname || ${providerLabel} 회원` 과 같은 모양.
  assert.equal(displayName || "네이버 회원", "네이버 회원");
});

/* ── 4. 기존 회원 덮어쓰기 규칙 ──────────────────────── */

const userWith = (over: Partial<User>): User =>
  ({ id: "u1", phone: "", name: "", createdAt: "2026-09-25T00:00:00.000Z", ...over }) as User;

test("이름을 채우는 조건은 그대로 '비어 있을 때만'이다", () => {
  // 본인이 고친 이름을 로그인이 덮으면 안 된다. 이번 변경으로 완화하지 않았다.
  assert.match(NAVER_CODE, /if\s*\(displayName\s*&&\s*!user\.name\)/);
});

/** 콜백의 채움 규칙과 같은 식. */
function applyName(user: User, displayName: string): User {
  if (displayName && !user.name) user.name = displayName;
  return user;
}

test("이름이 비어 있던 회원은 재로그인에서 채워진다", () => {
  assert.equal(applyName(userWith({ name: "" }), "정문경").name, "정문경");
});

test("이름이 이미 있는 회원은 재로그인해도 그대로다", () => {
  /*
   * ⚠️ 여기에 이번 변경의 한계가 그대로 드러난다.
   *
   * 기본값으로 저장된 "네이버 회원"도 "이름이 있는" 회원이다. 그래서 이미
   * 그렇게 저장된 계정은 코드를 고쳐도 재로그인만으로 본명이 되지 않는다.
   * 자동으로 고치려면 기본값 문자열을 비어 있는 것으로 취급해야 하는데,
   * 그러면 본인이 직접 "네이버 회원"으로 정한 이름까지 덮게 된다.
   * 일괄 수정은 이번 범위가 아니므로 규칙을 그대로 두고 사실만 고정한다.
   */
  assert.equal(applyName(userWith({ name: "네이버 회원" }), "정문경").name, "네이버 회원");
  assert.equal(applyName(userWith({ name: "직접 고친 이름" }), "정문경").name, "직접 고친 이름");
});

/* ── 5. 카카오는 건드리지 않았다 ─────────────────────── */

test("카카오는 여전히 별명만 읽는다", () => {
  assert.match(KAKAO_CODE, /nickname\s*=\s*\(profile\.kakao_account\?\.profile\?\.nickname/);
  assert.ok(!KAKAO_CODE.includes("realName"), "카카오에 회원이름 경로를 만들지 않았다");
});
