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
} as const;

export type OrderOptionId = keyof typeof ORDER_OPTION_PRICES;

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
    return { ok: false, error: "아직 시작되지 않은 이벤트입니다." };
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

  const optionIds: OrderOptionId[] = [];
  for (const item of (options ?? []) as unknown[]) {
    if (!isOrderOptionId(item)) return null;
    if (!optionIds.includes(item)) optionIds.push(item);
  }

  let basePrice = ORDER_BASE_PRICES[product];
  let appliedPromotion: PromotionId | undefined;
  if (promotion !== undefined && promotion !== null && promotion !== "") {
    if (!isPromotionId(promotion)) return null;
    if (PROMOTION_PRICES[promotion].product !== product) return null;
    basePrice = PROMOTION_PRICES[promotion].basePrice;
    appliedPromotion = promotion;
  }

  const amount = optionIds.reduce((sum, id) => sum + ORDER_OPTION_PRICES[id], basePrice);
  return { amount, optionIds, ...(appliedPromotion ? { promotion: appliedPromotion } : {}) };
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
