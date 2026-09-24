/**
 * 미완료 신청 draft의 7일 만료 (Privacy-Draft-Expiry-1).
 *
 * 실행: node --test src/lib/client/draftExpiry.test.ts
 *
 * draft는 localStorage에만 있고 서버로 자동 전송되지 않는다. 접수를 끝내지 않고
 * 이탈하면 이름·연락처·사주정보·사연이 브라우저에 남으므로, 마지막 저장 후
 * 7일이 지나면 복원하지 않고 그 자리에서 지운다.
 *
 * api.ts는 브라우저 모듈이라 window·localStorage를 먼저 세워 둔다.
 * fetch를 쓰는 함수(fetchMe·postApp)는 이 파일에서 부르지 않는다.
 */
import assert from "node:assert/strict";
import test from "node:test";

/** 테스트용 최소 localStorage. api.ts가 쓰는 세 메서드만 있다. */
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
const globals = globalThis as unknown as Record<string, unknown>;
globals.window = globals.window ?? {};
globals.localStorage = storage;

const { saveDraft, getDraft, clearDraft, __draftInternals } = await import("./api.ts");
const { DRAFT_KEY, DRAFT_TTL_MS } = __draftInternals;

const DAY_MS = 24 * 60 * 60 * 1000;

/** localStorage 한 칸을 그대로 읽는다. 저장 형태 자체를 보기 위한 것이다. */
function rawStore(): Record<string, { values?: unknown; savedAt?: unknown }> {
  return JSON.parse(storage.getItem(DRAFT_KEY) ?? "{}");
}

/** 특정 flow의 savedAt만 과거로 돌린다. 다른 flow는 건드리지 않는다. */
function ageFlow(flow: string, ms: number) {
  const store = rawStore();
  const entry = store[flow];
  assert.ok(entry, `${flow} draft가 없다`);
  entry.savedAt = new Date(Date.now() - ms).toISOString();
  storage.setItem(DRAFT_KEY, JSON.stringify(store));
}

function reset() {
  storage.clear();
}

/* ── 상수 ──────────────────────────────────────────── */

test("보관 한도는 7일이다", () => {
  assert.equal(DRAFT_TTL_MS, 7 * DAY_MS);
  // 키 이름은 바꾸지 않는다. 기존 브라우저에 남은 값을 계속 읽어야 한다.
  assert.equal(DRAFT_KEY, "insaeng-draft");
});

/* ── 저장 ──────────────────────────────────────────── */

test("저장하면 savedAt이 함께 생긴다", () => {
  reset();
  const before = Date.now();
  saveDraft("story", { name: "홍길동", phone: "01012345678" });
  const after = Date.now();

  const entry = rawStore().story;
  assert.ok(entry, "story draft가 없다");
  assert.equal(typeof entry.savedAt, "string");
  const savedAt = Date.parse(entry.savedAt as string);
  // 브라우저 기준 시각이다. 서버에서 받아 오지 않는다.
  assert.ok(savedAt >= before && savedAt <= after, "savedAt이 지금 시각이 아니다");
});

test("입력값과 savedAt을 섞지 않는다", () => {
  reset();
  saveDraft("story", { name: "홍길동" });
  const entry = rawStore().story;
  // values는 신청 details로 그대로 서버에 올라간다. savedAt이 섞이면 payload가 바뀐다.
  assert.deepEqual(entry.values, { name: "홍길동" });
  assert.equal("savedAt" in (entry.values as Record<string, unknown>), false);
});

test("이어 저장하면 값은 합치고 savedAt은 새로 쓴다", () => {
  reset();
  saveDraft("story", { name: "홍길동" });
  ageFlow("story", 2 * DAY_MS);
  const staleSavedAt = rawStore().story.savedAt;

  saveDraft("story", { phone: "01012345678" });
  const entry = rawStore().story;
  assert.deepEqual(entry.values, { name: "홍길동", phone: "01012345678" });
  assert.notEqual(entry.savedAt, staleSavedAt, "savedAt이 갱신되지 않았다");
});

/* ── 복원과 만료 ───────────────────────────────────── */

test("7일 미만이면 그대로 복원한다", () => {
  reset();
  saveDraft("story", { name: "홍길동", phone: "01012345678" });
  ageFlow("story", 7 * DAY_MS - 60 * 1000);
  assert.deepEqual(getDraft("story"), { name: "홍길동", phone: "01012345678" });
  // 복원했으면 지우지 않는다.
  assert.ok(rawStore().story, "유효한 draft를 지웠다");
});

test("7일을 넘으면 복원하지 않고 즉시 지운다", () => {
  reset();
  saveDraft("story", { name: "홍길동", phone: "01012345678" });
  ageFlow("story", 7 * DAY_MS + 60 * 1000);

  assert.deepEqual(getDraft("story"), {});
  // 돌려주지 않는 것으로 끝내지 않는다. 그 자리에서 localStorage에서 없앤다.
  assert.equal("story" in rawStore(), false, "만료 draft가 남아 있다");
});

test("한 번 지우면 다시 읽어도 비어 있다", () => {
  reset();
  saveDraft("story", { name: "홍길동" });
  ageFlow("story", 8 * DAY_MS);
  getDraft("story");
  assert.deepEqual(getDraft("story"), {});
});

/* ── legacy / 불량 값 ──────────────────────────────── */

