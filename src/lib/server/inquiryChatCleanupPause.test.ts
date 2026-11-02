/** DB 없이 실제 정리 진입점과 관리자 사전 확인의 중단을 검증한다. */
import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { AppData } from "../types/app.ts";
import { runCleanupExecute, type CleanupExecuteDeps } from "./cleanupExecuteAdminApi.ts";

let storageCalls = 0;
const forbiddenStorage = () => {
  storageCalls += 1;
  throw new Error("정리 중단 중에는 저장소에 접근하면 안 됩니다.");
};
mock.module("@/lib/server/store", {
  namedExports: {
    readData: forbiddenStorage,
    writeData: forbiddenStorage,
    sqlClient: forbiddenStorage,
    isAppStoreConflict: () => false,
  },
});
let denied = false;
mock.module("@/lib/server/chatInquiryApi", {
  namedExports: { requireAdmin: async () => denied ? new Response(null, { status: 401 }) : null },
});

const NOW = "2026-11-02T00:00:00.000Z";
const BLOCKED = { ok: false, reason: "classification-required" };
const load = () => import("./inquiryChatCleanupStore.ts");

test("오래된 미처리·완료 문의도 미분류이면 읽기·쓰기 없이 중단한다", async () => {
  const store = await load();
  const data = { inquiries: [
    { id: "pending", createdAt: "2020-01-01T00:00:00.000Z" },
    { id: "handled", createdAt: "2020-01-01T00:00:00.000Z", handledAt: "2020-02-01T00:00:00.000Z" },
  ] } as unknown as AppData;
  const before = structuredClone(data);
  let reads = 0;
  const result = await store.runExpiredInquiryCleanup({
    readData: async () => { reads += 1; return data; },
    writeData: forbiddenStorage,
    isConflict: () => false,
  }, NOW, 1);
  assert.deepEqual(result, { ...BLOCKED, attempts: 0 });
  assert.equal(reads, 0);
  assert.deepEqual(data, before);
  assert.equal(storageCalls, 0);
});

test("채팅 직접 실행도 상태와 무관하게 DB 연결·SELECT·DELETE 전에 중단한다", async () => {
  assert.deepEqual(await (await load()).runExpiredChatCleanup(NOW, 1), BLOCKED);
  assert.equal(storageCalls, 0);
});

test("잘못된 입력의 기존 실패 결과는 유지한다", async () => {
  const store = await load();
  assert.deepEqual(await store.runExpiredChatCleanup(NOW, 0), { ok: false, reason: "invalid-limit" });
  assert.deepEqual(await store.runExpiredChatCleanup("invalid", 1), { ok: false, reason: "invalid-now" });
  assert.equal(storageCalls, 0);
});

test("관리자 실행은 분류 필요를 전달하고 성공 0건으로 위장하거나 채팅으로 진행하지 않는다", async () => {
  const store = await load();
  let chatCalls = 0;
  const deps: CleanupExecuteDeps = {
    databaseMode: () => true,
    prepareSchema: forbiddenStorage,
    runRetention: forbiddenStorage,
    cleanupLegacyCodes: forbiddenStorage,
    deleteExpiredVerifications: forbiddenStorage,
    cleanupExpiredInquiries: (now, limit) => store.runExpiredInquiryCleanup(store.defaultInquiryCleanupDeps(), now, limit),
    cleanupExpiredChats: async (now, limit) => { chatCalls += 1; return store.runExpiredChatCleanup(now, limit); },
  };
  const result = await runCleanupExecute(deps, {
    action: "expired-inquiries-chat", confirm: "expired-inquiries-chat", limit: 1,
  }, NOW);
  assert.deepEqual(result.body, {
    action: "expired-inquiries-chat", ranAt: NOW,
    legacy: { ran: true, ...BLOCKED, deleted: 0, attempts: 0 },
    chat: { ran: false, ok: false, deleted: 0 },
  });
  assert.equal(chatCalls, 0);
  assert.equal(storageCalls, 0);
});

test("실제 preflight route는 409와 중단 문구를 반환하고 관리자 인증을 유지한다", async () => {
  const { POST } = await import("../../app/api/admin/inquiries-chat-cleanup-preflight/route.ts");
  const result = await POST();
  assert.equal(result.status, 409);
  assert.deepEqual(await result.json(), {
    error: "classification-required",
    message: "문의 분류와 보존 여부 확인 전까지 문의·채팅 정리를 중단합니다.",
  });
  denied = true;
  try { assert.equal((await POST()).status, 401); } finally { denied = false; }
  assert.equal(storageCalls, 0);
});
