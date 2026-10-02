/**
 * 일반 1:1 상담 선생님·상담 방법 허용값 (P1-10 F2).
 *
 * 실행: npx tsx --test src/lib/server/consultationChoice.test.ts
 *   (applyOrder.ts가 "@/..." 별칭을 쓰므로 별칭을 해석하는 tsx로 돌린다.)
 *
 * 저장은 writer spy가 받는다. DB·PG·네트워크는 쓰지 않는다.
 * preparePayment(route.ts)는 Next 요청 없이 부를 수 없어 검사 순서를 원문으로 고정한다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { checkConsultationChoice, commitConsultation } from "./applyOrder.ts";
import { CONSULT_TEACHERS, CONSULT_TIMES } from "./consultationSlots.ts";
import { CONSULT_METHODS } from "./eventConsultation.ts";
import type { AppData, Consultation, Order, User } from "@/lib/types/app";

const USER = "u-f2";
const DATE = "10월 20일(화)";
const TIME = CONSULT_TIMES[0];
const TEACHER = CONSULT_TEACHERS[0].name;

function makeData(extra: Partial<AppData> = {}): AppData {
  return {
    users: [{ id: USER, name: "테스트", points: 100000 } as unknown as User],
    orders: [], consultations: [], inquiries: [], reviews: [], wishlists: {},
    coupons: {}, couponCodes: {}, notifications: {}, notificationSettings: {},
    codes: {}, blockedSlots: [], adminPromo: null,
    ...extra,
  } as AppData;
}

async function commit(
  data: AppData,
  choice: { teacher?: string; method?: string },
  mode: "free-only" | "paid-approved" = "free-only",
) {
  const state = { calls: 0, order: null as Order | null };
  const result = await commitConsultation(
    data,
    data.users[0],
    {
      title: "1:1 사주상담",
      report: "",
      extraPerson: "",
      payment: "card",
      teacher: choice.teacher ?? TEACHER,
      datetime: `${DATE} ${TIME}`,
      purpose: "",
      method: choice.method ?? CONSULT_METHODS[0],
      option: "없음",
      // free-only는 적립금으로 0원, paid-approved는 승인 100,000원.
      details: mode === "free-only" ? { usePoints: "1" } : {},
    },
    {
      requireConsent: false,
      requireSchedule: false,
      verifyOfferedDate: false,
      write: async (_data: AppData, order: Order) => {
        state.calls += 1;
        state.order = order;
      },
      mode,
      ...(mode === "paid-approved" ? { approvedAmount: 100000 } : {}),
    },
  );
  return { result, state };
}

/* ── 판정 함수 ─────────────────────────────────────── */

test("허용 목록의 선생님·상담 방법은 모두 통과한다", () => {
  for (const teacher of CONSULT_TEACHERS) {
    for (const method of CONSULT_METHODS) {
      assert.equal(checkConsultationChoice(teacher.name, method), null, `${teacher.name}/${method}`);
    }
  }
});

test("공백을 붙이거나 목록에 없는 선생님은 거절한다(다듬어 맞춰 주지 않는다)", () => {
  for (const teacher of [`${TEACHER} `, ` ${TEACHER}`, "가짜 선생", "", "yubi"]) {
    assert.equal(checkConsultationChoice(teacher, CONSULT_METHODS[0]), "선생님을 다시 선택해 주세요.", JSON.stringify(teacher));
  }
});

test("목록에 없는 상담 방법(화상 상담·공백·임의 문자열)은 거절한다", () => {
  for (const method of ["화상 상담", `${CONSULT_METHODS[0]} `, "kakao", "", "아무거나"]) {
    assert.equal(checkConsultationChoice(TEACHER, method), "상담 방법을 선택해 주세요.", JSON.stringify(method));
  }
});

/* ── 0원 확정(commitConsultation free-only) ──────────────── */

test("정상 선생님 + 정상 방법 → 기존대로 저장", async () => {
  for (const method of CONSULT_METHODS) {
    const data = makeData();
    const { result, state } = await commit(data, { method });
    assert.equal(result.ok, true, method);
    assert.equal(state.calls, 1);
    assert.equal(data.consultations[0].teacher, TEACHER);
    assert.equal(data.consultations[0].method, method);
  }
});

test("잘못된 선생님·방법 → 400, 상담·주문·적립금 차감 저장 없음", async () => {
  for (const choice of [
    { teacher: `${TEACHER} ` },
    { teacher: "가짜 선생" },
    { method: "화상 상담" },
    { method: "아무거나" },
  ]) {
    const data = makeData();
    const { result, state } = await commit(data, choice);
    assert.equal(result.ok, false, JSON.stringify(choice));
    assert.equal(!result.ok && result.status, 400);
    assert.equal(state.calls, 0);
    assert.equal(data.consultations.length, 0);
    assert.equal(data.orders.length, 0);
    assert.equal(data.users[0].points, 100000);
  }
});

