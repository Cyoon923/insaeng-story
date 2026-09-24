/**
 * MY 화면에서 쓰는 구매 목록.
 *
 * 사주상담을 결제하면 Consultation 1건과 product가 "consultation"인 Order 1건이
 * 함께 만들어진다(lib/server/applyOrder.ts commitConsultation).
 * 이때 둘은 **같은 id와 같은 createdAt**을 공유한다. 주석에도
 * "상담과 결제 귀속용 주문이 같은 건임을 알 수 있도록 id와 시각을 공유한다"고 적혀 있다.
 *
 * 그래서 목록은 Order를 한 줄로 삼고, 상담이면 같은 id의 Consultation에서
 * 진행 상태만 가져온다. 두 배열을 그냥 합치면 같은 구매가 두 장으로 보이는데
 * 이 방식은 구조적으로 그럴 수 없다.
 *
 * 금액은 Order.amount(할인까지 끝난 실제 결제 금액)를 쓴다. 기본가(baseAmount)가 아니다.
 */
// 상대경로에 확장자를 붙인 이유는 다른 순수 모듈들과 같다(Node 내장 테스트 러너로 직접 실행).
import { hasCompletedRefundForOrder } from "./refundRequestSection.ts";
import type { Consultation, LatestRefundRequestsView, Order, OrderProduct } from "@/lib/types/app";

/**
 * 환불이 끝난 건의 대표 배지 문구.
 * 진행 상태를 덮어쓰는 것이 아니라, 무엇을 먼저 보여 줄지 고른 값이다.
 */
export const REFUND_COMPLETED_STATUS = "환불 완료";

/** 목록에서 고르는 분류. 화면의 필터 버튼과 같은 값이다. */
export type MyOrderFilter = "all" | "song" | "consultation";

/** 목록 카드 1장. 화면은 이 값만 보고 그린다. */
export interface MyOrderItem {
  id: string;
  /** 인생곡이면 "song", 사주상담이면 "consultation". */
  kind: "song" | "consultation";
  product: OrderProduct;
  title: string;
  /**
   * 인생곡은 제작 진행 상태, 상담은 상담 진행 상태. 서로 섞지 않는다.
   * 저장된 값 그대로이며 환불 때문에 바뀌지 않는다.
   */
  status: string;
  /**
   * 환불이 끝난 건인지. 화면 표시용 파생값이며 저장되는 값이 아니다.
   * 진행 단계 문구처럼 "지금도 진행 중"으로 읽히는 표시를 감출 때 쓴다.
   */
  refundCompleted: boolean;
  /**
   * 카드 대표 배지에 쓸 값. 환불이 끝났으면 "환불 완료", 아니면 위 status 그대로다.
   * 두 상태를 같은 무게로 나란히 두지 않기 위해 대표 값을 하나로 정한다.
   */
  displayStatus: string;
  /** 실제 결제 금액. 할인이 적용됐으면 할인 뒤 금액이다. */
  amount: number;
  /** 구매·신청 시각. 정렬 기준이며 상담 예약일이 아니다. */
  createdAt: string;
  /** 상세 화면 경로. 상담은 기존 상담 상세를 그대로 쓴다. */
  href: string;
  /** 상담에만 있다. 저장된 값이 없으면 비운다. */
  teacher?: string;
  /** 상담 예약 일시. 저장된 값이 없으면 비운다. */
  datetime?: string;
}

/** 값이 있을 때만 넣는다. 없는 값을 지어내지 않기 위해서다. */
function text(value: unknown): string | undefined {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : undefined;
}

/**
 * 주문·상담을 한 목록으로 합친다.
 *
 * 같은 id를 가진 상담 주문과 상담은 한 장으로 합쳐지고,
 * 짝이 없는 상담(이 구조가 생기기 전에 만들어진 자료)도 빠지지 않게 뒤에 더한다.
 * 정렬은 구매·신청 시각의 최신순이다.
 */
export function buildMyOrderItems(
  orders: Order[],
  consultations: Consultation[],
  /**
   * 주문별 최신 환불 문의. GET /api/app이 이미 주는 값을 그대로 넘긴다.
   * 넘기지 않으면 환불을 모르는 것으로 보고 기존과 똑같이 그린다.
   * 읽지 못한 응답(loaded=false)도 환불 완료로 추정하지 않는다(helper가 막는다).
   */
  latestRefunds?: LatestRefundRequestsView | null,
): MyOrderItem[] {
  const consultById = new Map(consultations.map((item) => [item.id, item]));
  const usedConsultIds = new Set<string>();
  // 환불 여부는 주문 id로만 본다. 짝이 되는 주문이 없는 상담에는 환불 문의도 없다.
  const refunded = (orderId: string) => hasCompletedRefundForOrder(latestRefunds, orderId);

  const items: MyOrderItem[] = orders.map((order) => {
    if (order.product !== "consultation") {
      const refundCompleted = refunded(order.id);
      return {
        id: order.id,
        kind: "song",
        product: order.product,
        title: order.title,
        status: order.status,
        refundCompleted,
        displayStatus: refundCompleted ? REFUND_COMPLETED_STATUS : order.status,
        amount: order.amount,
        createdAt: order.createdAt,
        href: `/my/orders/${order.id}`,
      };
    }

    // 상담 주문은 결제 귀속용이라 status가 "신청접수"로 고정돼 있다.
    // 실제 진행 상태는 같은 id의 Consultation이 관리하므로 그쪽을 쓴다.
    const consult = consultById.get(order.id);
    if (consult) usedConsultIds.add(order.id);
    const status = consult?.status ?? order.status;
    const refundCompleted = refunded(order.id);
    return {
      id: order.id,
      kind: "consultation",
      product: order.product,
      title: order.title,
      status,
      refundCompleted,
      displayStatus: refundCompleted ? REFUND_COMPLETED_STATUS : status,
      amount: order.amount,
      createdAt: order.createdAt,
      href: `/my/consultations/${order.id}`,
      teacher: text(consult?.teacher ?? order.details?.teacher),
      datetime: text(consult?.datetime ?? order.details?.datetime),
    };
  });

  // 짝이 되는 주문이 없는 상담. 지금 구조에서는 생기지 않지만
  // 예전에 만들어진 자료가 목록에서 사라지지 않도록 함께 담는다.
  for (const consult of consultations) {
    if (usedConsultIds.has(consult.id)) continue;
    /*
     * 짝이 되는 주문이 없으므로 환불 문의도 있을 수 없다. 환불 완료로 추정하지 않고
     * 기존 상담 상태를 그대로 대표 값으로 둔다.
     */
    items.push({
      id: consult.id,
      kind: "consultation",
      product: "consultation",
      title: "1:1 사주상담",
      status: consult.status,
      refundCompleted: false,
      displayStatus: consult.status,
      amount: consult.amount,
      createdAt: consult.createdAt,
      href: `/my/consultations/${consult.id}`,
      teacher: text(consult.teacher),
      datetime: text(consult.datetime),
    });
  }

  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** 필터 하나를 적용한다. "all"이면 그대로 돌려준다. */
export function filterMyOrderItems(items: MyOrderItem[], filter: MyOrderFilter): MyOrderItem[] {
  if (filter === "all") return items;
  return items.filter((item) => item.kind === filter);
}
