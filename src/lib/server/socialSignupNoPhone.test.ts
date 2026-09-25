/**
 * 휴대폰 없는 신규 소셜 가입 테스트 (소셜 간편가입 STEP 5).
 *
 * 실행: node --test src/lib/server/socialSignupNoPhone.test.ts
 *
 * 이 단계에서 바뀌는 것은 "어디로 보내고, 무엇을 검증한 뒤 회원을 만드는가"라
 * 라우팅 위치와 관문 존재가 핵심이다. 그 부분은 원문으로 고정한다.
 * 회원이 만들어지는 모양(phone=""·provider·nickname·동의)은 emptyUser와 consents가
 * 하는 일이므로 그쪽은 동작으로 확인한다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildRequiredConsents, checkRequiredConsents } from "./consents.ts";
import {
  SIGNUP_PRIVACY_VERSION,
  TERMS_VERSION,
  UNCONFIRMED_VERSION,
  areLegalVersionsConfirmed,
} from "../constants/legal.ts";
import { phoneDigits, hasVerifiedPhone } from "../phoneVerification.ts";
import type { User } from "@/lib/types/app";

const read = (path: string) => readFileSync(path, "utf8");

/** 주석을 걷어낸 코드. 금지 경계는 "부르지 않는다"이지 "언급하지 않는다"가 아니다. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function actionBlock(source: string, action: string): string {
  const start = source.indexOf(`if (action === "${action}")`);
  assert.ok(start > 0, `${action} 블록을 찾을 수 없다`);
  const next = source.indexOf('if (action === "', start + 1);
  return source.slice(start, next > 0 ? next : undefined);
}

const APP_ROUTE = read("src/app/api/app/route.ts");
const APP_CODE = codeOnly(APP_ROUTE);
const KAKAO_CB = read("src/app/api/auth/kakao/callback/route.ts");
const NAVER_CB = read("src/app/api/auth/naver/callback/route.ts");
const SIGNUP_BLOCK = actionBlock(APP_CODE, "completeSocialSignup");

/* ── 1. 신규 소셜 가입: 어디로 보내는가 ─────────────── */

for (const [label, source] of [
  ["카카오", KAKAO_CB],
  ["네이버", NAVER_CB],
] as const) {
  test(`${label} 콜백은 신규 계정을 동의 화면으로 보낸다`, () => {
    const code = codeOnly(source);
    assert.ok(
      code.includes("NextResponse.redirect(new URL(SOCIAL_SIGNUP_AGREE_PATH, origin))"),
      "동의 화면으로 보내야 한다",
    );
    // 휴대폰 인증 화면으로 보내지 않는다.
    assert.ok(
      !code.includes("SOCIAL_LINK_VERIFY_PATH"),
      "신규 가입을 휴대폰 인증 화면으로 보내지 않는다",
    );
  });

  test(`${label} 콜백은 회원을 직접 만들지 않는다`, () => {
    const code = codeOnly(source);
    // provider 정보만 서버 대기 상태에 남긴다. 동의 없이 회원이 생기지 않게 하려는 것이다.
    assert.ok(code.includes("createSocialLinkPending("), "대기 상태만 남긴다");
    assert.ok(!code.includes("registerUser"), "콜백이 회원을 만들지 않는다");
    assert.ok(!code.includes("emptyUser"), "콜백이 회원을 만들지 않는다");
    assert.ok(!code.includes("buildRequiredConsents"), "동의 증빙도 콜백에서 만들지 않는다");
  });

  test(`${label} 콜백은 기존 연결 회원을 그대로 로그인시킨다`, () => {
    const code = codeOnly(source);
    const key = label === "카카오" ? "kakaoId" : "naverId";
    // provider id로 활성 회원을 찾아 그 회원으로 세션을 만드는 기존 동작이 그대로다.
    assert.ok(code.includes(`isActiveUser(item) && item.${key} ===`), "provider id로 찾는다");
    assert.ok(code.includes("await setUserId(user.id)"), "그 회원으로 로그인한다");
  });

  test(`${label} 콜백은 번호로 기존 회원을 찾지 않는다`, () => {
    // 가입 시점에는 번호를 모른다. 흡수는 최초 본인확인에서만 한다.
    const code = codeOnly(source);
    assert.ok(!code.includes("normalizePhone"), "번호 조회를 하지 않는다");
    assert.ok(!code.includes("absorbSocialShell"), "콜백에서 흡수하지 않는다");
  });

  test(`${label} 탈퇴 재인증 경로는 그대로다`, () => {
    const code = codeOnly(source);
    assert.ok(code.includes("WITHDRAW_PURPOSE"), "탈퇴 재인증 분기가 남아 있다");
    assert.ok(code.includes("createWithdrawVerification("), "본인확인 토큰 발급이 남아 있다");
  });
}

