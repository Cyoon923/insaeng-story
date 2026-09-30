/**
 * 오픈 이벤트 1:1 사주상담 옵션 테스트 (OPEN EVENT consultation option).
 *
 * 실행: node --test src/lib/server/eventConsultationOptionSource.test.ts
 *
 * pricing.ts는 "@/..." 별칭을 쓰기 때문에 이 러너에서 import할 수 없다. 그래서 가격표와
 * 제한 규칙은 원문을 글자로 읽고, 금액 합산은 같은 식으로 직접 확인한다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { PROMOTION_PRICES } from "../constants/promotions.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const PRICING = read("./pricing.ts");
const APPLY_STEP3 = read("../../app/apply/saju-song/2/page.tsx");
const ADMIN = read("../../app/admin/page.tsx");
const MY_ORDER = read("../../app/my/orders/[id]/page.tsx");

function optionPrice(id: string): number {
  const match = PRICING.match(new RegExp(`"${id}":\\s*(\\d+)`));
  assert.ok(match, `${id} 가격이 pricing.ts에 없다`);
  return Number(match[1]);
}

const EVENT = "saju-song-open-2026";
const BASE = PROMOTION_PRICES[EVENT].basePrice;

test("옵션 id와 가격이 가격표에 있다", () => {
  assert.equal(optionPrice("saju-consultation"), 100000);
  assert.match(PRICING, /export const SAJU_CONSULTATION_OPTION_ID = "saju-consultation"/);
});

test("이벤트 금액 네 가지", () => {
  const report = optionPrice("saju-report-2026-2027");
  const consult = optionPrice("saju-consultation");
  assert.equal(BASE, 19000, "이벤트 기본");
  assert.equal(BASE + report, 29000, "이벤트 + 리포트");
  assert.equal(BASE + consult, 119000, "이벤트 + 상담");
  assert.equal(BASE + report + consult, 129000, "이벤트 + 리포트 + 상담");
});

test("기존 제작 옵션은 그대로 가산된다", () => {
  assert.equal(optionPrice("ai-mv"), 100000);
  assert.equal(optionPrice("photo-mv"), 50000);
  assert.equal(optionPrice("lyric-edit"), 10000);
  // 이벤트 + 상담 + 뮤직비디오
  assert.equal(BASE + optionPrice("saju-consultation") + optionPrice("ai-mv"), 219000);
});

test("이벤트 전용 제한이 상품 제한과 함께 걸린다", () => {
  assert.match(PRICING, /const OPTION_ONLY_FOR_PROMOTION[\s\S]*?"saju-consultation": "saju-song-open-2026"/);
  assert.match(PRICING, /"saju-consultation": "saju-song"/);
});

test("제한 판정은 가격표를 통과한 프로모션으로 한다", () => {
  /*
   * 인자로 받은 문자열이 아니라 appliedPromotion과 비교해야 한다. 그러지 않으면
   * 기간이 지났거나 상품이 다른 값을 실어 보내는 것만으로 옵션이 열린다.
   * 그래서 프로모션 확정이 옵션 검사보다 앞에 있어야 한다.
   */
  const promotionAt = PRICING.indexOf("appliedPromotion = promotion;");
  const optionAt = PRICING.indexOf("OPTION_ONLY_FOR_PROMOTION[item]");
  assert.ok(promotionAt > 0 && optionAt > promotionAt, "옵션 검사가 프로모션 확정보다 앞에 있다");
  assert.match(PRICING, /onlyForPromotion !== appliedPromotion\) return null;/);
});

/** calcOrderAmount의 옵션 검사와 같은 판정. 통과하지 못하면 주문 자체가 만들어지지 않는다. */
function sellable(optionId: string, product: string, promotion?: string): boolean {
  const onlyForProduct: Record<string, string> = {
    "saju-report-2026-2027": "saju-song",
    "saju-consultation": "saju-song",
  };
  const onlyForPromotion: Record<string, string> = { "saju-consultation": EVENT };
  if (onlyForProduct[optionId] && onlyForProduct[optionId] !== product) return false;
  if (onlyForPromotion[optionId] && onlyForPromotion[optionId] !== promotion) return false;
  return true;
}

test("상담 옵션은 이벤트 주문에서만 팔린다", () => {
  assert.equal(sellable("saju-consultation", "saju-song", EVENT), true);
  // 정가 사주 인생곡에 직접 주입 → 주문이 만들어지지 않는다
  assert.equal(sellable("saju-consultation", "saju-song", undefined), false);
  // 다른 상품에 주입 → 상품 제한에서 먼저 걸린다
  assert.equal(sellable("saju-consultation", "story", EVENT), false);
  assert.equal(sellable("saju-consultation", "premium", undefined), false);
  // 기존 옵션 동작은 그대로
  assert.equal(sellable("ai-mv", "story", undefined), true);
  assert.equal(sellable("saju-report-2026-2027", "saju-song", undefined), true);
});

