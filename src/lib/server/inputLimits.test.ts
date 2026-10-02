/**
 * 신청·프로필 입력의 크기·타입 상한 (P1-10 F3).
 *
 * 실행: npx tsx --test src/lib/server/inputLimits.test.ts
 *   (applyOrder.ts가 "@/..." 별칭을 쓰므로 별칭을 해석하는 tsx로 돌린다.)
 *
 * 저장은 writer spy가 받는다. DB·PG·네트워크는 쓰지 않는다.
 * route.ts(preparePayment·updateProfile)는 Next 요청 없이 부를 수 없어 검사 위치를 원문으로 고정한다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  INPUT_LIMITS,
  checkApplyText,
  checkClientDetails,
  checkProfileInput,
  commitConsultation,
  commitOrder,
} from "./applyOrder.ts";
import { CONSULT_TEACHERS, CONSULT_TIMES } from "./consultationSlots.ts";
import { CONSULT_METHODS } from "./eventConsultation.ts";
import type { AppData, Order, User } from "@/lib/types/app";

const USER = "u-f3";
const LONG_STORY = "가".repeat(1000);

function makeData(points = 200000): AppData {
  return {
    users: [{ id: USER, name: "테스트", points } as unknown as User],
    orders: [], consultations: [], inquiries: [], reviews: [], wishlists: {},
    coupons: {}, couponCodes: {}, notifications: {}, notificationSettings: {},
    codes: {}, blockedSlots: [], adminPromo: null,
  } as AppData;
}

/** 0원 사주 인생곡(적립금). details는 위조·비정상 값을 그대로 실어 보낸다. */
async function order(details: unknown, title: unknown = "사주 인생곡", mode: "free-only" | "paid-approved" = "free-only") {
  const data = makeData(mode === "free-only" ? 200000 : 10000);
  const state = { calls: 0, order: null as Order | null };
  const result = await commitOrder(
    data,
    data.users[0],
    { product: "saju-song", title, options: [], payment: "card", details: details as Record<string, string> },
    {
      requireConsent: false,
      write: async (_d: AppData, o: Order) => {
        state.calls += 1;
        state.order = o;
      },
      mode,
      ...(mode === "paid-approved" ? { orderId: "o-paid", approvedAmount: 89000 } : {}),
    },
  );
  return { result, state, data };
}

async function consultation(details: unknown, text: { title?: unknown; purpose?: unknown; option?: unknown } = {}) {
  const data = makeData();
  const state = { calls: 0 };
  const result = await commitConsultation(
    data,
    data.users[0],
    {
      title: text.title ?? "1:1 사주상담",
      report: "",
      extraPerson: "",
      payment: "card",
      teacher: CONSULT_TEACHERS[0].name,
      datetime: `10월 20일(화) ${CONSULT_TIMES[0]}`,
      purpose: text.purpose ?? "인생 진로 · 방향 설정",
      method: CONSULT_METHODS[0],
      option: text.option ?? "없음",
      details: details as Record<string, string>,
    },
    {
      requireConsent: false,
      requireSchedule: false,
      verifyOfferedDate: false,
      write: async () => {
        state.calls += 1;
      },
    },
  );
  return { result, state, data };
}

const rejected = (r: { result: { ok: boolean; status?: number }; state: { calls: number } }) =>
  r.result.ok === false && r.result.status === 400 && r.state.calls === 0;

/* ── 정책 ─────────────────────────────────────────── */

test("상한은 한곳(INPUT_LIMITS)에 있고 화면 정상 최대 입력보다 넉넉하다", () => {
  assert.ok(INPUT_LIMITS.detailsMaxValueLength >= 1000, "자유서술 1,000자");
  assert.ok(INPUT_LIMITS.detailsMaxKeys >= 60);
  assert.ok(INPUT_LIMITS.titleMaxLength >= 20);
  assert.ok(INPUT_LIMITS.purposeMaxLength >= 120, "상담 목적 6개를 모두 고른 문구");
  assert.ok(INPUT_LIMITS.nameMaxLength >= 20);
});

/* ── details ─────────────────────────────────────── */

test("정상 details + 자유서술 1,000자 → 저장", async () => {
  const r = await order({ usePoints: "1", story: LONG_STORY, name: "홍길동", birth: "1990-01-01" });
  assert.equal(r.result.ok, true);
  assert.equal(r.state.calls, 1);
  assert.equal(r.state.order?.details.story, LONG_STORY);
});

