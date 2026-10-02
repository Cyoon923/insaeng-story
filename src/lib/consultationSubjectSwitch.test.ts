/**
 * 1:1 사주상담 2단계 "내 정보 ↔ 다른 사람 정보" 전환의 본인/타인 값 분리.
 * 사주 인생곡·프리미엄(sajuSongSubjectSwitch / premiumSubjectSwitch)과 같은 정책이다.
 * 연락처는 신청자 것이라 전환해도 유지하고, 상대방(counterpart*) 정보는 전환과 무관하다.
 *
 * 실행: npx tsx --experimental-test-module-mocks --test src/lib/consultationSubjectSwitch.test.ts
 *
 * 실제 화면 컴포넌트(app/apply/consultation/2/page.tsx)를 그대로 호출한다. 이 화면은
 * Suspense → 본문 → PersonFields로 중첩되어 있어, react 훅을 컴포넌트 인스턴스별로 들고 있는
 * 최소 렌더러(useState·useRef·deps 비교 useEffect·key 재마운트·정리 함수)를 둔다.
 * draft·회원정보·프로필 저장(lib/client/api)은 메모리 대역이다. 서버에 닿지 않는다.
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

type Props = Record<string, unknown>;
type Element = { type: unknown; props: Props; key?: unknown };
type Effect = { deps?: unknown[]; cleanup?: unknown };
type Instance = { states: unknown[]; refs: { current: unknown }[]; effects: Effect[] };

let instances = new Map<string, Instance>();
let seen = new Set<string>();
let current: Instance;
let stateIndex = 0;
let refIndex = 0;
let effectIndex = 0;
let pending: (() => void)[] = [];

mock.module("react", {
  namedExports: {
    Suspense: (props: Props) => props.children,
    useState: (init: unknown) => {
      const inst = current;
      const i = stateIndex++;
      if (!(i in inst.states)) inst.states[i] = typeof init === "function" ? (init as () => unknown)() : init;
      return [
        inst.states[i],
        (value: unknown) => {
          inst.states[i] =
            typeof value === "function" ? (value as (prev: unknown) => unknown)(inst.states[i]) : value;
        },
      ];
    },
    useRef: (init: unknown) => {
      const i = refIndex++;
      if (!current.refs[i]) current.refs[i] = { current: init };
      return current.refs[i];
    },
    useEffect: (fn: () => unknown, deps?: unknown[]) => {
      const inst = current;
      const i = effectIndex++;
      const prev = inst.effects[i];
      if (prev && deps && prev.deps && deps.every((dep, j) => Object.is(dep, prev.deps![j]))) return;
      pending.push(() => {
        if (typeof prev?.cleanup === "function") (prev.cleanup as () => void)();
        inst.effects[i] = { deps, cleanup: fn() };
      });
    },
  },
});

const element = (type: unknown, props: Props, key?: unknown): Element => ({ type, props, key });
mock.module("react/jsx-runtime", {
  namedExports: { jsx: element, jsxs: element, Fragment: "Fragment" },
});
mock.module("react/jsx-dev-runtime", {
  namedExports: { jsxDEV: element, Fragment: "Fragment" },
});

let layoutProps: Props = {};
mock.module("@/components/apply/ApplyLayout", {
  namedExports: {
    ApplyLayout: (props: Props) => {
      layoutProps = props;
      return props.children;
    },
  },
});
mock.module("@/components/apply/ApplyStepper", {
  namedExports: { CONSULT_STEPS: [], CHARCOAL_STEPPER: {} },
});
mock.module("@/components/apply/BirthTimeField", { namedExports: { BirthTimeField: () => null } });
mock.module("next/navigation", {
  namedExports: { useSearchParams: () => ({ get: () => null }) },
});

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
let me: Promise<{ user: typeof PROFILE }>;
let resolveMe: (value: { user: typeof PROFILE }) => void = () => {};

mock.module("@/lib/client/api", {
  namedExports: {
    getDraft: () => ({ ...draft }),
    saveDraft: (_flow: string, values: Record<string, string>) => {
      draft = { ...draft, ...values };
    },
    // 한 테스트 안에서는 같은 응답을 나눠 쓴다(실제 fetchMe의 진행 중 요청 합치기와 같다).
    fetchMe: () => me,
    postApp: async (body: { action: string; profile: Record<string, unknown> }) => {
      if (body.action === "updateProfile") profileSaves.push(body.profile);
      return { ok: true };
    },
  },
});

function resolve(node: unknown, path: string): unknown {
  if (Array.isArray(node)) return node.map((child, i) => resolve(child, `${path}.${i}`));
  if (!node || typeof node !== "object" || !("props" in node)) return node;
  const el = node as Element;
  if (typeof el.type === "function") {
    const id = `${path}/${(el.type as { name: string }).name}#${String(el.key ?? "")}`;
    seen.add(id);
    let inst = instances.get(id);
    if (!inst) {
      inst = { states: [], refs: [], effects: [] };
      instances.set(id, inst);
    }
    const saved = { current, stateIndex, refIndex, effectIndex };
    current = inst;
    stateIndex = 0;
    refIndex = 0;
    effectIndex = 0;
    const out = (el.type as (props: Props) => unknown)(el.props);
    ({ current, stateIndex, refIndex, effectIndex } = saved);
    return resolve(out, id);
  }
  return { type: el.type, props: { ...el.props, children: resolve(el.props.children, `${path}>`) } };
}

async function page() {
  return (await import("../app/apply/consultation/2/page.tsx")).default as () => Element;
}

async function render(): Promise<unknown> {
  const Page = await page();
  seen = new Set();
  pending = [];
  const tree = resolve({ type: Page, props: {} }, "root");
  // 이번 렌더에 없는 인스턴스(key가 바뀐 블록)는 정리하고 지운다.
  for (const [id, inst] of instances) {
    if (seen.has(id)) continue;
    for (const effect of inst.effects) {
      if (typeof effect?.cleanup === "function") (effect.cleanup as () => void)();
    }
    instances.delete(id);
  }
  const effects = pending;
  pending = [];
  for (const fn of effects) fn();
  return tree;
}

/** effect가 state를 바꾸면 한 번 더 그린 결과가 화면이다. */
async function settle() {
  await new Promise((resolve) => setImmediate(resolve));
  await render();
  return render();
}

