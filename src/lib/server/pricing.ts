/**
 * 주문·상담 금액의 단일 계산 지점. 클라이언트가 보낸 amount는 신뢰하지 않고
 * 여기서 상품 기본가와 옵션가를 다시 더해 결제 금액을 만든다.
 * 화면에 표시되는 한글 옵션 문자열은 안내용이며 금액 계산에 쓰지 않는다.
 */
import { CONSULTATION, LIFE_SONG_PRODUCTS } from "@/lib/constants/products";
import {
  isPromotionId,
  isPromotionOpen,
  PROMOTION_PRICES,
  type PromotionId,
} from "@/lib/constants/promotions";
import type { ProductId } from "@/lib/types/app";

/** 인생곡 추가 옵션. id는 신청 화면과 API가 함께 쓰는 안정적인 키다. */
export const ORDER_OPTION_PRICES = {
  "ai-mv": 100000,
  "photo-mv": 50000,
  "lyric-edit": 10000,
  "saju-report-2026-2027": 10000,
  "saju-consultation": 100000,
} as const;

export type OrderOptionId = keyof typeof ORDER_OPTION_PRICES;

/**
 * 한 상품에만 파는 옵션. 여기 없는 옵션은 인생곡 3종 어디서나 살 수 있다.
 *
 * 기존 세 옵션(ai-mv·photo-mv·lyric-edit)은 세 상품 공통이라 이 목록에 넣지 않는다.
 * 목록을 "허용"이 아니라 "제한"으로 둔 이유가 그것이다. 전부 나열하는 방식으로
 * 바꾸면 기존 옵션의 동작까지 이 목록에 달리게 된다.
 */
const OPTION_ONLY_FOR_PRODUCT: Partial<Record<OrderOptionId, ProductId>> = {
  // 사주 정보를 받는 상품에서만 만들 수 있는 리포트다.
  "saju-report-2026-2027": "saju-song",
  "saju-consultation": "saju-song",
};

/**
 * 한 이벤트에서만 파는 옵션. 여기 있는 옵션은 그 프로모션이 적용된 주문에서만 살 수 있다.
 *
 * 상품 제한(OPTION_ONLY_FOR_PRODUCT)과 다른 축이다. 저쪽은 "어떤 상품에서 파는가"이고
 * 이쪽은 "어떤 가격으로 사는 주문에서 파는가"다. 정가 신청에 이 id를 실어 보내도
 * 아래 calcOrderAmount가 null을 돌려주어 주문 자체가 만들어지지 않는다.
 */
const OPTION_ONLY_FOR_PROMOTION: Partial<Record<OrderOptionId, PromotionId>> = {
  // 오픈 이벤트 신청에서만 함께 신청할 수 있는 1:1 사주상담이다.
  "saju-consultation": "saju-song-open-2026",
};

/** 1:1 사주상담 추가 옵션. */
export const CONSULT_OPTION_PRICES = {
  report: 20000,
  extraPerson: 50000,
} as const;

export type ConsultOptionId = keyof typeof CONSULT_OPTION_PRICES;

/** 인생곡 3종의 기본가. 상품 상수를 단일 출처로 삼는다. */
const ORDER_BASE_PRICES: Record<ProductId, number> = {
  story: basePriceOf("story"),
  premium: basePriceOf("premium"),
  "saju-song": basePriceOf("saju-song"),
};

function basePriceOf(id: ProductId): number {
  const product = LIFE_SONG_PRODUCTS.find((item) => item.id === id);
  if (!product) throw new Error(`상품 가격을 찾을 수 없습니다: ${id}`);
  return product.priceFrom;
}

export function isProductId(value: unknown): value is ProductId {
  return typeof value === "string" && value in ORDER_BASE_PRICES;
}

/**
 * 프로모션 진입 확인 결과.
 *
 * ok이면서 promotion이 없는 것은 "프로모션 없는 일반 주문"이라는 뜻이다.
 * 잘못된 값은 정가로 돌리지 않고 거절한다. 조용히 정가로 넘기면 화면에는 이벤트가가
 * 보이는데 결제는 정가로 되는 상태가 만들어진다.
 */
export type PromotionCheck =
  | { ok: true; promotion?: PromotionId }
  | { ok: false; error: string };

