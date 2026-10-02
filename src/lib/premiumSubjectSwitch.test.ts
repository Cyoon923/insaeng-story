/**
 * 프리미엄 인생곡 1단계 "내 정보 ↔ 다른 사람 정보" 전환의 본인/타인 값 분리.
 * 사주 인생곡(sajuSongSubjectSwitch.test.ts)과 같은 정책이다.
 *
 * 실행: npx tsx --experimental-test-module-mocks --test src/lib/premiumSubjectSwitch.test.ts
 *
 * 실제 화면 컴포넌트(app/apply/premium/1/page.tsx)를 그대로 호출한다. DOM 도구가 없어
 * react 훅만 최소 대역(useState·useRef·마운트 1회 useEffect)으로 바꾸고, 돌려받은 요소 트리에서
 * 버튼·입력란의 onClick·onChange와 ApplyLayout의 validateNext를 직접 부른다.
 * draft·회원정보·프로필 저장(lib/client/api)은 메모리 대역이다. 서버에 닿지 않는다.
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

type Element = { type: unknown; props: Record<string, unknown> };

let states: unknown[] = [];
let refs: { current: unknown }[] = [];
let stateIndex = 0;
let refIndex = 0;
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
    useRef: (init: unknown) => {
      const i = refIndex++;
      if (!refs[i]) refs[i] = { current: init };
      return refs[i];
    },
    useEffect: (fn: () => void) => {
      if (!mounted) pendingEffects.push(fn);
    },
  },
});

const element = (type: unknown, props: Record<string, unknown>): Element => ({ type, props });
mock.module("react/jsx-runtime", {
  namedExports: { jsx: element, jsxs: element, Fragment: "Fragment" },
});
mock.module("react/jsx-dev-runtime", {
  namedExports: { jsxDEV: element, Fragment: "Fragment" },
});

const ApplyLayout = () => null;
mock.module("@/components/apply/ApplyLayout", { namedExports: { ApplyLayout } });
mock.module("@/components/apply/ApplyStepper", {
  namedExports: { STORY_STEPS: [], CHARCOAL_STEPPER: {} },
});
mock.module("@/components/apply/BirthTimeField", { namedExports: { BirthTimeField: () => null } });

const PROFILE = {
  id: "u-1",
  name: "본인",
  phone: "010-1111-2222",
  birth: "1980-01-01",
  birthTime: "9:30",
  unknownTime: false,
  bloodType: "A형",
  gender: "female",
  calendar: "lunar",
};

let draft: Record<string, string> = {};
let profileSaves: Record<string, unknown>[] = [];
let resolveMe: (value: { user: typeof PROFILE }) => void = () => {};

mock.module("@/lib/client/api", {
  namedExports: {
    getDraft: () => ({ ...draft }),
    saveDraft: (_flow: string, values: Record<string, string>) => {
      draft = { ...draft, ...values };
    },
    fetchMe: () => new Promise((resolve) => (resolveMe = resolve)),
    postApp: async (body: { action: string; profile: Record<string, unknown> }) => {
      if (body.action === "updateProfile") profileSaves.push(body.profile);
      return { ok: true };
    },
  },
});

async function page() {
  return (await import("../app/apply/premium/1/page.tsx")).default as () => Element;
}

/** 새로 마운트한다. 시작 draft를 주고, 마운트 effect까지 돌린다. */
async function mount(start: Record<string, string>) {
  states = [];
  refs = [];
  mounted = false;
  pendingEffects = [];
  draft = { ...start };
  profileSaves = [];
  const tree = await render();
  return tree;
}

async function render(): Promise<Element> {
  const Page = await page();
  stateIndex = 0;
  refIndex = 0;
  const tree = Page();
  if (!mounted) {
    mounted = true;
    const effects = pendingEffects;
    pendingEffects = [];
    for (const fn of effects) fn();
  }
  return tree;
}

