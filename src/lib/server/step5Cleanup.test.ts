/**
 * STEP 5 후속 정리 테스트 — R0 / R1 / R4.
 *
 * 실행: node --test src/lib/server/step5Cleanup.test.ts
 *
 * R0 버전 축 분리는 상수라 동작으로 확인한다.
 * R1 옛 경로 차단과 R4 화면 표시는 라우팅·렌더 위치라 원문으로 고정한다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  LEGAL_EFFECTIVE_DATE,
  ORDER_CONSENT_VERSION,
  PRIVACY_POLICY_VERSION,
  SIGNUP_PRIVACY_VERSION,
  TERMS_VERSION,
  UNCONFIRMED_VERSION,
  areLegalVersionsConfirmed,
  isOrderConsentVersionConfirmed,
} from "../constants/legal.ts";
import { hasVerifiedPhone } from "../phoneVerification.ts";
import type { User } from "@/lib/types/app";

const read = (path: string) => readFileSync(path, "utf8");

/** 주석을 걷어낸 코드. 금지 경계는 "부르지 않는다"이지 "언급하지 않는다"가 아니다. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const LEGAL = read("src/lib/constants/legal.ts");

/* ── R0. 가입 개인정보 버전 축 분리 ──────────────── */

test("SIGNUP_PRIVACY_VERSION은 다른 축에서 떨어져 있다", () => {
  // 자기 리터럴을 가진다. LEGAL_EFFECTIVE_DATE를 읽지 않는다.
  assert.ok(
    LEGAL.includes('export const SIGNUP_PRIVACY_VERSION: string = "2026-09-26";'),
    "독립 상수여야 한다",
  );
  assert.ok(
    !LEGAL.includes("export const SIGNUP_PRIVACY_VERSION = LEGAL_EFFECTIVE_DATE;"),
    "공용 시행일을 다시 읽으면 따로 올릴 수 없다",
  );
});

test("남은 두 축은 그대로 공용 시행일을 읽는다", () => {
  /*
   * 처리방침(PRIVACY_POLICY_VERSION)도 따로 개정되어 공용 축에서 빠졌다.
   * 지금 공용 시행일을 함께 읽는 것은 이용약관과 신청 단계 동의 둘뿐이다.
   */
  assert.ok(LEGAL.includes("export const TERMS_VERSION = LEGAL_EFFECTIVE_DATE;"));
  assert.ok(LEGAL.includes("export const ORDER_CONSENT_VERSION = LEGAL_EFFECTIVE_DATE;"));
  assert.ok(LEGAL.includes('export const LEGAL_EFFECTIVE_DATE: string = "2026-09-25";'));
  // 처리방침은 더 이상 공용 축을 읽지 않는다.
  assert.equal(LEGAL.includes("export const PRIVACY_POLICY_VERSION = LEGAL_EFFECTIVE_DATE;"), false);
});

test("따로 개정된 두 문서만 개정 시행일을 가진다", () => {
  /**
   * 축 분리가 실제로 값으로 드러나는 자리다. 따로 개정된 것은 둘이다.
   *   · SIGNUP_PRIVACY_VERSION  소셜 간편가입에서 가입 시 휴대폰을 받지 않게 된 개정
   *   · PRIVACY_POLICY_VERSION  고지 항목(위탁·국외이전·파기·보호책임자) 보강
   * 이용약관과 신청 단계 동의는 2026-09-25 그대로다.
   * 이 둘까지 함께 움직이면 축이 다시 묶인 것이다.
   */
  assert.equal(SIGNUP_PRIVACY_VERSION, "2026-09-26", "가입 동의 문서의 개정 시행일");
  assert.equal(PRIVACY_POLICY_VERSION, "2026-09-26", "처리방침의 개정 시행일");
  assert.equal(TERMS_VERSION, "2026-09-25");
  assert.equal(ORDER_CONSENT_VERSION, "2026-09-25");
  assert.equal(LEGAL_EFFECTIVE_DATE, "2026-09-25");
  // 공용 축과 값이 실제로 다르다는 사실 자체가 분리의 증거다.
  assert.notEqual(SIGNUP_PRIVACY_VERSION, LEGAL_EFFECTIVE_DATE);
  assert.notEqual(PRIVACY_POLICY_VERSION, LEGAL_EFFECTIVE_DATE);
});

