/**
 * 일반 1:1 상담 슬롯 확보 helper (P1-04 Stage 2).
 * 실행: node --test src/lib/server/consultationHold.test.ts
 *
 * 저장소 대역은 app_store version CAS를 흉내 낸다. 읽을 때의 version과 저장할 때의
 * version이 다르면 충돌로 밀린다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  acquireConsultationHold,
  CONSULTATION_HOLD_MAX_ATTEMPTS,
  HOLD_RELEASE_MESSAGES,
  holdReleaseDecision,
  listHoldsForAdmin,
  releaseConsultationHold,
  runAdminHoldRelease,
} from "./consultationHold.ts";
import type { ConsultationHoldDeps } from "./consultationHold.ts";
import {
  CONSULT_TIMES,
  isSlotAvailable,
  setDayBlocked,
  setSlotBlocked,
  toggleBlockedSlot,
} from "./consultationSlots.ts";
import type { AppData, Consultation, ConsultationHold, Payment, PaymentStatus } from "@/lib/types/app";

const TEACHER = "유비 선생";
const DATE = "10월 20일(화)";
const TIME = CONSULT_TIMES[0];
const INPUT = {
  teacher: TEACHER,
  date: DATE,
  time: TIME,
  merchantOrderId: "is-a",
  checkoutId: "3f2b8c1e-9d4a-4e7b-8c2d-1a2b3c4d5e6f",
  createdAt: "2026-10-01T00:00:00.000Z",
};

class Conflict extends Error {}

function baseData(): AppData {
  return {
    users: [],
    orders: [],
    consultations: [],
    inquiries: [],
    reviews: [],
    wishlists: {},
    coupons: {},
    couponCodes: {},
    notifications: {},
    notificationSettings: {},
    codes: {},
    blockedSlots: [],
    consultationHolds: [],
    adminPromo: null,
  };
}

/** 메모리 app_store. writes 배열로 회차별 결과를 정한다("ok" | "conflict" | Error). */
function store(initial: AppData = baseData(), writes: ("ok" | "conflict" | Error)[] = []) {
  let saved = structuredClone(initial);
  let reads = 0;
  let writeCalls = 0;
  const deps: ConsultationHoldDeps = {
    readData: async () => {
      reads += 1;
      return structuredClone(saved);
    },
    writeData: async (data) => {
      const outcome = writes[writeCalls] ?? "ok";
      writeCalls += 1;
      if (outcome === "conflict") throw new Conflict();
      if (outcome instanceof Error) throw outcome;
      saved = structuredClone(data);
    },
    isConflict: (error) => error instanceof Conflict,
  };
  return { deps, saved: () => saved, reads: () => reads, writes: () => writeCalls };
}

function hold(overrides: Partial<ConsultationHold> = {}): ConsultationHold {
  return { teacher: TEACHER, date: DATE, time: TIME, merchantOrderId: "is-a", createdAt: INPUT.createdAt, ...overrides };
}

test("빈 슬롯이면 hold 1개를 저장하고 held", async () => {
  const s = store();
  assert.deepEqual(await acquireConsultationHold(INPUT, s.deps), { kind: "held" });
  assert.equal(s.writes(), 1);
  assert.deepEqual(s.saved().consultationHolds, [
    { teacher: TEACHER, date: DATE, time: TIME, merchantOrderId: "is-a", checkoutId: INPUT.checkoutId, createdAt: INPUT.createdAt },
  ]);
});

test("checkoutId가 없으면 키 없이 저장", async () => {
  const s = store();
  await acquireConsultationHold({ ...INPUT, checkoutId: null }, s.deps);
  assert.equal("checkoutId" in (s.saved().consultationHolds ?? [])[0], false);
});

test("같은 merchantOrderId가 같은 슬롯을 이미 확보했으면 다시 쓰지 않고 held", async () => {
  const s = store({ ...baseData(), consultationHolds: [hold()] });
  assert.deepEqual(await acquireConsultationHold(INPUT, s.deps), { kind: "held" });
  assert.equal(s.writes(), 0);
  assert.equal(s.saved().consultationHolds?.length, 1);
});