async function mount(start: Record<string, string>) {
  instances = new Map();
  draft = { ...start };
  profileSaves = [];
  me = new Promise((resolve) => (resolveMe = resolve));
  await settle();
}

async function arriveProfile() {
  resolveMe({ user: PROFILE });
  await settle();
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

/** n번째(0 = 본인 상담 정보, 1 = 상대방 정보) 입력란. */
async function input(placeholder: string, n = 0) {
  const all = walk(await render()).filter((el) => el.type === "input" && el.props.placeholder === placeholder);
  return all[n];
}
async function button(text: string, n = 0) {
  const all = walk(await render()).filter((el) => el.type === "button" && el.props.children === text);
  return all[n];
}
async function click(text: string, n = 0) {
  ((await button(text, n)).props.onClick as () => void)();
  await settle();
}
async function type(placeholder: string, value: string, n = 0) {
  ((await input(placeholder, n)).props.onChange as (e: { target: { value: string } }) => void)({
    target: { value },
  });
  await settle();
}
async function shown(placeholder: string, n = 0) {
  return (await input(placeholder, n)).props.value;
}
async function unknownTime(n = 0) {
  const boxes = walk(await render()).filter((el) => el.type === "input" && el.props.type === "checkbox");
  (boxes[n].props.onChange as (e: { target: { checked: boolean } }) => void)({ target: { checked: true } });
  await settle();
}
async function next() {
  await render();
  return (layoutProps.validateNext as () => string)();
}

const NAME = "실명을 입력해주세요";
const PHONE = "예) 010-1234-5678";
const BIRTH = "예) 1990-01-01";

async function enterOther() {
  await click("다른 사람 정보");
  await type(NAME, "엄마");
  await type(BIRTH, "1955-05-05");
  await click("음력");
  await click("남성");
  await unknownTime();
}

test("내 정보: 프로필로 채우고, 다음 단계에서 본인 값을 프로필에 저장한다", async () => {
  await mount({});
  await arriveProfile();
  assert.equal(await shown(NAME), "본인");
  assert.equal(await shown(PHONE), "010-1111-2222");
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

test("내 정보 → 다른 사람: 내 사주정보가 남지 않고 빈 칸에서 시작하며, 연락처는 유지한다", async () => {
  await mount({});
  await arriveProfile();
  await click("다른 사람 정보");
  assert.equal(await shown(NAME), "");
  assert.equal(await shown(BIRTH), "");
  assert.equal(draft.subject, "other");
  assert.equal(draft.name, "");
  assert.equal(draft.birth, "");
  assert.equal(draft.birthTime, "");
  assert.equal(draft.calendar, "양력");
  assert.equal(draft.bloodType, "");
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
  assert.equal(await shown(BIRTH), "1980-01-01");
  assert.equal(await shown(PHONE), "010-1111-2222");
  assert.equal(draft.subject, "self");
  assert.equal(draft.name, "본인");
  assert.equal(draft.birth, "1980-01-01");
  assert.equal(draft.calendar, "음력");
  assert.equal(draft.gender, "여성");
  assert.equal(draft.unknownTime, "");
  assert.equal(draft.phone, "010-1111-2222");
  assert.equal(await next(), "");
  assert.equal(profileSaves.length, 1);
  const saved = JSON.stringify(profileSaves[0]);
  for (const other of ["엄마", "1955-05-05"]) assert.equal(saved.includes(other), false, other);
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
  assert.equal(draft.unknownTime, "1");
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
  assert.equal(draft.name, "본인");
  assert.equal(await next(), "");
  assert.equal(profileSaves[0].name, "본인");
  assert.equal(JSON.stringify(profileSaves[0]).includes("엄마"), false);
});

test("프로필이 오기 전에 내 정보로 돌아오면, 프로필이 도착한 뒤 본인 값으로 되돌린다", async () => {
  await mount({ subject: "other", name: "엄마" });
  await click("내 정보");
  // 아직 타인 화면 그대로다. 프로필이 와야 전환한다(타인 값을 본인 칸으로 넘기지 않는다).
  assert.equal(draft.subject, "other");
  await arriveProfile();
  assert.equal(draft.subject, "self");
  assert.equal(await shown(NAME), "본인");
  assert.equal(draft.name, "본인");
});

test("늦게 온 프로필은 이미 입력한 본인 값과 연락처를 덮지 않는다", async () => {
  await mount({});
  await type(NAME, "직접입력");
  await type(PHONE, "010-5555-6666");
  await arriveProfile();
  assert.equal(await shown(NAME), "직접입력");
  assert.equal(await shown(PHONE), "010-5555-6666");
  assert.equal(await shown(BIRTH), "1980-01-01");
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

test("상대방(counterpart*) 정보는 전환과 섞이지 않고, 프로필에도 저장되지 않는다", async () => {
  await mount({ extraPerson: "1" });
  await arriveProfile();
  // 상대방 블록(두 번째)은 프로필로 채우지 않는다.
  assert.equal(await shown(NAME, 1), "");
  await type(NAME, "상대", 1);
  await type(BIRTH, "1985-03-03", 1);
  await unknownTime(1);
  assert.equal(draft.counterpartName, "상대");
  await enterOther();
  assert.equal(draft.counterpartName, "상대");
  assert.equal(draft.counterpartBirth, "1985-03-03");
  assert.equal(draft.name, "엄마");
  assert.equal(await shown(NAME, 1), "상대");
  await click("내 정보");
  assert.equal(draft.counterpartName, "상대");
  assert.equal(draft.counterpartBirth, "1985-03-03");
  assert.equal(draft.counterpartUnknownTime, "1");
  assert.equal(draft.name, "본인");
  assert.equal(await shown(NAME, 0), "본인");
  assert.equal(await shown(NAME, 1), "상대");
  assert.equal(await next(), "");
  const saved = JSON.stringify(profileSaves[0]);
  for (const other of ["상대", "1985-03-03", "엄마", "1955-05-05"]) {
    assert.equal(saved.includes(other), false, other);
  }
});