test("가입 개인정보 시행일만 바꿔도 다른 축이 따라 움직이지 않는다", () => {
  /**
   * 상수는 다시 대입할 수 없으므로, 분리되었다는 사실을 원문 구조로 확인한다.
   * SIGNUP_PRIVACY_VERSION 선언 줄에 LEGAL_EFFECTIVE_DATE가 없으면 그 줄을 고쳐도
   * TERMS / PRIVACY_POLICY / ORDER_CONSENT 값은 바뀌지 않는다.
   */
  const line = LEGAL.split("\n").find((item) =>
    item.startsWith("export const SIGNUP_PRIVACY_VERSION"),
  );
  assert.ok(line, "선언을 찾을 수 없다");
  assert.ok(!line.includes("LEGAL_EFFECTIVE_DATE"), "공용 시행일에 묶여 있으면 함께 움직인다");

  // 반대로 다른 세 줄에는 SIGNUP_PRIVACY_VERSION이 섞이지 않았다.
  for (const name of ["TERMS_VERSION", "PRIVACY_POLICY_VERSION", "ORDER_CONSENT_VERSION"]) {
    const other = LEGAL.split("\n").find((item) => item.startsWith(`export const ${name}`));
    assert.ok(other, name);
    assert.ok(!other.includes("SIGNUP_PRIVACY_VERSION"), `${name}가 가입 동의 축을 읽는다`);
  }
});

test("가입 동의 관문의 의미가 그대로다", () => {
  // 증빙에 실제로 남는 두 버전만 본다. 처리방침은 넣지 않는다.
  assert.ok(
    LEGAL.includes("return [TERMS_VERSION, SIGNUP_PRIVACY_VERSION].every("),
    "관문이 보는 대상이 바뀌면 안 된다",
  );
  assert.equal(areLegalVersionsConfirmed(), true);
  // 신청 동의 관문은 따로다. 회원가입 사정으로 신청이 막히지 않는다.
  assert.equal(isOrderConsentVersionConfirmed(), true);
  assert.ok(!LEGAL.includes("ORDER_CONSENT_VERSION].every"), "신청 축을 가입 관문에 넣지 않았다");
});

test("자리표시자를 넣지 않았다", () => {
  /**
   * UNCONFIRMED_VERSION을 쓰면 areLegalVersionsConfirmed()가 false가 되고,
   * 그 관문이 아이디 가입까지 503으로 막는다. 배포일을 정하기 전에 가입을 세우는 편이
   * 더 나쁘므로 값을 그대로 두었다.
   */
  assert.notEqual(SIGNUP_PRIVACY_VERSION, UNCONFIRMED_VERSION);
  assert.notEqual(TERMS_VERSION, UNCONFIRMED_VERSION);

  // 그 관문이 실제로 세 가입 경로 모두를 막는 자리에 있다는 사실을 함께 고정한다.
  const route = codeOnly(read("src/app/api/app/route.ts"));
  assert.equal(
    (route.match(/areLegalVersionsConfirmed\(\)/g) ?? []).length,
    3,
    "signupComplete / completeSocialLink / completeSocialSignup 세 곳이다",
  );
});

/* ── R1. 옛 소셜 가입 경로 차단 ──────────────────── */

const OLD_PAGE = read("src/app/social-link/verify-phone/page.tsx");

