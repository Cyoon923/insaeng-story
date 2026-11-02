import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { prepareInquiryRetentionUpdate } from "./inquiryRetention.ts";

let admin = true;
let reads = 0;
let writes = 0;
let stored: unknown = null;
let exists = true;
let dbError = false;
let forceConflict = false;
let referenceExists = true;
let version = 0;
const versions = new WeakMap<object, number>();
class Conflict extends Error {}

mock.module("@/lib/server/chatInquiryApi", { namedExports: {
  requireAdmin: async () => admin ? null : Response.json({ error: "login" }, { status: 401 }),
} });
mock.module("@/lib/server/adminSession", { namedExports: { CURRENT_ADMIN_ACTOR: "admin" } });
mock.module("@/lib/server/store", { namedExports: {
  isAppStoreConflict: (e: unknown) => e instanceof Conflict,
  readData: async () => {
    reads++;
    if (dbError) throw new Error("private-db-details");
    const data = { inquiries: exists ? [{ id: "target", message: "private-body", retention: structuredClone(stored) }] : [] };
    versions.set(data, version);
    return data;
  },
  writeData: async (data: { inquiries: { retention: unknown }[] }) => {
    if (forceConflict || versions.get(data) !== version) throw new Conflict();
    stored = structuredClone(data.inquiries[0].retention); version++; writes++;
  },
  sqlClient: () => ({ query: async (sql: string, params: unknown[]) => {
    if (dbError) throw new Error("private-db-details column retention 42703");
    if (sql.includes("complaint_records")) return referenceExists ? [{ id: "record-1" }] : [];
    if (sql.startsWith("SELECT")) { reads++; return exists ? [{ retention: structuredClone(stored) }] : []; }
    assert.match(sql, /^UPDATE (chat_inquiries|refund_requests) SET retention/);
    const previous = params[2] === null ? null : JSON.parse(String(params[2]));
    if (forceConflict || JSON.stringify(previous) !== JSON.stringify(stored)) return [];
    stored = JSON.parse(String(params[1])); writes++; return [{ id: "target" }];
  } }),
} });

