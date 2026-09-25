/**
 * 미인증 회원 귀속 차단 테스트 (소셜 간편가입 STEP 2).
 *
 * 실행: node --test src/lib/server/unverifiedUserAttribution.test.ts
 *
 * 막으려는 것은 하나다. 휴대폰 본인확인 전 회원의 id에 나중에 옮겨야 할 데이터가 붙는 것.
 * 경로 셋을 본다. 추천인(referral) / 상담원 채팅(chat_inquiries) / 무료상담 문의(inquiry).
 *
 * ── 어떻게 확인하는가 ──
 *
 * 규칙 자체(hasVerifiedPhone)는 동작으로 확인한다. 이 파일 앞부분이 그것이고,
 * 세 경로가 실제로 같은 값을 보고 갈리는지는 원문으로 확인한다.
 *
 * 원문을 읽는 이유는 세 경로가 모두 런타임에 "@/" 경로를 쓰는 파일에 있어
 * node --test로 불러올 수 없기 때문이다(applyOrder.ts / chatGuest.ts / api 라우트).
 * 이 저장소의 기존 테스트들도 같은 이유로 applyOrder.ts를 원문으로 읽는다
 * (orderConsentTimestamp.test.ts, consultationScheduleConfirm.test.ts 등).
 * 아래 원문 검사는 전부 "가드를 지우면 깨지는지"를 확인한 것들이다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { hasVerifiedPhone } from "../phoneVerification.ts";
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

const read = (path: string) => readFileSync(path, "utf8");
const APPLY_ORDER = read("src/lib/server/applyOrder.ts");
const CHAT_GUEST = read("src/lib/server/chatGuest.ts");
const CHAT_POST = read("src/app/api/chat-inquiries/route.ts");
const WITHDRAW = read("src/lib/server/withdrawAccount.ts");
const APP_ROUTE = read("src/app/api/app/route.ts");

/* ── 0. 귀속 판정 (동작) ──────────────────────────── */

test("귀속해도 되는 회원과 안 되는 회원이 갈린다", () => {
  const verified = userWith({ id: "old", phone: "010-1111-2222" });
  const shell = userWith({ id: "shell", phone: "" });
  const withdrawn = userWith({ id: "gone", phone: "", withdrawnAt: "2026-02-01T00:00:00.000Z" });

  assert.equal(hasVerifiedPhone(verified), true, "인증 회원은 귀속 대상이다");
  assert.equal(hasVerifiedPhone(shell), false, "phone 없는 소셜 회원은 귀속 대상이 아니다");
  assert.equal(hasVerifiedPhone(withdrawn), false, "탈퇴 회원도 귀속 대상이 아니다");
});

test("세 경로가 같은 판정 하나를 쓴다", () => {
  // 규칙이 갈라지면 한쪽만 막히는 구멍이 생긴다. 판정 이름이 셋 다 같은지 본다.
  assert.ok(APPLY_ORDER.includes("hasVerifiedPhone"), "referral이 판정을 쓰지 않는다");
  assert.ok(WITHDRAW.includes("hasVerifiedPhone"), "세션 판정이 판정을 쓰지 않는다");
  assert.ok(APP_ROUTE.includes("hasVerifiedPhone"), "inquiry가 판정을 쓰지 않는다");
});

/* ── 1. 추천인 ─────────────────────────────────────── */

test("추천인 조회가 인증 회원만 본다", () => {
  const start = APPLY_ORDER.indexOf("const referrer = data.users.find");
  assert.ok(start > 0, "referrer 조회를 찾을 수 없다");
  const lookup = APPLY_ORDER.slice(start, APPLY_ORDER.indexOf(";", start));
  assert.ok(
    lookup.includes("hasVerifiedPhone(item)"),
    "미인증 회원이 추천인으로 인정되면 포인트가 쌓이고 남의 주문에 id가 남는다",
  );
  assert.ok(lookup.includes("referralCodeFor(item) === code"), "코드 비교 규칙은 그대로다");
});

