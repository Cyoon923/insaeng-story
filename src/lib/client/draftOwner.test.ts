/**
 * 신청서 draft 회원 격리 (P1-07).
 *
 * 실행: node --test src/lib/client/draftOwner.test.ts
 *
 * 같은 브라우저에서 회원이 바뀌면 이전 회원의 draft가 입력란에 채워지면 안 된다.
 * draft 저장소("insaeng-draft")에 주인 표식을 함께 두고, 지금 쿠키의 표식과 같을 때만 쓴다.
 * api.ts는 브라우저 모듈이라 window·localStorage·document를 먼저 세워 둔다.
 */
import assert from "node:assert/strict";
import test from "node:test";

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  clear() {
    this.map.clear();
  }
}

const storage = new MemoryStorage();
const fakeDocument = { cookie: "" };
const globals = globalThis as unknown as Record<string, unknown>;
globals.window = globals.window ?? {};
globals.localStorage = storage;
globals.document = fakeDocument;

const { saveDraft, getDraft, clearDraft, __draftInternals } = await import("./api.ts");
const { DRAFT_KEY, DRAFT_TTL_MS, DRAFT_OWNER_COOKIE, DRAFT_OWNER_FIELD } = __draftInternals;

const A = "a1b2c3";
const B = "d4e5f6";
const PII = { name: "회원A", phone: "01011112222", birth: "1980-01-01", content: "상담 내용" };

function loginAs(owner: string) {
  // 실제 브라우저처럼 다른 쿠키와 함께 있어도 읽을 수 있어야 한다.
  fakeDocument.cookie = owner ? `other=1; ${DRAFT_OWNER_COOKIE}=${owner}; easy=on` : "other=1";
}

function reset() {
  storage.clear();
  loginAs("");
}

test("같은 회원(표식 일치)이면 저장한 draft를 그대로 복원한다", () => {
  reset();
  loginAs(A);
  saveDraft("consultation", PII);
  assert.deepEqual(getDraft("consultation"), PII);
  const raw = JSON.parse(storage.getItem(DRAFT_KEY) ?? "{}");
  assert.equal(raw[DRAFT_OWNER_FIELD], A);
});

test("다른 회원(표식 불일치)에게는 이전 회원의 draft가 보이지 않고 그 자리에서 지워진다", () => {
  reset();
  loginAs(A);
  saveDraft("consultation", PII);
  saveDraft("premium", { name: "회원A" });
  loginAs(B);
  assert.deepEqual(getDraft("consultation"), {});
  assert.deepEqual(getDraft("premium"), {});
  assert.equal(storage.getItem(DRAFT_KEY), null);
  // B가 새로 저장하면 B의 것만 남는다. A의 값은 섞이지 않는다.
  saveDraft("consultation", { name: "회원B" });
  assert.deepEqual(getDraft("consultation"), { name: "회원B" });
  // A가 다시 로그인해도 B의 draft는 보이지 않는다.
  loginAs(A);
  assert.deepEqual(getDraft("consultation"), {});
});

test("로그아웃·세션 만료(표식 없음)면 이전 draft를 쓰지 않고 지운다", () => {
  reset();
  loginAs(A);
  saveDraft("saju-song", PII);
  loginAs("");
  assert.deepEqual(getDraft("saju-song"), {});
  assert.equal(storage.getItem(DRAFT_KEY), null);
});

test("표식이 없으면 새로 저장하지 않는다(주인 없는 개인정보를 남기지 않음)", () => {
  reset();
  saveDraft("story", PII);
  assert.equal(storage.getItem(DRAFT_KEY), null);
  assert.deepEqual(getDraft("story"), {});
});

test("주인 표식이 없는 예전(legacy) draft는 로그인한 회원에게도 보이지 않고 지워진다", () => {
  reset();
  storage.setItem(
    DRAFT_KEY,
    JSON.stringify({ consultation: { values: PII, savedAt: new Date().toISOString() } }),
  );
  loginAs(A);
  assert.deepEqual(getDraft("consultation"), {});
  assert.equal(storage.getItem(DRAFT_KEY), null);
});

test("같은 회원 안에서 7일 만료는 그대로다", () => {
  reset();
  loginAs(A);
  saveDraft("consultation", PII);
  const raw = JSON.parse(storage.getItem(DRAFT_KEY) ?? "{}");
  raw.consultation.savedAt = new Date(Date.now() - DRAFT_TTL_MS - 1000).toISOString();
  storage.setItem(DRAFT_KEY, JSON.stringify(raw));
  assert.deepEqual(getDraft("consultation"), {});
});

test("clearDraft는 같은 회원의 해당 flow만 지우고 표식은 유지한다", () => {
  reset();
  loginAs(A);
  saveDraft("consultation", PII);
  saveDraft("premium", { name: "회원A" });
  clearDraft("consultation");
  assert.deepEqual(getDraft("consultation"), {});
  assert.deepEqual(getDraft("premium"), { name: "회원A" });
  assert.equal(JSON.parse(storage.getItem(DRAFT_KEY) ?? "{}")[DRAFT_OWNER_FIELD], A);
});

test("getDraft는 주인 표식 칸을 flow 값으로 돌려주지 않는다", () => {
  reset();
  loginAs(A);
  saveDraft("consultation", PII);
  assert.deepEqual(getDraft(DRAFT_OWNER_FIELD), {});
});

test("깨진 저장값은 빈 draft로 본다", () => {
  reset();
  loginAs(A);
  storage.setItem(DRAFT_KEY, "{not json");
  assert.deepEqual(getDraft("consultation"), {});
});