test("동의 화면은 대기 상태가 있을 때만 열린다", () => {
  const page = read("src/app/social-link/agree/page.tsx");
  assert.ok(page.includes("readSocialLinkPending()"), "서버 대기 상태를 읽는다");
  assert.ok(page.includes('redirect("/login")'), "없으면 처음부터 다시 하게 한다");
  // providerUserId는 화면으로 내려보내지 않는다. provider 종류만 넘긴다.
  // 주석에는 그 이름이 나오므로 코드만 본다.
  assert.ok(page.includes("provider={pending.provider}"));
  assert.ok(!codeOnly(page).includes("providerUserId"));
});

test("동의 화면은 휴대폰을 받지 않는다", () => {
  const form = read("src/app/social-link/agree/SocialSignupAgreeForm.tsx");
  assert.ok(!form.includes('purpose: "link"'), "인증번호를 보내지 않는다");
  assert.ok(!form.includes('action: "sendCode"'));
  assert.ok(!form.includes('action: "verifyCode"'));
  assert.ok(!form.includes("linkToken"));
  assert.ok(!/type="tel"/.test(form), "번호 입력란이 없다");
  // 보내는 값은 동의 둘뿐이다.
  assert.ok(form.includes('action: "completeSocialSignup"'));
  assert.ok(form.includes("termsAgreed: agreeTerms"));
  assert.ok(form.includes("privacyAgreed: agreePrivacy"));
});

/* ── 2. 가입 확정 관문 ────────────────────────────── */

test("가입 확정은 로그인 상태면 거부한다", () => {
  assert.ok(SIGNUP_BLOCK.includes("if (await getActiveUserId())"));
  assert.ok(SIGNUP_BLOCK.includes("이미 로그인되어 있습니다"));
});

test("provider 정보는 서버 대기 상태에서만 읽는다", () => {
  assert.ok(SIGNUP_BLOCK.includes("readSocialLinkPendingForCommit("));
  for (const forbidden of [
    "body.provider",
    "body.providerUserId",
    "body.kakaoId",
    "body.naverId",
    "body.nickname",
    "body.userId",
    "body.phone",
  ]) {
    assert.ok(!SIGNUP_BLOCK.includes(forbidden), `${forbidden}를 읽지 않는다`);
  }
  // 읽는 것은 동의 둘뿐이다(checkRequiredConsents가 body.termsAgreed/privacyAgreed를 본다).
  assert.ok(SIGNUP_BLOCK.includes("checkRequiredConsents(body)"));
});

test("동의 없이 회원이 만들어지지 않는다", () => {
  const consentAt = SIGNUP_BLOCK.indexOf("checkRequiredConsents(body)");
  const createAt = SIGNUP_BLOCK.indexOf("registerUser(");
  assert.ok(consentAt > 0 && createAt > consentAt, "동의 검증이 회원 생성보다 앞이다");
  assert.ok(SIGNUP_BLOCK.includes("consents: buildRequiredConsents()"), "증빙을 저장한다");
});

test("약관 버전이 확정되지 않으면 회원을 만들지 않는다", () => {
  const gateAt = SIGNUP_BLOCK.indexOf("areLegalVersionsConfirmed()");
  const createAt = SIGNUP_BLOCK.indexOf("registerUser(");
  assert.ok(gateAt > 0 && createAt > gateAt, "버전 관문이 회원 생성보다 앞이다");
  assert.ok(SIGNUP_BLOCK.includes("status: 503"));
});

test("휴대폰 없이 회원을 만든다", () => {
  assert.ok(SIGNUP_BLOCK.includes('emptyUser("", pending.nickname'), 'phone 자리가 ""다');
  // 번호로 기존 회원을 찾지 않는다. 가입 시점에는 번호를 모른다.
  assert.ok(!SIGNUP_BLOCK.includes("normalizePhone"));
  assert.ok(!SIGNUP_BLOCK.includes("absorbSocialShell"));
});