test("추천 보상과 referrerId는 인정된 추천인에게만 간다", () => {
  // 보상·details 기록은 referrer가 정해진 뒤에만 나온다. 위 조회가 유일한 관문이다.
  const lookupAt = APPLY_ORDER.indexOf("const referrer = data.users.find");
  const pointsAt = APPLY_ORDER.indexOf("referrer.points");
  const refIdAt = APPLY_ORDER.indexOf("referrerId: referrer.id");
  assert.ok(pointsAt > lookupAt, "포인트 적립이 추천인 조회보다 앞에 있다");
  assert.ok(refIdAt > lookupAt, "referrerId 기록이 추천인 조회보다 앞에 있다");
  // 조회를 통과하지 못하면 그 자리에서 되돌아간다.
  const between = APPLY_ORDER.slice(lookupAt, pointsAt);
  assert.ok(
    between.includes('error: "추천인 코드를 확인해 주세요."'),
    "추천인을 찾지 못했을 때 되돌아가는 분기가 없다",
  );
});

test("referralCodeFor 구조는 그대로다", () => {
  // 코드 만드는 규칙은 손대지 않았다. 인정하는 대상만 좁혔다.
  assert.ok(APPLY_ORDER.includes("const raw = user.id.replace(/[^a-zA-Z0-9]/g, \"\").toUpperCase()"));
  assert.ok(APPLY_ORDER.includes('return `IS${tail}`'));
});

/* ── 2. 상담원 채팅 ────────────────────────────────── */

test("세션 판정이 본인확인을 마친 회원만 회원으로 본다", () => {
  const start = WITHDRAW.indexOf("export async function getVerifiedUserId");
  assert.ok(start > 0, "getVerifiedUserId가 없다");
  const body = WITHDRAW.slice(start, WITHDRAW.indexOf("\n}", start));
  assert.ok(body.includes("hasVerifiedPhone(user)"), "판정을 쓰지 않는다");
  assert.ok(body.includes("return null"), "비로그인일 때 null을 돌려주지 않는다");
});

test("기존 getActiveUserId는 그대로 남아 있다", () => {
  // 탈퇴 판정만 보는 기존 진입점은 다른 곳(가입·탈퇴 흐름)이 계속 쓴다.
  assert.ok(WITHDRAW.includes("export async function getActiveUserId"));
  assert.ok(WITHDRAW.includes("return isActiveUser(user) ? userId : null"));
});

test("채팅 보내기가 미인증 회원을 회원으로 묶지 않는다", () => {
  assert.ok(
    CHAT_POST.includes("const userId = await getVerifiedUserId()"),
    "채팅 POST가 본인확인 기준을 쓰지 않는다",
  );
  assert.ok(
    !CHAT_POST.includes("getActiveUserId"),
    "채팅 POST에 넓은 판정이 남아 있으면 미인증 회원의 user_id가 저장된다",
  );
});

test("채팅 읽기도 같은 기준을 쓴다", () => {
  // 보내는 쪽과 읽는 쪽이 갈리면 미인증 회원이 자기 방을 다시 찾을 수 없다.
  assert.ok(CHAT_GUEST.includes("const userId = await getVerifiedUserId()"));
  assert.ok(!CHAT_GUEST.includes("getActiveUserId"));
});

test("비회원 경로를 새로 만들지 않고 그대로 쓴다", () => {
  // userId가 null이면 기존 guest_token_hash 분기가 그대로 동작한다.
  assert.ok(CHAT_POST.includes("ensureGuestTokenHash()"), "기존 비회원 토큰 발급을 쓴다");
  assert.ok(
    CHAT_POST.includes("findOpenChatInquiryByGuestTokenHash"),
    "기존 비회원 방 찾기를 쓴다",
  );
  assert.ok(CHAT_POST.includes("getChatInquiryForGuest"), "기존 비회원 열람을 쓴다");
  // 회원 경로도 그대로 남아 있다. 인증 회원은 지금까지와 같다.
  assert.ok(CHAT_POST.includes("findOpenChatInquiryByUserId"));
  assert.ok(CHAT_POST.includes("getChatInquiryForUser"));
  assert.ok(CHAT_GUEST.includes("readGuestTokenHash()"));
});

test("chat_inquiries 스키마와 저장 규칙은 손대지 않았다", () => {
  const chatInquiries = read("src/lib/server/chatInquiries.ts");
  assert.ok(
    !chatInquiries.includes("hasVerifiedPhone") && !chatInquiries.includes("getVerifiedUserId"),
    "저장 계층에는 판정을 넣지 않는다. 신원은 호출부가 정한다",
  );
});

/* ── 3. 무료상담·이벤트 문의 ───────────────────────── */