test("값 길이 초과 → 400, 저장·적립금 차감 없음", async () => {
  const r = await order({ usePoints: "1", story: "가".repeat(INPUT_LIMITS.detailsMaxValueLength + 1) });
  assert.ok(rejected(r));
  assert.equal(r.data.users[0].points, 200000);
  assert.equal(r.data.orders.length, 0);
  // 정확히 상한까지는 받는다.
  assert.equal(
    (await order({ usePoints: "1", story: "가".repeat(INPUT_LIMITS.detailsMaxValueLength) })).result.ok,
    true,
  );
});

test("key 개수 초과 → 400, 저장 없음", async () => {
  const many: Record<string, string> = { usePoints: "1" };
  for (let i = 0; i < INPUT_LIMITS.detailsMaxKeys; i += 1) many[`k${i}`] = "v";
  assert.ok(rejected(await order(many)));
});

test("key 이름 길이 초과 → 400", async () => {
  assert.ok(rejected(await order({ usePoints: "1", ["k".repeat(INPUT_LIMITS.detailsMaxKeyLength + 1)]: "v" })));
});

test("문자열이 아닌 값(object/array/number/boolean/null) → 400 (조용히 바꾸지 않음)", async () => {
  for (const value of [{ a: 1 }, ["a"], 1, true, null]) {
    const r = await order({ usePoints: "1", story: value });
    assert.ok(rejected(r), JSON.stringify(value));
  }
});

test("details 자체가 객체가 아님(배열·문자열·null) → 400", async () => {
  for (const value of [["a"], "abc", null, 5]) {
    assert.ok(rejected(await order(value)), JSON.stringify(value));
    assert.ok(rejected(await consultation(value)), JSON.stringify(value));
  }
});

test("상담 details도 같은 상한: 초과 값 → 400", async () => {
  assert.ok(rejected(await consultation({ usePoints: "1", content: "가".repeat(INPUT_LIMITS.detailsMaxValueLength + 1) })));
  assert.ok(rejected(await consultation({ usePoints: "1", content: { nested: true } })));
});

/* ── F1과의 관계 ─────────────────────────────────── */

test("F1: 위조 서버 소유 키는 지워지고(비문자열이어도 거절 사유가 아님) 서버 계산값은 저장된다", async () => {
  const r = await order({
    usePoints: "1",
    pointsUsed: { forged: true },
    eventOrderId: ["x"],
    referralType: 1,
    couponFree: "1",
  });
  assert.equal(r.result.ok, true);
  const details = r.state.order!.details;
  assert.equal(details.pointsUsed, "99000");
  for (const key of ["eventOrderId", "referralType", "couponFree"]) assert.equal(key in details, false, key);
  assert.equal(r.state.order!.payment, "적립금");
});

test("paid-approved: preparePayment가 검증한 snapshot이라 다시 막지 않고 기존대로 저장", async () => {
  const r = await order({ usePoints: "1", pointsUsed: "10000" }, "사주 인생곡", "paid-approved");
  assert.equal(r.result.ok, true);
  assert.equal(r.state.order?.amount, 89000);
});

/* ── F2 회귀 ─────────────────────────────────────── */

test("F2: 정상 상담(허용 선생님·방법·정상 목적/옵션) → 저장", async () => {
  const r = await consultation({ usePoints: "1", content: "가".repeat(500) });
  assert.equal(r.result.ok, true);
  assert.equal(r.state.calls, 1);
});

/* ── title / purpose / option ───────────────────────── */

test("title·purpose·option 길이 초과 또는 비문자열 → 400", async () => {
  assert.ok(rejected(await order({ usePoints: "1" }, "가".repeat(INPUT_LIMITS.titleMaxLength + 1))));
  assert.ok(rejected(await order({ usePoints: "1" }, { t: 1 })));
  assert.ok(rejected(await consultation({ usePoints: "1" }, { title: "가".repeat(INPUT_LIMITS.titleMaxLength + 1) })));
  assert.ok(rejected(await consultation({ usePoints: "1" }, { purpose: "가".repeat(INPUT_LIMITS.purposeMaxLength + 1) })));
  assert.ok(rejected(await consultation({ usePoints: "1" }, { option: "가".repeat(INPUT_LIMITS.optionMaxLength + 1) })));
});