test("다른 결제의 hold·실제 상담·차단 슬롯이면 slot-unavailable, 저장 없음", async () => {
  const consultation = {
    id: "c-1",
    userId: "u-2",
    teacher: TEACHER,
    datetime: `${DATE} ${TIME}`,
    status: "상담 신청",
  } as unknown as Consultation;
  for (const initial of [
    { ...baseData(), consultationHolds: [hold({ merchantOrderId: "is-other" })] },
    { ...baseData(), consultations: [consultation] },
    { ...baseData(), blockedSlots: [{ teacher: TEACHER, date: DATE, time: TIME }] },
  ]) {
    const s = store(initial);
    assert.deepEqual(await acquireConsultationHold(INPUT, s.deps), { kind: "slot-unavailable" });
    assert.equal(s.writes(), 0);
  }
});

test("키가 없는 예전 저장소도 확보할 수 있다", async () => {
  const legacy = baseData();
  delete legacy.consultationHolds;
  const s = store(legacy);
  assert.deepEqual(await acquireConsultationHold(INPUT, s.deps), { kind: "held" });
  assert.equal(s.saved().consultationHolds?.length, 1);
});

test("CAS 충돌이면 새로 읽어 다시 시도해 성공", async () => {
  const s = store(baseData(), ["conflict", "ok"]);
  assert.deepEqual(await acquireConsultationHold(INPUT, s.deps), { kind: "held" });
  assert.equal(s.reads(), 2);
  assert.equal(s.writes(), 2);
  assert.equal(s.saved().consultationHolds?.length, 1);
});

test("재시도 중 다른 결제가 먼저 확보하면 slot-unavailable", async () => {
  const s = store(baseData(), ["conflict"]);
  const originalRead = s.deps.readData;
  let reads = 0;
  s.deps.readData = async () => {
    reads += 1;
    const data = await originalRead();
    // 두 번째 읽기 전에 경쟁 결제가 저장한 상황
    if (reads === 2) data.consultationHolds = [hold({ merchantOrderId: "is-other" })];
    return data;
  };
  assert.deepEqual(await acquireConsultationHold(INPUT, s.deps), { kind: "slot-unavailable" });
});

test("CAS 충돌이 정해진 횟수를 넘으면 retry-later, 아무것도 저장되지 않음", async () => {
  assert.equal(CONSULTATION_HOLD_MAX_ATTEMPTS, 3);
  const s = store(baseData(), ["conflict", "conflict", "conflict", "ok"]);
  assert.deepEqual(await acquireConsultationHold(INPUT, s.deps), { kind: "retry-later", attempts: 3 });
  assert.equal(s.reads(), 3);
  assert.equal(s.writes(), 3);
  assert.deepEqual(s.saved().consultationHolds, []);
});

test("충돌이 아닌 저장 오류는 다시 시도하지 않고 그대로 던진다", async () => {
  const boom = new Error("connection reset");
  const s = store(baseData(), [boom]);
  await assert.rejects(acquireConsultationHold(INPUT, s.deps), (error) => error === boom);
  assert.equal(s.reads(), 1);
  assert.equal(s.writes(), 1);
});

/* ── 해제 ──────────────────────────────────────────── */

test("해제: 자기 hold만 지우고 다른 결제 hold는 남긴다", async () => {
  const other = hold({ merchantOrderId: "is-other", time: CONSULT_TIMES[1] });
  const s = store({ ...baseData(), consultationHolds: [hold(), other] });
  assert.deepEqual(await releaseConsultationHold("is-a", s.deps), { kind: "released" });
  assert.deepEqual(s.saved().consultationHolds, [other]);
  assert.equal(s.writes(), 1);
});

test("해제: 자기 hold가 없으면 쓰지 않고 released(idempotent)", async () => {
  const other = hold({ merchantOrderId: "is-other" });
  const s = store({ ...baseData(), consultationHolds: [other] });
  assert.deepEqual(await releaseConsultationHold("is-a", s.deps), { kind: "released" });
  assert.equal(s.writes(), 0);
  assert.deepEqual(s.saved().consultationHolds, [other]);
});

