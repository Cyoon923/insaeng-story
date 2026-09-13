/**
 * 관리자 상담원 문의방 목록.
 *
 * chat_inquiries 테이블만 본다. 기존 app_store의 "챗봇 상담원 문의"나
 * 이벤트·무료상담 접수는 이 API에 섞지 않는다.
 */
import { NextResponse } from "next/server";
import { listChatInquiriesForAdmin } from "@/lib/server/chatInquiries";
import {
  handleChatError,
  requireAdmin,
  toAdminInquiryView,
} from "@/lib/server/chatInquiryApi";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const inquiries = await listChatInquiriesForAdmin();
    return NextResponse.json({
      inquiries: inquiries.map((inquiry) => ({
        ...toAdminInquiryView(inquiry),
        // 목록에서 바로 마지막 말을 보여 주기 위한 값. 메시지가 없으면 담기지 않는다.
        ...(inquiry.lastMessageBody === undefined
          ? {}
          : { lastMessageBody: inquiry.lastMessageBody }),
        ...(inquiry.lastMessageSender === undefined
          ? {}
          : { lastMessageSender: inquiry.lastMessageSender }),
      })),
    });
  } catch (error) {
    return handleChatError(error);
  }
}
