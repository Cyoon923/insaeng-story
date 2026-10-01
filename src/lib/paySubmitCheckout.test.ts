/**
 * 결제 버튼(PaySubmit)의 신청 식별자(checkoutId)와 재진입 잠금 (P1-03 4단계).
 *
 * 실행: npx tsx --test src/lib/paySubmitCheckout.test.ts
 *   (PaySubmit이 "use client" 컴포넌트이고 "@/..." 별칭을 쓰므로 tsx로 돌린다.)
 *
 * 화면을 띄우는 테스트 도구(DOM·React 렌더러)가 프로젝트에 없어, 컴포넌트가 쓰는 내부 함수를
 * 직접 부르고 submit 안에서의 연결은 원문으로 고정한다(chatNodeMatch.test.ts와 같은 방식).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { __paySubmitInternals } from "@/components/apply/PaySubmit";

const { ensureCheckoutId, draftWithoutCheckoutId, runExclusive } = __paySubmitInternals;

/** localStorage draft 대역. 같은 storage를 공유하면 새로고침·다른 탭과 같다. */
function memoryDrafts(initial: Record<string, Record<string, string>> = {}) {
  const storage: Record<string, Record<string, string>> = structuredClone(initial);
  let uuidCalls = 0;
  const saves: { flow: string; values: Record<string, string> }[] = [];
  const deps = () => ({
    getDraft: (flow: string) => ({ ...(storage[flow] ?? {}) }),
    saveDraft: (flow: string, values: Record<string, string>) => {
      saves.push({ flow, values });
      storage[flow] = { ...(storage[flow] ?? {}), ...values };
    },
    randomUUID: () => {
      uuidCalls += 1;
      return `00000000-0000-4000-8000-00000000000${uuidCalls}`;
    },
  });
  return {
    storage,
    saves,
    deps,
    uuidCalls: () => uuidCalls,
    clear: (flow: string) => {
      delete storage[flow];
    },
  };
}

/* ── checkoutId 생성·재사용 ─────────────────────────── */

test("checkoutId가 없으면 UUID를 1회 만들어 그 flow draft에 저장한다", () => {
  const drafts = memoryDrafts({ story: { phone: "01012345678" } });
  const id = ensureCheckoutId("story", drafts.deps());
  assert.equal(id, "00000000-0000-4000-8000-000000000001");
  assert.equal(drafts.uuidCalls(), 1);
  assert.deepEqual(drafts.saves, [{ flow: "story", values: { checkoutId: id } }]);
  // 기존 입력값은 그대로다.
  assert.equal(drafts.storage.story.phone, "01012345678");
});

test("이미 있으면 새로 만들지 않고 그대로 쓴다", () => {
  const drafts = memoryDrafts({ premium: { checkoutId: "existing-id" } });
  assert.equal(ensureCheckoutId("premium", drafts.deps()), "existing-id");
  assert.equal(drafts.uuidCalls(), 0);
  assert.equal(drafts.saves.length, 0);
});

test("같은 draft에서 재시도·새로고침·다른 탭이면 같은 checkoutId", () => {
  const drafts = memoryDrafts({ "saju-song": { phone: "01012345678" } });
  const first = ensureCheckoutId("saju-song", drafts.deps());
  // prepare 실패·409·결제창 닫기 후 다시 누름
  assert.equal(ensureCheckoutId("saju-song", drafts.deps()), first);
  // 새로고침: 새 컴포넌트가 같은 storage를 읽는다
  assert.equal(ensureCheckoutId("saju-song", drafts.deps()), first);
  // 다른 탭: 같은 localStorage
  assert.equal(ensureCheckoutId("saju-song", drafts.deps()), first);
  assert.equal(drafts.uuidCalls(), 1);
});

test("flow마다 따로이고, 완료 후 draft가 지워지면 다음 신청은 새 값", () => {
  const drafts = memoryDrafts();
  const story = ensureCheckoutId("story", drafts.deps());
  const consult = ensureCheckoutId("consultation", drafts.deps());
  assert.notEqual(story, consult);
  drafts.clear("story"); // PaymentDraftCleanup → clearDraft(flow)
  assert.notEqual(ensureCheckoutId("story", drafts.deps()), story);
});

test("기본 의존성은 실제 draft 함수와 crypto.randomUUID다", () => {
  const source = readFileSync(new URL("../components/apply/PaySubmit.tsx", import.meta.url), "utf8");
  assert.match(source, /= \{ getDraft, saveDraft, randomUUID: \(\) => crypto\.randomUUID\(\) \}/);
});

/* ── details에는 넣지 않는다 ───────────────────────── */

test("draftWithoutCheckoutId는 checkoutId만 빼고 원본은 바꾸지 않는다", () => {
  const draft = { phone: "01012345678", checkoutId: "id-1", story: "사연" };
  const values = draftWithoutCheckoutId(draft);
  assert.deepEqual(values, { phone: "01012345678", story: "사연" });
  assert.equal(draft.checkoutId, "id-1");
});

/* ── 재진입 잠금 ──────────────────────────────────── */

