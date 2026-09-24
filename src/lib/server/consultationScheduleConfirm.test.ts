/**
 * 결제 준비와 승인 사이에 자정이 지나도 상담이 확정된다 (Consult-Schedule-Confirm-1).
 *
 * 실행: node --test src/lib/server/consultationScheduleConfirm.test.ts
 *
 * ── 무엇을 고쳤나 ──
 *
 * 판매 가능 날짜 목록(upcomingConsultDateOptions)은 부르는 순간의 한국 날짜를 기준으로
 * "내일부터 14일"이다. 매일 자정에 앞으로 한 칸 밀린다.
 * 그래서 23:59에 준비한 "내일" 예약이 00:01에는 "오늘"이 되어 목록에서 빠진다.
 * 승인이 끝난 뒤에 그 목록으로 다시 보면, 돈은 빠져나갔는데 상담은 만들어지지 않는다.
 *
 * 그래서 두 경로를 나눴다.
 *   · 새 예약    resolveScheduledAt          — 지금 판매 중인 날짜여야 한다(그대로)
 *   · 승인 후 확정 resolveConfirmedScheduledAt — 판매 목록만 보지 않는다
 *
 * 검증을 없앤 것이 아니다. 형식·실재 여부·표시 문구 짝·시각 문구는 그대로 보고,
 * 슬롯 충돌은 호출부(commitConsultation의 isSlotAvailable)가 본다.
 *
 * ── 왜 commitConsultation을 직접 부르지 않는가 ──
 *
 * applyOrder.ts는 "@/..." 경로로 저장소를 부른다. Node 내장 러너는 그 별칭을 풀지
 * 못한다. 그래서 기존 orderConsentTimestamp.test.ts / orderConsentVersionGate.test.ts와
 * 같이, 순수 함수는 직접 부르고 배선은 소스로 고정한다.
 *
 * 시각에 따라 답이 달라지는 함수(resolveScheduledAt)는 now를 인자로 받지 않으므로
 * node:test의 Date mock으로 벽시계를 고정한다.
 */
import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { readFileSync } from "node:fs";
import {
  formatConsultDate,
  parseIsoDate,
  resolveConfirmedScheduledAt,
  resolveScheduledAt,
  toScheduledAt,
  upcomingConsultDateOptions,
} from "./consultationSlots.ts";

