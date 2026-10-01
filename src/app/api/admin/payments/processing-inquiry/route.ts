/**
 * 관리자 결제 조회 (P1-02).
 *
 * 승인이 processing으로 남은 결제를 NICEPAY 거래 조회(승인 시도 tid가 있으면 tid, 없으면 주문번호)로 확인한다.
 * 검증이 모두 끝난 paid만 processing → paid로 바꾸고, 그 밖의 결과는 상태를 바꾸지 않는다.
 * 주문·상담은 만들지 않는다. paid가 되면 기존 "재접수"(admin/payments/recommit)가 이어 받는다.
 *
 * 응답에는 안전한 상태값과 문구만 담는다. PG 응답 원문·tid·userId·secret은 담지 않는다.
 */
import { NextResponse } from "next/server";
import { badRequest, readJsonBody, requireAdmin } from "@/lib/server/chatInquiryApi";
import {
  inquireNicepayPayment,
  inquireNicepayPaymentByOrderId,
} from "@/lib/server/nicepayPaymentInquiry";
import { runProcessingPaymentInquiry } from "@/lib/server/processingPaymentInquiry";
import {
  claimPaymentApproved,
  getPaymentByMerchantOrderId,
  markPaymentFailed,
} from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // 관리자 확인이 가장 먼저다.
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await readJsonBody(request);
  if (!body) return badRequest("요청 형식을 확인해 주세요.");
  const merchantOrderId = String(body.merchantOrderId ?? "").trim();
  if (!merchantOrderId) return badRequest("주문번호를 입력해 주세요.");

  try {
    const result = await runProcessingPaymentInquiry(merchantOrderId, {
      getPayment: getPaymentByMerchantOrderId,
      inquireByOrderId: (input) => inquireNicepayPaymentByOrderId(input),
      // 승인 시도 tid가 남아 있는 결제는 그 거래를 직접 조회한다(주문번호 조회보다 우선).
      inquireByTid: (input) => inquireNicepayPayment(input),
      // raw는 넘기지 않는다. 승인 경로와 같은 저장 최소화 방침이다.
      claimApproved: (input) => claimPaymentApproved(input),
      // 검증된 같은 거래가 failed / expired일 때만 processing → failed (WHERE status='processing').
      markFailed: (input) => markPaymentFailed(input),
      now: () => new Date(),
    });
    return NextResponse.json({
      // 내부 결제 상태가 바뀌었는지(paid 전환 또는 failed 확정). 화면은 이때 목록을 다시 읽는다.
      ok: result.changed,
      status: result.status,
      message: result.message,
      nextAction: result.nextAction,
    });
  } catch {
    // 저장 실패 등. 내부 사정은 드러내지 않는다. 상태는 바뀌지 않았거나 조건부 UPDATE 하나뿐이다.
    return NextResponse.json(
      {
        ok: false,
        status: "retry",
        message: "결제 조회 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.",
        nextAction: "retry",
      },
      { status: 500 },
    );
  }
}