test("동시에 두 번 눌러도 한 번만 실행된다(preparePayment 1회)", async () => {
  const lock = { current: false };
  let prepareCalls = 0;
  let release!: () => void;
  const run = async () => {
    prepareCalls += 1;
    await new Promise<void>((resolve) => {
      release = resolve;
    });
  };
  const first = runExclusive(lock, run);
  const second = runExclusive(lock, run);
  assert.equal(await second, false);
  release();
  assert.equal(await first, true);
  assert.equal(prepareCalls, 1);
});

test("실행이 끝나면(성공·실패 모두) 다시 누를 수 있다", async () => {
  const lock = { current: false };
  let calls = 0;
  assert.equal(await runExclusive(lock, async () => { calls += 1; }), true);
  await assert.rejects(
    runExclusive(lock, async () => {
      calls += 1;
      throw new Error("prepare failed");
    }),
    /prepare failed/,
  );
  assert.equal(lock.current, false);
  assert.equal(await runExclusive(lock, async () => { calls += 1; }), true);
  assert.equal(calls, 3);
});

/* ── submit 안에서의 연결(원문) ─────────────────────── */

const SOURCE = readFileSync(new URL("../components/apply/PaySubmit.tsx", import.meta.url), "utf8");
const SUBMIT = SOURCE.slice(SOURCE.indexOf("const submitOnce = async () => {"), SOURCE.indexOf("  return (\n"));

test("submit 전체가 잠금 안에서 실행되고 beforeSubmit 확인도 그 안에 있다", () => {
  assert.match(SOURCE, /const submit = \(\) => runExclusive\(submitting, submitOnce\);/);
  assert.match(SOURCE, /onClick=\{submit\}/);
  assert.match(SUBMIT, /await beforeSubmit\(\)\.catch\(/);
  // 이전의 beforeSubmit 전용 잠금은 공통 잠금으로 대체되었다.
  assert.equal(SOURCE.includes("beforeSubmitRunning"), false);
});

test("checkoutId는 결제 준비 요청 최상위로만 보내고 details에는 섞지 않는다", () => {
  assert.match(SUBMIT, /const checkoutId = ensureCheckoutId\(flow\);/);
  assert.match(
    SUBMIT,
    /postApp\(\{ action: "preparePayment", kind, checkoutId, \.\.\.applyBody \}\)/,
  );
  assert.match(SUBMIT, /\.\.\.draftWithoutCheckoutId\(draft\),/);
  assert.doesNotMatch(SUBMIT, /\.\.\.draft,/);
  // 0원 신청(createOrder / createConsultation)에는 보내지 않는다.
  assert.match(SUBMIT, /postApp\(\{ action: "createOrder", \.\.\.applyBody \}\)/);
  assert.match(SUBMIT, /postApp\(\{ action: "createConsultation", \.\.\.applyBody \}\)/);
  // 생성은 결제 준비 직전 한 곳뿐이다.
  assert.equal(SUBMIT.split("ensureCheckoutId(").length - 1, 1);
  assert.ok(SUBMIT.indexOf("ensureCheckoutId(flow)") < SUBMIT.indexOf('action: "preparePayment"'));
});

test("409 등 준비 실패는 서버 문구를 그대로 보이고 checkoutId를 지우거나 바꾸지 않는다", () => {
  // postApp은 !res.ok면 서버 error 문구로 throw하고, catch가 그 문구를 화면에 둔다.
  const api = readFileSync(new URL("./client/api.ts", import.meta.url), "utf8");
  assert.match(api, /throw new Error\(data\.error \?\? "요청에 실패했습니다\."\)/);
  assert.match(SUBMIT, /setError\(err instanceof Error \? err\.message : "결제에 실패했습니다\."\)/);
  // checkoutId를 지우거나 새로 쓰는 다른 경로가 없다. draft 정리는 기존 clearDraft(flow)뿐이다.
  assert.equal(SOURCE.split("saveDraft(").length - 1, 1);
  assert.doesNotMatch(SOURCE, /checkoutId: ""/);
  assert.equal(SUBMIT.split("clearDraft(flow)").length - 1, 2);
});

/* ── 상품별 화면 ──────────────────────────────────── */

test("이야기·프리미엄·사주(OPEN EVENT 포함)·상담 모두 같은 PaySubmit을 flow별로 쓴다", () => {
  const pages: [string, string][] = [
    ["../app/apply/story-song/6/page.tsx", 'flow="story"'],
    ["../app/apply/premium/6/page.tsx", 'flow="premium"'],
    ["../app/apply/saju-song/3/page.tsx", 'flow="saju-song"'],
    ["../app/apply/consultation/4/page.tsx", 'flow="consultation"'],
  ];
  for (const [path, flow] of pages) {
    const page = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(page, /<PaySubmit/, path);
    assert.ok(page.includes(flow), `${path} ${flow}`);
  }
  // OPEN EVENT는 사주 인생곡 화면에서 promotion과 beforeSubmit(상담 슬롯 확인)만 더한다.
  // flow가 같으므로 같은 draft의 checkoutId를 쓴다.
  const saju = readFileSync(new URL("../app/apply/saju-song/3/page.tsx", import.meta.url), "utf8");
  assert.match(saju, /promotion=\{/);
  assert.match(saju, /beforeSubmit=\{/);
});