test("해제: CAS 충돌 후 재시도 성공, 소진이면 retry-later이고 hold는 남는다", async () => {
  const ok = store({ ...baseData(), consultationHolds: [hold()] }, ["conflict", "ok"]);
  assert.deepEqual(await releaseConsultationHold("is-a", ok.deps), { kind: "released" });
  assert.deepEqual(ok.saved().consultationHolds, []);
  const exhausted = store({ ...baseData(), consultationHolds: [hold()] }, ["conflict", "conflict", "conflict"]);
  assert.deepEqual(await releaseConsultationHold("is-a", exhausted.deps), { kind: "retry-later", attempts: 3 });
  assert.equal(exhausted.saved().consultationHolds?.length, 1);
});

test("해제: 충돌이 아닌 오류는 그대로 던진다", async () => {
  const boom = new Error("down");
  const s = store({ ...baseData(), consultationHolds: [hold()] }, [boom]);
  await assert.rejects(releaseConsultationHold("is-a", s.deps), (error) => error === boom);
});

/* ── 관리자 해제 판정 (Stage 4) ─────────────────────── */

test("해제 판정: ready·failed·cancelled만 허용, 나머지와 기록 없음은 거부", () => {
  const cases: [PaymentStatus | null, string][] = [
    ["ready", "ok"],
    ["failed", "ok"],
    ["cancelled", "ok"],
    ["processing", "processing"],
    ["paid", "paid"],
    ["partialCancelled", "partial-cancelled"],
    [null, "payment-missing"],
  ];
  for (const [status, expected] of cases) {
    const decision = holdReleaseDecision(status ? { status } : null);
    assert.equal(decision.ok ? "ok" : decision.reason, expected, String(status));
  }
});

function withPayment(status: PaymentStatus | null, initial: AppData) {
  const s = store(initial);
  const lookups: string[] = [];
  const deps = {
    ...s.deps,
    getPayment: async (merchantOrderId: string) => {
      lookups.push(merchantOrderId);
      return status ? ({ merchantOrderId, status } as Payment) : null;
    },
  };
  return { s, deps, lookups };
}

const OTHER = { teacher: TEACHER, date: DATE, time: CONSULT_TIMES[1], merchantOrderId: "is-other", createdAt: INPUT.createdAt };

for (const status of ["failed", "ready", "cancelled"] as const) {
  test(`관리자 해제: ${status} + hold → 해제, 다른 결제 hold 보존, 슬롯 다시 가능`, async () => {
    const { s, deps, lookups } = withPayment(status, { ...baseData(), consultationHolds: [hold(), OTHER] });
    const result = await runAdminHoldRelease("is-a", deps);
    assert.deepEqual(result, { ok: true, status: "released", message: "상담 시간 확보를 해제했습니다." });
    assert.deepEqual(lookups, ["is-a"]);
    assert.deepEqual(s.saved().consultationHolds, [OTHER]);
    assert.equal(isSlotAvailable(s.saved(), TEACHER, DATE, TIME), true);
  });
}

for (const [status, reason] of [
  ["processing", "processing"],
  ["paid", "paid"],
  ["partialCancelled", "partial-cancelled"],
  [null, "payment-missing"],
] as const) {
  test(`관리자 해제: ${status ?? "결제 없음"} + hold → 거부, hold 유지, 쓰기 없음`, async () => {
    const { s, deps } = withPayment(status, { ...baseData(), consultationHolds: [hold()] });
    const result = await runAdminHoldRelease("is-a", deps);
    assert.equal(result.ok, false);
    assert.equal(result.status, reason);
    assert.equal(result.message, HOLD_RELEASE_MESSAGES[reason]);
    assert.equal(s.writes(), 0);
    assert.equal(s.saved().consultationHolds?.length, 1);
    assert.equal(isSlotAvailable(s.saved(), TEACHER, DATE, TIME), false);
  });
}

test("관리자 해제: processing 거부 문구는 결제 조회가 먼저라고 알린다", () => {
  assert.match(HOLD_RELEASE_MESSAGES.processing, /결제 조회/);
});

