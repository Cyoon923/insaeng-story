/**
 * 관리자 회원 응답 테스트.
 *
 * 실행: node --test src/lib/server/adminUserView.test.ts
 *
 * 비밀번호 해시·소셜 로그인 id가 관리자 응답에 실리지 않는지,
 * 관리자 화면이 쓰는 필드와 탈퇴 표시 값(withdrawnAt)은 그대로인지 본다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { toAdminUserView } from "./adminUserView.ts";
import type { User } from "@/lib/types/app";

const SECRET_KEYS = ["passwordHash", "kakaoId", "naverId"] as const;

function user(overrides: Partial<User> = {}): User {
  return {
    id: "u-1",
    phone: "01012345678",
    email: "a@example.com",
    name: "홍길동",
    gender: "",
    birth: "",
    birthTime: "",
    unknownTime: false,
    calendar: "solar",
    bloodType: "",
    points: 1000,
    createdAt: "2026-09-01T00:00:00.000Z",
    loginId: "hong",
    passwordHash: "salt:hash",
    kakaoId: "kakao-1",
    naverId: "naver-1",
    ...overrides,
  };
}

test("비밀번호 해시·소셜 로그인 id를 빼고, 나머지 필드는 그대로 둔다", () => {
  const source = user();
  const view = toAdminUserView(source);
  for (const key of SECRET_KEYS) assert.equal(key in view, false, key);
  assert.equal(view.name, "홍길동");
  assert.equal(view.phone, "01012345678");
  assert.equal(view.points, 1000);
  assert.equal(view.createdAt, "2026-09-01T00:00:00.000Z");
  // 저장된 원본은 바꾸지 않는다.
  assert.equal(source.passwordHash, "salt:hash");
  assert.equal(source.kakaoId, "kakao-1");
  // JSON으로 직렬화해도 값이 남지 않는다(응답 본문 기준).
  const json = JSON.stringify(view);
  for (const value of ["salt:hash", "kakao-1", "naver-1"]) assert.equal(json.includes(value), false, value);
});

test("탈퇴회원은 withdrawnAt·createdAt·id를 그대로 전달한다", () => {
  const view = toAdminUserView(
    user({ name: "탈퇴회원", phone: "", email: "", withdrawnAt: "2026-09-20T00:00:00.000Z", passwordHash: undefined }),
  );
  assert.equal(view.withdrawnAt, "2026-09-20T00:00:00.000Z");
  assert.equal(view.id, "u-1");
  assert.equal(view.name, "탈퇴회원");
});

test("관리자 GET과 적립금 조정 응답이 이 변환을 거친다", () => {
  const route = readFileSync(new URL("../../app/api/admin/route.ts", import.meta.url), "utf8");
  assert.match(route, /users: data\.users\.map\(toAdminUserView\)/);
  assert.match(route, /json\(\{ ok: true, user: toAdminUserView\(user\) \}\)/);
  // 원본 users를 그대로 내보내는 곳이 남아 있지 않다.
  assert.equal(/users: data\.users[,\s]/.test(route), false);
  assert.equal(/json\(\{ ok: true, user \}\)/.test(route), false);
});
