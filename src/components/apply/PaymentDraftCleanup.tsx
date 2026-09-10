"use client";

import { useEffect, useRef } from "react";
import { clearDraft, fetchMe } from "@/lib/client/api";
import type { Order } from "@/lib/types/app";

/**
 * 신청 상품과 draft 저장 키의 대응. 신청 화면들이 실제로 쓰는 flow 값이다.
 * (story-song → "story", premium → "premium", saju-song → "saju-song",
 *  1:1 사주상담 → "consultation")
 */
const FLOW_BY_PRODUCT: Record<string, string> = {
  story: "story",
  premium: "premium",
  "saju-song": "saju-song",
  consultation: "consultation",
};

/**
 * 완료 화면에 도달했을 때 그 신청의 draft 하나만 지운다.
 *
 * 카드 결제는 서버(NICEPAY 승인 라우트)가 주문을 만들고 이 화면으로 보내므로
 * PaySubmit이 draft를 지울 기회가 없다. 서버는 브라우저 localStorage에 접근할 수 없어
 * 정리는 여기(클라이언트)에서만 가능하다.
 *
 * 어떤 상품이었는지는 완료된 주문에서 확인한다. 화면을 여는 GET에는 세션 쿠키가
 * 실리므로 본인 주문 목록에서 id로 찾을 수 있다. 찾지 못하면 아무것도 지우지 않는다.
 * 0원 신청은 PaySubmit이 이미 지웠고, clearDraft는 없는 키에 대해 아무 일도 하지 않는다.
 */
export function PaymentDraftCleanup({ orderId }: { orderId: string }) {
  const handled = useRef(false);

  useEffect(() => {
    if (!orderId || handled.current) return;
    handled.current = true;
    let cancelled = false;

    fetchMe()
      .then((data) => {
        if (cancelled) return;
        const orders = (data?.orders ?? []) as Order[];
        const order = orders.find((item) => item.id === orderId);
        const flow = order ? FLOW_BY_PRODUCT[order.product] : undefined;
        // 상품을 확인하지 못하면 다른 신청 내용을 건드리지 않고 그냥 둔다.
        if (flow) clearDraft(flow);
      })
      .catch(() => {
        // 정리에 실패해도 완료 화면은 그대로 보여야 한다.
      });

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  return null;
}