/** 회원정보 응답을 도착시킨다. */
async function arriveProfile() {
  resolveMe({ user: PROFILE });
  await new Promise((resolve) => setImmediate(resolve));
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

const byLabel = (tree: Element, label: string) =>
  walk(tree).find((el) => el.props.label === label && typeof el.props.onClick === "function")!;
const byPlaceholder = (tree: Element, placeholder: string) =>
  walk(tree).find((el) => el.type === "input" && el.props.placeholder === placeholder)!;

async function click(label: string) {
  (byLabel(await render(), label).props.onClick as () => void)();
}
async function type(placeholder: string, value: string) {
  const input = byPlaceholder(await render(), placeholder);
  (input.props.onChange as (e: { target: { value: string } }) => void)({ target: { value } });
}
async function shown(placeholder: string) {
  return byPlaceholder(await render(), placeholder).props.value;
}
async function next() {
  const layout = walk(await render()).find((el) => el.type === ApplyLayout)!;
  return (layout.props.validateNext as () => string)();
}

const NAME = "실명을 입력해주세요";
const PHONE = "예) 010-1234-5678";
const BIRTH = "예) 1990-01-01";

async function enterOther() {
  await click("다른 사람 정보");
  await type(NAME, "엄마");
  await type(BIRTH, "1955-05-05");
  await click("음력");
  await click("여성");
  const unknown = walk(await render()).find((el) => el.type === "input" && el.props.type === "checkbox")!;
  (unknown.props.onChange as (e: { target: { checked: boolean } }) => void)({ target: { checked: true } });
}

test("내 정보: 프로필로 채우고, 다음 단계에서 본인 값을 프로필에 저장한다", async () => {
  await mount({});
  await arriveProfile();
  assert.equal(await shown(NAME), "본인");
  assert.equal(draft.name, "본인");
  assert.equal(await next(), "");
  assert.equal(profileSaves.length, 1);
  assert.equal(profileSaves[0].name, "본인");
  assert.equal(profileSaves[0].birth, "1980-01-01");
  assert.equal(profileSaves[0].birthTime, "9:30");
  assert.equal(profileSaves[0].gender, "female");
  assert.equal(profileSaves[0].calendar, "lunar");
});

test("기존 draft 값은 늦게 온 프로필이 덮지 않는다", async () => {
  await mount({ subject: "self", name: "내가 쓴 이름" });
  await arriveProfile();
  assert.equal(await shown(NAME), "내가 쓴 이름");
  assert.equal(await shown(BIRTH), "1980-01-01");
});

test("내 정보 → 다른 사람: 내 사주정보가 남지 않고 빈 칸에서 시작하며, 프로필에 저장하지 않는다", async () => {
  await mount({});
  await arriveProfile();
  await click("다른 사람 정보");
  assert.equal(await shown(NAME), "");
  assert.equal(await shown(BIRTH), "");
  assert.equal(draft.subject, "other");
  assert.equal(draft.name, "");
  assert.equal(draft.birth, "");
  assert.equal(draft.calendar, "양력");
  assert.equal(draft.bloodType, "");
  // 연락처는 신청자 것이라 그대로 남는다.
  assert.equal(await shown(PHONE), "010-1111-2222");
  assert.equal(draft.phone, "010-1111-2222");
  await enterOther();
  assert.equal(await next(), "");
  assert.equal(profileSaves.length, 0);
});

test("다른 사람 입력 → 내 정보: 프로필 값으로 되돌리고, 저장에 타인 값이 섞이지 않는다", async () => {
  await mount({});
  await arriveProfile();
  await enterOther();
  await click("내 정보");
  assert.equal(await shown(NAME), "본인");
  assert.equal(await shown(PHONE), "010-1111-2222");
  assert.equal(draft.phone, "010-1111-2222");
  assert.equal(await shown(BIRTH), "1980-01-01");
  assert.equal(draft.subject, "self");
  assert.equal(draft.name, "본인");
  assert.equal(draft.birth, "1980-01-01");
  assert.equal(draft.calendar, "음력");
  assert.equal(await next(), "");
  assert.equal(profileSaves.length, 1);
  const saved = JSON.stringify(profileSaves[0]);
  for (const other of ["엄마", "1955-05-05"]) {
    assert.equal(saved.includes(other), false, other);
  }
  assert.equal(profileSaves[0].name, "본인");
  assert.equal(profileSaves[0].birth, "1980-01-01");
  assert.equal(profileSaves[0].gender, "female");
  assert.equal(profileSaves[0].calendar, "lunar");
  assert.equal(profileSaves[0].unknownTime, false);
  assert.equal(profileSaves[0].birthTime, "9:30");
});

test("다시 다른 사람으로: 이번 화면에서 입력한 타인 값을 되살린다", async () => {
  await mount({});
  await arriveProfile();
  await enterOther();
  await click("내 정보");
  await click("다른 사람 정보");
  assert.equal(await shown(NAME), "엄마");
  assert.equal(await shown(BIRTH), "1955-05-05");
  assert.equal(draft.name, "엄마");
  assert.equal(draft.calendar, "음력");
  assert.equal(draft.subject, "other");
});

test("내 정보에서 고친 값은 전환을 오가도 유지된다", async () => {
  await mount({});
  await arriveProfile();
  await type(NAME, "본인수정");
  await click("다른 사람 정보");
  await click("내 정보");
  assert.equal(await shown(NAME), "본인수정");
  assert.equal(await next(), "");
  assert.equal(profileSaves[0].name, "본인수정");
});

test("다른 사람 draft로 다시 들어오면 프로필을 채우지 않고, 내 정보로 바꾸면 프로필로 되돌린다", async () => {
  await mount({ subject: "other", name: "엄마", birth: "1955-05-05" });
  await arriveProfile();
  assert.equal(await shown(NAME), "엄마");
  assert.equal(await shown(BIRTH), "1955-05-05");
  // 다른 사람 화면이어도 신청자 연락처는 프로필에서 채운다.
  assert.equal(await shown(PHONE), "010-1111-2222");
  await click("내 정보");
  assert.equal(await shown(NAME), "본인");
  assert.equal(await shown(BIRTH), "1980-01-01");
  assert.equal(await next(), "");
  assert.equal(profileSaves[0].name, "본인");
});

test("프로필이 오기 전에 내 정보로 돌아오면, 늦게 온 프로필이 본인 빈 칸을 채운다", async () => {
  await mount({ subject: "other", name: "엄마" });
  await click("내 정보");
  assert.equal(await shown(NAME), "");
  await arriveProfile();
  assert.equal(await shown(NAME), "본인");
  assert.equal(draft.name, "본인");
});

test("신청자 연락처: 다른 사람 화면에서 고친 번호가 전환을 오가도 그대로 유지된다", async () => {
  await mount({});
  await arriveProfile();
  await click("다른 사람 정보");
  await type(PHONE, "010-3333-4444");
  await click("내 정보");
  assert.equal(await shown(PHONE), "010-3333-4444");
  assert.equal(draft.phone, "010-3333-4444");
  await click("다른 사람 정보");
  assert.equal(await shown(PHONE), "010-3333-4444");
  assert.equal(draft.phone, "010-3333-4444");
});

test("프로필 도착 전에 입력한 연락처는 전환 뒤 늦게 온 프로필이 덮지 않는다", async () => {
  await mount({});
  await type(PHONE, "010-5555-6666");
  await click("다른 사람 정보");
  await arriveProfile();
  assert.equal(await shown(PHONE), "010-5555-6666");
  assert.equal(await shown(NAME), "");
});
