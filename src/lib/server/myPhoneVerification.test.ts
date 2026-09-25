/**
 * 로그인 회원의 최초 휴대폰 본인확인 테스트 (소셜 간편가입 STEP 4).
 *
 * 실행: node --test src/lib/server/myPhoneVerification.test.ts
 *
 * 흐름 자체는 순수 함수 + deps라 전부 동작으로 확인한다.
 * 원문 검사는 보안 경계(무엇을 받지 않는가, 세션 전환 순서, 기존 게이트 보존)만 고정한다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  completeMyPhoneVerification,
  linkTokenKey,
  MY_PHONE_VERIFICATION_MAX_ATTEMPTS,
  type MyPhoneVerificationDeps,
} from "./myPhoneVerification.ts";
import type { AppData, Consultation, Coupon, User } from "@/lib/types/app";

const read = (path: string) => readFileSync(path, "utf8");

const PHONE = "01011112222";
const TOKEN = "tok-abc";

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

const WELCOME_COUPON: Coupon = {
  id: "c-welcome",
  title: "첫 방문 안내",
  desc: "안내",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function dataWith(users: User[], overrides: Partial<AppData> = {}): AppData {
  const coupons: Record<string, Coupon[]> = {};
  for (const user of users) coupons[user.id] = [WELCOME_COUPON];
  return {
    users,
    orders: [],
    consultations: [],
    inquiries: [],
    reviews: [],
    wishlists: {},
    coupons,
    notifications: {},
    notificationSettings: {},
    codes: {},
    blockedSlots: [],
    adminPromo: null,
    ...overrides,
  };
}

/** 저장 호출 기록. 원자성과 순서를 확인하는 데 쓴다. */
interface Trace {
  reads: number;
  countOrders: string[];
  countChats: string[];
  commits: { key: string; code: string }[];
  /** 저장에 넘어간 data 객체. 낡은 회차 객체가 다시 넘어가지 않는지 본다. */
  committedData: AppData[];
  anonymized: string[];
}

