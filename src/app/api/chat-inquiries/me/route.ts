/**
 * 내 문의방 목록.
 *
 * 회원이면 userId로, 비회원이면 쿠키 토큰 해시로 찾는다.
 * 둘 다 없으면 아직 문의한 적이 없는 방문자이므로 401이 아니라 빈 목록을 돌려준다.
 * 챗봇은 로그인 여부와 상관없이 열리고, 이 응답으로 "이전 문의 없음"을 그대로 그린다.
 */
import { NextResponse } from "next/server";
import {
  listChatInquiriesByGuestTokenHash,
  listChatInquiriesByUserId,
} from "@/lib/server/chatInquiries";
import { resolveChatRequester } from "@/lib/server/chatGuest";
import { handleChatError, toInquiryView } from "@/lib/server/chatInquiryApi";

export async function GET() {
  try {
    const { userId, guestTokenHash } = await resolveChatRequester();
    if (!userId && !guestTokenHash) {
      return NextResponse.json({ inquiries: [] });
    }

    const inquiries = userId
      ? await listChatInquiriesByUserId(userId)
      : await listChatInquiriesByGuestTokenHash(guestTokenHash as string);

    return NextResponse.json({
      inquiries: inquiries.map((inquiry) => ({
        ...toInquiryView(inquiry),
        unreadAgentCount: inquiry.unreadAgentCount,
      })),
    });
  } catch (error) {
    return handleChatError(error);
  }
}