test("관리자 차단 슬롯: 정상 선생님은 409, 가짜 선생님으로도 우회되지 않음(400)", async () => {
  const blocked = () => makeData({ blockedSlots: [{ teacher: TEACHER, date: DATE, time: TIME }] });
  assert.equal((await commit(blocked(), {})).result.ok, false);
  const real = await commit(blocked(), {});
  assert.equal(!real.result.ok && real.result.status, 409);
  const fake = await commit(blocked(), { teacher: `${TEACHER} ` });
  assert.equal(!fake.result.ok && fake.result.status, 400);
  assert.equal(fake.state.calls, 0);
});

test("이미 예약된 슬롯: 가짜 선생님으로 이중 예약할 수 없다", async () => {
  const booked = {
    id: "c-booked",
    userId: "u-other",
    teacher: TEACHER,
    datetime: `${DATE} ${TIME}`,
    status: "상담 신청",
  } as Consultation;
  const real = await commit(makeData({ consultations: [booked] }), {});
  assert.equal(!real.result.ok && real.result.status, 409);
  const fake = await commit(makeData({ consultations: [booked] }), { teacher: "다른 선생" });
  assert.equal(!fake.result.ok && fake.result.status, 400);
  assert.equal(fake.state.calls, 0);
});

/* ── 결제 승인 확정 회귀 ─────────────────────────────── */

test("정상 paid-approved 상담 → 기존대로 저장", async () => {
  const data = makeData();
  const { result, state } = await commit(data, {}, "paid-approved");
  assert.equal(result.ok, true);
  assert.equal(state.calls, 1);
  assert.equal(state.order?.amount, 100000);
});

test("paid-approved는 preparePayment가 검증한 snapshot을 받으므로 여기서 다시 막지 않는다", () => {
  const apply = readFileSync(new URL("./applyOrder.ts", import.meta.url), "utf8");
  const body = apply.slice(apply.indexOf("export async function commitConsultation("));
  const check = body.indexOf("checkConsultationChoice(");
  assert.ok(check > 0);
  assert.match(body.slice(body.lastIndexOf("\n", check - 120), check), /if \(mode !== "paid-approved"\) \{/);
  // 슬롯 판정보다 먼저 본다.
  assert.ok(check < body.indexOf("isSlotAvailable("));
});

/* ── preparePayment 순서 ─────────────────────────────── */

test("preparePayment(consultation): 허용값 검사가 슬롯 확인·결제 준비 기록보다 먼저다", () => {
  const route = readFileSync(new URL("../../app/api/app/route.ts", import.meta.url), "utf8");
  const start = route.indexOf('if (action === "preparePayment")');
  const branch = route.indexOf('const teacher = String(body.teacher ?? "유비 선생");', start);
  const check = route.indexOf(
    'const choiceError = checkConsultationChoice(teacher, String(body.method ?? "카카오톡 상담"));',
    branch,
  );
  assert.ok(start > 0 && branch > start && check > branch, "consultation 분기 안에서 검사해야 한다");
  assert.ok(route.indexOf("return NextResponse.json({ error: choiceError }, { status: 400 });", check) > check);
  assert.ok(check < route.indexOf("isSlotAvailable(data, teacher, parsed.date, parsed.time)", start));
  assert.ok(check < route.indexOf("await createPayment(", start));
  // snapshot에 담기는 method 기본값이 검사 기본값과 같다(정상 요청 회귀 없음).
  assert.ok(route.indexOf('method: String(body.method ?? "카카오톡 상담"),', check) > check);
});

/* ── OPEN EVENT ──────────────────────────────────── */

test("OPEN EVENT 상담은 같은 허용 목록을 그대로 쓴다(새 목록을 만들지 않음)", () => {
  const event = readFileSync(new URL("./eventConsultation.ts", import.meta.url), "utf8");
  assert.match(event, /CONSULT_TEACHERS\.some\(\(item\) => item\.name === input\.teacher\)/);
  assert.match(event, /\(CONSULT_METHODS as readonly string\[\]\)\.includes\(input\.method\)/);
  const apply = readFileSync(new URL("./applyOrder.ts", import.meta.url), "utf8");
  assert.equal(/\["카카오톡 상담", "전화 상담"\]/.test(apply), false, "허용 목록을 복제하지 않는다");
});
