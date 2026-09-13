/**
 * 내 문의방을 읽었다고 표시한다.
 *
 * 읽음은 상태를 바꾸는 일이라 GET이 아니라 POST로 둔다.
 * 상세 조회(GET)가 읽음까지 처리하면 화면에 보이지 않은 재시도나 주기 조회만으로도
 * 안 읽은 답변이 사라질 수 있다.
 *
 * 문의 id만으로는 아무것도 바꾸지 않는다. 회원은 userId, 비회원은 쿠키 토큰 해시가
 * 함께 맞아야 하고, 남의 방 id를 넣으면 없는 방과 똑같이 404다.
 */
import { NextResponse } from "next/server";
import {
  markChatInquiryReadForGuest,
  markChatInquiryReadForUser,
} from "@/lib/server/chatInquiries";
import { resolveChatRequester } from "@/lib/server/chatGuest";
import { handleChatError, notFound } from "@/lib/server/chatInquiryApi";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { userId, guestTokenHash } = await resolveChatRequester();
    if (!userId && !guestTokenHash) return notFound();

    const marked = userId
      ? await markChatInquiryReadForUser(id, userId)
      : await markChatInquiryReadForGuest(id, guestTokenHash as string);
    if (!marked) return notFound();

    // 방금 읽었으므로 안 읽은 답변은 없다. 개인정보는 담지 않는다.
    return NextResponse.json({ unreadAgentCount: 0 });
  } catch (error) {
    return handleChatError(error);
  }
}
