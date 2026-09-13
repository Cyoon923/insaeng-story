/**
 * 내 문의방에 고객 메시지 추가.
 *
 * 주인이 아닌 경우와 없는 방, 이미 닫힌 방을 구분해 알려주지 않는다.
 * 데이터 계층이 셋을 모두 null로 돌려주므로 여기서도 같은 404다.
 */
import { NextResponse } from "next/server";
import { addCustomerMessage } from "@/lib/server/chatInquiries";
import { resolveChatRequester } from "@/lib/server/chatGuest";
import {
  badRequest,
  handleChatError,
  notFound,
  readJsonBody,
  toMessageView,
} from "@/lib/server/chatInquiryApi";

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (!body) return badRequest("요청 내용을 읽을 수 없습니다.");

  const inquiryId = typeof body.inquiryId === "string" ? body.inquiryId : "";
  const message = typeof body.message === "string" ? body.message : null;
  if (!inquiryId || message === null) {
    return badRequest("입력한 내용을 다시 확인해 주세요.");
  }

  try {
    const { userId, guestTokenHash } = await resolveChatRequester();
    if (!userId && !guestTokenHash) return notFound();

    const saved = await addCustomerMessage({
      inquiryId,
      userId,
      guestTokenHash,
      body: message,
    });
    if (!saved) return notFound();

    return NextResponse.json({ inquiryId, message: toMessageView(saved) }, { status: 201 });
  } catch (error) {
    return handleChatError(error);
  }
}
