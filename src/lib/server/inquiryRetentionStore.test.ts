/** 실행: node --import tsx --test src/lib/server/inquiryRetentionStore.test.ts. 저장소는 전부 메모리 대역이다. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { getInquiryRetention, saveInquiryRetention, type InquiryRetentionDeps } from "./inquiryRetentionStore.ts";
import type { AppData } from "../types/app.ts";

const NOW = "2026-11-02T00:00:00.000Z";
const decision = { classification: "general", resolvedAt: NOW, grounds: [], hold: null, complaintRecordIds: [] };
const input = { expectedRevision: 0, decision, actorId: "admin-test" };
const unexpected = () => { throw new Error("unexpected storage call"); };

test("일반 문의는 해당 문의 메타정보만 저장하며 본문·다른 문의를 보존한다", async () => {
  const data = { inquiries: [
    { id: "a", name: "sample", message: "keep" }, { id: "b", name: "other", message: "keep-other" },
  ], orders: [{ id: "keep-order" }] } as unknown as AppData;
  let writes = 0;
  const deps: InquiryRetentionDeps = { readData: async () => data, writeData: async (next) => { assert.equal(next, data); writes += 1; }, isConflict: () => false, sql: unexpected };
  assert.deepEqual(await getInquiryRetention({ kind: "inquiry", id: "a" }, deps), { kind: "unclassified" });
  assert.equal(writes, 0);
  assert.equal((await saveInquiryRetention({ kind: "inquiry", id: "a" }, input, deps, NOW)).ok, true);
  assert.equal(writes, 1);
  assert.equal(data.inquiries[0].message, "keep");
  assert.equal(data.inquiries[1].retention, undefined);
  assert.equal(data.orders[0].id, "keep-order");
  assert.equal((await getInquiryRetention({ kind: "inquiry", id: "a" }, deps)).kind, "stored");
  assert.deepEqual(await saveInquiryRetention({ kind: "inquiry", id: "a" }, input, deps, NOW), { ok: false, reason: "conflict" });
  assert.equal(writes, 1);
});

test("app_store CAS 실패는 자동 재시도·이력 덮어쓰기 없이 충돌로 반환한다", async () => {
  const data = { inquiries: [{ id: "a" }] } as unknown as AppData;
  let writes = 0;
  const conflict = new Error("conflict");
  const deps: InquiryRetentionDeps = { readData: async () => data, writeData: async () => { writes += 1; throw conflict; }, isConflict: (e) => e === conflict, sql: unexpected };
  assert.deepEqual(await saveInquiryRetention({ kind: "inquiry", id: "a" }, input, deps, NOW), { ok: false, reason: "conflict" });
  assert.equal(writes, 1);
  assert.equal(Object.hasOwn(data.inquiries[0], "retention"), false);
  deps.isConflict = () => false;
  await assert.rejects(saveInquiryRetention({ kind: "inquiry", id: "a" }, input, deps, NOW), conflict);
});

for (const kind of ["chat", "refund"] as const) {
  test(`${kind}: SQL 대역 동시 저장 1건 성공, 본문·상태 갱신 및 자동 DDL 없음`, async () => {
    let stored: unknown = null;
    const statements: string[] = [];
    const deps: InquiryRetentionDeps = {
      readData: unexpected, writeData: unexpected, isConflict: () => false,
      sql: () => ({ query: async (text, params) => {
        statements.push(text);
        assert.equal(params[0], "target");
        assert.match(text, new RegExp(kind === "chat" ? "chat_inquiries" : "refund_requests"));
        if (text.startsWith("SELECT")) return [{ retention: structuredClone(stored) }];
        assert.match(text, /SET retention = \$2::jsonb/);
        assert.match(text, /retention IS NOT DISTINCT FROM \$3::jsonb/);
        const previous = params[2] === null ? null : JSON.parse(String(params[2]));
        if (JSON.stringify(previous) !== JSON.stringify(stored)) return [];
        stored = JSON.parse(String(params[1]));
        return [{ id: "target" }];
      } }),
    };
    const results = await Promise.all([
      saveInquiryRetention({ kind, id: "target" }, input, deps, NOW),
      saveInquiryRetention({ kind, id: "target" }, { ...input, actorId: "other-admin" }, deps, NOW),
    ]);
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.equal(results.filter((r) => !r.ok && r.reason === "conflict").length, 1);
    assert.equal((await getInquiryRetention({ kind, id: "target" }, deps)).kind, "stored");
    assert.equal((await saveInquiryRetention({ kind, id: "target" }, { ...input, expectedRevision: 1 }, deps, NOW)).ok, true);
    const result = await getInquiryRetention({ kind, id: "target" }, deps);
    assert.equal(result.kind, "stored");
    if (result.kind === "stored") assert.equal(result.value.history.length, 2);
    assert.doesNotMatch(statements.join("\n"), /ALTER|CREATE|DELETE|INSERT|SET (body|status|message)/);
  });
}

test("없는 대상·손상 데이터·DB 미설정·미적용 컬럼을 성공이나 미분류로 숨기지 않는다", async () => {
  const deps: InquiryRetentionDeps = { readData: async () => ({ inquiries: [] } as unknown as AppData), writeData: unexpected, isConflict: () => false, sql: () => null };
  assert.deepEqual(await getInquiryRetention({ kind: "inquiry", id: "missing" }, deps), { kind: "not-found" });
  assert.deepEqual(await saveInquiryRetention({ kind: "inquiry", id: "missing" }, input, deps, NOW), { ok: false, reason: "not-found" });
  await assert.rejects(getInquiryRetention({ kind: "chat", id: "a" }, deps), /DATABASE_REQUIRED/);
  deps.sql = () => ({ query: async () => { throw new Error("column-not-applied"); } });
  await assert.rejects(saveInquiryRetention({ kind: "refund", id: "a" }, input, deps, NOW), /column-not-applied/);
  deps.sql = () => ({ query: async () => [{ retention: { version: 99 } }] });
  assert.deepEqual(await saveInquiryRetention({ kind: "refund", id: "a" }, input, deps, NOW), { ok: false, reason: "invalid-stored-data" });
});

test("입력 오류는 저장소 접근 전에 거절한다", async () => {
  const deps: InquiryRetentionDeps = { readData: unexpected, writeData: unexpected, isConflict: unexpected, sql: unexpected };
  assert.deepEqual(await saveInquiryRetention({ kind: "inquiry", id: "a" }, { ...input, decision: { ...decision, message: "private" } }, deps, NOW), { ok: false, reason: "invalid-input" });
});

test("migration은 별도 SQL 파일의 nullable 2컬럼 추가뿐이며 정리 중단은 유지한다", () => {
  const migration = readFileSync(new URL("./inquiryRetentionMigration.sql", import.meta.url), "utf8").replace(/--[^\n]*/g, "");
  assert.equal((migration.match(/ALTER TABLE/g) ?? []).length, 2);
  assert.match(migration, /ALTER TABLE chat_inquiries ADD COLUMN IF NOT EXISTS retention JSONB;/);
  assert.match(migration, /ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS retention JSONB;/);
  assert.doesNotMatch(migration, /DEFAULT|UPDATE|DELETE|INSERT|CREATE|NOT NULL/);
  const store = readFileSync(new URL("./inquiryRetentionStore.ts", import.meta.url), "utf8");
  assert.doesNotMatch(store, /ensureTable|ensureRefundRequests|Migration|\.sql["']/);
  assert.match(readFileSync(new URL("./inquiryChatCleanup.ts", import.meta.url), "utf8"), /INQUIRY_CHAT_CLEANUP_PAUSED = true/);
});