test("nickname과 provider id를 저장한다", () => {
  assert.ok(SIGNUP_BLOCK.includes("pending.nickname"));
  assert.ok(SIGNUP_BLOCK.includes("[providerKey]: pending.providerUserId"));
  assert.ok(
    SIGNUP_BLOCK.includes('pending.provider === "kakao" ? "kakaoId" : "naverId"'),
    "provider 종류로 필드를 정한다",
  );
});

test("같은 provider id가 이미 붙어 있으면 만들지 않는다", () => {
  assert.ok(SIGNUP_BLOCK.includes("item[providerKey] === pending.providerUserId"));
  const ownedAt = SIGNUP_BLOCK.indexOf("ownedBySocial");
  const createAt = SIGNUP_BLOCK.indexOf("registerUser(");
  assert.ok(ownedAt > 0 && createAt > ownedAt, "중복 판정이 생성보다 앞이다");
});

test("회원 생성과 대기 상태 소비를 한 번에 확정한다", () => {
  assert.ok(SIGNUP_BLOCK.includes("writeDataWithVerificationConsumes("));
  // 저장이 끝난 뒤에만 쿠키를 지우고 세션을 만든다.
  const commitAt = SIGNUP_BLOCK.indexOf("writeDataWithVerificationConsumes(");
  const cookieAt = SIGNUP_BLOCK.indexOf("clearSocialLinkCookie()");
  const sessionAt = SIGNUP_BLOCK.indexOf("setUserId(created.id)");
  assert.ok(cookieAt > commitAt, "저장 뒤에 쿠키를 지운다");
  assert.ok(sessionAt > commitAt, "저장 뒤에 세션을 만든다");
});

/* ── 3. 만들어지는 회원의 모양 (동작) ─────────────── */

test('phone=""인 회원은 미인증으로 판정된다', () => {
  // completeSocialSignup이 만드는 모양을 그대로 세워 판정만 확인한다.
  const created: User = {
    id: "shell",
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
    kakaoId: "K-1",
    consents: buildRequiredConsents(),
  };
  assert.equal(phoneDigits(created.phone), "");
  assert.equal(hasVerifiedPhone(created), false, "신청 관문에 걸린다");
  assert.equal(created.kakaoId, "K-1");
  assert.equal(created.naverId, undefined);
  assert.equal(created.passwordHash, undefined, "간편가입은 비밀번호를 만들지 않는다");
  assert.equal(created.loginId, undefined, "간편가입은 아이디를 만들지 않는다");
});

test("필수 동의 증빙이 기존 일반가입과 같은 모양으로 저장된다", () => {
  const consents = buildRequiredConsents("2026-09-25T00:00:00.000Z");
  // 필수 2종은 반드시 만들어진다. 없으면 그 자체가 결함이다.
  assert.ok(consents.terms, "이용약관 증빙이 없다");
  assert.ok(consents.privacy, "개인정보 수집 동의 증빙이 없다");
  assert.equal(consents.terms.agreed, true);
  assert.equal(consents.privacy.agreed, true);
  assert.equal(consents.terms.version, TERMS_VERSION);
  assert.equal(consents.privacy.version, SIGNUP_PRIVACY_VERSION);
  assert.equal(consents.history?.length, 2, "행위 기록도 함께 남는다");
});

test("동의하지 않은 요청은 통과하지 못한다", () => {
  assert.equal(checkRequiredConsents({}).ok, false);
  assert.equal(checkRequiredConsents({ termsAgreed: true }).ok, false);
  assert.equal(checkRequiredConsents({ privacyAgreed: true }).ok, false);
  // 문자열은 동의로 보지 않는다.
  assert.equal(checkRequiredConsents({ termsAgreed: "1", privacyAgreed: "1" }).ok, false);
  assert.equal(checkRequiredConsents({ termsAgreed: true, privacyAgreed: true }).ok, true);
});

test("버전 관문은 자리표시자를 걸러 낸다", () => {
  // 지금은 확정 상태다. 자리표시자로 되돌리면 가입이 막히는 구조라는 것을 값으로 본다.
  assert.equal(areLegalVersionsConfirmed(), true);
  assert.notEqual(TERMS_VERSION, UNCONFIRMED_VERSION);
  assert.notEqual(SIGNUP_PRIVACY_VERSION, UNCONFIRMED_VERSION);
});