function makeDeps(
  snapshots: AppData[],
  options: {
    token?: { code: string } | null;
    orders?: number[];
    chats?: number[];
    /** 회차별 저장 결과. "conflict"는 CAS 밀림(예외), "code"는 토큰 불일치. */
    commit?: ("ok" | "conflict" | "code")[];
  } = {},
): { deps: MyPhoneVerificationDeps; trace: Trace } {
  const trace: Trace = {
    reads: 0,
    countOrders: [],
    countChats: [],
    commits: [],
    committedData: [],
    anonymized: [],
  };
  let commitCall = 0;

  class Conflict extends Error {}

  const deps: MyPhoneVerificationDeps = {
    readData: async () => {
      // 회차마다 다른 객체를 준다. 지난 회차의 객체를 재사용하면 테스트가 잡는다.
      const snapshot = snapshots[Math.min(trace.reads, snapshots.length - 1)];
      trace.reads += 1;
      return snapshot;
    },
    readToken: async () =>
      options.token === undefined
        ? { code: TOKEN, source: "table" }
        : options.token
          ? { code: options.token.code, source: "table" }
          : null,
    countOrders: async (id) => {
      trace.countOrders.push(id);
      return options.orders?.[trace.countOrders.length - 1] ?? 0;
    },
    countChatInquiries: async (id) => {
      trace.countChats.push(id);
      return options.chats?.[trace.countChats.length - 1] ?? 0;
    },
    formatPhone: (phone) => {
      const digits = phone.replace(/\D/g, "");
      return digits.length === 11
        ? `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
        : phone;
    },
    anonymize: (data, user) => {
      trace.anonymized.push(user.id);
      user.phone = "";
      user.name = "탈퇴회원";
      delete user.kakaoId;
      delete user.naverId;
      user.points = 0;
      delete data.coupons[user.id];
      user.withdrawnAt = "2026-09-25T00:00:00.000Z";
      return user;
    },
    commit: async (data, key, code) => {
      const plan = options.commit?.[commitCall] ?? "ok";
      commitCall += 1;
      trace.commits.push({ key, code });
      trace.committedData.push(data);
      if (plan === "conflict") throw new Conflict("cas");
      return { ok: plan === "ok" };
    },
    isConflict: (error) => error instanceof Conflict,
  };
  return { deps, trace };
}

/** kakao shell 하나. 같은 번호의 기존 회원은 없다. */
function shellOnly() {
  const shell = userWith({ id: "shell", phone: "", kakaoId: "K-1" });
  return { shell, data: dataWith([shell]) };
}

/** kakao shell + 같은 번호의 기존 회원. */
function shellAndTarget() {
  const shell = userWith({ id: "shell", phone: "", kakaoId: "K-1" });
  const target = userWith({
    id: "old",
    phone: "010-1111-2222",
    name: "홍길동",
    loginId: "gildong",
    passwordHash: "salt:hash",
    points: 5000,
    birth: "1970-03-04",
  });
  return { shell, target, data: dataWith([shell, target]) };
}

const input = { userId: "shell", phone: PHONE, token: TOKEN };

/* ── 1. 본인 인증 ─────────────────────────────────── */

test("세션이 가리키는 회원이 없으면 진행하지 않는다", async () => {
  const { data } = shellOnly();
  const { deps, trace } = makeDeps([data]);
  const result = await completeMyPhoneVerification({ ...input, userId: "nobody" }, deps);
  assert.equal(result.kind, "not-eligible");
  assert.equal(trace.commits.length, 0);
});

test("탈퇴한 회원은 진행하지 않는다", async () => {
  const { shell, data } = shellOnly();
  shell.withdrawnAt = "2026-02-01T00:00:00.000Z";
  const { deps, trace } = makeDeps([data]);
  const result = await completeMyPhoneVerification(input, deps);
  assert.equal(result.kind, "not-eligible");
  assert.equal(trace.commits.length, 0);
});

test("이미 다른 번호로 인증된 회원은 번호를 바꿀 수 없다", async () => {
  const { shell, data } = shellOnly();
  shell.phone = "010-9999-8888";
  const { deps, trace } = makeDeps([data]);
  const result = await completeMyPhoneVerification(input, deps);
  assert.equal(result.kind, "phone-already-set");
  assert.equal(shell.phone, "010-9999-8888", "번호가 바뀌지 않는다");
  assert.equal(trace.commits.length, 0, "저장하지 않는다");
});

test("이미 같은 번호를 가진 경우는 멱등 성공이다", async () => {
  const { shell, data } = shellOnly();
  shell.phone = "010-1111-2222";
  // 앞선 요청이 성공하며 토큰을 소비한 상태를 가정한다.
  const { deps, trace } = makeDeps([data], { token: null });
  const result = await completeMyPhoneVerification(input, deps);
  assert.equal(result.kind, "already-verified");
  assert.equal(trace.commits.length, 0, "두 번 저장하지 않는다");
});

test("토큰이 없으면 거부한다", async () => {
  const { data } = shellOnly();
  const { deps, trace } = makeDeps([data], { token: null });
  const result = await completeMyPhoneVerification(input, deps);
  assert.equal(result.kind, "token-expired");
  assert.equal(trace.commits.length, 0);
});

test("다른 토큰 값이면 거부한다", async () => {
  const { shell, data } = shellOnly();
  const { deps, trace } = makeDeps([data], { token: { code: "different" } });
  const result = await completeMyPhoneVerification(input, deps);
  assert.equal(result.kind, "token-expired");
  assert.equal(shell.phone, "", "번호가 저장되지 않는다");
  assert.equal(trace.commits.length, 0);
});

test("빈 토큰을 보내도 거부한다", async () => {
  const { shell, data } = shellOnly();
  const { deps } = makeDeps([data]);
  const result = await completeMyPhoneVerification({ ...input, token: "" }, deps);
  assert.equal(result.kind, "token-expired");
  assert.equal(shell.phone, "");
});

test("토큰은 그 번호의 키에서만 읽는다", async () => {
  const { data } = shellOnly();
  let askedKey = "";
  const { deps } = makeDeps([data]);
  const wrapped: MyPhoneVerificationDeps = {
    ...deps,
    readToken: async (key, current) => {
      askedKey = key;
      return deps.readToken(key, current);
    },
  };
  await completeMyPhoneVerification(input, wrapped);
  assert.equal(askedKey, linkTokenKey(PHONE));
  assert.equal(askedKey, `link:${PHONE}`, "completeSocialLink와 같은 키 규칙이다");
});

/* ── 2. target 결정 ───────────────────────────────── */

test("같은 번호의 기존 회원이 없으면 지금 회원에게 저장한다", async () => {
  const { shell, data } = shellOnly();
  const { deps, trace } = makeDeps([data]);
  const result = await completeMyPhoneVerification(input, deps);
  assert.equal(result.kind, "verified");
  assert.equal(shell.phone, "010-1111-2222", "기존 회원과 같은 저장 형식이다");
  assert.equal(shell.kakaoId, "K-1", "소셜 연결은 그대로다");
  assert.equal(shell.withdrawnAt, undefined, "활성 회원 그대로다");
  assert.equal(trace.commits.length, 1, "저장은 한 번이다");
  assert.equal(trace.commits[0].key, linkTokenKey(PHONE));
  assert.equal(trace.anonymized.length, 0);
});

test("같은 번호의 기존 회원이 있으면 흡수 경로로 간다", async () => {
  const { shell, target, data } = shellAndTarget();
  const { deps, trace } = makeDeps([data]);
  const result = await completeMyPhoneVerification(input, deps);
  assert.equal(result.kind, "absorbed");
  if (result.kind === "absorbed") {
    assert.equal(result.targetId, "old");
    assert.equal(result.shellId, "shell");
    assert.equal(result.provider, "kakao");
  }
  assert.equal(target.kakaoId, "K-1", "연결만 옮겨진다");
  assert.ok(shell.withdrawnAt, "shell은 종료된다");
  assert.equal(trace.commits.length, 1, "저장은 한 번이다");
});

test("탈퇴한 회원은 흡수 대상으로 찾지 않는다", async () => {
  const { shell, target, data } = shellAndTarget();
  target.withdrawnAt = "2026-02-01T00:00:00.000Z";
  const { deps } = makeDeps([data]);
  const result = await completeMyPhoneVerification(input, deps);
  // 활성 대상이 없으므로 지금 회원에게 번호를 저장한다.
  assert.equal(result.kind, "verified");
  assert.equal(shell.phone, "010-1111-2222");
  assert.equal(target.kakaoId, undefined);
});

test("번호 저장 형식이 달라도 같은 회원으로 찾는다", async () => {
  const { shell, target, data } = shellAndTarget();
  target.phone = "01011112222";
  const { deps } = makeDeps([data]);
  const result = await completeMyPhoneVerification(input, deps);
  assert.equal(result.kind, "absorbed");
  assert.equal(target.kakaoId, "K-1");
  assert.ok(shell.withdrawnAt);
});

/* ── 3. provider 결정 ─────────────────────────────── */

test("naver만 붙은 회원은 naverId를 옮긴다", async () => {
  const shell = userWith({ id: "shell", phone: "", naverId: "N-7" });
  const target = userWith({ id: "old", phone: "010-1111-2222", name: "홍길동" });
  const data = dataWith([shell, target]);
  const { deps } = makeDeps([data]);
  const result = await completeMyPhoneVerification(input, deps);
  assert.equal(result.kind, "absorbed");
  if (result.kind === "absorbed") assert.equal(result.provider, "naver");
  assert.equal(target.naverId, "N-7");
  assert.equal(target.kakaoId, undefined);
});

test("소셜 연결이 없으면 자동 흡수하지 않는다", async () => {
  const { shell, target, data } = shellAndTarget();
  delete shell.kakaoId;
  const { deps, trace } = makeDeps([data]);
  const result = await completeMyPhoneVerification(input, deps);
  assert.equal(result.kind, "absorb-unavailable");
  if (result.kind === "absorb-unavailable") assert.equal(result.reason.kind, "no-provider");
  assert.equal(shell.withdrawnAt, undefined);
  assert.equal(target.kakaoId, undefined, "기존 회원에 아무것도 붙지 않는다");
  assert.equal(trace.commits.length, 0, "아무것도 저장하지 않는다");
});

test("카카오와 네이버가 모두 붙어 있으면 자동 흡수하지 않는다", async () => {
  const { shell, target, data } = shellAndTarget();
  shell.naverId = "N-7";
  const { deps, trace } = makeDeps([data]);
  const result = await completeMyPhoneVerification(input, deps);
  assert.equal(result.kind, "absorb-unavailable");
  if (result.kind === "absorb-unavailable") assert.equal(result.reason.kind, "multiple-providers");
  assert.equal(shell.kakaoId, "K-1");
  assert.equal(shell.naverId, "N-7");
  assert.equal(target.kakaoId, undefined);
  assert.equal(trace.commits.length, 0);
});

test("비밀번호가 있는 회원은 흡수 대상이 아니다", async () => {
  const { shell, data } = shellAndTarget();
  shell.passwordHash = "salt:hash";
  const { deps, trace } = makeDeps([data]);
  const result = await completeMyPhoneVerification(input, deps);
  assert.equal(result.kind, "absorb-unavailable");
  if (result.kind === "absorb-unavailable") assert.equal(result.reason.kind, "password");
  assert.equal(shell.withdrawnAt, undefined);
  assert.equal(trace.commits.length, 0);
});

/* ── 4. 흡수 판정 ─────────────────────────────────── */

test("주문이 있으면 흡수하지 않고 아무것도 바꾸지 않는다", async () => {
  const { shell, target, data } = shellAndTarget();
  const { deps, trace } = makeDeps([data], { orders: [1] });
  const result = await completeMyPhoneVerification(input, deps);
  assert.equal(result.kind, "absorb-unavailable");
  if (result.kind === "absorb-unavailable" && result.reason.kind === "history") {
    assert.deepEqual(result.reason.blockers, ["orders"]);
  } else {
    assert.fail("history 사유여야 한다");
  }
  assert.equal(shell.kakaoId, "K-1");
  assert.equal(shell.withdrawnAt, undefined);
  assert.equal(target.kakaoId, undefined);
  assert.equal(trace.commits.length, 0);
});

test("채팅방이 있으면 흡수하지 않는다", async () => {
  const { data } = shellAndTarget();
  const { deps, trace } = makeDeps([data], { chats: [2] });
  const result = await completeMyPhoneVerification(input, deps);
  assert.equal(result.kind, "absorb-unavailable");
  assert.equal(trace.commits.length, 0);
});

test("상담이 있으면 흡수하지 않는다", async () => {
  const { shell, target } = shellAndTarget();
  const consultation = { id: "c1", userId: "shell" } as unknown as Consultation;
  const data = dataWith([shell, target], { consultations: [consultation] });
  const { deps, trace } = makeDeps([data]);
  const result = await completeMyPhoneVerification(input, deps);
  assert.equal(result.kind, "absorb-unavailable");
  assert.equal(trace.commits.length, 0);
});

test("provider 충돌이면 흡수하지 않는다", async () => {
  const { shell, target, data } = shellAndTarget();
  target.kakaoId = "K-OTHER";
  const { deps, trace } = makeDeps([data]);
  const result = await completeMyPhoneVerification(input, deps);
  assert.equal(result.kind, "absorb-unavailable");
  if (result.kind === "absorb-unavailable") {
    assert.equal(result.reason.kind, "provider-conflict");
  }
  assert.equal(target.kakaoId, "K-OTHER", "덮어쓰지 않는다");
  assert.equal(shell.withdrawnAt, undefined);
  assert.equal(trace.commits.length, 0);
});

test("제3의 활성 회원이 같은 연결을 들고 있으면 흡수하지 않는다", async () => {
  const { shell, data } = shellAndTarget();
  data.users.push(userWith({ id: "third", phone: "010-3333-4444", kakaoId: "K-1" }));
  const { deps, trace } = makeDeps([data]);
  const result = await completeMyPhoneVerification(input, deps);
  assert.equal(result.kind, "absorb-unavailable");
  assert.equal(shell.withdrawnAt, undefined);
  assert.equal(trace.commits.length, 0);
});

test("흡수해도 기존 회원의 데이터는 그대로다", async () => {
  const { shell, target, data } = shellAndTarget();
  shell.name = "카카오 회원";
  shell.birth = "1999-12-31";
  shell.points = 0;
  const { deps } = makeDeps([data]);
  await completeMyPhoneVerification(input, deps);
  assert.equal(target.name, "홍길동");
  assert.equal(target.phone, "010-1111-2222");
  assert.equal(target.points, 5000);
  assert.equal(target.birth, "1970-03-04");
  assert.equal(target.loginId, "gildong");
  assert.equal(target.passwordHash, "salt:hash");
  assert.equal(target.withdrawnAt, undefined);
  assert.deepEqual(data.coupons["old"], [WELCOME_COUPON]);
});

/* ── 5. 저장과 토큰 소비의 경계 ───────────────────── */

test("저장이 실패하면 성공으로 끝나지 않는다", async () => {
  const { shell, data } = shellOnly();
  const { deps, trace } = makeDeps([data], { commit: ["code"] });
  const result = await completeMyPhoneVerification(input, deps);
  assert.equal(result.kind, "token-expired");
  assert.equal(trace.commits.length, 1, "저장을 시도했다");
  // 실패했으므로 호출부는 성공으로 다루지 않는다. shell.phone은 저장되지 않은 사본 값이다.
  assert.equal(shell.withdrawnAt, undefined);
});

test("흡수 저장이 실패하면 흡수 성공을 돌려주지 않는다", async () => {
  const { data } = shellAndTarget();
  const { deps } = makeDeps([data], { commit: ["code"] });
  const result = await completeMyPhoneVerification(input, deps);
  assert.equal(result.kind, "token-expired");
});

test("토큰 소비는 저장과 같은 호출에서 일어난다", async () => {
  // deps.commit 하나가 app_store 저장과 토큰 소비를 함께 맡는다.
  // 별도 소비 함수를 부르지 않으므로 토큰만 먼저 사라질 수 없다.
  const { data } = shellOnly();
  const { deps, trace } = makeDeps([data]);
  await completeMyPhoneVerification(input, deps);
  assert.equal(trace.commits.length, 1);
  assert.equal(trace.commits[0].code, TOKEN);
});

/* ── 6. CAS 재시도 ───────────────────────────────── */

test("CAS가 밀리면 최신 자료로 다시 시도한다", async () => {
  // 1회차 자료와 2회차 자료를 따로 준다. 2회차에서 성공해야 한다.
  const first = shellOnly();
  const second = shellOnly();
  const { deps, trace } = makeDeps([first.data, second.data], { commit: ["conflict", "ok"] });
  const result = await completeMyPhoneVerification(input, deps);
  assert.equal(result.kind, "verified");
  assert.equal(trace.reads, 2, "회차마다 새로 읽는다");
  assert.equal(second.shell.phone, "010-1111-2222", "두 번째 자료에 반영된다");
});

test("밀린 회차의 자료를 저장에 다시 넘기지 않는다", async () => {
  /**
   * 1회차에서 고친 객체는 낡은 version을 들고 있다. 그것을 그대로 다시 저장하면
   * 그사이 다른 요청이 저장한 내용을 덮어쓴다. 그래서 2회차 저장에는 반드시
   * 새로 읽은 객체가 넘어가야 한다.
   *
   * (1회차 객체 자체는 이미 고쳐진 상태로 남지만 어디에도 저장되지 않았고
   *  다시 쓰이지도 않는다. 확인할 것은 "무엇이 저장에 넘어갔는가"다.)
   */
  const first = shellOnly();
  const second = shellOnly();
  const { deps, trace } = makeDeps([first.data, second.data], { commit: ["conflict", "ok"] });
  await completeMyPhoneVerification(input, deps);
  assert.equal(trace.committedData.length, 2);
  assert.equal(trace.committedData[0], first.data, "1회차는 1회차 객체로 시도했다");
  assert.equal(trace.committedData[1], second.data, "2회차는 새로 읽은 객체로 저장한다");
  assert.notEqual(trace.committedData[0], trace.committedData[1], "같은 객체를 다시 쓰지 않는다");
});

test("재시도할 때 Postgres 이력도 다시 읽는다", async () => {
  const first = shellAndTarget();
  const second = shellAndTarget();
  const { deps, trace } = makeDeps([first.data, second.data], { commit: ["conflict", "ok"] });
  await completeMyPhoneVerification(input, deps);
  assert.equal(trace.countOrders.length, 2, "회차마다 주문 개수를 다시 센다");
  assert.equal(trace.countChats.length, 2, "회차마다 채팅 개수를 다시 센다");
});

test("재시도 사이에 이력이 생기면 흡수하지 않는다", async () => {
  // 1회차는 깨끗했지만 밀렸고, 2회차에서 주문이 발견된 경우.
  const first = shellAndTarget();
  const second = shellAndTarget();
  const { deps, trace } = makeDeps([first.data, second.data], {
    commit: ["conflict", "ok"],
    orders: [0, 1],
  });
  const result = await completeMyPhoneVerification(input, deps);
  assert.equal(result.kind, "absorb-unavailable");
  assert.equal(second.shell.withdrawnAt, undefined, "2회차 판정으로 막힌다");
  assert.equal(trace.commits.length, 1, "1회차 저장 시도 한 번뿐이다");
});

test("재시도 사이에 흡수 대상이 생기면 그 대상을 다시 찾는다", async () => {
  // 1회차에는 같은 번호 회원이 없었고, 2회차에는 생겼다.
  const first = shellOnly();
  const second = shellAndTarget();
  const { deps } = makeDeps([first.data, second.data], { commit: ["conflict", "ok"] });
  const result = await completeMyPhoneVerification(input, deps);
  assert.equal(result.kind, "absorbed", "2회차 자료로 대상을 다시 찾는다");
  assert.equal(second.target.kakaoId, "K-1");
});

test("정해진 횟수를 모두 밀리면 아무것도 바꾸지 않고 끝낸다", async () => {
  const snapshots = [shellOnly(), shellOnly(), shellOnly()];
  const { deps, trace } = makeDeps(
    snapshots.map((item) => item.data),
    { commit: ["conflict", "conflict", "conflict"] },
  );
  const result = await completeMyPhoneVerification(input, deps);
  assert.equal(result.kind, "retry-later");
  if (result.kind === "retry-later") {
    assert.equal(result.attempts, MY_PHONE_VERIFICATION_MAX_ATTEMPTS);
  }
  assert.equal(trace.reads, MY_PHONE_VERIFICATION_MAX_ATTEMPTS, "무한히 돌지 않는다");
});

test("재시도 횟수는 3회로 묶여 있다", () => {
  assert.equal(MY_PHONE_VERIFICATION_MAX_ATTEMPTS, 3, "기존 정리 작업들과 같은 값이다");
});

test("CAS 충돌이 아닌 오류는 그대로 올린다", async () => {
  const { data } = shellOnly();
  const { deps } = makeDeps([data]);
  const boom: MyPhoneVerificationDeps = {
    ...deps,
    commit: async () => {
      throw new Error("db down");
    },
  };
  await assert.rejects(() => completeMyPhoneVerification(input, boom), /db down/);
});

/* ── 7. 세션 전환 (호출부 경계) ───────────────────── */

const APP_ROUTE = read("src/app/api/app/route.ts");

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

test("이 흐름은 세션을 직접 바꾸지 않는다", () => {
  const source = codeOnly(read("src/lib/server/myPhoneVerification.ts"));
  assert.ok(!source.includes("setUserId"), "세션 전환은 저장 확정 뒤 호출부가 한다");
  assert.ok(!source.includes("cookies"), "쿠키를 읽거나 쓰지 않는다");
});

test("세션 전환은 흡수 성공 분기에서만, 저장 뒤에 일어난다", () => {
  const block = actionBlock(codeOnly(APP_ROUTE), "completeMyPhoneVerification");
  // setUserId는 이 action 안에서 한 번뿐이고 absorbed 분기 안에 있다.
  assert.equal((block.match(/setUserId\(/g) ?? []).length, 1);
  const absorbedAt = block.indexOf('case "absorbed"');
  const setAt = block.indexOf("setUserId(");
  const verifiedAt = block.indexOf('case "verified"');
  assert.ok(absorbedAt > 0 && setAt > absorbedAt, "absorbed 분기 안에 있어야 한다");
  assert.ok(verifiedAt >= 0 && verifiedAt < absorbedAt, "verified 분기가 먼저 온다");
  // verified 분기(= 흡수 아님)에는 setUserId가 없다.
  const verifiedBlock = block.slice(verifiedAt, absorbedAt);
  assert.ok(!verifiedBlock.includes("setUserId"), "같은 회원이면 세션을 건드리지 않는다");
  // 저장은 completeMyPhoneVerification 안에서 끝나고, 그 뒤에 분기한다.
  const callAt = block.indexOf("await completeMyPhoneVerification(");
  assert.ok(callAt > 0 && callAt < setAt, "저장이 확정된 뒤에 세션을 바꾼다");
});

test("보상 rollback/merge를 만들지 않았다", () => {
  const block = codeOnly(APP_ROUTE);
  const source = codeOnly(read("src/lib/server/myPhoneVerification.ts"));
  for (const forbidden of ["rollback", "compensate", "mergeUsers"]) {
    assert.ok(!block.includes(forbidden) && !source.includes(forbidden), forbidden);
  }
});

/* ── 8. 입력 경계 (보안) ─────────────────────────── */

test("action은 body에서 userId/targetId/provider를 읽지 않는다", () => {
  const block = actionBlock(codeOnly(APP_ROUTE), "completeMyPhoneVerification");
  for (const forbidden of [
    "body.userId",
    "body.targetId",
    "body.provider",
    "body.providerUserId",
    "body.kakaoId",
    "body.naverId",
    "body.shellId",
  ]) {
    assert.ok(!block.includes(forbidden), `${forbidden}를 읽지 않는다`);
  }
  // 읽는 것은 번호와 토큰뿐이다.
  assert.ok(block.includes("body.phone"));
  assert.ok(block.includes("body.linkToken"));
});

test("지금 회원은 세션에서만 정한다", () => {
  const block = actionBlock(codeOnly(APP_ROUTE), "completeMyPhoneVerification");
  assert.ok(block.includes("userId: user.id"), "세션으로 확정된 user.id만 넘긴다");
});

test("흡수 대상은 인증된 번호로만 찾는다", () => {
  const source = codeOnly(read("src/lib/server/myPhoneVerification.ts"));
  // target 조회는 한 곳이고 phoneDigits 비교로만 이뤄진다.
  assert.ok(source.includes("phoneDigits(item.phone) === phone"));
  // 요청에서 흡수 대상을 받는 형태가 아니다.
  assert.ok(!source.includes("input.targetId"));
  assert.ok(!source.includes("body."), "이 모듈은 요청 본문을 보지 않는다");
});

test("기존 completeSocialLink의 로그인 거부 게이트가 그대로다", () => {
  const block = actionBlock(APP_ROUTE, "completeSocialLink");
  assert.ok(block.includes("if (await getActiveUserId())"), "로그인 상태 거부가 유지된다");
  assert.ok(block.includes("이미 로그인되어 있습니다"));
});

test("updateProfile은 여전히 phone을 바꾸지 않는다", () => {
  const block = actionBlock(APP_ROUTE, "updateProfile");
  assert.ok(!/next\.phone\s*=/.test(block));
  assert.ok(!/has\("phone"\)/.test(block));
});

test("새 verify purpose를 만들지 않았다", () => {
  assert.ok(
    APP_ROUTE.includes('const VERIFY_PURPOSES = ["signup", "reset", "link", "setid", "findid"] as const;'),
    "기존 purpose 목록 그대로다",
  );
});

/* ── 9. STEP 1/2/3 회귀 ──────────────────────────── */

test("STEP 1 신청·결제 관문이 그대로 있다", () => {
  assert.equal((APP_ROUTE.match(/verifiedPhoneGate\(user\)/g) ?? []).length, 3);
});

test("STEP 2 방어가 그대로 있다", () => {
  assert.ok(
    read("src/lib/server/applyOrder.ts").includes(
      "(item) => hasVerifiedPhone(item) && referralCodeFor(item) === code,",
    ),
  );
  assert.ok(read("src/app/api/chat-inquiries/route.ts").includes("await getVerifiedUserId()"));
  assert.ok(read("src/lib/server/chatGuest.ts").includes("await getVerifiedUserId()"));
  assert.ok(APP_ROUTE.includes("item.userId = owner.id"));
});

test("승인 후 경로에는 여전히 본인확인 판정이 없다", () => {
  for (const file of [
    "src/app/api/payments/nicepay/return/route.ts",
    "src/app/api/admin/payments/recommit/route.ts",
  ]) {
    const source = read(file);
    assert.ok(
      !source.includes("hasVerifiedPhone") &&
        !source.includes("verifiedPhoneGate") &&
        !source.includes("getVerifiedUserId") &&
        !source.includes("completeMyPhoneVerification"),
      file,
    );
  }
});

test("소셜 가입 콜백은 회원을 만들지 않고 최초 인증 경로도 부르지 않는다", () => {
  /**
   * STEP 5에서 콜백의 목적지가 휴대폰 인증 화면에서 동의 화면으로 바뀌었다.
   * 목적지 자체는 socialSignupNoPhone.test.ts가 고정한다. 여기서 지키는 것은
   * "콜백이 회원을 만들지 않고, 최초 본인확인 경로를 부르지도 않는다"는 경계다.
   */
  for (const file of [
    "src/app/api/auth/kakao/callback/route.ts",
    "src/app/api/auth/naver/callback/route.ts",
  ]) {
    // 콜백 주석이 "본인확인은 어디서 하는지"를 설명하며 그 이름을 적으므로 코드만 본다.
    const source = codeOnly(read(file));
    // 처음 보는 계정은 provider 정보만 서버 대기 상태에 남긴다.
    assert.ok(source.includes("createSocialLinkPending"), file);
    assert.ok(!source.includes("registerUser"), file);
    // 최초 본인확인은 로그인한 회원이 신청을 시작할 때 하는 일이다. 콜백의 일이 아니다.
    assert.ok(!source.includes("completeMyPhoneVerification"), file);
  }
});

test("신규 소셜 가입 화면은 그대로 약관 동의를 받는다", () => {
  const form = read("src/app/social-link/verify-phone/VerifyPhoneForm.tsx");
  assert.ok(form.includes('action: "completeSocialLink"'), "기존 가입 확정을 그대로 쓴다");
  assert.ok(form.includes("termsAgreed"), "필수 동의를 계속 받는다");
  assert.ok(!form.includes("completeMyPhoneVerification"), "새 action을 섞지 않는다");
});

/* ── 10. 신청 UX 연결 ───────────────────────────── */

test("신청 연결은 공통 진입점 한 곳에만 있다", () => {
  const paySubmit = read("src/components/apply/PaySubmit.tsx");
  assert.ok(paySubmit.includes("/my/verify-phone?next="), "인증 화면으로 보낸다");
  // 네 상품 페이지를 따로 고치지 않았다.
  for (const file of [
    "src/app/apply/story-song/6/page.tsx",
    "src/app/apply/premium/6/page.tsx",
    "src/app/apply/saju-song/4/page.tsx",
    "src/app/apply/consultation/4/page.tsx",
  ]) {
    assert.ok(!read(file).includes("verify-phone"), `${file}는 손대지 않았다`);
  }
});

test("클라이언트 연결이 서버 관문을 대신하지 않는다", () => {
  // 서버 관문 셋이 그대로 있고, 화면은 그 앞에서 안내만 한다.
  assert.equal((APP_ROUTE.match(/verifiedPhoneGate\(user\)/g) ?? []).length, 3);
  const paySubmit = read("src/components/apply/PaySubmit.tsx");
  // 기존 로그인 관문도 그대로다.
  assert.ok(paySubmit.includes("신청을 접수하려면 먼저 로그인해 주세요."));
});

test("인증 화면은 이미 인증된 회원을 들여보내지 않는다", () => {
  const page = read("src/app/my/verify-phone/page.tsx");
  assert.ok(page.includes("hasVerifiedPhone(me)"), "서버 판정을 그대로 쓴다");
  assert.ok(page.includes("getActiveUserId()"), "로그인 회원만 들어온다");
  assert.ok(page.includes("safeNextPath"), "복귀 경로를 기존 규칙으로 검사한다");
});