test("checkApplyText: 값이 없으면 기본값을 쓰므로 통과, 상담 목적 6개 전부 선택 문구도 통과", () => {
  assert.equal(checkApplyText({}), null);
  const allPurposes =
    "자존감 회복 · 마음 치유 / 인생 진로 · 방향 설정 / 가족 관계 개선 / 사랑 · 관계 상담 / 직업 · 사업 고민 / 기타 인생 고민";
  assert.equal(checkApplyText({ title: "프리미엄 인생곡", purpose: allPurposes, option: "상담 기록 요약 리포트 +20,000원" }), null);
  assert.equal(checkClientDetails({}), null);
});

/* ── updateProfile ───────────────────────────────── */

test("프로필 정상값 → 통과 (신청 화면·내 정보 화면 형식 모두)", () => {
  for (const profile of [
    { name: "홍길동", birth: "1990-01-01", birthTime: "9:30", bloodType: "A" },
    { name: "홍길동", birth: "1990-12-31", birthTime: "09:30", bloodType: "AB형" },
    { name: "", birth: "", birthTime: "", bloodType: "" },
    { birthTime: "23:50", bloodType: "모름" },
    { birthTime: "0:00", bloodType: "O형" },
    { gender: "male", calendar: "lunar", unknownTime: true, marketingAgreed: false },
    {},
  ]) {
    assert.equal(checkProfileInput(profile), null, JSON.stringify(profile));
  }
});

test("name 길이 초과·비문자열 → 거절", () => {
  assert.equal(checkProfileInput({ name: "가".repeat(INPUT_LIMITS.nameMaxLength + 1) }), "이름을 확인해 주세요.");
  assert.equal(checkProfileInput({ name: { x: 1 } }), "이름을 확인해 주세요.");
  assert.equal(checkProfileInput({ name: "가".repeat(INPUT_LIMITS.nameMaxLength) }), null);
});

test("birth: 잘못된 형식·존재하지 않는 날짜 → 거절, 정상 날짜 → 통과", () => {
  for (const birth of ["1990.01.01", "19900101", "1990-1-1", "1990-02-30", "2023-02-29", "1990-13-01", "abc", 19900101]) {
    assert.match(checkProfileInput({ birth }) ?? "", /생년월일/, String(birth));
  }
  for (const birth of ["1990-01-01", "2024-02-29", ""]) assert.equal(checkProfileInput({ birth }), null, birth);
});

test("birthTime 비정상 → 거절", () => {
  for (const birthTime of ["24:00", "9:60", "9:5", "09:300", "아침", "09-30", 930]) {
    assert.equal(checkProfileInput({ birthTime }), "태어난 시간을 다시 선택해 주세요.", String(birthTime));
  }
});

test("bloodType 비허용값 → 거절", () => {
  for (const bloodType of ["C", "a", "A형 ", "RH+", "AB형형", 1]) {
    assert.equal(checkProfileInput({ bloodType }), "혈액형을 다시 선택해 주세요.", String(bloodType));
  }
});

/* ── route 원문: 검사 위치와 기존 gender/calendar ───────────── */

const ROUTE = readFileSync(new URL("../../app/api/app/route.ts", import.meta.url), "utf8");

test("updateProfile: 형식 검사가 어떤 값 반영보다 먼저이고, 기존 gender·calendar 허용값 반영은 그대로", () => {
  const start = ROUTE.indexOf('if (action === "updateProfile")');
  const check = ROUTE.indexOf("const profileError = checkProfileInput(profile);", start);
  const assign = ROUTE.indexOf("const next: User = { ...user };", start);
  assert.ok(start > 0 && check > start && check < assign);
  assert.ok(ROUTE.indexOf("return NextResponse.json({ error: profileError }, { status: 400 });", check) < assign);
  const body = ROUTE.slice(start, ROUTE.indexOf("await writeData(data);", start));
  assert.match(body, /if \(value === "male" \|\| value === "female" \|\| value === ""\) next\.gender = value;/);
  assert.match(body, /if \(value === "solar" \|\| value === "lunar"\) next\.calendar = value;/);
});

test("preparePayment: 원본 details·제목·상담 문구 검사가 펼침 복사·결제 준비 기록보다 먼저", () => {
  const start = ROUTE.indexOf('if (action === "preparePayment")');
  const check = ROUTE.indexOf("checkClientDetails(body.details ?? {})", start);
  const spread = ROUTE.indexOf("const details = { ...((body.details as Record<string, string>) ?? {}) };", start);
  const payment = ROUTE.indexOf("await createPayment(", start);
  assert.ok(start > 0 && check > start, "preparePayment 안에서 검사해야 한다");
  assert.ok(check < spread && check < payment);
  assert.ok(ROUTE.indexOf("{ title: body.title, purpose: body.purpose, option: body.option }", start) < spread);
});