/* ── 4. 기존 가입·인증 경로 보존 ─────────────────── */

test("일반 가입은 여전히 휴대폰 인증을 거친다", () => {
  const block = actionBlock(APP_CODE, "signupComplete");
  assert.ok(block.includes("`signup:${phone}`"), "가입 인증 토큰을 확인한다");
  assert.ok(block.includes("emptyUser(phone, name"), "번호를 받아 회원을 만든다");
  assert.ok(block.includes("hashPassword(password)"), "비밀번호를 만든다");
  assert.ok(block.includes("checkRequiredConsents"), "동의도 그대로 받는다");
});

test("completeSocialLink의 로그인 거부 게이트가 그대로다", () => {
  const block = actionBlock(APP_ROUTE, "completeSocialLink");
  assert.ok(block.includes("if (await getActiveUserId())"));
  assert.ok(block.includes("이미 로그인되어 있습니다"));
  // 휴대폰 토큰 확인도 그대로다(이 경로는 걷어내지 않았다).
  assert.ok(block.includes("`link:${phone}`"));
});

test("기존 휴대폰 인증 화면과 action을 걷어내지 않았다", () => {
  // 신규 콜백이 더는 보내지 않지만, 대량 삭제는 이 단계의 범위가 아니다.
  assert.ok(APP_ROUTE.includes('if (action === "completeSocialLink")'));
  const form = read("src/app/social-link/verify-phone/VerifyPhoneForm.tsx");
  assert.ok(form.includes('action: "completeSocialLink"'));
  // 경로 상수도 남아 있다.
  assert.ok(read("src/lib/loginRedirect.ts").includes("SOCIAL_LINK_VERIFY_PATH"));
});

test("STEP 4 최초 본인확인 경로가 그대로다", () => {
  const block = actionBlock(APP_CODE, "completeMyPhoneVerification");
  assert.ok(block.includes("userId: user.id"));
  assert.ok(block.includes("completeMyPhoneVerification("));
  assert.ok(block.includes("setUserId(outcome.targetId)"));
});

/* ── 5. 신청 시작 관문 ───────────────────────────── */

test("신청 관문은 신청 화면 공통 레이아웃 한 곳에 있다", () => {
  const layout = read("src/components/apply/ApplyLayout.tsx");
  assert.ok(layout.includes("<ApplyPhoneGate />"), "레이아웃이 관문을 렌더한다");
});

test("신청 화면 20개가 모두 그 레이아웃을 쓴다", () => {
  const bases = [
    ["story-song", 6],
    ["premium", 6],
    ["saju-song", 4],
    ["consultation", 4],
  ] as const;
  let count = 0;
  for (const [base, steps] of bases) {
    for (let step = 1; step <= steps; step += 1) {
      const path = `src/app/apply/${base}/${step}/page.tsx`;
      assert.ok(read(path).includes("ApplyLayout"), `${path}가 레이아웃을 쓰지 않는다`);
      count += 1;
    }
  }
  assert.equal(count, 20, "네 상품 20단계를 모두 확인했다");
});

test("네 상품 페이지에 관문을 복붙하지 않았다", () => {
  for (const base of ["story-song", "premium", "saju-song", "consultation"]) {
    for (let step = 1; step <= 6; step += 1) {
      const path = `src/app/apply/${base}/${step}/page.tsx`;
      let source: string;
      try {
        source = read(path);
      } catch {
        continue;
      }
      assert.ok(!source.includes("verify-phone"), `${path}에 관문이 복붙되어 있다`);
      assert.ok(!source.includes("ApplyPhoneGate"), `${path}가 관문을 직접 쓴다`);
    }
  }
});

test("관문 판정: 비로그인은 건드리지 않고 미인증만 보낸다", () => {
  const gate = read("src/components/apply/ApplyPhoneGate.tsx");
  // 비로그인은 기존 로그인 관문이 맡는다.
  assert.ok(gate.includes("if (!user) return;"));
  // 인증을 마쳤으면 아무것도 하지 않는다.
  assert.ok(gate.includes('phoneDigits(String(user.phone ?? "")).length >= 10'));
  // 미인증이면 인증 화면으로, 돌아올 주소를 함께 넘긴다.
  assert.ok(gate.includes("/my/verify-phone?next="));
  assert.ok(gate.includes("encodeURIComponent(back)"));
  // 공용 판정 규칙을 쓴다. 자릿수를 새로 적지 않는다.
  assert.ok(gate.includes('from "@/lib/phoneVerification"'));
});

