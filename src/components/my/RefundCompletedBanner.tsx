"use client";

/**
 * 환불이 끝난 건의 대표 상태 (Refund-Completed-Detail-Presentation-1).
 *
 * 상세 화면 맨 위에서 "이 건은 환불이 끝났다"를 먼저 알린다. 아래에 남는 진행 단계는
 * 지우지 않는다. 환불 전까지 어디까지 진행됐는지는 고객에게도 기록으로 남아야 한다.
 *
 * 다만 둘을 같은 무게로 나란히 두지는 않는다. 환불이 끝난 건에서 먼저 읽혀야 하는 것은
 * 환불 사실이고, 진행 단계는 그 뒤에 오는 이력이다. 그래서 이 배너가 위에 오고
 * 색과 크기로 먼저 눈에 들어오게 한다.
 *
 * 환불이 끝나지 않은 건에서는 **아무것도 그리지 않는다**(null). 그래서 completed가
 * 아닌 화면의 렌더 결과는 이 컴포넌트가 없을 때와 완전히 같다.
 *
 * 하단 RefundRequestSection은 그대로 둔다. 저쪽은 문의 접수·상태 영역이고
 * 이쪽은 화면 대표 상태다. 문구는 새로 만들지 않고 같은 상수를 쓴다.
 */
import { useCallback, useEffect, useState } from "react";
import { fetchMe } from "@/lib/client/api";
import {
  REFUND_COMPLETED_MESSAGE,
  hasCompletedRefundForOrder,
} from "@/lib/refundRequestSection";
import type { LatestRefundRequestsView } from "@/lib/types/app";

export function RefundCompletedBanner({ orderId }: { orderId: string }) {
  /** 읽기 전에는 null이다. 확인하지 못한 상태를 환불 완료로 그리지 않는다. */
  const [completed, setCompleted] = useState(false);

  const read = useCallback(async (): Promise<boolean> => {
    try {
      const data = await fetchMe();
      return hasCompletedRefundForOrder(
        data?.latestRefundRequests as LatestRefundRequestsView | undefined,
        orderId,
      );
    } catch {
      // 읽지 못했으면 아무것도 바꾸지 않는다. 기존 화면 그대로 둔다.
      return false;
    }
  }, [orderId]);

  useEffect(() => {
    read().then(setCompleted);
  }, [read]);

  if (!completed) return null;

  return (
    <section className="px-4 pt-5">
      <div className="rounded-2xl bg-[#403A49] p-4 text-center">
        <span className="inline-block rounded-full bg-white px-3 py-1 text-[14px] font-bold text-[#403A49]">
          환불 완료
        </span>
        <p className="mt-2 text-[15px] leading-relaxed text-white">{REFUND_COMPLETED_MESSAGE}</p>
      </div>
    </section>
  );
}
