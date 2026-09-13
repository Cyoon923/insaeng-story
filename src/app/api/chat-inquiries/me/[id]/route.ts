/**
 * 내 문의방 하나. 챗봇에서 한 방의 전체 대화를 보여줄 때 쓴다.
 *
 * 문의 id만으로는 아무것도 읽히지 않는다. 회원은 userId, 비회원은 쿠키 토큰 해시가
 * 함께 맞아야 한다. 남의 방 id를 넣으면 없는 방과 똑같이 404다.
 */
import { NextResponse } from "next/server";
import {
  getChatInquiryForGuest,
  getChatInquiryForUser,
} from "@/lib/server/chatInquiries";
import { resolveChatRequester } from "@/lib/server/chatGuest";
import { handleChatError, notFound, toThreadView } from "@/lib/server/chatInquiryApi";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { userId, guestTokenHash } = await resolveChatRequester();
    if (!userId && !guestTokenHash) return notFound();

    const thread = userId
      ? await getChatInquiryForUser(id, userId)
      : await getChatInquiryForGuest(id, guestTokenHash as string);
    if (!thread) return notFound();

    return NextResponse.json(toThreadView(thread));
  } catch (error) {
    return handleChatError(error);
  }
}