test("서버 관문 3곳이 그대로 있다", () => {
  assert.equal((APP_ROUTE.match(/verifiedPhoneGate\(user\)/g) ?? []).length, 3);
});

test("PaySubmit 방어선이 남아 있고 중복 안내를 만들지 않는다", () => {
  const pay = read("src/components/apply/PaySubmit.tsx");
  // 방어선은 남는다.
  assert.ok(pay.includes("/my/verify-phone?next="));
  // 같은 화면에서 두 번 보내지 않는다. 보내는 조건이 한 곳뿐이다.
  assert.equal((pay.match(/\/my\/verify-phone\?next=/g) ?? []).length, 1);
  // 기존 로그인 관문도 그대로다.
  assert.ok(pay.includes("신청을 접수하려면 먼저 로그인해 주세요."));
});

/* ── 6. 공용 판정 모듈 위치 ──────────────────────── */

test("공용 판정은 server 디렉터리 밖에 있다", () => {
  const shared = read("src/lib/phoneVerification.ts");
  assert.ok(shared.includes("export function phoneDigits"));
  assert.ok(shared.includes("export function hasVerifiedPhone"));
  // 서버 전용 의존이 없다. 타입만 가져온다.
  const runtimeImports = shared
    .split("\n")
    .filter((line) => line.startsWith("import ") && !line.startsWith("import type "));
  assert.deepEqual(runtimeImports, [], "런타임 import가 없어야 클라이언트에서도 쓸 수 있다");
});

test("옛 경로를 가리키는 import가 남지 않았다", () => {
  for (const path of [
    "src/app/api/app/route.ts",
    "src/lib/server/withdrawAccount.ts",
    "src/lib/server/applyOrder.ts",
    "src/lib/server/socialShellAbsorb.ts",
    "src/lib/server/myPhoneVerification.ts",
    "src/components/apply/PaySubmit.tsx",
    "src/components/apply/ApplyPhoneGate.tsx",
    "src/app/my/verify-phone/page.tsx",
    "src/app/my/page.tsx",
  ]) {
    assert.ok(!read(path).includes("server/phoneVerification"), path);
  }
});

/* ── 7. 추천인 코드 노출 ─────────────────────────── */

test("MY는 본인확인을 마친 회원에게만 추천인 코드를 보여 준다", () => {
  const my = read("src/app/my/page.tsx");
  assert.ok(my.includes("user && hasVerifiedPhone(user) ? referralCodeFor(user)"));
  assert.ok(my.includes("{user && referralCode ? ("), "미인증이면 블록을 그리지 않는다");
  // 코드를 만드는 규칙은 바꾸지 않았다.
  assert.ok(my.includes("const tail = (raw.slice(-6) || \"HOME\").padStart(6, \"0\")"));
});

test("서버 추천인 차단이 그대로다", () => {
  assert.ok(
    read("src/lib/server/applyOrder.ts").includes(
      "(item) => hasVerifiedPhone(item) && referralCodeFor(item) === code,",
    ),
  );
});

/* ── 8. 문구 정합성 ─────────────────────────────── */

test("가입 동의 문서가 소셜 가입 시 휴대폰을 받는다고 적지 않는다", () => {
  const page = read("src/app/privacy/collection/page.tsx");
  const start = page.indexOf("카카오·네이버로 가입할 때 받는 정보");
  assert.ok(start > 0);
  // 그 섹션의 수집 항목 목록만 본다.
  const listEnd = page.indexOf("</ul>", start);
  const items = page.slice(start, listEnd);
  assert.ok(!items.includes("휴대폰 번호 (필수)"), "소셜 가입 항목에 휴대폰이 없어야 한다");
  assert.ok(items.includes("카카오 또는 네이버 계정 식별정보"));
  // provider마다 제공받는 값이 달라 항목을 나눠 적는다(네이버=회원이름, 카카오=닉네임).
  // 여기서 보는 것은 "이름에 해당하는 항목이 고지되어 있는가"다.
  assert.ok(items.includes("회원이름"), "네이버에서 받는 이름이 적혀 있어야 한다");
  assert.ok(items.includes("닉네임"), "카카오에서 받는 이름이 적혀 있어야 한다");
  // 실제 흐름을 설명한다.
  assert.ok(page.includes("가입하실 때 휴대폰 번호도 받지"));
});