const route = import("../../app/api/admin/inquiry-retention/route.ts");
const GET = async (request: Request) => (await route).GET(request);
const POST = async (request: Request) => (await route).POST(request);
const decision = () => ({ classification: "general", resolvedAt: null, grounds: [], hold: null, complaintRecordIds: [] });
const hold = () => ({ reason: "classification-review", reviewAt: new Date(Date.now() + 86_400_000).toISOString() });
function reset() {
  admin = exists = referenceExists = true;
  reads = writes = version = 0; stored = null; dbError = forceConflict = false;
}
const get = (kind = "inquiry", id = "target") => GET(new Request(`https://example.test/api/admin/inquiry-retention?kind=${kind}&id=${id}`));
function post(d: unknown = decision(), kind = "inquiry", extra = {}) {
  return POST(new Request("https://example.test/api/admin/inquiry-retention", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, id: "target", expectedRevision: 0, decision: d, ...extra }),
  }));
}
test("비관리자는 본문이나 저장소를 읽기 전에 거부한다", async () => {
  reset(); admin = false;
  assert.equal((await get()).status, 401);
  const req = new Request("https://example.test", { method: "POST" });
  Object.defineProperty(req, "body", { get() { throw new Error("body must not be read"); } });
  assert.equal((await POST(req)).status, 401); assert.equal(reads + writes, 0);
});
for (const kind of ["inquiry", "chat", "refund"]) {
  test(`${kind}: 미분류 조회, 저장, 서버 이력과 개인정보 없는 응답`, async () => {
    reset(); const fresh = await get(kind);
    assert.deepEqual(await fresh.json(), { retention: null, revision: 0 });
    assert.equal(fresh.headers.get("cache-control"), "no-store");
    const before = Date.now(); const response = await post(decision(), kind);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.revision, 1); assert.equal(data.retention.history[0].actorId, "admin");
    assert(Date.parse(data.retention.history[0].at) >= before);
    assert(!JSON.stringify(data).includes("private-body"));
    assert.deepEqual(await (await get(kind)).json(), data);
    assert.equal(writes, 1);
  });
  test(`${kind}: 동일 revision 동시 요청은 한 번만 저장`, async () => {
    reset(); const responses = await Promise.all([post(decision(), kind), post(decision(), kind)]);
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]); assert.equal(writes, 1);
  });
}
test("진행 중 불만·혼합 문의는 종료 시각·연결 없이 보류와 함께 저장 가능", async () => {
  for (const classification of ["complaint", "mixed", "unclassified"]) {
    reset(); assert.equal((await post({ ...decision(), classification, hold: hold() })).status, 200);
    reset(); assert.equal((await post({ ...decision(), classification })).status, 400); assert.equal(writes, 0);
  }
  reset(); assert.equal((await post({ ...decision(), classification: "transaction", hold: { ...hold(), reason: "ongoing-handling" } })).status, 200);
});
test("미승인 근거, 허용 안 된 연결, 지난 보류일, 미래 종료일, 위조 이력을 거부", async () => {
  const invalid = [
    { ...decision(), grounds: [{ code: "transaction-record", policyVersion: "fake-v1", startsAt: null, endsAt: null }] },
    { ...decision(), complaintRecordIds: ["record-1"] },
    { ...decision(), hold: { ...hold(), reviewAt: "2000-01-01T00:00:00Z" } },
    { ...decision(), resolvedAt: "2999-01-01T00:00:00Z" },
    { ...decision(), history: [] },
    { ...decision(), classification: "complaint", hold: hold(), complaintRecordIds: Array.from({ length: 51 }, (_, i) => `r-${i}`) },
  ];
  for (const d of invalid) { reset(); assert.equal((await post(d)).status, 400); assert.equal(reads + writes, 0); }
  reset(); assert.equal((await post(decision(), "inquiry", { actorId: "attacker" })).status, 400);
  assert.equal((await post(decision(), "inquiry", { expectedRevision: -1 })).status, 400);
  assert.equal((await get("invalid")).status, 400); assert.equal((await get("chat", "")).status, 400);
});
test("분리 기록 연결은 존재하는 ID만 허용하며 연결 없이도 진행 중 분류 가능", async () => {
  const d = { ...decision(), classification: "complaint", hold: hold(), complaintRecordIds: ["record-1"] };
  reset(); referenceExists = false; assert.equal((await post(d)).status, 400); assert.equal(writes, 0);
  reset(); assert.equal((await post(d)).status, 200);
});
test("없는 기록·손상 값·DB 오류·충돌을 구분하고 오류 원문을 숨긴다", async () => {
  for (const kind of ["inquiry", "chat", "refund"]) {
    reset(); exists = false; assert.equal((await get(kind)).status, 404); assert.equal((await post(decision(), kind)).status, 404);
    reset(); stored = { version: 99 }; assert.equal((await get(kind)).status, 409); assert.equal((await post(decision(), kind)).status, 409); assert.equal(writes, 0);
    reset(); dbError = true;
    for (const response of [await get(kind), await post(decision(), kind)]) { assert.equal(response.status, 500); assert(!JSON.stringify(await response.json()).includes("private-db-details")); }
    reset(); forceConflict = true; assert.equal((await post(decision(), kind)).status, 409); assert.equal(writes, 0);
  }
});
test("최신 revision을 명시하면 이전 이력을 유지하고 새 이력을 추가한다", async () => {
  reset(); const previous = prepareInquiryRetentionUpdate(null, 0, decision(), "admin", "2020-01-01T00:00:00Z");
  assert(previous.ok); stored = previous.value;
  const response = await post(decision(), "inquiry", { expectedRevision: 1 });
  assert.equal(response.status, 200); const data = await response.json(); assert.equal(data.revision, 2); assert.equal(data.retention.history.length, 2);
  assert.deepEqual(data.retention.history[0], previous.value.history[0]);
});
test("잘못된 JSON·객체 형식 및 Content-Length 없는 대용량 본문을 저장 전에 거부", async () => {
  for (const [body, status] of [["{", 400], ["null", 400], ["[]", 400], [" ".repeat(16_385), 413]] as const) {
    reset(); const req = new Request("https://example.test", { method: "POST", headers: { "Content-Type": "application/json" }, body });
    assert.equal((await POST(req)).status, status); assert.equal(reads + writes, 0);
  }
  reset(); assert.equal((await POST(new Request("https://example.test", { method: "POST", body: "{}" }))).status, 400);
});
