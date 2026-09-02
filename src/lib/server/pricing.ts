/**
 * 주문·상담 금액의 단일 계산 지점. 클라이언트가 보낸 amount는 신뢰하지 않고
 * 여기서 상품 기본가와 옵션가를 다시 더해 결제 금액을 만든다.
 * 화면에 표시되는 한글 옵션 문자열은 안내용이며 금액 계산에 쓰지 않는다.
 */
import { CONSULTATION, LIFE_SONG_PRODUCTS } from "@/lib/constants/products";
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

export function isOrderOptionId(value: unknown): value is OrderOptionId {
  return typeof value === "string" && value in ORDER_OPTION_PRICES;
}

export interface PriceResult {
  amount: number;
  /** 금액에 실제로 반영된 옵션 id. 중복은 제거된다. */
  optionIds: string[];
}

/**
 * 인생곡 주문 금액. 알 수 없는 상품이나 옵션 id가 오면 null을 돌려주고,
 * 호출부에서 주문을 만들지 않는다.
 */
export function calcOrderAmount(product: unknown, options: unknown): PriceResult | null {
  if (!isProductId(product)) return null;
  if (options !== undefined && !Array.isArray(options)) return null;

  const optionIds: OrderOptionId[] = [];
  for (const item of (options ?? []) as unknown[]) {
    if (!isOrderOptionId(item)) return null;
    if (!optionIds.includes(item)) optionIds.push(item);
  }

  const amount = optionIds.reduce(
    (sum, id) => sum + ORDER_OPTION_PRICES[id],
    ORDER_BASE_PRICES[product],
  );
  return { amount, optionIds };
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