test("일반가입 휴대폰 수집 설명은 그대로 남아 있다", () => {
  const page = read("src/app/privacy/collection/page.tsx");
  const start = page.indexOf("회원가입할 때 받는 정보");
  const listEnd = page.indexOf("</ul>", start);
  const items = page.slice(start, listEnd);
  assert.ok(items.includes("휴대폰 번호 (필수)"), "일반가입은 휴대폰을 받는다");
  assert.ok(items.includes("아이디 (필수)"));
  assert.ok(items.includes("비밀번호 (필수)"));
});

test("처리방침과 이용약관이 실제 흐름과 맞는다", () => {
  const privacy = read("src/app/privacy/page.tsx");
  assert.ok(
    !privacy.includes("간편로그인으로 처음 가입하실 때에도 본인 확인을 위해 휴대폰 번호를 함께 받습니다."),
    "사실과 다른 문장이 남아 있다",
  );
  assert.ok(privacy.includes("간편로그인으로 처음 가입하실 때에는 휴대폰 번호를 받지 않습니다"));

  const terms = read("src/app/terms/page.tsx");
  assert.ok(!terms.includes("이때에도 휴대폰 본인 확인을\n            함께 진행합니다."));
  assert.ok(terms.includes("약관 동의만으로"), "소셜 가입 설명이 실제와 맞는다");
  assert.ok(terms.includes("아이디로 회원가입하실 때에는 휴대폰 본인 확인을 거쳐"));
});

/* ── 9. 금지 경계 ───────────────────────────────── */

test("범용 merge와 데이터 이관을 만들지 않았다", () => {
  for (const path of [
    "src/app/api/app/route.ts",
    "src/lib/server/myPhoneVerification.ts",
    "src/lib/server/socialShellAbsorb.ts",
  ]) {
    const code = codeOnly(read(path));
    for (const forbidden of ["mergeUsers", "transferOrders", "transferWishlist", "moveChatInquiries"]) {
      assert.ok(!code.includes(forbidden), `${path}: ${forbidden}`);
    }
  }
});

test("phoneVerifiedAt을 만들지 않았다", () => {
  for (const path of [
    "src/lib/types/app.ts",
    "src/app/api/app/route.ts",
    "src/lib/phoneVerification.ts",
    "src/lib/server/myPhoneVerification.ts",
  ]) {
    // 주석에는 "만들지 않는 이유"로 그 이름이 나온다. 실제 코드만 본다.
    assert.ok(!codeOnly(read(path)).includes("phoneVerifiedAt"), path);
  }
});

test("새 인증 목적을 만들지 않았다", () => {
  assert.ok(
    APP_ROUTE.includes(
      'const VERIFY_PURPOSES = ["signup", "reset", "link", "setid", "findid"] as const;',
    ),
  );
});

test("승인 후 경로에는 본인확인 판정이 없다", () => {
  for (const file of [
    "src/app/api/payments/nicepay/return/route.ts",
    "src/app/api/admin/payments/recommit/route.ts",
  ]) {
    const source = read(file);
    for (const forbidden of [
      "hasVerifiedPhone",
      "verifiedPhoneGate",
      "getVerifiedUserId",
      "completeMyPhoneVerification",
      "completeSocialSignup",
    ]) {
      assert.ok(!source.includes(forbidden), `${file}: ${forbidden}`);
    }
  }
});

test("이 변경이 가입 동의 시행일에 반영되어 있다", () => {
  /**
   * 소셜 간편가입에서 가입 시 휴대폰을 받지 않게 된 개정은 2026-09-26 시행이다.
   * 공용 시행일(다른 세 문서)은 2026-09-25 그대로다.
   * 축 분리 구조 자체는 step5Cleanup.test.ts가 고정한다. 여기서는 값만 본다.
   */
  const legal = read("src/lib/constants/legal.ts");
  assert.ok(legal.includes('export const LEGAL_EFFECTIVE_DATE: string = "2026-09-25";'));
  assert.ok(legal.includes('export const SIGNUP_PRIVACY_VERSION: string = "2026-09-26";'));
});
