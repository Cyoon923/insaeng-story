/**
 * 미인증 소셜 shell 흡수 테스트 (소셜 간편가입 STEP 3).
 *
 * 실행: node --test src/lib/server/socialShellAbsorb.test.ts
 *
 * 판정과 이전은 순수 함수라 전부 동작으로 확인한다.
 * 원문 검사는 "이 단계에서 하지 않기로 한 것"(저장·세션·API 연결)과
 * STEP 1/2 경계를 고정할 때만 쓴다.
 *
 * anonymize는 실제 anonymizeWithdrawnUser를 쓸 수 없어(저장소를 아는 파일이다)
 * 같은 일을 하는 대역을 넣는다. 대역이 실제 함수와 어긋나지 않는지는
 * 마지막 "대역이 실제 비식별화와 같은 일을 한다" 테스트가 원문으로 확인한다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  absorbSocialShell,
  findAbsorbBlockers,
  type AbsorbDeps,
  type ShellHistoryCounts,
} from "./socialShellAbsorb.ts";
import type { AppData, Consultation, Coupon, Inquiry, Review, User } from "@/lib/types/app";

const read = (path: string) => readFileSync(path, "utf8");

/* ── 대역 ─────────────────────────────────────────── */

function userWith(overrides: Partial<User>): User {
  return {
    id: "u",
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
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** 가입 때 자동으로 생기는 안내 쿠폰. product가 없어 어떤 상품에도 쓸 수 없다. */
const WELCOME_COUPON: Coupon = {
  id: "c-welcome",
  title: "첫 방문 안내",
  desc: "신청과 상담 진행을 우선 안내해 드립니다.",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function dataWith(users: User[], overrides: Partial<AppData> = {}): AppData {
  const coupons: Record<string, Coupon[]> = {};
  const wishlists: Record<string, string[]> = {};
  for (const user of users) {
    coupons[user.id] = [WELCOME_COUPON];
    wishlists[user.id] = [];
  }
  return {
    users,
    orders: [],
    consultations: [],
    inquiries: [],
    reviews: [],
    wishlists,
    coupons,
    notifications: {},
    notificationSettings: {},
    codes: {},
    blockedSlots: [],
    adminPromo: null,
    ...overrides,
  };
}

const CLEAN: ShellHistoryCounts = { orders: 0, chatInquiries: 0 };

/**
 * anonymizeWithdrawnUser 대역. 흡수 판정이 보장하는 범위(주문·결제 없음)에서
 * 실제 함수와 같은 일을 한다. 후기 비식별화는 그 함수의 일이 아니라 넣지 않는다.
 */
const deps: AbsorbDeps = {
  anonymize: (data, user) => {
    user.phone = "";
    user.email = "";
    user.name = "탈퇴회원";
    delete user.loginId;
    delete user.passwordHash;
    delete user.kakaoId;
    delete user.naverId;
    user.gender = "";
    user.birth = "";
    user.birthTime = "";
    user.unknownTime = false;
    user.calendar = "solar";
    user.bloodType = "";
    user.marketingAgreed = false;
    user.points = 0;
    delete data.wishlists[user.id];
    delete data.coupons[user.id];
    delete data.notifications[user.id];
    delete data.notificationSettings[user.id];
    user.withdrawnAt = "2026-09-25T00:00:00.000Z";
    return user;
  },
};

/** 깨끗한 kakao shell + 본인확인을 마친 기존 회원. */
function baseCase() {
  const shell = userWith({ id: "shell", phone: "", kakaoId: "K-1", name: "카카오 회원" });
  const target = userWith({
    id: "old",
    phone: "010-1111-2222",
    name: "홍길동",
    loginId: "gildong",
    passwordHash: "salt:hash",
    points: 5000,
    birth: "1970-03-04",
    bloodType: "A",
    gender: "male",
  });
  return { shell, target, data: dataWith([shell, target]) };
}

/* ── 1. 흡수 가능 판정 ────────────────────────────── */

test("깨끗한 미인증 소셜 shell은 흡수할 수 있다", () => {
  const { data } = baseCase();
  assert.deepEqual(findAbsorbBlockers(data, "shell", CLEAN), []);
});

test("welcome 안내 쿠폰만 있으면 막지 않는다", () => {
  const { data } = baseCase();
  assert.deepEqual(data.coupons["shell"], [WELCOME_COUPON]);
  assert.deepEqual(findAbsorbBlockers(data, "shell", CLEAN), []);
});

test("주문이 있으면 흡수하지 않는다", () => {
  const { data } = baseCase();
  assert.deepEqual(findAbsorbBlockers(data, "shell", { orders: 1, chatInquiries: 0 }), ["orders"]);
});

test("상담원 채팅방이 있으면 흡수하지 않는다", () => {
  const { data } = baseCase();
  assert.deepEqual(findAbsorbBlockers(data, "shell", { orders: 0, chatInquiries: 1 }), [
    "chat-inquiries",
  ]);
});

test("상담이 있으면 흡수하지 않는다", () => {
  const { shell, target } = baseCase();
  const consultation = { id: "c1", userId: "shell" } as unknown as Consultation;
  const data = dataWith([shell, target], { consultations: [consultation] });
  assert.deepEqual(findAbsorbBlockers(data, "shell", CLEAN), ["consultations"]);
});

test("문의가 있으면 흡수하지 않는다", () => {
  const { shell, target } = baseCase();
  const inquiry = { id: "i1", userId: "shell" } as unknown as Inquiry;
  const data = dataWith([shell, target], { inquiries: [inquiry] });
  assert.deepEqual(findAbsorbBlockers(data, "shell", CLEAN), ["inquiries"]);
});

test("후기가 있으면 흡수하지 않는다", () => {
  const { shell, target } = baseCase();
  const review = { id: "r1", userId: "shell" } as unknown as Review;
  const data = dataWith([shell, target], { reviews: [review] });
  assert.deepEqual(findAbsorbBlockers(data, "shell", CLEAN), ["reviews"]);
});

test("적립금이 남아 있으면 흡수하지 않는다", () => {
  const { shell, target } = baseCase();
  shell.points = 10000;
  const data = dataWith([shell, target]);
  assert.deepEqual(findAbsorbBlockers(data, "shell", CLEAN), ["points"]);
});

test("쓸 수 있는 쿠폰이 있으면 흡수하지 않는다", () => {
  const { shell, target } = baseCase();
  const data = dataWith([shell, target]);
  data.coupons["shell"] = [
    WELCOME_COUPON,
    { ...WELCOME_COUPON, id: "c-story", product: "story" } as Coupon,
  ];
  assert.deepEqual(findAbsorbBlockers(data, "shell", CLEAN), ["coupons"]);
});

test("이미 쓴 쿠폰이 있으면 흡수하지 않는다", () => {
  const { shell, target } = baseCase();
  const data = dataWith([shell, target]);
  data.coupons["shell"] = [{ ...WELCOME_COUPON, usedAt: "2026-05-05T00:00:00.000Z" }];
  assert.deepEqual(findAbsorbBlockers(data, "shell", CLEAN), ["coupons"]);
});

test("비밀번호가 있으면 흡수하지 않는다", () => {
  const { shell, target } = baseCase();
  shell.passwordHash = "salt:hash";
  const data = dataWith([shell, target]);
  assert.deepEqual(findAbsorbBlockers(data, "shell", CLEAN), ["password"]);
});

test("이미 본인확인을 마친 회원은 흡수 대상이 아니다", () => {
  const { shell, target } = baseCase();
  shell.phone = "010-9999-8888";
  const data = dataWith([shell, target]);
  assert.deepEqual(findAbsorbBlockers(data, "shell", CLEAN), ["phone"]);
});

test("자릿수가 모자란 번호도 흡수 대상이 아니다", () => {
  // 판정 기준은 "비어 있는가"다. 인증 여부(10자리)보다 엄격하다.
  const { shell, target } = baseCase();
  shell.phone = "010";
  const data = dataWith([shell, target]);
  assert.deepEqual(findAbsorbBlockers(data, "shell", CLEAN), ["phone"]);
});

test("탈퇴한 shell은 흡수하지 않는다", () => {
  const { shell, target } = baseCase();
  shell.withdrawnAt = "2026-02-01T00:00:00.000Z";
  const data = dataWith([shell, target]);
  assert.deepEqual(findAbsorbBlockers(data, "shell", CLEAN), ["inactive"]);
});

test("없는 회원은 흡수하지 않는다", () => {
  const { data } = baseCase();
  assert.deepEqual(findAbsorbBlockers(data, "nobody", CLEAN), ["inactive"]);
});

test("사유가 여러 개면 모두 돌려준다", () => {
  const { shell, target } = baseCase();
  shell.points = 100;
  shell.passwordHash = "salt:hash";
  const data = dataWith([shell, target]);
  assert.deepEqual(findAbsorbBlockers(data, "shell", { orders: 2, chatInquiries: 1 }), [
    "orders",
    "chat-inquiries",
    "points",
    "password",
  ]);
});

test("찜과 알림은 흡수를 막지 않는다", () => {
  const { shell, target } = baseCase();
  const data = dataWith([shell, target]);
  data.wishlists["shell"] = ["story", "premium"];
  data.notifications["shell"] = [
    { id: "n1", title: "안내", body: "본문", createdAt: "2026-01-02T00:00:00.000Z", read: false },
  ];
  data.notificationSettings["shell"] = { order: false, consult: false, notice: true };
  assert.deepEqual(findAbsorbBlockers(data, "shell", CLEAN), []);
});

/* ── 2. provider 이전 ─────────────────────────────── */

test("kakao shell의 kakaoId가 기존 회원으로 옮겨진다", () => {
  const { shell, target, data } = baseCase();
  const result = absorbSocialShell(
    data,
    { shellId: "shell", targetId: "old", provider: "kakao", counts: CLEAN },
    deps,
  );
  assert.equal(result.kind, "absorbed");
  assert.equal(target.kakaoId, "K-1");
  assert.equal(shell.kakaoId, undefined);
  if (result.kind === "absorbed") {
    assert.equal(result.providerUserId, "K-1");
    assert.equal(result.targetId, "old");
    assert.equal(result.shellId, "shell");
  }
});

test("naver shell의 naverId가 기존 회원으로 옮겨진다", () => {
  const shell = userWith({ id: "shell", phone: "", naverId: "N-7" });
  const target = userWith({ id: "old", phone: "010-1111-2222", name: "홍길동" });
  const data = dataWith([shell, target]);
  const result = absorbSocialShell(
    data,
    { shellId: "shell", targetId: "old", provider: "naver", counts: CLEAN },
    deps,
  );
  assert.equal(result.kind, "absorbed");
  assert.equal(target.naverId, "N-7");
  assert.equal(shell.naverId, undefined);
  assert.equal(target.kakaoId, undefined, "다른 provider 필드는 건드리지 않는다");
});

test("옮기는 것은 provider id 하나뿐이다 — target의 기존 값은 그대로다", () => {
  const { shell, target, data } = baseCase();
  shell.name = "카카오 회원";
  shell.birth = "1999-12-31";
  shell.bloodType = "O";
  shell.gender = "female";
  data.coupons["old"] = [WELCOME_COUPON, { ...WELCOME_COUPON, id: "c-old", product: "story" } as Coupon];
  data.wishlists["old"] = ["premium"];

  absorbSocialShell(
    data,
    { shellId: "shell", targetId: "old", provider: "kakao", counts: CLEAN },
    deps,
  );

  assert.equal(target.name, "홍길동", "이름을 shell 값으로 덮지 않는다");
  assert.equal(target.phone, "010-1111-2222", "연락처를 덮지 않는다");
  assert.equal(target.points, 5000, "적립금을 덮지 않는다");
  assert.equal(target.birth, "1970-03-04", "사주 정보를 덮지 않는다");
  assert.equal(target.bloodType, "A");
  assert.equal(target.gender, "male");
  assert.equal(target.loginId, "gildong");
  assert.equal(target.passwordHash, "salt:hash");
  assert.equal(data.coupons["old"].length, 2, "쿠폰을 옮기거나 지우지 않는다");
  assert.deepEqual(data.wishlists["old"], ["premium"], "찜을 옮기거나 지우지 않는다");
  assert.equal(target.withdrawnAt, undefined, "기존 회원은 활성 그대로다");
});

test("shell은 비활성화되고 딸린 값이 정리된다", () => {
  const { shell, data } = baseCase();
  data.wishlists["shell"] = ["story"];
  data.notifications["shell"] = [];
  data.notificationSettings["shell"] = { order: true, consult: true, notice: false };

  absorbSocialShell(
    data,
    { shellId: "shell", targetId: "old", provider: "kakao", counts: CLEAN },
    deps,
  );

  assert.ok(shell.withdrawnAt, "withdrawnAt이 남는다");
  assert.equal(shell.phone, "");
  assert.equal(shell.kakaoId, undefined);
  assert.equal(shell.naverId, undefined);
  assert.equal(shell.points, 0);
  assert.equal(data.wishlists["shell"], undefined);
  assert.equal(data.coupons["shell"], undefined);
  assert.equal(data.notifications["shell"], undefined);
  assert.equal(data.notificationSettings["shell"], undefined);
  // 활성 회원 조회에서 빠진다(isActiveUser와 같은 기준).
  assert.equal(data.users.filter((item) => !item.withdrawnAt).length, 1);
});

test("흡수 뒤 활성 회원 중 같은 provider id는 하나뿐이다", () => {
  const { data } = baseCase();
  absorbSocialShell(
    data,
    { shellId: "shell", targetId: "old", provider: "kakao", counts: CLEAN },
    deps,
  );
  const owners = data.users.filter((item) => !item.withdrawnAt && item.kakaoId === "K-1");
  assert.equal(owners.length, 1);
  assert.equal(owners[0].id, "old");
});

/* ── 3. 충돌·거부 ─────────────────────────────────── */

test("target에 다른 kakaoId가 있으면 중단한다", () => {
  const { shell, target, data } = baseCase();
  target.kakaoId = "K-OTHER";
  const result = absorbSocialShell(
    data,
    { shellId: "shell", targetId: "old", provider: "kakao", counts: CLEAN },
    deps,
  );
  assert.equal(result.kind, "refused");
  if (result.kind === "refused") assert.equal(result.refusal.reason, "target-has-other-provider");
  assert.equal(target.kakaoId, "K-OTHER", "덮어쓰지 않는다");
  assert.equal(shell.kakaoId, "K-1", "shell도 그대로다");
  assert.equal(shell.withdrawnAt, undefined);
});

test("제3의 활성 회원이 같은 provider id를 들고 있으면 중단한다", () => {
  const { shell, target, data } = baseCase();
  const third = userWith({ id: "third", phone: "010-3333-4444", kakaoId: "K-1" });
  data.users.push(third);
  const result = absorbSocialShell(
    data,
    { shellId: "shell", targetId: "old", provider: "kakao", counts: CLEAN },
    deps,
  );
  assert.equal(result.kind, "refused");
  if (result.kind === "refused") assert.equal(result.refusal.reason, "provider-owned-by-other");
  assert.equal(target.kakaoId, undefined);
  assert.equal(shell.withdrawnAt, undefined);
});

test("탈퇴한 제3자가 들고 있던 id는 막지 않는다", () => {
  const { target, data } = baseCase();
  data.users.push(
    userWith({ id: "gone", phone: "", kakaoId: "K-1", withdrawnAt: "2026-02-01T00:00:00.000Z" }),
  );
  const result = absorbSocialShell(
    data,
    { shellId: "shell", targetId: "old", provider: "kakao", counts: CLEAN },
    deps,
  );
  assert.equal(result.kind, "absorbed");
  assert.equal(target.kakaoId, "K-1");
});

test("이미 흡수가 끝난 상태는 안전하게 성공으로 끝낸다", () => {
  const shell = userWith({ id: "shell", phone: "", withdrawnAt: "2026-09-25T00:00:00.000Z" });
  const target = userWith({ id: "old", phone: "010-1111-2222", kakaoId: "K-1", points: 5000 });
  const data = dataWith([shell, target]);
  const result = absorbSocialShell(
    data,
    { shellId: "shell", targetId: "old", provider: "kakao", counts: CLEAN },
    deps,
  );
  assert.equal(result.kind, "already-absorbed");
  if (result.kind === "already-absorbed") {
    assert.equal(result.providerUserId, "K-1");
    assert.equal(result.targetId, "old");
  }
  assert.equal(target.points, 5000, "두 번 적용되는 값이 없다");
});

test("shell에 provider id가 없으면 중단한다", () => {
  const { shell, target, data } = baseCase();
  delete shell.kakaoId;
  const result = absorbSocialShell(
    data,
    { shellId: "shell", targetId: "old", provider: "kakao", counts: CLEAN },
    deps,
  );
  assert.equal(result.kind, "refused");
  if (result.kind === "refused") assert.equal(result.refusal.reason, "shell-missing-provider");
  assert.equal(shell.withdrawnAt, undefined);
  assert.equal(target.kakaoId, undefined, "빈 값을 옮기지 않는다");
});

test("shell의 kakaoId로 naver 흡수를 할 수 없다", () => {
  // provider 종류를 잘못 넘기면 읽을 값이 없어 멈춘다. 다른 필드를 대신 읽지 않는다.
  const { target, data } = baseCase();
  const result = absorbSocialShell(
    data,
    { shellId: "shell", targetId: "old", provider: "naver", counts: CLEAN },
    deps,
  );
  assert.equal(result.kind, "refused");
  if (result.kind === "refused") assert.equal(result.refusal.reason, "shell-missing-provider");
  assert.equal(target.naverId, undefined);
  assert.equal(target.kakaoId, undefined);
});

test("기존 회원이 탈퇴했으면 중단한다", () => {
  const { shell, target, data } = baseCase();
  target.withdrawnAt = "2026-02-01T00:00:00.000Z";
  const result = absorbSocialShell(
    data,
    { shellId: "shell", targetId: "old", provider: "kakao", counts: CLEAN },
    deps,
  );
  assert.equal(result.kind, "refused");
  if (result.kind === "refused") assert.equal(result.refusal.reason, "target-inactive");
  assert.equal(shell.kakaoId, "K-1");
});

test("shell과 target이 같으면 중단한다", () => {
  const { data } = baseCase();
  const result = absorbSocialShell(
    data,
    { shellId: "shell", targetId: "shell", provider: "kakao", counts: CLEAN },
    deps,
  );
  assert.equal(result.kind, "refused");
  if (result.kind === "refused") assert.equal(result.refusal.reason, "same-user");
});

test("이력이 있으면 사유를 담아 거부하고 아무것도 고치지 않는다", () => {
  const { shell, target, data } = baseCase();
  const result = absorbSocialShell(
    data,
    { shellId: "shell", targetId: "old", provider: "kakao", counts: { orders: 1, chatInquiries: 2 } },
    deps,
  );
  assert.equal(result.kind, "refused");
  if (result.kind === "refused") {
    assert.equal(result.refusal.reason, "shell-not-empty");
    if (result.refusal.reason === "shell-not-empty") {
      assert.deepEqual(result.refusal.blockers, ["orders", "chat-inquiries"]);
    }
  }
  // 데이터가 그대로다.
  assert.equal(shell.kakaoId, "K-1");
  assert.equal(shell.withdrawnAt, undefined);
  assert.equal(target.kakaoId, undefined);
  assert.deepEqual(data.coupons["shell"], [WELCOME_COUPON]);
});

/* ── 4. 순서 고정 ─────────────────────────────────── */

test("비식별화 전에 providerUserId를 확보한다", () => {
  // anonymize가 불리는 순간 target에 값이 이미 붙어 있어야 한다.
  // 순서가 뒤집히면 anonymize가 shell의 id를 지워 옮길 값이 사라진다.
  const { shell, target, data } = baseCase();
  const seen: { targetAtAnonymize?: string; shellAtAnonymize?: string } = {};
  const spy: AbsorbDeps = {
    anonymize: (d, user) => {
      seen.targetAtAnonymize = target.kakaoId;
      seen.shellAtAnonymize = user.kakaoId;
      return deps.anonymize(d, user);
    },
  };
  const result = absorbSocialShell(
    data,
    { shellId: "shell", targetId: "old", provider: "kakao", counts: CLEAN },
    spy,
  );
  assert.equal(result.kind, "absorbed");
  assert.equal(seen.targetAtAnonymize, "K-1", "비식별화 시점에 이미 옮겨져 있어야 한다");
  assert.equal(seen.shellAtAnonymize, "K-1", "비식별화가 값을 지우는 쪽이다");
  assert.equal(shell.kakaoId, undefined, "비식별화 뒤에는 shell에 남지 않는다");
});

test("거부된 경우에는 비식별화를 부르지 않는다", () => {
  const { data } = baseCase();
  let called = 0;
  const spy: AbsorbDeps = {
    anonymize: (d, u) => {
      called += 1;
      return deps.anonymize(d, u);
    },
  };
  absorbSocialShell(
    data,
    { shellId: "shell", targetId: "old", provider: "kakao", counts: { orders: 1, chatInquiries: 0 } },
    spy,
  );
  assert.equal(called, 0);
});

/* ── 5. 이 단계의 금지 경계 (구조) ────────────────── */

/**
 * 주석을 걷어낸 코드. 금지 경계는 "부르지 않는다"이지 "언급하지 않는다"가 아니다.
 * 이 파일의 주석은 왜 부르지 않는지를 설명하려고 그 이름들을 적고 있다.
 */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const ABSORB = codeOnly(read("src/lib/server/socialShellAbsorb.ts"));

test("저장하지 않는다", () => {
  for (const forbidden of [
    "writeData",
    "writeDataWithVerificationConsumes",
    "writeDataWithOrder",
    "consumeVerification",
    "putToken",
    "setUserId",
  ]) {
    assert.ok(!ABSORB.includes(forbidden), `${forbidden}를 부르지 않는다`);
  }
});

test("Postgres를 고치지 않는다", () => {
  // 판정에 필요한 개수는 deps로 받은 값이다. 이 파일은 SQL을 쓰지 않는다.
  for (const forbidden of ["UPDATE", "DELETE", "INSERT", "sqlClient", "sql.query"]) {
    assert.ok(!ABSORB.includes(forbidden), `${forbidden}가 있으면 이관을 하는 셈이다`);
  }
});

test("API action이나 라우트에 연결되지 않았다", () => {
  const files = [
    "src/app/api/app/route.ts",
    "src/app/api/chat-inquiries/route.ts",
    "src/app/api/auth/kakao/callback/route.ts",
    "src/app/api/auth/naver/callback/route.ts",
    "src/app/api/payments/nicepay/return/route.ts",
    "src/app/api/admin/payments/recommit/route.ts",
  ];
  for (const file of files) {
    const source = read(file);
    assert.ok(
      !source.includes("socialShellAbsorb") &&
        !source.includes("absorbSocialShell") &&
        !source.includes("findAbsorbBlockers"),
      `${file}에는 아직 연결하지 않는다`,
    );
  }
});

test("기존 findWithdrawBlockers를 쓰지 않는다", () => {
  // 그쪽은 "진행 중인 것"만 본다. 흡수 판정은 "아무것도 없는 것"이라 기준이 다르다.
  assert.ok(!ABSORB.includes("findWithdrawBlockers"));
});

test("대역이 실제 비식별화와 같은 일을 한다", () => {
  // deps.anonymize에 넣는 대역이 실제 anonymizeWithdrawnUser와 어긋나면
  // 이 파일의 동작 테스트가 거짓 안심을 준다. 실제 함수가 비우는 항목을 확인한다.
  const withdraw = read("src/lib/server/withdrawAccount.ts");
  const start = withdraw.indexOf("export function anonymizeWithdrawnUser");
  assert.ok(start > 0);
  const body = withdraw.slice(start, withdraw.indexOf("\n}", start));
  for (const line of [
    'user.phone = ""',
    "delete user.kakaoId",
    "delete user.naverId",
    "user.points = 0",
    "delete data.wishlists[user.id]",
    "delete data.coupons[user.id]",
    "delete data.notifications[user.id]",
    "delete data.notificationSettings[user.id]",
    "user.withdrawnAt = new Date().toISOString()",
  ]) {
    assert.ok(body.includes(line), `실제 비식별화가 바뀌었다: ${line}`);
  }
  // 반대로, 흡수에서 쓰면 안 되는 것이 그 함수에 들어오지 않았는지도 본다.
  assert.ok(!body.includes("unlink"), "비식별화가 OAuth 연결을 끊으면 흡수에 쓸 수 없다");
  assert.ok(!body.includes("scrub"), "비식별화가 주문·결제를 스크럽하면 흡수에 쓸 수 없다");
});

/* ── 6. STEP 1/2 회귀 ────────────────────────────── */

test("STEP 1 신청·결제 관문이 그대로 있다", () => {
  const appRoute = read("src/app/api/app/route.ts");
  assert.equal((appRoute.match(/verifiedPhoneGate\(user\)/g) ?? []).length, 3);
});

test("STEP 2 차단이 그대로 있다", () => {
  const applyOrder = read("src/lib/server/applyOrder.ts");
  assert.ok(
    applyOrder.includes("(item) => hasVerifiedPhone(item) && referralCodeFor(item) === code,"),
    "referral 차단이 유지된다",
  );
  const chatPost = read("src/app/api/chat-inquiries/route.ts");
  assert.ok(chatPost.includes("await getVerifiedUserId()"), "chat guest 처리가 유지된다");
  const chatGuest = read("src/lib/server/chatGuest.ts");
  assert.ok(chatGuest.includes("await getVerifiedUserId()"), "chat 읽기 기준이 유지된다");
  const appRoute = read("src/app/api/app/route.ts");
  assert.ok(appRoute.includes("item.userId = owner.id"), "inquiry 비귀속이 유지된다");
});

test("승인 후 경로에는 여전히 phone gate가 없다", () => {
  for (const file of [
    "src/app/api/payments/nicepay/return/route.ts",
    "src/app/api/admin/payments/recommit/route.ts",
  ]) {
    const source = read(file);
    assert.ok(
      !source.includes("hasVerifiedPhone") &&
        !source.includes("verifiedPhoneGate") &&
        !source.includes("getVerifiedUserId"),
      `${file}`,
    );
  }
});
