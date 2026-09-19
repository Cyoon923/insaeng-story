/**
 * 탈퇴 시 후기 비식별화 테스트 (Privacy-Reviews-Anonymization-2).
 *
 * 실행: node --test src/lib/server/withdrawAccountReviews.test.ts
 *
 * 보는 것은 scrubUserRecords가 후기에 하는 일뿐이다.
 * 후기 내용·공개 상태·targetKey는 그대로 두고 작성자 표시만 지우는지 확인한다.
 *
 * 다른 순수 모듈 테스트와 달리 shim이 붙어 있는 이유:
 * withdrawAccount.ts는 session·store를 값으로 import하고, 그 경로가 "@/..." 별칭이라
 * node --test가 그대로는 읽지 못한다(store는 DB 드라이버, session은 next/headers를 부른다).
 * 그래서 별칭만 실제 경로로 바꾸고 next/headers만 빈 것으로 대신 읽는다.
 * 이 테스트가 부르는 scrubUserRecords 자체는 둘 중 어느 것도 쓰지 않는 순수 함수다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { AppData, Review } from "@/lib/types/app";

const SRC_ROOT = new URL("../../", import.meta.url);
const NEXT_HEADERS_STUB = "stub:next-headers";

/**
 * node:module의 동기 훅. 지금 프로젝트의 @types/node(v20)에는 아직 선언이 없어
 * 필요한 모양만 여기에 적는다. 타입을 늘리려고 의존성을 올리지 않는다.
 */
type Resolved = { url: string; format?: string; shortCircuit?: boolean };
type Loaded = { format: string; source: string; shortCircuit?: boolean };
type Hooks = {
  resolve(specifier: string, context: unknown, next: (s: string, c: unknown) => Resolved): Resolved;
  load(url: string, context: unknown, next: (u: string, c: unknown) => Loaded): Loaded;
};
const { registerHooks } = (await import("node:module")) as unknown as {
  registerHooks: (hooks: Hooks) => void;
};

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "next/headers") return { url: NEXT_HEADERS_STUB, shortCircuit: true };
    if (specifier.startsWith("@/")) {
      return next(new URL(`${specifier.slice(2)}.ts`, SRC_ROOT).href, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === NEXT_HEADERS_STUB) {
      return {
        format: "module",
        source: "export const cookies = async () => ({ get: () => undefined });",
        shortCircuit: true,
      };
    }
    return next(url, context);
  },
});

const { WITHDRAWN_NAME, scrubUserRecords } = await import("./withdrawAccount.ts");

function review(id: string, userId: string | undefined, name: string): Review {
  const item: Review = {
    id,
    name,
    title: "이야기로 만드는 인생곡",
    rating: 5,
    text: "정말 감동이었습니다.",
    createdAt: "2026-01-02T03:04:05.000Z",
    visible: true,
    kind: "story",
    targetKey: `order:o-${id}`,
  };
  if (userId !== undefined) item.userId = userId;
  return item;
}

/** 후기만 보는 최소 저장소. 다른 목록은 비워 둔다. */
function appData(reviews?: Review[]): AppData {
  return {
    users: [],
    orders: [],
    consultations: [],
    inquiries: [],
    ...(reviews ? { reviews } : {}),
    wishlists: {},
    coupons: {},
    notifications: {},
    notificationSettings: {},
    codes: {},
    blockedSlots: [],
    adminPromo: null,
  } as AppData;
}

test("탈퇴 회원의 후기는 이름이 탈퇴회원으로 바뀐다", () => {
  const data = appData([review("r1", "u-1", "김채영")]);
  scrubUserRecords(data, "u-1");
  assert.equal(data.reviews[0].name, WITHDRAWN_NAME);
});

test("탈퇴 회원의 후기는 userId 프로퍼티 자체가 사라진다", () => {
  const data = appData([review("r1", "u-1", "김채영")]);
  scrubUserRecords(data, "u-1");
  // 값이 undefined인 것으로는 부족하다. 키가 남아 있으면 저장 JSON에도 흔적이 남는다.
  assert.equal("userId" in data.reviews[0], false);
});

test("후기 내용·공개 상태·대상은 그대로 둔다", () => {
  const before = review("r1", "u-1", "김채영");
  const data = appData([{ ...before }]);
  scrubUserRecords(data, "u-1");
  const after = data.reviews[0];
  assert.equal(after.text, before.text);
  assert.equal(after.rating, before.rating);
  assert.equal(after.title, before.title);
  assert.equal(after.kind, before.kind);
  assert.equal(after.createdAt, before.createdAt);
  assert.equal(after.visible, before.visible);
  assert.equal(after.targetKey, before.targetKey);
});

test("다른 회원의 후기는 바뀌지 않는다", () => {
  const data = appData([review("r1", "u-1", "김채영"), review("r2", "u-2", "이서준")]);
  scrubUserRecords(data, "u-1");
  const other = data.reviews[1];
  assert.equal(other.userId, "u-2");
  assert.equal(other.name, "이서준");
});

test("후기 목록이 없어도 오류 없이 지나간다", () => {
  const data = appData();
  assert.doesNotThrow(() => scrubUserRecords(data, "u-1"));
});

test("두 번 실행해도 결과가 같다", () => {
  const data = appData([review("r1", "u-1", "김채영"), review("r2", "u-2", "이서준")]);
  scrubUserRecords(data, "u-1");
  const once = JSON.stringify(data.reviews);
  scrubUserRecords(data, "u-1");
  assert.equal(JSON.stringify(data.reviews), once);
});

test("저장 형태(JSON)에도 userId 키가 남지 않는다", () => {
  const data = appData([review("r1", "u-1", "김채영")]);
  scrubUserRecords(data, "u-1");
  // 실제 저장은 store.ts가 JSON.stringify로 한다. 왕복 후에도 키가 없어야 한다.
  const restored = JSON.parse(JSON.stringify(data)) as AppData;
  assert.equal("userId" in restored.reviews[0], false);
  assert.equal(restored.reviews[0].name, WITHDRAWN_NAME);
});
