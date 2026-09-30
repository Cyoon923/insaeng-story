/**
 * 프로모션 공개 정보. 서버와 화면이 함께 쓰는 순수 상수·순수 함수만 둔다.
 *
 * 왜 constants에 있나: 신청 화면이 이벤트가를 보여 주려면 같은 값을 알아야 하는데,
 * 화면이 숫자를 따로 적으면 표시가와 결제가가 갈라진다. 그래서 값은 한 곳에 두고
 * 양쪽이 같은 것을 읽는다.
 *
 * ★ 여기에 두지 않는 것: 결제 검증이다. 클라이언트가 보낸 값을 받아들일지 정하는
 * checkPromotionEntry와 실제 금액을 만드는 calcOrderAmount는 lib/server/pricing.ts에
 * 남아 있고, 화면은 그 함수를 부르지 않는다. 화면이 하는 일은 표시뿐이다.
 */

/**
 * 진행 중인 프로모션의 기본가.
 *
 * 실제 상품 옵션(ORDER_OPTION_PRICES)과 완전히 다른 축이다. 옵션은 기본가에 "더하는"
 * 값이고, 프로모션은 그 상품의 "기본가 자체를 바꾸는" 값이다. 한 목록에 섞으면
 * 옵션을 더하듯 할인이 더해져 금액이 어긋난다.
 *
 * 금액 숫자는 여기에만 있다. 클라이언트는 식별자 문자열만 보내고, 그 식별자가 이
 * 목록에 있을 때만 가격이 정해진다. 목록에 없는 값은 주문 자체가 만들어지지 않는다.
 */
export const PROMOTION_PRICES = {
  "saju-song-open-2026": {
    /** 이 프로모션이 적용되는 상품. 다른 상품에 쓰면 주문을 만들지 않는다. */
    product: "saju-song",
    /** 프로모션 기본가. 옵션가는 여기에 그대로 더해진다. */
    basePrice: 19000,
    /** 시작일(한국 날짜). 이 날짜 00:00부터 쓸 수 있다. */
    startsOn: "2026-10-04",
    /** 종료일(한국 날짜). 이 날짜 23:59:59까지 쓸 수 있고, 다음 날 00:00부터는 쓸 수 없다. */
    endsOn: "2026-10-31",
  },
} as const;

export type PromotionId = keyof typeof PROMOTION_PRICES;

export function isPromotionId(value: unknown): value is PromotionId {
  return typeof value === "string" && value in PROMOTION_PRICES;
}

/** 한국 표준시 고정 오프셋. 한국은 현재 서머타임이 없어 상수로 둘 수 있다. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 지금 이 순간의 한국 날짜("YYYY-MM-DD").
 *
 * 서버 타임존(Vercel은 UTC)과 무관하게 같은 값을 준다. UTC 시각에 +9시간을 더한 뒤
 * UTC 달력으로 읽는 방식이며, consultationSlots.ts의 kstToday와 같은 계산이다.
 * new Date()의 로컬 날짜를 그대로 쓰면 한국 자정과 9시간 어긋난다.
 */
function kstDate(now: Date): string {
  const shifted = new Date(now.getTime() + KST_OFFSET_MS);
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${month}-${day}`;
}

/**
 * 지금 이 프로모션을 쓸 수 있는 기간인지. 시작일·종료일 규칙은 이 함수 하나가 정한다.
 *
 * 서버 검증(checkPromotionEntry)과 화면 표시가 같은 함수를 부른다. 두 곳에 같은
 * 날짜 규칙을 따로 적으면 한쪽만 고쳤을 때 "화면에는 이벤트가, 결제는 거절"이 된다.
 *
 * 화면에서 부를 때 기준이 되는 것은 보는 사람의 기기 시계다. 시계를 바꿔 이벤트가를
 * 미리 보더라도 결제는 서버 시각으로 다시 판정되어 거절된다(표시는 표시일 뿐이다).
 */
export function isPromotionOpen(promotion: PromotionId, now: Date = new Date()): boolean {
  const today = kstDate(now);
  return today >= PROMOTION_PRICES[promotion].startsOn && today <= PROMOTION_PRICES[promotion].endsOn;
}

/**
 * 종료일(한국 날짜)이 지났는지. 시작 전에는 false다.
 *
 * 홈 Hero처럼 "시작 전부터 알리고, 끝나면 내리는" 표시에 쓴다. 이벤트가 적용 여부는
 * 여기가 아니라 isPromotionOpen(서버 checkPromotionEntry)이 정한다.
 */
export function isPromotionEnded(promotion: PromotionId, now: Date = new Date()): boolean {
  return kstDate(now) > PROMOTION_PRICES[promotion].endsOn;
}