test("savedAt이 없는 예전 draft는 복원하지 않고 지운다", () => {
  reset();
  // 이 구조가 생기기 전의 형태. flow 아래에 입력값이 바로 들어 있었다.
  storage.setItem(
    DRAFT_KEY,
    JSON.stringify({ story: { name: "홍길동", phone: "01012345678" } }),
  );
  assert.deepEqual(getDraft("story"), {});
  assert.equal("story" in rawStore(), false, "legacy draft가 남아 있다");
});

test("savedAt만 빠진 새 형태도 지운다", () => {
  reset();
  storage.setItem(DRAFT_KEY, JSON.stringify({ story: { values: { name: "홍길동" } } }));
  assert.deepEqual(getDraft("story"), {});
  assert.equal("story" in rawStore(), false);
});

test("읽을 수 없는 savedAt은 지운다", () => {
  for (const savedAt of ["", "어제", "not-a-date", "0000-00-00", null, 0, {}, []]) {
    reset();
    storage.setItem(
      DRAFT_KEY,
      JSON.stringify({ story: { values: { name: "홍길동" }, savedAt } }),
    );
    assert.deepEqual(getDraft("story"), {}, JSON.stringify(savedAt) ?? "undefined");
    assert.equal("story" in rawStore(), false, JSON.stringify(savedAt) ?? "undefined");
  }
});

test("values가 없거나 형태가 아니면 지운다", () => {
  for (const values of [undefined, null, "문자열", 123, []]) {
    reset();
    storage.setItem(
      DRAFT_KEY,
      JSON.stringify({ story: { values, savedAt: new Date().toISOString() } }),
    );
    assert.deepEqual(getDraft("story"), {});
    assert.equal("story" in rawStore(), false);
  }
});

test("localStorage 값 자체가 깨져 있어도 오류 없이 빈 값을 준다", () => {
  reset();
  storage.setItem(DRAFT_KEY, "{망가진 JSON");
  assert.deepEqual(getDraft("story"), {});
  // 저장도 그대로 이어진다.
  saveDraft("story", { name: "홍길동" });
  assert.deepEqual(getDraft("story"), { name: "홍길동" });
});

test("만료된 draft에 이어 저장하면 예전 값이 되살아나지 않는다", () => {
  reset();
  saveDraft("story", { name: "홍길동", phone: "01012345678" });
  ageFlow("story", 8 * DAY_MS);
  saveDraft("story", { name: "김철수" });
  assert.deepEqual(getDraft("story"), { name: "김철수" });
});

/* ── flow 독립성 ───────────────────────────────────── */

test("네 flow가 서로 독립으로 남는다", () => {
  reset();
  saveDraft("story", { name: "A" });
  saveDraft("premium", { name: "B" });
  saveDraft("saju-song", { name: "C" });
  saveDraft("consultation", { name: "D" });

  assert.deepEqual(getDraft("story"), { name: "A" });
  assert.deepEqual(getDraft("premium"), { name: "B" });
  assert.deepEqual(getDraft("saju-song"), { name: "C" });
  assert.deepEqual(getDraft("consultation"), { name: "D" });
});

test("한 flow가 만료되어도 다른 flow는 지우지 않는다", () => {
  reset();
  saveDraft("story", { name: "A" });
  saveDraft("premium", { name: "B" });
  saveDraft("saju-song", { name: "C" });
  saveDraft("consultation", { name: "D" });
  ageFlow("story", 8 * DAY_MS);

  assert.deepEqual(getDraft("story"), {});
  assert.equal("story" in rawStore(), false);
  // 나머지 셋은 값도 그대로고 저장소에서도 사라지지 않았다.
  assert.deepEqual(getDraft("premium"), { name: "B" });
  assert.deepEqual(getDraft("saju-song"), { name: "C" });
  assert.deepEqual(getDraft("consultation"), { name: "D" });
  assert.deepEqual(Object.keys(rawStore()).sort(), ["consultation", "premium", "saju-song"]);
});

test("legacy flow 하나가 섞여 있어도 유효한 flow는 보존한다", () => {
  reset();
  saveDraft("premium", { name: "B" });
  const store = rawStore();
  // 같은 칸에 예전 형태가 남아 있는 상황.
  (store as Record<string, unknown>).story = { name: "옛날값" };
  storage.setItem(DRAFT_KEY, JSON.stringify(store));

  assert.deepEqual(getDraft("story"), {});
  assert.deepEqual(getDraft("premium"), { name: "B" });
});

/* ── clearDraft 기존 동작 ──────────────────────────── */

test("접수 완료 시 해당 flow만 지운다", () => {
  reset();
  saveDraft("story", { name: "A" });
  saveDraft("consultation", { name: "D" });

  clearDraft("story");
  assert.deepEqual(getDraft("story"), {});
  assert.equal("story" in rawStore(), false);
  // 다른 flow는 그대로다(기존 동작).
  assert.deepEqual(getDraft("consultation"), { name: "D" });
});

test("없는 flow를 지워도 저장소를 건드리지 않는다", () => {
  reset();
  saveDraft("premium", { name: "B" });
  const before = storage.getItem(DRAFT_KEY);
  clearDraft("story");
  assert.equal(storage.getItem(DRAFT_KEY), before);
});

test("만료된 flow도 clearDraft로 지울 수 있다", () => {
  reset();
  saveDraft("story", { name: "A" });
  ageFlow("story", 8 * DAY_MS);
  clearDraft("story");
  assert.equal("story" in rawStore(), false);
});