function read(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

const APPLY_ORDER = read("./applyOrder.ts");
const SLOTS = read("./consultationSlots.ts");
const RETURN_ROUTE = read("../../app/api/payments/nicepay/return/route.ts");
const RECOMMIT_ROUTE = read("../../app/api/admin/payments/recommit/route.ts");
const APP_ROUTE = read("../../app/api/app/route.ts");

/** 예약 대상. 2026-09-26(토) 오전 10:00 = 2026-09-26T01:00:00.000Z */
const DATE = "2026-09-26";
const DATE_LABEL = "9월 26일(토)";
const TIME_LABEL = "오전 10:00";
const SCHEDULED_AT = "2026-09-26T01:00:00.000Z";

/** 한국 2026-09-25 23:59 (= UTC 14:59). 결제를 준비하는 시각. */
const BEFORE_MIDNIGHT = new Date("2026-09-25T14:59:00.000Z");
/** 한국 2026-09-26 00:01 (= UTC 전날 15:01). 승인이 돌아오는 시각. */
const AFTER_MIDNIGHT = new Date("2026-09-25T15:01:00.000Z");

/** 벽시계를 고정한 채 한 번 실행한다. 끝나면 반드시 되돌린다. */
function at<T>(now: Date, run: () => T): T {
  mock.timers.enable({ apis: ["Date"], now });
  try {
    return run();
  } finally {
    mock.timers.reset();
  }
}

/* ── A. 자정 경계 ───────────────────────────────────── */

test("자정 직전에는 다음 날 예약이 정상 준비된다", () => {
  at(BEFORE_MIDNIGHT, () => {
    // 그 시각에 서버가 내주는 목록에 실제로 들어 있다.
    const offered = upcomingConsultDateOptions();
    assert.ok(
      offered.some((option) => option.date === DATE && option.label === DATE_LABEL),
      "자정 직전 목록에 다음 날이 없다",
    );
    // preparePayment / createConsultation이 쓰는 경로 그대로.
    assert.equal(resolveScheduledAt(DATE, DATE_LABEL, TIME_LABEL), SCHEDULED_AT);
  });
});

test("자정이 지나면 같은 예약이 판매 목록에서 빠진다(이번 문제의 원인)", () => {
  at(AFTER_MIDNIGHT, () => {
    const offered = upcomingConsultDateOptions();
    assert.equal(
      offered.some((option) => option.date === DATE),
      false,
      "자정이 지났는데도 오늘이 목록에 남아 있다",
    );
    // 새 예약 규칙은 그대로다. 이 값이 null이라는 사실이 아래 확정 경로의 전제다.
    assert.equal(resolveScheduledAt(DATE, DATE_LABEL, TIME_LABEL), null);
  });
});

test("자정이 지난 뒤 승인되어도 확정 경로는 같은 절대시각을 만든다", () => {
  at(AFTER_MIDNIGHT, () => {
    assert.equal(resolveConfirmedScheduledAt(DATE, DATE_LABEL, TIME_LABEL), SCHEDULED_AT);
  });
});

test("확정 경로의 결과는 준비 시각과 승인 시각에서 같다", () => {
  // 같은 예약이 언제 확정되든 한 값이어야 한다. 시계에 흔들리면 안 된다.
  const prepared = at(BEFORE_MIDNIGHT, () =>
    resolveScheduledAt(DATE, DATE_LABEL, TIME_LABEL),
  );
  const confirmed = at(AFTER_MIDNIGHT, () =>
    resolveConfirmedScheduledAt(DATE, DATE_LABEL, TIME_LABEL),
  );
  assert.equal(prepared, SCHEDULED_AT);
  assert.equal(confirmed, prepared);
  // 서버 타임존이 결과에 끼어들지 않는다(+09:00을 문자열에 명시하는 기존 규칙).
  assert.equal(toScheduledAt(DATE, TIME_LABEL), SCHEDULED_AT);
});

/* ── B. 승인·복구 경로 배선 ─────────────────────────── */

test("승인 callback이 판매 목록 재검증을 끄고 부른다", () => {
  assert.match(RETURN_ROUTE, /verifyOfferedDate: false,/);
  // 기존 복구 의미는 그대로다. 두 축을 한 값으로 합치지 않았다.
  assert.match(RETURN_ROUTE, /requireSchedule: false,/);
  assert.match(RETURN_ROUTE, /requireConsent: false,/);
});

test("admin recommit도 같은 배선을 쓴다", () => {
  assert.match(RECOMMIT_ROUTE, /verifyOfferedDate: false,/);
  assert.match(RECOMMIT_ROUTE, /requireSchedule: false,/);
  assert.match(RECOMMIT_ROUTE, /requireConsent: false,/);
});

/* ── C. 신규 예약 검증 유지 ─────────────────────────── */

test("새 신청 경로는 판매 목록 재검증을 끄지 않는다", () => {
  // createConsultation / preparePayment가 있는 라우트다. 여기에 값이 생기면
  // 오늘 날짜로도 새 예약이 들어오게 된다.
  assert.equal(APP_ROUTE.includes("verifyOfferedDate"), false);
});

test("기본값은 재검증을 하는 쪽이다", () => {
  // 옵션을 넘기지 않은 호출은 예전과 똑같이 동작해야 한다.
  assert.match(APPLY_ORDER, /const verifyOfferedDate = options\.verifyOfferedDate \?\? true;/);
  // 끄는 곳은 위 두 승인 경로뿐이다.
  const disabled = (APPLY_ORDER.match(/verifyOfferedDate: false/g) ?? []).length;
  assert.equal(disabled, 0, "commit 안에서 스스로 끄는 자리가 생겼다");
});

test("두 축을 분리해 쓴다", () => {
  // requireSchedule = "값이 없어도 되는가", verifyOfferedDate = "무엇으로 보는가".
  assert.match(APPLY_ORDER, /const requireSchedule = options\.requireSchedule \?\? true;/);
  assert.match(
    APPLY_ORDER,
    /verifyOfferedDate\s*\?\s*resolveScheduledAt\([\s\S]{0,120}?:\s*resolveConfirmedScheduledAt\(/,
  );
  // 값이 없거나 유효하지 않으면 막는 기존 조건은 그대로다.
  assert.match(APPLY_ORDER, /if \(!scheduledAt && \(requireSchedule \|\| scheduledDate\)\)/);
});

/* ── D. 슬롯 충돌 ───────────────────────────────────── */

test("슬롯 충돌 검사는 예약시각 판정보다 먼저 일어난다", () => {
  // 확정 경로에서도 이미 찬 슬롯은 막혀야 한다. 순서가 뒤집히면 그 보장이 사라진다.
  const at_ = APPLY_ORDER.indexOf("export async function commitConsultation");
  assert.notEqual(at_, -1);
  const body = APPLY_ORDER.slice(at_);
  const slotCheck = body.indexOf("if (!isSlotAvailable(data, teacher, parsed.date, parsed.time))");
  const resolve = body.indexOf("resolveConfirmedScheduledAt(scheduledDate");
  assert.notEqual(slotCheck, -1, "슬롯 검사가 없다");
  assert.notEqual(resolve, -1, "확정 경로 호출이 없다");
  assert.ok(slotCheck < resolve, "슬롯 검사가 예약시각 판정 뒤로 밀렸다");
  // 슬롯 검사는 옵션과 무관하다(조건문 안으로 들어가지 않았다).
  assert.equal(/verifyOfferedDate[\s\S]{0,200}?isSlotAvailable/.test(body), false);
});

/* ── E. 변조·잘못된 snapshot ────────────────────────── */

test("표시 문구와 날짜가 어긋나면 확정하지 않는다", () => {
  at(AFTER_MIDNIGHT, () => {
    // 날짜만 바꿔치기한 값. 라벨에서 만든 날짜와 맞지 않으면 통과하지 못한다.
    assert.equal(resolveConfirmedScheduledAt(DATE, "9월 27일(일)", TIME_LABEL), null);
    assert.equal(resolveConfirmedScheduledAt("2026-09-27", DATE_LABEL, TIME_LABEL), null);
    // 요일만 틀린 값도 막는다.
    assert.equal(resolveConfirmedScheduledAt(DATE, "9월 26일(금)", TIME_LABEL), null);
  });
});

test("형식이 아니거나 실재하지 않는 날짜는 확정하지 않는다", () => {
  at(AFTER_MIDNIGHT, () => {
    for (const value of ["", " ", "2026-9-26", "20260926", "내일", "2026-13-01", "2026-02-30"]) {
      assert.equal(
        resolveConfirmedScheduledAt(value, DATE_LABEL, TIME_LABEL),
        null,
        JSON.stringify(value),
      );
    }
  });
});

test("시간표에 없는 시각은 확정하지 않는다", () => {
  at(AFTER_MIDNIGHT, () => {
    for (const value of ["", "오전 3:00", "10:00", "오전 10시", "오후 11:00"]) {
      assert.equal(
        resolveConfirmedScheduledAt(DATE, DATE_LABEL, value),
        null,
        JSON.stringify(value),
      );
    }
  });
});

test("실재하지 않는 날짜를 날짜로 읽지 않는다", () => {
  // Date가 2026-02-30을 3월 2일로 조용히 넘기는 것을 막는다.
  assert.equal(parseIsoDate("2026-02-30"), null);
  assert.equal(parseIsoDate("2026-04-31"), null);
  assert.deepEqual(parseIsoDate("2026-09-26"), { year: 2026, month: 9, day: 26 });
  // 읽어 낸 날짜에서 만든 표시 문구가 곧 비교 기준이다.
  assert.equal(formatConsultDate({ year: 2026, month: 9, day: 26 }), DATE_LABEL);
});

/* ── 회귀: 새 예약 규칙 자체는 바뀌지 않았다 ────────── */

test("새 예약 경로는 여전히 판매 목록을 본다", () => {
  assert.match(SLOTS, /export function resolveScheduledAt\(/);
  const at_ = SLOTS.indexOf("export function resolveScheduledAt(");
  const body = SLOTS.slice(at_, SLOTS.indexOf("\n}", at_));
  assert.match(body, /isOfferedDate\(isoDate, dateLabel\)/);
  // 확정 경로는 그 목록을 보지 않는다.
  const at2 = SLOTS.indexOf("export function resolveConfirmedScheduledAt(");
  const body2 = SLOTS.slice(at2, SLOTS.indexOf("\n}", at2));
  assert.equal(body2.includes("isOfferedDate"), false);
  assert.equal(body2.includes("upcomingConsultDateOptions"), false);
});