/**
 * 클라이언트가 보낸 프로모션 값을 받아들일지 정한다 (최초 요청 1회용).
 *
 * ★ 날짜를 보는 유일한 서버 지점이다. 결제 준비(preparePayment)와 0원 신청(createOrder)에서만
 * 부른다. 승인(nicepay/return)과 복구(recommit)는 이 함수를 부르지 않는다. 그쪽에서
 * 날짜를 다시 보면 준비 시각과 승인·복구 시각이 기간 경계를 넘을 때 금액이 달라져
 * 결제가 깨진다. 그 두 경로는 snapshot에 고정된 식별자로 가격만 재현한다.
 *
 * 기간 규칙 자체는 isPromotionOpen 한 곳에 있고 화면도 같은 함수를 본다.
 * 다만 최종 판정은 언제나 이 함수가, 서버 시각으로 한다.
 */
export function checkPromotionEntry(
  value: unknown,
  product: unknown,
  now: Date = new Date(),
): PromotionCheck {
  // 값이 없으면 프로모션 없는 일반 주문이다. 기존 동작과 같다.
  if (value === undefined || value === null || value === "") return { ok: true };
  if (!isPromotionId(value)) {
    return { ok: false, error: "이벤트 정보를 확인하지 못했습니다." };
  }
  if (PROMOTION_PRICES[value].product !== product) {
    return { ok: false, error: "이 상품에는 적용할 수 없는 이벤트입니다." };
  }
  if (!isPromotionOpen(value, now)) {
    // 시작 전과 종료 후 모두 여기서 막는다.
    return { ok: false, error: "이벤트 신청 기간이 아닙니다." };
  }
  return { ok: true, promotion: value };
}

export function isOrderOptionId(value: unknown): value is OrderOptionId {
  return typeof value === "string" && value in ORDER_OPTION_PRICES;
}

export interface PriceResult {
  amount: number;
  /** 금액에 실제로 반영된 옵션 id. 중복은 제거된다. */
  optionIds: string[];
  /**
   * 금액에 실제로 반영된 프로모션 id. 없으면 키가 없다.
   *
   * 호출부는 이 값만 증빙으로 기록한다. 클라이언트가 보낸 문자열이 아니라
   * 가격표 조회를 통과한 값이라 위조할 수 없다.
   */
  promotion?: PromotionId;
}

/**
 * 인생곡 주문 금액. 알 수 없는 상품이나 옵션 id가 오면 null을 돌려주고,
 * 호출부에서 주문을 만들지 않는다.
 *
 * promotion을 넘기지 않으면 계산은 예전과 완전히 같다(정가). 넘긴 값이 가격표에 없거나
 * 그 상품의 프로모션이 아니면 null이다. 정가로 되돌리지 않는다.
 *
 * 바뀌는 것은 기본가 하나뿐이고 옵션 합산은 그대로다. 이벤트가에도 실제 옵션가가
 * 같은 방식으로 더해진다.
 *
 * ★ 날짜를 보지 않는다. 승인·복구도 이 함수를 부르므로, 여기서 기간을 판단하면
 * 같은 결제가 시점에 따라 다른 금액이 되어 결제가 깨진다. 기간 판정은 최초 요청에서
 * checkPromotionEntry가 한 번만 한다.
 */
export function calcOrderAmount(
  product: unknown,
  options: unknown,
  promotion?: unknown,
): PriceResult | null {
  if (!isProductId(product)) return null;
  if (options !== undefined && !Array.isArray(options)) return null;

  let basePrice = ORDER_BASE_PRICES[product];
  let appliedPromotion: PromotionId | undefined;
  if (promotion !== undefined && promotion !== null && promotion !== "") {
    if (!isPromotionId(promotion)) return null;
    if (PROMOTION_PRICES[promotion].product !== product) return null;
    basePrice = PROMOTION_PRICES[promotion].basePrice;
    appliedPromotion = promotion;
  }

  const optionIds: OrderOptionId[] = [];
  for (const item of (options ?? []) as unknown[]) {
    if (!isOrderOptionId(item)) return null;
    // 그 상품에서 팔지 않는 옵션이면 주문을 만들지 않는다. 화면이 막고 있어도
    // API를 직접 부르는 경우가 남아, 금액을 정하는 이 자리에서 함께 본다.
    const onlyFor = OPTION_ONLY_FOR_PRODUCT[item];
    if (onlyFor && onlyFor !== product) return null;
    /*
     * 이벤트 전용 옵션은 그 이벤트가 실제로 적용된 주문에서만 판다.
     * 정가 신청에 id만 실어 보내는 경우가 여기서 막힌다(금액이 아니라 주문이 만들어지지 않는다).
     * 보는 값은 위에서 가격표를 통과한 appliedPromotion이지 인자로 받은 문자열이 아니다.
     */
    const onlyForPromotion = OPTION_ONLY_FOR_PROMOTION[item];
    if (onlyForPromotion && onlyForPromotion !== appliedPromotion) return null;
    if (!optionIds.includes(item)) optionIds.push(item);
  }

  const amount = optionIds.reduce((sum, id) => sum + ORDER_OPTION_PRICES[id], basePrice);
  return { amount, optionIds, ...(appliedPromotion ? { promotion: appliedPromotion } : {}) };
}

