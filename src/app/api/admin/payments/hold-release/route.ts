/**
 * 관리자 상담 시간 확보(hold) 수동 해제 (P1-04 Stage 4).
 *
 * 결제 승인 전에 확보된 상담 시간이 결제 종료 뒤에도 남은 경우(서버 중단, 해제 실패 등)를
 * 사람이 푼다. 해제 가능 여부는 서버가 결제 기록의 지금 상태로만 정한다
 * (ready·failed·cancelled만 허용, processing·paid·partialCancelled·기록 없음은 거부).
 *
 * 이 API는 결제 상태를 바꾸지 않고, PG를 부르지 않으며, 다른 결제의 hold를 건드리지 않는다.
 * 응답에는 상태값과 문구만 담는다.
 */
import { NextResponse } from "next/server";
import { badRequest, readJsonBody, requireAdmin } from "@/lib/server/chatInquiryApi";
import { runAdminHoldRelease } from "@/lib/server/consultationHold";
import {
  getPaymentByMerchantOrderId,
  isAppStoreConflict,
  readData,
  writeData,
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

  const result = await runAdminHoldRelease(merchantOrderId, {
    getPayment: getPaymentByMerchantOrderId,
    readData,
    writeData,
    isConflict: isAppStoreConflict,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
