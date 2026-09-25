/**
 * 휴대폰 본인확인 관문 테스트 (소셜 간편가입 STEP 1).
 *
 * 실행: node --test src/lib/phoneVerification.test.ts
 *
 * 보는 것은 셋이다.
 * 1) hasVerifiedPhone 판정 자체.
 * 2) 관문이 승인 전 경로 셋에만 있고, 승인 후 경로에는 없다.
 * 3) 판정의 전제가 되는 불변식(phone은 SMS 인증을 거친 곳에서만 쓰인다)이 그대로다.
 *
 * (2)와 (3)은 DB·세션을 지나는 route 파일이라 원문을 글자로 읽어 경계를 본다
 * (consents.test.ts와 다른 route source 테스트들과 같은 방식).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { hasVerifiedPhone } from "./phoneVerification.ts";
import type { User } from "@/lib/types/app";

function userWith(overrides: Partial<User>): User {
  return {
    id: "u1",
    phone: "010-1234-5678",
    email: "",
    name: "홍길동",
    gender: "",
    birth: "",
    birthTime: "",
    unknownTime: false,
    calendar: "solar",
    bloodType: "",
    points: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const APP_ROUTE = readFileSync("src/app/api/app/route.ts", "utf8");

/* ── 1. 판정 ───────────────────────────────────────── */

test("phone이 빈 활성 회원은 미인증이다", () => {
  assert.equal(hasVerifiedPhone(userWith({ phone: "" })), false);
});

test("번호를 가진 활성 회원은 인증 완료다", () => {
  assert.equal(hasVerifiedPhone(userWith({ phone: "010-1234-5678" })), true);
  // 하이픈이 없어도 같다. 저장 형식에 판정이 딸려가지 않게 한다.
  assert.equal(hasVerifiedPhone(userWith({ phone: "01012345678" })), true);
});

test("탈퇴 회원은 인증 완료로 보지 않는다", () => {
  // 탈퇴 비식별화는 phone을 ""로 비우므로 실제로는 이 모양이다.
  assert.equal(
    hasVerifiedPhone(userWith({ phone: "", withdrawnAt: "2026-02-01T00:00:00.000Z" })),
    false,
  );
  // 어떤 이유로 번호가 남아 있어도 탈퇴 회원은 통과시키지 않는다.
  assert.equal(
    hasVerifiedPhone(userWith({ phone: "010-1234-5678", withdrawnAt: "2026-02-01T00:00:00.000Z" })),
    false,
  );
});

test("회원이 없으면 미인증이다", () => {
  assert.equal(hasVerifiedPhone(null), false);
  assert.equal(hasVerifiedPhone(undefined), false);
});

test("자릿수가 모자란 값은 인증으로 보지 않는다", () => {
  // 기존 인증 진입점(sendCode / verifyCode / completeSocialLink)과 같은 10자리 기준이다.
  assert.equal(hasVerifiedPhone(userWith({ phone: "0101234" })), false);
  assert.equal(hasVerifiedPhone(userWith({ phone: "없음" })), false);
});

/* ── 2. 관문 위치 ──────────────────────────────────── */

test("관문은 승인 전 경로 셋에만 있다", () => {
  // 관문 함수 정의 1회 + createOrder / createConsultation / preparePayment 호출 3회.
  const calls = APP_ROUTE.match(/verifiedPhoneGate\(user\)/g) ?? [];
  assert.equal(calls.length, 3, "verifiedPhoneGate(user) 호출은 정확히 세 곳이어야 한다");

  // 각 호출이 해당 action 블록 안에 있는지, 그 action이 시작된 뒤에 처음 나오는지로 본다.
  for (const action of ["createOrder", "createConsultation", "preparePayment"]) {
    const start = APP_ROUTE.indexOf(`if (action === "${action}")`);
    assert.ok(start > 0, `${action} 블록을 찾을 수 없다`);
    const gateAt = APP_ROUTE.indexOf("verifiedPhoneGate(user)", start);
    assert.ok(gateAt > start, `${action}에 관문이 없다`);
    // 다음 action이 시작되기 전에 관문이 있어야 한다.
    const nextAction = APP_ROUTE.indexOf('if (action === "', start + 1);
    if (nextAction > 0) {
      assert.ok(gateAt < nextAction, `${action}의 관문이 블록 밖에 있다`);
    }
  }
});