test("문의는 인증 회원에게만 귀속된다", () => {
  const start = APP_ROUTE.indexOf('if (action === "createInquiry")');
  assert.ok(start > 0);
  const end = APP_ROUTE.indexOf('if (action === "', start + 1);
  const block = APP_ROUTE.slice(start, end > 0 ? end : undefined);

  assert.ok(
    /const owner = member && hasVerifiedPhone\(member\) \? member : null;/.test(block),
    "귀속 대상을 본인확인으로 가르지 않는다",
  );
  assert.ok(block.includes("item.userId = owner.id"), "귀속은 owner로만 한다");
  assert.ok(
    !/item\.userId = member\.id/.test(block),
    "member로 귀속하면 미인증 회원의 문의가 그 id에 붙는다",
  );
});

test("문의 알림도 귀속된 회원에게만 간다", () => {
  const start = APP_ROUTE.indexOf('if (action === "createInquiry")');
  const end = APP_ROUTE.indexOf('if (action === "', start + 1);
  const block = APP_ROUTE.slice(start, end > 0 ? end : undefined);
  assert.ok(block.includes("if (owner && data.notificationSettings[owner.id]"));
  assert.ok(
    !/data\.notifications\[member\.id\]/.test(block),
    "미인증 회원 id 아래 알림이 쌓이면 흡수 때 옮길 것이 생긴다",
  );
});

test("문의 접수 자체와 비회원 문의는 그대로다", () => {
  const start = APP_ROUTE.indexOf('if (action === "createInquiry")');
  const end = APP_ROUTE.indexOf('if (action === "', start + 1);
  const block = APP_ROUTE.slice(start, end > 0 ? end : undefined);

  // 미인증 회원도 문의는 낼 수 있다. 막는 것이 아니라 귀속만 하지 않는다.
  assert.ok(!block.includes("verifiedPhoneGate"), "문의 접수를 막지는 않는다");
  // 이름·연락처 기본값은 계속 회원 정보에서 채운다. 레코드 안에 들어가는 값이다.
  assert.ok(block.includes("body.name ?? member?.name"));
  assert.ok(block.includes("body.phone ?? member?.phone"));
  // 비회원 판정 기준(세션 없음)은 그대로다.
  assert.ok(block.includes("const sessionUserId = await getActiveUserId()"));
});

/* ── 4. STEP 1 보존 ───────────────────────────────── */

test("STEP 1 신청·결제 관문이 그대로 있다", () => {
  const calls = APP_ROUTE.match(/verifiedPhoneGate\(user\)/g) ?? [];
  assert.equal(calls.length, 3, "STEP 1 관문 세 곳이 유지되어야 한다");
  for (const action of ["createOrder", "createConsultation", "preparePayment"]) {
    const start = APP_ROUTE.indexOf(`if (action === "${action}")`);
    assert.ok(start > 0);
    const gateAt = APP_ROUTE.indexOf("verifiedPhoneGate(user)", start);
    const nextAction = APP_ROUTE.indexOf('if (action === "', start + 1);
    assert.ok(gateAt > start && (nextAction < 0 || gateAt < nextAction), `${action} 관문이 사라졌다`);
  }
});

test("승인 후 경로에는 STEP 2에서도 관문이 생기지 않았다", () => {
  for (const file of [
    "src/app/api/payments/nicepay/return/route.ts",
    "src/app/api/admin/payments/recommit/route.ts",
  ]) {
    const source = read(file);
    assert.ok(
      !source.includes("hasVerifiedPhone") &&
        !source.includes("verifiedPhoneGate") &&
        !source.includes("getVerifiedUserId"),
      `${file}에는 본인확인 판정을 넣지 않는다`,
    );
  }
});

test("commitOrder/commitConsultation에는 관문이 없다", () => {
  // applyReferral에는 판정이 들어갔지만, 확정 함수 자체는 막지 않는다.
  // 승인 후 경로가 같은 함수를 쓰기 때문이다.
  for (const fn of ["export async function commitOrder", "export async function commitConsultation"]) {
    const start = APPLY_ORDER.indexOf(fn);
    assert.ok(start > 0, `${fn}을 찾을 수 없다`);
    const body = APPLY_ORDER.slice(start, APPLY_ORDER.indexOf("\n}", start));
    assert.ok(
      !body.includes("hasVerifiedPhone"),
      `${fn} 안에서 막으면 승인 후 경로에서 결제만 되고 주문이 없는 상태가 된다`,
    );
  }
});