test("신청 화면은 이벤트일 때만 상담 옵션을 낸다", () => {
  assert.match(APPLY_STEP3, /eventOnly: true/);
  assert.match(APPLY_STEP3, /OPTIONS\.filter\(\(opt\) => eventApply \|\| !opt\.eventOnly\)/);
  // 상담 일정 사전선택은 이벤트 신청에서 상담 옵션을 고른 경우에만 펼친다.
  assert.match(APPLY_STEP3, /opt\.id === SAJU_CONSULTATION_OPTION_ID && active && eventApply \?/);
  assert.match(APPLY_STEP3, /const wantsConsult = eventApply && selected\.includes\(SAJU_CONSULTATION_OPTION_ID\)/);
  // 선택값은 기존 이벤트 상담 draft에만 담는다. 사주 인생곡 draft·주문 details에 섞지 않는다.
  assert.match(APPLY_STEP3, /saveDraft\(EVENT_CONSULTATION_DRAFT_FLOW, \{/);
  // 상담 목적·내용은 신청 중에 받지 않는다.
  assert.equal(/purpose|content:/.test(APPLY_STEP3), false);
  // 네 값이 모두 있어야 다음 단계로 간다.
  for (const message of ["상담 선생님을", "상담 날짜를", "상담 시간을", "상담 방법을"]) {
    assert.ok(APPLY_STEP3.includes(message), message);
  }
});

test("확인 및 결제: 상담 일정 요약과 결제 직전 슬롯 재확인", () => {
  const CONFIRM = read("../../app/apply/saju-song/3/page.tsx");
  assert.match(CONFIRM, /label: "1:1 사주상담 일정"/);
  assert.match(CONFIRM, /beforeSubmit=\{checkConsultSlot\}/);
  assert.match(CONFIRM, /선택하신 상담 시간이 마감되었습니다/);
  // 결제 금액 계산은 그대로다(상담 일정은 금액에 들어가지 않는다).
  assert.match(CONFIRM, /const finalPrice = basePrice \+ optionsTotal;/);
});

test("결제 직전 확인 중 이중 제출 차단: ref로 즉시 막고, 확인 전에 잠그고, 막히면 푼다", () => {
  const PAY = read("../../components/apply/PaySubmit.tsx");
  const start = PAY.indexOf("const submit = async () => {");
  const guard = PAY.slice(start, PAY.indexOf("setError(DEV_PREVIEW_MESSAGE);", start));
  // 두 번째 누름은 await 전에 ref로 돌려보낸다.
  assert.match(guard, /if \(beforeSubmitRunning\.current\) return;\s*beforeSubmitRunning\.current = true;/);
  // loading은 beforeSubmit을 기다리기 전에 켠다.
  assert.ok(guard.indexOf("setLoading(true)") < guard.indexOf("await beforeSubmit()"));
  // 막히면 에러를 보이고 버튼을 다시 푼다.
  assert.match(guard, /if \(blocked\) \{\s*setError\(blocked\);\s*setLoading\(false\);\s*return;/);
  // 확인이 끝나면 ref를 푼다(성공·실패 공통).
  assert.ok(guard.indexOf("beforeSubmitRunning.current = false;") > guard.indexOf("await beforeSubmit()"));
  // beforeSubmit이 없는 일반 상품은 이 블록을 지나지 않는다.
  assert.match(guard, /if \(beforeSubmit\) \{/);
});

test("완료 화면 자동 예약: 기존 예약 API만 부르고, 이미 예약이 있으면 부르지 않는다", () => {
  const AUTO = read("../../components/apply/EventConsultationAutoBook.tsx");
  const COMPLETE = read("../../app/apply/complete/page.tsx");
  assert.match(AUTO, /postApp\(eventConsultationAutoBookBody\(orderId, preselect\)\)/);
  assert.equal(/preparePayment|nicepay|amount/i.test(AUTO), false);
  assert.match(AUTO, /if \(bookedId \|\| started\.current\) return;/);
  // 실패해도 기존 예약 버튼(fallback)을 보여 준다.
  assert.match(AUTO, /href=\{bookHref\}/);
  assert.match(AUTO, /선택하신 상담 시간이 마감되었습니다\. 다른 시간을 선택해 주세요\./);
  // 이벤트 상담 주문일 때만 쓰고, 이미 만든 상담은 서버가 찾아 넘긴다.
  assert.match(COMPLETE, /isEventConsultationOrder\(order\)/);
  assert.match(COMPLETE, /findEventConsultation\(data\.consultations, order\.id, userId\)/);
});

test("관리자 카드: 이벤트 주문은 예약 대기, 그 밖의 상담 옵션 주문은 일정 조율을 알린다", () => {
  assert.match(ADMIN, /상담 예약 대기/);
  assert.match(ADMIN, /function needsConsultationSchedule/);
  assert.match(ADMIN, /상담 일정 조율 필요/);
  // 판정 근거는 서버가 확정한 optionIds다.
  assert.match(ADMIN, /details\?\.optionIds \?\? ""/);
});

test("MY 주문 상세: 이벤트 주문은 직접 예약 버튼을 보여 준다", () => {
  assert.match(MY_ORDER, /function hasSajuConsultation/);
  assert.match(MY_ORDER, /eventConsultationBookHref\(order\.id\)/);
  assert.match(MY_ORDER, /1:1 사주상담 예약하기/);
});

/** 주석을 뺀 코드만 본다. 설명에 이름이 나오는 것과 실제로 부르는 것은 다르다. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
}

test("신청·관리자·MY 화면은 상담을 직접 만들지 않는다", () => {
  // 예약은 bookEventConsultation 서버 관문 한 곳에서만 만든다. 이 화면들이 Consultation을 만들거나 슬롯을 잡으면 안 된다.
  for (const [name, source] of [
    ["apply step3", APPLY_STEP3],
    ["admin", ADMIN],
    ["my order", MY_ORDER],
    ["pricing", PRICING],
  ] as const) {
    const code = codeOnly(source);
    assert.equal(/commitConsultation/.test(code), false, `${name}이 상담을 만든다`);
    assert.equal(/isSlotAvailable/.test(code), false, `${name}이 슬롯을 잡는다`);
  }
});
