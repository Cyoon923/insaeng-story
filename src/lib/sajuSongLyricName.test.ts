/**
 * 사주 인생곡 2단계: "노래에 이름을 넣을까요?" 선택과 추가 옵션 표시 순서.
 *
 * 실행: npx tsx --experimental-test-module-mocks --test src/lib/sajuSongLyricName.test.ts
 *
 * - 화면: 실제 app/apply/saju-song/2/page.tsx를 호출한다. react 훅만 최소 대역(useState·마운트 1회
 *   useEffect)으로 두고, 요소 트리에서 onClick과 ApplyLayout의 validateNext를 직접 부른다.
 *   draft(lib/client/api)는 메모리 대역이다.
 * - 주문: 실제 commitOrder로 확정해 details.lyricNameUse가 그대로 남는지 본다(저장은 writer spy).
 * - 관리자: app/admin/page.tsx의 실제 ORDER_DETAIL_FIELDS·orderDetailValue·orderDetailRows 소스를
 *   잘라 TypeScript로 변환해 실행한다(화면 파일이라 import할 수 없어서다).
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

type Element = { type: unknown; props: Record<string, unknown>; key?: unknown };

let states: unknown[] = [];
let stateIndex = 0;
let mounted = false;
let pendingEffects: (() => void)[] = [];

mock.module("react", {
  namedExports: {
    useState: (init: unknown) => {
      const i = stateIndex++;
      if (!(i in states)) states[i] = typeof init === "function" ? (init as () => unknown)() : init;
      return [
        states[i],
        (value: unknown) => {
          states[i] = typeof value === "function" ? (value as (prev: unknown) => unknown)(states[i]) : value;
        },
      ];
    },
    useEffect: (fn: () => void) => {
      if (!mounted) pendingEffects.push(fn);
    },
  },
});
const element = (type: unknown, props: Record<string, unknown>, key?: unknown): Element => ({ type, props, key });
mock.module("react/jsx-runtime", { namedExports: { jsx: element, jsxs: element, Fragment: "Fragment" } });
mock.module("react/jsx-dev-runtime", { namedExports: { jsxDEV: element, Fragment: "Fragment" } });

const ApplyLayout = () => null;
mock.module("@/components/apply/ApplyLayout", { namedExports: { ApplyLayout } });
mock.module("@/components/apply/ApplyStepper", { namedExports: { SAJU_STEPS: [], CHARCOAL_STEPPER: {} } });
mock.module("next/image", { defaultExport: () => null });
mock.module("next/link", { defaultExport: () => null });
mock.module("@/components/apply/PaySubmit", { namedExports: { PaySubmit: () => null } });

let draft: Record<string, string> = {};
mock.module("@/lib/client/api", {
  namedExports: {
    getDraft: (flow: string) => (flow === "saju-song" ? { ...draft } : {}),
    saveDraft: (flow: string, values: Record<string, string>) => {
      if (flow === "saju-song") draft = { ...draft, ...values };
    },
    fetchMe: () => new Promise(() => {}),
  },
});

let page = "../app/apply/saju-song/2/page.tsx";

async function render(): Promise<Element> {
  const Page = (await import(page)).default as () => Element;
  stateIndex = 0;
  const tree = Page();
  if (!mounted) {
    mounted = true;
    const effects = pendingEffects;
    pendingEffects = [];
    for (const fn of effects) fn();
  }
  return tree;
}

async function mount(start: Record<string, string>, step = 2) {
  page = `../app/apply/saju-song/${step}/page.tsx`;
  states = [];
  mounted = false;
  pendingEffects = [];
  draft = { ...start };
  await render();
}

function walk(node: unknown, found: Element[] = []): Element[] {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, found);
  } else if (node && typeof node === "object" && "props" in node) {
    const el = node as Element;
    found.push(el);
    walk(el.props.children, found);
  }
  return found;
}

async function radios() {
  return walk(await render()).filter((el) => el.props.role === "radio");
}
async function choose(id: string) {
  const radio = (await radios()).find((el) => el.key === id)!;
  (radio.props.onClick as () => void)();
}
async function next() {
  const layout = walk(await render()).find((el) => el.type === ApplyLayout)!;
  return (layout.props.validateNext as () => string)();
}

const OPTION_TITLES = [
  "2026·2027년 사주풀이 리포트",
  "내 얼굴 AI 뮤직비디오",
  "추억사진 영상 제작",
];

test("이름 선택: 기본 선택 없음, 고르기 전에는 다음 단계로 갈 수 없다", async () => {
  await mount({ name: "홍길동" });
  const items = await radios();
  assert.deepEqual(items.map((el) => el.key), ["include", "exclude"]);
  assert.deepEqual(items.map((el) => el.props["aria-checked"]), [false, false]);
  assert.equal(await next(), "노래에 이름을 넣을지 선택해 주세요.");
  assert.equal(draft.lyricNameUse, undefined);
});

test("\"이름을 넣어주세요\"를 고르면 include를 저장하고 다음 단계로 갈 수 있다", async () => {
  await mount({ name: "홍길동" });
  await choose("include");
  assert.equal(draft.lyricNameUse, "include");
  assert.deepEqual((await radios()).map((el) => el.props["aria-checked"]), [true, false]);
  assert.equal(await next(), "");
  // 이름은 다시 받지 않는다. 1단계 이름이 그대로 남는다.
  assert.equal(draft.name, "홍길동");
});

test("\"이름 없이 만들어주세요\"를 고르면 exclude를 저장한다(단일 선택)", async () => {
  await mount({});
  await choose("include");
  await choose("exclude");
  assert.equal(draft.lyricNameUse, "exclude");
  assert.deepEqual((await radios()).map((el) => el.props["aria-checked"]), [false, true]);
  assert.equal(await next(), "");
});

test("draft로 돌아오면 지난 선택이 그대로 보이고, 모르는 값은 미선택으로 본다", async () => {
  await mount({ lyricNameUse: "exclude" });
  assert.deepEqual((await radios()).map((el) => el.props["aria-checked"]), [false, true]);
  assert.equal(await next(), "");
  await mount({ lyricNameUse: "weird" });
  assert.deepEqual((await radios()).map((el) => el.props["aria-checked"]), [false, false]);
  assert.equal(await next(), "노래에 이름을 넣을지 선택해 주세요.");
});

function shownTexts(tree: Element): string[] {
  return walk(tree)
    .filter((el) => el.type === "p" && typeof el.props.children === "string")
    .map((el) => el.props.children as string);
}

test("추가 옵션은 리포트 → AI 뮤직비디오 → 추억사진 영상 3개이고, 가사 수정은 보이지 않는다", async () => {
  await mount({});
  const texts = shownTexts(await render());
  assert.deepEqual(texts.filter((text) => OPTION_TITLES.includes(text)), OPTION_TITLES);
  assert.equal(texts.includes("가사 수정 1회 추가"), false);
});

test("예전 draft에 남은 가사 수정 옵션은 선택으로 되살리지 않고 draft에서도 뺀다", async () => {
  await mount({
    optionIds: "lyric-edit,ai-mv",
    options: "내 얼굴 AI 뮤직비디오, 가사 수정 1회 추가",
    videoStyle: "AI 실사 영상풍",
  });
  assert.equal(draft.optionIds, "ai-mv");
  assert.equal(draft.options, "내 얼굴 AI 뮤직비디오");
  // 가사 수정만 있던 draft는 빈 선택이 된다.
  await mount({ optionIds: "lyric-edit", options: "가사 수정 1회 추가" });
  assert.equal(draft.optionIds, "");
  assert.equal(draft.options, "");
  // 정상 draft는 건드리지 않는다(고른 순서 유지).
  await mount({ optionIds: "saju-report-2026-2027,ai-mv", options: "x" });
  assert.equal(draft.optionIds, "saju-report-2026-2027,ai-mv");
  assert.equal(draft.options, "x");
});

test("3단계 확인 화면에 가사 이름 사용 1줄을 보여 주고, 가사 수정은 금액에 넣지 않는다", async () => {
  const rowOf = (tree: Element) => {
    const texts = shownTexts(tree);
    return texts[texts.indexOf("가사 이름 사용") + 1];
  };
  await mount({ lyricNameUse: "include" }, 3);
  assert.equal(rowOf(await render()), "이름 넣기");
  await mount({ lyricNameUse: "exclude" }, 3);
  assert.equal(rowOf(await render()), "이름 없이");
  await mount({}, 3);
  assert.equal(rowOf(await render()), "선택 필요");
  // 예전 draft의 가사 수정은 확인 화면 옵션·결제 옵션에 들어가지 않는다.
  await mount({ lyricNameUse: "include", optionIds: "lyric-edit,photo-mv" }, 3);
  // 결제 금액 내역(옵션 이름 span)에 추억사진 영상만 있고 가사 수정은 없다.
  const amountLines = walk(await render())
    .filter((el) => el.type === "span" && typeof el.props.children === "string")
    .map((el) => el.props.children as string);
  assert.ok(amountLines.includes("추억사진 영상 제작"));
  assert.equal(amountLines.includes("가사 수정 1회 추가"), false);
});

test("표시 순서만 바뀌고 저장 형식과 가격은 그대로다", async () => {
  const { calcOrderAmount } = await import("./server/pricing.ts");
  await mount({});
  // 리포트(맨 위)와 AI 뮤직비디오를 고른다.
  const toggles = walk(await render()).filter(
    (el) => el.type === "button" && typeof el.props.onClick === "function" && el.props.role !== "radio",
  );
  const byTitle = (title: string) =>
    toggles.find((el) => walk(el.props.children).some((child) => child.props.children === title))!;
  (byTitle("2026·2027년 사주풀이 리포트").props.onClick as () => void)();
  (byTitle("내 얼굴 AI 뮤직비디오").props.onClick as () => void)();
  // 저장 형식은 기존 그대로다: optionIds는 고른 순서, options(한글명)는 OPTIONS 배열 순서.
  assert.equal(draft.optionIds, "saju-report-2026-2027,ai-mv");
  assert.equal(draft.options, "내 얼굴 AI 뮤직비디오, 2026·2027년 사주풀이 리포트");
  const base = calcOrderAmount("saju-song", [])!.amount;
  assert.equal(calcOrderAmount("saju-song", ["saju-report-2026-2027"])!.amount, base + 10000);
  assert.equal(calcOrderAmount("saju-song", ["ai-mv"])!.amount, base + 100000);
  assert.equal(calcOrderAmount("saju-song", ["photo-mv"])!.amount, base + 50000);
  assert.equal(
    calcOrderAmount("saju-song", ["saju-report-2026-2027", "ai-mv", "photo-mv"])!.amount,
    base + 160000,
  );
});

test("주문 확정 뒤에도 details.lyricNameUse가 그대로 남는다", async () => {
  const { commitOrder } = await import("./server/applyOrder.ts");
  const { calcOrderAmount } = await import("./server/pricing.ts");
  const amount = calcOrderAmount("saju-song", [])!.amount;
  for (const value of ["include", "exclude"]) {
    const data = {
      users: [{ id: "u-1", name: "홍길동", points: 0 }],
      orders: [], consultations: [], inquiries: [], reviews: [], wishlists: {},
      coupons: {}, couponCodes: {}, notifications: {}, notificationSettings: {},
      codes: {}, blockedSlots: [], adminPromo: null,
    } as never;
    let saved: { details: Record<string, string> } | null = null;
    const result = await commitOrder(
      data,
      (data as { users: never[] }).users[0],
      {
        product: "saju-song",
        title: "사주 인생곡",
        options: [],
        payment: "card",
        details: { name: "홍길동", lyricNameUse: value },
      },
      {
        requireConsent: false,
        mode: "paid-approved",
        approvedAmount: amount,
        write: async (_data, order) => {
          saved = order as never;
        },
      },
    );
    assert.equal(result.ok, true);
    assert.equal(saved!.details.lyricNameUse, value);
    assert.equal(saved!.details.name, "홍길동");
  }
});

test("관리자 주문 상세에 \"가사 이름 사용: 이름 넣기 / 이름 없이\"로 보인다", () => {
  const source = readFileSync(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
  const start = source.indexOf("const ORDER_DETAIL_FIELDS");
  const valueEnd = source.indexOf("\n}\n", source.indexOf("function orderDetailValue(")) + 3;
  const rowsStart = source.indexOf("function orderDetailRows(");
  const rowsEnd = source.indexOf("\n}\n", rowsStart) + 3;
  const snippet = `${source.slice(start, valueEnd)}\n${source.slice(rowsStart, rowsEnd)}\nreturn orderDetailRows;`;
  const js = ts.transpileModule(snippet, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const orderDetailRows = new Function(js)() as (d: Record<string, string>) => { label: string; value: string }[];

  const rowsOf = (details: Record<string, string>) => orderDetailRows(details);
  assert.deepEqual(
    rowsOf({ lyricNameUse: "include" }).find((row) => row.label === "가사 이름 사용"),
    { label: "가사 이름 사용", value: "이름 넣기" },
  );
  assert.deepEqual(
    rowsOf({ lyricNameUse: "exclude" }).find((row) => row.label === "가사 이름 사용"),
    { label: "가사 이름 사용", value: "이름 없이" },
  );
  // 예전 주문(값 없음)에는 줄이 생기지 않는다.
  assert.equal(rowsOf({ name: "홍길동" }).some((row) => row.label === "가사 이름 사용"), false);
});

test("2단계 제목 구조: \"2. 노래 설정\"만 큰 제목, 이름 선택·추가 옵션은 같은 레벨 소제목", async () => {
  await mount({});
  const tree = walk(await render());
  const text = (el: Element) =>
    [el.props.children].flat().filter((child) => typeof child === "string").join("").trim();
  assert.deepEqual(tree.filter((el) => el.type === "h2").map(text), ["2. 노래 설정"]);
  const subheads = tree.filter((el) => el.type === "h3");
  assert.deepEqual(subheads.map(text), ["노래에 이름을 넣을까요?", "추가 옵션"]);
  // 두 소제목은 같은 스타일이다(여백 클래스만 다르다).
  const style = (el: Element) => String(el.props.className).replace(/\bmt-\d+\s*/, "");
  assert.equal(style(subheads[0]), style(subheads[1]));
  // 상단 hero 문구도 "노래 설정"에 맞춘다(다른 상품 hero는 그대로).
  const layout = tree.find((el) => el.type === ApplyLayout)!;
  assert.equal(layout.props.heroText, "나만의 노래를 위한\n설정을 선택해 주세요");
  assert.match(
    readFileSync(new URL("../app/apply/premium/5/page.tsx", import.meta.url), "utf8"),
    /heroText=\{"필요한 추가 옵션을\\n선택해 주세요"\}/,
  );
  // 이름 선택이 추가 옵션보다 먼저 나온다.
  const radioAt = tree.findIndex((el) => el.props.role === "radiogroup");
  assert.ok(radioAt < tree.indexOf(subheads[1]));
});

test("상단 단계 이름: 사주 인생곡만 \"노래 설정\"으로 바뀌고 다른 상품 단계는 그대로다", () => {
  const source = readFileSync(new URL("../components/apply/ApplyStepper.tsx", import.meta.url), "utf8");
  const block = (name: string) => source.slice(source.indexOf(`export const ${name}`), source.indexOf("];", source.indexOf(`export const ${name}`)));
  assert.match(block("SAJU_STEPS"), /\{ num: 1, label: "본인 정보" \},\s*\{ num: 2, label: "노래 설정" \},\s*\{ num: 3, label: "확인 및 결제" \}/);
  assert.equal(block("STORY_STEPS").includes("노래 설정"), false);
  assert.equal(block("CONSULT_STEPS").includes("노래 설정"), false);
});