test("관리자 해제: hold가 이미 없으면 쓰기 없이 released", async () => {
  const { s, deps } = withPayment("failed", { ...baseData(), consultationHolds: [OTHER] });
  const result = await runAdminHoldRelease("is-a", deps);
  assert.equal(result.ok, true);
  assert.equal(s.writes(), 0);
  assert.deepEqual(s.saved().consultationHolds, [OTHER]);
});

test("관리자 해제: CAS 충돌 소진이면 retry, hold 유지", async () => {
  const s = store({ ...baseData(), consultationHolds: [hold()] }, ["conflict", "conflict", "conflict"]);
  const result = await runAdminHoldRelease("is-a", {
    ...s.deps,
    getPayment: async () => ({ status: "failed" }) as Payment,
  });
  assert.deepEqual(result.ok ? "" : result.status, "retry");
  assert.equal(s.saved().consultationHolds?.length, 1);
});

/* ── 관리자 목록 ──────────────────────────────────────── */

test("관리자 목록: hold마다 결제 상태와 해제 가능 여부를 서버가 붙인다", async () => {
  const data = {
    ...baseData(),
    consultationHolds: [
      hold({ merchantOrderId: "is-failed", checkoutId: "secret-checkout" }),
      hold({ merchantOrderId: "is-processing", time: CONSULT_TIMES[1] }),
      hold({ merchantOrderId: "is-missing", time: CONSULT_TIMES[2] }),
      hold({ merchantOrderId: "is-error", time: CONSULT_TIMES[3] }),
    ],
  };
  const items = await listHoldsForAdmin(data, async (id) => {
    if (id === "is-error") throw new Error("db down");
    if (id === "is-missing") return null;
    return { status: id === "is-failed" ? "failed" : "processing" } as Payment;
  });
  assert.deepEqual(
    items.map((item) => [item.merchantOrderId, item.paymentStatus, item.releasable]),
    [
      ["is-failed", "failed", true],
      ["is-processing", "processing", false],
      ["is-missing", "missing", false],
      ["is-error", "unavailable", false],
    ],
  );
  // checkoutId와 개인정보는 담지 않는다.
  assert.equal("checkoutId" in items[0], false);
  assert.deepEqual(Object.keys(items[0]).sort(), [
    "createdAt",
    "date",
    "merchantOrderId",
    "paymentStatus",
    "releasable",
    "teacher",
    "time",
  ]);
});

/* ── 관리자 차단과 hold ───────────────────────────────── */

test("hold된 시간은 관리자 차단(토글·지정·하루 휴무)으로 새로 막히지 않는다", () => {
  const data = { ...baseData(), consultationHolds: [hold()] };
  assert.deepEqual(toggleBlockedSlot(data, TEACHER, DATE, TIME), []);
  assert.deepEqual(setSlotBlocked(data, TEACHER, DATE, TIME, true), []);
  const day = setDayBlocked(data, TEACHER, DATE, true);
  assert.equal(day.blockedSlots.some((slot) => slot.time === TIME), false);
  assert.equal(day.blockedSlots.length, CONSULT_TIMES.length - 1);
  // hold가 없는 다른 시간은 기존처럼 막을 수 있다.
  assert.deepEqual(toggleBlockedSlot(data, TEACHER, DATE, CONSULT_TIMES[1]), [
    { teacher: TEACHER, date: DATE, time: CONSULT_TIMES[1] },
  ]);
});

test("실제 상담 시간 차단 보호는 기존 그대로", () => {
  const data = {
    ...baseData(),
    consultations: [{ id: "c-1", teacher: TEACHER, datetime: `${DATE} ${TIME}`, status: "상담 신청" } as unknown as Consultation],
  };
  assert.deepEqual(toggleBlockedSlot(data, TEACHER, DATE, TIME), []);
  assert.deepEqual(setSlotBlocked(data, TEACHER, DATE, TIME, true), []);
  assert.equal(setDayBlocked(data, TEACHER, DATE, true).bookedCount, 1);
});