test("관문은 공통 확정 함수에 들어가지 않는다", () => {
  /**
   * commitOrder / commitConsultation은 승인 후 경로와 함께 쓰는 함수다. 여기서 막으면
   * 결제만 되고 주문이 없는 상태가 된다.
   *
   * 보는 것은 두 함수의 본문뿐이다. 파일 전체에 판정이 없는지를 보면 안 된다.
   * 같은 파일의 applyReferral은 추천인을 인증 회원으로 좁히려고 같은 판정을 쓰며,
   * 그쪽은 승인 후 경로가 지나가는 자리가 아니다.
   */
  const applyOrder = readFileSync("src/lib/server/applyOrder.ts", "utf8");
  for (const fn of [
    "export async function commitOrder",
    "export async function commitConsultation",
  ]) {
    const start = applyOrder.indexOf(fn);
    assert.ok(start > 0, `${fn}을 찾을 수 없다`);
    const body = applyOrder.slice(start, applyOrder.indexOf("\n}", start));
    assert.ok(!body.includes("hasVerifiedPhone"), `${fn}에는 관문을 넣지 않는다`);
  }
});

test("승인 후 경로에는 관문이 없다", () => {
  // 승인이 끝난 뒤에 막으면 결제만 되고 주문이 없는 상태가 된다.
  for (const file of [
    "src/app/api/payments/nicepay/return/route.ts",
    "src/app/api/admin/payments/recommit/route.ts",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.ok(
      !source.includes("hasVerifiedPhone") && !source.includes("verifiedPhoneGate"),
      `${file}에는 관문을 넣지 않는다`,
    );
  }
});

test("조회 경로에는 관문이 없다", () => {
  // 관문은 POST 핸들러 안에만 있다. GET(열람)은 그대로 지나가야 한다.
  const getAt = APP_ROUTE.indexOf("export async function GET");
  assert.ok(getAt > 0);
  // 함수 본문만 본다. 뒤에 이어지는 모듈 수준 함수 정의까지 읽으면 판정이 흐려진다.
  const closeAt = APP_ROUTE.indexOf("\n}\n", getAt);
  assert.ok(closeAt > getAt, "GET 함수의 끝을 찾을 수 없다");
  const getBody = APP_ROUTE.slice(getAt, closeAt);
  assert.ok(!getBody.includes("verifiedPhoneGate"), "GET에는 관문을 넣지 않는다");
});

/* ── 3. 판정의 전제 ────────────────────────────────── */

test("updateProfile은 여전히 phone을 바꾸지 않는다", () => {
  const start = APP_ROUTE.indexOf('if (action === "updateProfile")');
  assert.ok(start > 0);
  const end = APP_ROUTE.indexOf('if (action === "', start + 1);
  const block = APP_ROUTE.slice(start, end > 0 ? end : undefined);

  // has("name") 처럼 프로필 항목을 반영하는 줄들 사이에 phone이 끼어들지 않아야 한다.
  assert.ok(block.includes('has("name")'), "updateProfile 블록을 잘못 잡았다");
  assert.ok(
    !/next\.phone\s*=/.test(block),
    "updateProfile이 phone을 쓰면 hasVerifiedPhone의 전제가 깨진다",
  );
  assert.ok(!/has\("phone"\)/.test(block), "updateProfile은 phone 키를 읽지 않는다");
});

test("phone을 쓰는 곳은 가입 시점뿐이다", () => {
  // emptyUser(phone, ...)을 부르는 두 곳은 모두 SMS 인증 토큰을 검증한 뒤다.
  // 이 숫자가 늘어나면 새 경로가 생긴 것이므로 인증을 거치는지 확인해야 한다.
  const calls = APP_ROUTE.match(/emptyUser\(phone/g) ?? [];
  assert.equal(calls.length, 2, "emptyUser(phone ...) 호출은 signupComplete와 completeSocialLink 둘뿐이다");

  const store = readFileSync("src/lib/server/store.ts", "utf8");
  // 판정이 쓰는 자릿수 규칙이 store.ts의 normalizePhone과 같은 정규식인지 본다.
  assert.ok(
    store.includes('phone.replace(/\\D/g, "")'),
    "normalizePhone이 바뀌었다. hasVerifiedPhone의 자릿수 규칙을 함께 확인해야 한다",
  );

  // 활성 회원 판정 기준도 withdrawAccount.ts와 같은 withdrawnAt 하나다.
  const withdraw = readFileSync("src/lib/server/withdrawAccount.ts", "utf8");
  assert.ok(
    withdraw.includes("return !!user && !user.withdrawnAt"),
    "isActiveUser가 바뀌었다. hasVerifiedPhone의 탈퇴 판정을 함께 확인해야 한다",
  );
});