/**
 * 오픈 이벤트 1:1 사주상담 옵션. 화면과 서버가 같은 키를 쓰도록 여기서 내보낸다.
 *
 * 이 옵션은 상담 예약(Consultation)을 만들지 않는다. 주문에 "상담을 함께 신청했다"는
 * 사실만 남고, 일정은 운영자가 주문에 적힌 연락처로 따로 잡는다. 그래서 날짜·시간·
 * 상담 방식을 여기서 받지 않는다(독립 상품 1:1 사주상담의 예약 구조는 그대로다).
 */
export const SAJU_CONSULTATION_OPTION_ID = "saju-consultation";

/** 2026·2027년 사주풀이 리포트 옵션. 화면과 서버가 같은 키를 쓰도록 여기서 내보낸다. */
export const SAJU_REPORT_OPTION_ID = "saju-report-2026-2027";

/**
 * 리포트를 보낼 이메일로 쓸 수 있는 형태인지.
 *
 * 주소가 실제로 살아 있는지는 보지 않는다(보내 봐야 알 수 있다). 오타로 아예
 * 보낼 수 없는 값만 걸러 내는 최소 검사이며, 화면과 서버가 같은 함수를 쓴다.
 */
export function isValidReportEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export type ReportDeliveryCheck = { ok: true } | { ok: false; error: string };

/**
 * 리포트 옵션을 샀다면 받을 방법이 정해져 있는지 확인한다.
 *
 * 옵션을 사지 않았으면 아무것도 보지 않는다(기존 주문의 동작이 그대로다).
 * 화면(3단계 validateNext)과 서버(최초 요청)가 같은 함수를 부른다. 문구가 한 곳에
 * 있어야 화면에서 통과한 값이 서버에서 다른 이유로 막히는 일이 없다.
 *
 * 휴대폰 번호는 보지 않는다. 카카오톡으로 받을 번호는 신청서의 연락처(details.phone)
 * 하나뿐이고, 같은 값을 여기에 한 벌 더 두지 않는다.
 */
export function checkSajuReportDelivery(
  optionIds: readonly unknown[],
  details: Record<string, string>,
): ReportDeliveryCheck {
  if (!optionIds.includes(SAJU_REPORT_OPTION_ID)) return { ok: true };
  const delivery = details.sajuReportDelivery ?? "";
  if (delivery !== "kakao" && delivery !== "email") {
    return { ok: false, error: "받으실 방법을 선택해 주세요." };
  }
  if (delivery === "email") {
    const email = (details.sajuReportEmail ?? "").trim();
    if (!email) return { ok: false, error: "이메일 주소를 입력해 주세요." };
    if (!isValidReportEmail(email)) return { ok: false, error: "이메일 주소를 확인해 주세요." };
  }
  return { ok: true };
}

/**
 * 1:1 사주상담 금액. 옵션은 report / extraPerson 두 개뿐이라
 * 신청 화면이 보내는 "1" 여부만 본다.
 */
export function calcConsultationAmount(body: Record<string, unknown>): PriceResult {
  const optionIds: ConsultOptionId[] = [];
  if (String(body.report ?? "") === "1") optionIds.push("report");
  if (String(body.extraPerson ?? "") === "1") optionIds.push("extraPerson");

  const amount = optionIds.reduce(
    (sum, id) => sum + CONSULT_OPTION_PRICES[id],
    CONSULTATION.priceFrom,
  );
  return { amount, optionIds };
}