test("옛 경로는 화면을 그리지 않고 지금 경로로 보낸다", () => {
  const code = codeOnly(OLD_PAGE);
  // 대기 상태가 있으면 동의 화면으로 이어 준다.
  assert.ok(code.includes("if (pending) redirect(SOCIAL_SIGNUP_AGREE_PATH);"));
  // 없으면 처음부터.
  assert.ok(code.includes('redirect("/login")'));
  // 옛 화면을 렌더하지 않는다.
  assert.ok(!code.includes("VerifyPhoneForm"), "옛 폼을 그리면 옛 정책이 실행된다");
  assert.ok(!code.includes("return <"), "렌더하는 분기가 없다");
});

test("옛 폼과 action은 지우지 않았다", () => {
  // 대량 삭제는 이 정리의 범위가 아니다. 주소만 무력화했다.
  const form = read("src/app/social-link/verify-phone/VerifyPhoneForm.tsx");
  assert.ok(form.includes('action: "completeSocialLink"'), "폼 파일은 그대로 남아 있다");
  const route = read("src/app/api/app/route.ts");
  assert.ok(route.includes('if (action === "completeSocialLink")'), "action은 그대로 남아 있다");
  assert.ok(read("src/lib/loginRedirect.ts").includes("SOCIAL_LINK_VERIFY_PATH"), "상수도 남아 있다");
});

test("completeSocialLink 로그인 거부 게이트가 그대로다", () => {
  const route = read("src/app/api/app/route.ts");
  const start = route.indexOf('if (action === "completeSocialLink")');
  const next = route.indexOf('if (action === "', start + 1);
  const block = route.slice(start, next > 0 ? next : undefined);
  assert.ok(block.includes("if (await getActiveUserId())"));
  assert.ok(block.includes("이미 로그인되어 있습니다"));
  // 휴대폰 토큰 확인도 그대로다.
  assert.ok(block.includes("`link:${phone}`"));
});

test("신규 소셜 가입은 동의 화면 한 경로로만 간다", () => {
  for (const file of [
    "src/app/api/auth/kakao/callback/route.ts",
    "src/app/api/auth/naver/callback/route.ts",
  ]) {
    const code = codeOnly(read(file));
    assert.ok(
      code.includes("NextResponse.redirect(new URL(SOCIAL_SIGNUP_AGREE_PATH, origin))"),
      file,
    );
    assert.ok(!code.includes("SOCIAL_LINK_VERIFY_PATH"), `${file}이 옛 경로로 보낸다`);
  }
  // 그 화면이 부르는 것은 새 action 하나다.
  const form = read("src/app/social-link/agree/SocialSignupAgreeForm.tsx");
  assert.ok(form.includes('action: "completeSocialSignup"'));
  assert.ok(!form.includes('action: "completeSocialLink"'));
});

test("옛 경로를 가리키는 화면 링크가 남지 않았다", () => {
  // 상수 정의와 옛 경로 파일 자신은 제외하고, 어디서도 그 주소로 보내지 않는다.
  for (const file of [
    "src/app/api/app/route.ts",
    "src/app/api/auth/kakao/callback/route.ts",
    "src/app/api/auth/naver/callback/route.ts",
    "src/app/login/page.tsx",
    "src/components/apply/ApplyPhoneGate.tsx",
    "src/components/apply/PaySubmit.tsx",
  ]) {
    let source: string;
    try {
      source = read(file);
    } catch {
      continue;
    }
    assert.ok(!source.includes("/social-link/verify-phone"), `${file}이 옛 주소를 가리킨다`);
  }
});

test("최초 본인확인 경로는 그대로다", () => {
  // 번호 기반 연결은 가입이 아니라 이 경로에서만 한다.
  const route = read("src/app/api/app/route.ts");
  assert.ok(route.includes('if (action === "completeMyPhoneVerification")'));
  assert.ok(read("src/app/my/verify-phone/page.tsx").includes("hasVerifiedPhone(me)"));
});

/* ── R4. admin 추천인 코드 ──────────────────────── */

const ADMIN = read("src/app/admin/page.tsx");

function userWith(overrides: Partial<User>): User {
  return {
    id: "abc123",
    phone: "",
    email: "",
    name: "카카오 회원",
    gender: "",
    birth: "",
    birthTime: "",
    unknownTime: false,
    calendar: "solar",
    bloodType: "",
    points: 0,
    createdAt: "2026-09-25T00:00:00.000Z",
    ...overrides,
  };
}

test("admin은 본인확인을 마친 회원에게만 추천인 코드를 보여 준다", () => {
  assert.ok(ADMIN.includes("{hasVerifiedPhone(user) ? ("), "판정으로 갈라야 한다");
  assert.ok(ADMIN.includes("추천인 코드 {referralCodeFor(user)}"), "인증 회원 표시는 그대로다");
  assert.ok(ADMIN.includes("추천인 코드 — 본인확인 전"), "미인증이면 코드를 적지 않는다");
  // 회원 화면과 같은 판정 하나를 쓴다.
  assert.ok(ADMIN.includes('from "@/lib/phoneVerification"'));
});

test("admin의 코드 생성 규칙은 바뀌지 않았다", () => {
  assert.ok(ADMIN.includes('const tail = (raw.slice(-6) || "HOME").padStart(6, "0")'));
  assert.ok(ADMIN.includes("return `IS${tail}`"));
});

test("판정 결과가 회원 상태와 맞는다", () => {
  // admin이 쓰는 판정 자체를 값으로 확인한다.
  assert.equal(hasVerifiedPhone(userWith({ phone: "" })), false, "미인증이면 감춘다");
  assert.equal(hasVerifiedPhone(userWith({ phone: "010-1111-2222" })), true, "인증이면 보인다");
  assert.equal(
    hasVerifiedPhone(userWith({ phone: "", withdrawnAt: "2026-09-26T00:00:00.000Z" })),
    false,
    "탈퇴 회원도 감춘다",
  );
});

test("회원 MY의 노출 조건이 그대로다", () => {
  const my = read("src/app/my/page.tsx");
  assert.ok(my.includes("user && hasVerifiedPhone(user) ? referralCodeFor(user)"));
  assert.ok(my.includes("{user && referralCode ? ("));
});

test("서버 추천인 차단이 그대로다", () => {
  assert.ok(
    read("src/lib/server/applyOrder.ts").includes(
      "(item) => hasVerifiedPhone(item) && referralCodeFor(item) === code,",
    ),
  );
});

/* ── 손대지 않기로 한 것 ─────────────────────────── */

test("R2 / R3 / R5는 건드리지 않았다", () => {
  // R2: 신청 관문은 여전히 클라이언트 왕복 뒤 판정한다(서버 컴포넌트로 옮기지 않았다).
  const gate = read("src/components/apply/ApplyPhoneGate.tsx");
  assert.ok(gate.includes('"use client"'));
  assert.ok(gate.includes("fetchMe()"));

  // R3: MY 추천인 블록은 적립금과 함께 있다(쪼개지 않았다).
  const my = read("src/app/my/page.tsx");
  const start = my.indexOf("{user && referralCode ? (");
  assert.ok(my.slice(start, start + 600).includes("적립금"), "블록을 쪼개지 않았다");

  // R5: 흡수 시 찜·guest 채팅 안내를 넣지 않았다.
  const verify = read("src/app/my/verify-phone/MyVerifyPhoneForm.tsx");
  assert.ok(!verify.includes("찜"));
  assert.ok(!verify.includes("채팅"));
});

test("금지 항목에 손대지 않았다", () => {
  const route = read("src/app/api/app/route.ts");
  // 새 SMS 목적을 만들지 않았다.
  assert.ok(
    route.includes('const VERIFY_PURPOSES = ["signup", "reset", "link", "setid", "findid"] as const;'),
  );
  // phoneVerifiedAt 없음.
  for (const path of ["src/lib/types/app.ts", "src/lib/constants/legal.ts"]) {
    assert.ok(!codeOnly(read(path)).includes("phoneVerifiedAt"), path);
  }
  // STEP 1 서버 관문 3곳 유지.
  assert.equal((route.match(/verifiedPhoneGate\(user\)/g) ?? []).length, 3);
});
